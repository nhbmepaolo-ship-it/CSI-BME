import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Route to Auto-Pull Data from Google Sheet ID directly
  app.get('/api/fetch-sheet-data', async (req, res) => {
    try {
      const sheetId = (req.query.sheetId as string) || '11qoHRaakTjvDWvOekqTTlP2SFcqdfys6cT653wRfjUA';
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

      // Try fetching staff list from 'ข้อมูลพนักงาน' tab as well
      const staffTabUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('ข้อมูลพนักงาน')}`;
      const staffRes = await fetch(staffTabUrl, { redirect: 'follow' });
      const employees = [];

      if (staffRes.ok) {
        const staffCsv = await staffRes.text();
        const staffRows = parseCSV(staffCsv);
        if (staffRows.length > 1) {
          let fullNameIdx = 0;
          let nicknameIdx = 1;
          let imgIdx = 2;
          let usernameIdx = 3;
          let passIdx = 4;

          const header = staffRows[0].map(h => (h || '').trim().toLowerCase());
          header.forEach((col, idx) => {
            if (col.includes('ชื่อ') && !col.includes('เล่น')) fullNameIdx = idx;
            if (col.includes('เล่น')) nicknameIdx = idx;
            if (col.includes('รูป') || col.includes('img') || col.includes('pic') || col.includes('photo')) imgIdx = idx;
            if (col.includes('user')) usernameIdx = idx;
            if (col.includes('pass')) passIdx = idx;
          });

          for (let j = 1; j < staffRows.length; j++) {
            const sRow = staffRows[j];
            if (sRow && sRow.length >= 2) {
              const cleanStr = (val: string) => (val || '').replace(/\s*\(?https?:\/\/[^\s)]+\)?/gi, '').trim();

              const fullName = cleanStr(sRow[fullNameIdx] || '');
              const nickname = cleanStr(sRow[nicknameIdx] || fullName || '');
              let img = (sRow[imgIdx] || '').trim();
              const username = (sRow[usernameIdx] || `emp_${j}`).trim();
              const password = (sRow[passIdx] || '123').trim();

              // Clean up image URL if it starts with http
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
        }
      }

      return res.json({
        success: true,
        sheetId,
        sheetName,
        totalFetched: csiRecords.length,
        csiRecords,
        employees
      });

    } catch (err: any) {
      console.error('Error fetching sheet data:', err);
      return res.status(500).json({
        success: false,
        message: `เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheet: ${err.message}`
      });
    }
  });

  // API Proxy Route for Google Apps Script Sync
  app.post('/api/sync-sheets', async (req, res) => {
    try {
      const { gasUrl, payload } = req.body;

      if (!gasUrl || typeof gasUrl !== 'string' || !gasUrl.trim()) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ Google Apps Script Web App URL' });
      }

      console.log('Proxying sync request to Google Apps Script:', gasUrl.trim());

      const response = await fetch(gasUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      const responseText = await response.text();
      console.log('Google Apps Script response:', responseText);

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
