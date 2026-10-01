# Deploying Garg Jewellers (free)

A plain-English walkthrough. You'll create a few free accounts; I've already set
up everything on the code side. Do the steps in order. Total time ~30–45 min.

**The free stack**
- **Cloudinary** — stores your product photos (survives every update)
- **Neon** — the database (your products, orders)
- **Render** — runs the backend
- **Vercel** — runs the website

> Note: on the free backend, the AI white-bg/dark-bg feature is **off** (it needs
> more memory). Photo upload, enhancement, and zoom still work. It switches back
> on when you upgrade the Render plan (~$7/mo) and set `ENABLE_BG_REMOVAL=true`.

---

## 0) Put the code on GitHub
1. Create a free account at **github.com** if you don't have one.
2. Create a new **empty** repository (e.g. `garg-jewellers`), private is fine.
3. In this project folder, run the commands GitHub shows you — they look like:
   ```bash
   git remote add origin https://github.com/<you>/garg-jewellers.git
   git branch -M main
   git push -u origin main
   ```
   (The repo is already committed locally — you just add the remote and push.)

## 1) Cloudinary (photo storage)
1. Sign up at **cloudinary.com** (free).
2. On the dashboard you'll see **Cloud name**, **API Key**, **API Secret** — keep
   these three handy for step 3.

## 2) Neon (database)
1. Sign up at **neon.tech** (free).
2. Create a project. Copy the **connection string** — it looks like
   `postgresql://user:pass@ep-xxx.neon.tech/neondb`.
3. Change the prefix to `postgresql+psycopg2://` (so it reads
   `postgresql+psycopg2://user:pass@ep-xxx.neon.tech/neondb`). Keep it for step 3.

## 3) Render (backend)
1. Sign up at **render.com** (free), connect your GitHub.
2. **New → Blueprint**, pick your repo. Render reads `render.yaml`.
3. It will ask for the secret values — fill in:
   - `DATABASE_URL` → the Neon string from step 2
   - `OWNER_EMAIL` / `OWNER_PASSWORD` → your owner login (choose a strong password)
   - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` → step 1
   - `FRONTEND_ORIGIN` → leave as a placeholder for now; update after step 4
   - `PUBLIC_BASE_URL` → the backend URL Render assigns (e.g.
     `https://garg-backend.onrender.com`) — set it once you see it
4. Deploy. When it's live, open `https://<your-backend>.onrender.com/docs` — you
   should see the API. The database tables and your owner account are created
   automatically on first boot.

## 4) Vercel (website)
1. Sign up at **vercel.com** (free), connect GitHub.
2. **Add New → Project**, pick the repo. Set **Root Directory** to `frontend`.
3. Add an **Environment Variable**:
   - `NEXT_PUBLIC_API_BASE` = your Render backend URL (from step 3)
4. Deploy. You'll get a URL like `https://garg-jewellers.vercel.app`.

## 5) Final wiring
1. Back in **Render**, set `FRONTEND_ORIGIN` to your Vercel URL and
   `PUBLIC_BASE_URL` to the Render URL, then redeploy (so the site and API trust
   each other).
2. Open your Vercel URL → **/admin/login**, sign in with your owner email/password.
3. Start adding products and uploading real photos. 🎉

## Load the sample catalogue (optional)
To preview with the demo products, in Render open the service **Shell** and run:
```bash
python -m app.seed
```
(Skip this once you're adding your own products.)

## When you upgrade later (to turn the AI back on)
- Bump the Render plan to one with ≥1GB RAM
- Add `rembg[cpu]` to `backend/requirements.txt`
- Set `ENABLE_BG_REMOVAL=true`
- Redeploy — white-bg/dark-bg variants start generating again
