# Sohel SMM Panel Ultra — starter build

Responsive React dashboard with an Express + PostgreSQL API. This is a starter foundation, not a complete commercial SMM platform.

## Included
- Customer registration and login using bcrypt-hashed passwords and JWT authentication
- Account-specific order history and wallet balance
- Service catalogue and order creation with database transaction and balance check
- Admin bootstrap from environment variables and protected admin APIs
- PostgreSQL schema and Render deployment blueprint

## Requirements
- Node.js 20+
- PostgreSQL database

## Run locally

### 1. Backend
```bash
cd server
cp .env.example .env
```
Edit `server/.env` and set a real `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, and (optionally) `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and `ADMIN_NAME`.

Then run:
```bash
npm install
npm run db:init
npm run dev
```
API: `http://localhost:4000`

### 2. Frontend
Open a second terminal:
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`. Set `VITE_API_URL` in `client/.env` to the backend URL if it is not running locally.

## Deploy on Render
1. Push the project to a private GitHub repository.
2. Create or use your PostgreSQL database in Render. Copy its **Internal Database URL** for a Render web service in the same region.
3. Deploy the backend as a Web Service with root directory `server`, build command `npm install`, and start command `npm start`.
4. Set `DATABASE_URL` to the database URL, `FRONTEND_ORIGIN` to the exact deployed frontend origin, `JWT_SECRET` to a new random secret (32+ characters), and `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` to create the first admin. Never put these secrets in frontend files or GitHub.
5. Initialize the schema once from the backend Shell using `npm run db:init`.
6. Deploy the frontend as a Static Site with root directory `client`, build command `npm install && npm run build`, and publish directory `dist`.
7. Set `VITE_API_URL` to the deployed backend URL, then redeploy the frontend.

The included `render.yaml` is a blueprint template. Review environment values before using it. It expects you to connect your existing database URL.

## Important limitations before public launch
- Payment gateway and verified payment webhooks are not implemented; wallet top-ups are disabled.
- A real third-party provider API is not configured. Orders are saved to your database but are not automatically fulfilled.
- Support tickets, affiliate payouts, and some settings screens are placeholders.
- Add HTTPS-only hosting, backups, monitoring, audit logs, privacy policy, terms, and security review before accepting customers or money.
- Offer only services permitted by the relevant social platforms and providers. Do not promise fake engagement or guaranteed followers/views.

## Security notes
- Keep `server/.env` out of Git. Never share database URLs, JWT secrets, or admin passwords in chat.
- If a database password has been exposed, rotate it in the database provider and update the service environment variable.
