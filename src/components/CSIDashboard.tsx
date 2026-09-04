import React, { useState, useEffect, useMemo } from 'react';
import { CSIRecord } from '../types';
import { StorageService } from '../services/storage';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, RadialLinearScale } from 'chart.js';
import { Bar, Line, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend
);

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

const SCORE_COLORS: { [key: number]: string } = {
  1: '#f43f5e',
  2: '#fb923c',
  3: '#fbbf24',
  4: '#34d399',
  5: '#60a5fa'
};

const isEmpty = (v: any) => !v || ['-', '_', '.', 'ไม่มี', 'ไม่มีค่ะ', 'ไม่มีครับ', 'n/a', 'none', 'null', 'undefined', ''].includes(String(v).trim().toLowerCase());
const splitStaff = (str: string) => isEmpty(str) ? [] : String(str).split(',').map(s => s.trim()).filter(s => s && !isEmpty(s));
const avgArr = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : 0;

export const CSIDashboard: React.FC = () => {
  const [rawData, setRawData] = useState<CSIRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [dedupeMode, setDedupeMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'scores' | 'staff' | 'insights' | 'suggestions'>('overview');
  const [sugCategory, setSugCategory] = useState<string>('all');

  // Google Sheet Auto Sync State
  const [sheetId, setSheetId] = useState<string>(StorageService.getGoogleSheetId());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [showSheetModal, setShowSheetModal] = useState<boolean>(false);

  const loadData = () => {
    const data = StorageService.getCSIRecords();
    setRawData(data);
  };

  const handleSyncFromSheet = async (targetId?: string) => {
    setIsSyncing(true);
    setSyncMessage('กำลังเชื่อมต่อและดึงข้อมูลจาก Google Sheet...');
    const result = await StorageService.fetchAndSyncFromGoogleSheet(targetId || sheetId);
    setIsSyncing(false);
    setSyncMessage(result.message);
    loadData();
  };

  useEffect(() => {
    loadData();
    // Auto sync from Google Sheet on mount
    handleSyncFromSheet();
  }, []);

  const years = useMemo(() => {
    const set = new Set<number>();
    rawData.forEach(r => {
      const d = new Date(r.timestamp);
      if (!isNaN(d.getTime())) set.add(d.getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [rawData]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    rawData.forEach(r => { if (r.dept) set.add(r.dept); });
    return Array.from(set).sort();
  }, [rawData]);

  const staffNames = useMemo(() => {
    const set = new Set<string>();
    rawData.forEach(r => {
      splitStaff(r.goodStaff).forEach(s => set.add(s));
    });
    return Array.from(set).sort();
  }, [rawData]);

  // Filter & Dedupe Logic
  const filteredData = useMemo(() => {
    let list = rawData.filter(r => {
      const d = new Date(r.timestamp);
      if (isNaN(d.getTime())) return false;
      if (selectedYear && d.getFullYear().toString() !== selectedYear) return false;
      if (selectedMonth && (d.getMonth() + 1).toString() !== selectedMonth) return false;
      if (selectedDept && r.dept !== selectedDept) return false;
      if (selectedStaff && !splitStaff(r.goodStaff).includes(selectedStaff)) return false;
      return true;
    });

    if (dedupeMode) {
      const groups: { [key: string]: CSIRecord[] } = {};
      list.forEach(r => {
        const d = new Date(r.timestamp);
        const key = `${r.dept}||${d.getFullYear()}||${d.getMonth()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      const deduped: CSIRecord[] = [];
      Object.values(groups).forEach(rows => {
        if (rows.length === 1) {
          deduped.push(rows[0]);
          return;
        }
        const withNote = rows.filter(r => !isEmpty(r.extraNote));
        if (withNote.length > 0) {
          withNote.sort((a, b) => b.extraNote.trim().length - a.extraNote.trim().length);
          deduped.push(withNote[0]);
        } else {
          rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          deduped.push(rows[0]);
        }
      });
      list = deduped;
    }

    return list;
  }, [rawData, selectedYear, selectedMonth, selectedDept, selectedStaff, dedupeMode]);

  // Key stats
  const totalResponses = filteredData.length;
  const allScores = useMemo(() => {
    return filteredData.flatMap(r => [
      r.q1_1, r.q1_2, r.q1_3, r.q1_4, r.q1_5, r.q1_6, r.q1_7,
      r.q2_1, r.q2_2, r.q2_3, r.q2_4, r.q2_5
    ].filter(x => typeof x === 'number' && x > 0));
  }, [filteredData]);

  const avgScore = avgArr(allScores);
  const satPct = avgScore ? (avgScore * 20) : 0;

  const topStaff = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredData.forEach(r => splitStaff(r.goodStaff).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : '—';
  }, [filteredData]);

  // Dept distribution
  const deptCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredData.forEach(r => { if (r.dept) counts[r.dept] = (counts[r.dept] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredData]);

  // Praised & Bad staff
  const praisedStaffList = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredData.forEach(r => splitStaff(r.goodStaff).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredData]);

  const badStaffList = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredData.forEach(r => {
      if (!isEmpty(r.badStaff)) counts[r.badStaff] = (counts[r.badStaff] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredData]);

  // Categorized suggestions
  const categorizedSuggestions = useMemo(() => {
    const sugs: { text: string; cat: string; dept: string; date: string }[] = [];
    filteredData.forEach(r => {
      if (!isEmpty(r.extraNote)) {
        const cat = categorizeText(r.extraNote);
        sugs.push({ text: r.extraNote, cat, dept: r.dept || '—', date: r.timestamp });
      }
      if (!isEmpty(r.badReason)) {
        const cat = categorizeText(r.badReason);
        sugs.push({ text: r.badReason, cat, dept: r.dept || '—', date: r.timestamp });
      }
    });
    return sugs;
  }, [filteredData]);

  function categorizeText(t: string): string {
    const s = String(t).toLowerCase();
    if (/เร็ว|ช้า|รอ|เวลา|รวดเร็ว|ทันเวลา|ตรงเวลา/.test(s)) return 'time';
    if (/สื่อสาร|email|โทร|ตอบกลับ|แจ้ง|รับสาย/.test(s)) return 'comm';
    if (/อุปกรณ์|ซ่อม|เครื่อง|เทคนิค|ระบบ|อัพเกรด/.test(s)) return 'equip';
    if (/บริการ|ใส่ใจ|สุภาพ|ยิ้ม|พนักงาน/.test(s)) return 'service';
    return 'other';
  }

  const filteredSuggestions = useMemo(() => {
    if (sugCategory === 'all') return categorizedSuggestions;
    return categorizedSuggestions.filter(s => s.cat === sugCategory);
  }, [categorizedSuggestions, sugCategory]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Google Sheet Live Auto Connection Header */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
            <i className="fa-solid fa-file-excel"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h2 className="font-th font-extrabold text-base sm:text-lg text-white">
                เชื่อมต่อ Google Sheet ดึงข้อมูลออโต้แล้ว
              </h2>
            </div>
            <p className="text-xs text-emerald-300 font-mono mt-0.5 truncate max-w-md">
              Sheet ID: <strong className="text-emerald-200">{sheetId}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div
            title="ดึงข้อมูลจาก Google Sheet อัตโนมัติทุก 30 วินาที ไม่ต้องกดเอง"
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 select-none"
          >
            <i className={`fa-solid ${isSyncing ? 'fa-spinner fa-spin' : 'fa-circle-check'}`}></i>
            <span>{isSyncing ? 'กำลังอัปเดตข้อมูล...' : 'อัปเดตข้อมูลอัตโนมัติ'}</span>
          </div>

          <button
            onClick={() => setShowSheetModal(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="เปลี่ยน Sheet ID"
          >
            <i className="fa-solid fa-gear"></i>
            <span>ตั้งค่า Sheet ID</span>
          </button>
        </div>
      </div>

      {/* Sync feedback notification */}
      {syncMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 px-4 text-xs text-emerald-300 flex items-center justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
            <span>{syncMessage}</span>
          </div>
          <button
            onClick={() => setSyncMessage('')}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 flex flex-wrap gap-3 items-center shadow-lg">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
          <i className="fa-solid fa-filter"></i>
          <span>ตัวกรอง:</span>
        </div>

        <select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
        >
          <option value="">ทุกปี</option>
          {years.map(y => <option key={y} value={y.toString()}>{y}</option>)}
        </select>

        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
        >
          <option value="">ทุกเดือน</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m.toString()}>{m} (เดือน)</option>
          ))}
        </select>

        <select
          value={selectedDept}
          onChange={e => setSelectedDept(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-indigo-500 max-w-[180px]"
        >
          <option value="">ทุกแผนก ({departments.length})</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={selectedStaff}
          onChange={e => setSelectedStaff(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-indigo-500 max-w-[180px]"
        >
          <option value="">พนักงานทั้งหมด</option>
          {staffNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          onClick={() => setDedupeMode(!dedupeMode)}
          className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
            dedupeMode
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/10'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-amber-500/40 hover:text-amber-300'
          }`}
        >
          <i className="fa-solid fa-filter-circle-xmark"></i>
          <span>ตัดซ้ำ/เดือน</span>
          {dedupeMode && (
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full text-[10px] font-black">
              ON
            </span>
          )}
        </button>

        <button
          onClick={loadData}
          className="ml-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
        >
          <i className="fa-solid fa-rotate"></i>
          <span>อัพเดท</span>
        </button>
      </div>

      {/* Dedupe mode info banner */}
      {dedupeMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
          <i className="fa-solid fa-circle-info text-amber-400 mt-0.5 flex-shrink-0"></i>
          <div>
            <span className="font-bold">โหมดตัดซ้ำรายเดือน:</span> แต่ละแผนกจะถูกนับเพียง <strong>1 ครั้งต่อเดือน</strong> โดยคัดเลือกจากแถวที่มีรายละเอียดข้อเสนอแนะยาวที่สุดหรือล่าสุด
          </div>
        </div>
      )}

      {/* Dashboard Sub-Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-house-chimney mr-1.5"></i>ภาพรวม
        </button>
        <button
          onClick={() => setActiveTab('scores')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'scores'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-chart-bar mr-1.5"></i>คะแนนรายหัวข้อ
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'staff'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-users mr-1.5"></i>พนักงาน
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'insights'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-brain mr-1.5"></i>วิเคราะห์
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'suggestions'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-comments mr-1.5"></i>ข้อเสนอแนะ ({categorizedSuggestions.length})
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stat cards grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-md hover:border-slate-600 transition-all">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 text-base">
                <i className="fa-solid fa-clipboard-list"></i>
              </div>
              <div className="font-th font-extrabold text-2xl text-white">{totalResponses}</div>
              <div className="text-xs font-semibold text-slate-400 mt-1">Total Responses</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-md hover:border-slate-600 transition-all">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 text-base">
                <i className="fa-solid fa-star"></i>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-th font-extrabold text-2xl text-white">{avgScore ? avgScore.toFixed(2) : '—'}</span>
                <span className="font-th font-bold text-sm text-emerald-400">{satPct.toFixed(1)}%</span>
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-1">คะแนนเฉลี่ย / % พึงพอใจ</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-md hover:border-slate-600 transition-all">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3 text-base">
                <i className="fa-solid fa-trophy"></i>
              </div>
              <div className="font-th font-bold text-base text-white truncate">{topStaff}</div>
              <div className="text-xs font-semibold text-slate-400 mt-1">พนักงานยอดเยี่ยม (ได้รับคำชมสูงสุด)</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-md hover:border-slate-600 transition-all">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3 text-base">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <div className="font-th font-extrabold text-xl text-cyan-300">
                {avgScore >= 4.5 ? 'ระดับยอดเยี่ยม' : avgScore >= 4.0 ? 'ระดับดีมาก' : avgScore >= 3.0 ? 'ระดับปานกลาง' : 'ควรปรับปรุง'}
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-1">Performance Level</div>
            </div>
          </div>

          {/* Department Chart */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <i className="fa-solid fa-hospital text-sm"></i>
              </div>
              <h3 className="font-th text-sm font-bold text-white">การทำแบบประเมินจำแนกตามแผนก</h3>
            </div>
            {deptCounts.length > 0 ? (
              <div className="h-64 sm:h-80">
                <Bar
                  data={{
                    labels: deptCounts.map(d => d[0].length > 25 ? d[0].slice(0, 24) + '…' : d[0]),
                    datasets: [{
                      label: 'จำนวนการตอบประเมิน',
                      data: deptCounts.map(d => d[1]),
                      backgroundColor: 'rgba(99, 102, 241, 0.75)',
                      borderColor: '#818cf8',
                      borderRadius: 6
                    }]
                  }}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                      y: { ticks: { color: '#f1f5f9', font: { size: 10 } }, grid: { display: false } }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs font-semibold">ไม่พบข้อมูลในตัวกรองนี้</div>
            )}
          </div>

          {/* Praised & Bad Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <i className="fa-solid fa-heart text-sm"></i>
                </div>
                <h3 className="font-th text-sm font-bold text-white">อันดับพนักงานที่ได้รับคำชม</h3>
              </div>
              <div className="space-y-3">
                {praisedStaffList.map(([name, count], idx) => (
                  <div key={name} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{name}</div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full"
                          style={{ width: `${Math.min(100, (count / (praisedStaffList[0][1] || 1)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-xs font-black text-emerald-400">{count} ครั้ง</div>
                  </div>
                ))}
                {praisedStaffList.length === 0 && (
                  <div className="py-8 text-center text-slate-500 text-xs">ไม่มีข้อมูลคำชื่นชม</div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <i className="fa-solid fa-circle-exclamation text-sm"></i>
                </div>
                <h3 className="font-th text-sm font-bold text-white">อันดับเรื่อง/พนักงานที่ควรปรับปรุง</h3>
              </div>
              <div className="space-y-3">
                {badStaffList.map(([name, count], idx) => (
                  <div key={name} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{name}</div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-rose-400 h-full rounded-full"
                          style={{ width: `${Math.min(100, (count / (badStaffList[0][1] || 1)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-xs font-black text-rose-400">{count} ครั้ง</div>
                  </div>
                ))}
                {badStaffList.length === 0 && (
                  <div className="py-8 text-center text-slate-500 text-xs">ไม่มีรายการต้องปรับปรุง</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCORES TAB */}
      {activeTab === 'scores' && (
        <div className="space-y-6">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
            <h3 className="font-th text-sm font-bold text-white mb-4">ส่วนที่ 1: คะแนนเฉลี่ยการบริการ ณ แผนก</h3>
            <div className="space-y-3">
              {LABELS_Q1.map((label, idx) => {
                const key = `q1_${idx + 1}` as keyof CSIRecord;
                const scores = filteredData.map(r => Number(r[key]) || 0).filter(x => x > 0);
                const avg = avgArr(scores);
                return (
                  <div key={key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40">
                    <div className="w-44 text-xs font-semibold text-slate-300 truncate">{label}</div>
                    <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(avg / 5) * 100}%`,
                          backgroundColor: avg >= 4.5 ? '#34d399' : avg >= 4.0 ? '#60a5fa' : '#fbbf24'
                        }}
                      ></div>
                    </div>
                    <div className="text-xs font-black text-indigo-300 w-12 text-right">
                      {avg ? avg.toFixed(2) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
            <h3 className="font-th text-sm font-bold text-white mb-4">ส่วนที่ 2: คะแนนเฉลี่ยการติดต่อผ่าน E-Mail / โทรศัพท์</h3>
            <div className="space-y-3">
              {LABELS_Q2.map((label, idx) => {
                const key = `q2_${idx + 1}` as keyof CSIRecord;
                const scores = filteredData.map(r => Number(r[key]) || 0).filter(x => x > 0);
                const avg = avgArr(scores);
                return (
                  <div key={key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40">
                    <div className="w-44 text-xs font-semibold text-slate-300 truncate">{label}</div>
                    <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(avg / 5) * 100}%`,
                          backgroundColor: avg >= 4.5 ? '#34d399' : avg >= 4.0 ? '#60a5fa' : '#fbbf24'
                        }}
                      ></div>
                    </div>
                    <div className="text-xs font-black text-indigo-300 w-12 text-right">
                      {avg ? avg.toFixed(2) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
          <h3 className="font-th text-sm font-bold text-white">รายละเอียดคำชื่นชมพนักงานรายบุคคล</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredData.filter(r => !isEmpty(r.goodStaff) && !isEmpty(r.goodReason)).map((r, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-emerald-400">{r.goodStaff}</span>
                  <span className="text-[10px] text-slate-400">{r.dept} · {new Date(r.timestamp).toLocaleDateString('th-TH')}</span>
                </div>
                <div className="text-slate-300 font-medium">{r.goodReason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INSIGHTS TAB */}
      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
            <h3 className="font-th text-sm font-bold text-emerald-400 mb-3"><i className="fa-solid fa-shield-heart mr-2"></i>จุดแข็งการบริการ (Strengths)</h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/40">
                <div className="font-bold text-white mb-1">1. ความเป็นมืออาชีพและตรงต่อเวลา</div>
                <p>ได้รับคำชมด้านความรวดเร็วในการเดินทางเข้าซ่อมบำรุงในภาวะวิกฤตของวอร์ด</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/40">
                <div className="font-bold text-white mb-1">2. อัธยาศัยและมารยาทการบริการ</div>
                <p>พนักงานยิ้มแย้ม สุภาพ และพร้อมให้คำแนะนำวิธีการดูแลเครื่องอย่างถูกวิธี</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
            <h3 className="font-th text-sm font-bold text-amber-400 mb-3"><i className="fa-solid fa-lightbulb mr-2"></i>ข้อควรพัฒนา (Improvement Strategy)</h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/40">
                <div className="font-bold text-white mb-1">1. การแจ้งสถานะการซ่อมย้อนกลับ</div>
                <p>ควรเพิ่มช่องทางแจ้งเตือนสถานะการซ่อมหรือการสั่งอะไหล่ให้วอร์ดทราบเป็นระยะ</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/40">
                <div className="font-bold text-white mb-1">2. การรับสายช่วงเวลา Peak Hours</div>
                <p>วางมาตรการจัดการคู่สายโทรศัพท์ช่วงเช้าเพื่อลดเวลารอสายของผู้รับบริการ</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUGGESTIONS TAB */}
      {activeTab === 'suggestions' && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { id: 'all', name: 'ทั้งหมด' },
              { id: 'service', name: 'การบริการ' },
              { id: 'time', name: 'ความรวดเร็ว' },
              { id: 'comm', name: 'การสื่อสาร' },
              { id: 'equip', name: 'อุปกรณ์' },
              { id: 'other', name: 'อื่นๆ' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSugCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sugCategory === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredSuggestions.map((s, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/50 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold uppercase text-[10px]">
                    {s.cat === 'time' ? 'ความรวดเร็ว' : s.cat === 'comm' ? 'การสื่อสาร' : s.cat === 'equip' ? 'อุปกรณ์' : s.cat === 'service' ? 'การบริการ' : 'อื่นๆ'}
                  </span>
                  <span className="text-[10px] text-slate-400">{s.dept} · {new Date(s.date).toLocaleDateString('th-TH')}</span>
                </div>
                <div className="text-slate-200 font-medium">{s.text}</div>
              </div>
            ))}
            {filteredSuggestions.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-xs">ไม่พบข้อเสนอแนะในหมวดนี้</div>
            )}
          </div>
        </div>
      )}

      {/* Sheet ID Configuration Modal */}
      {showSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-th font-extrabold text-base text-emerald-300 flex items-center gap-2">
                <i className="fa-solid fa-file-excel"></i>
                <span>ตั้งค่า Google Sheet ID ดึงข้อมูล</span>
              </h3>
              <button
                onClick={() => setShowSheetModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Google Sheet ID
                </label>
                <input
                  type="text"
                  value={sheetId}
                  onChange={e => setSheetId(e.target.value)}
                  placeholder="เช่น 11qoHRaakTjvDWvOekqTTlP2SFcqdfys6cT653wRfjUA"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-xs outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * ตัวอย่าง Google Sheet URL: <code className="text-emerald-300">https://docs.google.com/spreadsheets/d/<b>[Sheet-ID]</b>/edit</code>
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>ข้อแนะนำการตั้งค่าสิทธิ์แชร์ Google Sheet:</span>
                </div>
                <p>1. เปิดไฟล์ Google Sheet ของคุณ</p>
                <p>2. กดปุ่ม <strong>แชร์ (Share)</strong> มุมขวาบน</p>
                <p>3. ปรับเปลี่ยนเป็น <strong>"ทุกคนที่มีลิงก์ (Anyone with link)"</strong> ให้มีสิทธิ์ <strong>ดู (Viewer)</strong></p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSheetModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSheetModal(false);
                  handleSyncFromSheet(sheetId);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30"
              >
                บันทึก & ดึงข้อมูลทันที
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
