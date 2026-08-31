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

  const handleCopyCard = async () => {
    try {
      await navigator.clipboard.writeText(generatedCardText);
      showToast('success', 'คัดลอกข้อความการ์ดสรุปเข้า Clipboard เรียบร้อยแล้ว! สามารถนำไปกดวาง (Paste) ใน LINE ได้ทันที');
    } catch {
      showToast('error', 'ไม่สามารถคัดลอกได้โดยอัตโนมัติ โปรดคลุมดำข้อความและคัดลอกด้วยตนเอง');
    }
  };

  const handleShareToLineApp = () => {
    const encodedText = encodeURIComponent(generatedCardText);
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
        showToast('success', 'เปิดแอป LINE สำหรับส่งข้อความการ์ดประกาศเรียบร้อยแล้ว (หรือใส่ Token ในการตั้งค่าเพื่อส่งอัตโนมัติ)');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await fetch('/api/send-line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineChannelToken,
            lineWebhookUrl,
            lineGroupId: settings.lineGroupId?.trim(),
            lineUserId: settings.lineUserId?.trim(),
            message: generatedCardText
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('success', data.message || 'ส่งการ์ดประกาศไปยัง LINE เรียบร้อยแล้ว!');
        } else {
          showToast('error', data.message || 'ส่งไปยัง LINE ไม่สำเร็จ โปรดตรวจสอบ Token หรือ Webhook URL');
        }
      } catch {
        showToast('error', 'ไม่สามารถเชื่อมต่อ Server เพื่อส่ง LINE ได้');
      } finally {
        setIsSubmitting(false);
      }
    } else if (platform === 'telegram') {
      const botToken = settings.telegramBotToken?.trim();
      const chatId = settings.telegramChatId?.trim();
      if (!botToken || !chatId) {
        showToast('error', 'กรุณาระบุ Telegram Bot Token และ Chat ID ก่อนกดส่ง');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await fetch('/api/send-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botToken,
            chatId,
            message: generatedCardText
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('success', data.message || 'ส่งการ์ดประกาศไปยัง Telegram เรียบร้อยแล้ว!');
        } else {
          showToast('error', data.message || 'ส่งไปยัง Telegram ไม่สำเร็จ โปรดตรวจสอบ Bot Token & Chat ID');
        }
      } catch {
        showToast('error', 'ไม่สามารถเชื่อมต่อ Server เพื่อส่ง Telegram ได้');
      } finally {
        setIsSubmitting(false);
      }
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

            {/* Simulated Chat Message Bubble - Clean Dark LINE Theme */}
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900 p-4 shadow-xl">
              <div className="text-[12px] font-sans text-slate-100 whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto pr-1">
                {generatedCardText}
              </div>
            </div>

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
                  onClick={handleCopyCard}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                >
                  <i className="fa-regular fa-copy text-amber-400"></i>
                  <span>คัดลอกข้อความ</span>
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

              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                isAuthorized
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {isAuthorized ? '✓ สิทธิ์ผู้ดูแลระบบ' : '🔒 จำกัดสิทธิ์เข้าถึง'}
              </span>
            </div>

            {!isAuthorized && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
                <i className="fa-solid fa-lock text-amber-400 text-base mt-0.5"></i>
                <div>
                  <strong>การตั้งค่าระบบถูกจำกัดสิทธิ์</strong>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    การแก้ไข Token, Webhook URL และ Chat ID สงวนสิทธิ์เฉพาะ 3 บัญชีผู้ใช้เท่านั้น: <span className="font-mono font-bold text-white">SPV_BME</span>, <span className="font-mono font-bold text-white">MGR_BME</span> และ <span className="font-mono font-bold text-white">563770</span>
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-brands fa-line text-green-400 mr-1.5"></i>LINE Channel Access Token
                </label>
                <input
                  type="text"
                  disabled={!isAuthorized}
                  value={settings.lineChannelToken || ''}
                  onChange={e => setSettings({ ...settings, lineChannelToken: e.target.value })}
                  placeholder="uiEPGyvhZMjFZkGPPejqVl8s..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px] outline-none focus:border-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    <i className="fa-solid fa-users text-green-400 mr-1.5"></i>LINE Group ID
                  </label>
                  <input
                    type="text"
                    disabled={!isAuthorized}
                    value={settings.lineGroupId || ''}
                    onChange={e => setSettings({ ...settings, lineGroupId: e.target.value })}
                    placeholder="C1f1109f61de6683..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px] outline-none focus:border-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    <i className="fa-solid fa-user text-emerald-400 mr-1.5"></i>LINE User ID
                  </label>
                  <input
                    type="text"
                    disabled={!isAuthorized}
                    value={settings.lineUserId || ''}
                    onChange={e => setSettings({ ...settings, lineUserId: e.target.value })}
                    placeholder="Ucbf8c9e32fc26..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px] outline-none focus:border-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-solid fa-link text-indigo-400 mr-1.5"></i>LINE Webhook URL
                </label>
                <input
                  type="text"
                  disabled={!isAuthorized}
                  value={settings.lineWebhookUrl || ''}
                  onChange={e => setSettings({ ...settings, lineWebhookUrl: e.target.value })}
                  placeholder="https://webhook.site/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px] outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-brands fa-telegram text-sky-400 mr-1.5"></i>Telegram Bot Token
                </label>
                <input
                  type="text"
                  disabled={!isAuthorized}
                  value={settings.telegramBotToken || ''}
                  onChange={e => setSettings({ ...settings, telegramBotToken: e.target.value })}
                  placeholder="123456789:ABCdefGhIJKlmNoPQrsTUVwxyZ"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  <i className="fa-solid fa-hashtag text-sky-400 mr-1.5"></i>Telegram Chat ID
                </label>
                <input
                  type="text"
                  disabled={!isAuthorized}
                  value={settings.telegramChatId || ''}
                  onChange={e => setSettings({ ...settings, telegramChatId: e.target.value })}
                  placeholder="-100123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono outline-none focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {isAuthorized && (
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition-all"
                >
                  บันทึกการตั้งค่า Webhook
                </button>
              )}
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
