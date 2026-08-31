import React, { useState, useEffect } from 'react';
import { Employee, HappyLifeClub } from '../types';
import { StorageService } from '../services/storage';
import { HAPPY_LIFE_CLUBS, isAuthorizedAdminUser } from '../data/initialData';

interface StaffManagementProps {
  currentUser: Employee | null;
  showToast: (type: 'success' | 'error', msg: string) => void;
}

const PRESET_AVATARS = [
  { label: 'ชาย 1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JoeSomchai&skinColor=f8d25c&hair=shortCombover' },
  { label: 'หญิง 1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=WilaiNan&skinColor=f8d25c&hair=straight01' },
  { label: 'ชาย 2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SurachaiMgr&skinColor=f8d25c&hair=shortWaved' },
  { label: 'หญิง 2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PornthipJiw&skinColor=f8d25c&hair=bob' },
  { label: 'ชาย 3', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PrawitSpv&skinColor=f8d25c&hair=shortSides' },
  { label: 'หญิง 3', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SudaDa&skinColor=f8d25c&hair=curly' },
  { label: 'มินิมอล 1', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=StaffAsian1' },
  { label: 'มินิมอล 2', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=StaffAsian2' },
  { label: 'มินิมอล 3', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=StaffAsian3' },
  { label: 'มินิมอล 4', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=StaffAsian4' }
];

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

  // Edit Modal State
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editImgUrl, setEditImgUrl] = useState('');
  const [editClub, setEditClub] = useState<HappyLifeClub>('ชมรมเดิน-วิ่ง');
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  const loadData = () => {
    setEmployees(StorageService.getEmployees());
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!isAuthorizedAdminUser(currentUser)) {
    return (
      <div className="min-h-full bg-slate-950 p-8 text-center text-slate-400 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center text-3xl mb-4 border border-rose-500/30">
          <i className="fa-solid fa-lock"></i>
        </div>
        <h2 className="font-th font-extrabold text-xl text-white">ไม่มีสิทธิ์เข้าถึงหน้าตั้งค่าผู้ดูแลระบบ</h2>
        <p className="text-sm text-slate-300 mt-2 max-w-md">
          หน้าการตั้งค่าพนักงาน ชมรม และระบบนี้ จำกัดสิทธิ์สำหรับผู้ดูแลระบบ 3 บัญชีผู้ใช้เท่านั้น: <strong className="text-emerald-400 font-mono">SPV_BME</strong>, <strong className="text-emerald-400 font-mono">MGR_BME</strong> และ <strong className="text-emerald-400 font-mono">563770</strong>
        </p>
      </div>
    );
  }

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setTargetUrl: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setTargetUrl(evt.target.result as string);
          showToast('success', 'เลือกและอัปโหลดรูปภาพสำเร็จแล้ว');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !nickname.trim() || !username.trim()) {
      showToast('error', 'กรุณากรอกข้อมูล ชื่อเต็ม ชื่อเล่น และ Username ให้ครบถ้วน');
      return;
    }

    const defaultImg = imgUrl.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nickname.trim())}&skinColor=f8d25c`;

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

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setEditFullName(emp.fullName);
    setEditNickname(emp.nickname);
    setEditUsername(emp.username);
    setEditPassword(emp.password || '123');
    setEditImgUrl(emp.img);
    setEditClub(emp.club);
    setEditIsAdmin(emp.isAdmin || false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;

    if (!editFullName.trim() || !editNickname.trim() || !editUsername.trim()) {
      showToast('error', 'กรุณากรอกข้อมูล ชื่อเต็ม ชื่อเล่น และ Username ให้ครบถ้วน');
      return;
    }

    const updated = StorageService.updateEmployee(editingEmp.id, {
      fullName: editFullName.trim(),
      nickname: editNickname.trim(),
      username: editUsername.trim(),
      password: editPassword.trim(),
      img: editImgUrl.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(editNickname.trim())}&skinColor=f8d25c`,
      club: editClub,
      isAdmin: editIsAdmin
    });

    if (updated) {
      showToast('success', `อัปเดตข้อมูลของ ${updated.fullName} เรียบร้อยแล้ว`);
      setEditingEmp(null);
      loadData();
    }
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
            <h1 className="font-th font-extrabold text-xl text-white">จัดการพนักงาน & รูปโปรไฟล์</h1>
            <p className="text-xs text-slate-300 font-medium">เพิ่มพนักงาน, อัปเดตรูปภาพโปรไฟล์ประจำตัว และสังกัดชมรม (Admin Only)</p>
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
              <label className="block text-xs font-bold text-slate-300 mb-1">รูปโปรไฟล์ (อัปโหลด หรือวาง Link)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imgUrl}
                  onChange={e => setImgUrl(e.target.value)}
                  placeholder="https://... หรืออัปโหลดไฟล์"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs outline-none focus:border-purple-500"
                />
                <label className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1">
                  <i className="fa-solid fa-upload"></i>
                  <span>เลือกไฟล์</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageFileUpload(e, setImgUrl)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Preset Avatar Selection */}
          <div className="space-y-1.5 pt-2">
            <span className="text-xs font-bold text-slate-400">หรือเลือกรูป Avatar สำเร็จรูป:</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_AVATARS.map((av, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setImgUrl(av.url)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs transition-all ${
                    imgUrl === av.url ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <img src={av.url} alt={av.label} className="w-5 h-5 rounded-full bg-slate-700" />
                  <span>{av.label}</span>
                </button>
              ))}
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
              <div className="relative group">
                <img
                  src={emp.img}
                  alt={emp.nickname}
                  className="w-14 h-14 rounded-2xl object-cover bg-slate-800 border border-white/10 flex-shrink-0 shadow-md"
                  onError={e => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(emp.nickname)}&skinColor=f8d25c`;
                  }}
                />
                <button
                  onClick={() => openEditModal(emp)}
                  title="เปลี่ยนรูปภาพ / แก้ไขข้อมูล"
                  className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                </button>
              </div>

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
              <button
                onClick={() => openEditModal(emp)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 font-bold text-xs flex items-center gap-1.5"
              >
                <i className="fa-solid fa-user-pen"></i>
                <span>แก้ไขรูปภาพ / ข้อมูล</span>
              </button>

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

      {/* EDIT EMPLOYEE MODAL */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-th font-extrabold text-lg text-purple-300 flex items-center gap-2">
                <i className="fa-solid fa-user-pen"></i>
                <span>แก้ไขข้อมูล & รูปโปรไฟล์: {editingEmp.fullName}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingEmp(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Current Image Preview & Upload */}
            <div className="flex flex-col items-center gap-3 p-4 bg-slate-950/60 rounded-2xl border border-white/10">
              <img
                src={editImgUrl}
                alt="Profile Preview"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-purple-500 shadow-xl bg-slate-800"
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(editNickname || 'user')}&skinColor=f8d25c`;
                }}
              />

              <div className="w-full space-y-2">
                <label className="block text-xs font-bold text-slate-300 text-center">
                  อัปโหลดรูปภาพใหม่จากเครื่องของคุณ:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editImgUrl}
                    onChange={e => setEditImgUrl(e.target.value)}
                    placeholder="URL รูปภาพ..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs outline-none focus:border-purple-500"
                  />
                  <label className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-md">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <span>เลือกรูปไฟล์</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageFileUpload(e, setEditImgUrl)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Preset Gallery */}
              <div className="w-full space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400">เลือกรูป Avatar สำเร็จรูป:</span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_AVATARS.map((av, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setEditImgUrl(av.url)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs transition-all ${
                        editImgUrl === av.url ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <img src={av.url} alt={av.label} className="w-5 h-5 rounded-full bg-slate-700" />
                      <span>{av.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Other fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ชื่อเล่น</label>
                <input
                  type="text"
                  value={editNickname}
                  onChange={e => setEditNickname(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">ชมรมสังกัด Happy Life</label>
                <select
                  value={editClub}
                  onChange={e => setEditClub(e.target.value as HappyLifeClub)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-purple-500"
                >
                  {HAPPY_LIFE_CLUBS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editIsAdminCheck"
                checked={editIsAdmin}
                onChange={e => setEditIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="editIsAdminCheck" className="text-xs font-bold text-purple-300 cursor-pointer">
                แต่งตั้งเป็นผู้ดูแลระบบ (Admin Permissions)
              </label>
            </div>

            <div className="flex gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingEmp(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-600/30"
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
