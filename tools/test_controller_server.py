"""Integration checks for the actual local HTTP controller endpoint."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from controller_server import make_handler


class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(lambda _obs: {'left': 0.4, 'right': 0.3, 'brake': False, 'ttl_ms': 200}, 'test-token'))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:%d/control' % self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def packet(self, token='test-token', origin='http://localhost:5173', sequence=7):
        return Request(self.url, data=json.dumps({'schema': 'dynora-controller-1', 'sequence': sequence, 'observation': {'tof': []}}).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Origin': origin})

    def test_command_and_cors(self):
        with urlopen(self.packet(), timeout=2) as response:
            data = json.load(response)
            self.assertEqual(data['sequence'], 7)
            self.assertEqual(data['left'], 0.4)
            self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')

    def test_token_origin_and_packet_validation(self):
        for request, status in [(self.packet(token='bad'), 403), (self.packet(origin='https://example.org'), 403), (self.packet(sequence='bad'), 400)]:
            with self.assertRaises(HTTPError) as caught:
                urlopen(request, timeout=2)
            self.assertEqual(caught.exception.code, status)

    def test_invalid_policy_is_rejected(self):
        self.server.RequestHandlerClass = make_handler(lambda _obs: {'left': float('nan'), 'right': 0, 'brake': False, 'ttl_ms': 200}, 'test-token')
        with self.assertRaises(HTTPError) as caught:
            urlopen(self.packet(), timeout=2)
        self.assertEqual(caught.exception.code, 400)


if __name__ == '__main__':
    unittest.main()
