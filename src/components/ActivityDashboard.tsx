import React, { useState, useEffect, useMemo } from 'react';
import { ActivityRecord, Employee, HappyLifeClub } from '../types';
import { StorageService } from '../services/storage';
import { HAPPY_LIFE_CLUBS } from '../data/initialData';

interface ActivityDashboardProps {
  currentUser: Employee | null;
}

export const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ currentUser }) => {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Filter States
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [searchQuery, setSearchKeyword] = useState<string>('');

  // Date Filter States (วัน / เดือน / ปี)
  const [dateFilterType, setDateFilterType] = useState<'all' | 'date' | 'month' | 'year' | 'range'>('all');
  const [filterSpecificDate, setFilterSpecificDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  ); // YYYY-MM-DD
  const [filterMonthKey, setFilterMonthKey] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  ); // YYYY-MM
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Google Sheets Integration Modal
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [gasUrl, setGasUrl] = useState<string>(() => localStorage.getItem('csi_google_sheets_url') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = () => {
    setActivities(StorageService.getActivities());
    setEmployees(StorageService.getEmployees().filter(e => e.status === 'active'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const photoMap = useMemo(() => {
    const map: { [username: string]: string } = {};
    employees.forEach(e => {
      map[e.username] = e.img;
      map[e.fullName] = e.img;
    });
    return map;
  }, [employees]);

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    activities.forEach(a => {
      if (a.timestamp) {
        const y = new Date(a.timestamp).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [activities]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      if (selectedClub && act.club !== selectedClub) return false;

      // Filter by Date / Month / Year / Range
      if (dateFilterType === 'date') {
        if (filterSpecificDate) {
          const actDate = act.timestamp ? act.timestamp.substring(0, 10) : '';
          if (actDate !== filterSpecificDate) return false;
        }
      } else if (dateFilterType === 'month') {
        if (filterMonthKey) {
          if (!act.timestamp.startsWith(filterMonthKey)) return false;
        }
      } else if (dateFilterType === 'year') {
        if (filterYear) {
          const actYear = new Date(act.timestamp).getFullYear();
          if (actYear !== filterYear) return false;
        }
      } else if (dateFilterType === 'range') {
        const actDateStr = act.timestamp ? act.timestamp.substring(0, 10) : '';
        if (startDate && actDateStr < startDate) return false;
        if (endDate && actDateStr > endDate) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = act.fullName.toLowerCase().includes(q) || act.nickname.toLowerCase().includes(q);
        const matchAct = act.activityName.toLowerCase().includes(q);
        if (!matchName && !matchAct) return false;
      }
      return true;
    });
  }, [activities, selectedClub, dateFilterType, filterSpecificDate, filterMonthKey, filterYear, startDate, endDate, searchQuery]);

  // Aggregated total hours per employee
  const employeeStats = useMemo(() => {
    const map: {
      [username: string]: {
        username: string;
        fullName: string;
        nickname: string;
        club: HappyLifeClub;
        img: string;
        totalMinutes: number;
        activityCount: number;
      };
    } = {};

    // Initialize map with all active employees
    employees.forEach(emp => {
      map[emp.username] = {
        username: emp.username,
        fullName: emp.fullName,
        nickname: emp.nickname,
        club: emp.club,
        img: emp.img,
        totalMinutes: 0,
        activityCount: 0
      };
    });

    // Sum up filtered activities
    filteredActivities.forEach(act => {
      if (!map[act.username]) {
        map[act.username] = {
          username: act.username,
          fullName: act.fullName,
          nickname: act.nickname,
          club: act.club,
          img: photoMap[act.username] || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(act.nickname)}`,
          totalMinutes: 0,
          activityCount: 0
        };
      }
      map[act.username].totalMinutes += act.totalMinutes;
      map[act.username].activityCount += 1;
    });

    let list = Object.values(map);

    if (selectedClub) {
      list = list.filter(e => e.club === selectedClub);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e => e.fullName.toLowerCase().includes(q) || e.nickname.toLowerCase().includes(q));
    }

    return list.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filteredActivities, employees, photoMap, selectedClub, searchQuery]);

  const totalSystemMinutes = useMemo(() => {
    return filteredActivities.reduce((sum, a) => sum + a.totalMinutes, 0);
  }, [filteredActivities]);

  const handleDeleteActivity = (id: string) => {
    if (confirm('คุณต้องการลบรายการบันทึกกิจกรรมนี้ใช่หรือไม่?')) {
      StorageService.deleteActivity(id);
      loadData();
    }
  };

  const formatHoursMinutes = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h} ชม. ${m} นาที`;
  };

  // Copy Data for Google Sheets
  const handleCopyForGoogleSheets = () => {
    if (filteredActivities.length === 0) {
      alert('ไม่มีข้อมูลในเงื่อนไขการค้นหานี้');
      return;
    }
    const headers = ['วันที่ทำกิจกรรม', 'ผู้บันทึกกิจกรรม', 'ชื่อเล่น', 'รหัสพนักงาน', 'ชมรมที่สังกัด', 'ประเภทกิจกรรม', 'ชื่อกิจกรรม', 'ชั่วโมง', 'นาที', 'นาทีรวม', 'รายละเอียด'];
    const rows = filteredActivities.map(a => [
      new Date(a.timestamp).toLocaleDateString('th-TH'),
      a.fullName,
      a.nickname,
      a.username,
      a.club,
      a.activityCategory,
      a.activityName,
      a.hours,
      a.minutes,
      a.totalMinutes,
      `"${(a.description || '').replace(/"/g, '""')}"`
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent);
    alert('คัดลอกข้อมูลตารางตารางสำหรับวางลงใน Google Sheets สำเร็จ! (เปิด Google Sheet แล้วกด Ctrl+V วางได้ทันที)');
  };

  // Sync to Web App URL (Google Apps Script)
  const handleSaveGasUrl = () => {
    localStorage.setItem('csi_google_sheets_url', gasUrl.trim());
    setSyncMessage({ type: 'success', text: 'บันทึก Google Apps Script Web App URL เรียบร้อยแล้ว' });
  };

  const handleSyncToSheets = async () => {
    if (!gasUrl.trim()) {
      setSyncMessage({ type: 'error', text: 'กรุณาระบุ Web App URL ของ Google Apps Script ก่อนส่งข้อมูล' });
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      localStorage.setItem('csi_google_sheets_url', gasUrl.trim());

      const payload = {
        action: 'sync_activities',
        timestamp: new Date().toISOString(),
        totalRecords: filteredActivities.length,
        activities: filteredActivities.map(a => ({
          date: new Date(a.timestamp).toLocaleDateString('th-TH'),
          username: a.username,
          fullName: a.fullName,
          nickname: a.nickname,
          club: a.club,
          category: a.activityCategory,
          activityName: a.activityName,
          hours: a.hours,
          minutes: a.minutes,
          totalMinutes: a.totalMinutes,
          description: a.description || ''
        }))
      };

      await fetch(gasUrl.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      setSyncMessage({
        type: 'success',
        text: `ส่งข้อมูลกิจกรรมทั้ง ${filteredActivities.length} รายการไปยัง Google Sheet สำเร็จแล้ว!`
      });
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets: ${err.message || 'โปรดตรวจสอบ URL'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-full text-slate-100 p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel border border-white/15 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl shadow-lg border border-white/20">
            <i className="fa-solid fa-trophy"></i>
          </div>
          <div>
            <h1 className="font-th font-extrabold text-xl text-white">แดชบอร์ดสรุปชั่วโมงกิจกรรม</h1>
            <p className="text-xs text-slate-300 font-medium">สรุปชั่วโมงการเข้าร่วมกิจกรรม Happy Life & HR-PTP รายบุคคล</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSheetsModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600/80 hover:bg-emerald-500 text-white font-th font-bold text-xs border border-emerald-400/30 flex items-center gap-2 shadow-lg transition-all"
          >
            <i className="fa-solid fa-file-excel text-emerald-200 text-sm"></i>
            <span>เชื่อมต่อ Google Sheets</span>
          </button>

          <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-2xl px-5 py-2 text-center sm:text-right backdrop-blur-md">
            <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">ชั่วโมงสะสมรวมทั้งหมด</div>
            <div className="font-th font-black text-xl text-emerald-200">
              {formatHoursMinutes(totalSystemMinutes)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar (Date Filter: วัน/เดือน/ปี + ชมรม + ค้นหา) */}
      <div className="glass-panel border border-white/15 rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-slate-200 text-xs font-bold">
            <i className="fa-solid fa-filter text-emerald-400"></i>
            <span>ฟิลเตอร์ข้อมูลกิจกรรม:</span>
          </div>

          {/* Date Filter Type Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setDateFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilterType === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              ทั้งหมด
            </button>

            <button
              onClick={() => setDateFilterType('date')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilterType === 'date'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className="fa-regular fa-calendar-check mr-1"></i>รายวัน
            </button>

            <button
              onClick={() => setDateFilterType('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilterType === 'month'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className="fa-regular fa-calendar-days mr-1"></i>รายเดือน
            </button>

            <button
              onClick={() => setDateFilterType('year')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilterType === 'year'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className="fa-solid fa-calendar mr-1"></i>รายปี
            </button>

            <button
              onClick={() => setDateFilterType('range')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilterType === 'range'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className="fa-solid fa-arrow-right-to-city mr-1"></i>ช่วงวันที่
            </button>
          </div>
        </div>

        {/* Filter Inputs Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Specific Date Picker */}
          {dateFilterType === 'date' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-bold">วันที่:</span>
              <input
                type="date"
                value={filterSpecificDate}
                onChange={e => setFilterSpecificDate(e.target.value)}
                className="bg-slate-900/90 border border-white/15 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {/* Month Picker */}
          {dateFilterType === 'month' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-bold">เลือกเดือน/ปี:</span>
              <input
                type="month"
                value={filterMonthKey}
                onChange={e => setFilterMonthKey(e.target.value)}
                className="bg-slate-900/90 border border-white/15 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {/* Year Select */}
          {dateFilterType === 'year' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-bold">เลือกปี พ.ศ./ค.ศ.:</span>
              <select
                value={filterYear}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="bg-slate-900/90 border border-white/15 text-white text-xs font-bold rounded-xl px-3.5 py-2 outline-none focus:border-emerald-400"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    ปี ค.ศ. {y} (พ.ศ. {y + 543})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Inputs */}
          {dateFilterType === 'range' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-300 font-bold">ตั้งแต่วันที่:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-slate-900/90 border border-white/15 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
              />
              <span className="text-xs text-slate-300 font-bold">ถึงวันที่:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-slate-900/90 border border-white/15 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {/* Club filter */}
          <select
            value={selectedClub}
            onChange={e => setSelectedClub(e.target.value)}
            className="bg-slate-900/90 border border-white/15 text-white text-xs font-semibold rounded-xl px-3.5 py-2 outline-none focus:border-emerald-400 min-w-[150px]"
          >
            <option value="" className="bg-slate-900 text-white">ทุกชมรม ({HAPPY_LIFE_CLUBS.length})</option>
            {HAPPY_LIFE_CLUBS.map(c => (
              <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="ค้นหาชื่อพนักงาน หรือชื่อกิจกรรม..."
              className="w-full bg-slate-900/90 border border-white/15 text-white text-xs font-semibold rounded-xl pl-8 pr-3 py-2 outline-none focus:border-emerald-400"
            />
          </div>

          <button
            onClick={loadData}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="รีเฟรชข้อมูล"
          >
            <i className="fa-solid fa-rotate"></i>
            <span>รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* Leaderboard Cards showing Employee photo & total activity hours */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-th font-extrabold text-base text-white flex items-center gap-2">
            <i className="fa-solid fa-award text-amber-400"></i>
            <span>อันดับสะสมชั่วโมงกิจกรรมรายบุคคล</span>
          </h2>
          <span className="text-xs text-slate-400">
            แสดง {employeeStats.length} พนักงาน
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employeeStats.map((emp, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            return (
              <div
                key={emp.username}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-3.5 relative overflow-hidden backdrop-blur-xl ${
                  idx < 3
                    ? 'glass-card border-amber-400/40 shadow-xl shadow-amber-500/5'
                    : 'glass-card border-white/10 hover:border-white/20'
                }`}
              >
                {/* Ranking Badge */}
                <div className="text-xl font-black text-amber-400 w-7 text-center flex-shrink-0">
                  {medal}
                </div>

                {/* Employee Photo Avatar */}
                <img
                  src={emp.img || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.nickname)}`}
                  alt={emp.nickname}
                  className="w-13 h-13 rounded-2xl object-cover bg-slate-800 border-2 border-emerald-400/60 shadow-md flex-shrink-0"
                  onError={e => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.nickname)}`;
                  }}
                />

                {/* Employee Details */}
                <div className="flex-1 min-w-0">
                  <div className="font-th font-extrabold text-sm text-white truncate">
                    {emp.fullName} ({emp.nickname})
                  </div>
                  <div className="text-[11px] text-emerald-300 font-bold truncate mt-0.5">
                    <i className="fa-solid fa-users-rectangle mr-1 text-[10px]"></i>{emp.club}
                  </div>
                  <div className="text-[10px] text-slate-300 mt-1">
                    เข้าร่วม {emp.activityCount} ครั้ง
                  </div>
                </div>

                {/* Hours Display */}
                <div className="text-right flex-shrink-0">
                  <div className="font-th font-black text-base text-amber-300">
                    {formatHoursMinutes(emp.totalMinutes)}
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    {emp.totalMinutes} นาที
                  </div>
                </div>
              </div>
            );
          })}

          {employeeStats.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs glass-panel rounded-2xl border border-white/10">
              ไม่พบข้อมูลชั่วโมงกิจกรรมในเงื่อนไขการค้นหา/ฟิลเตอร์นี้
            </div>
          )}
        </div>
      </div>

      {/* Activity Logs History Table */}
      <div className="glass-panel border border-white/15 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-th font-extrabold text-sm text-white flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-teal-400"></i>
            <span>ประวัติการบันทึกกิจกรรมตามเงื่อนไขที่เลือก ({filteredActivities.length} รายการ)</span>
          </h3>

          <button
            onClick={handleCopyForGoogleSheets}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <i className="fa-regular fa-copy"></i>
            <span>คัดลอกตารางไปวางใน Google Sheets</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-xs text-left text-slate-200">
            <thead className="bg-slate-950/80 text-slate-300 font-bold border-b border-white/10">
              <tr>
                <th className="p-3">วันที่ทำกิจกรรม</th>
                <th className="p-3">ชื่อพนักงาน</th>
                <th className="p-3">ชมรมที่สังกัด</th>
                <th className="p-3">ประเภทกิจกรรม</th>
                <th className="p-3">ชื่อกิจกรรม</th>
                <th className="p-3">ชั่วโมง/นาที</th>
                <th className="p-3">รายละเอียด</th>
                {currentUser?.isAdmin && <th className="p-3 text-right">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredActivities.map(act => (
                <tr key={act.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                    {new Date(act.timestamp).toLocaleDateString('th-TH')}
                  </td>
                  <td className="p-3 font-bold text-white whitespace-nowrap">
                    {act.fullName} ({act.nickname})
                  </td>
                  <td className="p-3 text-emerald-300 font-semibold whitespace-nowrap">
                    {act.club}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      act.activityCategory === 'Happy Life' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' :
                      act.activityCategory === 'HR-PTP' ? 'bg-teal-500/20 text-teal-200 border border-teal-400/30' :
                      'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30'
                    }`}>
                      {act.activityCategory}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-amber-300 whitespace-nowrap">
                    {act.activityName}
                  </td>
                  <td className="p-3 font-extrabold text-white whitespace-nowrap">
                    {act.hours} ชม. {act.minutes} นาที
                  </td>
                  <td className="p-3 text-slate-300 max-w-xs truncate">
                    {act.description || '—'}
                  </td>
                  {currentUser?.isAdmin && (
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteActivity(act.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 font-bold text-xs"
                        title="ลบรายการนี้"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredActivities.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    ยังไม่มีข้อมูลประวัติกิจกรรมตามฟิลเตอร์นี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Sheets Connection Modal */}
      {showSheetsModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-xl">
                  <i className="fa-solid fa-file-excel"></i>
                </div>
                <div>
                  <h3 className="font-th font-extrabold text-lg text-white">
                    วิธีเชื่อมต่อแอปกับ Google Sheets
                  </h3>
                  <p className="text-xs text-slate-400">
                    ซิงค์ข้อมูลกิจกรรม หรือคัดลอกลง Google Sheet ที่มีอยู่
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSheetsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Option A: Quick Copy */}
            <div className="glass-card border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
              <div className="font-th font-extrabold text-sm text-emerald-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">1</span>
                <span>วิธีที่ 1: คัดลอกและวางลงใน Google Sheets ทันที (ไม่ต้องตั้งค่า)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                คลิกปุ่มด้านล่างนี้ จากนั้นเปิดไฟล์ Google Sheets ของคุณและกด <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-white/20 font-mono text-[11px]">Ctrl + V</kbd> (หรือ Command + V บน Mac) ในเซลล์ A1 ข้อมูลจะถูกจัดลงคอลัมน์ให้อย่างสวยงามอัตโนมัติ
              </p>
              <button
                onClick={handleCopyForGoogleSheets}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-th font-bold text-xs shadow-md flex items-center gap-2"
              >
                <i className="fa-regular fa-copy"></i>
                <span>คัดลอกข้อมูล {filteredActivities.length} รายการสำหรับ Google Sheets</span>
              </button>
            </div>

            {/* Option B: Direct Sync via Google Apps Script */}
            <div className="glass-card border border-white/15 rounded-2xl p-4 space-y-3">
              <div className="font-th font-extrabold text-sm text-teal-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-500 text-slate-950 font-black text-xs flex items-center justify-center">2</span>
                <span>วิธีที่ 2: เชื่อมต่ออัตโนมัติผ่าน Google Apps Script Web App</span>
              </div>

              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>เปิด Google Sheet ของคุณ แล้วไปที่เมนู <strong>ส่วนขยาย (Extensions)</strong> &gt; <strong>Apps Script</strong></li>
                  <li>วางโค้ด Apps Script (ดูสคริปต์แนะนำด้านล่าง) แล้วกด <strong>การทบทวน (Deploy)</strong> &gt; <strong>การปรับใช้ใหม่ (New deployment)</strong></li>
                  <li>เลือกประเภทเป็น <strong>เว็บแอป (Web app)</strong> และตั้งค่า "ผู้ที่มีสิทธิ์เข้าถึง" เป็น <strong>ทุกคน (Anyone)</strong></li>
                  <li>คัดลอก <strong>URL ของเว็บแอป (Web App URL)</strong> มาวางใส่ช่องด้านล่างนี้</li>
                </ol>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-300">
                  Google Apps Script Web App URL:
                </label>
                <input
                  type="url"
                  value={gasUrl}
                  onChange={e => setGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full bg-slate-950 border border-white/20 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-emerald-400 font-mono"
                />
              </div>

              {syncMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold ${
                  syncMessage.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                    : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
                }`}>
                  {syncMessage.text}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveGasUrl}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10"
                >
                  บันทึก URL
                </button>
                <button
                  onClick={handleSyncToSheets}
                  disabled={isSyncing}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-th font-bold text-xs shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      <span>กำลังส่งข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i>
                      <span>ส่งข้อมูลไปยัง Google Sheet ทันที</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Google Apps Script Code Template */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  สคริปต์ Google Apps Script สำหรับคัดลอกไปวางใน Google Sheet:
                </span>
                <button
                  onClick={() => {
                    const code = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  if (data.activities && data.activities.length > 0) {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["วันที่ทำกิจกรรม", "รหัสพนักงาน", "ชื่อผู้บันทึก", "ชื่อเล่น", "ชมรม", "หมวดหมู่", "ชื่อกิจกรรม", "ชั่วโมง", "นาที", "นาทีรวม", "รายละเอียด"]);
    }
    data.activities.forEach(function(act) {
      sheet.appendRow([act.date, act.username, act.fullName, act.nickname, act.club, act.category, act.activityName, act.hours, act.minutes, act.totalMinutes, act.description]);
    });
  }
  return ContentService.createTextOutput("SUCCESS").setMimeType(ContentService.MimeType.TEXT);
}`;
                    navigator.clipboard.writeText(code);
                    alert('คัดลอกสคริปต์ Apps Script สำเร็จ!');
                  }}
                  className="text-[11px] font-bold text-emerald-300 hover:underline"
                >
                  คัดลอกสคริปต์
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-white/10 rounded-xl text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-36">
{`function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  if (data.activities && data.activities.length > 0) {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["วันที่ทำกิจกรรม", "รหัสพนักงาน", "ชื่อผู้บันทึก", "ชื่อเล่น", "ชมรม", "หมวดหมู่", "ชื่อกิจกรรม", "ชั่วโมง", "นาที", "นาทีรวม", "รายละเอียด"]);
    }
    data.activities.forEach(function(act) {
      sheet.appendRow([act.date, act.username, act.fullName, act.nickname, act.club, act.category, act.activityName, act.hours, act.minutes, act.totalMinutes, act.description]);
    });
  }
  return ContentService.createTextOutput("SUCCESS").setMimeType(ContentService.MimeType.TEXT);
}`}
              </pre>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowSheetsModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-th font-bold text-xs border border-white/15"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
