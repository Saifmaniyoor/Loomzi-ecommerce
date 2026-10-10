# Loomzi frontend

The frontend is a React application built with Vite. For complete setup
instructions, including backend configuration and running both apps, see the
[project README](../README.md).

From this directory, install dependencies and start the development server:

```powershell
npm ci
npm run dev -- --port 5177 --strictPort
```

The backend allows requests from port `5177`. You can also run `npm run build`
to create a production build or `npm run lint` to check the frontend.
