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


## Security / anti-cheat architecture

The casino is intentionally **server-authoritative**. The browser is treated as untrusted. A player can edit JavaScript, DevTools variables, DOM text, requests, or create their own UI; none of those actions are accepted as a balance authority.

- `/api/balance` no longer accepts client-supplied balances.
- All balance-changing casino games are resolved on the server with cryptographic randomness.
- Blackjack, Mines, Higher/Lower, Risk Taker, and the multi-step rounds keep their state in PostgreSQL, not in trusted browser state.
- Bets and payouts are checked and applied inside database transactions with row locks.
- Duplicate/out-of-order round actions are rejected when there is no matching server round.
- Admin balance changes require the authenticated admin role and cancel any active player round.
- The free bonus is server-timed and cannot be repeatedly claimed by changing a browser timer.
- Sessions are stored as hashes in PostgreSQL and are delivered through an HttpOnly, SameSite cookie in production.
- State-changing API calls require a same-origin request header as additional CSRF protection.
- Login, signup, chat, and game requests have rate limits.
- SQL uses parameterized queries; client values are validated server-side.
- HTTPS is enforced on Render and security headers/CSP are enabled.

### Important limitation
No web application can guarantee that an attacker can never compromise an account, server, hosting provider, database, administrator credentials, or a user's own browser. The goal here is that **client-side JavaScript manipulation cannot directly award or set real stored coins**. If someone obtains an admin password/session or compromises the hosting/database environment, that is a separate server/account security incident.


## Version 3 upgrades
- Expanded admin control center: player search, balance tools, force logout, round reset, broadcasts, and Gartic round controls.
- Shorter, scrollable community chat layout.
- Colorful animated UI refresh with glow effects, animated leaderboard banner, and richer cards.
- Arcade+ adds Lucky Wheel, Color Pick, Tower, Cups, Limbo, Dice Duel, Lucky 7, Mini Baccarat, and Keno.
- Rebuilt Plinko animation around the server-resolved result so the visual ball path cannot desync from the paid result.
- Fixed Mines cash-out so the cash-out action no longer requires a tile index.
- Profile Studio with many preset animated frames, name styles/effects, colors, badges, titles, and banners stored online.
- Gartic Draw multiplayer-style round: shared prompt, canvas drawing submission, drawing gallery, and voting.
