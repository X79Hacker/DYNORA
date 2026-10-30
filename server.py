"""Serve the included prebuilt DYNORA app on this laptop only. No packages required."""
from pathlib import Path
import http.server,sys,threading,webbrowser
ROOT=Path(__file__).resolve().parent
BUILD=ROOT/'dist'
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(BUILD),**kw)
 def end_headers(self):
  self.send_header('Cache-Control','no-store')
  super().end_headers()
 def log_message(self,*args):pass

def main():
 args=[s for s in sys.argv[1:] if not s.startswith('--')]
 port=int(args[0]) if args else 8774
 if not (BUILD/'index.html').is_file():raise SystemExit('Missing dist/index.html. Extract the full ZIP or build with npm ci then npm run build.')
 try:server=http.server.ThreadingHTTPServer(('127.0.0.1',port),Handler)
 except OSError:raise SystemExit(f'Port {port} is already in use. Stop that server or run: py server.py 8775')
 url=f'http://127.0.0.1:{port}/'
 print('DYNORA People & Scene Studio V7 - local laptop build\nFolder: '+str(ROOT)+'\nOpen: '+url+'\nVerification lab: '+url+'verification.html\nResearch tools: '+url+'research.html\nModel showroom: '+url+'showroom.html\nKeep this terminal open. Ctrl+C stops the server.',flush=True)
 if '--no-browser' not in sys.argv:threading.Timer(.7,lambda:webbrowser.open(url)).start()
 try:server.serve_forever()
 except KeyboardInterrupt:print('\nStopped.')
 finally:server.server_close()
if __name__=='__main__':main()
