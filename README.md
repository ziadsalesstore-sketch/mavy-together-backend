# Mavy Together backend

A small, separate Shopify app (own database, own admin, own App Proxy) that powers **community voting** for the Mavy Together page. Everything else on that page (hero, promise, weekly reveals, monthly impact) lives in the theme and is edited in the theme editor.

What it does:

- Stores charities and voting cycles (3 or 4 charities each).
- Accepts **one vote per logged-in customer per cycle**. The database enforces it with a unique index, so double clicks and retries cannot create a second vote.
- Never exposes counts, percentages or rankings publicly. Results exist only in this app's admin (Voting, then open a cycle), with CSV export.
- Treats times in **Africa/Cairo** and stores them in UTC.

Public endpoint (through the Shopify App Proxy): `GET/POST https://<store>/apps/together/vote`.

## Setup from scratch (about 20 minutes, all free tiers)

1. **Database.** Create a new Supabase project (not shared with another app). Copy the **Session pooler** connection string (host ends in `pooler.supabase.com`, username `postgres.<project-ref>`). The direct host is IPv6-only and fails on some networks.
2. **Env.** Copy `.env.example` to `.env`. Put the connection string in `DATABASE_URL`. Leave `SCOPES` empty.
3. **Create the Shopify app.** In a terminal here:
   ```
   npm install
   npm run config:link
   ```
   Choose your Partner organisation, create a **new** app called `mavy-together-backend`. The command rewrites `shopify.app.toml`, so afterwards re-check these three things against the file:
   - `api_version = "2025-10"`
   - `redirect_urls = [ ".../auth/callback" ]`
   - the `[app_proxy]` block (subpath `together`, prefix `apps`) and the three `compliance_topics` webhook blocks are still there.
4. **Database tables.** `npx prisma migrate dev --name init`
5. **Deploy on Render (free).** New Web Service from this repo (push it to GitHub first), `render.yaml` is picked up automatically. Set the env vars `DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`. Then set `application_url`, `app_proxy.url` and `redirect_urls` in `shopify.app.toml` to your real Render URL and run `npm run deploy`.
6. **Install** the app on your store (Partner dashboard, then Select store). Open it from Shopify admin Apps.
7. **Keep it awake.** Render's free plan sleeps after about 15 minutes. Add a free UptimeRobot monitor that opens `https://<your-render-url>/healthz` every 5 minutes. This also keeps free Supabase from pausing.
8. **Theme.** In the theme editor, open the Mavy Together page and switch the Voting section on.

## Running a vote

1. Charities: add 3 or 4 (name, short description, cover image link, logo link). Upload photos in Shopify admin, Content, Files, then paste the link.
2. Voting: New cycle, pick the charities, optionally set open and close times (Cairo time).
3. Press **Open voting**. It appears on the page straight away.
4. Press **Close voting** when done (or let the close time pass). Open the cycle to see private results, export CSV, and save the **Chosen cause** (you can override the leader).

Rules built in: only one cycle can be open at a time; charities are locked once votes exist; a charity with votes can only be made inactive, not deleted.

## Notes

- Customers must be logged in to vote (works with classic and new customer accounts).
- Data kept about a customer: Shopify customer id, chosen charity, timestamp. The GDPR webhooks delete it on request.
- The first request after a quiet period on Render free can take 30 to 60 seconds. The page shows a "waking up" message.
