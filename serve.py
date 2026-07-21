#!/usr/bin/env python3
"""Static server for the project: HTTP on 8800 and HTTPS on 8843.

HTTPS is what other LAN devices (phones) should use — installing the PWA and
registering the service worker need a secure context. It picks up the
mkcert-generated cert from the project root (any "<name>.pem" +
"<name>-key.pem" pair). See README.md, "Running locally".
"""
import http.server
import ssl
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HTTP_PORT = 8800
HTTPS_PORT = 8843


def find_cert_pair():
    for key in sorted(ROOT.glob("*-key.pem")):
        cert = key.with_name(key.name.replace("-key.pem", ".pem"))
        if cert.exists():
            return cert, key
    sys.exit(
        "No mkcert cert pair found in the project root. Generate one with e.g.:\n"
        "  mkcert <your-lan-ip> macbook.local localhost"
    )


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        # The private key lives in the served directory — never serve cert files.
        if self.path.split("?", 1)[0].endswith(".pem"):
            self.send_error(404)
            return None
        return super().send_head()


def main():
    cert, key = find_cert_pair()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, key)

    https_server = http.server.ThreadingHTTPServer(("0.0.0.0", HTTPS_PORT), Handler)
    https_server.socket = ctx.wrap_socket(https_server.socket, server_side=True)

    http_server = http.server.ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), Handler)
    threading.Thread(target=http_server.serve_forever, daemon=True).start()

    print(f"Serving {ROOT}")
    print(f"  http://0.0.0.0:{HTTP_PORT}")
    print(f"  https://0.0.0.0:{HTTPS_PORT} (cert: {cert.name})")
    https_server.serve_forever()


if __name__ == "__main__":
    main()
