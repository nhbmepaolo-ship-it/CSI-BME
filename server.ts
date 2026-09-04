import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app';
import { sendWeeklyCardIfConfigured } from './server/notify';

// This file is only used for LOCAL DEVELOPMENT (npm run dev) and TRADITIONAL NODE HOSTING
// (npm start, e.g. on a VPS/Render/Railway where a long-running Node process is fine).
// It is NOT used on Vercel — Vercel runs api/[...path].ts as a serverless function instead,
// which reuses the exact same routes via createApiApp() so behavior stays identical.
//
// The scheduled weekly LINE/Telegram card uses Vercel Cron on Vercel (see vercel.json),
// which has no equivalent on traditional Node hosting — so for that case only, this file
// runs its own lightweight in-process scheduler below instead.
async function startServer() {
  const app = createApiApp();
  const PORT = 3000;

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

    // Traditional-hosting-only scheduler: fires the same weekly card send Vercel Cron
    // would trigger, checked once a minute. Guards against sending twice in the same
    // day with an in-memory flag — fine for a single long-running process, but note
    // this resets (and could double-send once) if the process restarts right at 09:00.
    let lastSentDateKey = '';
    setInterval(() => {
      const nowBangkok = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const isThursday = nowBangkok.getDay() === 4;
      const isNineAM = nowBangkok.getHours() === 9 && nowBangkok.getMinutes() === 0;
      const dateKey = nowBangkok.toISOString().substring(0, 10);

      if (isThursday && isNineAM && lastSentDateKey !== dateKey) {
        lastSentDateKey = dateKey;
        sendWeeklyCardIfConfigured()
          .then(result => console.log('Weekly card auto-send result:', result.message))
          .catch(err => console.error('Weekly card auto-send failed:', err));
      }
    }, 60000);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
