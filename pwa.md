# Testing the PWA

How to verify the installable/offline behaviour ([manifest.json](manifest.json),
[sw.js](sw.js)) on a desktop and on a real phone.

For *what* the PWA does and how storage works, see the "Installing (PWA)" and
"Storage" sections of the [README](README.md). This file is about testing it.

## The one rule that dictates everything

Service workers and install both require a **secure context**. That means HTTPS,
plus a hardcoded exception for **`localhost` / `127.0.0.1` / `::1`**.

The exception is the *name* `localhost` — not "an address on your own network".
So `http://192.168.x.x:8899` is **not** a secure context: no service worker
registers, nothing is cached, and there's no install prompt. There is no "it's
my LAN, trust me" heuristic. Every option below is a way around that one rule.

## Desktop (start here)

Nothing to set up — `localhost` is already inside the exception:

```sh
python3 -m http.server 8899
```

Open <http://localhost:8899> in Chrome:

- **Install**: an install icon appears in the address bar. Installed, it opens
  in its own window — no tabs, no URL bar.
- **DevTools → Application** is where the real answers are:
  - *Manifest* — name, icons, and any installability warnings.
  - *Service Workers* — which worker is active; "Update on reload" and
    "Offline" checkboxes for testing.
  - *Storage* → *IndexedDB* → `country_learning` → `state` → `database` — the
    SQLite bytes. Also shows whether storage is marked persistent.
  - *Cache Storage* → `country-learning-v<N>` — should hold ~200 entries
    including `countries.pmtiles`, `sql-wasm.wasm` and a `/font/` glyph range.
- **Offline check**: the honest one is to **stop the server** (Ctrl+C) and
  reload. DevTools' "Offline" checkbox doesn't intercept the worker's own
  requests, and on a localhost server turning off Wi-Fi does nothing (loopback
  stays up).

## Android

**Option 1 — port forwarding (easiest, no HTTPS, no certs).** Connect by USB,
then on the desktop open `chrome://inspect/#devices` → **Port forwarding** → map
`8899` to `localhost:8899`. The phone loads <http://localhost:8899> and, as far
as it's concerned, that *is* localhost — secure context, worker registers,
install works.

**Option 2 — force the LAN IP.** On the phone: `chrome://flags` →
**"Insecure origins treated as secure"** → add `http://192.168.x.x:8899` →
enable → relaunch. This overrides the secure-context check for that origin only.
Undo it when you're done.

## iOS

Neither Android option exists: no port forwarding, no flags. iOS needs **real
HTTPS** — use the mkcert or tunnel section below.

⚠️ **The trap**: iOS lets you *Add to Home Screen* over plain HTTP, and the
`apple-mobile-web-app-capable` tag makes it launch chromeless. **It will look
installed and native — but no service worker means no caching at all**: it
re-downloads the ~7MB tiles archive on every launch and is useless offline. It's
a cosmetic demo, not a test of anything in `sw.js`.

## HTTPS on the LAN with mkcert

Real certs for your LAN IP, trusted by the phone. Works for both platforms.

```sh
# once per machine: create and trust the local CA (asks for your password)
mkcert -install

# cert for the address the phone will hit — find it with: ipconfig getifaddr en0
mkcert 192.168.0.236 localhost
# -> 192.168.0.236+1.pem  and  192.168.0.236+1-key.pem
```

`http.server` has no TLS flag, so wrap the socket (adjust the two filenames):

```python
# serve_https.py — serves the current directory over HTTPS
import http.server
import ssl

PORT = 8443
CERT = "192.168.0.236+1.pem"
KEY = "192.168.0.236+1-key.pem"

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(CERT, KEY)

server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), http.server.SimpleHTTPRequestHandler)
server.socket = context.wrap_socket(server.socket, server_side=True)
print(f"serving https://0.0.0.0:{PORT}")
server.serve_forever()
```

Then trust the CA on the phone. Copy `rootCA.pem` from `$(mkcert -CAROOT)` and:

- **Android**: Settings → Security → Encryption & credentials → Install a
  certificate → **CA certificate**. Chrome honours user-added CAs.
- **iOS**: install the profile (Settings → Profile Downloaded), then the step
  everyone misses — Settings → General → About → **Certificate Trust Settings**
  → toggle full trust for the mkcert CA. Without it the cert is installed but
  not trusted, and Safari still refuses.

Don't commit the `.pem` files.

## Tunnel (no certs, works everywhere)

Least friction, especially for iOS — a public HTTPS URL with a real cert:

```sh
brew install cloudflared
cloudflared tunnel --url http://localhost:8899
```

Trade-off: the app is briefly reachable from the internet.

## What to check once it's installed

- [ ] Launches in its own window — **no tab strip, no URL bar**.
- [ ] Correct icon on the home screen / dock; on Android the maskable icon fills
      the shape rather than sitting in a white blob.
- [ ] **Kill the server / go into airplane mode and relaunch**: it should boot,
      play, and render country labels (those need the cached glyph range).
- [ ] The Stats page loads — that proves `sql.js` and its `.wasm` came from
      cache.
- [ ] Stats survive a relaunch (IndexedDB, not evicted).

### Storage persistence

`navigator.storage.persist()` is requested at startup, but Chrome only grants it
to installed apps or sites with real engagement — **it returns `false` in a
plain browser tab, which is expected, not a bug**. Check the real answer in
DevTools → Application → Storage, or run `navigator.storage.persisted()` in the
console of the *installed* app.

### Upgrading an installed copy

An installed app has no tab to hard-refresh and no URL bar to escape with, so
the [README](README.md)'s rule matters more here: **bump `CACHE_VERSION` on
every deploy**, or installed users keep serving the old code forever. Expect the
usual two-reload dance — the first load registers the new worker, the second is
controlled by it.
