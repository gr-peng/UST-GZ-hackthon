"""Build and open the full offline App with the intent clarification demo."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import uuid
import webbrowser

from build_static_site import export

ROOT = Path(__file__).resolve().parents[1]


def main():
    # Output is always a new directory inside this checkout; no existing files are deleted.
    output = ROOT / '.runtime' / ('intent-preview-' + uuid.uuid4().hex[:10])
    export(output)
    handler = partial(SimpleHTTPRequestHandler, directory=str(output))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    url = f'http://127.0.0.1:{server.server_port}/?offline=1#/bot'
    print(f'Local preview: {url}\nPress Ctrl+C to stop.', flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
