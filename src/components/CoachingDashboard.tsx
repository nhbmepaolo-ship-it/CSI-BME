import React, { useState, useEffect, useMemo } from 'react';
import { CoachingRecord, AnimalDISCType, Employee } from '../types';
import { StorageService } from '../services/storage';
import { COACHING_TOPIC_CATALOG } from '../data/initialCoachingData';

interface CoachingDashboardProps {
  key?: React.Key;
  currentUser: Employee | null;
  showToast?: (type: 'success' | 'error', msg: string) => void;
}

export function CoachingDashboard({ currentUser, showToast }: CoachingDashboardProps) {
  const [records, setRecords] = useState<CoachingRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'catalog'>('cards');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<CoachingRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<CoachingRecord>>({});

  // Auth permissions
  const canEditCoaching = useMemo(() => {
    if (!currentUser) return false;
    const u = (currentUser.username || '').toUpperCase();
    const isMgrOrSpv = u === 'MGR_BME' || u === 'SPV_BME' || u === '563770' || currentUser.isAdmin;
    return isMgrOrSpv;
  }, [currentUser]);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = () => {
    const list = StorageService.getCoachingRecords();
    setRecords(list);
  };

  const handleReset = () => {
    if (window.confirm('คุณต้องการรีเซ็ตข้อมูล Coaching เป็นค่าเริ่มต้นของ BME PTP ใช่หรือไม่?')) {
      const resetList = StorageService.resetCoachingRecords();
      setRecords(resetList);
      if (showToast) showToast('success', 'รีเซ็ตข้อมูล Coaching เรียบร้อยแล้ว');
    }
  };

  const handleOpenEdit = (rec: CoachingRecord) => {
    setEditingRecord(rec);
    setEditForm({ ...rec });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const updatedList = StorageService.updateCoachingRecord(editingRecord.id, editForm);
    setRecords(updatedList);
    setEditingRecord(null);
    if (showToast) showToast('success', `อัปเดตข้อมูล Coaching ของ ${editingRecord.fullName} เรียบร้อยแล้ว`);
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch =
        r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.empId.includes(searchTerm) ||
        r.position.toLowerCase().includes(searchTerm.toLowerCase());

      const matchAnimal = selectedAnimal === 'all' || r.animalType === selectedAnimal;
      const matchType = selectedType === 'all' || r.contractType === selectedType;

      return matchSearch && matchAnimal && matchType;
    });
  }, [records, searchTerm, selectedAnimal, selectedType]);

  // Statistics
  const stats = useMemo(() => {
    const totalPeople = records.length;
    const bullCount = records.filter(r => r.animalType === 'กระทิง').length;
    const eagleCount = records.filter(r => r.animalType === 'อินทรีย์').length;
    const bearCount = records.filter(r => r.animalType === 'หมี').length;
    const mouseCount = records.filter(r => r.animalType === 'หนู').length;

    const totalHours = records.reduce((sum, r) => sum + (r.totalHours || 0), 0);
    const avgScore = totalPeople > 0 ? (records.reduce((sum, r) => sum + (r.evaluationScore || 0), 0) / totalPeople).toFixed(1) : '0';
    const avgProgress = totalPeople > 0 ? Math.round(records.reduce((sum, r) => sum + (r.progressPercent || 0), 0) / totalPeople) : 0;

    return {
      totalPeople,
      bullCount,
      bullPct: totalPeople > 0 ? ((bullCount / totalPeople) * 100).toFixed(1) : '0',
      eagleCount,
      eaglePct: totalPeople > 0 ? ((eagleCount / totalPeople) * 100).toFixed(1) : '0',
      bearCount,
      bearPct: totalPeople > 0 ? ((bearCount / totalPeople) * 100).toFixed(1) : '0',
      mouseCount,
      mousePct: totalPeople > 0 ? ((mouseCount / totalPeople) * 100).toFixed(1) : '0',
      totalHours: totalHours.toFixed(1),
      avgScore,
      avgProgress
    };
  }, [records]);

  // Animal Badge helper based on current themeMode
  const getAnimalBadge = (type: AnimalDISCType) => {
    const isLight = themeMode === 'light';
    switch (type) {
      case 'กระทิง':
        return {
          label: 'กระทิง',
          bg: isLight
            ? 'bg-rose-100 text-rose-900 border-rose-300'
            : 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          emoji: '🦬'
        };
      case 'อินทรีย์':
        return {
          label: 'อินทรีย์',
          bg: isLight
            ? 'bg-amber-100 text-amber-900 border-amber-300'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          emoji: '🦅'
        };
      case 'หมี':
        return {
          label: 'หมี',
          bg: isLight
            ? 'bg-sky-100 text-sky-900 border-sky-300'
            : 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          emoji: '🐻'
        };
      case 'หนู':
        return {
          label: 'หนู',
          bg: isLight
            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          emoji: '🐭'
        };
      default:
        return {
          label: type,
          bg: isLight
            ? 'bg-slate-100 text-slate-800 border-slate-300'
            : 'bg-slate-800 text-slate-300 border-slate-700',
          emoji: '👤'
        };
    }
  };

  const isLight = themeMode === 'light';

  return (
    <div className={`p-3 sm:p-6 max-w-7xl mx-auto space-y-6 font-th select-none transition-colors duration-300 ${
      isLight ? 'text-slate-900' : 'text-slate-100'
    }`}>
      
      {/* Header Title Section */}
      <div className={`rounded-2xl p-4 sm:p-5 shadow-sm border relative overflow-hidden transition-all ${
        isLight
          ? 'bg-white border-slate-200/80 shadow-slate-200/40'
          : 'bg-slate-900/90 border-white/10 shadow-2xl'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                isLight ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
              }`}>
                BME PTP Coaching System
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
              }`}>
                15 พนักงาน BME
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold flex items-center gap-2.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              <i className="fa-solid fa-graduation-cap text-indigo-500"></i>
              <span>แผนพัฒนาการเรียนรู้ & Coaching</span>
            </h2>
            <p className={`text-xs max-w-2xl leading-relaxed ${
              isLight ? 'text-slate-500 font-normal' : 'text-slate-300/80'
            }`}>
              ระบุเรื่องที่ต้อง Coaching ลำดับ 1, 2, 3 รายบุคคลตามประเภทบุคลิกภาพสัตว์ 4 ทิศ (DISC) พร้อมติดตามชั่วโมงและประเมินผลการพัฒนา
            </p>
          </div>

          {/* Action Buttons & Theme Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Theme Toggle Button */}
            <button
              onClick={() => setThemeMode(isLight ? 'dark' : 'light')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs border ${
                isLight
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300/80'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
              title="สลับโหมดการมองเห็น"
            >
              <i className={`fa-solid ${isLight ? 'fa-sun text-amber-600' : 'fa-moon text-indigo-400'}`}></i>
              <span>{isLight ? 'โหมดสบายตา (สว่าง)' : 'โหมดมืด (Dark)'}</span>
            </button>

            {canEditCoaching && (
              <button
                onClick={handleReset}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                  isLight
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 border-slate-700'
                }`}
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span>รีเซ็ตค่า BME</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                isLight
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-xs'
                  : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border-indigo-400/40'
              }`}
            >
              <i className="fa-solid fa-print"></i>
              <span>พิมพ์ / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total People */}
        <div className={`rounded-2xl p-3.5 flex flex-col justify-between border transition-all ${
          isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/70 border-white/10'
        }`}>
          <div className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>พนักงานทั้งหมด</div>
          <div className={`text-xl font-bold my-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>{stats.totalPeople} <span className="text-xs font-normal text-slate-400">คน</span></div>
          <div className="text-[10px] text-slate-400">แผนก BME PTP</div>
        </div>

        {/* Bull */}
        <div className={`rounded-2xl p-3.5 flex flex-col justify-between border transition-all ${
          isLight ? 'bg-rose-50/60 border-rose-200 shadow-xs' : 'bg-slate-900/70 border-rose-500/30'
        }`}>
          <div className={`text-[10px] font-semibold uppercase ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>🦬 กระทิง</div>
          <div className={`text-xl font-bold my-1 ${isLight ? 'text-rose-900' : 'text-rose-200'}`}>{stats.bullCount} <span className="text-xs font-normal text-slate-500">คน</span></div>
          <div className="text-[10px] text-rose-600 font-medium">{stats.bullPct}% ของแผนก</div>
        </div>

        {/* Eagle */}
        <div className={`rounded-2xl p-3.5 flex flex-col justify-between border transition-all ${
          isLight ? 'bg-amber-50/60 border-amber-200 shadow-xs' : 'bg-slate-900/70 border-amber-500/30'
        }`}>
          <div className={`text-[10px] font-semibold uppercase ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>🦅 อินทรีย์</div>
          <div className={`text-xl font-bold my-1 ${isLight ? 'text-amber-900' : 'text-amber-200'}`}>{stats.eagleCount} <span className="text-xs font-normal text-slate-500">คน</span></div>
          <div className="text-[10px] text-amber-600 font-medium">{stats.eaglePct}% ของแผนก</div>
        </div>

        {/* Bear */}
        <div className={`rounded-2xl p-3.5 flex flex-col justify-between border transition-all ${
          isLight ? 'bg-sky-50/60 border-sky-200 shadow-xs' : 'bg-slate-900/70 border-sky-500/30'
        }`}>
          <div className={`text-[10px] font-semibold uppercase ${isLight ? 'text-sky-700' : 'text-sky-300'}`}>🐻 หมี</div>
          <div className={`text-xl font-bold my-1 ${isLight ? 'text-sky-900' : 'text-sky-200'}`}>{stats.bearCount} <span className="text-xs font-normal text-slate-500">คน</span></div>
          <div className="text-[10px] text-sky-600 font-medium">{stats.bearPct}% ของแผนก</div>
        </div>

        {/* Mouse */}
        <div className={`rounded-2xl p-3.5 flex flex-col justify-between border transition-all ${
          isLight ? 'bg-emerald-50/60 border-emerald-200 shadow-xs' : 'bg-slate-900/70 border-emerald-500/30'
        }`}>
          <div className={`text-[10px] font-semibold uppercase ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>🐭 หนู</div>
          <div className={`text-xl font-bold my-1 ${isLight ? 'text-emerald-900' : 'text-emerald-200'}`}>{stats.mouseCount} <span className="text-xs font-normal text-slate-500">คน</span></div>
          <div className="text-[10px] text-emerald-600 font-medium">{stats.mousePct}% ของแผนก</div>
        </div>

        {/* Total Hours */}
        <div className={`rounded-2xl p-3.5 flex flex-col justify-between border transition-all ${
          isLight ? 'bg-indigo-50/80 border-indigo-200 shadow-xs' : 'bg-gradient-to-br from-indigo-950/40 to-slate-900 border-indigo-500/30'
        }`}>
          <div className={`text-[10px] font-semibold uppercase ${isLight ? 'text-indigo-800' : 'text-indigo-300'}`}>ชั่วโมงสะสมรวม</div>
          <div className={`text-xl font-bold my-1 ${isLight ? 'text-indigo-900' : 'text-indigo-200'}`}>{stats.totalHours} <span className="text-xs font-normal text-slate-500">ชม.</span></div>
          <div className="text-[10px] text-indigo-700 font-medium">เฉลี่ย {stats.avgProgress}% ก้าวหน้า</div>
        </div>
      </div>

      {/* Filter Toolbar & View Toggle */}
      <div className={`rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/70 border-white/10'
      }`}>
        
        {/* Search & Select Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <i className={`fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-xs ${
              isLight ? 'text-slate-400' : 'text-slate-500'
            }`}></i>
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัสพนักงาน, ตำแหน่ง..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full rounded-xl pl-9 pr-4 py-2 text-xs transition-colors focus:outline-none border ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white'
                  : 'bg-slate-950/80 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500/50'
              }`}
            />
          </div>

          {/* Animal DISC Filter */}
          <select
            value={selectedAnimal}
            onChange={e => setSelectedAnimal(e.target.value)}
            className={`rounded-xl px-3 py-2 text-xs focus:outline-none border font-medium ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
                : 'bg-slate-950/80 border-white/10 text-slate-200'
            }`}
          >
            <option value="all">สัตว์ 4 ทิศ ทั้งหมด</option>
            <option value="กระทิง">🦬 กระทิง (Bull)</option>
            <option value="อินทรีย์">🦅 อินทรีย์ (Eagle)</option>
            <option value="หมี">🐻 หมี (Bear)</option>
            <option value="หนู">🐭 หนู (Mouse)</option>
          </select>

          {/* Contract Type Filter */}
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className={`rounded-xl px-3 py-2 text-xs focus:outline-none border font-medium ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
                : 'bg-slate-950/80 border-white/10 text-slate-200'
            }`}
          >
            <option value="all">ประเภทพนักงาน ทั้งหมด</option>
            <option value="Full Time">Full Time</option>
            <option value="Out source">Out source</option>
          </select>
        </div>

        {/* View Switcher Buttons */}
        <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-white/10'
        }`}>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'cards'
                ? isLight ? 'bg-white text-indigo-700 shadow-sm' : 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className="fa-solid fa-table-cells-large"></i>
            <span>การ์ดรายคน</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'table'
                ? isLight ? 'bg-white text-indigo-700 shadow-sm' : 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className="fa-solid fa-table"></i>
            <span>ตารางผังรวม</span>
          </button>
          <button
            onClick={() => setViewMode('catalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'catalog'
                ? isLight ? 'bg-white text-indigo-700 shadow-sm' : 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className="fa-solid fa-book-open"></i>
            <span>คู่มือหัวข้อ Coaching</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map(rec => {
            const badge = getAnimalBadge(rec.animalType);

            return (
              <div
                key={rec.id}
                className={`rounded-2xl p-4 border transition-all flex flex-col justify-between relative overflow-hidden group ${
                  isLight
                    ? 'bg-white border-slate-200 shadow-xs hover:border-indigo-300'
                    : 'bg-slate-900/80 border-white/10 shadow-xl hover:border-white/20'
                }`}
              >
                {/* Top header row */}
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-xs shadow-2xs flex-shrink-0 border ${
                        isLight
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-indigo-200'
                          : 'bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-white border-white/20'
                      }`}>
                        <span className="px-1 text-center truncate">{rec.nickname}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className={`font-bold text-sm truncate transition-colors ${
                            isLight ? 'text-slate-900 group-hover:text-indigo-600' : 'text-white group-hover:text-indigo-300'
                          }`} title={rec.fullName}>
                            {rec.fullName}
                          </h3>
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800/80 text-slate-400 border-slate-700'
                          }`}>
                            {rec.empId}
                          </span>
                        </div>
                        <p className={`text-[11px] font-normal ${
                          isLight ? 'text-indigo-600' : 'text-indigo-300/80'
                        }`}>
                          {rec.position} · <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>{rec.contractType}</span>
                        </p>
                      </div>
                    </div>

                    {/* Animal Badge */}
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border flex items-center gap-1 flex-shrink-0 ${badge.bg}`}>
                      <span>{badge.emoji}</span>
                      <span>{rec.animalType}</span>
                    </span>
                  </div>

                  {/* Coach Name */}
                  <div className={`mb-3 text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center justify-between font-normal ${
                    isLight ? 'bg-slate-50/80 border-slate-200/80 text-slate-600' : 'bg-slate-950/40 border-white/5 text-slate-300/80'
                  }`}>
                    <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>ผู้โค้ช (Coach):</span>
                    <span className={`font-semibold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>{rec.coachName || 'ชาลี'}</span>
                  </div>

                  {/* Priority 1, 2, 3 Coaching Topics */}
                  <div className="space-y-2 mb-3">
                    <div className={`text-[10px] font-semibold uppercase tracking-wide ${
                      isLight ? 'text-slate-400' : 'text-slate-400'
                    }`}>
                      เรื่องที่ต้อง Coaching (ลำดับ 1, 2, 3)
                    </div>

                    {/* Priority 1 */}
                    <div className={`p-2.5 rounded-xl border space-y-0.5 transition-all ${
                      isLight
                        ? 'bg-amber-50/70 border-amber-200/80'
                        : 'bg-amber-950/40 border-amber-500/40'
                    }`}>
                      <div className={`text-[10px] font-semibold uppercase ${
                        isLight ? 'text-amber-800' : 'text-amber-300'
                      }`}>
                        🥇 ลำดับที่ 1 (สำคัญที่สุด)
                      </div>
                      <p className={`text-xs font-normal leading-snug ${
                        isLight ? 'text-slate-800' : 'text-amber-100'
                      }`}>
                        {rec.topic1 || 'ยังไม่กำหนด'}
                      </p>
                    </div>

                    {/* Priority 2 */}
                    <div className={`p-2.5 rounded-xl border space-y-0.5 transition-all ${
                      isLight
                        ? 'bg-sky-50/70 border-sky-200/80'
                        : 'bg-sky-950/40 border-sky-500/40'
                    }`}>
                      <div className={`text-[10px] font-semibold uppercase ${
                        isLight ? 'text-sky-800' : 'text-sky-300'
                      }`}>
                        🥈 ลำดับที่ 2
                      </div>
                      <p className={`text-xs font-normal leading-snug ${
                        isLight ? 'text-slate-800' : 'text-sky-100'
                      }`}>
                        {rec.topic2 || 'ยังไม่กำหนด'}
                      </p>
                    </div>

                    {/* Priority 3 */}
                    <div className={`p-2.5 rounded-xl border space-y-0.5 transition-all ${
                      isLight
                        ? 'bg-emerald-50/70 border-emerald-200/80'
                        : 'bg-emerald-950/40 border-emerald-500/40'
                    }`}>
                      <div className={`text-[10px] font-semibold uppercase ${
                        isLight ? 'text-emerald-800' : 'text-emerald-300'
                      }`}>
                        🥉 ลำดับที่ 3
                      </div>
                      <p className={`text-xs font-normal leading-snug ${
                        isLight ? 'text-slate-800' : 'text-emerald-100'
                      }`}>
                        {rec.topic3 || 'ยังไม่กำหนด'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress & Hours Footer */}
                <div className={`pt-2.5 border-t space-y-2 ${
                  isLight ? 'border-slate-100' : 'border-white/10'
                }`}>
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] font-medium mb-1">
                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>ความก้าวหน้าการพัฒนา</span>
                      <span className={`font-mono text-xs ${isLight ? 'text-indigo-700 font-semibold' : 'text-indigo-300'}`}>
                        {rec.progressPercent || 0}% <span className="font-sans text-[10px] text-slate-400">({rec.evaluationScore || 0}/10)</span>
                      </span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden border ${
                      isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-white/5'
                    }`}>
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, rec.progressPercent || 0))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Hours summary & Edit Button */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <div className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                      <span className={`font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>ชั่วโมงสะสม:</span>{' '}
                      <span className={`font-mono text-xs ${isLight ? 'text-emerald-600 font-bold' : 'text-emerald-400'}`}>{rec.totalHours || 0}</span> ชม.
                    </div>

                    {canEditCoaching && (
                      <button
                        onClick={() => handleOpenEdit(rec)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1 ${
                          isLight
                            ? 'bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 border-slate-200 hover:border-indigo-600'
                            : 'bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                        <span>แก้ไข</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Master Data Table View */}
      {viewMode === 'table' && (
        <div className={`rounded-2xl overflow-hidden shadow-xl border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase text-[10px] font-extrabold tracking-wider border-b ${
                isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950/90 text-slate-300 border-white/10'
              }`}>
                <tr>
                  <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                  <th className="py-3 px-3">รหัส</th>
                  <th className="py-3 px-3">ชื่อ - สกุล (ชื่อเล่น)</th>
                  <th className="py-3 px-3">ตำแหน่ง / สัญญา</th>
                  <th className="py-3 px-3 text-center">สัตว์ 4 ทิศ</th>
                  <th className="py-3 px-3">โค้ช</th>
                  <th className="py-3 px-3 min-w-[180px]">🥇 Coaching ลำดับที่ 1</th>
                  <th className="py-3 px-3 min-w-[180px]">🥈 Coaching ลำดับที่ 2</th>
                  <th className="py-3 px-3 min-w-[180px]">🥉 Coaching ลำดับที่ 3</th>
                  <th className="py-3 px-3 text-center">คะแนน</th>
                  <th className="py-3 px-3 text-center">ก้าวหน้า (%)</th>
                  <th className="py-3 px-3 text-center">ชั่วโมงรวม</th>
                  {canEditCoaching && <th className="py-3 px-3 text-center">จัดการ</th>}
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-200 text-slate-800' : 'divide-white/5 text-slate-200'}`}>
                {filteredRecords.map((rec, idx) => {
                  const badge = getAnimalBadge(rec.animalType);
                  return (
                    <tr key={rec.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{rec.empId}</td>
                      <td className={`py-3 px-3 font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {rec.fullName} <span className="text-indigo-600 font-normal">({rec.nickname})</span>
                      </td>
                      <td className="py-3 px-3">
                        {rec.position} <span className="text-[10px] text-slate-400 block">{rec.contractType}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${badge.bg}`}>
                          <span>{badge.emoji}</span>
                          <span>{rec.animalType}</span>
                        </span>
                      </td>
                      <td className={`py-3 px-3 font-bold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>{rec.coachName || 'ชาลี'}</td>
                      <td className={`py-3 px-3 font-semibold ${isLight ? 'text-amber-900' : 'text-amber-200'}`}>{rec.topic1}</td>
                      <td className={`py-3 px-3 ${isLight ? 'text-sky-900' : 'text-sky-200'}`}>{rec.topic2}</td>
                      <td className={`py-3 px-3 ${isLight ? 'text-emerald-900' : 'text-emerald-200'}`}>{rec.topic3}</td>
                      <td className={`py-3 px-3 text-center font-mono font-bold ${isLight ? 'text-indigo-700' : 'text-indigo-300'}`}>{rec.evaluationScore || 0}/10</td>
                      <td className={`py-3 px-3 text-center font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>{rec.progressPercent || 0}%</td>
                      <td className={`py-3 px-3 text-center font-mono font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>{rec.totalHours || 0} ชม.</td>
                      {canEditCoaching && (
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleOpenEdit(rec)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isLight
                                ? 'bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white border-slate-200'
                                : 'bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border-slate-700'
                            }`}
                            title="แก้ไขข้อมูล Coaching"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Topic Catalog Guide View */}
      {viewMode === 'catalog' && (
        <div className="space-y-6">
          <div className={`rounded-2xl p-5 space-y-2 border ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/80 border-white/10'
          }`}>
            <h3 className={`text-lg font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <i className="fa-solid fa-compass text-indigo-500"></i>
              <span>คู่มือแคตตาล็อกหัวข้อ Coaching ตามสัตว์ 4 ทิศ (DISC Topics)</span>
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              อ้างอิงหัวข้อการ Coaching ตามจุดเด่นและจุดที่ต้องพัฒนาของแต่ละสไตล์บุคลิกภาพสัตว์ 4 ทิศ และ Leader Topics
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bull Category */}
            <div className={`rounded-2xl p-5 space-y-3 border ${
              isLight ? 'bg-rose-50/50 border-rose-200 shadow-sm' : 'bg-slate-900/70 border-rose-500/30'
            }`}>
              <div className="flex items-center gap-2 pb-2 border-b border-rose-200">
                <span className="text-2xl">🦬</span>
                <div>
                  <h4 className={`font-extrabold text-base ${isLight ? 'text-rose-950' : 'text-rose-200'}`}>หมวดกระทิง (Bull - Action & Results)</h4>
                  <p className={`text-[11px] ${isLight ? 'text-rose-700' : 'text-rose-300/70'}`}>มุ่งมั่น ลุยงาน ตรงไปตรงมา เน้นผลลัพธ์</p>
                </div>
              </div>
              <ul className="space-y-2">
                {COACHING_TOPIC_CATALOG['กระทิง'].map((t, idx) => (
                  <li key={idx} className={`text-xs flex items-center gap-2 p-2.5 rounded-xl border ${
                    isLight ? 'bg-white border-rose-100 text-slate-800' : 'bg-slate-950/40 border-white/5 text-slate-200'
                  }`}>
                    <i className="fa-solid fa-check text-rose-500 text-[10px]"></i>
                    <span className="font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Eagle Category */}
            <div className={`rounded-2xl p-5 space-y-3 border ${
              isLight ? 'bg-amber-50/50 border-amber-200 shadow-sm' : 'bg-slate-900/70 border-amber-500/30'
            }`}>
              <div className="flex items-center gap-2 pb-2 border-b border-amber-200">
                <span className="text-2xl">🦅</span>
                <div>
                  <h4 className={`font-extrabold text-base ${isLight ? 'text-amber-950' : 'text-amber-200'}`}>หมวดอินทรีย์ (Eagle - Vision & Ideas)</h4>
                  <p className={`text-[11px] ${isLight ? 'text-amber-700' : 'text-amber-300/70'}`}>มองภาพรวม มีวิสัยทัศน์ ความคิดสร้างสรรค์</p>
                </div>
              </div>
              <ul className="space-y-2">
                {COACHING_TOPIC_CATALOG['อินทรีย์'].map((t, idx) => (
                  <li key={idx} className={`text-xs flex items-center gap-2 p-2.5 rounded-xl border ${
                    isLight ? 'bg-white border-amber-100 text-slate-800' : 'bg-slate-950/40 border-white/5 text-slate-200'
                  }`}>
                    <i className="fa-solid fa-check text-amber-500 text-[10px]"></i>
                    <span className="font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bear Category */}
            <div className={`rounded-2xl p-5 space-y-3 border ${
              isLight ? 'bg-sky-50/50 border-sky-200 shadow-sm' : 'bg-slate-900/70 border-sky-500/30'
            }`}>
              <div className="flex items-center gap-2 pb-2 border-b border-sky-200">
                <span className="text-2xl">🐻</span>
                <div>
                  <h4 className={`font-extrabold text-base ${isLight ? 'text-sky-950' : 'text-sky-200'}`}>หมวดหมี (Bear - Process & Details)</h4>
                  <p className={`text-[11px] ${isLight ? 'text-sky-700' : 'text-sky-300/70'}`}>รอบคอบ มีระบบ มีหลักการ และลงรายละเอียด</p>
                </div>
              </div>
              <ul className="space-y-2">
                {COACHING_TOPIC_CATALOG['หมี'].map((t, idx) => (
                  <li key={idx} className={`text-xs flex items-center gap-2 p-2.5 rounded-xl border ${
                    isLight ? 'bg-white border-sky-100 text-slate-800' : 'bg-slate-950/40 border-white/5 text-slate-200'
                  }`}>
                    <i className="fa-solid fa-check text-sky-500 text-[10px]"></i>
                    <span className="font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mouse Category */}
            <div className={`rounded-2xl p-5 space-y-3 border ${
              isLight ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-slate-900/70 border-emerald-500/30'
            }`}>
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-200">
                <span className="text-2xl">🐭</span>
                <div>
                  <h4 className={`font-extrabold text-base ${isLight ? 'text-emerald-950' : 'text-emerald-200'}`}>หมวดหนู (Mouse - Relationship & Empathy)</h4>
                  <p className={`text-[11px] ${isLight ? 'text-emerald-700' : 'text-emerald-300/70'}`}>ประนีประนอม ใส่ใจความรู้สึก สร้างสัมพันธภาพ</p>
                </div>
              </div>
              <ul className="space-y-2">
                {COACHING_TOPIC_CATALOG['หนู'].map((t, idx) => (
                  <li key={idx} className={`text-xs flex items-center gap-2 p-2.5 rounded-xl border ${
                    isLight ? 'bg-white border-emerald-100 text-slate-800' : 'bg-slate-950/40 border-white/5 text-slate-200'
                  }`}>
                    <i className="fa-solid fa-check text-emerald-500 text-[10px]"></i>
                    <span className="font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Leader Topics Category */}
            <div className={`rounded-2xl p-5 space-y-3 md:col-span-2 border ${
              isLight ? 'bg-purple-50/50 border-purple-200 shadow-sm' : 'bg-slate-900/70 border-purple-500/30'
            }`}>
              <div className="flex items-center gap-2 pb-2 border-b border-purple-200">
                <span className="text-2xl">👑</span>
                <div>
                  <h4 className={`font-extrabold text-base ${isLight ? 'text-purple-950' : 'text-purple-200'}`}>Leader Topics (หัวข้อสำหรับผู้บริหารและหัวหน้าทีม)</h4>
                  <p className={`text-[11px] ${isLight ? 'text-purple-700' : 'text-purple-300/70'}`}>การนำองค์กร, บริหารจัดการคน, Strategic Thinking & Change Leadership</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {COACHING_TOPIC_CATALOG['Leader'].map((t, idx) => (
                  <div key={idx} className={`text-xs flex items-center gap-2 p-2.5 rounded-xl border ${
                    isLight ? 'bg-white border-purple-100 text-slate-800' : 'bg-slate-950/40 border-white/5 text-slate-200'
                  }`}>
                    <i className="fa-solid fa-star text-purple-500 text-[10px]"></i>
                    <span className="font-medium">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className={`rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8 border ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/20 text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-400/30 flex items-center justify-center text-indigo-600 font-bold">
                  <i className="fa-solid fa-pen-to-square"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base">แก้ไขข้อมูล Coaching</h3>
                  <p className="text-xs text-indigo-600 font-bold">{editingRecord.fullName} ({editingRecord.nickname})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              
              {/* DISC Animal Type Select */}
              <div>
                <label className="block font-bold mb-1 text-slate-700">ประเภทสัตว์ 4 ทิศ (DISC)</label>
                <select
                  value={editForm.animalType || 'หมี'}
                  onChange={e => setEditForm({ ...editForm, animalType: e.target.value as AnimalDISCType })}
                  className={`w-full rounded-xl px-3 py-2 border font-medium ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-white/10 text-white'
                  }`}
                >
                  <option value="กระทิง">🦬 กระทิง (Bull)</option>
                  <option value="อินทรีย์">🦅 อินทรีย์ (Eagle)</option>
                  <option value="หมี">🐻 หมี (Bear)</option>
                  <option value="หนู">🐭 หนู (Mouse)</option>
                </select>
              </div>

              {/* Coach Name */}
              <div>
                <label className="block font-bold mb-1 text-slate-700">ผู้โค้ช (Coach)</label>
                <input
                  type="text"
                  value={editForm.coachName || ''}
                  onChange={e => setEditForm({ ...editForm, coachName: e.target.value })}
                  className={`w-full rounded-xl px-3 py-2 border font-medium ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-white/10 text-white'
                  }`}
                />
              </div>

              {/* Topic 1 */}
              <div>
                <label className="block font-bold mb-1 text-amber-800">🥇 เรื่องที่ Coaching ลำดับที่ 1</label>
                <input
                  type="text"
                  value={editForm.topic1 || ''}
                  onChange={e => setEditForm({ ...editForm, topic1: e.target.value })}
                  className={`w-full rounded-xl px-3 py-2 border font-medium ${
                    isLight ? 'bg-amber-50/60 border-amber-300 text-slate-900' : 'bg-slate-950 border-amber-500/30 text-white'
                  }`}
                />
              </div>

              {/* Topic 2 */}
              <div>
                <label className="block font-bold mb-1 text-sky-800">🥈 เรื่องที่ Coaching ลำดับที่ 2</label>
                <input
                  type="text"
                  value={editForm.topic2 || ''}
                  onChange={e => setEditForm({ ...editForm, topic2: e.target.value })}
                  className={`w-full rounded-xl px-3 py-2 border font-medium ${
                    isLight ? 'bg-sky-50/60 border-sky-300 text-slate-900' : 'bg-slate-950 border-sky-500/30 text-white'
                  }`}
                />
              </div>

              {/* Topic 3 */}
              <div>
                <label className="block font-bold mb-1 text-emerald-800">🥉 เรื่องที่ Coaching ลำดับที่ 3</label>
                <input
                  type="text"
                  value={editForm.topic3 || ''}
                  onChange={e => setEditForm({ ...editForm, topic3: e.target.value })}
                  className={`w-full rounded-xl px-3 py-2 border font-medium ${
                    isLight ? 'bg-emerald-50/60 border-emerald-300 text-slate-900' : 'bg-slate-950 border-emerald-500/30 text-white'
                  }`}
                />
              </div>

              {/* Evaluation Score & Progress */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-700">คะแนนประเมิน (1 - 10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    value={editForm.evaluationScore ?? 0}
                    onChange={e => setEditForm({ ...editForm, evaluationScore: parseFloat(e.target.value) || 0 })}
                    className={`w-full rounded-xl px-3 py-2 border font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-white/10 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-slate-700">ความก้าวหน้า (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.progressPercent ?? 0}
                    onChange={e => setEditForm({ ...editForm, progressPercent: parseInt(e.target.value, 10) || 0 })}
                    className={`w-full rounded-xl px-3 py-2 border font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-white/10 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Weekly Hours Breakdown */}
              <div className={`p-3 rounded-2xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-white/10'
              }`}>
                <label className="block font-extrabold text-slate-800">บันทึกชั่วโมงรายสัปดาห์ (Week 1 - 6)</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">W1</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.hoursW1 ?? 0}
                      onChange={e => setEditForm({ ...editForm, hoursW1: parseFloat(e.target.value) || 0 })}
                      className={`w-full rounded-lg p-1.5 text-center font-mono border ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">W2</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.hoursW2 ?? 0}
                      onChange={e => setEditForm({ ...editForm, hoursW2: parseFloat(e.target.value) || 0 })}
                      className={`w-full rounded-lg p-1.5 text-center font-mono border ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">W3</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.hoursW3 ?? 0}
                      onChange={e => setEditForm({ ...editForm, hoursW3: parseFloat(e.target.value) || 0 })}
                      className={`w-full rounded-lg p-1.5 text-center font-mono border ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">W4</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.hoursW4 ?? 0}
                      onChange={e => setEditForm({ ...editForm, hoursW4: parseFloat(e.target.value) || 0 })}
                      className={`w-full rounded-lg p-1.5 text-center font-mono border ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">W5</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.hoursW5 ?? 0}
                      onChange={e => setEditForm({ ...editForm, hoursW5: parseFloat(e.target.value) || 0 })}
                      className={`w-full rounded-lg p-1.5 text-center font-mono border ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">W6</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.hoursW6 ?? 0}
                      onChange={e => setEditForm({ ...editForm, hoursW6: parseFloat(e.target.value) || 0 })}
                      className={`w-full rounded-lg p-1.5 text-center font-mono border ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Submit / Cancel buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 border border-slate-300"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
