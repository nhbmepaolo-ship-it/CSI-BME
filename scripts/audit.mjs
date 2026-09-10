#!/usr/bin/env node
/**
 * ตัวตรวจกันบั๊กย้อนกลับ (Regression Audit)
 * ------------------------------------------------------------
 * รันด้วย:  npm run audit
 *
 * ทำไมต้องมีไฟล์นี้
 *   บั๊กหลายตัวในโปรเจกต์นี้เคยถูกแก้ไปแล้ว แล้วกลับมาใหม่ เพราะโค้ดรูปแบบเดียวกัน
 *   มีอยู่หลายจุด แต่แก้ไปแค่จุดเดียวตามที่มีคนแจ้ง ไฟล์นี้จึงตรวจ "ทุกจุด" ของบั๊ก
 *   แต่ละประเภทพร้อมกัน ถ้ามีจุดไหนหลุด จะฟ้องทันทีก่อน deploy
 *
 * เพิ่มกฎใหม่ทุกครั้งที่เจอบั๊กใหม่ เพื่อไม่ให้บั๊กตัวนั้นกลับมาได้อีก
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'scripts']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (['.ts', '.tsx', '.gs', '.json'].includes(extname(name))) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const read = f => readFileSync(f, 'utf8');
const rel = f => f.replace(ROOT, '');

const results = [];
function check(name, fn) {
  try {
    const problems = fn() || [];
    results.push({ name, ok: problems.length === 0, problems });
  } catch (err) {
    results.push({ name, ok: false, problems: [`ตัวตรวจเองมีปัญหา: ${err.message}`] });
  }
}

/* ---------------------------------------------------------------
 * กฎที่ 1 — ห้ามมี Sheet ID เก่าหลงเหลือ
 * เคยพัง: แอปอ่าน CSI จากไฟล์เก่า ทำให้ข้อมูลเดือนล่าสุดไม่ขึ้น
 * ------------------------------------------------------------- */
check('ไม่มี Sheet ID เก่า (11qoHRaak...) หลงเหลือ', () =>
  files
    .filter(f => read(f).includes('11qoHRaak'))
    .map(f => `${rel(f)} ยังอ้างถึงไฟล์ชีทเก่า`)
);

/* ---------------------------------------------------------------
 * กฎที่ 2 — ทุกจุดที่ดึง CSV จาก gviz ต้องตรวจหัวตารางก่อนใช้
 * เคยพัง 3 จุด: Google ส่งแท็บแรก (CSI) กลับมาเมื่อหาแท็บไม่เจอ
 *               แล้วถูกอ่านเป็น coaching / พนักงาน กลายเป็นข้อมูลขยะ
 * ------------------------------------------------------------- */
check('ทุกจุดที่ "เดาชื่อแท็บ" มีการตรวจหัวตาราง', () => {
  // เฉพาะจุดที่วนเดาชื่อแท็บหลายชื่อเท่านั้นที่เสี่ยง เพราะถ้าเดาผิดทุกชื่อ
  // Google จะส่งแท็บแรก (CSI) กลับมาแทน ส่วนจุดที่ระบุชื่อแท็บตายตัวไม่เสี่ยงแบบนี้
  const problems = [];
  for (const f of files) {
    const src = read(f);
    const guessLists = (src.match(/possible\w*Tabs\s*=/g) || []).length;
    if (!guessLists) continue;
    const guards = (src.match(/looksLikeCsi|isSheetTabOfType|staffLooksLikeCsi/gi) || []).length;
    if (guards < guessLists)
      problems.push(`${rel(f)} เดาชื่อแท็บ ${guessLists} ชุด แต่มีตัวตรวจหัวตารางแค่ ${guards} จุด`);
  }
  return problems;
});

/* ---------------------------------------------------------------
 * กฎที่ 3 — ทุกการเรียก html2canvas ต้องล้างสีรูปแบบใหม่ก่อน
 * เคยพัง 2 รอบ: oklch แล้วก็ oklab ทำให้ PDF/PNG/พิมพ์ ใช้ไม่ได้
 * ------------------------------------------------------------- */
check('html2canvas ทุกจุดมี onclone ล้างสี oklch/oklab', () => {
  const problems = [];
  for (const f of files) {
    const src = read(f);
    const calls = (src.match(/html2canvas\(/g) || []).length;
    if (!calls) continue;
    const guards = (src.match(/onclone/g) || []).length;
    if (guards < calls) problems.push(`${rel(f)} เรียก html2canvas ${calls} ครั้ง แต่มี onclone แค่ ${guards}`);
  }
  return problems;
});

/* ---------------------------------------------------------------
 * กฎที่ 4 — ทุกเมนูต้องมีทั้งทางเขียนและทางอ่านครบ
 * เคยพัง: CSI บันทึกได้แต่ไม่เคยเขียนขึ้นชีท / กิจกรรมเขียนได้แต่อ่านกลับไม่ได้
 * ------------------------------------------------------------- */
check('ทุกเมนูมีทั้ง action เขียนและอ่านครบ', () => {
  const gasPath = join(ROOT, 'apps-script/Code.gs');
  if (!existsSync(gasPath)) return ['ไม่พบไฟล์ apps-script/Code.gs'];
  const gas = read(gasPath);
  const storage = read(join(ROOT, 'src/services/storage.ts'));

  const modules = [
    { name: 'CSI', write: 'add_csi', read: null },
    { name: 'กิจกรรม', write: 'sync_activities', read: 'get_activities' },
    { name: 'โหวต', write: 'sync_votes', read: 'get_votes' },
    { name: 'Coaching', write: 'sync_coaching', read: 'get_coaching' },
    { name: 'ผังองค์กร', write: 'sync_orgchart', read: 'get_orgchart' }
  ];

  const problems = [];
  for (const m of modules) {
    if (!gas.includes(m.write)) problems.push(`${m.name}: Apps Script ไม่รองรับ "${m.write}"`);
    if (!storage.includes(m.write)) problems.push(`${m.name}: ฝั่งแอปไม่เคยเรียก "${m.write}"`);
    if (m.read) {
      if (!gas.includes(m.read)) problems.push(`${m.name}: Apps Script ไม่รองรับ "${m.read}"`);
      if (!storage.includes(m.read)) problems.push(`${m.name}: ฝั่งแอปไม่เคยเรียก "${m.read}"`);
    }
  }
  return problems;
});

/* ---------------------------------------------------------------
 * กฎที่ 5 — import แบบ relative ต้องมีนามสกุลไฟล์ (ESM)
 * เคยพัง: ทุก API บน Vercel ล่ม 500 ERR_MODULE_NOT_FOUND
 * ------------------------------------------------------------- */
check('relative import มีนามสกุล .js ครบ (ESM บน Vercel)', () => {
  const pkg = JSON.parse(read(join(ROOT, 'package.json')));
  if (pkg.type !== 'module') return [];
  const problems = [];
  for (const f of files) {
    if (!['.ts', '.tsx'].includes(extname(f))) continue;
    // ฝั่ง client (src/) ผ่าน Vite ซึ่ง resolve ให้เอง — กฎนี้ใช้กับโค้ดที่ Node รันตรงๆ เท่านั้น
    if (rel(f).replace(/^\//, '').startsWith('src/')) continue;
    for (const line of read(f).split('\n')) {
      const m = line.match(/^\s*import\s+.*from\s+['"](\.[^'"]+)['"]/);
      if (m && !/\.(js|json|css)$/.test(m[1]))
        problems.push(`${rel(f)}: ${m[1]} ไม่มีนามสกุล .js`);
    }
  }
  return problems;
});

/* ---------------------------------------------------------------
 * กฎที่ 6 — ห้ามโชว์รหัสผ่านพนักงาน
 * เคยพัง: ปุ่ม "ล็อกอินด่วน" เติมรหัสผ่านจริงของทุกคนให้อัตโนมัติ
 * ------------------------------------------------------------- */
check('ไม่มีการเปิดเผยรหัสผ่านพนักงานใน UI', () => {
  const problems = [];
  for (const f of files) {
    if (extname(f) !== '.tsx') continue;
    const src = read(f);
    if (/setLoginPassword\s*\(\s*emp\./.test(src))
      problems.push(`${rel(f)} เติมรหัสผ่านของพนักงานลงช่องล็อกอิน`);
    if (/type="text"[^>]*value=\{(?:edit)?[Pp]assword\}/.test(src))
      problems.push(`${rel(f)} แสดงรหัสผ่านเป็นตัวอักษรธรรมดา`);
  }
  return problems;
});

/* ---------------------------------------------------------------
 * กฎที่ 7 — ID ของกิจกรรมต้องไม่ซ้ำ
 * เคยพัง: 'act-' + Date.now() ซ้ำกัน 19 แถว ระบบยุบเหลือรายการเดียว
 * ------------------------------------------------------------- */
check('การสร้าง ID กิจกรรมไม่ใช้ Date.now() เปล่าๆ', () => {
  const src = read(join(ROOT, 'src/services/storage.ts'));
  return /'act-'\s*\+\s*Date\.now\(\)\s*[,;]/.test(src)
    ? ["storage.ts สร้าง ID จาก Date.now() อย่างเดียว จะซ้ำได้ถ้าบันทึกพร้อมกัน"]
    : [];
});

/* ---------------------------------------------------------------
 * กฎที่ 8 — การแก้ไขในเครื่องต้องไม่ถูกการซิงค์เขียนทับ
 * เคยพัง: ลบคนออกจากผังองค์กรแล้วอีก 3 นาทีคนนั้นกลับมา
 * ------------------------------------------------------------- */
check('ผังองค์กร/Coaching มีตัวกันการซิงค์เขียนทับงานที่แก้ค้างไว้', () => {
  const src = read(join(ROOT, 'src/services/storage.ts'));
  const problems = [];
  if (!src.includes('PENDING_KEYS')) problems.push('ไม่พบระบบ pending สำหรับกันข้อมูลถูกเขียนทับ');
  if (!src.includes('isPending')) problems.push('ไม่มีการตรวจ pending ก่อนดึงข้อมูลมาทับ');
  return problems;
});

/* ---------------------------------------------------------------
 * กฎที่ 9 — วันที่ที่เขียนลงชีทต้องเป็นรูปแบบเดียวกันเสมอ
 * เคยพัง: toLocaleDateString('th-TH') ให้ปี พ.ศ. ปนกับ ค.ศ. ในคอลัมน์เดียว
 * ------------------------------------------------------------- */
check('ไม่เขียนวันที่ลงชีทด้วย toLocaleDateString', () => {
  const problems = [];
  for (const f of files) {
    const src = read(f);
    if (/date:\s*[^,\n]*toLocaleDateString/.test(src))
      problems.push(`${rel(f)} เขียนวันที่ลงชีทด้วย toLocaleDateString (ได้ปี พ.ศ.)`);
  }
  return problems;
});

/* ---------------------------------------------------------------
 * กฎที่ 10 — กราฟต้องอ่านออกบนพื้นหลังเข้ม
 * เคยพัง: ตัวหนังสือแกนกราฟเป็นสีเกือบดำ มองไม่เห็น
 * ------------------------------------------------------------- */
check('แกนกราฟทุกอันกำหนดสีตัวอักษรไว้', () => {
  const problems = [];
  for (const f of files) {
    if (extname(f) !== '.tsx') continue;
    const src = read(f);
    const axes = (src.match(/<(?:XAxis|YAxis)\b/g) || []).length;
    if (!axes) continue;
    const ticks = (src.match(/tick=\{\{\s*fill:/g) || []).length;
    if (ticks < axes) problems.push(`${rel(f)} มีแกน ${axes} อัน แต่กำหนดสีตัวอักษรแค่ ${ticks}`);
  }
  return problems;
});

/* --------------------------- สรุปผล --------------------------- */
console.log('\n═══ ตรวจกันบั๊กย้อนกลับ (Regression Audit) ═══\n');
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'}  ${r.name}`);
  for (const p of r.problems) {
    console.log(`      └─ ${p}`);
    failed++;
  }
}
console.log(
  `\nสรุป: ผ่าน ${results.filter(r => r.ok).length}/${results.length} กฎ` +
    (failed ? `  •  พบปัญหา ${failed} จุด\n` : '  •  ไม่พบบั๊กย้อนกลับ\n')
);
process.exit(results.every(r => r.ok) ? 0 : 1);
