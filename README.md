# Mr.Russians Casino — persistent free-hosting version

This version stores accounts, balances, sessions, and chat in **PostgreSQL** instead of the server's local disk. It is designed for a free Render web service connected to a free PostgreSQL provider such as Neon or Supabase.

## What you need
- A GitHub account
- A free Render account
- A free PostgreSQL database account (Neon or Supabase)

## 1. Create the database
Create a PostgreSQL database with your provider. Copy its **connection string / DATABASE_URL**. Keep it private.

## 2. Upload this folder to GitHub
Create a new GitHub repository and upload the contents of this folder. `package.json`, `server.js`, `render.yaml`, and `public/` should be at the repository root.

## 3. Deploy on Render
In Render, choose **New → Blueprint**, select the GitHub repository, and let Render read `render.yaml`.

When Render asks for environment variables, enter:
- `DATABASE_URL` = your PostgreSQL connection string
- `ADMIN_PASSWORD` = your admin password (at least 8 characters)

The database tables are created automatically the first time the server starts.

## 4. Custom domain
After deployment, open your Render service → Settings → Custom Domains and add your domain. Render will show the DNS record(s) to add at your domain registrar and will handle HTTPS.

## Important
- This app uses virtual/play money only. Do not use it for real-money gambling.
- The database connection string and admin password are secrets. Never commit them to GitHub.
- Free database/hosting limits can change, and free services may sleep or have usage limits, but the database is external so normal web-service restarts do not erase account balances.
