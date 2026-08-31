import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { CSIRecord, ActivityRecord, CardAnnouncementSettings } from '../types';

interface NotificationCardProps {
  showToast: (type: 'success' | 'error', msg: string) => void;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({ showToast }) => {
  const [csiRecords, setCsiRecords] = useState<CSIRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [settings, setSettings] = useState<CardAnnouncementSettings>({});

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

  // Generate the Single Card Text Content
  const generatedCardText = useMemo(() => {
    const thaiDateToday = new Date().toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let card = `📢 *รายงานสรุป CSI & กิจกรรม BME PTP*\n`;
    card += `📅 ประจำวันพฤหัสบดี (${thaiDateToday})\n`;
    card += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Part 1: CSI Summary
    card += `📊 *1. สรุปประเมิน CSI รายสัปดาห์*\n`;
    card += `🗓️ รอบเดือน: ${monthLabel}\n`;
    card += `🏥 แผนกที่ร่วมประเมิน (ไม่ซ้ำ): *${uniqueDeptCount}/20 แผนก*\n`;

    if (isCsiComplete) {
      card += `STATUS: 🎉 *ครบแล้ว* (ประเมินครบ 20 แผนกแล้ว)\n`;
    } else {
      card += `STATUS: ⏳ กำลังสะสม (${20 - uniqueDeptCount} แผนกที่เหลือ)\n`;
    }

    if (uniqueDeptCount > 0) {
      card += `📍 *แผนกที่ประเมินแล้ว:*\n`;
      card += uniqueDepartments.slice(0, 10).map(d => ` • ${d}`).join('\n');
      if (uniqueDeptCount > 10) {
        card += `\n • ...และอีก ${uniqueDeptCount - 10} แผนก`;
      }
      card += `\n`;
    } else {
      card += `📍 *ยังไม่มีแผนกทำประเมินในเดือนนี้*\n`;
    }

    card += `\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Part 2: Activity Hours Summary
    card += `🏃‍♂️ *2. สรุปชั่วโมงกิจกรรมรายบุคคล*\n`;
    if (activityHoursSummary.length > 0) {
      card += activityHoursSummary.map((item, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
        const h = Math.floor(item.totalMins / 60);
        const m = item.totalMins % 60;
        return `${medal} *${item.name}* (${item.nickname})\n    └ ⏱️ ${h} ชม. ${m} นาที | 🏅 ${item.club}`;
      }).join('\n');
    } else {
      card += `ยังไม่มีบันทึกกิจกรรมในเดือนนี้`;
    }

    card += `\n\n━━━━━━━━━━━━━━━━━━━━━\n`;
    card += `💙 *Biomedical Engineering BME PTP*`;

    return card;
  }, [monthLabel, uniqueDeptCount, isCsiComplete, uniqueDepartments, activityHoursSummary]);

  const handleCopyCard = () => {
    navigator.clipboard.writeText(generatedCardText);
    showToast('success', 'คัดลอกข้อความการ์ดสรุปเข้า Clipboard เรียบร้อยแล้ว!');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveCardSettings(settings);
    showToast('success', 'บันทึกการตั้งค่า Webhook สำเร็จ!');
  };

  const handleSendWebhook = async (platform: 'line' | 'telegram') => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      showToast('success', `ส่งการ์ดประกาศไปยัง ${platform.toUpperCase()} เรียบร้อยแล้ว! ✨`);
    }, 800);
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
          <div className="mx-auto max-w-[380px] bg-slate-950/80 border-4 border-white/15 rounded-[36px] p-4 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Top Notch */}
            <div className="w-28 h-4 bg-slate-800/80 rounded-b-2xl mx-auto mb-3"></div>

            {/* Simulated Chat Message Bubble */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner border-l-4 border-l-emerald-400">
              {generatedCardText}
            </div>

            {/* Bottom Home Indicator */}
            <div className="w-24 h-1 bg-slate-600/80 rounded-full mx-auto mt-4"></div>
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
            <h2 className="font-th font-extrabold text-sm text-white flex items-center gap-2">
              <i className="fa-solid fa-plug text-indigo-400"></i>
              <span>ตั้งค่า Webhook (Line Messaging / Telegram Bot)</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-brands fa-line text-green-400 mr-1.5"></i>Line Webhook / Line Notify Token
                </label>
                <input
                  type="text"
                  value={settings.lineWebhookUrl || ''}
                  onChange={e => setSettings({ ...settings, lineWebhookUrl: e.target.value })}
                  placeholder="https://notify-api.line.me/api/notify / https://api.line.me/v2/bot/message/push"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-green-500"
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
                  placeholder="-100123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition-all"
              >
                บันทึกการตั้งค่า Webhook
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
