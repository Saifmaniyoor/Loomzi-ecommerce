# Loomzi

Loomzi is a full-stack e-commerce application with a React/Vite frontend and an
Express/MongoDB backend. It uses Node.js and npm; it does not require a Python
virtual environment or a Python `requirements.txt`.

## Prerequisites

- Node.js and npm
- A MongoDB instance and connection URI
- Gmail credentials if you want to use email verification or password-reset
  emails

## Install dependencies

Run these commands from the repository root in PowerShell:

```powershell
Set-Location .\loomzi-server
npm ci

Set-Location ..\loomzi-App
npm ci
```

Each part of the app has its own `package.json` and `package-lock.json`, so
install dependencies separately in both folders.

## Configure the backend

Create `loomzi-server/.env` and set the values for your local environment:

```dotenv
PORT=5000
MONGO_URI=your-mongodb-connection-uri
SESSION_SECRET=replace-with-a-long-random-secret
EMAIL_USER=your-gmail-address
EMAIL_PASS=your-gmail-app-password
SUPER_ADMIN_SETUP_SECRET=replace-with-a-long-random-secret
```

Keep `.env` private; it is excluded from Git. MongoDB must be reachable by the
backend. Gmail email features require an app password in `EMAIL_PASS`.

## Run the app

Open two PowerShell terminals from the repository root.

In the first terminal, start the backend:

```powershell
Set-Location .\loomzi-server
npm run dev
```

In the second terminal, start the frontend on port `5177` (the backend's
configured CORS origin):

```powershell
Set-Location .\loomzi-App
npm run dev -- --port 5177 --strictPort
```

Open the local URL printed by Vite (normally `http://localhost:5177`). The
backend API listens on `http://localhost:5000`.

## Other commands

Run these from the relevant app directory:

```powershell
# Frontend production build
npm run build

# Frontend lint
npm run lint

# Backend production start
npm start
```
