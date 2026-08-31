import React, { useState, useEffect } from 'react';
import { CSIRecord, Employee } from '../types';
import { DEPARTMENTS } from '../data/initialData';
import { StorageService } from '../services/storage';

interface CSIFormProps {
  onSuccessSubmitted: () => void;
  showModal: (type: 'success' | 'warning', title: string, body: string) => void;
}

const LABELS_Q1 = [
  '1.1 ยิ้มแย้ม/ทักทาย',
  '1.2 ใส่ใจตอบสนอง',
  '1.3 ช่วยเหลือ/ติดตาม',
  '1.4 เสนอทางเลือก',
  '1.5 คุณภาพบริการ',
  '1.6 ตรงต่อเวลา',
  '1.7 มืออาชีพ'
];

const LABELS_Q2 = [
  '2.1 รวดเร็วรับสาย',
  '2.2 แจ้งชื่อหน่วยงาน',
  '2.3 น้ำเสียงสุภาพ',
  '2.4 เข้าใจรายละเอียด',
  '2.5 กล่าวอำลา'
];

const Q1_ICONS = ['fa-face-smile-beam', 'fa-hands-holding', 'fa-clipboard-check', 'fa-lightbulb', 'fa-certificate', 'fa-clock', 'fa-user-tie'];
const Q2_ICONS = ['fa-bolt', 'fa-id-badge', 'fa-microphone', 'fa-brain', 'fa-hand-peace'];

const EMOJIS = [
  { v: 1, e: '😡', tip: 'ไม่พอใจมาก' },
  { v: 2, e: '😕', tip: 'ไม่ค่อยพอใจ' },
  { v: 3, e: '😐', tip: 'ปานกลาง' },
  { v: 4, e: '😊', tip: 'พอใจมาก' },
  { v: 5, e: '🤩', tip: 'ดีเยี่ยม!' }
];

export const CSIForm: React.FC<CSIFormProps> = ({ onSuccessSubmitted, showModal }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [evaluatorName, setEvaluatorName] = useState('');
  const [selectedStaffKeys, setSelectedStaffKeys] = useState<Set<string>>(new Set());
  const [goodReason, setGoodReason] = useState('');
  const [badStaff, setBadStaff] = useState('');
  const [badReason, setBadReason] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [q1Scores, setQ1Scores] = useState<{ [key: number]: number }>({ 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 });
  const [q2Scores, setQ2Scores] = useState<{ [key: number]: number }>({ 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 });

  useEffect(() => {
    const emps = StorageService.getEmployees().filter(e => e.status === 'active');
    setEmployees(emps);
  }, []);

  const toggleStaff = (key: string) => {
    const next = new Set(selectedStaffKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedStaffKeys(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) {
      showModal('warning', 'ลืมเลือกแผนก!', 'กรุณาเลือกแผนกที่รับบริการ');
      return;
    }
    if (!evaluatorName.trim()) {
      showModal('warning', 'กรอกชื่อผู้ประเมิน', 'กรุณาระบุชื่อผู้รับบริการ/ผู้ประเมิน');
      return;
    }
    if (selectedStaffKeys.size === 0) {
      showModal('warning', 'ลืมเลือกพนักงาน!', 'กรุณาเลือกพนักงานที่คุณประทับใจอย่างน้อย 1 คนก่อนส่งข้อมูล');
      return;
    }

    setIsSubmitting(true);

    const goodStaffStr = Array.from(selectedStaffKeys).join(', ');

    const newRecord: CSIRecord = {
      timestamp: new Date().toISOString(),
      site: 'PTP',
      division: 'Biomedical Engineering',
      dept: selectedDept,
      staffName: evaluatorName.trim(),
      contactType: 'Walk-in / Direct',
      use_service1: 'ใช้บริการ',
      q1_1: q1Scores[1] || 5,
      q1_2: q1Scores[2] || 5,
      q1_3: q1Scores[3] || 5,
      q1_4: q1Scores[4] || 5,
      q1_5: q1Scores[5] || 5,
      q1_6: q1Scores[6] || 5,
      q1_7: q1Scores[7] || 5,
      use_service2: 'ใช้บริการ',
      q2_1: q2Scores[1] || 5,
      q2_2: q2Scores[2] || 5,
      q2_3: q2Scores[3] || 5,
      q2_4: q2Scores[4] || 5,
      q2_5: q2Scores[5] || 5,
      goodStaff: goodStaffStr,
      goodReason: goodReason.trim(),
      badStaff: badStaff.trim(),
      badReason: badReason.trim(),
      extraNote: extraNote.trim()
    };

    setTimeout(() => {
      StorageService.addCSIRecord(newRecord);
      setIsSubmitting(false);
      showModal('success', 'ส่งสำเร็จ! ✨', 'ได้รับความเห็นของคุณแล้ว ขอบคุณที่ช่วยให้เราพัฒนาได้ทุกวันครับ');
      
      // Reset
      setSelectedDept('');
      setEvaluatorName('');
      setSelectedStaffKeys(new Set());
      setGoodReason('');
      setBadStaff('');
      setBadReason('');
      setExtraNote('');
      
      onSuccessSubmitted();
    }, 600);
  };

  return (
    <div className="min-h-full pb-16 text-slate-100">
      {/* Hero Header */}
      <div className="relative bg-[url('https://img2.pic.in.th/170e4aed-be38-4647-a72d-cc519208d4c8.jpg')] bg-cover bg-center py-10 px-5 pb-14 text-center text-white">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20 mb-4 backdrop-blur-md shadow-xl">
            <i className="fa-solid fa-microchip text-3xl text-cyan-300"></i>
          </div>
          <h1 className="font-th font-extrabold text-3xl sm:text-4xl text-white tracking-tight">CSI BME PTP</h1>
          <div className="inline-block bg-slate-900/60 backdrop-blur-xl border border-white/15 rounded-2xl px-6 py-2.5 mt-3 shadow-2xl">
            <div className="font-th font-bold text-lg text-white">แบบประเมินความพึงพอใจการให้บริการ</div>
            <div className="text-xs text-cyan-300/90 font-semibold uppercase tracking-widest mt-0.5">หน่วยงานวิศวกรรมการแพทย์ (Biomedical Engineering)</div>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 -mt-7">
        <div className="max-w-4xl mx-auto glass-panel rounded-3xl shadow-2xl border border-white/15 p-6 sm:p-10">
          <form onSubmit={handleSubmit}>
            {/* Basic Info */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/80 to-purple-600/80 backdrop-blur-md flex items-center justify-center text-white shadow-md border border-white/20">
                <i className="fa-solid fa-user-gear text-lg"></i>
              </div>
              <div>
                <h2 className="font-th text-xl font-bold text-white">ข้อมูลพื้นฐาน</h2>
                <div className="text-[10px] text-indigo-300/70 font-bold uppercase tracking-wider">Basic Information</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  <i className="fa-solid fa-hospital text-indigo-400 mr-1.5"></i>แผนกที่รับบริการ <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-white/15 bg-slate-900/60 backdrop-blur-md font-semibold text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
                  required
                >
                  <option value="" className="bg-slate-900 text-slate-300">-- โปรดเลือกแผนก --</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d} className="bg-slate-900 text-white">{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  <i className="fa-solid fa-id-card text-indigo-400 mr-1.5"></i>ชื่อผู้รับบริการ / ผู้ประเมิน <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={evaluatorName}
                  onChange={(e) => setEvaluatorName(e.target.value)}
                  placeholder="เช่น พยาบาลสมหญิง / นายแพทย์วิชัย"
                  className="w-full px-4 py-3 rounded-xl border border-white/15 bg-slate-900/60 backdrop-blur-md font-semibold text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
                  required
                />
              </div>
            </div>

            <hr className="my-8 border-white/10" />

            {/* Section 1 */}
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/80 to-blue-600/80 backdrop-blur-md flex items-center justify-center text-white shadow-md border border-white/20">
                  <i className="fa-solid fa-hand-holding-medical text-lg"></i>
                </div>
                <div>
                  <h2 className="font-th text-base sm:text-lg font-bold text-white">ส่วนที่ 1: การติดต่อและเข้าให้บริการ ณ แผนก</h2>
                  <div className="text-xs text-slate-300/80 font-medium">ประเมินคุณภาพการให้บริการในพื้นที่</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-slate-200">
                <span className="text-rose-400">😡 1 = ไม่พอใจ</span>
                <span className="text-slate-500">|</span>
                <span className="text-cyan-300">🤩 5 = ดีเยี่ยม</span>
              </div>
            </div>

            <div className="space-y-2.5 mb-8">
              {LABELS_Q1.map((label, idx) => {
                const qNum = idx + 1;
                return (
                  <div key={qNum} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl glass-card border border-white/10 transition-colors gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-cyan-300 flex-shrink-0">
                        <i className={`fa-solid ${Q1_ICONS[idx]} text-sm`}></i>
                      </div>
                      <span className="text-sm font-semibold text-slate-200">{label}</span>
                    </div>

                    <div className="flex gap-1.5 justify-end">
                      {EMOJIS.map(({ v, e, tip }) => {
                        const isSelected = q1Scores[qNum] === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setQ1Scores({ ...q1Scores, [qNum]: v })}
                            title={tip}
                            className={`w-11 h-13 rounded-xl border flex flex-col items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-indigo-500/35 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/20 text-white backdrop-blur-md'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/15 hover:border-white/20 hover:-translate-y-0.5'
                            }`}
                          >
                            <span className="text-xl leading-none">{e}</span>
                            <span className={`text-[9px] font-extrabold mt-1 ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>{v}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <hr className="my-8 border-white/10" />

            {/* Section 2 */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/80 to-indigo-700/80 backdrop-blur-md flex items-center justify-center text-white shadow-md border border-white/20">
                <i className="fa-solid fa-headset text-lg"></i>
              </div>
              <div>
                <h2 className="font-th text-base sm:text-lg font-bold text-white">ส่วนที่ 2: ติดต่อด้วย E-Mail หรือ โทรศัพท์</h2>
                <div className="text-xs text-slate-300/80 font-medium">ประเมินการสื่อสารผ่านระบบโทรศัพท์ / อีเมล</div>
              </div>
            </div>

            <div className="p-4 glass-card rounded-2xl border border-indigo-500/20 space-y-2.5 mb-8">
              {LABELS_Q2.map((label, idx) => {
                const qNum = idx + 1;
                return (
                  <div key={qNum} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/10 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 flex-shrink-0">
                        <i className={`fa-solid ${Q2_ICONS[idx]} text-sm`}></i>
                      </div>
                      <span className="text-sm font-semibold text-slate-200">{label}</span>
                    </div>

                    <div className="flex gap-1.5 justify-end">
                      {EMOJIS.map(({ v, e, tip }) => {
                        const isSelected = q2Scores[qNum] === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setQ2Scores({ ...q2Scores, [qNum]: v })}
                            title={tip}
                            className={`w-11 h-13 rounded-xl border flex flex-col items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-indigo-500/35 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/20 text-white backdrop-blur-md'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/15 hover:border-white/20 hover:-translate-y-0.5'
                            }`}
                          >
                            <span className="text-xl leading-none">{e}</span>
                            <span className={`text-[9px] font-extrabold mt-1 ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>{v}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <hr className="my-8 border-white/10" />

            {/* Praised & Bad Staff */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Praised Staff */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 backdrop-blur-md rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/80 border border-emerald-400/40 flex items-center justify-center text-white shadow-sm">
                    <i className="fa-solid fa-heart text-xs"></i>
                  </div>
                  <div>
                    <h3 className="font-th text-base font-bold text-emerald-200">พนักงานที่ประทับใจ <span className="text-rose-400">*</span></h3>
                    <p className="text-[10px] text-emerald-400/80 font-bold">เลือกได้มากกว่า 1 คน</p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 min-h-[32px] mb-3">
                  {(Array.from(selectedStaffKeys) as string[]).map(key => (
                    <span key={key} className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-full px-3 py-1 text-xs font-bold shadow-sm backdrop-blur-md">
                      {key}
                      <button
                        type="button"
                        onClick={() => toggleStaff(key)}
                        className="text-emerald-300 hover:text-rose-400 font-extrabold ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {selectedStaffKeys.size === 0 && (
                    <span className="text-xs text-slate-400/80 italic">โปรดแตะเลือกชื่อพนักงานด้านล่าง...</span>
                  )}
                </div>

                {/* Staff Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1 pr-2">
                  {employees.map((emp) => {
                    const key = `${emp.fullName} (${emp.nickname})`;
                    const isSelected = selectedStaffKeys.has(key);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => toggleStaff(key)}
                        className={`relative p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-indigo-500/30 border-indigo-400 shadow-md ring-2 ring-indigo-400/30 backdrop-blur-md'
                            : 'bg-white/5 border-white/10 hover:border-indigo-400/50 hover:bg-white/10'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                            ✓
                          </div>
                        )}
                        <img
                          src={emp.img}
                          alt={emp.nickname}
                          className="w-12 h-12 rounded-xl object-cover mx-auto mb-1.5 border border-white/20 shadow-xs"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.nickname)}`;
                          }}
                        />
                        <div className="text-xs font-bold text-slate-100 truncate">{emp.fullName}</div>
                        <div className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">{emp.nickname}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-extrabold text-emerald-300 uppercase tracking-wider mb-1">
                    <i className="fa-solid fa-pen-nib mr-1"></i>เหตุผลที่ชื่นชม
                  </label>
                  <input
                    type="text"
                    value={goodReason}
                    onChange={(e) => setGoodReason(e.target.value)}
                    placeholder="เช่น บริการรวดเร็ว สุภาพ สื่อสารชัดเจน..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-slate-900/60 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              {/* Bad Staff / Improvements */}
              <div className="bg-rose-950/30 border border-rose-500/30 backdrop-blur-md rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/80 border border-rose-400/40 flex items-center justify-center text-white shadow-sm">
                    <i className="fa-solid fa-circle-exclamation text-xs"></i>
                  </div>
                  <div>
                    <h3 className="font-th text-base font-bold text-rose-200">สิ่งที่ควรปรับปรุง</h3>
                    <p className="text-[10px] text-rose-400/80 font-bold">เพื่อการพัฒนาบริการดียิ่งขึ้น</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-extrabold text-rose-300 uppercase tracking-wider mb-1">
                      <i className="fa-solid fa-user-xmark mr-1"></i>ชื่อพนักงาน (ถ้ามี)
                    </label>
                    <input
                      type="text"
                      value={badStaff}
                      onChange={(e) => setBadStaff(e.target.value)}
                      placeholder="ระบุชื่อพนักงานที่ควรปรับปรุง..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-slate-900/60 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-rose-300 uppercase tracking-wider mb-1">
                      <i className="fa-solid fa-comment-slash mr-1"></i>รายละเอียดที่ควรแก้ไข
                    </label>
                    <textarea
                      value={badReason}
                      onChange={(e) => setBadReason(e.target.value)}
                      rows={4}
                      placeholder="โปรดระบุรายละเอียดเรื่องที่ควรปรับปรุง..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-slate-900/60 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            {/* Extra Suggestions & Submit */}
            <div className="glass-card rounded-2xl p-6 relative overflow-hidden text-white shadow-xl border border-white/15">
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300 border border-white/15">
                    <i className="fa-solid fa-comments text-base"></i>
                  </div>
                  <div>
                    <h3 className="font-th text-base font-bold text-white">ข้อเสนอแนะเพิ่มเติม</h3>
                    <p className="text-xs text-slate-400">ความเห็นของท่านมีความสำคัญในการพัฒนาหน่วยงาน</p>
                  </div>
                </div>

                <textarea
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  rows={3}
                  placeholder="พิมพ์ข้อเสนอแนะ ข้อคิดเห็น หรือคำแนะนำอื่นๆ ที่นี่..."
                  className="w-full p-3.5 rounded-xl bg-slate-900/60 border border-white/15 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none mb-4"
                ></textarea>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-th font-extrabold text-lg shadow-xl shadow-indigo-600/30 border border-white/20 transition-all flex items-center justify-center gap-3 active:scale-98 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-circle-notch spin"></i>
                      <span>กำลังส่งข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <span>ส่งข้อมูลการประเมิน</span>
                      <i className="fa-solid fa-paper-plane text-base"></i>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
