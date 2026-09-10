import express from 'express';
import { sendWeeklyCardIfConfigured } from './notify.js';

// All CSI BME PTP backend API routes live here, factored out of server.ts so the exact
// same Express app can be used in two different runtimes:
//  1. server.ts (traditional Node hosting / local dev) — calls app.listen()
//  2. api/[...path].ts (Vercel serverless function) — Vercel invokes the app per-request,
//     it must NEVER call app.listen() or Vercel's build will fail / the function will hang.
export function createApiApp(): express.Express {
  const app = express();

  // Short-lived cache for the staff/coaching tab-name brute-force lookup below (see its
  // own comment for why that part is expensive). Employees and coaching plans change far
  // less often than CSI submissions, so re-doing that whole guess-every-possible-tab-name
  // dance on every single poll was the single biggest unnecessary chunk of Google Sheets
  // quota this app was burning. Persists only for as long as this server process / warm
  // serverless instance stays alive — worst case (cold start) it just re-fetches once,
  // same as before this cache existed.
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  let staffCache: { employees: any[]; expiresAt: number } | null = null;
  let coachingCache: { records: any[]; expiresAt: number } | null = null;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Wraps fetch with a hard timeout so a single slow/unresponsive request to Google
  // (e.g. a tab-name guess that doesn't exist) can never hang the whole serverless
  // function past its execution time limit — this was causing intermittent 500s on
  // Vercel when many tab-name candidates were tried one after another.
  const fetchWithTimeout = async (url: string, timeoutMs = 8000, extraOptions: RequestInit = {}): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { redirect: 'follow', ...extraOptions, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  // API Image Proxy Route to avoid CORS issues when exporting PDF/canvas
  app.get('/api/image-proxy', async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl || !imageUrl.startsWith('http')) {
        return res.status(400).send('Invalid image URL');
      }
      const response = await fetch(imageUrl, { redirect: 'follow' });
      if (!response.ok) {
        return res.status(400).send('Failed to fetch image');
      }
      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (err: any) {
      return res.status(500).send(`Image proxy error: ${err.message}`);
    }
  });

  // API Route to Auto-Pull Data from Google Sheet ID directly
  app.get('/api/fetch-sheet-data', async (req, res) => {
    try {
      const sheetId = (req.query.sheetId as string) || (process.env.GOOGLE_SHEET_ID || '').trim() || '1eswu63LgsBcdAZZeRvfnJ5v3SlkM7n1y3K5Hwbc-Ryw';
      const sheetName = (req.query.sheetName as string) || 'CSI Electronic (การตอบกลับ)';

      console.log(`Auto-pulling data from Google Sheet ID: ${sheetId}, Sheet: ${sheetName}`);

      // Try CSV export URL
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      const response = await fetchWithTimeout(csvUrl);

      if (!response.ok) {
        return res.status(400).json({
          success: false,
          message: `ไม่สามารถดึงข้อมูลจาก Google Sheet (HTTP ${response.status}) โปรดตรวจสอบว่าเปิดสิทธิ์แชร์ "ทุกคนที่มีลิงก์สามารถดูได้" (Anyone with link can view)`
        });
      }

      const csvText = await response.text();

      // Simple CSV parser supporting quotes
      const parseCSV = (text: string) => {
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
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c.length > 0)) {
              lines.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        if (currentCell.length > 0 || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c.length > 0)) {
            lines.push(currentRow);
          }
        }
        return lines;
      };

      const rows = parseCSV(csvText);

      if (rows.length < 2) {
        return res.json({
          success: true,
          csiRecords: [],
          employees: [],
          message: 'พบตารางว่างหรือไม่มีแถวข้อมูล'
        });
      }

      // Convert rows to CSI records
      // Header row is index 0
      const csiRecords = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;

        const timestampRaw = row[0] || '';
        const site = row[1] || 'PTP';
        const division = row[2] || 'Biomedical Engineering';
        const dept = row[3] || 'General';
        const staffName = row[4] || '';
        const contactType = row[5] || '';
        const use_service1 = row[6] || '';

        const parseNum = (val: string) => {
          const n = parseInt(val, 10);
          return isNaN(n) ? 5 : Math.max(1, Math.min(5, n));
        };

        const q1_1 = parseNum(row[7]);
        const q1_2 = parseNum(row[8]);
        const q1_3 = parseNum(row[9]);
        const q1_4 = parseNum(row[10]);
        const q1_5 = parseNum(row[11]);
        const q1_6 = parseNum(row[12]);
        const q1_7 = parseNum(row[13]);

        const use_service2 = row[14] || '';
        const q2_1 = parseNum(row[15]);
        const q2_2 = parseNum(row[16]);
        const q2_3 = parseNum(row[17]);
        const q2_4 = parseNum(row[18]);
        const q2_5 = parseNum(row[19]);

        const goodStaff = row[20] || '';
        const goodReason = row[21] || '';
        const badStaff = row[22] || '';
        const badReason = row[23] || '';
        const extraNote = row[24] || goodReason || '';

        // Standardize timestamp
        let formattedTime = new Date().toISOString();
        if (timestampRaw) {
          const parts = timestampRaw.split(' ');
          if (parts[0] && parts[0].includes('/')) {
            const dateParts = parts[0].split('/');
            if (dateParts.length === 3) {
              const day = dateParts[0].padStart(2, '0');
              const month = dateParts[1].padStart(2, '0');
              let year = parseInt(dateParts[2], 10);
              if (year > 2500) year -= 543; // Buddhist Era
              const timeStr = parts[1] || '00:00:00';
              formattedTime = `${year}-${month}-${day}T${timeStr}`;
            }
          } else {
            formattedTime = timestampRaw;
          }
        }

        csiRecords.push({
          timestamp: formattedTime,
          site,
          division,
          dept,
          staffName,
          contactType,
          use_service1,
          q1_1, q1_2, q1_3, q1_4, q1_5, q1_6, q1_7,
          use_service2,
          q2_1, q2_2, q2_3, q2_4, q2_5,
          goodStaff,
          goodReason,
          badStaff,
          badReason,
          extraNote
        });
      }

      // Try fetching staff list from multiple possible tab names — fetched IN PARALLEL
      // (previously sequential, which could take 10+ seconds combined and trip Vercel's
      // function timeout, producing the intermittent 500 errors seen after deployment).
      // Skipped entirely if a cached result from within the last 10 minutes exists (see
      // staffCache above) — this brute force is the expensive part of this whole route.
      let employees: any[] = [];

      if (staffCache && staffCache.expiresAt > Date.now()) {
        employees = staffCache.employees;
      } else {
      const possibleStaffTabs = ['ข้อมูลพนักงาน', 'พนักงาน', 'รายชื่อพนักงาน', 'Employees', 'Staff', 'Sheet2'];

      const staffTabResults = await Promise.allSettled(
        possibleStaffTabs.map(tabName =>
          fetchWithTimeout(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`)
            .then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        )
      );

      for (let t = 0; t < staffTabResults.length; t++) {
        const result = staffTabResults[t];
        if (result.status !== 'fulfilled') continue;
        const staffCsv = result.value;
        if (!staffCsv || staffCsv.includes('google-signin') || staffCsv.includes('<!DOCTYPE html>')) continue;

        const staffRows = parseCSV(staffCsv);
        if (staffRows.length <= 1) continue;

        let fullNameIdx = 0;
        let nicknameIdx = 1;
        let imgIdx = 2;
        let usernameIdx = 3;
        let passIdx = 4;

        const header = staffRows[0].map(h => (h || '').trim().toLowerCase());
        header.forEach((col, idx) => {
          if ((col.includes('ชื่อ') && !col.includes('เล่น')) || col.includes('full') || col.includes('name')) fullNameIdx = idx;
          if (col.includes('เล่น') || col.includes('nick')) nicknameIdx = idx;
          if (col.includes('รูป') || col.includes('img') || col.includes('pic') || col.includes('photo') || col.includes('avatar')) imgIdx = idx;
          if (col.includes('user') || col.includes('รหัสพนักงาน') || col.includes('รหัส') || col.includes('id')) usernameIdx = idx;
          if (col.includes('pass') || col.includes('รหัสผ่าน')) passIdx = idx;
        });

        const parsedEmployees: any[] = [];
        for (let j = 1; j < staffRows.length; j++) {
          const sRow = staffRows[j];
          if (sRow && sRow.length >= 2) {
            const cleanStr = (val: string) => (val || '').replace(/\s*\(?https?:\/\/[^\s)]+\)?/gi, '').trim();

            const fullName = cleanStr(sRow[fullNameIdx] || '');
            const nickname = cleanStr(sRow[nicknameIdx] || fullName || '');
            let img = (sRow[imgIdx] || '').trim();
            const username = (sRow[usernameIdx] || `emp_${j}`).trim();
            const password = (sRow[passIdx] || '123').trim();

            // Skip team placeholders
            const isTeam = fullName.toLowerCase().includes('team') ||
              nickname.toLowerCase().includes('team') ||
              fullName.includes('ทีม') ||
              nickname.includes('ทีม') ||
              username.toLowerCase().includes('team');
            if (isTeam) continue;

            if (img && img.includes('drive.google.com')) {
              const m = img.match(/\/d\/([a-zA-Z0-9_-]+)/) || img.match(/id=([a-zA-Z0-9_-]+)/);
              if (m && m[1]) {
                img = `https://lh3.googleusercontent.com/d/${m[1]}`;
              }
            }

            if (img && !img.startsWith('http')) {
              img = `https://${img}`;
            }

            if (!img) {
              img = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nickname || fullName || 'user')}&skinColor=f8d25c`;
            }

            const uUpper = username.toUpperCase();
            const isAdmin = uUpper.includes('ADMIN') || uUpper.includes('SPV') || uUpper.includes('MGR') || uUpper === '563770';

            if (fullName || nickname || username) {
              parsedEmployees.push({
                id: `sheet-emp-${username}`,
                username,
                password,
                fullName,
                nickname,
                club: 'ชมรมเดิน-วิ่ง',
                img,
                status: 'active',
                isAdmin
              });
            }
          }
        }
        if (parsedEmployees.length > 0) {
          employees = parsedEmployees;
          break; // Found and parsed staff from this tab (first match in priority order)
        }
      }

      staffCache = { employees, expiresAt: Date.now() + CACHE_TTL_MS };
      } // end staffCache miss branch

      // Try fetching "แผนพัฒนา" (Coaching/IDP) records — also fetched IN PARALLEL.
      // NOTE: this was previously missing from this route entirely (it only existed in the
      // browser-side fallback), so coaching data never actually synced while the server was
      // reachable — that's the root cause of "แผนพัฒนาดึงข้อมูลไม่ตรงกับชีท" reported earlier.
      // Same 10-minute cache treatment as the staff lookup above, for the same reason.
      let coachingRecords: any[] = [];

      if (coachingCache && coachingCache.expiresAt > Date.now()) {
        coachingRecords = coachingCache.records;
      } else {
      const possibleCoachingTabs = ['แผนพัฒนา', 'แผนพัฒนาพนักงาน', 'Coaching', 'IDP', 'Coaching Records', 'แผนพัฒนา & Coaching', 'Sheet3'];

      const coachingTabResults = await Promise.allSettled(
        possibleCoachingTabs.map(tabName =>
          fetchWithTimeout(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`)
            .then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        )
      );

      for (let t = 0; t < coachingTabResults.length; t++) {
        const result = coachingTabResults[t];
        if (result.status !== 'fulfilled') continue;
        const coachCsv = result.value;
        if (!coachCsv || coachCsv.includes('google-signin') || coachCsv.includes('<!DOCTYPE html>')) continue;

        const coachRows = parseCSV(coachCsv);
        if (coachRows.length <= 1) continue;

        // Google's gviz CSV endpoint does NOT error when the requested tab name doesn't
        // exist — it quietly returns the FIRST tab of the spreadsheet instead. Guessing
        // names like 'แผนพัฒนา'/'IDP' therefore kept returning the CSI form-responses tab,
        // which was then parsed as coaching and produced junk cards (timestamp shown as a
        // person's name, "Biomedical Engineering" as position, a rating digit as a topic).
        // So: only accept a tab whose header actually looks like a coaching roster, and
        // explicitly reject anything that looks like the CSI response sheet.
        const headerJoined = coachRows[0].map(h => (h || '').trim().toLowerCase()).join(' | ');
        const looksLikeCsi =
          headerJoined.includes('ประทับเวลา') ||
          headerJoined.includes('timestamp') ||
          headerJoined.includes('division') ||
          headerJoined.includes('ผู้ให้บริการ');
        const coachingSignals = ['รหัส', 'ชื่อ', 'ตำแหน่ง', 'สัตว์', 'โค้ช', 'coach', 'position', 'nick', 'เล่น'];
        const signalCount = coachingSignals.filter(s => headerJoined.includes(s)).length;
        if (looksLikeCsi || signalCount < 3) continue;

        let empIdIdx = 0, typeIdx = 1, posIdx = 2, fullIdx = 3, nickIdx = 4, animalIdx = 5, coachIdx = 6, t1Idx = 7, t2Idx = 8, t3Idx = 9, scoreIdx = 10, progIdx = 11, totalHoursIdx = 12;

        const header = coachRows[0].map(h => (h || '').trim().toLowerCase());
        header.forEach((col, idx) => {
          if (col.includes('รหัส') || col.includes('id') || col.includes('empid')) empIdIdx = idx;
          if (col.includes('สัญญา') || col.includes('contract') || col.includes('ประเภทพนักงาน')) typeIdx = idx;
          if (col.includes('ตำแหน่ง') || col.includes('position') || col.includes('role')) posIdx = idx;
          if ((col.includes('ชื่อ') && !col.includes('เล่น') && !col.includes('โค้ช')) || col.includes('full') || col.includes('name')) fullIdx = idx;
          if (col.includes('เล่น') || col.includes('nick')) nickIdx = idx;
          if (col.includes('สัตว์') || col.includes('disc') || col.includes('animal')) animalIdx = idx;
          if (col.includes('โค้ช') || col.includes('coach')) coachIdx = idx;
          if (col.includes('ลำดับที่ 1') || col.includes('เรื่องที่ 1') || col.includes('topic1') || col.includes('topic 1')) t1Idx = idx;
          if (col.includes('ลำดับที่ 2') || col.includes('เรื่องที่ 2') || col.includes('topic2') || col.includes('topic 2')) t2Idx = idx;
          if (col.includes('ลำดับที่ 3') || col.includes('เรื่องที่ 3') || col.includes('topic3') || col.includes('topic 3')) t3Idx = idx;
          if (col.includes('คะแนน') || col.includes('score') || col.includes('eval')) scoreIdx = idx;
          if (col.includes('ก้าวหน้า') || col.includes('progress') || col.includes('%')) progIdx = idx;
          if (col.includes('ชั่วโมง') || col.includes('hours') || col.includes('total')) totalHoursIdx = idx;
        });

        const parsedCoaching: any[] = [];
        for (let j = 1; j < coachRows.length; j++) {
          const cRow = coachRows[j];
          if (cRow && cRow.length >= 3) {
            const cleanStr = (val: string) => (val || '').trim();

            const empId = cleanStr(cRow[empIdIdx] || '');
            const contractType = cleanStr(cRow[typeIdx]).toLowerCase().includes('full') ? 'Full Time' : 'Out source';
            const position = cleanStr(cRow[posIdx] || 'Engineer');
            const fullName = cleanStr(cRow[fullIdx] || '');
            const nickname = cleanStr(cRow[nickIdx] || fullName || '');

            // Skip anything that isn't a real person row. The old check fell back to a
            // generated `emp_<row>` id, which made the condition below always true — so
            // merged-cell header rows, section titles ("แผนกวิศวกรรมการแพทย์ BME") and
            // blank spacer rows all became coaching cards with nonsense in every field.
            const hasEmpId = /\d{4,}/.test(empId);
            const hasRealName = /[ก-๛a-zA-Z]{2,}/.test(fullName) && !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(fullName);
            if (!hasEmpId && !hasRealName) continue;

            const animalRaw = cleanStr(cRow[animalIdx]);
            let animalType = 'หมี';
            if (animalRaw.includes('กระทิง') || animalRaw.toLowerCase().includes('bull')) animalType = 'กระทิง';
            else if (animalRaw.includes('อินทรีย์') || animalRaw.toLowerCase().includes('eagle')) animalType = 'อินทรีย์';
            else if (animalRaw.includes('หนู') || animalRaw.toLowerCase().includes('mouse')) animalType = 'หนู';

            const coachName = cleanStr(cRow[coachIdx] || 'ชาลี');
            const topic1 = cleanStr(cRow[t1Idx] || 'ยังไม่กำหนด');
            const topic2 = cleanStr(cRow[t2Idx] || 'ยังไม่กำหนด');
            const topic3 = cleanStr(cRow[t3Idx] || 'ยังไม่กำหนด');
            const evaluationScore = parseInt(cleanStr(cRow[scoreIdx]), 10) || 7;
            const progressPercent = parseInt(cleanStr(cRow[progIdx]), 10) || 50;
            const totalHours = parseFloat(cleanStr(cRow[totalHoursIdx])) || 6;

            if (fullName || nickname || empId) {
              parsedCoaching.push({
                id: `coach-sheet-${empId || nickname || fullName}`,
                empId,
                contractType,
                position,
                fullName,
                nickname,
                animalType,
                coachName,
                topic1,
                topic2,
                topic3,
                evaluationScore,
                progressPercent,
                hoursW1: 1, hoursW2: 1, hoursW3: 1, hoursW4: 1, hoursW5: 1, hoursW6: 1,
                totalHours
              });
            }
          }
        }
        if (parsedCoaching.length > 0) {
          coachingRecords = parsedCoaching;
          break; // Found and parsed coaching data from this tab (first match in priority order)
        }
      }

      coachingCache = { records: coachingRecords, expiresAt: Date.now() + CACHE_TTL_MS };
      } // end coachingCache miss branch

      return res.json({
        success: true,
        sheetId,
        sheetName,
        totalFetched: csiRecords.length,
        csiRecords,
        employees,
        coachingRecords
      });

    } catch (err: any) {
      console.error('Error fetching sheet data:', err);
      return res.status(500).json({
        success: false,
        message: `เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheet: ${err.message}`
      });
    }
  });

  // API Proxy Route for LINE Messaging API / Webhook / Notify
  app.post('/api/send-line', async (req, res) => {
    try {
      const { lineTokenOrWebhook, lineChannelToken, lineGroupId, lineUserId, lineWebhookUrl, message, flexMessage, flexAltText } = req.body;
      if (!message && !flexMessage) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุข้อความหรือ Flex Message ที่ต้องการส่ง' });
      }

      const channelToken = (lineChannelToken || (!lineTokenOrWebhook?.startsWith('http') ? lineTokenOrWebhook : '') || '').trim();
      const webhookUrl = (lineWebhookUrl || (lineTokenOrWebhook?.startsWith('http') ? lineTokenOrWebhook : '') || '').trim();
      const targetGroup = (lineGroupId || '').trim();
      const targetUser = (lineUserId || '').trim();

      let isSuccess = false;
      const results: string[] = [];

      // Build payload for Messaging API Push
      const pushMessages = flexMessage ? [
        {
          type: 'flex',
          altText: flexAltText || 'รายงานสรุป CSI & กิจกรรม BME PTP',
          contents: flexMessage
        }
      ] : [
        { type: 'text', text: message }
      ];

      // 1. Send via LINE Messaging API Push Message
      if (channelToken && (targetGroup || targetUser)) {
        const recipients = [targetGroup, targetUser].filter(Boolean);
        for (const recipient of recipients) {
          try {
            const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelToken}`
              },
              body: JSON.stringify({
                to: recipient,
                messages: pushMessages
              })
            });
            if (pushRes.ok) {
              isSuccess = true;
              results.push(`ส่งผ่าน LINE Messaging API (ID: ${recipient}) สำเร็จ`);
            } else {
              const errJson: any = await pushRes.json().catch(() => ({}));
              const detailMsgs = Array.isArray(errJson.details)
                ? errJson.details.map((d: any) => `${d.property || ''} ${d.message || ''}`.trim()).filter(Boolean).join('; ')
                : '';
              const baseMsg = errJson.message || (pushRes.status === 401 ? 'Authentication failed (Token ไม่ถูกต้อง)' : pushRes.statusText);
              const msg = detailMsgs ? `${baseMsg} (${detailMsgs})` : baseMsg;
              results.push(`Messaging API Push (${recipient}) [HTTP ${pushRes.status}]: ${msg}`);
            }
          } catch (e: any) {
            results.push(`Messaging API error: ${e.message}`);
          }
        }
      }

      // 1.5. Fallback: Try LINE Broadcast API if Push failed and channelToken exists
      if (!isSuccess && channelToken && channelToken.length > 50) {
        try {
          const bcRes = await fetch('https://api.line.me/v2/bot/message/broadcast', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${channelToken}`
            },
            body: JSON.stringify({
              messages: pushMessages
            })
          });
          if (bcRes.ok) {
            isSuccess = true;
            results.push('ส่งผ่าน LINE Broadcast API สำเร็จ');
          } else {
            const errJson: any = await bcRes.json().catch(() => ({}));
            results.push(`Broadcast API: ${errJson.message || bcRes.statusText}`);
          }
        } catch (e: any) {
          results.push(`Broadcast error: ${e.message}`);
        }
      }

      // 2. Send via Webhook URL (e.g. webhook.site, n8n, Make, Zapier)
      if (webhookUrl && webhookUrl.startsWith('http')) {
        try {
          const whRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message,
              text: message,
              flexMessage,
              groupId: targetGroup,
              userId: targetUser,
              timestamp: new Date().toISOString()
            })
          });
          if (whRes.ok) {
            isSuccess = true;
            results.push(`ส่งไปยัง Webhook (${webhookUrl.substring(0, 30)}...) สำเร็จ`);
          } else {
            if (whRes.status === 429) {
              results.push(`Webhook error 429 (URL webhook.site เกินโควตารับข้อมูล)`);
            } else {
              results.push(`Webhook error HTTP ${whRes.status}`);
            }
          }
        } catch (e: any) {
          results.push(`Webhook error: ${e.message}`);
        }
      }

      // 3. Fallback: Try LINE Notify API if token is provided and push/broadcast failed
      if (!isSuccess && channelToken) {
        try {
          const formBody = new URLSearchParams();
          formBody.append('message', message);
          const notifyRes = await fetch('https://notify-api.line.me/api/notify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Bearer ${channelToken}`
            },
            body: formBody
          });
          const nJson: any = await notifyRes.json().catch(() => ({}));
          if (nJson.status === 200) {
            isSuccess = true;
            results.push('ส่งผ่าน LINE Notify สำเร็จ');
          }
        } catch (e: any) {
          results.push(`LINE Notify error: ${e.message}`);
        }
      }

      if (isSuccess) {
        return res.json({
          success: true,
          message: `ส่งการ์ดประกาศเรียบร้อยแล้ว! (${results.join(', ')})`
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `ไม่สามารถส่งได้: ${results.length > 0 ? results.join(' | ') : 'โปรดตรวจสอบ Token และ Webhook URL'}`
        });
      }
    } catch (err: any) {
      console.error('LINE Send Error:', err);
      return res.status(500).json({ success: false, message: `เกิดข้อผิดพลาดในการส่ง LINE: ${err.message}` });
    }
  });

  // API Proxy Route for Telegram Bot
  app.post('/api/send-telegram', async (req, res) => {
    try {
      const { botToken, chatId, message, parseMode } = req.body;
      if (!botToken || !chatId || !message) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ Telegram Bot Token, Chat ID และข้อความ' });
      }

      const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: message,
          ...(parseMode ? { parse_mode: parseMode } : {}),
          disable_web_page_preview: true
        })
      });

      const data: any = await response.json();
      if (data.ok) {
        return res.json({ success: true, message: 'ส่งข้อความเข้า Telegram Bot สำเร็จเรียบร้อย!' });
      } else {
        return res.status(400).json({ success: false, message: `Telegram Bot Error: ${data.description || 'ส่งข้อความไม่สำเร็จ'}` });
      }
    } catch (err: any) {
      console.error('Telegram Send Error:', err);
      return res.status(500).json({ success: false, message: `เกิดข้อผิดพลาดในการส่ง Telegram: ${err.message}` });
    }
  });

  // ตัวตรวจสอบการเชื่อมต่อแบบครบวงจร — เปิด /api/diagnose ในเบราว์เซอร์แล้วอ่านผลได้เลย
  // ทดสอบทีละข้อต่อ: env var -> เรียก Apps Script -> อ่านข้อมูลกิจกรรม -> อ่านชีท CSI
  // เพื่อชี้ให้ชัดว่าพังตรงจุดไหน แทนการไล่เดาทีละอย่าง
  app.get('/api/diagnose', async (req, res) => {
    const report: any = { checkedAt: new Date().toISOString(), steps: [] };
    try {
    const gasUrl = (process.env.GAS_WEB_APP_URL || '').trim();
    report.steps.push({
      step: '1. ตัวแปร GAS_WEB_APP_URL บน Vercel',
      ok: !!gasUrl,
      value: gasUrl ? gasUrl : '(ว่าง)',
      hint: gasUrl
        ? (gasUrl.endsWith('/exec') ? 'รูปแบบถูกต้อง' : 'URL ควรลงท้ายด้วย /exec')
        : 'ยังไม่ได้ตั้งค่า หรือยังไม่ได้ Redeploy หลังตั้งค่า'
    });

    if (gasUrl) {
      try {
        const r = await fetchWithTimeout(gasUrl, 9000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_activities' })
        });
        const text = await r.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }

        const rows = parsed && Array.isArray(parsed.data) ? parsed.data : null;
        report.steps.push({
          step: '2. เรียก Apps Script (get_activities)',
          ok: !!(parsed && parsed.success),
          httpStatus: r.status,
          rowCount: rows ? rows.length : 0,
          firstRow: rows && rows.length > 0 ? rows[0] : null,
          rawResponse: parsed ? undefined : text.substring(0, 400),
          hint: !parsed
            ? 'Apps Script ไม่ได้ตอบเป็น JSON — มักแปลว่า Deployment ตั้ง Who has access ไม่ใช่ Anyone หรือยังไม่ได้อัปเดตสคริปต์เวอร์ชันใหม่'
            : (rows && rows.length > 0
              ? 'อ่านข้อมูลได้ปกติ'
              : 'เชื่อมต่อได้ แต่แท็บ "กิจกรรม" ยังไม่มีข้อมูล หรือชื่อแท็บไม่ตรง')
        });

        if (rows && rows.length > 0) {
          const f = rows[0];
          const missing = ['id', 'timestamp', 'username', 'totalMinutes'].filter(k => !f[k] && f[k] !== 0);
          report.steps.push({
            step: '3. ตรวจรูปแบบคอลัมน์ของข้อมูลแถวแรก',
            ok: missing.length === 0,
            missingFields: missing,
            hint: missing.length === 0
              ? 'คอลัมน์ครบถ้วน ระบบควรแสดงผลได้'
              : 'คอลัมน์ไม่ครบ — ให้เรียก ?data={"action":"setup_sheets"} ที่ Web App URL เพื่อจัดหัวตารางใหม่'
          });
        }
      } catch (err: any) {
        report.steps.push({
          step: '2. เรียก Apps Script (get_activities)',
          ok: false,
          error: err.message,
          hint: 'ต่อไม่ติดเลย — ตรวจว่า URL ถูกต้องและ Deploy เป็น Web App แบบ Anyone แล้ว'
        });
      }
    }

    report.summary = report.steps.every((s: any) => s.ok)
      ? 'ทุกอย่างปกติ — ถ้าหน้าจอยังว่างให้กด Ctrl+Shift+R แล้วรอ 3 นาที'
      : 'พบจุดที่มีปัญหา ดูรายละเอียดในแต่ละ step ด้านบน (ดู hint)';

      res.json(report);
    } catch (err: any) {
      // อย่าปล่อยให้ตัวตรวจสอบเองพังจนทำให้ทั้งฟังก์ชันล่ม (500) — ตอบเป็นข้อความอ่านได้แทน
      res.status(200).json({
        ...report,
        summary: 'ตัวตรวจสอบทำงานผิดพลาดเอง',
        error: err && err.message ? err.message : String(err)
      });
    }
  });

  // Lets every browser automatically pick up the same Google Apps Script Web App URL for
  // activities/votes/org chart/coaching sync, instead of each person having to paste it
  // into Settings on every single device separately (which was the actual root cause of
  // "I set it up but the OTHER computer still shows nothing" — that device simply never had
  // the URL saved in ITS OWN localStorage). Set GAS_WEB_APP_URL once in Vercel's
  // environment variables and every device is connected automatically from then on. Not
  // sensitive — it's just an endpoint address, not a credential — so it's fine to expose.
  app.get('/api/gas-config', (req, res) => {
    res.json({
      gasUrl: (process.env.GAS_WEB_APP_URL || '').trim(),
      // ให้ทุกเครื่องใช้ไฟล์ชีทเดียวกัน แก้ที่เดียวจบ — เบราว์เซอร์ที่เคยบันทึก ID เก่าไว้
      // จะถูกเขียนทับให้อัตโนมัติ (ดู syncServerConfig ฝั่ง client)
      sheetId: (process.env.GOOGLE_SHEET_ID || '').trim() || '1eswu63LgsBcdAZZeRvfnJ5v3SlkM7n1y3K5Hwbc-Ryw'
    });
  });

  // API Proxy Route for Google Apps Script Sync
  app.post('/api/sync-sheets', async (req, res) => {
    try {
      const { gasUrl, payload } = req.body;

      if (!gasUrl || typeof gasUrl !== 'string' || !gasUrl.trim()) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ Google Apps Script Web App URL' });
      }

      console.log('Proxying sync request to Google Apps Script:', gasUrl.trim());

      const response = await fetchWithTimeout(gasUrl.trim(), 9000, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log('Google Apps Script response:', responseText.substring(0, 300));

      // The updated multi-action Apps Script (activities/votes/org chart, read + write)
      // responds with real JSON — e.g. { success: true, data: [...] } for get_* actions,
      // or { success: true, message: '...' } for sync_* (write) actions. Prefer that when
      // present. Fall back to the old plain "SUCCESS" text response for backward
      // compatibility with anyone still running the original write-only script.
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed === 'object' && 'success' in parsed) {
          return res.json(parsed);
        }
      } catch {
        // not JSON — fall through to legacy text handling below
      }

      if (responseText.includes('SUCCESS')) {
        return res.json({ success: true, message: 'ซิงค์ข้อมูลลง Google Sheet สำเร็จเรียบร้อยแล้ว!' });
      } else {
        return res.json({
          success: false,
          message: `ตอบกลับจาก Google Apps Script: ${responseText || 'ไม่มีการตอบกลับ (โปรดตรวจสอบสิทธิ์การเข้าถึง)'}`
        });
      }
    } catch (err: any) {
      console.error('Error proxying to Google Apps Script:', err);
      return res.status(500).json({
        success: false,
        message: `เกิดข้อผิดพลาดในการส่งข้อมูล: ${err.message || 'ไม่สามารถติดต่อ Google Apps Script ได้'}`
      });
    }
  });

  // Scheduled weekly summary card — called automatically by Vercel Cron (see vercel.json)
  // every Thursday 09:00 Thailand time, or by the in-process scheduler in server.ts when
  // running on traditional Node hosting instead of Vercel. Protected by CRON_SECRET so
  // random visitors can't trigger a real LINE/Telegram send by hitting the URL directly —
  // Vercel automatically sends "Authorization: Bearer <CRON_SECRET>" when it invokes a
  // Cron Job, as long as an env var named CRON_SECRET is set on the project.
  app.get('/api/cron/weekly-card', async (req, res) => {
    const expectedSecret = (process.env.CRON_SECRET || '').trim();
    if (expectedSecret) {
      const authHeader = req.headers['authorization'] || '';
      if (authHeader !== `Bearer ${expectedSecret}`) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
    }
    try {
      const result = await sendWeeklyCardIfConfigured();
      return res.json(result);
    } catch (err: any) {
      console.error('Weekly card cron error:', err);
      return res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาดในการส่งการ์ดสรุปอัตโนมัติ' });
    }
  });

  return app;
}
