# 🚀 Care Setu Deployment Checklist

## Status

- ✅ **GitHub:** Code pushed to `github.com/drvijayadutta-afk/Care-Setu`
- ✅ **Vercel Frontend:** Building (auto-redeploy triggered, should complete in 1-2 min)
- ⏳ **Render Backend:** Ready to deploy (follow checklist below)
- ⏳ **WhatsApp Webhook:** Pending backend URL

---

## Frontend (Vercel) — Already Deploying ✅

Your Vercel project is already auto-deploying. Watch your dashboard:

1. **Go to:** vercel.com/dashboard
2. **Look for:** `care-setu` project
3. **Status:** Should show "Building" or "Deployed" (the root `vercel.json` fix I pushed)
4. **When done:** You'll get a public URL like `https://care-setu-xxxxx.vercel.app`

**Once frontend is live,** you'll see a dashboard at that URL (it will error trying to talk to the backend until you complete the next section).

---

## Backend (Render) — Do This Now 🎯

### Before You Start
Gather these credentials:

- [ ] **Redis URL** from Upstash (https://upstash.com)
  - Free tier, takes 2 min to set up
  - Copy the Redis URL
- [ ] **WhatsApp credentials:**
  - [ ] `WHATSAPP_PHONE_NUMBER_ID` (from Meta Business Manager)
  - [ ] `WHATSAPP_ACCESS_TOKEN` (system user token from Meta)
  - [ ] `WHATSAPP_VERIFY_TOKEN` (make up any string, e.g., `MySecureToken123`)
  - [ ] `WHATSAPP_API_VERSION` (usually `v21.0`)
- [ ] **API Keys:**
  - [ ] `ANTHROPIC_API_KEY` (from console.anthropic.com)
  - [ ] `OPENAI_API_KEY` (from platform.openai.com)
- [ ] **Coordinator phone number:**
  - [ ] `COORDINATOR_WHATSAPP_NUMBER` (e.g., `91XXXXXXXXXX`)
- [ ] **Optional (skip if not needed):**
  - [ ] Practo credentials
  - [ ] Apollo Hospital credentials

### Deploy Steps

1. **Go to render.com** → Sign in (or sign up with GitHub)

2. **New Web Service:**
   - Click **New +** → **Web Service**
   - Select `Care-Setu` GitHub repo
   - Click **Connect**

3. **Config (mostly auto-filled by render.yaml):**
   - Name: `care-setu-backend`
   - Environment: Node
   - Plan: Starter (free)
   - Region: Oregon (or your region)

4. **Add Environment Variables:**
   - Click **Add Environment Variable** for each:
     ```
     REDIS_URL = [paste from Upstash]
     WHATSAPP_PHONE_NUMBER_ID = your_id
     WHATSAPP_ACCESS_TOKEN = your_token
     WHATSAPP_VERIFY_TOKEN = MySecureToken123
     WHATSAPP_API_VERSION = v21.0
     ANTHROPIC_API_KEY = sk-ant-...
     OPENAI_API_KEY = sk-...
     COORDINATOR_WHATSAPP_NUMBER = 91XXXXXXXXXX
     ```
   - (Skip Practo/Apollo if you're not using them)

5. **Create:**
   - Click **Create Web Service**
   - Render auto-creates PostgreSQL database (no action needed)
   - Watch the logs as it builds
   - Deployment takes ~2-3 minutes

6. **When done:**
   - Render shows you the public URL, e.g.: `https://care-setu-backend.onrender.com`
   - Copy this URL

---

## Connect Frontend to Backend 🔗

Once the Render backend is live:

1. **Go to vercel.com/dashboard** → `care-setu` project
2. **Settings** → **Environment Variables**
3. **Add/Update:**
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://care-setu-backend.onrender.com`
4. **Deployments** → Click **...** on latest → **Redeploy**

Now your frontend knows where to find the backend.

---

## Configure WhatsApp Webhook (Final Step) 📱

Tell Meta where to send incoming messages:

1. **Go to Meta Business Manager** → **Apps** → Your WhatsApp App
2. **Configuration** → **Webhook Settings:**
   - **Callback URL:** `https://care-setu-backend.onrender.com/webhook/whatsapp`
   - **Verify Token:** (the same `WHATSAPP_VERIFY_TOKEN` from Render)
3. **Subscribe to:**
   - `messages`
   - `message_status`
   - `message_template_status_update`
4. **Save**

Done! WhatsApp messages will now flow into your dashboard.

---

## Test It

1. **Frontend:** Visit `https://care-setu-xxxxx.vercel.app`
   - Should load the dashboard
   - No "Cannot reach backend" error
2. **Backend:** Visit `https://care-setu-backend.onrender.com/health`
   - Should return a 200 status (or similar health check response)
3. **WhatsApp:** Send a message from your number to your WhatsApp Business number
   - Should appear in the dashboard in real-time

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Frontend shows "Cannot reach backend" | `NEXT_PUBLIC_API_URL` not set or wrong | Update in Vercel env vars, redeploy frontend |
| Render deployment fails | Missing required env var | Check Render logs, add missing env var, redeploy |
| WhatsApp messages not appearing | Webhook not configured | Configure Meta webhook (Step above) |
| "ANTHROPIC_API_KEY not found" error in logs | Env var not set in Render | Add to Render env vars, redeploy |
| Starter plan keeps sleeping | Normal for free tier (sleeps after 15 min inactivity) | Upgrade to paid, or keep using (it wakes on request) |

---

## Docs

Full detailed guide: See **RENDER_DEPLOYMENT.md** in the repo root.

---

**That's it! You now have a fully deployed Care Setu platform.** 🎉

- Frontend: Live on Vercel
- Backend: Live on Render
- Database: PostgreSQL on Render
- Cache: Redis on Upstash
- WhatsApp: Connected via webhook
