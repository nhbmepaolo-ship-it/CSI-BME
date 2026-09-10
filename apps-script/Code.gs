/**
 * CSI BME PTP — Google Apps Script Web App (เวอร์ชันอ่าน+เขียน)
 *
 * สร้างต่อจากสคริปต์เดิมที่ใช้งานอยู่ โดย "คงของเดิมไว้ทั้งหมด" และเพิ่มส่วนที่ขาด
 *
 * ปัญหาเดิม: สคริปต์เดิมมีแต่คำสั่ง "เขียน" (add_/update_/delete_/sync_activities)
 * แต่ไม่มีคำสั่ง "อ่าน" (get_*) เลย ระบบจึงบันทึกลงชีทได้ แต่ดึงกลับมาแสดงไม่ได้
 * ทุกครั้งที่แอปขอข้อมูลจะตกไปที่ fallback แล้วได้ {"success":false,...} กลับมา
 * ทำให้แดชบอร์ดขึ้น 0 ชม. ทั้งที่ข้อมูลอยู่ในชีทครบ
 *
 * เพิ่มในเวอร์ชันนี้
 *  1. get_activities / get_votes / get_coaching / get_orgchart / get_all  (คำสั่งอ่าน)
 *  2. sync_votes / sync_coaching / sync_orgchart  (รับข้อมูลแบบ array จากแอป)
 *  3. รองรับการลบข้ามเครื่อง (deleted: true) ของกิจกรรม
 *  4. setup_sheets สำหรับสร้าง/ตรวจแท็บทั้งหมดในครั้งเดียว
 *
 * วิธีติดตั้ง (เหมือนเดิม)
 *  1. เปิด Google Sheet > ส่วนขยาย > Apps Script
 *  2. ลบโค้ดเดิมทั้งหมด วางโค้ดนี้แทน แล้วบันทึก
 *  3. Deploy > จัดการการทำให้ใช้งานได้ > แก้ไข (ดินสอ) > เวอร์ชัน: เวอร์ชันใหม่ > ทำให้ใช้งานได้
 *     สำคัญ: ต้องเลือก "เวอร์ชันใหม่" ทุกครั้ง ไม่งั้นโค้ดเก่าจะยังทำงานอยู่
 *  4. ผู้ที่เข้าถึงได้ = ทุกคน (Anyone)
 *  5. URL ต้องลงท้ายด้วย /exec
 */

var SPREADSHEET_ID = "1eswu63LgsBcdAZZeRvfnJ5v3SlkM7n1y3K5Hwbc-Ryw";

/**
 * แบบประเมิน CSI อยู่คนละไฟล์กับกิจกรรม/โหวต/Coaching
 * ระบบอ่านผล CSI จากไฟล์นี้ (ไฟล์เดียวกับที่ Google Form บันทึกคำตอบลงไป)
 * ถ้าเขียน CSI ลงไฟล์เดิม (SPREADSHEET_ID) ข้อมูลจะไปคนละที่กับที่ระบบอ่าน
 * แล้วผู้ใช้จะไม่มีวันเห็นคำตอบที่เพิ่งบันทึกเลย จึงต้องระบุไฟล์ CSI แยกไว้ตรงนี้
 */
var CSI_SPREADSHEET_ID = "11qoHRaakTjvDWvOekqTTlP2SFcqdfys6cT653wRfjUA";

var TAB_CSI      = "CSI Electronic (การตอบกลับ)";
var TAB_COACHING = "Coaching Data";
var TAB_VOTES    = "Votes";
var TAB_ACTIVITY = "กิจกรรม";
var TAB_ORGCHART = "ผังองค์กร";

var ACTIVITY_HEADER = [
  "ID", "วันที่ทำกิจกรรม", "รหัสพนักงาน", "ชื่อผู้บันทึก", "ชื่อเล่น",
  "ชมรม", "หมวดหมู่", "ชื่อกิจกรรม", "ชั่วโมง", "นาที", "นาทีรวม", "รายละเอียด"
];

// หัวตารางตรงตามแท็บ Votes จริงในชีท: Timestamp | Voter | Category | Nominee | VoteMonth
// (ลำดับ Category มาก่อน Nominee — ห้ามสลับ ไม่งั้นชื่อผู้ถูกโหวตจะไปอยู่ช่องหมวดหมู่)
var VOTE_HEADER = ["Timestamp", "Voter", "Category", "Nominee", "VoteMonth"];

var COACHING_HEADER = [
  "วันที่บันทึก", "รหัสพนักงาน", "ชื่อ-นามสกุล", "ชื่อเล่น", "ตำแหน่ง",
  "ประเภทสัญญา", "ลักษณะสัตว์ (DISC)", "โค้ชผู้ดูแล",
  "W1 (ชม.)", "W2 (ชม.)", "W3 (ชม.)", "W4 (ชม.)", "W5 (ชม.)", "W6 (ชม.)",
  "ชั่วโมงรวม", "ความก้าวหน้า (%)"
];

/* ============================================================
 *  ส่งการ์ดสรุปรายสัปดาห์เข้า LINE และ Telegram อัตโนมัติ
 *  ------------------------------------------------------------
 *  ทำงานในตัว Apps Script เอง ไม่ต้องพึ่ง Vercel Cron (แพลน Hobby
 *  ตั้ง cron รายสัปดาห์ไม่ได้) และไม่ต้องตั้ง Environment Variables
 *
 *  วิธีติดตั้ง (ทำครั้งเดียว)
 *   1. ใส่ Token/ID: เลือกฟังก์ชัน RUN_ตั้งค่าการแจ้งเตือน แล้วแก้ค่าใน
 *      ฟังก์ชันนั้นให้เป็นของคุณก่อนกดเรียกใช้ (เก็บใน Script Properties
 *      ไม่ได้ฝังไว้ในโค้ด จึงไม่หลุดไปกับไฟล์ที่แชร์)
 *   2. ทดสอบ: เลือกฟังก์ชัน RUN_ทดสอบส่งการ์ด แล้วกดเรียกใช้
 *   3. ตั้งเวลา: เมนูซ้าย "ทริกเกอร์ (Triggers)" > เพิ่มทริกเกอร์
 *      - ฟังก์ชัน: sendWeeklyCard
 *      - ประเภท: ตามเวลา (Time-driven) > ตัวจับเวลารายสัปดาห์ (Week timer)
 *      - วัน: วันพฤหัสบดี   เวลา: 10:00-11:00 น.
 *      (Apps Script เลือกเวลาได้เป็นช่วง 1 ชั่วโมง ไม่สามารถระบุ 10:30 เป๊ะได้)
 * ============================================================ */

/** ใส่ค่า Token/ID ของคุณตรงนี้ แล้วกดเรียกใช้ฟังก์ชันนี้ครั้งเดียว */
function RUN_ตั้งค่าการแจ้งเตือน() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    LINE_CHANNEL_TOKEN: "",   // Channel access token ของ LINE OA ของคุณ
    LINE_GROUP_ID:      "",   // Group ID ของกลุ่ม LINE ที่จะให้แจ้งเตือน
    LINE_USER_ID:       "",   // (ไม่บังคับ) ส่งเข้าแชทส่วนตัวด้วย
    TELEGRAM_BOT_TOKEN: "",   // Bot Token จาก @BotFather
    TELEGRAM_CHAT_ID:   ""    // Chat ID ของกลุ่ม/แชท Telegram
  }, false);
  Logger.log("บันทึกการตั้งค่าเรียบร้อย — ลองเรียก RUN_ทดสอบส่งการ์ด ต่อได้เลย");
}

/** ทดสอบส่งทันที (ใช้ข้อมูลจริง) */
function RUN_ทดสอบส่งการ์ด() {
  var result = sendWeeklyCard();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** ดูข้อความที่จะส่ง โดยไม่ส่งจริง */
function RUN_ดูข้อความก่อนส่ง() {
  Logger.log(buildWeeklyCardText());
}

/**
 * ดู JSON ของการ์ด Flex โดยไม่ส่งจริง
 * คัดลอกผลไปวางดูตัวอย่างได้ที่ https://developers.line.biz/flex-simulator/
 */
function RUN_ดูการ์ดFlex() {
  Logger.log(JSON.stringify(buildWeeklyFlex(), null, 2));
}

function prop_(name) {
  return (PropertiesService.getScriptProperties().getProperty(name) || "").trim();
}

/** วันที่ปัจจุบันตามเวลาไทย */
function bkkNow_() {
  return new Date(Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy/MM/dd HH:mm:ss"));
}

/** ข้อความกระชับสำหรับ Telegram และใช้เป็น fallback ของ Flex (รองรับ HTML ตัวหนา) */
function buildWeeklyCardText() {
  var d = collectWeeklyData_();

  var t = "📢 <b>สรุป CSI &amp; กิจกรรม BME PTP</b>\n";
  t += "📅 " + d.dateLabel + "   🗓 " + d.monthLabel + "\n";
  t += "━━━━━━━━━━━━\n";

  t += "\n💖 <b>ผลประเมิน CSI</b>\n";
  t += "🏥 แผนก " + d.deptCount + "/20   " + (d.deptCount >= 20 ? "✅ ครบแล้ว" : "⏳ ยังไม่ครบ") + "\n";

  if (d.top3.length) {
    t += "\n🌟 <b>พนักงานดีเด่น</b>\n";
    var medals = ["🥇", "🥈", "🥉"];
    d.top3.forEach(function (s, i) {
      t += medals[i] + " " + shortName_(s.name, "") + "  " + s.count + "× ⭐" + s.avg + "\n";
    });
  }

  t += "\n🏃 <b>ชั่วโมงกิจกรรม</b>\n";
  if (d.topHours.length) {
    d.topHours.slice(0, 8).forEach(function (e, i) {
      var h = Math.floor(e.mins / 60), m = e.mins % 60;
      t += (i + 1) + ". " + shortName_(e.name, e.nick) + "  ⏱ " + h + ":" + (m < 10 ? "0" + m : m) + "\n";
    });
  } else {
    t += "— ยังไม่มีข้อมูลเดือนนี้\n";
  }

  t += "\n━━━━━━━━━━━━\n🤖 ส่งอัตโนมัติ · CSI BME PTP";
  return t;
}

/** เวอร์ชันไม่มีแท็ก HTML ใช้ตอนส่งเข้า LINE (LINE ไม่รองรับ HTML) */
function buildWeeklyCardPlainText() {
  return buildWeeklyCardText().replace(/<\/?b>/g, "").replace(/&amp;/g, "&");
}

/**
 * ย่อชื่อให้สั้นที่สุดเพื่อไม่ให้ข้อความล้นขึ้นบรรทัดใหม่
 * ลำดับการเลือก: ชื่อเล่นที่มีอยู่แล้ว > ชื่อเล่นในวงเล็บ "Somchai (เป๊ก)" > ชื่อต้นภาษาอังกฤษ
 */
function shortName_(fullName, nickname) {
  var nick = String(nickname || "").trim();
  if (nick) return nick;

  var full = String(fullName || "").trim();
  if (!full) return "-";

  var inParen = full.match(/\(([^)]+)\)/);
  if (inParen && inParen[1].trim()) return inParen[1].trim();

  // ตัดวงเล็บทิ้งแล้วเอาคำแรก (ชื่อต้น) — ภาษาไทยส่วนใหญ่สั้นอยู่แล้ว
  return full.replace(/\([^)]*\)/g, "").trim().split(/\s+/)[0] || full;
}

function txt_(text, opts) {
  var o = { type: "text", text: String(text), wrap: true, size: "sm" };
  for (var k in (opts || {})) o[k] = opts[k];
  return o;
}

/** การ์ด Flex สำหรับ LINE — เน้นกระชับ ตัวอักษรเล็ก ใช้ชื่อเล่น/อิโมจิ ไม่ให้ตกบรรทัด */
function buildWeeklyFlex() {
  var d = collectWeeklyData_();
  var achieved = d.deptCount >= 20;

  var body = [];

  // --- CSI ---
  body.push(txt_("💖 ผลประเมิน CSI", { weight: "bold", size: "sm", color: "#00695C", wrap: false }));
  body.push({
    type: "box", layout: "vertical", margin: "sm", spacing: "xs",
    backgroundColor: "#F1F8E9", cornerRadius: "md", paddingAll: "sm",
    contents: [
      {
        type: "box", layout: "horizontal", contents: [
          txt_("🏥 แผนก", { size: "xxs", color: "#666666", flex: 3, wrap: false }),
          txt_(d.deptCount + "/20", { size: "xxs", weight: "bold", align: "end", flex: 2, color: "#2E7D32", wrap: false })
        ]
      },
      {
        type: "box", layout: "horizontal", contents: [
          txt_("🎯 เป้าหมาย", { size: "xxs", color: "#666666", flex: 3, wrap: false }),
          txt_(achieved ? "✅ ครบแล้ว" : "⏳ ยังไม่ครบ",
               { size: "xxs", weight: "bold", align: "end", flex: 2, color: achieved ? "#2E7D32" : "#EF6C00", wrap: false })
        ]
      }
    ]
  });

  if (d.top3.length) {
    body.push(txt_("🌟 พนักงานดีเด่น", { weight: "bold", size: "xs", margin: "md", color: "#00695C", wrap: false }));
    var medals = ["🥇", "🥈", "🥉"];
    d.top3.forEach(function (s, i) {
      body.push({
        type: "box", layout: "horizontal", margin: "xs", contents: [
          txt_(medals[i] + " " + shortName_(s.name, ""), { size: "xxs", flex: 4, color: "#333333", wrap: false }),
          txt_(s.count + "× ⭐" + s.avg, { size: "xxs", align: "end", flex: 3, color: "#00897B", weight: "bold", wrap: false })
        ]
      });
    });
  }

  body.push({ type: "separator", margin: "lg" });

  // --- กิจกรรม ---
  body.push(txt_("🏃 ชั่วโมงกิจกรรม", { weight: "bold", size: "sm", margin: "md", color: "#00695C", wrap: false }));

  if (d.topHours.length) {
    d.topHours.slice(0, 8).forEach(function (e, i) {
      var h = Math.floor(e.mins / 60), m = e.mins % 60;
      body.push({
        type: "box", layout: "horizontal", margin: "xs", contents: [
          txt_((i + 1) + ". " + shortName_(e.name, e.nick), { size: "xxs", flex: 4, color: "#333333", wrap: false }),
          txt_("⏱ " + h + ":" + (m < 10 ? "0" + m : m), { size: "xxs", align: "end", flex: 3, color: "#00897B", weight: "bold", wrap: false })
        ]
      });
    });
  } else {
    body.push(txt_("— ยังไม่มีข้อมูลเดือนนี้", { size: "xxs", color: "#888888", margin: "sm", wrap: false }));
  }

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#00897B", paddingAll: "md",
      contents: [
        txt_("📢 สรุป CSI & กิจกรรม BME PTP", { weight: "bold", color: "#FFFFFF", size: "sm", wrap: false }),
        txt_("📅 " + d.dateLabel + "   🗓 " + d.monthLabel, { color: "#E0F2F1", size: "xxs", margin: "xs", wrap: false })
      ]
    },
    body: { type: "box", layout: "vertical", paddingAll: "md", spacing: "none", contents: body },
    footer: {
      type: "box", layout: "vertical", paddingAll: "sm", backgroundColor: "#FAFAFA",
      contents: [txt_("ส่งอัตโนมัติ · CSI BME PTP", { size: "xxs", color: "#999999", align: "center", wrap: false })]
    }
  };
}

/** รวบรวมตัวเลขสรุปของเดือนปัจจุบัน ใช้ร่วมกันทั้งข้อความธรรมดาและการ์ด Flex */
function collectWeeklyData_() {
  var now = bkkNow_();
  var monthKey = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM");
  var thaiMonths = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  var monthLabel = thaiMonths[now.getMonth() + 1] + " " + now.getFullYear();

  /* ---------- ส่วนที่ 1: ผลประเมิน CSI ---------- */
  var deptSet = {}, deptCount = 0;
  var staffMap = {};

  try {
    var csiSs = SpreadsheetApp.openById(CSI_SPREADSHEET_ID);
    var csiSheet = csiSs.getSheetByName(TAB_CSI);
    if (csiSheet && csiSheet.getLastRow() > 1) {
      var width = Math.min(csiSheet.getLastColumn(), 25);
      var csiRows = csiSheet.getRange(2, 1, csiSheet.getLastRow() - 1, width).getValues();

      csiRows.forEach(function (r) {
        var iso = toIso(r[0]);
        if (!iso || iso.substring(0, 7) !== monthKey) return;

        var dept = String(r[3] || "").trim();
        if (dept && !deptSet[dept]) { deptSet[dept] = true; deptCount++; }

        // คะแนนอยู่คอลัมน์ 1.1-1.7 (index 7-13) และ 2.1-2.5 (index 15-19)
        var scores = [], idxs = [7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19];
        idxs.forEach(function (i) {
          var n = parseInt(r[i], 10);
          if (!isNaN(n) && n >= 1 && n <= 5) scores.push(n);
        });
        var avg = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 0;

        // นับทั้งพนักงานที่ถูกประเมิน และคนที่ถูกระบุว่า "ประทับใจ"
        var names = {};
        [String(r[4] || "").trim(), String(r[20] || "").trim()].forEach(function (n) {
          if (n && n !== "-" && n !== "ไม่ระบุ") names[n] = true;
        });
        Object.keys(names).forEach(function (n) {
          if (!staffMap[n]) staffMap[n] = { count: 0, total: 0 };
          staffMap[n].count++;
          staffMap[n].total += avg;
        });
      });
    }
  } catch (e) {
    Logger.log("อ่านข้อมูล CSI ไม่ได้: " + e);
  }

  var top3 = Object.keys(staffMap).map(function (n) {
    return { name: n, count: staffMap[n].count, avg: (staffMap[n].total / staffMap[n].count).toFixed(1) };
  }).sort(function (a, b) {
    return b.count - a.count || parseFloat(b.avg) - parseFloat(a.avg);
  }).slice(0, 3);

  /* ---------- ส่วนที่ 2: ชั่วโมงกิจกรรม ---------- */
  var hoursMap = {};
  try {
    readActivities(SpreadsheetApp.getActiveSpreadsheet()).forEach(function (a) {
      if (!a.timestamp || a.timestamp.substring(0, 7) !== monthKey) return;
      var key = a.fullName + "|" + a.nickname;
      if (!hoursMap[key]) hoursMap[key] = { name: a.fullName, nick: a.nickname, mins: 0 };
      hoursMap[key].mins += Number(a.totalMinutes) || 0;
    });
  } catch (e) {
    Logger.log("อ่านข้อมูลกิจกรรมไม่ได้: " + e);
  }

  var topHours = Object.keys(hoursMap).map(function (k) { return hoursMap[k]; })
    .sort(function (a, b) { return b.mins - a.mins; }).slice(0, 10);

  /* ---------- คืนค่าเป็นข้อมูลดิบ ให้ตัวสร้างข้อความ/การ์ด Flex ไปใช้ต่อ ---------- */
  return {
    dateLabel: Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy"),
    monthLabel: monthLabel,
    deptCount: deptCount,
    top3: top3,
    topHours: topHours
  };
}

/** ฟังก์ชันหลักที่ทริกเกอร์เรียก — ส่งการ์ด Flex เข้า LINE และข้อความเข้า Telegram */
function sendWeeklyCard() {
  var text = buildWeeklyCardPlainText();   // LINE: ไม่มีแท็ก HTML
  var tgText = buildWeeklyCardText();      // Telegram: มี <b> ตัวหนา
  var out = { line: "", telegram: "" };

  // ----- LINE (การ์ด Flex) -----
  var lineToken = prop_("LINE_CHANNEL_TOKEN");
  var targets = [prop_("LINE_GROUP_ID"), prop_("LINE_USER_ID")].filter(String);

  if (lineToken && targets.length) {
    var flex = null;
    try {
      flex = buildWeeklyFlex();
    } catch (eFlex) {
      Logger.log("สร้างการ์ด Flex ไม่สำเร็จ จะส่งเป็นข้อความธรรมดาแทน: " + eFlex);
    }

    var msgs = [];
    targets.forEach(function (to) {
      // ลองส่งเป็นการ์ด Flex ก่อน ถ้า LINE ปฏิเสธ (โครงสร้างผิด/ยาวเกิน)
      // ค่อยถอยไปส่งข้อความธรรมดา เพื่อให้ยังได้รับรายงานอยู่ดี
      var sent = false;

      if (flex) {
        try {
          var resFlex = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
            method: "post",
            contentType: "application/json",
            headers: { Authorization: "Bearer " + lineToken },
            payload: JSON.stringify({
              to: to,
              messages: [{
                type: "flex",
                altText: "รายงานสรุป CSI & กิจกรรม BME PTP",
                contents: flex
              }]
            }),
            muteHttpExceptions: true
          });
          if (resFlex.getResponseCode() === 200) {
            msgs.push(to + ": สำเร็จ (การ์ด Flex)");
            sent = true;
          } else {
            Logger.log("Flex ถูกปฏิเสธ: " + resFlex.getContentText().substring(0, 300));
          }
        } catch (e1) {
          Logger.log("ส่ง Flex ผิดพลาด: " + e1);
        }
      }

      if (!sent) {
        try {
          var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
            method: "post",
            contentType: "application/json",
            headers: { Authorization: "Bearer " + lineToken },
            payload: JSON.stringify({ to: to, messages: [{ type: "text", text: text }] }),
            muteHttpExceptions: true
          });
          msgs.push(res.getResponseCode() === 200
            ? to + ": สำเร็จ (ข้อความธรรมดา)"
            : to + ": " + res.getContentText().substring(0, 150));
        } catch (e) {
          msgs.push(to + ": " + e);
        }
      }
    });
    out.line = msgs.join(" | ");
  } else {
    out.line = "ยังไม่ได้ตั้งค่า LINE_CHANNEL_TOKEN / LINE_GROUP_ID (ดูที่ การตั้งค่าโปรเจกต์ > พร็อพเพอร์ตี้ของสคริปต์)";
  }

  // ----- Telegram -----
  var botToken = prop_("TELEGRAM_BOT_TOKEN");
  var chatId = prop_("TELEGRAM_CHAT_ID");

  if (botToken && chatId) {
    try {
      var tg = UrlFetchApp.fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          chat_id: chatId,
          text: tgText,
          parse_mode: "HTML",
          disable_web_page_preview: true
        }),
        muteHttpExceptions: true
      });
      var body = JSON.parse(tg.getContentText());
      out.telegram = body.ok ? "สำเร็จ" : (body.description || "ส่งไม่สำเร็จ");
    } catch (e) {
      out.telegram = String(e);
    }
  } else {
    out.telegram = "ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID";
  }

  Logger.log("LINE: " + out.line + "\nTelegram: " + out.telegram);
  return out;
}

function doPost(e) { return handleRequest(e); }
function doGet(e)  { return handleRequest(e); }

/* ============================================================
 *  ฟังก์ชันสำหรับกดรันตรงๆ ในหน้า Apps Script Editor
 *  วิธีใช้: เลือกชื่อฟังก์ชันจากเมนูดรอปดาวน์ด้านบน แล้วกดปุ่ม "เรียกใช้" (Run)
 *  ผลลัพธ์จะขึ้นในช่อง "บันทึกการดำเนินการ" (Execution log) ด้านล่าง
 *
 *  วิธีนี้ชัวร์กว่าการพิมพ์ ?action=... ท้าย URL เพราะไม่ต้องพึ่งพารามิเตอร์
 *  ที่มักถูกตัดทิ้งระหว่าง redirect ของ Google
 * ============================================================ */

/** ตรวจสอบว่าข้อมูลในแต่ละแท็บตรงกันหรือไม่ (อ่านอย่างเดียว ไม่แก้ไขข้อมูล) */
function RUN_ตรวจสอบข้อมูล() {
  var result = JSON.parse(handleRequest({ parameter: { action: "audit" } }).getContent
    ? handleRequest({ parameter: { action: "audit" } }).getContent()
    : handleRequest({ parameter: { action: "audit" } }));
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** ซ่อม ID ที่ซ้ำกันในแท็บกิจกรรม (แก้ไขข้อมูลจริง — รันครั้งเดียวพอ) */
function RUN_ซ่อมIDซ้ำ() {
  var out = handleRequest({ parameter: { action: "fix_duplicate_ids" } });
  var result = JSON.parse(out.getContent ? out.getContent() : out);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (err) {}
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss;
}

/** คืนแท็บตามชื่อ ถ้ายังไม่มีจะสร้างให้พร้อมหัวตาราง */
function getTab(ss, name, header) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (header) sheet.appendRow(header);
  }
  return sheet;
}

/** แท็บกิจกรรม พร้อมย้ายข้อมูลเดิมให้มีคอลัมน์ ID */
function getActivityTab(ss) {
  var sheet = ss.getSheetByName(TAB_ACTIVITY)
           || ss.getSheetByName("ชีต8");

  if (!sheet) {
    sheet = ss.insertSheet(TAB_ACTIVITY);
    sheet.appendRow(ACTIVITY_HEADER);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ACTIVITY_HEADER);
    return sheet;
  }

  // ถ้าคอลัมน์แรกยังไม่ใช่ ID ให้แทรกคอลัมน์ ID ไว้หน้าสุดครั้งเดียว
  var firstCell = String(sheet.getRange(1, 1).getValue() || "").trim();
  if (firstCell !== "ID") {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue("ID");
  }
  return sheet;
}

/** หาเลขแถวจาก ID คืน -1 ถ้าไม่พบ */
function findActivityRowById(sheet, id) {
  if (!id) return -1;
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return i + 2;
  }
  return -1;
}

function activityRow(a) {
  return [
    a.id || "",
    a.date || "",
    a.username || "",
    a.fullName || "",
    a.nickname || "",
    a.club || "",
    a.category || "",
    a.activityName || "",
    a.hours || 0,
    a.minutes || 0,
    a.totalMinutes || 0,
    a.description || ""
  ];
}

/* ============================================================
 *  ส่วนที่เพิ่มใหม่ — คำสั่ง "อ่าน" ข้อมูลกลับไปให้แอป
 * ============================================================ */

/** แปลงวันที่ทุกรูปแบบในชีทให้เป็น ISO (YYYY-MM-DD) เพื่อให้ตัวกรองในแอปทำงานได้ */
function toIso(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss");
  }
  var raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;

  // รองรับ d/m/yyyy, d/m/yy และปี พ.ศ. เช่น 1/4/2569 หรือ 01/04/26:17/00/00
  var m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    var d = ("0" + m[1]).slice(-2);
    var mo = ("0" + m[2]).slice(-2);
    var y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (y > 2500) y -= 543;
    return y + "-" + mo + "-" + d;
  }
  return raw;
}

/** อ่านกิจกรรมทั้งหมด แล้วส่งกลับเป็นชื่อฟิลด์ที่แอปเข้าใจ */
function readActivities(ss) {
  var sheet = ss.getSheetByName(TAB_ACTIVITY) || ss.getSheetByName("ชีต8");
  if (!sheet || sheet.getLastRow() < 2) return [];

  var width = ACTIVITY_HEADER.length;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  var out = [];

  rows.forEach(function (r) {
    if (!r[0] && !r[3]) return; // ข้ามแถวว่าง
    var iso = toIso(r[1]);
    out.push({
      id: String(r[0] || ""),
      date: r[1] || "",
      timestamp: iso,
      username: String(r[2] || ""),
      fullName: r[3] || "",
      nickname: r[4] || "",
      club: r[5] || "",
      category: r[6] || "",
      activityName: r[7] || "",
      hours: Number(r[8]) || 0,
      minutes: Number(r[9]) || 0,
      totalMinutes: Number(r[10]) || 0,
      description: r[11] || ""
    });
  });

  return out;
}

/** อ่านผลโหวต (แท็บเดิมไม่มีคอลัมน์ ID จึงสร้าง ID จากเลขแถวให้) */
function readVotes(ss) {
  var sheet = ss.getSheetByName(TAB_VOTES);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, VOTE_HEADER.length).getValues();
  var out = [];

  rows.forEach(function (r, i) {
    // r = [Timestamp, Voter, Category, Nominee, VoteMonth]
    if (!r[1] && !r[3]) return;
    var iso = toIso(r[0]);
    out.push({
      id: "vote-row-" + (i + 2),
      timestamp: iso,
      voter: r[1] || "",
      category: r[2] || "",
      nominee: r[3] || "",
      voteMonth: r[4] || (iso ? iso.substring(0, 7) : "")
    });
  });

  return out;
}

function voteRow(v) {
  var iso = toIso(v.timestamp) || new Date().toISOString();
  return [
    v.timestamp || iso,
    v.voter || "",
    v.category || "",
    v.nominee || "",
    v.voteMonth || iso.substring(0, 7)
  ];
}

/**
 * อ่านแผนพัฒนา/Coaching
 * แท็บนี้เป็นแบบ append (บันทึกซ้ำได้หลายแถวต่อคน) จึงยึด "แถวล่าสุดของแต่ละรหัสพนักงาน"
 */
function readCoaching(ss) {
  var sheet = ss.getSheetByName(TAB_COACHING)
           || ss.getSheetByName("Coaching")
           || ss.getSheetByName("Coaching Logs");
  if (!sheet || sheet.getLastRow() < 2) return [];

  var width = Math.min(sheet.getLastColumn(), COACHING_HEADER.length);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  var byEmp = {};

  rows.forEach(function (r) {
    var empId = String(r[1] || "").trim();
    if (!empId) return;
    var progressRaw = String(r[15] || "0").replace("%", "").trim();
    byEmp[empId] = {
      id: "coach-" + empId,
      empId: empId,
      fullName: r[2] || "",
      nickname: r[3] || "",
      position: r[4] || "",
      contractType: r[5] || "",
      animalType: r[6] || "",
      coachName: r[7] || "",
      hoursW1: Number(r[8]) || 0,
      hoursW2: Number(r[9]) || 0,
      hoursW3: Number(r[10]) || 0,
      hoursW4: Number(r[11]) || 0,
      hoursW5: Number(r[12]) || 0,
      hoursW6: Number(r[13]) || 0,
      totalHours: Number(r[14]) || 0,
      progressPercent: Number(progressRaw) || 0
    };
  });

  var out = [];
  for (var k in byEmp) { if (byEmp.hasOwnProperty(k)) out.push(byEmp[k]); }
  return out;
}

/** ผังองค์กรเก็บเป็น JSON ก้อนเดียวในเซลล์ (key/value) */
function readOrgChart(ss) {
  var sheet = ss.getSheetByName(TAB_ORGCHART);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === "config") {
      try { return JSON.parse(rows[i][1]); } catch (e) { return null; }
    }
  }
  return null;
}

function writeOrgChart(ss, blob) {
  var sheet = getTab(ss, TAB_ORGCHART, ["key", "value", "updatedAt"]);
  var last = sheet.getLastRow();
  var keys = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var row = ["config", JSON.stringify(blob), new Date().toISOString()];
  var idx = keys.indexOf("config");
  if (idx === -1) sheet.appendRow(row);
  else sheet.getRange(idx + 2, 1, 1, 3).setValues([row]);
}

/* ============================================================ */

function handleRequest(e) {
  try {
    var ss = getSpreadsheet();

    var contents = (e && e.postData) ? e.postData.contents : null;
    var data = null;
    if (contents) {
      try { data = JSON.parse(contents); } catch (err) {}
    } else if (e && e.parameter && e.parameter.data) {
      try { data = JSON.parse(e.parameter.data); } catch (err) {}
    }

    // รองรับการเรียกแบบพิมพ์ URL ตรงๆ เช่น ...exec?action=audit
    // (เดิมต้องส่ง ?data={"action":"audit"} ซึ่งวงเล็บปีกกาและอัญประกาศมักถูกตัดทิ้ง
    //  ระหว่าง redirect ของ Google ทำให้สคริปต์ได้รับค่าว่างและตอบว่า "ไม่มีข้อมูลส่งมา")
    if (!data && e && e.parameter && e.parameter.action) {
      data = { action: e.parameter.action };
    }

    // เปิด URL เปล่าๆ ในเบราว์เซอร์ = แสดงรายงานตรวจสอบ (audit) ให้เลย
    // ทำแบบนี้เพราะพารามิเตอร์ท้าย URL มักถูกตัดทิ้งระหว่าง redirect ของ Google
    // audit เป็นคำสั่งอ่านอย่างเดียว ไม่แก้ไขข้อมูลใดๆ จึงปลอดภัยที่จะเป็นค่าเริ่มต้น
    if (!data) {
      data = { action: "audit" };
    }

    var action = data.action || "";

    /* ---------- คำสั่งอ่าน (ที่ขาดไปในเวอร์ชันเดิม) ---------- */

    if (action === "get_activities") {
      return json({ success: true, data: readActivities(ss) });
    }
    if (action === "get_votes") {
      return json({ success: true, data: readVotes(ss) });
    }
    if (action === "get_coaching") {
      return json({ success: true, data: readCoaching(ss) });
    }
    if (action === "get_orgchart") {
      return json({ success: true, data: readOrgChart(ss) });
    }
    if (action === "get_all") {
      return json({
        success: true,
        data: {
          activities: readActivities(ss),
          votes: readVotes(ss),
          coaching: readCoaching(ss),
          orgChart: readOrgChart(ss)
        }
      });
    }
    /**
     * ตรวจสอบความตรงกันของทุกแท็บ
     * เทียบ "จำนวนแถวในชีท" กับ "จำนวนรายการที่ระบบจะเห็นจริง"
     * ถ้าไม่เท่ากัน แปลว่ามี ID ซ้ำ ระบบจะยุบรวมเป็นรายการเดียว ทำให้ข้อมูลหาย
     */
    if (action === "audit") {
      var shAu = ss.getSheetByName(TAB_ACTIVITY) || ss.getSheetByName("ชีต8");
      var actRows = (shAu && shAu.getLastRow() > 1) ? shAu.getLastRow() - 1 : 0;
      var acts = readActivities(ss);
      var seen = {}, dupIds = {};
      acts.forEach(function (a) {
        if (seen[a.id]) dupIds[a.id] = (dupIds[a.id] || 1) + 1;
        seen[a.id] = true;
      });
      var dupList = [];
      for (var d in dupIds) { if (dupIds.hasOwnProperty(d)) dupList.push({ id: d, count: dupIds[d] }); }

      var shVo = ss.getSheetByName(TAB_VOTES);
      var shCo = ss.getSheetByName(TAB_COACHING);

      return json({
        success: true,
        nextStep: dupList.length > 0
          ? "พบ ID ซ้ำ — เปิด Apps Script Editor เลือกฟังก์ชัน RUN_ซ่อมIDซ้ำ จากดรอปดาวน์ แล้วกดเรียกใช้ (Run)"
          : "ข้อมูลตรงกันดีแล้ว ไม่ต้องซ่อมอะไร",
        data: {
          activities: {
            rowsInSheet: actRows,
            uniqueRecords: Object.keys(seen).length,
            duplicateIds: dupList,
            note: dupList.length > 0
              ? "พบ ID ซ้ำ ระบบจะเห็นแค่ " + Object.keys(seen).length + " รายการจาก " + actRows + " แถว — เรียก action fix_duplicate_ids เพื่อซ่อม"
              : "ตรงกันดี"
          },
          votes: {
            rowsInSheet: (shVo && shVo.getLastRow() > 1) ? shVo.getLastRow() - 1 : 0,
            uniqueRecords: readVotes(ss).length
          },
          coaching: {
            rowsInSheet: (shCo && shCo.getLastRow() > 1) ? shCo.getLastRow() - 1 : 0,
            uniqueRecords: readCoaching(ss).length,
            note: "แท็บนี้บันทึกแบบต่อท้าย ระบบยึดแถวล่าสุดของแต่ละรหัสพนักงาน จำนวนจึงน้อยกว่าแถวได้เป็นปกติ"
          }
        }
      });
    }

    /**
     * ซ่อม ID ซ้ำในแท็บกิจกรรม
     * แถวแรกของแต่ละ ID เก็บไว้เหมือนเดิม แถวที่ซ้ำจะได้ ID ใหม่ที่ไม่ซ้ำใคร
     * ทำให้ทุกแถวในชีทถูกนับเป็นรายการแยกกันอย่างถูกต้อง (ไม่มีข้อมูลหาย)
     */
    if (action === "fix_duplicate_ids") {
      var shFix = ss.getSheetByName(TAB_ACTIVITY) || ss.getSheetByName("ชีต8");
      if (!shFix || shFix.getLastRow() < 2) {
        return json({ success: true, message: "ไม่มีข้อมูลให้ซ่อม", data: { fixed: 0 } });
      }
      var lastR = shFix.getLastRow();
      var idRange = shFix.getRange(2, 1, lastR - 1, 1);
      var idVals = idRange.getValues();
      var used = {}, fixed = 0;

      for (var i = 0; i < idVals.length; i++) {
        var cur = String(idVals[i][0] || "").trim();
        if (!cur || used[cur]) {
          var fresh = "act-" + new Date().getTime() + "-" + i + "-" +
                      Math.random().toString(36).substring(2, 8);
          idVals[i][0] = fresh;
          used[fresh] = true;
          fixed++;
        } else {
          used[cur] = true;
        }
      }

      idRange.setValues(idVals);
      return json({
        success: true,
        message: "ซ่อม ID ซ้ำเรียบร้อย " + fixed + " แถว — ตอนนี้ทั้งหมด " + idVals.length + " แถวจะแสดงครบในระบบ",
        data: { fixed: fixed, totalRows: idVals.length }
      });
    }

    if (action === "setup_sheets") {
      getActivityTab(ss);
      getTab(ss, TAB_VOTES, VOTE_HEADER);
      getTab(ss, TAB_COACHING, COACHING_HEADER);
      getTab(ss, TAB_ORGCHART, ["key", "value", "updatedAt"]);
      return json({
        success: true,
        message: "ตรวจสอบและสร้างแท็บครบแล้ว",
        data: {
          activities: readActivities(ss).length,
          votes: readVotes(ss).length,
          coaching: readCoaching(ss).length
        }
      });
    }

    /* ---------- คำสั่งเขียน (ของเดิม คงไว้ทั้งหมด) ---------- */

    // 1) ผลประเมิน CSI
    if (action === "add_csi" || data.csiRecord) {
      var csi = data.csiRecord || data;
      // เขียนลงไฟล์ CSI โดยตรง (ดูคำอธิบายที่ CSI_SPREADSHEET_ID)
      var csiSs = ss;
      try {
        if (CSI_SPREADSHEET_ID && CSI_SPREADSHEET_ID !== SPREADSHEET_ID) {
          csiSs = SpreadsheetApp.openById(CSI_SPREADSHEET_ID);
        }
      } catch (errCsi) {
        return json({
          success: false,
          message: "เปิดไฟล์ CSI ไม่ได้ (ตรวจสอบสิทธิ์เข้าถึงไฟล์): " + errCsi.toString()
        });
      }
      var sh = getTab(csiSs, TAB_CSI);
      sh.appendRow([
        csi.timestamp || new Date().toLocaleString("th-TH"),
        csi.site || "PTP",
        csi.division || "Biomedical Engineering",
        csi.dept || "",
        csi.staffName || "",
        csi.contactType || "",
        csi.use_service1 || "ใช้บริการ",
        csi.q1_1 || 5, csi.q1_2 || 5, csi.q1_3 || 5, csi.q1_4 || 5,
        csi.q1_5 || 5, csi.q1_6 || 5, csi.q1_7 || 5,
        csi.use_service2 || "ใช้บริการ",
        csi.q2_1 || 5, csi.q2_2 || 5, csi.q2_3 || 5, csi.q2_4 || 5, csi.q2_5 || 5,
        csi.goodStaff || "",
        csi.goodReason || "",
        csi.badStaff || "",
        csi.badReason || "",
        csi.extraNote || ""
      ]);
      return json({ success: true, message: "บันทึกการประเมิน CSI สำเร็จ" });
    }

    // 2) Coaching — รับทั้งแบบรายการเดียว (ของเดิม) และแบบ array จากแอป (เพิ่มใหม่)
    if (action === "sync_coaching" && data.coachingRecords) {
      var shCs = getTab(ss, TAB_COACHING, COACHING_HEADER);
      data.coachingRecords.forEach(function (c) {
        shCs.appendRow([
          new Date().toLocaleString("th-TH"),
          c.empId || "", c.fullName || "", c.nickname || "", c.position || "",
          c.contractType || "", c.animalType || "", c.coachName || "",
          c.hoursW1 || 0, c.hoursW2 || 0, c.hoursW3 || 0,
          c.hoursW4 || 0, c.hoursW5 || 0, c.hoursW6 || 0,
          c.totalHours || 0, (c.progressPercent || 0) + "%"
        ]);
      });
      return json({ success: true, message: "บันทึก Coaching " + data.coachingRecords.length + " รายการแล้ว" });
    }

    if (action === "update_coaching" || action === "save_coaching" || data.coachingRecord) {
      var c = data.coachingRecord || data;
      var shC = ss.getSheetByName(TAB_COACHING)
             || ss.getSheetByName("Coaching")
             || ss.getSheetByName("Coaching Logs");
      if (!shC) {
        shC = ss.insertSheet(TAB_COACHING);
        shC.appendRow(COACHING_HEADER);
      }
      shC.appendRow([
        new Date().toLocaleString("th-TH"),
        c.empId || "", c.fullName || "", c.nickname || "", c.position || "",
        c.contractType || "", c.animalType || "", c.coachName || "",
        c.hoursW1 || 0, c.hoursW2 || 0, c.hoursW3 || 0,
        c.hoursW4 || 0, c.hoursW5 || 0, c.hoursW6 || 0,
        c.totalHours || 0, (c.progressPercent || 0) + "%"
      ]);
      return json({ success: true, message: "บันทึกข้อมูล Coaching เรียบร้อยแล้ว" });
    }

    // 3) โหวต — รับทั้งแบบรายการเดียว (ของเดิม) และแบบ array จากแอป (เพิ่มใหม่)
    if (action === "sync_votes" && data.votes) {
      var shVs = getTab(ss, TAB_VOTES, VOTE_HEADER);
      data.votes.forEach(function (v) { shVs.appendRow(voteRow(v)); });
      return json({ success: true, message: "บันทึกผลโหวต " + data.votes.length + " รายการแล้ว" });
    }

    if (action === "add_vote" || data.voteRecord) {
      var v = data.voteRecord || data;
      var shV = getTab(ss, TAB_VOTES, VOTE_HEADER);
      shV.appendRow(voteRow(v));
      return json({ success: true, message: "บันทึกผลโหวตสำเร็จ" });
    }

    // 4) ผังองค์กร (เพิ่มใหม่)
    if (action === "sync_orgchart") {
      writeOrgChart(ss, data.orgChart);
      return json({ success: true, message: "บันทึกผังองค์กรเรียบร้อยแล้ว" });
    }

    // 5) กิจกรรม - เพิ่ม/แก้ไขหลายรายการ (sync_activities)
    //    รองรับ deleted: true = ลบรายการนั้นออกจากชีท (ลบข้ามเครื่องได้)
    if (data.activities && data.activities.length > 0) {
      var shA = getActivityTab(ss);
      var added = 0, updated = 0, removed = 0;
      data.activities.forEach(function (a) {
        var row = findActivityRowById(shA, a.id);
        if (a.deleted) {
          if (row > 0) { shA.deleteRow(row); removed++; }
          return;
        }
        if (row > 0) {
          shA.getRange(row, 1, 1, ACTIVITY_HEADER.length).setValues([activityRow(a)]);
          updated++;
        } else {
          shA.appendRow(activityRow(a));
          added++;
        }
      });
      return json({
        success: true,
        message: "บันทึกกิจกรรมสำเร็จ (เพิ่ม " + added + " แก้ไข " + updated + " ลบ " + removed + ")"
      });
    }

    // 6) กิจกรรม - เพิ่มรายการเดียว
    if (action === "add_activity") {
      var shAdd = getActivityTab(ss);
      if (findActivityRowById(shAdd, data.id) > 0) {
        return json({ success: true, message: "รายการนี้มีอยู่แล้ว" });
      }
      shAdd.appendRow(activityRow(data));
      return json({ success: true, message: "บันทึกกิจกรรมสำเร็จ" });
    }

    // 7) กิจกรรม - แก้ไขย้อนหลัง
    if (action === "update_activity") {
      var shU = getActivityTab(ss);
      var rowU = findActivityRowById(shU, data.id);
      if (rowU > 0) {
        shU.getRange(rowU, 1, 1, ACTIVITY_HEADER.length).setValues([activityRow(data)]);
        return json({ success: true, message: "แก้ไขกิจกรรมเรียบร้อยแล้ว" });
      }
      shU.appendRow(activityRow(data));
      return json({ success: true, message: "ไม่พบรายการเดิม จึงบันทึกเป็นรายการใหม่" });
    }

    // 8) กิจกรรม - ลบ
    if (action === "delete_activity") {
      var shD = getActivityTab(ss);
      var rowD = findActivityRowById(shD, data.id);
      if (rowD > 0) {
        shD.deleteRow(rowD);
        return json({ success: true, message: "ลบกิจกรรมเรียบร้อยแล้ว" });
      }
      return json({ success: false, message: "ไม่พบรายการที่ต้องการลบ" });
    }

    // Fallback ที่ปลอดภัย — ไม่เขียนอะไรลงชีท
    return json({
      success: false,
      message: "ไม่รู้จัก action: " + (action || "(ไม่ระบุ)") + " จึงไม่บันทึกข้อมูลใดๆ"
    });

  } catch (err) {
    return json({ success: false, message: "ERROR: " + err.toString() });
  }
}
