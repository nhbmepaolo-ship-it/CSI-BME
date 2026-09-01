import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app';

// This file is only used for LOCAL DEVELOPMENT (npm run dev) and TRADITIONAL NODE HOSTING
// (npm start, e.g. on a VPS/Render/Railway where a long-running Node process is fine).
// It is NOT used on Vercel — Vercel runs api/[...path].ts as a serverless function instead,
// which reuses the exact same routes via createApiApp() so behavior stays identical.
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
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
