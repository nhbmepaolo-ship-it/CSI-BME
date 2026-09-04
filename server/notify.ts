// Builds the weekly CSI + activity-hours summary card and pushes it to LINE and/or
// Telegram automatically. This is what powers the SCHEDULED send (Vercel Cron on
// Vercel, or the in-process scheduler in server.ts on traditional Node hosting) —
// as opposed to the manual "กดส่ง" button in NotificationCard.tsx, which runs in the
// browser and uses whatever the person typed into the settings form there.
//
// Because this runs with nobody's browser open, it can only read credentials from
// SERVER environment variables (never localStorage, which only exists in a browser).
// Required/optional env vars — set these in Vercel Project Settings → Environment
// Variables (or in a local .env for traditional hosting):
//   GOOGLE_SHEET_ID       (optional — defaults to the CSI BME PTP sheet already used elsewhere)
//   GAS_WEB_APP_URL       (the same Google Apps Script Web App URL used for activities/votes sync)
//   LINE_CHANNEL_TOKEN    (LINE Messaging API channel access token)
//   LINE_GROUP_ID         (LINE group to push into — or use LINE_USER_ID for a 1:1 chat)
//   LINE_USER_ID          (optional alternative/additional target)
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID
//   CRON_SECRET           (Vercel automatically sends this as "Authorization: Bearer <value>"
//                          when calling a Cron Job route — see vercel.json)

const DEFAULT_SHEET_ID = '11qoHRaakTjvDWvOekqTTlP2SFcqdfys6cT653wRfjUA';
const CSI_TAB_NAME = 'CSI Electronic (การตอบกลับ)';

const fetchWithTimeout = async (url: string, timeoutMs = 9000, extraOptions: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { redirect: 'follow', ...extraOptions, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// Same tolerant CSV parser used elsewhere in this project (kept as a local copy —
// small and self-contained rather than adding a shared-module refactor for it).
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) lines.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) lines.push(currentRow);
  }
  return lines;
}

// "Now" expressed in Thailand's local calendar date, independent of the server's own
// timezone (Vercel runs functions in UTC) — used to pick "this month" consistently.
function nowInBangkok(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
}

interface WeeklyCardResult {
  success: boolean;
  monthLabel: string;
  line?: { attempted: boolean; success: boolean; message: string };
  telegram?: { attempted: boolean; success: boolean; message: string };
  message: string;
}

async function buildCardText(): Promise<{ text: string; monthLabel: string }> {
  const sheetId = process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
  const now = nowInBangkok();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthNames = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const monthLabel = `${monthNames[now.getMonth() + 1]} ${now.getFullYear()}`;

  // --- CSI records for this month ---
  let uniqueDeptCount = 0;
  let top3: { name: string; count: number; avgRating: string }[] = [];
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CSI_TAB_NAME)}`;
    const res = await fetchWithTimeout(csvUrl);
    if (res.ok) {
      const rows = parseCSV(await res.text());
      const depts = new Set<string>();
      const staffMap: { [name: string]: { count: number; totalScore: number } } = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;
        const timestampRaw = row[0] || '';
        const dept = row[3] || 'General';

        let d: Date | null = null;
        if (timestampRaw) {
          const parts = timestampRaw.split(' ');
          if (parts[0] && parts[0].includes('/')) {
            const dp = parts[0].split('/');
            if (dp.length === 3) {
              let year = parseInt(dp[2], 10);
              if (year > 2500) year -= 543;
              d = new Date(`${year}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}T${parts[1] || '00:00:00'}`);
            }
          } else {
            d = new Date(timestampRaw);
          }
        }
        if (!d || isNaN(d.getTime())) continue;
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (mKey !== monthKey) continue;

        if (dept && dept.trim()) depts.add(dept.trim());

        const parseNum = (val: string) => {
          const n = parseInt(val, 10);
          return isNaN(n) ? 5 : Math.max(1, Math.min(5, n));
        };
        const scores = [7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19].map(idx => parseNum(row[idx])).filter(s => s > 0);
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;

        const names = new Set<string>();
        const staffName = (row[4] || '').trim();
        const goodStaff = (row[20] || '').trim();
        if (staffName && staffName !== '-' && staffName !== 'ไม่ระบุ') names.add(staffName);
        if (goodStaff && goodStaff !== '-' && goodStaff !== 'ไม่ระบุ') names.add(goodStaff);

        names.forEach(name => {
          if (!staffMap[name]) staffMap[name] = { count: 0, totalScore: 0 };
          staffMap[name].count += 1;
          staffMap[name].totalScore += avg;
        });
      }

      uniqueDeptCount = depts.size;
      top3 = Object.entries(staffMap)
        .map(([name, v]) => ({ name, count: v.count, avgRating: (v.totalScore / v.count).toFixed(1) }))
        .sort((a, b) => b.count - a.count || parseFloat(b.avgRating) - parseFloat(a.avgRating))
        .slice(0, 3);
    }
  } catch (err) {
    console.warn('buildCardText: CSI fetch failed', err);
  }

  // --- Activity hours for this month, via the shared GAS Web App (if configured) ---
  let hoursSummary: { name: string; nickname: string; totalMins: number }[] = [];
  const gasUrl = (process.env.GAS_WEB_APP_URL || '').trim();
  if (gasUrl) {
    try {
      const res = await fetchWithTimeout(gasUrl, 9000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_activities' })
      });
      const data: any = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.data)) {
        const map: { [key: string]: { name: string; nickname: string; totalMins: number } } = {};
        data.data.forEach((a: any) => {
          if (a.deleted) return;
          const d = new Date(a.timestamp);
          if (isNaN(d.getTime())) return;
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (mKey !== monthKey) return;
          const key = `${a.fullName} (${a.nickname})`;
          if (!map[key]) map[key] = { name: a.fullName, nickname: a.nickname, totalMins: 0 };
          map[key].totalMins += Number(a.totalMinutes) || 0;
        });
        hoursSummary = Object.values(map).sort((a, b) => b.totalMins - a.totalMins).slice(0, 10);
      }
    } catch (err) {
      console.warn('buildCardText: activities fetch failed', err);
    }
  }

  const thaiDateToday = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });

  let text = `📢 รายงานสรุป CSI & กิจกรรม BME PTP (ส่งอัตโนมัติ)\n`;
  text += `📅 ประจำวันที่: ${thaiDateToday}\n`;
  text += `🗓️ รอบเดือน: ${monthLabel}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `💖 1. สรุปผลประเมิน CSI รายสัปดาห์\n`;
  text += `🏥 แผนกที่ร่วมประเมิน (ไม่ซ้ำ): ${uniqueDeptCount}/20 แผนก\n`;
  text += uniqueDeptCount >= 20 ? `🎯 สถานะ: บรรลุเป้าหมายแล้ว!\n` : `🎯 สถานะ: ยังไม่ครบเป้าหมาย\n`;
  if (top3.length > 0) {
    text += `🌟 พนักงานดีเด่นประจำสัปดาห์:\n`;
    top3.forEach((s, i) => {
      text += `  ${i + 1}. ${s.name} (${s.count} ครั้ง, เฉลี่ย ${s.avgRating}/5)\n`;
    });
  }

  text += `\n🏃 2. ชั่วโมงกิจกรรม Happy Life & HR-PTP\n`;
  if (hoursSummary.length > 0) {
    hoursSummary.forEach((e, i) => {
      const h = Math.floor(e.totalMins / 60);
      const m = e.totalMins % 60;
      text += `  ${i + 1}. ${e.name} (${e.nickname}): ${h} ชม. ${m} นาที\n`;
    });
  } else {
    text += `  ยังไม่มีข้อมูลกิจกรรมในรอบเดือนนี้ (หรือยังไม่ได้ตั้งค่า GAS_WEB_APP_URL)\n`;
  }

  return { text, monthLabel };
}

export async function sendWeeklyCardIfConfigured(): Promise<WeeklyCardResult> {
  const { text, monthLabel } = await buildCardText();

  const result: WeeklyCardResult = { success: false, monthLabel, message: '' };

  // --- LINE ---
  const lineToken = (process.env.LINE_CHANNEL_TOKEN || '').trim();
  const lineGroupId = (process.env.LINE_GROUP_ID || '').trim();
  const lineUserId = (process.env.LINE_USER_ID || '').trim();
  if (lineToken && (lineGroupId || lineUserId)) {
    const recipients = [lineGroupId, lineUserId].filter(Boolean);
    let anyOk = false;
    const msgs: string[] = [];
    for (const to of recipients) {
      try {
        const res = await fetchWithTimeout('https://api.line.me/v2/bot/message/push', 9000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` },
          body: JSON.stringify({ to, messages: [{ type: 'text', text }] })
        });
        if (res.ok) {
          anyOk = true;
          msgs.push(`ส่งไปยัง ${to} สำเร็จ`);
        } else {
          const errJson: any = await res.json().catch(() => ({}));
          msgs.push(`${to}: ${errJson.message || res.statusText}`);
        }
      } catch (e: any) {
        msgs.push(`${to}: ${e.message}`);
      }
    }
    result.line = { attempted: true, success: anyOk, message: msgs.join(' | ') };
  } else {
    result.line = { attempted: false, success: false, message: 'ไม่ได้ตั้งค่า LINE_CHANNEL_TOKEN / LINE_GROUP_ID บนเซิร์ฟเวอร์' };
  }

  // --- Telegram ---
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (botToken && chatId) {
    try {
      const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/sendMessage`, 9000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
      });
      const data: any = await res.json().catch(() => ({ ok: false }));
      result.telegram = {
        attempted: true,
        success: !!data.ok,
        message: data.ok ? 'ส่งสำเร็จ' : (data.description || 'ส่งไม่สำเร็จ')
      };
    } catch (e: any) {
      result.telegram = { attempted: true, success: false, message: e.message };
    }
  } else {
    result.telegram = { attempted: false, success: false, message: 'ไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID บนเซิร์ฟเวอร์' };
  }

  result.success = !!(result.line?.success || result.telegram?.success);
  result.message = `รอบเดือน ${monthLabel} — LINE: ${result.line?.message} | Telegram: ${result.telegram?.message}`;
  return result;
}
