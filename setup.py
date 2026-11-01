"""Run once with Python: create local settings without replacing existing secrets."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parent
backend = root / 'backend' / '.env'
frontend = root / 'frontend' / '.env'
if not backend.exists():
    text = (root / 'backend' / '.env.example').read_text()
    backend.write_text(text.replace('REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS', secrets.token_hex(32)))
    try:
        backend.chmod(0o600)
    except OSError:
        pass  # Windows manages access with its own file permissions.
    print('Created backend/.env with a private random secret.')
else:
    print('Kept existing backend/.env.')
if not frontend.exists():
    frontend.write_text((root / 'frontend' / '.env.example').read_text())
    print('Created frontend/.env.')
print('Next: follow README.md to install dependencies and set your admin password.')
