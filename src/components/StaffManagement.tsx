import React, { useState, useEffect } from 'react';
import { Employee, HappyLifeClub } from '../types';
import { StorageService } from '../services/storage';
import { HAPPY_LIFE_CLUBS } from '../data/initialData';

interface StaffManagementProps {
  currentUser: Employee | null;
  showToast: (type: 'success' | 'error', msg: string) => void;
}

export const StaffManagement: React.FC<StaffManagementProps> = ({ currentUser, showToast }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add form state
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [club, setClub] = useState<HappyLifeClub>('ชมรมเดิน-วิ่ง');
  const [isAdmin, setIsAdmin] = useState(false);

  const [isAdding, setIsAdding] = useState(false);

  const loadData = () => {
    setEmployees(StorageService.getEmployees());
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!currentUser?.isAdmin) {
    return (
      <div className="min-h-full bg-slate-950 p-8 text-center text-slate-400">
        <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center mx-auto text-3xl mb-4">
          <i className="fa-solid fa-shield-halved"></i>
        </div>
        <h2 className="font-th font-extrabold text-xl text-white">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น</h2>
        <p className="text-xs text-slate-400 mt-2">สิทธิ์เข้าถึงหน้านี้เฉพาะ SPV_BME, MGR_BME และ 563770</p>
      </div>
    );
  }

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !nickname.trim() || !username.trim()) {
      showToast('error', 'กรุณากรอกข้อมูล ชื่อเต็ม ชื่อเล่น และ Username ให้ครบถ้วน');
      return;
    }

    const defaultImg = imgUrl.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nickname.trim())}`;

    StorageService.addEmployee({
      fullName: fullName.trim(),
      nickname: nickname.trim(),
      username: username.trim(),
      password: password.trim() || '123',
      img: defaultImg,
      club,
      status: 'active',
      isAdmin,
      dept: 'Biomedical Engineering'
    });

    showToast('success', `เพิ่มพนักงานใหม่ ${fullName} (${nickname}) เรียบร้อยแล้ว!`);

    // Reset form
    setFullName('');
    setNickname('');
    setUsername('');
    setPassword('');
    setImgUrl('');
    setIsAdmin(false);
    setIsAdding(false);
    loadData();
  };

  const handleStatusToggle = (emp: Employee) => {
    const newStatus = emp.status === 'active' ? 'resigned' : 'active';
    const statusText = newStatus === 'active' ? 'Active (ยังทำงานอยู่)' : 'Resigned (ลาออกแล้ว)';

    if (confirm(`คุณต้องการเปลี่ยนสถานะของ ${emp.fullName} เป็น "${statusText}" ใช่หรือไม่?`)) {
      StorageService.updateEmployee(emp.id, { status: newStatus });
      showToast('success', `อัปเดตสถานะของ ${emp.fullName} เป็น ${statusText} เรียบร้อยแล้ว`);
      loadData();
    }
  };

  const handleClubChange = (emp: Employee, newClub: HappyLifeClub) => {
    StorageService.updateEmployee(emp.id, { club: newClub });
    showToast('success', `อัปเดตชมรมสังกัดของ ${emp.fullName} เป็น ${newClub}`);
    loadData();
  };

  const filteredEmployees = employees.filter(emp => {
    if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        emp.fullName.toLowerCase().includes(q) ||
        emp.nickname.toLowerCase().includes(q) ||
        emp.username.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-full text-slate-100 p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel border border-white/15 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg border border-white/20">
            <i className="fa-solid fa-users-gear"></i>
          </div>
          <div>
            <h1 className="font-th font-extrabold text-xl text-white">จัดการพนักงาน & สังกัดชมรม</h1>
            <p className="text-xs text-slate-300 font-medium">เพิ่มพนักงานใหม่ และอัปเดตสถานะ Active / ลาออกแล้ว (Admin Only)</p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-th font-bold text-xs shadow-lg flex items-center gap-2 transition-all border border-white/20"
        >
          <i className={`fa-solid ${isAdding ? 'fa-minus' : 'fa-plus'}`}></i>
          <span>{isAdding ? 'ซ่อนฟอร์ม' : 'เพิ่มพนักงานใหม่'}</span>
        </button>
      </div>

      {/* Add Employee Form */}
      {isAdding && (
        <form onSubmit={handleAddEmployee} className="glass-panel border border-purple-400/40 rounded-3xl p-6 shadow-2xl space-y-4">
          <h2 className="font-th font-extrabold text-base text-purple-300 flex items-center gap-2">
            <i className="fa-solid fa-user-plus"></i>
            <span>ลงทะเบียนพนักงานคนใหม่</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">ชื่อ-นามสกุล <span className="text-rose-400">*</span></label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">ชื่อเล่น <span className="text-rose-400">*</span></label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="เช่น โจ"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Username <span className="text-rose-400">*</span></label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="เช่น 563770 / emp_john"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="รหัสผ่าน (ค่าเริ่มต้น 123)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">ชมรมสังกัด Happy Life <span className="text-rose-400">*</span></label>
              <select
                value={club}
                onChange={e => setClub(e.target.value as HappyLifeClub)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
              >
                {HAPPY_LIFE_CLUBS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">URL รูปภาพ Avatar (ถ้ามี)</label>
              <input
                type="text"
                value={imgUrl}
                onChange={e => setImgUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isAdminCheck"
              checked={isAdmin}
              onChange={e => setIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="isAdminCheck" className="text-xs font-bold text-purple-300 cursor-pointer">
              แต่งตั้งเป็นผู้ดูแลระบบ (Admin Permissions)
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-th font-bold text-sm shadow-lg shadow-purple-600/30"
          >
            บันทึกพนักงานใหม่
          </button>
        </form>
      )}

      {/* Filter and Search */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
          <i className="fa-solid fa-filter text-purple-400"></i>
          <span>สถานะพนักงาน:</span>
        </div>

        <div className="flex gap-1.5">
          {(['all', 'active', 'resigned'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st === 'all' && 'ทั้งหมด'}
              {st === 'active' && '🟢 Active (ยังทำงานอยู่)'}
              {st === 'resigned' && '🔴 ลาออกแล้ว'}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] ml-auto">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ค้นชื่อ, ชื่อเล่น, Username..."
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl pl-8 pr-3 py-2 outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map(emp => (
          <div
            key={emp.id}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
              emp.status === 'active'
                ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                : 'bg-slate-950/60 border-rose-950 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3">
              <img
                src={emp.img}
                alt={emp.nickname}
                className="w-12 h-12 rounded-xl object-cover bg-slate-800 border border-slate-700 flex-shrink-0"
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.nickname)}`;
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-th font-extrabold text-sm text-white truncate flex items-center gap-2">
                  <span>{emp.fullName} ({emp.nickname})</span>
                  {emp.isAdmin && <span className="bg-purple-500/20 text-purple-300 text-[9px] font-black px-1.5 py-0.5 rounded">ADMIN</span>}
                </div>
                <div className="text-xs text-slate-400 font-mono">User: {emp.username}</div>
                <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                  <i className="fa-solid fa-users-rectangle mr-1"></i>{emp.club}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
              {/* Club Dropdown */}
              <select
                value={emp.club}
                onChange={e => handleClubChange(emp, e.target.value as HappyLifeClub)}
                className="bg-slate-800 text-slate-300 text-[11px] font-bold rounded-lg px-2 py-1 outline-none border border-slate-700"
              >
                {HAPPY_LIFE_CLUBS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Status Toggle Button */}
              <button
                onClick={() => handleStatusToggle(emp)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                  emp.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-emerald-500/20 hover:text-emerald-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${emp.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span>{emp.status === 'active' ? 'Active' : 'ลาออกแล้ว'}</span>
              </button>
            </div>
          </div>
        ))}

        {filteredEmployees.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
            ไม่พบพนักงานในเงื่อนไขนี้
          </div>
        )}
      </div>
    </div>
  );
};
