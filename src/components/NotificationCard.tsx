import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { CSIRecord, ActivityRecord, CardAnnouncementSettings, Employee } from '../types';
import { isAuthorizedAdminUser } from '../data/initialData';

interface NotificationCardProps {
  currentUser?: Employee | null;
  showToast: (type: 'success' | 'error', msg: string) => void;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({ currentUser, showToast }) => {
  const [csiRecords, setCsiRecords] = useState<CSIRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [settings, setSettings] = useState<CardAnnouncementSettings>({});

  const isAuthorized = isAuthorizedAdminUser(currentUser);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const [isSending, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCsiRecords(StorageService.getCSIRecords());
    setActivities(StorageService.getActivities());
    setSettings(StorageService.getCardSettings());
  }, []);

  // Filter CSI records for the selected month
  const monthCsiRecords = useMemo(() => {
    return csiRecords.filter(r => {
      const d = new Date(r.timestamp);
      if (isNaN(d.getTime())) return false;
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mKey === selectedMonth;
    });
  }, [csiRecords, selectedMonth]);

  // Unique departments for CSI (Requirement 6.1)
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    monthCsiRecords.forEach(r => {
      if (r.dept && r.dept.trim()) {
        set.add(r.dept.trim());
      }
    });
    return Array.from(set);
  }, [monthCsiRecords]);

  const uniqueDeptCount = uniqueDepartments.length;
  const isCsiComplete = uniqueDeptCount >= 20;

  // Filter Activities for selected month
  const monthActivities = useMemo(() => {
    return activities.filter(a => {
      const d = new Date(a.timestamp);
      if (isNaN(d.getTime())) return false;
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mKey === selectedMonth;
    });
  }, [activities, selectedMonth]);

  // Summary activity hours per employee (Requirement 6.2)
  const activityHoursSummary = useMemo(() => {
    const map: { [key: string]: { name: string; nickname: string; totalMins: number; club: string } } = {};

    monthActivities.forEach(a => {
      const key = `${a.fullName} (${a.nickname})`;
      if (!map[key]) {
        map[key] = {
          name: a.fullName,
          nickname: a.nickname,
          totalMins: 0,
          club: a.club
        };
      }
      map[key].totalMins += a.totalMinutes;
    });

    return Object.values(map).sort((a, b) => b.totalMins - a.totalMins);
  }, [monthActivities]);

  // Format the Thai month name
  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    const monthNames = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${monthNames[parseInt(m)] || m} ${y}`;
  }, [selectedMonth]);

  // Calculate Top 3 BME Staff with highest CSI evaluations in the selected month
  const top3BmeStaff = useMemo(() => {
    const map: { [name: string]: { name: string; count: number; totalScore: number; scoreCount: number } } = {};

    monthCsiRecords.forEach(r => {
      const names = new Set<string>();
      if (r.staffName && r.staffName.trim() && r.staffName !== '-' && r.staffName !== 'ไม่ระบุ') {
        names.add(r.staffName.trim());
      }
      if (r.goodStaff && r.goodStaff.trim() && r.goodStaff !== '-' && r.goodStaff !== 'ไม่ระบุ') {
        names.add(r.goodStaff.trim());
      }

      const scores = [
        r.q1_1, r.q1_2, r.q1_3, r.q1_4, r.q1_5, r.q1_6, r.q1_7,
        r.q2_1, r.q2_2, r.q2_3, r.q2_4, r.q2_5
      ].filter(s => typeof s === 'number' && s > 0);

      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;

      names.forEach(name => {
        if (!map[name]) {
          map[name] = { name, count: 0, totalScore: 0, scoreCount: 0 };
        }
        map[name].count += 1;
        map[name].totalScore += avgScore;
        map[name].scoreCount += 1;
      });
    });

    return Object.values(map)
      .map(item => ({
        name: item.name,
        count: item.count,
        avgRating: (item.totalScore / (item.scoreCount || 1)).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count || parseFloat(b.avgRating) - parseFloat(a.avgRating))
      .slice(0, 3);
  }, [monthCsiRecords]);

  // Generate the Single Card Text Content (Clean, Legible, Easy on the eyes)
  const generatedCardText = useMemo(() => {
    const thaiDateToday = new Date().toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let card = `📢 *รายงานสรุป CSI & กิจกรรม BME PTP*\n`;
    card += `📅 ประจำวันที่: ${thaiDateToday}\n`;
    card += `🗓️ รอบเดือน: ${monthLabel}\n`;
    card += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Part 1: CSI Summary
    card += `💖 *1. สรุปผลประเมิน CSI รายสัปดาห์*\n`;
    card += `🏥 แผนกที่ร่วมประเมิน (ไม่ซ้ำ): *${uniqueDeptCount}/20 แผนก*\n`;

    if (isCsiComplete) {
      card += `🎯 สถานะ: 🎉 *บรรลุเป้าหมายแล้ว!* (ประเมินครบ 20 แผนก)\n`;
    } else {
      card += `🎯 สถานะ: ⏳ *กำลังสะสม* (ขาดอีก ${20 - uniqueDeptCount} แผนก)\n`;
    }

    card += `\n🏆 *Top 3 BME ที่ได้รับประเมินสูงสุด:*\n`;
    if (top3BmeStaff.length > 0) {
      top3BmeStaff.forEach((item, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        const rankTitle = idx === 0 ? 'อันดับ 1' : idx === 1 ? 'อันดับ 2' : 'อันดับ 3';
        card += `${medal} *${rankTitle}:* ${item.name}\n   └ ⭐️ ได้รับประเมิน *${item.count} ครั้ง* (คะแนนเฉลี่ย ${item.avgRating}/5)\n`;
      });
    } else {
      card += `   💖 ยังไม่มีผลประเมินรายบุคคลในเดือนนี้\n`;
    }

    card += `\n─────────────────────\n\n`;

    // Part 2: Activity Hours Summary
    card += `🏃‍♂️ *2. สรุปชั่วโมงกิจกรรม Happy Life & HR-PTP*\n`;
    if (activityHoursSummary.length > 0) {
      activityHoursSummary.forEach((item, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
        const h = Math.floor(item.totalMins / 60);
        const m = item.totalMins % 60;
        card += `${medal} *${item.name}* (${item.nickname})\n   └ ⏱️ *${h} ชม. ${m} นาที* | 🏅 ${item.club}\n`;
      });
    } else {
      card += `🏃‍♀️ ยังไม่มีบันทึกกิจกรรมในเดือนนี้\n`;
    }

    card += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    card += `💙 *Biomedical Engineering (BME PTP)*`;

    return card;
  }, [monthLabel, uniqueDeptCount, isCsiComplete, top3BmeStaff, activityHoursSummary]);

  // Short Emoji Summary Card (Under 300 chars, rich with emojis, guaranteed to avoid LINE share HTTP 400 error)
  const generatedEmojiShortText = useMemo(() => {
    let card = `📢 สรุปผลงาน CSI & BME PTP\n`;
    card += `🗓️ รอบเดือน: ${monthLabel}\n`;
    card += `🎯 ความคืบหน้า CSI: ${uniqueDeptCount}/20 แผนก ${isCsiComplete ? '🎉 (บรรลุเป้าหมายแล้ว!)' : '⏳ (กำลังสะสม)'}\n`;

    if (top3BmeStaff.length > 0) {
      const top1 = top3BmeStaff[0];
      card += `🏆 Top 1 CSI: 🥇 ${top1.name} (ประเมิน ${top1.count} ครั้ง | ⭐ ${top1.avgRating}/5)\n`;
    }

    if (activityHoursSummary.length > 0) {
      const topAct = activityHoursSummary[0];
      const h = Math.floor(topAct.totalMins / 60);
      const m = topAct.totalMins % 60;
      card += `🏃‍♂️ Top กิจกรรม: 🥇 ${topAct.nickname || topAct.name} (${h} ชม. ${m} นาที)\n`;
    }

    card += `💙 Biomedical Engineering (BME PTP)`;
    return card;
  }, [monthLabel, uniqueDeptCount, isCsiComplete, top3BmeStaff, activityHoursSummary]);

  // Escape text for Telegram HTML parse_mode (only &, <, > need escaping in HTML mode)
  const escapeTgHtml = (s: string) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Telegram-specific message: uses <b>/<i> HTML tags (with parse_mode: 'HTML') instead of the
  // Markdown asterisks used elsewhere, and avoids long unbroken separator lines (━━━/─────) which
  // cannot word-wrap on a phone screen and were causing the message to overflow horizontally.
  const generatedTelegramText = useMemo(() => {
    const thaiDateToday = new Date().toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const lines: string[] = [];
    lines.push(`📢 <b>รายงานสรุป CSI &amp; กิจกรรม BME PTP</b>`);
    lines.push(`📅 ประจำวันที่: ${escapeTgHtml(thaiDateToday)}`);
    lines.push(`🗓️ รอบเดือน: ${escapeTgHtml(monthLabel)}`);
    lines.push('');
    lines.push(`💖 <b>1. สรุปผลประเมิน CSI รายสัปดาห์</b>`);
    lines.push(`🏥 แผนกที่ร่วมประเมิน (ไม่ซ้ำ): <b>${uniqueDeptCount}/20 แผนก</b>`);
    lines.push(
      isCsiComplete
        ? `🎯 สถานะ: 🎉 <b>บรรลุเป้าหมายแล้ว!</b> (ประเมินครบ 20 แผนก)`
        : `🎯 สถานะ: ⏳ กำลังสะสม (ขาดอีก ${20 - uniqueDeptCount} แผนก)`
    );
    lines.push('');
    lines.push(`🏆 <b>Top 3 BME ที่ได้รับประเมินสูงสุด</b>`);
    if (top3BmeStaff.length > 0) {
      top3BmeStaff.forEach((item, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        lines.push(`${medal} ${escapeTgHtml(item.name)} — ⭐ ${item.count} ครั้ง (เฉลี่ย ${item.avgRating}/5)`);
      });
    } else {
      lines.push('💖 ยังไม่มีผลประเมินรายบุคคลในเดือนนี้');
    }
    lines.push('');
    lines.push(`🏃‍♂️ <b>2. สรุปชั่วโมงกิจกรรม Happy Life &amp; HR-PTP</b>`);
    if (activityHoursSummary.length > 0) {
      activityHoursSummary.forEach((item, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
        const h = Math.floor(item.totalMins / 60);
        const m = item.totalMins % 60;
        lines.push(`${medal} ${escapeTgHtml(item.name)} (${escapeTgHtml(item.nickname)}) — ⏱ ${h} ชม. ${m} นาที · 🏅 ${escapeTgHtml(item.club)}`);
      });
    } else {
      lines.push('🏃‍♀️ ยังไม่มีบันทึกกิจกรรมในเดือนนี้');
    }
    lines.push('');
    lines.push(`💙 <i>Biomedical Engineering (BME PTP)</i>`);

    return lines.join('\n');
  }, [monthLabel, uniqueDeptCount, isCsiComplete, top3BmeStaff, activityHoursSummary]);

  // Generate official LINE Flex Message JSON structure (Matching Image 2 format)
  const generatedFlexJson = useMemo(() => {
    const thaiDateToday = new Date().toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const top3FlexContents: any[] = [];
    if (top3BmeStaff.length > 0) {
      top3BmeStaff.forEach((item, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        const rankTitle = idx === 0 ? 'อันดับ 1' : idx === 1 ? 'อันดับ 2' : 'อันดับ 3';
        top3FlexContents.push({
          type: 'box',
          layout: 'vertical',
          margin: 'sm',
          contents: [
            {
              type: 'text',
              text: `${medal} ${rankTitle}: ${item.name}`,
              weight: 'bold',
              size: 'xs',
              color: '#333333',
              wrap: true
            },
            {
              type: 'text',
              text: `└ ⭐ ได้รับประเมิน ${item.count} ครั้ง (คะแนนเฉลี่ย ${item.avgRating}/5)`,
              size: 'xxs',
              color: '#666666',
              margin: 'xs',
              wrap: true
            }
          ]
        });
      });
    } else {
      top3FlexContents.push({
        type: 'text',
        text: '   💖 ยังไม่มีผลประเมินรายบุคคลในเดือนนี้',
        size: 'xs',
        color: '#888888'
      });
    }

    const activityFlexContents: any[] = [];
    const MAX_FLEX_ACTIVITY_ROWS = 15; // keep the bubble well under LINE's flex message size limit
    if (activityHoursSummary.length > 0) {
      activityHoursSummary.slice(0, MAX_FLEX_ACTIVITY_ROWS).forEach((item, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
        const h = Math.floor(item.totalMins / 60);
        const m = item.totalMins % 60;
        activityFlexContents.push({
          type: 'box',
          layout: 'vertical',
          margin: 'sm',
          contents: [
            {
              type: 'text',
              text: `${medal} ${item.name} (${item.nickname})`,
              weight: 'bold',
              size: 'xs',
              color: '#333333',
              wrap: true
            },
            {
              type: 'text',
              text: `└ ⏱️ ${h} ชม. ${m} นาที | 🏅 ${item.club}`,
              size: 'xxs',
              color: '#666666',
              margin: 'xs',
              wrap: true
            }
          ]
        });
      });
      if (activityHoursSummary.length > MAX_FLEX_ACTIVITY_ROWS) {
        activityFlexContents.push({
          type: 'text',
          text: `…และอีก ${activityHoursSummary.length - MAX_FLEX_ACTIVITY_ROWS} คน (ดูรายละเอียดทั้งหมดที่แดชบอร์ด)`,
          size: 'xxs',
          color: '#999999',
          margin: 'sm'
        });
      }
    } else {
      activityFlexContents.push({
        type: 'text',
        text: '   🏃‍♀️ ยังไม่มีบันทึกกิจกรรมในเดือนนี้',
        size: 'xs',
        color: '#888888'
      });
    }

    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#00897b',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '📢 รายงานสรุป CSI & กิจกรรม BME PTP',
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
            wrap: true
          },
          {
            type: 'text',
            text: `📅 ประจำวันที่: ${thaiDateToday}`,
            color: '#E0F2F1',
            size: 'xs',
            margin: 'xs',
            wrap: true
          },
          {
            type: 'text',
            text: `🗓️ รอบเดือน: ${monthLabel}`,
            color: '#E0F2F1',
            size: 'xs',
            margin: 'none',
            wrap: true
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#E8F8F0',
            cornerRadius: 'md',
            paddingAll: 'md',
            contents: [
              {
                type: 'text',
                text: isCsiComplete
                  ? '✅ บรรลุเป้าหมายแล้ว! (ประเมินครบ 20 แผนก)'
                  : `⏳ กำลังสะสมประเมิน CSI: ${uniqueDeptCount}/20 แผนก (ขาดอีก ${20 - uniqueDeptCount} แผนก)`,
                weight: 'bold',
                color: '#0F5132',
                size: 'xs',
                wrap: true
              }
            ]
          },
          {
            type: 'separator',
            color: '#E0E0E0',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '💖 1. สรุปผลประเมิน CSI รายสัปดาห์',
                weight: 'bold',
                color: '#00897b',
                size: 'sm'
              },
              {
                type: 'text',
                text: `🏥 แผนกที่ร่วมประเมิน (ไม่ซ้ำ): ${uniqueDeptCount}/20 แผนก`,
                size: 'xs',
                color: '#333333',
                margin: 'xs'
              },
              {
                type: 'text',
                text: '🏆 Top 3 BME ที่ได้รับประเมินสูงสุด:',
                weight: 'bold',
                size: 'xs',
                color: '#555555',
                margin: 'sm'
              },
              ...top3FlexContents
            ]
          },
          {
            type: 'separator',
            color: '#E0E0E0',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '🏃‍♂️ 2. สรุปชั่วโมงกิจกรรม Happy Life & HR-PTP',
                weight: 'bold',
                color: '#00897b',
                size: 'sm'
              },
              ...activityFlexContents
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        contents: [
          {
            type: 'text',
            text: '💙 Biomedical Engineering (BME PTP)',
            align: 'center',
            color: '#00897b',
            weight: 'bold',
            size: 'xs'
          }
        ]
      }
    };
  }, [monthLabel, uniqueDeptCount, isCsiComplete, top3BmeStaff, activityHoursSummary]);

  const [previewMode, setPreviewMode] = useState<'flex' | 'text' | 'json'>('flex');

  const handleCopyCard = async () => {
    try {
      await navigator.clipboard.writeText(generatedCardText);
      showToast('success', 'คัดลอกข้อความการ์ดสรุปเข้า Clipboard เรียบร้อยแล้ว!');
    } catch {
      showToast('error', 'ไม่สามารถคัดลอกได้โดยอัตโนมัติ');
    }
  };

  const handleCopyFlexJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(generatedFlexJson, null, 2));
      showToast('success', 'คัดลอก Flex Message JSON เรียบร้อยแล้ว!');
    } catch {
      showToast('error', 'ไม่สามารถคัดลอกได้');
    }
  };

  const handleShareToLineApp = async () => {
    try {
      await navigator.clipboard.writeText(generatedCardText);
    } catch {
      // Ignore clipboard permission issues
    }
    const textToShare = generatedCardText.length > 500 ? generatedEmojiShortText : generatedCardText;
    const encodedText = encodeURIComponent(textToShare);
    const lineUrl = `https://line.me/R/msg/text/?${encodedText}`;
    window.open(lineUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'รายงานสรุป CSI & กิจกรรม BME PTP',
          text: generatedCardText
        });
        showToast('success', 'เปิดเมนูแชร์ของเครื่องเรียบร้อยแล้ว');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleShareToLineApp();
        }
      }
    } else {
      handleShareToLineApp();
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveCardSettings(settings);
    showToast('success', 'บันทึกการตั้งค่า Webhook สำเร็จ!');
  };

  const handleSendWebhook = async (platform: 'line' | 'telegram') => {
    if (platform === 'line') {
      const lineChannelToken = settings.lineChannelToken?.trim();
      const lineWebhookUrl = settings.lineWebhookUrl?.trim();
      
      if (!lineChannelToken && !lineWebhookUrl) {
        // Fallback to direct share link if no API key/Webhook is entered
        handleShareToLineApp();
        showToast('success', 'เปิดแอป LINE สำหรับส่งข้อความการ์ดประกาศเรียบร้อยแล้ว (เลือกกลุ่มหรือเพื่อนเพื่อส่งได้ทันที)');
        return;
      }

      setIsSubmitting(true);
      let isSuccess = false;
      let resultMsg = '';
      let backendUnreachable = false;

      // Try 1: Send via Server API /api/send-line
      // NOTE: LINE's official Messaging API (api.line.me) does not allow direct browser calls
      // (no CORS), so this server route is required for the Group/User ID + Channel Token method.
      try {
        const res = await fetch('/api/send-line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineChannelToken,
            lineWebhookUrl,
            lineGroupId: settings.lineGroupId?.trim(),
            lineUserId: settings.lineUserId?.trim(),
            message: generatedCardText,
            flexMessage: generatedFlexJson,
            flexAltText: 'รายงานสรุป CSI & กิจกรรม BME PTP'
          })
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || !contentType.includes('application/json')) {
          // The hosting environment isn't running the Node/Express backend (server.ts) —
          // e.g. it's serving only the static build — so /api/* routes don't exist at all.
          backendUnreachable = true;
          resultMsg = `ไม่พบเซิร์ฟเวอร์ backend (HTTP ${res.status}) — โฮสต์ปัจจุบันดูเหมือนจะรันเฉพาะไฟล์หน้าเว็บ (static) โดยไม่ได้รัน Node.js server (server.ts) จึงเรียก /api/send-line ไม่ได้เลย`;
        } else {
          const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
          if (res.ok && data.success) {
            isSuccess = true;
            resultMsg = data.message || 'ส่งการ์ดประกาศไปยัง LINE เรียบร้อยแล้ว!';
          } else {
            resultMsg = data.message || `ไม่สามารถส่งเข้า LINE ผ่าน API ได้ (HTTP ${res.status})`;
          }
        }
      } catch (err: any) {
        console.warn('/api/send-line server error:', err);
        backendUnreachable = true;
        resultMsg = `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ${err.message}`;
      }

      // Try 2: If server returned failure but lineWebhookUrl exists, try direct webhook call from browser.
      // IMPORTANT: this uses mode:'no-cors' so the browser CANNOT read the actual response —
      // "the request left the browser" is not the same as "LINE actually received it". We no
      // longer claim success here; we tell the person to verify in the LINE group instead of
      // showing a false-positive "sent successfully" message.
      let webhookAttempted = false;
      if (!isSuccess && lineWebhookUrl && lineWebhookUrl.startsWith('http')) {
        try {
          await fetch(lineWebhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: generatedCardText,
              flexMessage: generatedFlexJson,
              groupId: settings.lineGroupId?.trim(),
              userId: settings.lineUserId?.trim(),
              timestamp: new Date().toISOString()
            })
          });
          webhookAttempted = true;
        } catch (whErr: any) {
          console.warn('Direct Webhook error:', whErr);
        }
      }

      if (isSuccess) {
        showToast('success', resultMsg);
      } else if (webhookAttempted) {
        showToast(
          'success',
          'ส่งคำขอไปยัง LINE Webhook URL ที่ตั้งไว้แล้ว (เบราว์เซอร์ไม่สามารถยืนยันผลลัพธ์จริงจากปลายทางได้) — กรุณาเช็คในกลุ่ม/แชท LINE ว่าข้อความมาถึงจริงหรือไม่ ถ้าไม่มา แปลว่า Webhook URL นี้ยังไม่ได้ตั้งค่าให้ส่งต่อไปยัง LINE จริง'
        );
      } else if (backendUnreachable) {
        // Explain the real, fixable cause instead of a generic error, then fall back to manual share
        handleShareToLineApp();
        showToast(
          'error',
          `ส่งอัตโนมัติผ่าน Group/User ID ไม่ได้ เพราะวิธีนี้ต้องมีเซิร์ฟเวอร์ backend ทำงานอยู่ (${resultMsg}) — วิธีแก้: ให้แอดมินระบบตรวจสอบว่า deploy โดยรัน "npm start" (Node server) จริง ไม่ใช่แค่วางไฟล์ static เท่านั้น หรือใช้ช่อง "LINE Webhook URL" แทน โดยตั้งเป็น Google Apps Script/Make/n8n ที่ส่งต่อไปยัง LINE เอง ระหว่างนี้ระบบเปิดแอป LINE และคัดลอกข้อความให้แล้ว ส่งต่อได้ทันที`
        );
      } else {
        // Fallback to direct share in LINE app so user can send in 1 click
        handleShareToLineApp();
        showToast('error', `ไม่สามารถส่งอัตโนมัติได้ (${resultMsg}) - ระบบได้เปิดแอป LINE และคัดลอกข้อความให้คุณส่งต่อเรียบร้อยแล้ว`);
      }
      setIsSubmitting(false);
    } else if (platform === 'telegram') {
      const botToken = settings.telegramBotToken?.trim();
      const chatId = settings.telegramChatId?.trim();
      if (!botToken || !chatId) {
        showToast('error', 'กรุณาระบุ Telegram Bot Token และ Chat ID ก่อนกดส่ง');
        return;
      }

      setIsSubmitting(true);
      let isSuccess = false;
      let resultMsg = '';

      // Try Direct Telegram API Call from Browser (Bypasses server CORS & 404 completely)
      // parse_mode 'HTML' makes the <b>/<i> tags actually render as bold/italic instead of
      // showing raw markup, and the message itself avoids long unbroken separator lines so
      // it no longer overflows the screen width on mobile.
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: generatedTelegramText,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        });
        const tgData = await tgRes.json().catch(() => ({ ok: false }));
        if (tgData.ok) {
          isSuccess = true;
          resultMsg = 'ส่งข้อความเข้า Telegram Bot เรียบร้อยแล้ว!';
        } else if (tgData.description && /can't parse entities/i.test(tgData.description)) {
          // Extremely rare: a name/department contains characters that broke HTML parsing.
          // Retry once as plain text (no formatting) so the message still gets delivered.
          const plainRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: generatedCardText.replace(/\*/g, '') })
          });
          const plainData = await plainRes.json().catch(() => ({ ok: false }));
          if (plainData.ok) {
            isSuccess = true;
            resultMsg = 'ส่งข้อความเข้า Telegram Bot เรียบร้อยแล้ว! (ส่งเป็นข้อความธรรมดา)';
          } else {
            resultMsg = plainData.description || tgData.description;
          }
        } else {
          resultMsg = tgData.description || 'ไม่สามารถส่ง Telegram ได้ โปรดตรวจสอบ Bot Token & Chat ID';
        }
      } catch (tgErr: any) {
        console.warn('Direct Telegram fetch error, trying server proxy...', tgErr);
        // Fallback to server API
        try {
          const res = await fetch('/api/send-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botToken, chatId, message: generatedTelegramText, parseMode: 'HTML' })
          });
          const data = await res.json().catch(() => ({ success: false }));
          if (data.success) {
            isSuccess = true;
            resultMsg = data.message || 'ส่งข้อความเข้า Telegram Bot สำเร็จ!';
          }
        } catch (e: any) {
          resultMsg = `ไม่สามารถเชื่อมต่อส่ง Telegram ได้: ${e.message}`;
        }
      }

      if (isSuccess) {
        showToast('success', resultMsg);
      } else {
        showToast('error', resultMsg || 'ส่งไปยัง Telegram ไม่สำเร็จ โปรดตรวจสอบ Bot Token');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white text-2xl shadow-lg">
            <i className="fa-solid fa-paper-plane"></i>
          </div>
          <div>
            <h1 className="font-th font-extrabold text-xl text-white">ระบบสรุปการ์ดประกาศ Line & Telegram</h1>
            <p className="text-xs text-slate-400 font-medium">สรุป CSI รายสัปดาห์ (วันพฤหัส) & ชั่วโมงกิจกรรมรายบุคคลในการ์ด 1 ใบ</p>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">รอบเดือน:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-xl px-3 py-2 outline-none focus:border-green-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Column: Simulated Mobile Phone Card Preview */}
        <div className="glass-panel border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-th font-extrabold text-base text-white flex items-center gap-2">
              <i className="fa-solid fa-mobile-screen-button text-emerald-400"></i>
              <span>ตัวอย่างการ์ดประกาศ (พอดีหน้าจอโทรศัพท์)</span>
            </h2>
            <button
              onClick={handleCopyCard}
              className="glass-button px-3 py-1.5 rounded-xl text-white text-xs font-bold border border-emerald-400/30 flex items-center gap-1.5 transition-all"
            >
              <i className="fa-regular fa-copy"></i>
              <span>คัดลอกข้อความ</span>
            </button>
          </div>

          {/* Phone Mockup Frame */}
          <div className="mx-auto max-w-[380px] bg-slate-950 border-4 border-slate-800 rounded-[36px] p-4 shadow-2xl relative overflow-hidden space-y-3">
            {/* Top Notch */}
            <div className="w-28 h-4 bg-slate-900 rounded-b-2xl mx-auto mb-1 flex items-center justify-center">
              <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex items-center justify-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setPreviewMode('flex')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                  previewMode === 'flex'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <i className="fa-brands fa-line text-xs"></i>
                <span>LINE Flex</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('text')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                  previewMode === 'text'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <i className="fa-solid fa-align-left text-[10px]"></i>
                <span>ข้อความ</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('json')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                  previewMode === 'json'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <i className="fa-solid fa-code text-[10px]"></i>
                <span>JSON</span>
              </button>
            </div>

            {/* Preview Card */}
            {previewMode === 'flex' && (
              /* LINE Flex Message Card - Styled matching Image 2 */
              <div className="rounded-2xl border border-slate-300 bg-white overflow-hidden shadow-2xl text-slate-800 max-h-[440px] overflow-y-auto">
                {/* Header Banner - Deep Teal */}
                <div className="bg-[#00897b] text-white p-4 space-y-1 border-b border-[#00796b]">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📢</span>
                    <h3 className="font-extrabold text-sm text-white leading-tight">
                      รายงานสรุป CSI & กิจกรรม BME PTP
                    </h3>
                  </div>
                  <div className="text-[11px] text-teal-100 flex items-center gap-2 pt-0.5">
                    <span>📅 ประจำวันที่: {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="text-[11px] text-teal-100 flex items-center gap-2">
                    <span>🗓️ รอบเดือน: {monthLabel}</span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 space-y-3 bg-white text-xs">
                  {/* Status Banner Box */}
                  <div className={`p-3 rounded-xl border font-bold flex items-center gap-2 ${
                    isCsiComplete
                      ? 'bg-[#E8F8F0] border-[#a3e6cd] text-[#0F5132]'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <span className="text-sm">{isCsiComplete ? '✅' : '⏳'}</span>
                    <span>
                      {isCsiComplete
                        ? 'บรรลุเป้าหมายแล้ว! (ประเมินครบ 20 แผนก)'
                        : `กำลังสะสมประเมิน CSI: ${uniqueDeptCount}/20 แผนก (ขาดอีก ${20 - uniqueDeptCount} แผนก)`}
                    </span>
                  </div>

                  <hr className="border-slate-200" />

                  {/* Section 1: CSI Summary */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-[#00897b] text-xs flex items-center gap-1.5">
                      <span>💖</span>
                      <span>1. สรุปผลประเมิน CSI รายสัปดาห์</span>
                    </h4>

                    <div className="text-slate-700 pl-1">
                      <span>🏥 แผนกที่ร่วมประเมิน (ไม่ซ้ำ): </span>
                      <span className="font-extrabold text-slate-900">{uniqueDeptCount}/20 แผนก</span>
                    </div>

                    <div className="pt-1">
                      <div className="font-bold text-slate-600 text-[11px] mb-1">
                        🏆 Top 3 BME ที่ได้รับประเมินสูงสุด:
                      </div>

                      {top3BmeStaff.length > 0 ? (
                        <div className="space-y-2 pl-1">
                          {top3BmeStaff.map((item, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                            const rankTitle = idx === 0 ? 'อันดับ 1' : idx === 1 ? 'อันดับ 2' : 'อันดับ 3';
                            return (
                              <div key={idx} className="space-y-0.5">
                                <div className="font-bold text-slate-900 flex items-center gap-1">
                                  <span>{medal}</span>
                                  <span>{rankTitle}:</span>
                                  <span className="text-slate-800">{item.name}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 pl-5 font-mono">
                                  └ ⭐ ได้รับประเมิน <strong className="text-slate-800 font-bold">{item.count} ครั้ง</strong> (คะแนนเฉลี่ย {item.avgRating}/5)
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-slate-400 italic text-[11px] pl-2">
                          💖 ยังไม่มีผลประเมินรายบุคคลในเดือนนี้
                        </div>
                      )}
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  {/* Section 2: Activity Hours Summary */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-[#00897b] text-xs flex items-center gap-1.5">
                      <span>🏃‍♂️</span>
                      <span>2. สรุปชั่วโมงกิจกรรม Happy Life & HR-PTP</span>
                    </h4>

                    {activityHoursSummary.length > 0 ? (
                      <div className="space-y-2 pl-1">
                        {activityHoursSummary.map((item, idx) => {
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
                          const h = Math.floor(item.totalMins / 60);
                          const m = item.totalMins % 60;
                          return (
                            <div key={idx} className="space-y-0.5">
                              <div className="font-bold text-slate-900 flex items-center gap-1">
                                <span>{medal}</span>
                                <span>{item.name} ({item.nickname})</span>
                              </div>
                              <div className="text-[11px] text-slate-500 pl-5 font-mono">
                                └ ⏱️ <strong className="text-slate-800 font-bold">{h} ชม. {m} นาที</strong> | 🏅 {item.club}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic text-[11px] pl-2">
                        🏃‍♀️ ยังไม่มีบันทึกกิจกรรมในเดือนนี้
                      </div>
                    )}
                  </div>

                  <hr className="border-slate-200" />

                  {/* Footer */}
                  <div className="text-center font-extrabold text-[#00897b] text-[11px] pt-1">
                    💙 Biomedical Engineering (BME PTP)
                  </div>
                </div>
              </div>
            )}

            {previewMode === 'text' && (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900 p-4 shadow-xl">
                <div className="text-[12px] font-sans text-slate-100 whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto pr-1">
                  {generatedCardText}
                </div>
              </div>
            )}

            {previewMode === 'json' && (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900 p-3 shadow-xl">
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleCopyFlexJson}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold"
                  >
                    <i className="fa-regular fa-copy mr-1"></i>คัดลอก JSON
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-emerald-300 max-h-[380px] overflow-y-auto overflow-x-auto p-2 bg-slate-950 rounded-xl leading-tight select-all">
                  {JSON.stringify(generatedFlexJson, null, 2)}
                </pre>
              </div>
            )}

            {/* Direct Quick Actions under preview */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleShareToLineApp}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-th font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <i className="fa-brands fa-line text-lg"></i>
                <span>แชร์ไปยังแอป LINE โดยตรง</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                >
                  <i className="fa-solid fa-share-nodes text-emerald-400"></i>
                  <span>แชร์ผ่านมือถือ</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyFlexJson}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                >
                  <i className="fa-solid fa-code text-emerald-400"></i>
                  <span>คัดลอก Flex JSON</span>
                </button>
              </div>
            </div>

            {/* Bottom Home Indicator */}
            <div className="w-24 h-1 bg-slate-700 rounded-full mx-auto mt-2"></div>
          </div>
        </div>

        {/* Right Column: Rule Status & Webhook Actions */}
        <div className="space-y-6">

          {/* CSI Rule Status Box */}
          <div className="glass-panel border border-white/15 rounded-3xl p-5 shadow-xl space-y-4">
            <h2 className="font-th font-extrabold text-sm text-white flex items-center gap-2">
              <i className="fa-solid fa-circle-check text-emerald-400"></i>
              <span>สถานะเป้าหมาย 20 แผนก CSI ประจำเดือน</span>
            </h2>

            <div className="glass-card p-4 rounded-2xl border border-white/15 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">ความคืบหน้าสะสม:</span>
                <span className={`text-xs font-black px-3 py-1 rounded-full ${
                  isCsiComplete
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {isCsiComplete ? '🎉 ครบแล้ว (20/20)' : `${uniqueDeptCount} / 20 แผนก`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isCsiComplete ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (uniqueDeptCount / 20) * 100)}%` }}
                ></div>
              </div>

              <div className="text-[11px] text-slate-400">
                {isCsiComplete
                  ? '✨ ครบถ้วนตามเป้าหมาย 20 แผนกไม่ซ้ำประจำเดือนเรียบร้อยแล้ว!'
                  : `ขาดอีก ${20 - uniqueDeptCount} แผนก จะครบ 20 แผนกไม่ซ้ำประจำเดือน`}
              </div>
            </div>
          </div>

          {/* Webhook Configuration & Dispatch */}
          <form onSubmit={handleSaveSettings} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-th font-extrabold text-sm text-white flex items-center gap-2">
                <i className="fa-solid fa-plug text-indigo-400"></i>
                <span>ตั้งค่า Webhook (Line Messaging / Telegram Bot)</span>
              </h2>

              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                ✓ พร้อมกำหนดค่าการแจ้งเตือน
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-brands fa-line text-green-400 mr-1.5"></i>LINE Channel Access Token
                </label>
                <input
                  type="text"
                  value={settings.lineChannelToken || ''}
                  onChange={e => setSettings({ ...settings, lineChannelToken: e.target.value })}
                  placeholder="uiEPGyvhZMjFZkGPPejqVl8s..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px] outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    <i className="fa-solid fa-users text-green-400 mr-1.5"></i>LINE Group ID
                  </label>
                  <input
                    type="text"
                    value={settings.lineGroupId || ''}
                    onChange={e => setSettings({ ...settings, lineGroupId: e.target.value })}
                    placeholder="C1f1109f61de6683..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px] outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    <i className="fa-solid fa-user text-emerald-400 mr-1.5"></i>LINE User ID
                  </label>
                  <input
                    type="text"
                    value={settings.lineUserId || ''}
                    onChange={e => setSettings({ ...settings, lineUserId: e.target.value })}
                    placeholder="Ucbf8c9e32fc26..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px] outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-solid fa-link text-indigo-400 mr-1.5"></i>LINE Webhook URL
                </label>
                <input
                  type="text"
                  value={settings.lineWebhookUrl || ''}
                  onChange={e => setSettings({ ...settings, lineWebhookUrl: e.target.value })}
                  placeholder="https://script.google.com/macros/s/.../exec หรือ https://webhook.site/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px] outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-brands fa-telegram text-sky-400 mr-1.5"></i>Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={settings.telegramBotToken || ''}
                  onChange={e => setSettings({ ...settings, telegramBotToken: e.target.value })}
                  placeholder="123456789:ABCdefGhIJKlmNoPQrsTUVwxyZ"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-solid fa-hashtag text-sky-400 mr-1.5"></i>Telegram Chat ID
                </label>
                <input
                  type="text"
                  value={settings.telegramChatId || ''}
                  onChange={e => setSettings({ ...settings, telegramChatId: e.target.value })}
                  placeholder="-100123456789 หรือ @channel_name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-floppy-disk"></i>
                <span>บันทึกการตั้งค่า Webhook &amp; การแจ้งเตือน</span>
              </button>
            </div>

            <hr className="border-slate-800" />

            {/* Quick Dispatch Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSendWebhook('line')}
                disabled={isSending}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-th font-bold text-xs shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
              >
                <i className="fa-brands fa-line text-lg"></i>
                <span>ส่งการ์ดเข้า Line</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendWebhook('telegram')}
                disabled={isSending}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-th font-bold text-xs shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2"
              >
                <i className="fa-brands fa-telegram text-lg"></i>
                <span>ส่งการ์ดเข้า Telegram</span>
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
};
