import { Employee, CSIRecord, VoteRecord, ActivityRecord, CardAnnouncementSettings } from '../types';
import { INITIAL_EMPLOYEES, INITIAL_CSI_RECORDS, INITIAL_VOTES, INITIAL_ACTIVITIES } from '../data/initialData';

const KEYS = {
  EMPLOYEES: 'csi_bme_employees_v2',
  CSI_RECORDS: 'csi_bme_csi_records_v2',
  VOTES: 'csi_bme_votes_v2',
  ACTIVITIES: 'csi_bme_activities_v2',
  CURRENT_USER: 'csi_bme_current_user_v2',
  CARD_SETTINGS: 'csi_bme_card_settings_v2',
  SHEET_ID: 'csi_bme_sheet_id_v2'
};

export class StorageService {
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

    let hasChanges = false;
    const cleanStr = (s: string) => (s || '').replace(/\s*\(?https?:\/\/[^\s)]+\)?/gi, '').trim();

    const cleanedList: Employee[] = [];
    const seenUsernames = new Set<string>();

    for (const emp of list) {
      const cleanNick = cleanStr(emp.nickname);
      const cleanFull = cleanStr(emp.fullName);

      // Filter out old dummy mock accounts
      if (emp.username && (emp.username.startsWith('emp_a') || emp.username.startsWith('emp_nan') || emp.username.startsWith('emp_jiw') || emp.username.startsWith('emp_name') || emp.username.startsWith('emp_da'))) {
        hasChanges = true;
        continue;
      }

      if (!cleanNick && !cleanFull) {
        hasChanges = true;
        continue;
      }

      const key = (emp.username || cleanFull).toLowerCase();
      if (seenUsernames.has(key)) {
        hasChanges = true;
        continue;
      }
      seenUsernames.add(key);

      let img = emp.img;
      if (img && img.includes('images.unsplash.com')) {
        img = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanNick || cleanFull)}&skinColor=f8d25c`;
        hasChanges = true;
      }

      if (cleanNick !== emp.nickname || cleanFull !== emp.fullName) {
        hasChanges = true;
      }

      cleanedList.push({
        ...emp,
        nickname: cleanNick || cleanFull,
        fullName: cleanFull || cleanNick,
        img
      });
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
    list.unshift(record);
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
    const userLower = voter.trim().toLowerCase();

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
    return {
      success: true,
      message: `บันทึกผลการโหวตรอบเดือน ${voteMonth} เรียบร้อยแล้ว!`,
      monthKey: voteMonth
    };
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
      return {
        success: false,
        message: `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ${err.message || 'โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'}`
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
    const list = this.getActivities().filter(a => a.id !== id);
    this.saveActivities(list);
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
    if (data) {
      try { return JSON.parse(data); } catch { return {}; }
    }
    return {
      lineWebhookUrl: '',
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

  static async fetchAndSyncFromGoogleSheet(customSheetId?: string): Promise<{ success: boolean; totalFetched: number; message: string }> {
    const sheetId = customSheetId || this.getGoogleSheetId();
    try {
      const response = await fetch(`/api/fetch-sheet-data?sheetId=${encodeURIComponent(sheetId)}`);
      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          totalFetched: 0,
          message: data.message || 'ไม่สามารถเชื่อมต่อดึงข้อมูลจาก Google Sheet ได้'
        };
      }

      const fetchedCsi: CSIRecord[] = data.csiRecords || [];
      const fetchedEmp: Employee[] = data.employees || [];

      if (fetchedCsi.length > 0) {
        // Merge with existing CSI records avoid complete duplication by matching timestamp + dept + staffName
        const existing = this.getCSIRecords();
        const existingKeys = new Set(existing.map(r => `${r.timestamp}_${r.dept}_${r.staffName}`));

        const newRecordsToAdd = fetchedCsi.filter(
          r => !existingKeys.has(`${r.timestamp}_${r.dept}_${r.staffName}`)
        );

        if (newRecordsToAdd.length > 0) {
          const merged = [...newRecordsToAdd, ...existing];
          this.saveCSIRecords(merged);
        } else if (existing.length === 0 || existing === INITIAL_CSI_RECORDS) {
          this.saveCSIRecords(fetchedCsi);
        }
      }

      if (fetchedEmp.length > 0) {
        const cleanStr = (s: string) => (s || '').replace(/\s*\(?https?:\/\/[^\s)]+\)?/gi, '').trim();
        const cleanFetched: Employee[] = fetchedEmp.map(e => ({
          ...e,
          fullName: cleanStr(e.fullName),
          nickname: cleanStr(e.nickname)
        }));

        const existingEmp = this.getEmployees();
        const adminAccounts = existingEmp.filter(e => ['563770', 'MGR_BME', 'SPV_BME'].includes(e.username.toUpperCase()));

        const empMap = new Map<string, Employee>();
        adminAccounts.forEach(a => empMap.set(a.username.toLowerCase(), a));
        cleanFetched.forEach(f => empMap.set(f.username.toLowerCase(), f));

        const updatedList = Array.from(empMap.values());
        this.saveEmployees(updatedList);
      }

      this.saveGoogleSheetId(sheetId);

      return {
        success: true,
        totalFetched: fetchedCsi.length,
        message: `เชื่อมต่อและดึงข้อมูลจาก Google Sheet (ID: ${sheetId}) สำเร็จแล้ว! พบแบบประเมินทั้งหมด ${fetchedCsi.length} รายการ`
      };
    } catch (err: any) {
      console.error('Error fetching sheet data:', err);
      return {
        success: false,
        totalFetched: 0,
        message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message || 'โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'}`
      };
    }
  }
}
