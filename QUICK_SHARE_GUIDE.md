# 🚀 Quick Share Guide - La Carta

## My Recommendation: 2-Step Ngrok Setup (5 minutes)

### Step 1: Sign up for free ngrok account
1. Go to: https://dashboard.ngrok.com/signup
2. Sign up with Google/GitHub (instant)
3. Copy your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

### Step 2: Configure & Run
```bash
# Add your auth token (one-time setup)
ngrok config add-authtoken YOUR_TOKEN_HERE

# Start sharing!
ngrok http 3000
```

Then share the URL it gives you (like `https://abc123.ngrok-free.app`) with friends!

---

## Alternative Options

### 🏠 Option A: Local Network (Immediate, No Setup)
**Best for:** Friends at your house / on same WiFi
```bash
# Your friends can access:
http://192.168.4.27:3000
```

### 🌐 Option B: Cloudflare Tunnel (Also Free)
**Best for:** If you prefer Cloudflare over ngrok
```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

### 📦 Option C: LocalTunnel (No signup needed)
**Best for:** Quick one-time shares
```bash
npm install -g localtunnel
lt --port 3000
```
*Note: Can be slower than ngrok*

### 🚢 Option D: Quick Deploy to Vercel (10 min)
**Best for:** More permanent testing
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel

# Share the URL it gives you!
```

---

## Why I Recommend Ngrok for Testing:

✅ **Reliable** - Works every time
✅ **Fast** - No lag for real-time testing  
✅ **HTTPS** - Secure by default
✅ **Custom domains** - Can use lacarta.ngrok.io
✅ **Inspect traffic** - See all requests/responses
✅ **No redeploy** - Changes reflect instantly

## Quick Commands Cheat Sheet:

```bash
# After ngrok setup:
ngrok http 3000              # Share frontend
ngrok http 3001              # Share backend (in new tab)

# See all tunnels:
ngrok tunnels

# Custom subdomain (paid):
ngrok http 3000 --domain=lacarta.ngrok.io
```

---

**For your use case (playing and refining)**, ngrok is perfect because:
- Your friends get a real URL that works on their phones
- You can fix bugs while they're testing
- No need to deploy every change
- You see exactly what they see

Just takes 5 minutes to set up, then you're good forever! 🎉