import { Employee, CSIRecord, VoteRecord, ActivityRecord, CardAnnouncementSettings } from '../types';
import { INITIAL_EMPLOYEES, INITIAL_CSI_RECORDS, INITIAL_VOTES, INITIAL_ACTIVITIES } from '../data/initialData';

const KEYS = {
  EMPLOYEES: 'csi_bme_employees_v2',
  CSI_RECORDS: 'csi_bme_csi_records_v2',
  VOTES: 'csi_bme_votes_v2',
  ACTIVITIES: 'csi_bme_activities_v2',
  CURRENT_USER: 'csi_bme_current_user_v2',
  CARD_SETTINGS: 'csi_bme_card_settings_v2'
};

export class StorageService {
  // Employees
  static getEmployees(): Employee[] {
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    if (!data) {
      this.saveEmployees(INITIAL_EMPLOYEES);
      return INITIAL_EMPLOYEES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_EMPLOYEES;
    }
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
    if (!data) {
      this.saveVotes(INITIAL_VOTES);
      return INITIAL_VOTES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_VOTES;
    }
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
    if (!data) {
      this.saveActivities(INITIAL_ACTIVITIES);
      return INITIAL_ACTIVITIES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_ACTIVITIES;
    }
  }

  static saveActivities(activities: ActivityRecord[]): void {
    localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify(activities));
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
}
