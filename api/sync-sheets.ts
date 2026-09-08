/**
 * /api/sync-sheets — Vercel serverless function
 *
 * Same situation as image-proxy: the app posts here first when saving to Google
 * Sheets, but the route only existed in server.ts (Express), which does not run
 * on a Vercel deployment. It returned 404, so every save fell through to the
 * browser's no-cors fallback — a request whose result cannot be read, which is
 * why the app used to report "saved successfully" even when nothing reached the
 * sheet.
 *
 * Posting from the server has no CORS restriction, so the real Apps Script
 * response (success or error) can be read and passed back to the app honestly.
 */

export const config = { runtime: 'nodejs' };

const FALLBACK_GAS_URL =
  'https://script.google.com/macros/s/AKfycbxYN-S1ejO-6-IWM11q84UjCcV4X6xiSPy9YgkSKichlnoyQ7RSC6xW_SW_DN1UUmoXMA/exec';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const gasUrl: string = body.gasUrl || FALLBACK_GAS_URL;
    const payload = body.payload ?? {};

    if (!gasUrl.includes('script.google.com')) {
      res.status(400).json({ success: false, message: 'Invalid Apps Script URL' });
      return;
    }

    const upstream = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();

    // Apps Script returns JSON on success; an HTML page means the deployment is
    // wrong (not published, wrong access setting, or an old /dev URL).
    try {
      res.status(200).json(JSON.parse(text));
      return;
    } catch {
      const looksLikeHtml = /<!doctype|<html/i.test(text);
      res.status(200).json({
        success: false,
        message: looksLikeHtml
          ? 'Apps Script ตอบกลับเป็นหน้าเว็บ ไม่ใช่ข้อมูล — ตรวจสอบว่า Deploy เป็น Web App, เลือก "เวอร์ชันใหม่" และตั้งสิทธิ์เป็น "ทุกคน (Anyone)" แล้ว'
          : `Apps Script ตอบกลับผิดรูปแบบ: ${text.slice(0, 200)}`
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `ไม่สามารถติดต่อ Google Apps Script ได้: ${err?.message || 'unknown'}`
    });
  }
}
