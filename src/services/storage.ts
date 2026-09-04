import { Employee, CSIRecord, VoteRecord, ActivityRecord, CardAnnouncementSettings, HappyLifeClub, OrgChartConfig, CoachingRecord } from '../types';
import { INITIAL_EMPLOYEES, INITIAL_CSI_RECORDS, INITIAL_VOTES, INITIAL_ACTIVITIES } from '../data/initialData';
import { INITIAL_ORG_CHART } from '../data/initialOrgChart';
import { INITIAL_COACHING_RECORDS } from '../data/initialCoachingData';

const KEYS = {
  EMPLOYEES: 'csi_bme_employees_v2',
  CSI_RECORDS: 'csi_bme_csi_records_v2',
  VOTES: 'csi_bme_votes_v2',
  ACTIVITIES: 'csi_bme_activities_v2',
  CURRENT_USER: 'csi_bme_current_user_v2',
  CARD_SETTINGS: 'csi_bme_card_settings_v2',
  SHEET_ID: 'csi_bme_sheet_id_v2',
  ORG_CHART: 'csi_bme_org_chart_v2',
  COACHING: 'csi_bme_coaching_records_v2'
};

export class StorageService {
  // Generic caller for the multi-action Google Apps Script Web App (activities, votes,
  // org chart). Used for BOTH pushing local changes out and pulling shared data in, so
  // every device connected to the same GAS URL converges on the same data instead of
  // each browser's localStorage being an island.
  private static getGasUrl(): string {
    return (localStorage.getItem('csi_google_sheets_url') || '').trim();
  }

  private static async callGasAction(action: string, extra: Record<string, any> = {}): Promise<{ success: boolean; data?: any; message?: string }> {
    const gasUrl = this.getGasUrl();
    if (!gasUrl) {
      return { success: false, message: 'ยังไม่ได้ตั้งค่า Google Apps Script Web App URL' };
    }
    try {
      const res = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasUrl, payload: { action, ...extra } })
      });
      const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
      return data;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // Org Chart
  static getOrgChart(): OrgChartConfig {
    try {
      const data = localStorage.getItem(KEYS.ORG_CHART);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse org chart from storage:', e);
    }
    this.saveOrgChart(INITIAL_ORG_CHART);
    return INITIAL_ORG_CHART;
  }

  static saveOrgChart(config: OrgChartConfig): void {
    try {
      localStorage.setItem(KEYS.ORG_CHART, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save org chart:', e);
    }
    // Push to the shared Google Sheet too (fire-and-forget) so other devices see the
    // update on their next sync, instead of the org chart only living on this browser.
    this.callGasAction('sync_orgchart', { orgChart: config });
  }

  // Pull the shared org chart from Google Sheets (last-write-wins) and store it locally.
  // Called during the periodic global sync so every device converges on the same chart.
  // Returns whether the org chart actually changed, so the caller can skip refreshing the
  // screen when a poll finds nothing new (see App.tsx's refreshViewIfSafe).
  static async pullOrgChartFromSheet(): Promise<boolean> {
    const result = await this.callGasAction('get_orgchart');
    if (result.success && result.data && Array.isArray(result.data.nodes) && result.data.nodes.length > 0) {
      const before = localStorage.getItem(KEYS.ORG_CHART);
      const after = JSON.stringify(result.data);
      if (before === after) return false;
      localStorage.setItem(KEYS.ORG_CHART, after);
      return true;
    }
    return false;
  }

  static resetOrgChart(): OrgChartConfig {
    this.saveOrgChart(INITIAL_ORG_CHART);
    return INITIAL_ORG_CHART;
  }

  // Coaching Records
  static getCoachingRecords(): CoachingRecord[] {
    try {
      const data = localStorage.getItem(KEYS.COACHING);
      if (data) {
        const parsed: CoachingRecord[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If old default records exist (e.g., Chalee topic1 contains Active Listening), update them to match initial data
          const charlie = parsed.find(r => r.empId === '761080' || r.fullName.includes('ชาลี'));
          if (charlie && charlie.topic1.includes('Active Listening')) {
            this.saveCoachingRecords(INITIAL_COACHING_RECORDS);
            return INITIAL_COACHING_RECORDS;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse coaching records from storage:', e);
    }
    this.saveCoachingRecords(INITIAL_COACHING_RECORDS);
    return INITIAL_COACHING_RECORDS;
  }

  static saveCoachingRecords(records: CoachingRecord[]): void {
    try {
      localStorage.setItem(KEYS.COACHING, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save coaching records:', e);
    }
  }

  static updateCoachingRecord(id: string, updates: Partial<CoachingRecord>): CoachingRecord[] {
    const list = this.getCoachingRecords();
    const idx = list.findIndex(r => r.id === id || r.empId === id);
    if (idx !== -1) {
      const updated = { ...list[idx], ...updates };
      // Recalculate total hours if any weekly hours updated
      const w1 = updated.hoursW1 || 0;
      const w2 = updated.hoursW2 || 0;
      const w3 = updated.hoursW3 || 0;
      const w4 = updated.hoursW4 || 0;
      const w5 = updated.hoursW5 || 0;
      const w6 = updated.hoursW6 || 0;
      updated.totalHours = Number((w1 + w2 + w3 + w4 + w5 + w6).toFixed(1));

      list[idx] = updated;
      this.saveCoachingRecords(list);

      // Push the updated coaching record to the shared Google Sheet too (fire-and-forget),
      // the same way activities/votes/org chart already do, so an edit made on one device
      // (e.g. updating progress %, hours, or topics) is visible from other devices too and
      // actually lands in the "แผนพัฒนา" tab instead of only living in this browser.
      this.callGasAction('sync_coaching', { coachingRecords: [updated] });
    }
    return list;
  }

  static resetCoachingRecords(): CoachingRecord[] {
    this.saveCoachingRecords(INITIAL_COACHING_RECORDS);
    return INITIAL_COACHING_RECORDS;
  }

  // Pull coaching records edited on OTHER devices out of the shared Google Sheet and merge
  // them in (by empId, remote wins for matching ids since edits are pushed immediately).
  // Called during the periodic global sync, same pattern as pullActivitiesFromSheet.
  // Returns whether anything actually changed (see pullOrgChartFromSheet for why).
  static async pullCoachingFromSheet(): Promise<boolean> {
    const result = await this.callGasAction('get_coaching');
    if (!result.success || !Array.isArray(result.data) || result.data.length === 0) return false;

    const remote: CoachingRecord[] = result.data;
    const local = this.getCoachingRecords();
    const byEmpId = new Map<string, CoachingRecord>();
    local.forEach(c => { if (c.empId) byEmpId.set(c.empId, c); });
    remote.forEach(r => {
      if (r && r.empId) byEmpId.set(r.empId, r); // remote is authoritative (latest edit wins)
    });

    const merged = Array.from(byEmpId.values());
    if (JSON.stringify(merged) === JSON.stringify(local)) return false;
    this.saveCoachingRecords(merged);
    return true;
  }

  // Combined pull: fetches activities+votes+orgchart+coaching in ONE Apps Script call
  // instead of four separate ones (see the "get_all" case added to the GAS script in
  // ActivityDashboard.tsx). This is what the periodic background sync uses now — cuts the
  // number of requests per poll (and therefore Google Apps Script executions / URL fetch
  // quota usage) to a quarter of what four separate pullXFromSheet() calls would cost.
  // Falls back automatically to the four separate calls if the deployed Apps Script is an
  // older version that doesn't know the "get_all" action yet (so nothing breaks for anyone
  // who hasn't redeployed).
  static async pullAllSharedFromSheet(): Promise<boolean> {
    const result = await this.callGasAction('get_all');
    if (!result.success || !result.data) {
      // Older Apps Script deployment without "get_all" — fall back to the four calls.
      const [a, v, o, c] = await Promise.all([
        this.pullActivitiesFromSheet(),
        this.pullVotesFromSheet(),
        this.pullOrgChartFromSheet(),
        this.pullCoachingFromSheet()
      ]);
      return a || v || o || c;
    }

    let changed = false;
    const { activities, votes, orgChart, coaching } = result.data;

    if (Array.isArray(activities) && activities.length > 0) {
      const local = this.getActivities();
      const byId = new Map<string, ActivityRecord>();
      local.forEach(a => byId.set(a.id, a));
      activities.forEach((r: any) => {
        if (!r || !r.id) return;
        if (r.deleted) byId.delete(r.id);
        else byId.set(r.id, r);
      });
      const merged = Array.from(byId.values());
      if (merged.length !== local.length || JSON.stringify(merged) !== JSON.stringify(local)) {
        changed = true;
        this.saveActivities(merged);
      }
    }

    if (Array.isArray(votes) && votes.length > 0) {
      const local = this.getVotes();
      const byId = new Map<string, VoteRecord>();
      local.forEach(v => byId.set(v.id, v));
      votes.forEach((v: any) => { if (v && v.id) byId.set(v.id, v); });
      const merged = Array.from(byId.values());
      if (merged.length !== local.length || JSON.stringify(merged) !== JSON.stringify(local)) {
        changed = true;
        this.saveVotes(merged);
      }
    }

    if (orgChart && Array.isArray(orgChart.nodes) && orgChart.nodes.length > 0) {
      const before = localStorage.getItem(KEYS.ORG_CHART);
      const after = JSON.stringify(orgChart);
      if (before !== after) {
        changed = true;
        localStorage.setItem(KEYS.ORG_CHART, after);
      }
    }

    if (Array.isArray(coaching) && coaching.length > 0) {
      const local = this.getCoachingRecords();
      const byEmpId = new Map<string, CoachingRecord>();
      local.forEach(c => { if (c.empId) byEmpId.set(c.empId, c); });
      coaching.forEach((r: any) => { if (r && r.empId) byEmpId.set(r.empId, r); });
      const merged = Array.from(byEmpId.values());
      if (JSON.stringify(merged) !== JSON.stringify(local)) {
        changed = true;
        this.saveCoachingRecords(merged);
      }
    }

    return changed;
  }

  // Status Overrides Helper
  static getStatusOverrides(): Record<string, 'active' | 'resigned'> {
    try {
      const data = localStorage.getItem('csi_bme_emp_status_overrides_v2');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  static saveStatusOverrides(overrides: Record<string, 'active' | 'resigned'>): void {
    try {
      localStorage.setItem('csi_bme_emp_status_overrides_v2', JSON.stringify(overrides));
    } catch (e) {
      console.error('Failed to save status overrides:', e);
    }
  }

  // Employees
  static getEmployees(): Employee[] {
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    let list: Employee[] = [];
    if (!data) {
      this.saveEmployees(INITIAL_EMPLOYEES);
      return INITIAL_EMPLOYEES;
    }
    try {
      list = JSON.parse(data);
    } catch {
      list = INITIAL_EMPLOYEES;
    }

    const statusOverrides = this.getStatusOverrides();
    let hasChanges = false;
    const cleanStr = (s: string) => (s || '').replace(/\s*\(?https?:\/\/[^\s)]+\)?/gi, '').trim();

    const cleanedList: Employee[] = [];
    const seenUsernames = new Set<string>();

    const CANONICAL_ADMINS: { [key: string]: { fullName: string; nickname: string; club: HappyLifeClub; password?: string; img: string } } = {
      '563770': {
        fullName: 'Supattra Kaewsuwan',
        nickname: 'เปี้ยว',
        club: 'ชมรมเดิน-วิ่ง',
        img: 'https://img2.pic.in.th/BME_563770..045756.png'
      },
      'MGR_BME': {
        fullName: 'Chalee Meksuwan',
        nickname: 'ปิ้ง',
        club: 'ชมรมเดิน-วิ่ง',
        password: 'Mgr-BME',
        img: 'https://img2.pic.in.th/S__6471704_0-removebg-preview.png'
      },
      'SPV_BME': {
        fullName: 'Raschanee Majanit',
        nickname: 'มิน',
        club: 'ชมรมเดิน-วิ่ง',
        password: 'Spv-BME@PTP',
        img: 'https://img1.pic.in.th/images/970d1e089ad78d07db702e1eab5698c6.png'
      }
    };

    for (const emp of list) {
      const cleanNick = cleanStr(emp.nickname);
      const cleanFull = cleanStr(emp.fullName);

      // Filter out team placeholder accounts
      const isTeam = cleanFull.toLowerCase().includes('team') ||
        cleanNick.toLowerCase().includes('team') ||
        cleanFull.includes('ทีม') ||
        cleanNick.includes('ทีม') ||
        (emp.username && emp.username.toLowerCase().includes('team')) ||
        emp.username === 'emp_15';

      if (isTeam) {
        hasChanges = true;
        continue;
      }

      // Filter out old dummy mock accounts
      if (emp.username && (emp.username.startsWith('emp_a') || emp.username.startsWith('emp_nan') || emp.username.startsWith('emp_jiw') || emp.username.startsWith('emp_name') || emp.username.startsWith('emp_da'))) {
        hasChanges = true;
        continue;
      }

      if (!cleanNick && !cleanFull && !emp.username) {
        hasChanges = true;
        continue;
      }

      const uUpper = (emp.username || '').trim().toUpperCase();
      const uKey = (emp.username || emp.id || '').toLowerCase();
      const finalStatus = statusOverrides[uKey] || emp.status || 'active';

      if (emp.status !== finalStatus) {
        hasChanges = true;
      }

      let updatedNick = cleanNick || cleanFull;
      let updatedFull = cleanFull || cleanNick;
      let updatedClub: HappyLifeClub = (emp.club as HappyLifeClub) || 'ชมรมเดิน-วิ่ง';
      let isAdmin = emp.isAdmin || false;

      let updatedPass = emp.password;

      let img = emp.img;
      if (img && img.includes('drive.google.com')) {
        const m = img.match(/\/d\/([a-zA-Z0-9_-]+)/) || img.match(/id=([a-zA-Z0-9_-]+)/);
        if (m && m[1]) {
          img = `https://lh3.googleusercontent.com/d/${m[1]}`;
          hasChanges = true;
        }
      }

      if (CANONICAL_ADMINS[uUpper]) {
        const canonical = CANONICAL_ADMINS[uUpper];
        if (emp.fullName !== canonical.fullName || emp.nickname !== canonical.nickname || !emp.isAdmin || (canonical.password && emp.password !== canonical.password) || (canonical.img && emp.img !== canonical.img)) {
          hasChanges = true;
        }
        updatedFull = canonical.fullName;
        updatedNick = canonical.nickname;
        if (canonical.password) updatedPass = canonical.password;
        if (!emp.club) updatedClub = canonical.club;
        if (canonical.img) img = canonical.img;
        isAdmin = true;
      }

      if (!img || img.includes('images.unsplash') || !img.startsWith('http')) {
        img = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(updatedNick || updatedFull)}&skinColor=f8d25c`;
        hasChanges = true;
      }

      const key = (emp.username || updatedFull).toLowerCase();
      if (seenUsernames.has(key)) {
        hasChanges = true;
        continue;
      }
      seenUsernames.add(key);

      if (updatedNick !== emp.nickname || updatedFull !== emp.fullName) {
        hasChanges = true;
      }

      cleanedList.push({
        ...emp,
        status: finalStatus,
        nickname: updatedNick,
        fullName: updatedFull,
        password: updatedPass,
        club: updatedClub,
        isAdmin,
        img
      });
    }

    // Ensure all 3 canonical admin accounts exist in the list
    for (const initialAdmin of INITIAL_EMPLOYEES) {
      const uKey = initialAdmin.username.toLowerCase();
      if (!seenUsernames.has(uKey)) {
        cleanedList.unshift(initialAdmin);
        seenUsernames.add(uKey);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.saveEmployees(cleanedList);
    }

    return cleanedList;
  }

  static saveEmployees(employees: Employee[]): void {
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
  }

  static addEmployee(emp: Omit<Employee, 'id'>): Employee {
    const list = this.getEmployees();
    const newEmp: Employee = {
      ...emp,
      id: 'emp-' + Date.now()
    };
    list.push(newEmp);
    this.saveEmployees(list);
    return newEmp;
  }

  static updateEmployee(id: string, updates: Partial<Employee>): Employee | null {
    const list = this.getEmployees();
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return null;

    list[idx] = { ...list[idx], ...updates };

    if (updates.status) {
      const overrides = this.getStatusOverrides();
      const uKey = (list[idx].username || list[idx].id || '').toLowerCase();
      if (uKey) {
        overrides[uKey] = updates.status;
        this.saveStatusOverrides(overrides);
      }
    }

    this.saveEmployees(list);
    return list[idx];
  }

  // CSI Records
  static getCSIRecords(): CSIRecord[] {
    const data = localStorage.getItem(KEYS.CSI_RECORDS);
    if (!data) {
      this.saveCSIRecords(INITIAL_CSI_RECORDS);
      return INITIAL_CSI_RECORDS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_CSI_RECORDS;
    }
  }

  static saveCSIRecords(records: CSIRecord[]): void {
    localStorage.setItem(KEYS.CSI_RECORDS, JSON.stringify(records));
  }

  static addCSIRecord(record: CSIRecord): void {
    const list = this.getCSIRecords();
    list.unshift({ ...record, source: 'local' });
    this.saveCSIRecords(list);
  }

  // Vote Records
  static getVotes(): VoteRecord[] {
    const data = localStorage.getItem(KEYS.VOTES);
    let list: VoteRecord[] = [];
    if (!data) {
      list = INITIAL_VOTES;
    } else {
      try {
        list = JSON.parse(data);
      } catch {
        list = INITIAL_VOTES;
      }
    }

    // Filter out old mock records with fake users
    const filtered = list.filter(v => {
      const nominee = (v.nominee || '').toLowerCase();
      const voter = (v.voter || '').toLowerCase();
      if (nominee.includes('วิไล') || nominee.includes('สุดา') || nominee.includes('นรินทร์') || nominee.includes('พรทิพย์')) return false;
      if (voter.startsWith('emp_a') || voter.startsWith('emp_nan') || voter.startsWith('emp_jiw') || voter.startsWith('emp_name') || voter.startsWith('emp_da')) return false;
      return true;
    });

    if (filtered.length !== list.length) {
      this.saveVotes(filtered.length > 0 ? filtered : INITIAL_VOTES);
      return filtered.length > 0 ? filtered : INITIAL_VOTES;
    }

    return list;
  }

  static saveVotes(votes: VoteRecord[]): void {
    localStorage.setItem(KEYS.VOTES, JSON.stringify(votes));
  }

  static addVote(voter: string, category: string, nominee: string, voteMonth: string): { success: boolean; message: string; monthKey?: string } {
    const votes = this.getVotes();
    const employees = this.getEmployees();
    const userLower = voter.trim().toLowerCase();

    // Validate voter vs nominee
    const voterEmp = employees.find(e => e.username.toLowerCase() === userLower || e.fullName === voter);
    const nomineeEmp = employees.find(e => e.fullName === nominee || `${e.fullName} (${e.nickname})` === nominee);

    if (voterEmp && nomineeEmp) {
      if (voterEmp.id === nomineeEmp.id || voterEmp.username.toLowerCase() === nomineeEmp.username.toLowerCase()) {
        return {
          success: false,
          message: 'ไม่สามารถลงคะแนนโหวตให้ตนเองได้'
        };
      }
      if (voterEmp.club && nomineeEmp.club && voterEmp.club.trim().toLowerCase() === nomineeEmp.club.trim().toLowerCase()) {
        return {
          success: false,
          message: `ไม่สามารถลงคะแนนโหวตให้เพื่อนพนักงานในทีม/ชมรมเดียวกัน (${voterEmp.club}) ได้`
        };
      }
    }

    // Check if user already voted in this category and month
    const existing = votes.find(
      v => v.voter.toLowerCase() === userLower && v.category === category && v.voteMonth === voteMonth
    );

    if (existing) {
      return {
        success: false,
        message: `คุณเคยโหวตในหัวข้อ '${category}' ของรอบเดือน ${voteMonth} ไปแล้ว! (เลือกรอบเดือนอื่นได้)`
      };
    }

    const now = new Date();
    const nowMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (voteMonth > nowMonthKey) {
      return {
        success: false,
        message: 'ไม่สามารถโหวตล่วงหน้าในเดือนอนาคตได้ กรุณาเลือกเดือนปัจจุบันหรือย้อนหลัง'
      };
    }

    const newVote: VoteRecord = {
      id: 'vote-' + Date.now(),
      timestamp: now.toISOString().replace('T', ' ').substring(0, 19),
      voter,
      category,
      nominee,
      voteMonth
    };

    votes.unshift(newVote);
    this.saveVotes(votes);

    // Push to the shared Google Sheet too (fire-and-forget) so this vote is visible
    // from other devices too, not just this browser.
    this.callGasAction('sync_votes', { votes: [newVote] });

    return {
      success: true,
      message: `บันทึกผลการโหวตรอบเดือน ${voteMonth} เรียบร้อยแล้ว!`,
      monthKey: voteMonth
    };
  }

  // Pull votes cast from OTHER devices out of the shared Google Sheet and merge them in
  // (by id, so nothing is duplicated). Called during the periodic global sync.
  // Returns whether anything actually changed (see pullOrgChartFromSheet for why).
  static async pullVotesFromSheet(): Promise<boolean> {
    const result = await this.callGasAction('get_votes');
    if (!result.success || !Array.isArray(result.data)) return false;

    const remoteVotes: VoteRecord[] = result.data;
    if (remoteVotes.length === 0) return false;

    const localVotes = this.getVotes();
    const byId = new Map<string, VoteRecord>();
    localVotes.forEach(v => byId.set(v.id, v));
    remoteVotes.forEach(v => {
      if (v && v.id) byId.set(v.id, v); // remote is authoritative for matching ids
    });

    const merged = Array.from(byId.values());
    if (merged.length === localVotes.length && JSON.stringify(merged) === JSON.stringify(localVotes)) return false;
    this.saveVotes(merged);
    return true;
  }

  // Activity Records
  static getActivities(): ActivityRecord[] {
    const data = localStorage.getItem(KEYS.ACTIVITIES);
    let list: ActivityRecord[] = [];
    if (!data) {
      list = INITIAL_ACTIVITIES;
    } else {
      try {
        list = JSON.parse(data);
      } catch {
        list = INITIAL_ACTIVITIES;
      }
    }

    // Filter out old mock records
    const filtered = list.filter(a => {
      const u = (a.username || '').toLowerCase();
      const fn = (a.fullName || '').toLowerCase();
      if (u.startsWith('emp_a') || u.startsWith('emp_nan') || u.startsWith('emp_jiw') || u.startsWith('emp_name') || u.startsWith('emp_da')) return false;
      if (fn.includes('วิไล') || fn.includes('สุดา') || fn.includes('นรินทร์') || fn.includes('พรทิพย์')) return false;
      return true;
    });

    if (filtered.length !== list.length) {
      this.saveActivities(filtered.length > 0 ? filtered : INITIAL_ACTIVITIES);
      return filtered.length > 0 ? filtered : INITIAL_ACTIVITIES;
    }

    return list;
  }

  static saveActivities(activities: ActivityRecord[]): void {
    localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify(activities));
  }

  static async syncToGoogleSheets(activities: ActivityRecord[], customUrl?: string): Promise<{ success: boolean; message: string }> {
    const targetUrl = customUrl || localStorage.getItem('csi_google_sheets_url');
    if (!targetUrl || !targetUrl.trim()) {
      return { success: false, message: 'กรุณาระบุ Web App URL ของ Google Apps Script ก่อน' };
    }

    const payload = {
      action: 'sync_activities',
      timestamp: new Date().toISOString(),
      totalRecords: activities.length,
      activities: activities.map(a => ({
        id: a.id,
        date: new Date(a.timestamp).toLocaleDateString('th-TH'),
        timestamp: a.timestamp,
        username: a.username,
        fullName: a.fullName,
        nickname: a.nickname,
        club: a.club,
        category: a.activityCategory,
        activityName: a.activityName,
        hours: a.hours,
        minutes: a.minutes,
        totalMinutes: a.totalMinutes,
        description: a.description || '',
        deleted: (a as any).deleted || false
      }))
    };

    try {
      const res = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gasUrl: targetUrl.trim(),
          payload
        })
      });

      const data = await res.json();
      return {
        success: data.success,
        message: data.message || (data.success ? 'ส่งข้อมูลเรียบร้อยแล้ว' : 'ไม่สามารถส่งข้อมูลได้')
      };
    } catch (err: any) {
      console.error('Google Sheets sync error via proxy:', err);
      const isParseError = err instanceof SyntaxError || /json/i.test(err.message || '');
      return {
        success: false,
        message: isParseError
          ? 'Google Apps Script ไม่ตอบกลับข้อมูลที่ถูกต้อง (มักเกิดจากสคริปต์ยังไม่ได้รับสิทธิ์อนุญาต หรือตั้งค่า "ผู้ที่มีสิทธิ์เข้าถึง" ไม่ใช่ "ทุกคน") — ลองเปิดตัวแก้ไข Apps Script แล้วกดปุ่มรัน (▷) ครั้งหนึ่งเพื่อยืนยันสิทธิ์ แล้วปรับใช้ใหม่อีกครั้ง'
          : `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ${err.message || 'โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'}`
      };
    }
  }

  static addActivity(record: Omit<ActivityRecord, 'id' | 'timestamp' | 'totalMinutes' | 'dateKey'> & { timestamp?: string }): ActivityRecord {
    const list = this.getActivities();
    const hours = Number(record.hours) || 0;
    const minutes = Number(record.minutes) || 0;
    const totalMinutes = (hours * 60) + minutes;
    const now = record.timestamp ? new Date(record.timestamp) : new Date();
    const dateKey = now.toISOString().substring(0, 10);

    const newRecord: ActivityRecord = {
      ...record,
      id: 'act-' + Date.now(),
      timestamp: now.toISOString(),
      hours,
      minutes,
      totalMinutes,
      dateKey
    };

    list.unshift(newRecord);
    this.saveActivities(list);

    // Auto sync new record to Google Sheets if Web App URL is configured
    this.syncToGoogleSheets([newRecord]);

    return newRecord;
  }

  static deleteActivity(id: string): void {
    const list = this.getActivities();
    const target = list.find(a => a.id === id);
    const remaining = list.filter(a => a.id !== id);
    this.saveActivities(remaining);

    // Push a soft-delete "tombstone" so this deletion also removes the record on
    // other devices during their next pull, instead of only deleting it locally.
    if (target) {
      this.syncToGoogleSheets([{ ...target, deleted: true } as any]);
    }
  }

  // Pull activities from OTHER devices out of the shared Google Sheet and merge them in
  // (by id — remote wins for matching ids, since edits/deletes are pushed immediately).
  // Called during the periodic global sync so every device converges on the same list.
  // Returns whether anything actually changed (see pullOrgChartFromSheet for why).
  static async pullActivitiesFromSheet(): Promise<boolean> {
    const result = await this.callGasAction('get_activities');
    if (!result.success || !Array.isArray(result.data)) return false;

    const remote: (ActivityRecord & { deleted?: boolean })[] = result.data;
    if (remote.length === 0) return false;

    const local = this.getActivities();
    const byId = new Map<string, ActivityRecord>();
    local.forEach(a => byId.set(a.id, a));

    remote.forEach(r => {
      if (!r || !r.id) return;
      if (r.deleted) {
        byId.delete(r.id); // remove records that were deleted on another device
      } else {
        byId.set(r.id, r); // remote is authoritative for matching ids (latest edit wins)
      }
    });

    const merged = Array.from(byId.values());
    if (merged.length === local.length && JSON.stringify(merged) === JSON.stringify(local)) return false;
    this.saveActivities(merged);
    return true;
  }

  // Correct a wrongly-entered record (e.g. hours typed in wrong) without losing its
  // original id/timestamp. Also re-syncs the corrected record to Google Sheets (if a
  // sync Web App URL is configured) so the correction isn't only local.
  static updateActivity(
    id: string,
    updates: Partial<Pick<ActivityRecord, 'activityName' | 'description' | 'hours' | 'minutes' | 'activityCategory' | 'club'>>
  ): ActivityRecord | null {
    const list = this.getActivities();
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) return null;

    const existing = list[idx];
    const hours = updates.hours !== undefined ? Number(updates.hours) || 0 : existing.hours;
    const minutes = updates.minutes !== undefined ? Number(updates.minutes) || 0 : existing.minutes;

    const updated: ActivityRecord = {
      ...existing,
      ...updates,
      hours,
      minutes,
      totalMinutes: hours * 60 + minutes
    };

    list[idx] = updated;
    this.saveActivities(list);

    // Push the correction to Google Sheets too, if configured
    this.syncToGoogleSheets([updated]);

    return updated;
  }

  // Auth helper
  static getCurrentUser(): Employee | null {
    const data = localStorage.getItem(KEYS.CURRENT_USER);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static setCurrentUser(user: Employee | null): void {
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  }

  static authenticateUser(user: string, pass: string): { success: boolean; user?: Employee; message?: string } {
    const employees = this.getEmployees();
    const uClean = user.trim().toLowerCase();
    const pClean = pass.trim();

    const emp = employees.find(
      e => e.username.toLowerCase() === uClean && (e.password === pClean || !e.password)
    );

    if (emp) {
      if (emp.status === 'resigned') {
        return { success: false, message: 'สถานะพนักงานของคุณสิ้นสุดลงแล้ว (ลาออกแล้ว)' };
      }
      return { success: true, user: emp };
    }

    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  // Card Settings
  static getCardSettings(): CardAnnouncementSettings {
    const data = localStorage.getItem(KEYS.CARD_SETTINGS);
    const defaultToken = 'wg1swtQ3O2KBtBTa461HHn9gRzygFKVYykKBWUI3F4IPSk7HnbXNz+/3zn05pBnfVYvj3K+rz9FF1Hi+ZUXWShiuf1yEzRdNOVjsp6xOB1cPdhzSSxHQr/VrZYWn1I8HOsD9aP3zs0Npg8DRyfekYwdB04t89/1O/w1cDnyilFU=';
    const defaultGroupId = 'C1f1109f61de6683b2337dfa8d3a5ba4d';
    const defaultUserId = 'Ucbf8c9e32fc2606a570a51bbc595d5e9';
    const defaultWebhook = 'https://script.google.com/macros/s/AKfycby_TunZUkHu_9jTuyl0W8Fa-L0IVJ4_G3rCTrxzPEkZIrxDcNpZwbpMa0ejaIUTZlaX/exec';

    if (data) {
      try {
        const parsed = JSON.parse(data);
        const webhook = (parsed.lineWebhookUrl && !parsed.lineWebhookUrl.includes('webhook.site')) ? parsed.lineWebhookUrl : defaultWebhook;
        return {
          lineWebhookUrl: webhook,
          lineChannelToken: parsed.lineChannelToken || defaultToken,
          lineGroupId: parsed.lineGroupId || defaultGroupId,
          lineUserId: parsed.lineUserId || defaultUserId,
          telegramBotToken: parsed.telegramBotToken || '',
          telegramChatId: parsed.telegramChatId || ''
        };
      } catch { return {}; }
    }
    return {
      lineWebhookUrl: defaultWebhook,
      lineChannelToken: defaultToken,
      lineGroupId: defaultGroupId,
      lineUserId: defaultUserId,
      telegramBotToken: '',
      telegramChatId: ''
    };
  }

  static saveCardSettings(settings: CardAnnouncementSettings): void {
    localStorage.setItem(KEYS.CARD_SETTINGS, JSON.stringify(settings));
  }

  // Google Sheet ID & Auto Pull
  static getGoogleSheetId(): string {
    return localStorage.getItem(KEYS.SHEET_ID) || '11qoHRaakTjvDWvOekqTTlP2SFcqdfys6cT653wRfjUA';
  }

  static saveGoogleSheetId(id: string): void {
    if (id && id.trim()) {
      localStorage.setItem(KEYS.SHEET_ID, id.trim());
    }
  }

  static async fetchAndSyncFromGoogleSheet(customSheetId?: string): Promise<{ success: boolean; totalFetched: number; message: string; changed: boolean }> {
    const sheetId = customSheetId || this.getGoogleSheetId();
    let changed = false;
    try {
      let data: any = null;

      try {
        const response = await fetch(`/api/fetch-sheet-data?sheetId=${encodeURIComponent(sheetId)}`);
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          data = await response.json();
        }
      } catch (e) {
        console.warn('Server fetch endpoint unavailable, using direct client-side sheet connection:', e);
      }

      // If server API call didn't return valid data, use client-side direct CSV fetch from Google Sheets
      if (!data || !data.success) {
        data = await this.clientSideFetchGoogleSheet(sheetId);
      }

      if (!data || !data.success) {
        return {
          success: false,
          totalFetched: 0,
          changed: false,
          message: data?.message || 'ไม่สามารถเชื่อมต่อดึงข้อมูลจาก Google Sheet ได้ โปรดตรวจสอบว่าได้เปิดสิทธิ์แชร์ "ทุกคนที่มีลิงก์ดูได้"'
        };
      }

      const fetchedCsi: CSIRecord[] = data.csiRecords || [];
      const fetchedEmp: Employee[] = data.employees || [];

      if (fetchedCsi.length > 0) {
        // The Google Sheet is the single source of truth for CSI evaluations (this app's
        // own CSI form only ever writes to localStorage — see addCSIRecord — it never
        // pushes back to the sheet). Previously this merged by only ADDING records whose
        // timestamp+dept+staffName key wasn't already present, which meant any record that
        // ever got written to this browser's cache — including a stale/mis-parsed one from
        // an earlier bug, or a row later corrected/deleted in the sheet — stayed forever,
        // since nothing ever removed it. That's what caused old garbage (e.g. fragments of
        // a comment field like "ใจ"/"ดา" that had gotten miscategorized as a department name
        // at some point) to keep showing up in the dashboard indefinitely.
        //
        // Fix: on every successful sync, REPLACE all previously sheet-sourced records with
        // the fresh pull wholesale (tagged source:'sheet'), and keep ONLY the records that
        // were submitted locally through this app's own form (tagged source:'local', which
        // never exist in the sheet so must be preserved). Any older record with no `source`
        // tag at all (from before this fix) is dropped here — self-healing away whatever
        // garbage had accumulated, since it's indistinguishable from stale sheet data anyway.
        const existing = this.getCSIRecords();
        const localOnly = existing.filter(r => r.source === 'local');
        const freshFromSheet = fetchedCsi.map(r => ({ ...r, source: 'sheet' as const }));
        const nextCsi = [...localOnly, ...freshFromSheet];
        if (JSON.stringify(nextCsi) !== JSON.stringify(existing)) {
          changed = true;
          this.saveCSIRecords(nextCsi);
        }
      }

      if (fetchedEmp.length > 0) {
        const cleanStr = (s: string) => (s || '').replace(/\s*\(?https?:\/\/[^\s)]+\)?/gi, '').trim();
        const cleanFetched: Employee[] = fetchedEmp
          .filter(e => {
            const f = (e.fullName || '').toLowerCase();
            const n = (e.nickname || '').toLowerCase();
            const u = (e.username || '').toLowerCase();
            return !f.includes('team') && !n.includes('team') && !f.includes('ทีม') && !n.includes('ทีม') && !u.includes('team') && u !== 'emp_15';
          })
          .map(e => {
            let img = e.img;
            if (img && img.includes('drive.google.com')) {
              const m = img.match(/\/d\/([a-zA-Z0-9_-]+)/) || img.match(/id=([a-zA-Z0-9_-]+)/);
              if (m && m[1]) {
                img = `https://lh3.googleusercontent.com/d/${m[1]}`;
              }
            }
            if (!img || !img.startsWith('http')) {
              img = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanStr(e.nickname) || cleanStr(e.fullName) || e.username)}&skinColor=f8d25c`;
            }
            return {
              ...e,
              fullName: cleanStr(e.fullName),
              nickname: cleanStr(e.nickname),
              img
            };
          });

        const statusOverrides = this.getStatusOverrides();
        const existingEmp = this.getEmployees();
        const empMap = new Map<string, Employee>();

        // Put existing employees into map first
        existingEmp.forEach(e => {
          if (e.username) empMap.set(e.username.toLowerCase(), e);
        });

        // Merge fetched employees into map while preserving local status overrides & resigned status
        cleanFetched.forEach(f => {
          const uKey = f.username.toLowerCase();
          const existing = empMap.get(uKey);
          const overrideStatus = statusOverrides[uKey];
          const finalStatus = overrideStatus || existing?.status || f.status || 'active';

          empMap.set(uKey, {
            ...f,
            status: finalStatus,
            club: existing?.club || f.club,
            password: existing?.password || f.password
          });
        });

        // Ensure admin flags and default credentials if missing
        ['563770', 'MGR_BME', 'SPV_BME'].forEach(code => {
          const uKey = code.toLowerCase();
          const existingAdmin = existingEmp.find(e => e.username.toUpperCase() === code);
          const fetchedAdmin = empMap.get(uKey);

          if (fetchedAdmin) {
            empMap.set(uKey, {
              ...fetchedAdmin,
              isAdmin: true
            });
          } else if (existingAdmin) {
            empMap.set(uKey, existingAdmin);
          }
        });

        const updatedList = Array.from(empMap.values());
        if (JSON.stringify(updatedList) !== JSON.stringify(existingEmp)) {
          changed = true;
          this.saveEmployees(updatedList);
        }
      }

      // Sync "แผนพัฒนา" (Coaching/IDP) records fetched from the Google Sheet
      const fetchedCoaching: CoachingRecord[] = data.coachingRecords || [];
      if (fetchedCoaching.length > 0) {
        const existingCoaching = this.getCoachingRecords();
        const coachMap = new Map<string, CoachingRecord>();
        existingCoaching.forEach(c => {
          if (c.empId) coachMap.set(c.empId, c);
        });

        fetchedCoaching.forEach(sheetRec => {
          const existing = coachMap.get(sheetRec.empId);
          coachMap.set(sheetRec.empId, {
            ...sheetRec,
            // Identity & plan fields always follow the current Google Sheet (source of truth)
            // Weekly hour breakdown stays local since the sheet only tracks a single total hours column
            hoursW1: existing?.hoursW1 ?? sheetRec.hoursW1,
            hoursW2: existing?.hoursW2 ?? sheetRec.hoursW2,
            hoursW3: existing?.hoursW3 ?? sheetRec.hoursW3,
            hoursW4: existing?.hoursW4 ?? sheetRec.hoursW4,
            hoursW5: existing?.hoursW5 ?? sheetRec.hoursW5,
            hoursW6: existing?.hoursW6 ?? sheetRec.hoursW6
          });
        });

        const nextCoaching = Array.from(coachMap.values());
        if (JSON.stringify(nextCoaching) !== JSON.stringify(existingCoaching)) {
          changed = true;
          this.saveCoachingRecords(nextCoaching);
        }
      }

      this.saveGoogleSheetId(sheetId);

      return {
        success: true,
        totalFetched: fetchedCsi.length,
        changed,
        message: `เชื่อมต่อและดึงข้อมูลจาก Google Sheet (ID: ${sheetId}) สำเร็จแล้ว! พบแบบประเมินทั้งหมด ${fetchedCsi.length} รายการ${fetchedCoaching.length > 0 ? ` และแผนพัฒนา ${fetchedCoaching.length} รายการ` : ''}`
      };
    } catch (err: any) {
      console.error('Error fetching sheet data:', err);
      return {
        success: false,
        totalFetched: 0,
        changed: false,
        message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message || 'โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'}`
      };
    }
  }

  // Client-side fallback to parse Google Sheets CSV directly
  private static async clientSideFetchGoogleSheet(sheetId: string): Promise<{ success: boolean; csiRecords?: CSIRecord[]; employees?: Employee[]; coachingRecords?: CoachingRecord[]; message?: string }> {
    try {
      const parseCSV = (text: string) => {
        const lines: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              currentCell += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c.length > 0)) {
              lines.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        if (currentCell.length > 0 || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c.length > 0)) {
            lines.push(currentRow);
          }
        }
        return lines;
      };

      // 1. Fetch CSI Responses
      const csiUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('CSI Electronic (การตอบกลับ)')}`;
      const csiRes = await fetch(csiUrl);
      const csiRecords: CSIRecord[] = [];

      if (csiRes.ok) {
        const csvText = await csiRes.text();
        const rows = parseCSV(csvText);

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 4) continue;

          const timestampRaw = row[0] || '';
          const site = row[1] || 'PTP';
          const division = row[2] || 'Biomedical Engineering';
          const dept = row[3] || 'General';
          const staffName = row[4] || '';
          const contactType = row[5] || '';
          const use_service1 = row[6] || '';

          const parseNum = (val: string) => {
            const n = parseInt(val, 10);
            return isNaN(n) ? 5 : Math.max(1, Math.min(5, n));
          };

          const q1_1 = parseNum(row[7]);
          const q1_2 = parseNum(row[8]);
          const q1_3 = parseNum(row[9]);
          const q1_4 = parseNum(row[10]);
          const q1_5 = parseNum(row[11]);
          const q1_6 = parseNum(row[12]);
          const q1_7 = parseNum(row[13]);

          const use_service2 = row[14] || '';
          const q2_1 = parseNum(row[15]);
          const q2_2 = parseNum(row[16]);
          const q2_3 = parseNum(row[17]);
          const q2_4 = parseNum(row[18]);
          const q2_5 = parseNum(row[19]);

          const goodStaff = row[20] || '';
          const goodReason = row[21] || '';
          const badStaff = row[22] || '';
          const badReason = row[23] || '';
          const extraNote = row[24] || goodReason || '';

          let formattedTime = new Date().toISOString();
          if (timestampRaw) {
            const parts = timestampRaw.split(' ');
            if (parts[0] && parts[0].includes('/')) {
              const dateParts = parts[0].split('/');
              if (dateParts.length === 3) {
                const day = dateParts[0].padStart(2, '0');
                const month = dateParts[1].padStart(2, '0');
                let year = parseInt(dateParts[2], 10);
                if (year > 2500) year -= 543;
                const timeStr = parts[1] || '00:00:00';
                formattedTime = `${year}-${month}-${day}T${timeStr}`;
              }
            } else {
              formattedTime = timestampRaw;
            }
          }

          csiRecords.push({
            timestamp: formattedTime,
            site, division, dept, staffName, contactType,
            use_service1, q1_1, q1_2, q1_3, q1_4, q1_5, q1_6, q1_7,
            use_service2, q2_1, q2_2, q2_3, q2_4, q2_5,
            goodStaff, goodReason, badStaff, badReason, extraNote
          });
        }
      }

      // 2. Fetch Employees (Try multiple common tab names)
      const possibleStaffTabs = ['ข้อมูลพนักงาน', 'พนักงาน', 'รายชื่อพนักงาน', 'Employees', 'Staff', 'Sheet2'];
      const employees: Employee[] = [];

      for (const tabName of possibleStaffTabs) {
        try {
          const staffUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
          const staffRes = await fetch(staffUrl);
          if (staffRes.ok) {
            const staffCsv = await staffRes.text();
            if (staffCsv && !staffCsv.includes('google-signin') && !staffCsv.includes('<!DOCTYPE html>')) {
              const staffRows = parseCSV(staffCsv);
              if (staffRows.length > 1) {
                let fullNameIdx = 0;
                let nicknameIdx = 1;
                let imgIdx = 2;
                let usernameIdx = 3;
                let passIdx = 4;

                const header = staffRows[0].map(h => (h || '').trim().toLowerCase());
                header.forEach((col, idx) => {
                  if ((col.includes('ชื่อ') && !col.includes('เล่น')) || col.includes('full') || col.includes('name')) fullNameIdx = idx;
                  if (col.includes('เล่น') || col.includes('nick')) nicknameIdx = idx;
                  if (col.includes('รูป') || col.includes('img') || col.includes('pic') || col.includes('photo') || col.includes('avatar')) imgIdx = idx;
                  if (col.includes('user') || col.includes('รหัสพนักงาน') || col.includes('รหัส') || col.includes('id')) usernameIdx = idx;
                  if (col.includes('pass') || col.includes('รหัสผ่าน')) passIdx = idx;
                });

                for (let j = 1; j < staffRows.length; j++) {
                  const sRow = staffRows[j];
                  if (sRow && sRow.length >= 2) {
                    const cleanStr = (val: string) => (val || '').replace(/\s*\(?https?:\/\/[^\s)]+\)?/gi, '').trim();

                    const fullName = cleanStr(sRow[fullNameIdx] || '');
                    const nickname = cleanStr(sRow[nicknameIdx] || fullName || '');
                    let img = (sRow[imgIdx] || '').trim();
                    const username = (sRow[usernameIdx] || `emp_${j}`).trim();
                    const password = (sRow[passIdx] || '123').trim();

                    if (img && !img.startsWith('http')) {
                      img = `https://${img}`;
                    }

                    if (!img) {
                      img = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nickname || fullName || 'user')}&skinColor=f8d25c`;
                    }

                    const uUpper = username.toUpperCase();
                    const isAdmin = uUpper.includes('ADMIN') || uUpper.includes('SPV') || uUpper.includes('MGR') || uUpper === '563770';

                    if (fullName || nickname || username) {
                      employees.push({
                        id: `sheet-emp-${username}`,
                        username,
                        password,
                        fullName,
                        nickname,
                        club: 'ชมรมเดิน-วิ่ง',
                        img,
                        status: 'active',
                        isAdmin
                      });
                    }
                  }
                }
                if (employees.length > 0) break; // Successfully parsed staff from this tab
              }
            }
          }
        } catch (e) {
          console.warn(`Attempt to fetch sheet tab '${tabName}' skipped:`, e);
        }
      }

      // 3. Fetch Coaching / แผนพัฒนา (try multiple common tab names)
      const possibleCoachingTabs = ['แผนพัฒนา', 'แผนพัฒนาพนักงาน', 'Coaching', 'IDP', 'Coaching Records', 'แผนพัฒนา & Coaching', 'Sheet3'];
      const coachingRecords: CoachingRecord[] = [];

      for (const tabName of possibleCoachingTabs) {
        try {
          const coachUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
          const coachRes = await fetch(coachUrl);
          if (coachRes.ok) {
            const coachCsv = await coachRes.text();
            if (coachCsv && !coachCsv.includes('google-signin') && !coachCsv.includes('<!DOCTYPE html>')) {
              const coachRows = parseCSV(coachCsv);
              if (coachRows.length > 1) {
                let empIdIdx = 0, typeIdx = 1, posIdx = 2, fullIdx = 3, nickIdx = 4, animalIdx = 5, coachIdx = 6, t1Idx = 7, t2Idx = 8, t3Idx = 9, scoreIdx = 10, progIdx = 11, totalHoursIdx = 12;

                const header = coachRows[0].map(h => (h || '').trim().toLowerCase());
                header.forEach((col, idx) => {
                  if (col.includes('รหัส') || col.includes('id') || col.includes('empid')) empIdIdx = idx;
                  if (col.includes('สัญญา') || col.includes('contract') || col.includes('ประเภทพนักงาน')) typeIdx = idx;
                  if (col.includes('ตำแหน่ง') || col.includes('position') || col.includes('role')) posIdx = idx;
                  if ((col.includes('ชื่อ') && !col.includes('เล่น') && !col.includes('โค้ช')) || col.includes('full') || col.includes('name')) fullIdx = idx;
                  if (col.includes('เล่น') || col.includes('nick')) nickIdx = idx;
                  if (col.includes('สัตว์') || col.includes('disc') || col.includes('animal')) animalIdx = idx;
                  if (col.includes('โค้ช') || col.includes('coach')) coachIdx = idx;
                  if (col.includes('ลำดับที่ 1') || col.includes('เรื่องที่ 1') || col.includes('topic1') || col.includes('topic 1')) t1Idx = idx;
                  if (col.includes('ลำดับที่ 2') || col.includes('เรื่องที่ 2') || col.includes('topic2') || col.includes('topic 2')) t2Idx = idx;
                  if (col.includes('ลำดับที่ 3') || col.includes('เรื่องที่ 3') || col.includes('topic3') || col.includes('topic 3')) t3Idx = idx;
                  if (col.includes('คะแนน') || col.includes('score') || col.includes('eval')) scoreIdx = idx;
                  if (col.includes('ก้าวหน้า') || col.includes('progress') || col.includes('%')) progIdx = idx;
                  if (col.includes('ชั่วโมง') || col.includes('hours') || col.includes('total')) totalHoursIdx = idx;
                });

                for (let j = 1; j < coachRows.length; j++) {
                  const cRow = coachRows[j];
                  if (cRow && cRow.length >= 3) {
                    const cleanStr = (val: string) => (val || '').trim();

                    const empId = cleanStr(cRow[empIdIdx] || `emp_${j}`);
                    const contractType = (cleanStr(cRow[typeIdx]).toLowerCase().includes('full') ? 'Full Time' : 'Out source') as any;
                    const position = cleanStr(cRow[posIdx] || 'Engineer');
                    const fullName = cleanStr(cRow[fullIdx] || '');
                    const nickname = cleanStr(cRow[nickIdx] || fullName || '');

                    let animalRaw = cleanStr(cRow[animalIdx]);
                    let animalType: 'กระทิง' | 'อินทรีย์' | 'หมี' | 'หนู' = 'หมี';
                    if (animalRaw.includes('กระทิง') || animalRaw.toLowerCase().includes('bull')) animalType = 'กระทิง';
                    else if (animalRaw.includes('อินทรีย์') || animalRaw.toLowerCase().includes('eagle')) animalType = 'อินทรีย์';
                    else if (animalRaw.includes('หนู') || animalRaw.toLowerCase().includes('mouse')) animalType = 'หนู';
                    else animalType = 'หมี';

                    const coachName = cleanStr(cRow[coachIdx] || 'ชาลี');
                    const topic1 = cleanStr(cRow[t1Idx] || 'ยังไม่กำหนด');
                    const topic2 = cleanStr(cRow[t2Idx] || 'ยังไม่กำหนด');
                    const topic3 = cleanStr(cRow[t3Idx] || 'ยังไม่กำหนด');
                    const evaluationScore = parseInt(cleanStr(cRow[scoreIdx]), 10) || 7;
                    const progressPercent = parseInt(cleanStr(cRow[progIdx]), 10) || 50;
                    const totalHours = parseFloat(cleanStr(cRow[totalHoursIdx])) || 6;

                    if (fullName || nickname || empId) {
                      coachingRecords.push({
                        id: `coach-sheet-${empId}`,
                        empId,
                        contractType,
                        position,
                        fullName,
                        nickname,
                        animalType,
                        coachName,
                        topic1,
                        topic2,
                        topic3,
                        evaluationScore,
                        progressPercent,
                        hoursW1: 1, hoursW2: 1, hoursW3: 1, hoursW4: 1, hoursW5: 1, hoursW6: 1,
                        totalHours
                      });
                    }
                  }
                }
                if (coachingRecords.length > 0) break;
              }
            }
          }
        } catch (e) {
          console.warn(`Attempt to fetch coaching tab '${tabName}' skipped:`, e);
        }
      }

      return {
        success: true,
        csiRecords,
        employees,
        coachingRecords
      };
    } catch (e: any) {
      console.error('Client-side Google Sheet fetch error:', e);
      return { success: false, message: `ไม่สามารถดึงข้อมูลจาก Google Sheet ได้: ${e.message}` };
    }
  }
}
