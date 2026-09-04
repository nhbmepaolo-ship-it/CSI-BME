import React, { useState, useEffect } from 'react';
import { Employee } from './types';
import { StorageService } from './services/storage';
import { isAuthorizedAdminUser } from './data/initialData';
import { CSIForm } from './components/CSIForm';
import { CSIDashboard } from './components/CSIDashboard';
import { BMEStarVote } from './components/BMEStarVote';
import { ActivityLogForm } from './components/ActivityLogForm';
import { ActivityDashboard } from './components/ActivityDashboard';
import { StaffManagement } from './components/StaffManagement';
import { NotificationCard } from './components/NotificationCard';
import { OrgChart } from './components/OrgChart';
import { CoachingDashboard } from './components/CoachingDashboard';

type PageView = 
  | 'csi-form' 
  | 'csi-dash' 
  | 'vote' 
  | 'act-log' 
  | 'act-dash' 
  | 'coaching'
  | 'staff-mgr' 
  | 'card-notify'
  | 'org-chart';

export default function App() {
  const [activePage, setActivePage] = useState<PageView>('csi-form');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);

  // Modal State
  const [modalState, setModalState] = useState<{
    show: boolean;
    type: 'success' | 'warning';
    title: string;
    body: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    body: ''
  });

  // Toast State
  const [toastState, setToastState] = useState<{
    show: boolean;
    type: 'success' | 'error';
    msg: string;
  }>({
    show: false,
    type: 'success',
    msg: ''
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);

  const triggerGlobalSync = async (silent = true) => {
    if (!silent) setIsSyncing(true);
    try {
      const res = await StorageService.fetchAndSyncFromGoogleSheet();
      let hasChanges = false;
      if (res.success) {
        hasChanges = true;

        // Refresh current user's data (photo, name, etc.) if it changed in the Google Sheet,
        // without relying on any persisted/stored login session
        const freshEmps = StorageService.getEmployees();
        setCurrentUser(prevUser => {
          if (!prevUser) return prevUser;
          const matched = freshEmps.find(
            e => e.id === prevUser.id || (e.username && prevUser.username && e.username.toLowerCase() === prevUser.username.toLowerCase())
          );
          return matched || prevUser;
        });

        if (!silent) showToast('success', 'ซิงค์ข้อมูลล่าสุดจาก Google Sheet เรียบร้อยแล้ว');
      } else if (!silent) {
        showToast('error', res.message || 'ซิงค์ข้อมูลไม่สำเร็จ');
      }

      // Pull shared activities/votes/org chart from Google Sheets too, if a GAS Web App
      // URL has been configured (silently skipped otherwise).
      try {
        await Promise.all([
          StorageService.pullActivitiesFromSheet(),
          StorageService.pullVotesFromSheet(),
          StorageService.pullOrgChartFromSheet()
        ]);
        hasChanges = true;
      } catch (e) {
        console.warn('Shared-data pull (activities/votes/org chart) skipped:', e);
      }

      if (hasChanges) {
        setSyncVersion(prev => prev + 1);
      }
    } catch {
      if (!silent) showToast('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet');
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Intentionally do NOT auto-login with any user (default or previously stored).
    StorageService.setCurrentUser(null);
    setCurrentUser(null);

    // Immediately trigger initial sync from Google Sheet once on app startup
    triggerGlobalSync(true);

    // Periodic background sync every 5 minutes (300,000 ms) silently
    const syncInterval = setInterval(() => {
      triggerGlobalSync(true);
    }, 300000);

    return () => clearInterval(syncInterval);
  }, []);

  const handleLogin = (user: Employee) => {
    // Kept only in memory for this session — never written to localStorage,
    // so a login never "ค้าง" (persists) into the next time the app is opened.
    setCurrentUser(user);
  };

  const handleLogout = () => {
    // Always return to NO user (view-only) — never a default identity
    setCurrentUser(null);
    showToast('success', 'ออกจากระบบเรียบร้อยแล้ว (โหมดดูอย่างเดียว)');
  };

  const showModal = (type: 'success' | 'warning', title: string, body: string) => {
    setModalState({ show: true, type, title, body });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, show: false }));
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToastState({ show: true, type, msg });
    setTimeout(() => {
      setToastState(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  const pageTitles: { [key in PageView]: { title: string; sub: string } } = {
    'csi-form': { title: 'แบบฟอร์มประเมิน CSI', sub: 'Customer Satisfaction Evaluation' },
    'csi-dash': { title: 'แดชบอร์ด CSI', sub: 'Analytics & Insights Dashboard' },
    'vote': { title: 'โหวตพนักงานในดวงใจ', sub: 'BME Star Vote' },
    'act-log': { title: 'บันทึกกิจกรรมพนักงาน', sub: 'Happy Life & HR-PTP Activity Logger' },
    'act-dash': { title: 'แดชบอร์ดชั่วโมงกิจกรรม', sub: 'Activity Hours Leaderboard & Stats' },
    'coaching': { title: 'แผนพัฒนา & Coaching พนักงาน', sub: 'DISC 4 Animals & Individual Coaching Plan (1, 2, 3 Topics)' },
    'staff-mgr': { title: 'จัดการพนักงาน & ชมรม', sub: 'Admin Employee & Club Management' },
    'card-notify': { title: 'การ์ดประกาศ Line / Telegram', sub: 'Weekly CSI & Activity Hours Card Summary' },
    'org-chart': { title: 'ผังองค์กร BME PTP', sub: 'Organizational Chart & Management Systems' }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none relative">
      
      {/* Background ambient gradient glow for Frosted Glass atmosphere */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 left-2/3 w-80 h-80 bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 md:hidden"
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 w-64 bg-slate-900/60 backdrop-blur-2xl border-r border-white/10 z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/80 to-purple-600/80 backdrop-blur-md flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/20">
            <i className="fa-solid fa-microchip text-lg"></i>
          </div>
          <div>
            <div className="font-th font-extrabold text-sm text-slate-100 leading-tight">CSI BME PTP</div>
            <div className="text-[9px] text-indigo-300/70 font-bold tracking-widest uppercase">Biomedical Engineering</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="text-[9px] font-black text-slate-400/70 uppercase tracking-widest px-3 py-1.5">
            ระบบประเมิน & โหวต
          </div>

          <button
            onClick={() => { setActivePage('csi-form'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'csi-form'
                ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40 shadow-lg shadow-indigo-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-indigo-300">
              <i className="fa-solid fa-clipboard-list"></i>
            </div>
            <span>แบบฟอร์มประเมิน CSI</span>
          </button>

          <button
            onClick={() => { setActivePage('csi-dash'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'csi-dash'
                ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40 shadow-lg shadow-indigo-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-cyan-300">
              <i className="fa-solid fa-chart-pie"></i>
            </div>
            <span>แดชบอร์ด CSI</span>
          </button>

          <button
            onClick={() => { setActivePage('vote'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'vote'
                ? 'bg-pink-500/25 text-pink-200 border border-pink-400/40 shadow-lg shadow-pink-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-pink-400">
              <i className="fa-solid fa-heart"></i>
            </div>
            <span>โหวตพนักงานในดวงใจ</span>
          </button>

          <div className="text-[9px] font-black text-slate-400/70 uppercase tracking-widest px-3 py-1.5 pt-4">
            กิจกรรม Happy Life & HR-PTP
          </div>

          <button
            onClick={() => { setActivePage('act-log'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'act-log'
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 shadow-lg shadow-emerald-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-emerald-300">
              <i className="fa-solid fa-person-running"></i>
            </div>
            <span>บันทึกกิจกรรมพนักงาน</span>
          </button>

          <button
            onClick={() => { setActivePage('act-dash'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'act-dash'
                ? 'bg-teal-500/25 text-teal-200 border border-teal-400/40 shadow-lg shadow-teal-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-teal-300">
              <i className="fa-solid fa-trophy"></i>
            </div>
            <span>แดชบอร์ดชั่วโมงกิจกรรม</span>
          </button>

          <div className="text-[9px] font-black text-slate-400/70 uppercase tracking-widest px-3 py-1.5 pt-4">
            การจัดการ & ประกาศ
          </div>

          <button
            onClick={() => { setActivePage('staff-mgr'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'staff-mgr'
                ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-lg shadow-purple-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-purple-300">
              <i className="fa-solid fa-users-gear"></i>
            </div>
            <span>จัดการพนักงาน & โปรไฟล์</span>
          </button>

          <button
            onClick={() => { setActivePage('card-notify'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'card-notify'
                ? 'bg-green-500/25 text-green-200 border border-green-400/40 shadow-lg shadow-green-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-green-300">
              <i className="fa-solid fa-paper-plane"></i>
            </div>
            <span>การ์ด Line / Telegram</span>
          </button>

          <button
            onClick={() => { setActivePage('org-chart'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'org-chart'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-lg shadow-sky-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-sky-300">
              <i className="fa-solid fa-sitemap"></i>
            </div>
            <span>ผังองค์กร BME PTP</span>
          </button>

          <button
            onClick={() => { setActivePage('coaching'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-th text-xs font-bold transition-all ${
              activePage === 'coaching'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40 shadow-lg shadow-amber-500/10 backdrop-blur-md'
                : 'text-slate-300/80 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-amber-300">
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
            <span>แผนพัฒนา & Coaching</span>
          </button>
        </nav>

        {/* Sidebar Footer User Info */}
        {currentUser ? (
          <div className="p-3.5 border-t border-white/10 bg-slate-950/40 backdrop-blur-md flex items-center gap-3">
            <img
              src={currentUser.img || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.nickname || 'user')}`}
              alt={currentUser.nickname}
              className="w-9 h-9 rounded-xl object-cover border border-white/20 bg-slate-800 flex-shrink-0 shadow-sm"
              onError={e => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.nickname || 'user')}`;
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-100 truncate">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-400 font-mono">User: {currentUser.username}</div>
            </div>
            <button
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-400/40 text-slate-400 hover:text-rose-300 flex items-center justify-center flex-shrink-0 transition-all"
            >
              <i className="fa-solid fa-right-from-bracket text-xs"></i>
            </button>
          </div>
        ) : (
          <div className="p-3.5 border-t border-white/10 bg-slate-950/40 backdrop-blur-md flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 flex-shrink-0">
              <i className="fa-solid fa-user-lock text-sm"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-300 truncate">ยังไม่ได้เข้าสู่ระบบ</div>
              <div className="text-[10px] text-slate-500">โหมดดูอย่างเดียว · เข้าสู่ระบบที่หน้าโหวต/บันทึกกิจกรรม</div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Topbar */}
        <header className="h-14 bg-slate-900/50 backdrop-blur-xl border-b border-white/10 flex items-center gap-3 px-4 z-30 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-slate-200 flex items-center justify-center md:hidden transition-all"
          >
            <i className="fa-solid fa-bars text-sm"></i>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-th font-extrabold text-base text-white truncate">
              {pageTitles[activePage].title}
            </h1>
            <p className="text-[10px] text-indigo-300/70 font-semibold tracking-wider truncate">
              {pageTitles[activePage].sub} · BME PTP
            </p>
          </div>

          {/* Quick Page Nav & Sync Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => triggerGlobalSync(false)}
              disabled={isSyncing}
              title="ซิงค์ข้อมูลจาก Google Sheet ทั้งหมด"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                isSyncing
                  ? 'bg-amber-500/30 text-amber-200 border-amber-400/50 animate-pulse'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/40'
              }`}
            >
              <i className={`fa-solid fa-rotate ${isSyncing ? 'animate-spin text-amber-300' : 'text-emerald-400'}`}></i>
              <span className="hidden sm:inline">{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ Sheet'}</span>
            </button>

            <button
              onClick={() => setActivePage('csi-form')}
              title="แบบฟอร์มประเมิน CSI"
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                activePage === 'csi-form' ? 'bg-indigo-500/40 text-white border-indigo-400/50 shadow-md' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-clipboard-list"></i>
            </button>
            <button
              onClick={() => setActivePage('vote')}
              title="โหวตพนักงาน"
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                activePage === 'vote' ? 'bg-pink-500/40 text-white border-pink-400/50 shadow-md' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-heart"></i>
            </button>
            <button
              onClick={() => setActivePage('act-log')}
              title="บันทึกกิจกรรม"
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                activePage === 'act-log' ? 'bg-emerald-500/40 text-white border-emerald-400/50 shadow-md' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-person-running"></i>
            </button>
            <button
              onClick={() => setActivePage('org-chart')}
              title="ผังองค์กร BME PTP"
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                activePage === 'org-chart' ? 'bg-sky-500/40 text-white border-sky-400/50 shadow-md' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-sitemap"></i>
            </button>
            <button
              onClick={() => setActivePage('coaching')}
              title="แผนพัฒนา & Coaching"
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                activePage === 'coaching' ? 'bg-amber-500/40 text-white border-amber-400/50 shadow-md' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-graduation-cap"></i>
            </button>
          </div>
        </header>

        {/* Page Container */}
        <div className="flex-1 overflow-y-auto">
          {activePage === 'csi-form' && (
            <CSIForm key={syncVersion} onSuccessSubmitted={() => setActivePage('csi-dash')} showModal={showModal} />
          )}

          {activePage === 'csi-dash' && (
            <CSIDashboard key={syncVersion} />
          )}

          {activePage === 'vote' && (
            <BMEStarVote
              key={syncVersion}
              currentUser={currentUser}
              onLogin={handleLogin}
              onLogout={handleLogout}
              showToast={showToast}
            />
          )}

          {activePage === 'act-log' && (
            <ActivityLogForm
              key={syncVersion}
              currentUser={currentUser}
              onLogin={handleLogin}
              onLogout={handleLogout}
              onSuccessSubmitted={() => setActivePage('act-dash')}
              showToast={showToast}
            />
          )}

          {activePage === 'act-dash' && (
            <ActivityDashboard key={syncVersion} currentUser={currentUser} />
          )}

          {activePage === 'coaching' && (
            <CoachingDashboard key={syncVersion} currentUser={currentUser} showToast={showToast} />
          )}

          {activePage === 'staff-mgr' && (
            <StaffManagement key={syncVersion} currentUser={currentUser} showToast={showToast} />
          )}

          {activePage === 'card-notify' && (
            <NotificationCard key={syncVersion} currentUser={currentUser} showToast={showToast} />
          )}

          {activePage === 'org-chart' && (
            <OrgChart key={syncVersion} currentUser={currentUser} showToast={showToast} />
          )}
        </div>
      </main>

      {/* Global Modal */}
      {modalState.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="text-5xl">
              {modalState.type === 'success' ? '✨' : '⚠️'}
            </div>
            <h3 className="font-th font-extrabold text-xl text-white">
              {modalState.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {modalState.body}
            </p>
            <button
              onClick={closeModal}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-th font-extrabold text-sm backdrop-blur-md transition-all shadow-lg"
            >
              ตกลง / ปิด
            </button>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toastState.show && (
        <div className="fixed bottom-5 right-5 z-50 transition-all duration-300 transform translate-y-0 opacity-100">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-xs font-bold flex items-center gap-2.5 max-w-md ${
            toastState.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/40 shadow-emerald-900/30'
              : 'bg-rose-950/80 text-rose-200 border-rose-500/40 shadow-rose-900/30'
          }`}>
            <i className={`fa-solid ${toastState.type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'} text-base`}></i>
            <span>{toastState.msg}</span>
          </div>
        </div>
      )}

    </div>
  );
}
