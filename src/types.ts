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
  lineChannelToken?: string;
  lineGroupId?: string;
  lineUserId?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export type AnimalDISCType = 'กระทิง' | 'อินทรีย์' | 'หมี' | 'หนู';

export interface CoachingRecord {
  id: string;
  empId: string;           // e.g. '761080', '569492', '563770'
  contractType: 'Full Time' | 'Out source';
  position: string;        // Manager, Supervisor, Engineer, Admin
  fullName: string;
  nickname: string;
  animalType: AnimalDISCType;
  coachName: string;       // e.g. 'ยงยุทธ', 'ชาลี'
  topic1: string;          // เรื่องที่ Coaching ลำดับที่ 1
  topic2: string;          // เรื่องที่ Coaching ลำดับที่ 2
  topic3: string;          // เรื่องที่ Coaching ลำดับที่ 3
  evaluationScore?: number;// คะแนนประเมินการพัฒนา (1-10)
  progressPercent?: number;// ความก้าวหน้า (0-100%)
  hoursW1?: number;
  hoursW2?: number;
  hoursW3?: number;
  hoursW4?: number;
  hoursW5?: number;
  hoursW6?: number;
  totalHours?: number;
}

export type OrgBadgeLevel = 'Manager' | 'Supervisor' | 'Senior Staff' | 'Junior Staff' | 'Staff' | 'Custom';

export interface OrgTag {
  id: string;
  text: string;
  color?: 'blue' | 'purple' | 'orange' | 'green' | 'cyan' | 'indigo' | 'amber';
}

export interface OrgNode {
  id: string;
  employeeId?: string;
  fullName: string;
  nickname?: string;
  roleTitle: string; // e.g. Manager, Supervisor, Senior Staff, Admin
  photoUrl?: string;
  badgeLevel?: OrgBadgeLevel;
  tags?: OrgTag[];
  systems?: number[]; // System badges e.g. [2, 5], [6, 7]
  branchId: 'manager' | 'supervisor' | 'ucc' | 'center' | 'uqc' | string;
  order: number;
}

export interface OrgChartConfig {
  title: string;
  subtitle: string;
  nodes: OrgNode[];
}
