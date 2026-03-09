# Stronghold Data — Industry Intelligence Dashboard

AI adoption, competitive landscape, KPIs, and labor market impact — powered by live research.

Built by **Avion Bryant** · CTO of Stronghold Data

## Deploy to Vercel

### 1. Create a GitHub repo
```bash
cd stronghold-industry-dashboard
git init
git add .
git commit -m "Industry Dashboard v1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stronghold-industry-dashboard.git
git push -u origin main
```

### 2. Deploy on Vercel
- Go to [vercel.com](https://vercel.com) → **Add New Project**
- Import your GitHub repo
- Before deploying, go to **Settings → Environment Variables**
- Add: `ANTHROPIC_API_KEY` = your Anthropic API key
- Hit **Deploy**

### 3. Done
Your dashboard will be live at `https://stronghold-industry-dashboard.vercel.app` (or whatever Vercel assigns).

## Local Development
```bash
npm install
npm run dev
```
Note: For local dev, the Vite proxy handles API routing. For production on Vercel, the `api/claude.js` serverless function handles it.
