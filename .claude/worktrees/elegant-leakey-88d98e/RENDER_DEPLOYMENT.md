# Care Setu Backend Deployment to Render

## Overview

This guide walks you through deploying the **Care Setu backend** to Render.com. The `render.yaml` file in the repo root is configured to automatically:
- Create a Node.js web service (`care-setu-backend`)
- Create a PostgreSQL database (`care-setu-db`)
- Run database migrations on deploy

## Prerequisites

- GitHub account with `Care-Setu` repo connected
- Render.com account (free tier works for starter projects)
- API keys/credentials for:
  - **Redis URL** (from Upstash or Railway — see below)
  - WhatsApp Cloud API (Meta)
  - Anthropic Claude API
  - OpenAI API
  - Optional: Practo & Apollo Hospital APIs

## Step 1: Set Up Redis (Required)

Your backend uses Redis for caching, job queues, and real-time messaging. You have two options:

### Option A: Upstash (Recommended — Free tier)
1. Go to **upstash.com** → Sign up/log in
2. Create a new database (free Redis instance)
3. Copy the **Redis URL** (looks like `redis://default:...@...upstash.io:...`)
4. Keep this handy — you'll add it to Render env vars in Step 3

### Option B: Railway
1. Go to **railway.app** → Create new project
2. Add Redis service
3. Copy connection string
4. Keep handy for Step 3

## Step 2: Gather Your Secrets

Before deploying, collect all these credentials (you may already have them from local `.env`):

| Variable | Source | Required? |
|----------|--------|-----------|
| `REDIS_URL` | Upstash or Railway | ✅ YES |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Business Manager → Phone Numbers → Your Number ID | ✅ YES |
| `WHATSAPP_ACCESS_TOKEN` | Meta → System User Token (permanent) | ✅ YES |
| `WHATSAPP_VERIFY_TOKEN` | You create this (any string for webhook verification) | ✅ YES |
| `WHATSAPP_API_VERSION` | Usually `v21.0` (check Meta docs for latest) | ✅ YES |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | ✅ YES |
| `OPENAI_API_KEY` | platform.openai.com → API Keys | ✅ YES |
| `PRACTO_CLIENT_ID` | Practo Partner Portal | ❌ Optional |
| `PRACTO_CLIENT_SECRET` | Practo Partner Portal | ❌ Optional |
| `APOLLO_API_KEY` | Apollo Hospitals API Portal | ❌ Optional |
| `COORDINATOR_WHATSAPP_NUMBER` | E.g., `91XXXXXXXXXX` (your care coordinator's WhatsApp #) | ✅ YES |

**Note:** The `render.yaml` already provides `NODE_ENV=production` and `PORT=3000`. Leave those as-is unless you know what you're doing.

## Step 3: Deploy to Render

1. **Go to render.com** → Sign in (use GitHub account for easier setup)

2. **Create new web service:**
   - Click **New +** → **Web Service**
   - Authorize GitHub access if prompted
   - Select the **Care-Setu** repository
   - Click **Connect**

3. **Configure the service:**
   - **Name:** `care-setu-backend` (or your choice)
   - **Environment:** Node
   - **Build Command:** (Leave blank — `render.yaml` specifies it)
   - **Start Command:** (Leave blank — `render.yaml` specifies it)
   - **Plan:** Starter (free tier)
   - **Region:** Oregon (or your preference)

4. **Add Environment Variables** (the big one):
   - Scroll to **Environment Variables** section
   - Click **Add Environment Variable** for each:
     - `REDIS_URL` = (paste from Upstash)
     - `WHATSAPP_PHONE_NUMBER_ID` = (your number ID)
     - `WHATSAPP_ACCESS_TOKEN` = (your Meta token)
     - `WHATSAPP_VERIFY_TOKEN` = (any string, e.g., `your-secret-verify-token`)
     - `WHATSAPP_API_VERSION` = `v21.0`
     - `ANTHROPIC_API_KEY` = (your key)
     - `OPENAI_API_KEY` = (your key)
     - `COORDINATOR_WHATSAPP_NUMBER` = (e.g., `91XXXXXXXXXX`)
     - (Optional) `PRACTO_CLIENT_ID`, `PRACTO_CLIENT_SECRET`, `APOLLO_API_KEY` if you're using those

5. **Create PostgreSQL Database (auto-linked):**
   - The `render.yaml` automatically creates a database named `care-setu-db`
   - Render will auto-inject `DATABASE_URL` into your service
   - **No manual action needed** — it's handled by the YAML

6. **Review & Deploy:**
   - Scroll to bottom → Click **Create Web Service**
   - Render will:
     - Install dependencies (`npm install`)
     - Build backend (`npm run build`)
     - Run migrations (`npx prisma migrate deploy`)
     - Start the service (`npm start`)
   - Watch the deployment logs in the Render dashboard

7. **Get your Backend URL:**
   - Once deployed, Render shows your service URL at the top, e.g.:
     ```
     https://care-setu-backend.onrender.com
     ```
   - This is your `NEXT_PUBLIC_API_URL` for the Vercel frontend

## Step 4: Connect Frontend to Backend

Now that your backend is live, tell Vercel where to find it:

1. **Go to vercel.com/dashboard** → Click your `care-setu` project
2. **Settings** → **Environment Variables**
3. Add (or update):
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://care-setu-backend.onrender.com` (or your actual Render URL)
4. Click **Save**
5. **Deployments** → **Redeploy** the latest commit
   - This rebuilds the frontend with the correct backend URL

## Step 5: Configure WhatsApp Webhook (Important!)

The backend exposes a webhook at `/webhook/whatsapp` for receiving messages. You need to tell Meta where to send them:

1. **Go to Meta Business Manager** → **App Dashboard** → Your WhatsApp App
2. **Webhook Settings:**
   - **Callback URL:** `https://care-setu-backend.onrender.com/webhook/whatsapp`
   - **Verify Token:** (the `WHATSAPP_VERIFY_TOKEN` you set in Render env vars)
3. **Subscribe to fields:** `messages`, `message_status`, `message_template_status_update`
4. Save

Render will then receive incoming WhatsApp messages and process them through your coordinators' dashboard.

## Troubleshooting

### Build fails with "Database connection error"
- **Cause:** The PostgreSQL database is still initializing
- **Fix:** Wait 30 seconds, then restart the deploy from Render dashboard

### "REDIS_URL not found"
- **Cause:** You forgot to add the `REDIS_URL` env var
- **Fix:** Add it in Render → Environment Variables, then redeploy

### "WhatsApp messages not coming through"
- **Cause:** Webhook not configured in Meta
- **Fix:** Follow Step 5 above (webhook configuration)

### "Anthropic API errors"
- **Cause:** Invalid API key or key is out of credits
- **Fix:** Verify your key at console.anthropic.com, ensure you have credits

### Frontend shows "Cannot reach backend"
- **Cause:** `NEXT_PUBLIC_API_URL` on Vercel points to wrong URL
- **Fix:** Double-check the Render service URL, update Vercel env var, redeploy frontend

## Monitoring

After deployment:
- **Render dashboard** → Logs tab: Watch for errors or startup issues
- **Vercel dashboard** → Logs tab: Frontend errors (CORS, API calls, etc.)
- Both dashboards have real-time monitoring; errors appear immediately

## Cost Estimate

- **Render:** Free tier (Starter plan) for the web service and database
- **Upstash:** Free tier includes 10GB Redis
- **API keys:** Usually free tier is sufficient for testing, paid for production

## Next Steps

1. ✅ Push to GitHub (done)
2. ✅ Deploy frontend to Vercel (done)
3. ✅ Deploy backend to Render (this guide)
4. Test the full flow: WhatsApp → Backend → Dashboard
5. Configure real doctors/coordinators in the database (see `prisma/schema.prisma`)

---

**Questions?** Check the logs in Render and Vercel dashboards — they're very detailed and help debug issues quickly.
