"""Private API: keep bound to localhost; reach it remotely through an SSH tunnel."""

from app import create_app

app = create_app(admin=True)
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)
