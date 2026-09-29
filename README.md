# OpenTab — Hospitality Management Platform

Team coursework for Principles of Software Engineering (PSI). OpenTab combines guest-facing features with waiter and venue-owner workflows using React, TypeScript, Vite, Django REST Framework and MySQL.

## Features and structure

- `OpenTab/`: web frontend, including waiter and owner modules.
- `app_fronted/frontend_ssu1-10.v2/`: separate guest/mobile-oriented frontend; retained as a distinct implementation, not assumed interchangeable with the web client.
- `backend/`: Django API for authentication, menus, orders, reservations, groups, tables, payments and venue management.
- `database/schema.sql`: schema without the original populated database dump.

## Team contribution

The project's author record assigns Milica Tadić the web frontend and backend for waiter workflows (SSU 11–15): login, orders, table transfer and payment collection. Other recorded contributors are Ivana Mušikić (guest auth/profile/friends/groups/table flows), Nina Kaljević (guest menu/orders/payments/reservations), and Boško Trifunović (owner menu/venue/staff/analytics). Shared infrastructure is not attributed to a single person. This is a team project, not a claim of sole authorship.

## Local backend setup

Use a clean local MySQL instance and Python 3.12+ (the source settings identify Django 6). Dependencies listed in `backend/requirements.txt` are inferred from imports, not a reproduced environment lock.

1. Install dependencies with `python -m pip install -r backend/requirements.txt` in your virtual environment.
2. Review and import `database/schema.sql` into a disposable local database using MySQL. The script creates and selects `opentab`. It is intended for an empty database, not repeatable migrations against an existing one.
3. Create a dedicated local database user with access to that database. Set the environment variables shown below in the terminal that will run Django.
4. From `backend/`, run `python manage.py check`, `python manage.py migrate`, then `python manage.py runserver 127.0.0.1:8000`.

PowerShell configuration example:

```powershell
$env:DJANGO_SECRET_KEY = '<generate a new random local key>'
$env:DB_PASSWORD = '<your local database password>'
$env:DB_USER = 'opentab'
$env:DB_NAME = 'opentab'
$env:DJANGO_DEBUG = 'true'
```

Generate a key with `python -c "import secrets; print(secrets.token_urlsafe(50))"`. No `.env` loader is configured: set these variables in the process environment. Optional variables are `DB_HOST`, `DB_PORT`, `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`. Defaults restrict hosts/origins to local development addresses. Application models use `managed = False`, so Django migrations do **not** create the OpenTab domain tables: the SQL import is required. Django migrations handle Django's own tables.

## Frontend setup

In `OpenTab/`, run `npm ci`, then `npm run dev`. The Vite development proxy forwards `/api` to `http://127.0.0.1:8000`; the web UI uses port 5173. Use a Node version compatible with the committed Vite dependency. `npm run build` and `npm run lint` provide build and static checks. The separate guest frontend has its own `package.json` and lockfile; install and run it independently, stopping the other frontend if their ports conflict.

## Verification and limitations

Python files passed syntax parsing during portfolio preparation. Full backend tests, frontend builds and database integration have not been executed for this package. Existing backend test files are retained, but unmanaged tables require an appropriately prepared test database. The populated SQL dump, accounts, sessions and local secrets are deliberately not distributed; no ready-to-use demo accounts are promised. Some frontend modules contain mock data. This is a coursework portfolio, not a production-ready deployment or payment-processing service. Confirm team agreement before public publication.
