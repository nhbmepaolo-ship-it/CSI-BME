export type HappyLifeClub = 
  | 'ชมรมเดิน-วิ่ง'
  | 'ชมรมฟุตบอล'
  | 'ชมรมแบตมินตัน'
  | 'ชมรมทำอาหาร'
  | 'ชมรมดนตรี';

export interface Employee {
  id: string;
  fullName: string;
  nickname: string;
  username: string;
  password?: string;
  img: string;
  club: HappyLifeClub;
  status: 'active' | 'resigned';
  isAdmin: boolean;
  dept?: string;
}

export interface CSIRecord {
  timestamp: string;
  site?: string;
  division?: string;
  dept: string;
  staffName: string;
  contactType?: string;
  use_service1?: string;
  q1_1: number;
  q1_2: number;
  q1_3: number;
  q1_4: number;
  q1_5: number;
  q1_6: number;
  q1_7: number;
  use_service2?: string;
  q2_1: number;
  q2_2: number;
  q2_3: number;
  q2_4: number;
  q2_5: number;
  goodStaff: string;
  goodReason: string;
  badStaff: string;
  badReason: string;
  extraNote: string;
}

export interface VoteRecord {
  id: string;
  timestamp: string;
  voter: string;
  category: string;
  nominee: string;
  voteMonth: string; // 'yyyy-MM'
}

export type ActivityCategory = 'Happy Life' | 'HR-PTP' | 'อื่นๆ';

export interface ActivityRecord {
  id: string;
  timestamp: string;
  username: string;
  fullName: string;
  nickname: string;
  club: HappyLifeClub;
  activityCategory: ActivityCategory;
  activityName: string;
  description: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
  dateKey: string; // 'yyyy-MM-dd' or 'yyyy-MM'
}

export interface CardAnnouncementSettings {
  lineWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}
