import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app';

// Vercel treats this file as a serverless function and routes every request under
// /api/* to it (the [...path] filename is a catch-all, matching /api/image-proxy,
// /api/fetch-sheet-data, /api/send-line, /api/send-telegram, /api/sync-sheets, etc.
// all with this single function). This is what was MISSING before — with no file
// under /api, Vercel had nothing to route those requests to, hence the 404s.
//
// The Express app itself (from createApiApp) is already a valid (req, res) handler,
// so we simply hand each incoming request straight to it. No app.listen() here —
// Vercel manages the actual server process, this function just handles one request
// at a time.
const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as any, res as any);
}
