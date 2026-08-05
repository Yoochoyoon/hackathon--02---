"""브라우저가 렌더한 PNG를 받아 디스크에 저장하는 임시 수신 서버.

머메이드를 브라우저에서 그린 뒤 그 결과를 파일로 가져와야 하는데, 데이터를
대화로 실어 나르면 낭비가 크다. 브라우저가 여기로 POST 하면 바로 파일이 된다.
렌더가 끝나면 이 파일과 `_mermaid_render.html` 은 지워도 된다.
"""
import base64
import http.server
import pathlib
import sys

OUT = pathlib.Path(__file__).parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        name = self.headers.get("X-Name", "out.png")
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("ascii")
        data = base64.b64decode(raw.split(",", 1)[-1])
        (OUT / name).write_bytes(data)
        print(f"저장 {name} {len(data):,} bytes", flush=True)
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    http.server.HTTPServer(("127.0.0.1", port), Handler).serve_forever()
