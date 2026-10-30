"""Local DYNORA controller bridge. Python 3.10+, standard library only.

Run: py tools/controller_server.py --controller examples/reactive_controller.py
A custom policy module exposes policy(observation) returning motor duties.
"""
import argparse
import importlib.util
import json
import math
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


def make_handler(policy, token):
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def origin(self):
            value = self.headers.get('Origin')
            if not value:
                return None
            p = urlparse(value)
            return value if p.scheme == 'http' and p.hostname in ('127.0.0.1', 'localhost', '::1') else False

        def reply(self, code, body):
            data = json.dumps(body, allow_nan=False).encode()
            self.send_response(code)
            origin = self.origin()
            if origin:
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self):
            self.reply(204 if self.origin() is not False else 403, {})

        def do_POST(self):
            if self.origin() is False or self.headers.get('Authorization') != 'Bearer ' + token:
                self.reply(403, {'error': 'Forbidden'})
                return
            if self.path != '/control':
                self.reply(404, {'error': 'Use /control'})
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 2 * 1024 * 1024:
                    raise ValueError('Body must be under 2 MiB')
                self.connection.settimeout(2)
                packet = json.loads(self.rfile.read(length))
                if packet.get('schema') != 'dynora-controller-1' or type(packet.get('sequence')) is not int or not isinstance(packet.get('observation'), dict):
                    raise ValueError('Invalid controller packet')
                if not lock.acquire(blocking=False):
                    self.reply(503, {'error': 'Policy is busy'})
                    return
                started = time.monotonic()
                try:
                    command = policy(packet['observation'])
                finally:
                    lock.release()
                if not isinstance(command, dict):
                    raise ValueError('Policy must return a dict')
                command = {k: command[k] for k in ('left', 'right', 'brake', 'ttl_ms')}
                for k in ('left', 'right'):
                    if type(command[k]) not in (int, float) or not math.isfinite(command[k]) or abs(command[k]) > 1:
                        raise ValueError('Duty must be finite and within -1 to 1')
                if type(command['brake']) is not bool or type(command['ttl_ms']) not in (int, float) or not 50 <= command['ttl_ms'] <= 500:
                    raise ValueError('Invalid brake or TTL')
                if (time.monotonic() - started) * 1000 > command['ttl_ms']:
                    self.reply(504, {'error': 'Policy exceeded its deadline'})
                    return
                self.reply(200, {'sequence': packet['sequence'], **command})
            except (ValueError, KeyError, TypeError) as error:
                self.reply(400, {'error': str(error)})
            except Exception:
                self.reply(500, {'error': 'Policy failed; inspect the Python process'})

        def log_message(self, *_args):
            pass

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--controller', required=True)
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--token')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('user_controller', args.controller)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    token = args.token or secrets.token_urlsafe(24)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(module.policy, token))
    server.daemon_threads = True
    print(f'Controller: http://127.0.0.1:{args.port}/control\nToken: {token}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
