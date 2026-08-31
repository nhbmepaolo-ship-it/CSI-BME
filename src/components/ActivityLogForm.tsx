import React, { useState, useEffect } from 'react';
import { Employee, ActivityCategory } from '../types';
import { StorageService } from '../services/storage';
import { HAPPY_LIFE_CLUBS } from '../data/initialData';

interface ActivityLogFormProps {
  currentUser: Employee | null;
  onLogin: (user: Employee) => void;
  onLogout: () => void;
  onSuccessSubmitted: () => void;
  showToast: (type: 'success' | 'error', msg: string) => void;
}

const HR_PTP_ACTIVITIES = [
  'เต้นแอโรบิก (HR-PTP)',
  'รดน้ำผัก (HR-PTP)',
  'ตลาดปันสุข (HR-PTP)'
];

const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

export const ActivityLogForm: React.FC<ActivityLogFormProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onSuccessSubmitted,
  showToast
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Login Form states (when currentUser is null)
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Form states
  const [selectedUser, setSelectedUser] = useState<Employee | null>(currentUser);
  const [category, setCategory] = useState<ActivityCategory>('Happy Life');
  const [happyLifeActivity, setHappyLifeActivity] = useState<string>('ชมรมเดิน-วิ่ง');
  const [hrPtpActivity, setHrPtpActivity] = useState<string>('เต้นแอโรบิก (HR-PTP)');
  const [customActivityName, setCustomActivityName] = useState<string>('');

  const [hours, setHours] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [activityDate, setActivityDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const emps = StorageService.getEmployees().filter(e => e.status === 'active');
    setEmployees(emps);
  }, []);

  useEffect(() => {
    setSelectedUser(currentUser);
    if (currentUser?.club) {
      setHappyLifeActivity(currentUser.club);
    }
  }, [currentUser]);

  // Handle Employee Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginUsername.trim()) {
      setLoginError('กรุณากรอกรหัสพนักงาน/Username');
      return;
    }

    const res = StorageService.authenticateUser(loginUsername, loginPassword);
    if (res.success && res.user) {
      onLogin(res.user);
      setSelectedUser(res.user);
      if (res.user.club) {
        setHappyLifeActivity(res.user.club);
      }
      showToast('success', `ยินดีต้อนรับ ${res.user.fullName} (${res.user.nickname})`);
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError(res.message || 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  // Quick login helper
  const handleQuickSelectEmployee = (emp: Employee) => {
    setLoginUsername(emp.username);
    setLoginPassword(emp.password || '123456');
  };

  const handleSubmitActivity = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      showToast('error', 'กรุณาล็อกอินด้วยบัญชีพนักงานก่อนบันทึกกิจกรรม');
      return;
    }

    const targetUser = selectedUser || currentUser;

    if (hours === 0 && minutes === 0) {
      showToast('error', 'กรุณาระบุระยะเวลาเข้าร่วมกิจกรรมอย่างน้อย 1 นาที');
      return;
    }

    let finalActivityName = '';
    if (category === 'Happy Life') {
      finalActivityName = happyLifeActivity;
    } else if (category === 'HR-PTP') {
      finalActivityName = hrPtpActivity;
    } else {
      if (!customActivityName.trim()) {
        showToast('error', 'กรุณาระบุชื่อกิจกรรมอื่นๆ');
        return;
      }
      finalActivityName = customActivityName.trim();
    }

    setIsSubmitting(true);

    setTimeout(() => {
      StorageService.addActivity({
        username: targetUser.username,
        fullName: targetUser.fullName,
        nickname: targetUser.nickname,
        club: targetUser.club,
        activityCategory: category,
        activityName: finalActivityName,
        description: description.trim(),
        hours,
        minutes,
        timestamp: new Date(activityDate + 'T12:00:00').toISOString()
      });

      setIsSubmitting(false);
      showToast('success', `บันทึกกิจกรรม ${finalActivityName} (${hours} ชม. ${minutes} นาที) สำเร็จ!`);

      setDescription('');
      onSuccessSubmitted();
    }, 500);
  };

  return (
    <div className="min-h-full text-slate-100 pb-16">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-indigo-700/90 py-10 px-4 text-center text-white shadow-2xl overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-xl mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 border border-white/25 mb-3 shadow-xl backdrop-blur-md">
            <i className="fa-solid fa-person-running text-3xl text-emerald-300"></i>
          </div>
          <h1 className="font-th font-extrabold text-3xl sm:text-4xl text-white tracking-tight">บันทึกชั่วโมงกิจกรรมพนักงาน</h1>
          <p className="text-xs font-semibold text-white/90 uppercase tracking-widest mt-1">
            กิจกรรม Happy Life (5 ชมรม) &amp; HR-PTP · Biomedical Engineering
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* Requirement 3: Employee Authentication Required */}
        {!currentUser ? (
          <div className="glass-panel border border-emerald-400/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-2xl mx-auto shadow-md">
                <i className="fa-solid fa-user-lock"></i>
              </div>
              <h2 className="font-th font-extrabold text-xl text-white">
                เข้าสู่ระบบพนักงาน (Employee Login)
              </h2>
              <p className="text-xs text-slate-300">
                การบันทึกกิจกรรมต้องล็อกอินด้วยรหัสพนักงานและรหัสผ่านของคุณเท่านั้น
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  <i className="fa-solid fa-id-card text-emerald-400 mr-2"></i>รหัสพนักงาน / Username:
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  placeholder="เช่น 563770, 563771..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-white/15 text-white font-bold text-sm outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  <i className="fa-solid fa-key text-emerald-400 mr-2"></i>รหัสผ่าน (Password):
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านของคุณ..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-white/15 text-white font-bold text-sm outline-none focus:border-emerald-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * รหัสผ่านเริ่มต้นคือ <code className="text-emerald-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">123456</code> (หรือติดต่อผู้ดูแลระบบ)
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-400/40 text-xs font-bold flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white font-th font-extrabold text-base shadow-xl border border-white/20 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>เข้าสู่ระบบเพื่อบันทึกกิจกรรม</span>
              </button>
            </form>

            {/* Quick Login Helper */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              <span className="text-xs font-bold text-slate-300">
                เลือกล็อกอินด่วน (สำหรับทดสอบรายชื่อพนักงาน):
              </span>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {employees.map(emp => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleQuickSelectEmployee(emp)}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-white/10 border border-white/10 text-left transition-all flex items-center gap-2"
                  >
                    <img
                      src={emp.img || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.nickname)}`}
                      alt={emp.nickname}
                      className="w-7 h-7 rounded-lg object-cover border border-emerald-400/50"
                      onError={e => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.nickname)}`;
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-white truncate">{emp.fullName} ({emp.nickname})</div>
                      <div className="text-[9px] text-emerald-300 font-mono">User: {emp.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Activity Log Form (Authenticated) */
          <div className="glass-panel border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <form onSubmit={handleSubmitActivity} className="space-y-6">

              {/* Logged in User Profile Bar */}
              <div className="glass-card border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={currentUser.img || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.nickname)}`}
                    alt={currentUser.nickname}
                    className="w-13 h-13 rounded-2xl object-cover border-2 border-emerald-400 shadow-md flex-shrink-0"
                    onError={e => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.nickname)}`;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>ผู้บันทึกกิจกรรมปัจจุบัน</span>
                      {currentUser.isAdmin && (
                        <span className="bg-purple-500/30 text-purple-200 border border-purple-400/40 px-2 py-0.5 rounded-full text-[9px] font-black ml-1">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="font-th font-extrabold text-base text-white truncate">
                      {currentUser.fullName} ({currentUser.nickname})
                    </div>
                    <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-slate-400">User: {currentUser.username}</span>
                      <span>·</span>
                      <span className="text-emerald-300 font-semibold">{currentUser.club}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-bold transition-all flex-shrink-0"
                  title="ออกจากระบบ เพื่อล็อกอินด้วยรหัสพนักงานคนอื่น"
                >
                  <i className="fa-solid fa-right-from-bracket mr-1"></i>สลับบัญชี
                </button>
              </div>

              {/* Admin Record on behalf feature */}
              {currentUser.isAdmin && (
                <div className="bg-purple-950/30 border border-purple-400/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-200">
                    <i className="fa-solid fa-shield-halved text-purple-300"></i>
                    <span>บันทึกแทนพนักงานท่านอื่น (Admin Mode):</span>
                  </div>
                  <select
                    value={selectedUser?.id || currentUser.id}
                    onChange={e => {
                      const found = employees.find(emp => emp.id === e.target.value);
                      if (found) setSelectedUser(found);
                    }}
                    className="bg-slate-900 border border-purple-400/40 text-white font-bold text-xs rounded-xl px-3 py-1.5 outline-none"
                  >
                    {employees.map(e => (
                      <option key={e.id} value={e.id} className="bg-slate-900 text-white">
                        {e.fullName} ({e.nickname}) — {e.club}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  <i className="fa-solid fa-calendar-day text-emerald-400 mr-2"></i>วันที่ทำกิจกรรม
                </label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={e => setActivityDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/15 text-white font-semibold text-sm outline-none focus:border-emerald-400"
                  required
                />
              </div>

              {/* Activity Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  <i className="fa-solid fa-layer-group text-emerald-400 mr-2"></i>หมวดหมู่กิจกรรม
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Happy Life', 'HR-PTP', 'อื่นๆ'] as ActivityCategory[]).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-3 px-2 rounded-xl font-th text-xs font-bold border transition-all text-center ${
                        category === cat
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30'
                          : 'bg-slate-900/60 border-white/15 text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {cat === 'Happy Life' && '🏃‍♂️ Happy Life'}
                      {cat === 'HR-PTP' && '🌱 HR-PTP'}
                      {cat === 'อื่นๆ' && '✨ กิจกรรมอื่นๆ'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Happy Life Popup/Options */}
              {category === 'Happy Life' && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                  <label className="block text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    <i className="fa-solid fa-users-rectangle mr-2"></i>เลือกกิจกรรมชมรม Happy Life (5 ชมรม)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {HAPPY_LIFE_CLUBS.map(club => (
                      <button
                        key={club}
                        type="button"
                        onClick={() => setHappyLifeActivity(club)}
                        className={`p-3 rounded-xl text-xs font-bold text-left border transition-all flex items-center gap-2.5 ${
                          happyLifeActivity === club
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md font-extrabold'
                            : 'bg-slate-900/80 border-white/15 text-slate-300 hover:border-emerald-400/40'
                        }`}
                      >
                        <i className={`fa-solid ${
                          club.includes('เดิน') ? 'fa-person-walking-runner' :
                          club.includes('ฟุตบอล') ? 'fa-futbol' :
                          club.includes('แบต') ? 'fa-table-tennis-paddle-ball' :
                          club.includes('อาหาร') ? 'fa-utensils' : 'fa-music'
                        } text-base`}></i>
                        <span>{club}</span>
                        {happyLifeActivity === club && <i className="fa-solid fa-circle-check ml-auto text-slate-950"></i>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* HR-PTP Popup/Options */}
              {category === 'HR-PTP' && (
                <div className="bg-teal-950/30 border border-teal-500/30 rounded-2xl p-4 space-y-3">
                  <label className="block text-xs font-bold text-teal-300 uppercase tracking-wider">
                    <i className="fa-solid fa-hospital-user mr-2"></i>เลือกกิจกรรม HR-PTP
                  </label>
                  <div className="space-y-2">
                    {HR_PTP_ACTIVITIES.map(act => (
                      <button
                        key={act}
                        type="button"
                        onClick={() => setHrPtpActivity(act)}
                        className={`w-full p-3 rounded-xl text-xs font-bold text-left border transition-all flex items-center justify-between ${
                          hrPtpActivity === act
                            ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-md font-extrabold'
                            : 'bg-slate-900/80 border-white/15 text-slate-300 hover:border-teal-400/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <i className={`fa-solid ${
                            act.includes('แอโรบิก') ? 'fa-child-reaching' :
                            act.includes('ผัก') ? 'fa-seedling' : 'fa-store'
                          } text-base`}></i>
                          <span>{act}</span>
                        </div>
                        {hrPtpActivity === act && <i className="fa-solid fa-circle-check text-slate-950"></i>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Custom Activity */}
              {category === 'อื่นๆ' && (
                <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
                  <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    ระบุชื่อกิจกรรมอื่นๆ
                  </label>
                  <input
                    type="text"
                    value={customActivityName}
                    onChange={e => setCustomActivityName(e.target.value)}
                    placeholder="เช่น ปั่นจักรยาน, สวดมนต์นั่งสมาธิ, บาสเกตบอล ฯลฯ"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-white/15 text-white font-semibold text-sm outline-none focus:border-indigo-400"
                    required
                  />
                </div>
              )}

              {/* Duration Input: Hours & Minutes */}
              <div className="bg-slate-900/60 border border-white/15 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <i className="fa-solid fa-stopwatch text-amber-400 mr-2"></i>ระยะเวลาการเข้าร่วมกิจกรรม (ชั่วโมง / นาที)
                  </label>
                  <span className="text-xs font-extrabold text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                    รวม: {hours} ชม. {minutes} นาที ({hours * 60 + minutes} นาที)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">ชั่วโมง (Hours)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={hours}
                        onChange={e => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-extrabold text-lg text-center outline-none focus:border-amber-400"
                      />
                      <span className="text-xs font-bold text-slate-400">ชม.</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">นาที (Minutes)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="1"
                        value={minutes}
                        onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-extrabold text-lg text-center outline-none focus:border-amber-400"
                      />
                      <span className="text-xs font-bold text-slate-400">นาที</span>
                    </div>
                  </div>
                </div>

                {/* Quick minute selection pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 font-bold mr-1">ปุ่มลัด:</span>
                  {QUICK_MINUTES.map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setHours(Math.floor(mins / 60));
                        setMinutes(mins % 60);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 hover:border-amber-400 text-[11px] font-bold text-slate-300 transition-all"
                    >
                      {mins >= 60 ? `${mins / 60} ชม.` : `${mins} นาที`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  <i className="fa-solid fa-align-left text-slate-400 mr-2"></i>รายละเอียดเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="ระบุสถานที่ หรือรายละเอียดเพิ่มเติมของการเข้าร่วมกิจกรรม..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/15 text-white text-xs font-medium outline-none focus:border-emerald-400 resize-none"
                ></textarea>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white font-th font-extrabold text-lg shadow-xl border border-white/20 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>กำลังบันทึกกิจกรรม...</span>
                  </>
                ) : (
                  <>
                    <span>บันทึกชั่วโมงกิจกรรม</span>
                    <i className="fa-solid fa-circle-check"></i>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
