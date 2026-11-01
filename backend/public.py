"""The ONLY app to expose on the internet. It has no admin routes."""

import os
from werkzeug.middleware.proxy_fix import ProxyFix
from app import create_app

app = create_app()
# Enable only behind the documented loopback proxy that overwrites this header.
if os.getenv("TRUST_LOCAL_PROXY") == "1":
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
