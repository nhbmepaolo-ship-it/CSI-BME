/**
 * /api/image-proxy — Vercel serverless function
 *
 * The app already calls this endpoint, but it only existed inside server.ts
 * (an Express server that does NOT run on a Vercel static deployment). In
 * production the route therefore returned 404, which is the root cause of the
 * missing staff photos in the org chart PDF/PNG export:
 *
 *   - The <img> tags load fine in the browser (a plain cross-origin image
 *     displays without CORS), which is why the Staff Management page always
 *     looked correct.
 *   - Exporting is different: html2canvas must READ the pixels. That needs the
 *     image either same-origin or CORS-enabled. pic.in.th does not send CORS
 *     headers, and reading a cross-origin image taints the canvas, so the
 *     conversion failed and those avatars exported as empty circles.
 *
 * Serving the bytes through this same-origin endpoint removes the CORS問題
 * entirely, so every photo can be converted and appears in the export.
 */

export const config = { runtime: 'nodejs' };

export default async function handler(req: any, res: any) {
  try {
    let imageUrl: string = (req.query?.url as string) || '';

    if (!imageUrl) {
      res.status(400).send('Missing image URL');
      return;
    }

    // Unwrap accidentally nested proxy URLs
    while (imageUrl.includes('/api/image-proxy?url=')) {
      const parts = imageUrl.split('/api/image-proxy?url=');
      imageUrl = decodeURIComponent(parts[parts.length - 1]);
    }

    if (!imageUrl.startsWith('http')) {
      res.status(400).send('Invalid image URL');
      return;
    }

    // Google Drive share links -> direct thumbnail
    if (imageUrl.includes('drive.google.com')) {
      const m = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || imageUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (m && m[1]) {
        imageUrl = `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
      }
    }

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    };
    if (imageUrl.includes('pic.in.th')) {
      headers.Referer = 'https://pic.in.th/';
    }

    // Several real photo filenames contain ".." (e.g. BME_563770..045756.png).
    // Encode it so the URL parser doesn't treat it as a parent-directory hop.
    const safeUrl = imageUrl.includes('..') ? imageUrl.replace(/\.\./g, '%2E%2E') : imageUrl;

    let response = await fetch(safeUrl, { redirect: 'follow', headers });
    if (!response.ok) response = await fetch(safeUrl, { redirect: 'follow' });
    if (!response.ok && safeUrl !== imageUrl) {
      response = await fetch(imageUrl, { redirect: 'follow', headers });
    }

    if (!response.ok) {
      res.status(400).send(`Failed to fetch image (HTTP ${response.status})`);
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType.includes('image') ? contentType : 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buffer);
  } catch (err: any) {
    res.status(500).send(`Image proxy error: ${err?.message || 'unknown'}`);
  }
}
