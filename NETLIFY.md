# Netlify deployment

This repository contains a Node.js API (`server.js`) backed by PostgreSQL and a browser client in `public/`. Netlify cannot run the long-lived Node server directly, so the deployment is split into two parts:

1. Deploy the existing Node service using `render.yaml` (or another Node host) with `DATABASE_URL` and `ADMIN_PASSWORD`.
2. Import this repository into Netlify. `netlify.toml` publishes `public/` and proxies `/api/*` and `/healthz` to the backend.

The configuration currently points to:

`https://mr-russians-casino.onrender.com`

If your backend has a different hostname, edit the two proxy targets in `netlify.toml` before deploying. Because the API is proxied through the Netlify domain, the existing relative API URLs and secure cookies continue to work from the published site.

## Netlify settings

- Build command: leave blank
- Publish directory: `public`
- Functions directory: none

## Important

This is a play-money casino only. Keep `DATABASE_URL` and `ADMIN_PASSWORD` configured on the backend, never in Netlify frontend environment variables or committed files.
