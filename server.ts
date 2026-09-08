import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Image Proxy Route to avoid CORS issues when exporting PDF/canvas
  app.get('/api/image-proxy', async (req, res) => {
    try {
      let imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).send('Missing image URL');
      }

      // Handle nested proxy URLs
      while (imageUrl.includes('/api/image-proxy?url=')) {
        const parts = imageUrl.split('/api/image-proxy?url=');
        imageUrl = decodeURIComponent(parts[parts.length - 1]);
      }

      if (!imageUrl.startsWith('http')) {
        return res.status(400).send('Invalid image URL');
      }

      // Auto-heal known legacy broken pic.in.th URLs
      imageUrl = imageUrl
        .replace('https://img2.pic.in.th/images/BME_563770..045756.png', 'https://img2.pic.in.th/BME_563770..045756.png')
        .replace('https://img1.pic.in.th/images/BME_603892..045611.png', 'https://img2.pic.in.th/BME_603892..045611.png')
        .replace('https://img2.pic.in.th/images/BME_563779..045629.png', 'https://img1.pic.in.th/images/BME_563779..045629.png')
        .replace('https://img2.pic.in.th/images/BME_606675..045820.png', 'https://img2.pic.in.th/BME_606675..045820.png')
        .replace('https://img2.pic.in.th/images/BME_612366..045835.png', 'https://img2.pic.in.th/BME_612366..045835.png')
        .replace('https://img2.pic.in.th/S__6471705_0-removebg-preview.png', 'https://img1.pic.in.th/images/970d1e089ad78d07db702e1eab5698c6.png');

      // Handle Google Drive links
      if (imageUrl.includes('drive.google.com')) {
        const m = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || imageUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (m && m[1]) {
          imageUrl = `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
        }
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      };

      if (imageUrl.includes('pic.in.th')) {
        headers['Referer'] = 'https://pic.in.th/';
      }

      // Encode double dots to avoid directory traversal normalization
      const safeUrl = imageUrl.includes('..') ? imageUrl.replace(/\.\./g, '%2E%2E') : imageUrl;

      let response = await fetch(safeUrl, { redirect: 'follow', headers });

      if (!response.ok) {
        response = await fetch(safeUrl, { redirect: 'follow' });
      }

      if (!response.ok && safeUrl !== imageUrl) {
        response = await fetch(imageUrl, { redirect: 'follow', headers });
      }

      if (!response.ok) {
        return res.status(400).send(`Failed to fetch image (HTTP ${response.status})`);
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', contentType.includes('image') ? contentType : 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (err: any) {
      return res.status(500).send(`Image proxy error: ${err.message}`);
    }
  });

  // API Route to Auto-Pull Data from Google Sheet ID directly
  app.get('/api/fetch-sheet-data', async (req, res) => {
    try {
      const sheetId = (req.query.sheetId as string) || '1eswu63LgsBcdAZZeRvfnJ5v3SlkM7n1y3K5Hwbc-Ryw';
      const sheetName = (req.query.sheetName as string) || 'CSI Electronic (การตอบกลับ)';

      console.log(`Auto-pulling data from Google Sheet ID: ${sheetId}, Sheet: ${sheetName}`);

      // Try CSV export URL
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      const response = await fetch(csvUrl, { redirect: 'follow' });

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

      // Try fetching staff list from multiple possible tab names
      const possibleStaffTabs = ['ข้อมูลพนักงาน', 'พนักงาน', 'รายชื่อพนักงาน', 'Employees', 'Staff', 'Sheet2'];
      const employees: any[] = [];

      for (const tabName of possibleStaffTabs) {
        try {
          const staffTabUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
          const staffRes = await fetch(staffTabUrl, { redirect: 'follow' });
          if (staffRes.ok) {
            const staffCsv = await staffRes.text();
            if (staffCsv && !staffCsv.includes('google-signin') && !staffCsv.includes('<!DOCTYPE html>')) {
              const staffRows = parseCSV(staffCsv);
              if (staffRows.length > 0) {
                // Check if row 0 contains manager names / row header
                const row0Str = staffRows[0] ? staffRows[0].join(' ') : '';
                if (row0Str.includes('Chalee') || row0Str.includes('Raschanee')) {
                  employees.push({
                    id: 'sheet-emp-MGR_BME',
                    username: 'MGR_BME',
                    password: 'Mgr-BME',
                    fullName: 'Chalee Meksuwan',
                    nickname: 'ปิ้ง',
                    club: 'ชมรมเดิน-วิ่ง',
                    img: 'https://img2.pic.in.th/S__6471704_0-removebg-preview.png',
                    status: 'active',
                    isAdmin: true
                  });
                  employees.push({
                    id: 'sheet-emp-SPV_BME',
                    username: 'SPV_BME',
                    password: 'Spv-BME@PTP',
                    fullName: 'Raschanee Majanit',
                    nickname: 'มิน',
                    club: 'ชมรมเดิน-วิ่ง',
                    img: 'https://img1.pic.in.th/images/970d1e089ad78d07db702e1eab5698c6.png',
                    status: 'active',
                    isAdmin: true
                  });
                }

                for (let j = 1; j < staffRows.length; j++) {
                  const sRow = staffRows[j];
                  if (sRow && sRow.length >= 2) {
                    const cleanStr = (val: string) => (val || '').replace(/\s*\(?https?:\/\/[^\s)]+\)?/gi, '').trim();

                    const fullName = cleanStr(sRow[0] || '');
                    const nickname = cleanStr(sRow[1] || fullName || '');
                    let img = (sRow[2] || '').trim();
                    const username = (sRow[3] || `emp_${j}`).trim();
                    const password = (sRow[4] || '123').trim();

                    // Skip team placeholders or dummy/empty accounts
                    const isTeamOrDummy = fullName.toLowerCase().includes('team') ||
                      nickname.toLowerCase().includes('team') ||
                      fullName.includes('ทีม') ||
                      nickname.includes('ทีม') ||
                      username.toLowerCase().includes('team') ||
                      username === 'emp_15' ||
                      username === 'emp_16' ||
                      username === 'emp_17';
                    if (isTeamOrDummy) continue;

                    // Must have a real name (not blank or parenthesis)
                    if (!fullName && !nickname) continue;
                    if (fullName === '()' || nickname === '()') continue;
                    if (username.startsWith('emp_') && (!fullName || !nickname)) continue;

                    if (img && img.includes('drive.google.com')) {
                      const m = img.match(/\/d\/([a-zA-Z0-9_-]+)/) || img.match(/id=([a-zA-Z0-9_-]+)/);
                      if (m && m[1]) {
                        img = `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
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
                      employees.push({
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
                if (employees.length > 0) break; // Found and parsed staff from this tab
              }
            }
          }
        } catch (e) {
          console.warn(`Server fetch staff from tab '${tabName}' skipped:`, e);
        }
      }

      // 3. Try fetching Coaching tab from Google Sheets
      const possibleCoachingTabs = ['Coaching', 'แผนพัฒนา', 'Coaching Plan', 'Sheet3'];
      const coachingRecords: any[] = [];

      for (const tabName of possibleCoachingTabs) {
        try {
          const coachTabUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
          const coachRes = await fetch(coachTabUrl, { redirect: 'follow' });
          if (coachRes.ok) {
            const coachCsv = await coachRes.text();
            if (coachCsv && !coachCsv.includes('google-signin') && !coachCsv.includes('<!DOCTYPE html>')) {
              const cRows = parseCSV(coachCsv);
              if (cRows.length > 1) {
                for (let k = 1; k < cRows.length; k++) {
                  const cr = cRows[k];
                  if (cr && cr.length >= 7) {
                    const empId = (cr[1] || '').trim();
                    const contractType = (cr[2] || 'Out source').trim();
                    const position = (cr[3] || 'Engineer').trim();
                    const fullName = (cr[4] || '').trim();
                    const nickname = (cr[5] || '').trim();
                    const animalRaw = (cr[6] || 'หมี').trim();

                    if (!fullName && !empId) continue;

                    const animalType = animalRaw.includes('กระทิง') ? 'กระทิง' : animalRaw.includes('อินทรีย์') ? 'อินทรีย์' : animalRaw.includes('หนู') ? 'หนู' : 'หมี';

                    const parseNumFloat = (val: string, def = 0) => {
                      const f = parseFloat(val);
                      return isNaN(f) ? def : f;
                    };

                    const hoursW1 = parseNumFloat(cr[52], 0);
                    const hoursW2 = parseNumFloat(cr[53], 0);
                    const hoursW3 = parseNumFloat(cr[54], 0);
                    const hoursW4 = parseNumFloat(cr[55], 0);
                    const hoursW5 = parseNumFloat(cr[56], 0);
                    const hoursW6 = parseNumFloat(cr[57], 0);
                    const progressStr = (cr[58] || '').trim();
                    const progressPercent = progressStr.includes('%') ? parseFloat(progressStr) : parseNumFloat(progressStr, 50);
                    const totalHours = parseNumFloat(cr[59], hoursW1 + hoursW2 + hoursW3 + hoursW4 + hoursW5 + hoursW6);
                    const coachName = (cr[60] || 'ชาลี').trim();

                    coachingRecords.push({
                      id: `sheet-coach-${empId || k}`,
                      empId: empId || `E${k}`,
                      position,
                      fullName,
                      nickname: nickname || fullName,
                      contractType,
                      animalType,
                      coachName,
                      topic1: 'Active Listening & Communication',
                      topic2: 'Problem Solving & Team Work',
                      topic3: 'System Thinking & Execution',
                      evaluationScore: 8,
                      progressPercent,
                      hoursW1,
                      hoursW2,
                      hoursW3,
                      hoursW4,
                      hoursW5,
                      hoursW6,
                      totalHours
                    });
                  }
                }

                if (coachingRecords.length > 0) break;
              }
            }
          }
        } catch (e) {
          console.warn(`Server fetch Coaching tab '${tabName}' skipped:`, e);
        }
      }

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
      return res.json({
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
              const msg = errJson.message || (pushRes.status === 401 ? 'Authentication failed (Token ไม่ถูกต้อง)' : pushRes.statusText);
              results.push(`Messaging API Push (${recipient}): ${msg}`);
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
      const { botToken, chatId, message } = req.body;
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
          parse_mode: 'HTML'
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

  // API Proxy Route for Google Apps Script Sync
  function formatInternationalDateTime(dateInput?: string | Date | number): string {
  let d: Date;
  if (!dateInput) {
    d = new Date();
  } else if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{2}:\d{2}\/\d{2}\/\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  } else {
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year}:${hours}/${minutes}/${seconds}`;
}

app.post('/api/sync-sheets', async (req, res) => {
    try {
      const { gasUrl, payload } = req.body;

      const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxYN-S1ejO-6-IWM11q84UjCcV4X6xiSPy9YgkSKichlnoyQ7RSC6xW_SW_DN1UUmoXMA/exec';

      const normalizeUrl = (rawUrl?: string): string => {
        if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.includes('script.google.com')) {
          return DEFAULT_GAS_URL;
        }
        let clean = rawUrl.trim();
        clean = clean.replace(/\/edit(\?.*)?$/, '/exec').replace(/\/dev(\?.*)?$/, '/exec');
        if (!clean.endsWith('/exec') && !clean.includes('/exec?')) {
          clean = clean.replace(/\/+$/, '') + '/exec';
        }
        return clean;
      };

      let targetGasUrl = normalizeUrl(gasUrl);
      console.log('Proxying sync request to Google Apps Script:', targetGasUrl);

      const isHtmlOrErrorString = (str: string) => {
        if (!str) return true;
        const lower = str.toLowerCase();
        return lower.includes('<!doctype') || lower.includes('<html') || lower.includes('not_found') || lower.includes('could not be found') || lower.includes('page not found') || lower.includes('404') || lower.includes('sin1::') || lower.includes('unable to open the file');
      };

      const sendToGas = async (url: string, p: any) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
          redirect: 'follow'
        });
        const text = await response.text();
        return { ok: response.ok, text };
      };

      // Attempt 1: Send structured payload to target URL
      let { text: responseText } = await sendToGas(targetGasUrl, payload);
      console.log('Google Apps Script response (Attempt 1):', responseText.substring(0, 150));

      // Attempt 2: If script rejected with "ไม่รู้จัก action", fallback to legacy activities format
      if (!isHtmlOrErrorString(responseText) && (responseText.includes('ไม่รู้จัก action') || responseText.includes('NO_DATA'))) {
        console.log('Detected legacy Apps Script that expects activities array. Formatting fallback payload...');
        let fallbackActivities: any[] = [];

        if (payload?.action === 'add_csi') {
          fallbackActivities.push({
            date: formatInternationalDateTime(payload.timestamp),
            username: payload.site || 'PTP',
            fullName: payload.staffName || payload.dept || 'ผู้ประเมิน CSI',
            nickname: payload.dept || 'CSI',
            club: 'CSI Electronic',
            category: 'ประเมิน CSI',
            activityName: `ประเมิน CSI - แผนก ${payload.dept || ''}`,
            hours: 1,
            minutes: 0,
            totalMinutes: 60,
            description: `พนักงานที่ประทับใจ: ${payload.goodStaff || '-'} | เหตุผล: ${payload.goodReason || '-'} | ปรับปรุง: ${payload.badStaff || '-'} | หมายเหตุ: ${payload.extraNote || '-'}`
          });
        } else if (payload?.action === 'add_vote') {
          fallbackActivities.push({
            date: formatInternationalDateTime(payload.timestamp),
            username: payload.voter || 'StarVote',
            fullName: payload.voter || 'ผู้โหวต',
            nickname: payload.nominee || 'ผู้ถูกโหวต',
            club: 'BME Star',
            category: 'โหวต BME Star',
            activityName: `โหวต ${payload.category || ''} ให้ ${payload.nominee || ''}`,
            hours: 1,
            minutes: 0,
            totalMinutes: 60,
            description: `เหตุผล: ${payload.reason || '-'}`
          });
        } else if (payload?.activities) {
          fallbackActivities = payload.activities;
        }

        if (fallbackActivities.length > 0) {
          const res2 = await sendToGas(targetGasUrl, { activities: fallbackActivities });
          responseText = res2.text;
          console.log('Google Apps Script response (Attempt 2 Fallback):', responseText.substring(0, 150));
        }
      }

      // Attempt 3: If target URL returned HTML error/404 and target URL wasn't DEFAULT_GAS_URL, try DEFAULT_GAS_URL
      if (isHtmlOrErrorString(responseText) && targetGasUrl !== DEFAULT_GAS_URL) {
        console.log('Target GAS URL returned HTML error or 404. Retrying with DEFAULT_GAS_URL...');
        const resDefault = await sendToGas(DEFAULT_GAS_URL, payload);
        if (!isHtmlOrErrorString(resDefault.text)) {
          responseText = resDefault.text;
          console.log('Fallback to DEFAULT_GAS_URL succeeded:', responseText.substring(0, 150));
        }
      }

      let parsedJson: any = null;
      try { parsedJson = JSON.parse(responseText); } catch(e) {}

      if (parsedJson?.success || responseText.includes('SUCCESS') || responseText.includes('เรียบร้อย')) {
        return res.json({ success: true, message: parsedJson?.message || 'ซิงค์ข้อมูลลง Google Sheet สำเร็จเรียบร้อยแล้ว!' });
      } else if (isHtmlOrErrorString(responseText) || responseText.includes('A server error') || responseText.includes('Google Accounts') || responseText.includes('Authorization')) {
        return res.json({
          success: false,
          message: 'Google Apps Script แจ้งข้อผิดพลาด (โปรดตรวจสอบ URL ของ Web App และสิทธิ์ใน Deploy > New deployment ให้เลือก Who has access เป็น Anyone)'
        });
      } else {
        return res.json({
          success: parsedJson ? !!parsedJson.success : true,
          message: `ตอบกลับจาก Google Sheet: ${parsedJson?.message || responseText || 'บันทึกเรียบร้อย'}`
        });
      }
    } catch (err: any) {
      console.error('Error proxying to Google Apps Script:', err);
      return res.json({
        success: false,
        message: `เกิดข้อผิดพลาดในการส่งข้อมูล: ${err.message || 'ไม่สามารถติดต่อ Google Apps Script ได้'}`
      });
    }
  });

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
