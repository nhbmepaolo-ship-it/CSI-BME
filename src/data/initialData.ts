import { Employee, CSIRecord, VoteRecord, ActivityRecord, HappyLifeClub } from '../types';

export const DEPARTMENTS = [
  "Advanced Laparoscopic Surgery Center", "Anesthesia", "Bone & Joint", "Cardio-Neuro Vascular Intervention", 
  "Check Up Center", "Dental & Implant Center", "Diabetes Melitus & Endocrine Center", "Ear Nose Throat Clinic", 
  "Emergency & Ambulance", "Eye Clinic", "Gastrointestinal & Liver Center", "General Medicine", 
  "General Surgery", "Heart Center", "Intensive Care Unit", "Labour Room", "Let's Talk", 
  "Neurology", "Nursery", "Obstetric & Gynecology Center", "Operating Room", "Patient Escort", 
  "Patient Wards 15", "Patient Wards 16", "Patient Wards 17", "Patient Wards 18", "Patient Wards 19", 
  "Patient Wards 404", "Patient Wards 405", "Patient Wards 406", "Patient Wards 408", "Patient Wards 409", 
  "Pediatrics Center", "Pharmacy", "Physiotherapy", "Platinum Lounge", "Purchasing Department", 
  "Secuerity", "Skin", "Urology Clinic", "X-Ray", "CES-PTP"
].sort();

export const HAPPY_LIFE_CLUBS: HappyLifeClub[] = [
  'ชมรมเดิน-วิ่ง',
  'ชมรมฟุตบอล',
  'ชมรมแบตมินตัน',
  'ชมรมทำอาหาร',
  'ชมรมดนตรี'
];

export const ADMIN_USERS = ['SPV_BME', 'MGR_BME', '563770'];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    fullName: 'สมชาย ใจดี',
    nickname: 'โจ',
    username: '563770',
    password: '123',
    img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    club: 'ชมรมฟุตบอล',
    status: 'active',
    isAdmin: true,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-2',
    fullName: 'สุรชัย ผู้จัดการ',
    nickname: 'ป๋อง',
    username: 'MGR_BME',
    password: '123',
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
    club: 'ชมรมแบตมินตัน',
    status: 'active',
    isAdmin: true,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-3',
    fullName: 'ประวิทย์ ซูเปอร์ไวเซอร์',
    nickname: 'วิทย์',
    username: 'SPV_BME',
    password: '123',
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: true,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-4',
    fullName: 'วิไล รักดี',
    nickname: 'แนน',
    username: 'emp_nan',
    password: '123',
    img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
    club: 'ชมรมทำอาหาร',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-5',
    fullName: 'อรุณ มีสุข',
    nickname: 'เอ',
    username: 'emp_a',
    password: '123',
    img: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=250',
    club: 'ชมรมดนตรี',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-6',
    fullName: 'พรทิพย์ ดีงาม',
    nickname: 'จิ๋ว',
    username: 'emp_jiw',
    password: '123',
    img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250',
    club: 'ชมรมแบตมินตัน',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-7',
    fullName: 'นรินทร์ ขยัน',
    nickname: 'เนม',
    username: 'emp_name',
    password: '123',
    img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=250',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-8',
    fullName: 'สุดา ตั้งใจ',
    nickname: 'ดา',
    username: 'emp_da',
    password: '123',
    img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
    club: 'ชมรมทำอาหาร',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  }
];

export const INITIAL_CSI_RECORDS: CSIRecord[] = [
  {
    timestamp: '2026-08-28T09:15:00',
    dept: 'Emergency & Ambulance',
    staffName: 'พยาบาลสมหญิง',
    q1_1: 5, q1_2: 5, q1_3: 5, q1_4: 4, q1_5: 5, q1_6: 5, q1_7: 5,
    q2_1: 5, q2_2: 5, q2_3: 5, q2_4: 4, q2_5: 5,
    goodStaff: 'สมชาย ใจดี (โจ)',
    goodReason: 'บริการรวดเร็วมาก ซ่อมเครื่องติดตามสัญญาณชีพทันที',
    badStaff: '',
    badReason: '',
    extraNote: 'บริการดีเยี่ยมประทับใจมากค่ะ ตอบสนองรวดเร็ว'
  },
  {
    timestamp: '2026-08-27T14:30:00',
    dept: 'Operating Room',
    staffName: 'หมอวิชัย',
    q1_1: 5, q1_2: 5, q1_3: 4, q1_4: 5, q1_5: 5, q1_6: 5, q1_7: 5,
    q2_1: 4, q2_2: 5, q2_3: 5, q2_4: 5, q2_5: 5,
    goodStaff: 'วิไล รักดี (แนน), อรุณ มีสุข (เอ)',
    goodReason: 'ตรวจเช็คกล้องส่องตรวจเตรียมพร้อมก่อนเคสดีเยี่ยม',
    badStaff: '',
    badReason: '',
    extraNote: 'ทีม BME ดูแลห้องผ่าตัดได้รวดเร็วมากครับ'
  },
  {
    timestamp: '2026-08-25T11:00:00',
    dept: 'Intensive Care Unit',
    staffName: 'หัวหน้าวอร์ด ICU',
    q1_1: 5, q1_2: 5, q1_3: 5, q1_4: 5, q1_5: 5, q1_6: 4, q1_7: 5,
    q2_1: 5, q2_2: 5, q2_3: 5, q2_4: 5, q2_5: 5,
    goodStaff: 'พรทิพย์ ดีงาม (จิ๋ว)',
    goodReason: 'อธิบายการใช้งานเครื่องช่วยหายใจละเอียด สุภาพมาก',
    badStaff: '',
    badReason: '',
    extraNote: 'ขอบคุณที่มาช่วยตั้งค่าเครื่องในเวลาเร่งด่วน'
  },
  {
    timestamp: '2026-08-20T16:20:00',
    dept: 'X-Ray',
    staffName: 'นักรังสีเทคนิค',
    q1_1: 4, q1_2: 4, q1_3: 5, q1_4: 4, q1_5: 5, q1_6: 4, q1_7: 5,
    q2_1: 4, q2_2: 5, q2_3: 4, q2_4: 5, q2_5: 4,
    goodStaff: 'นรินทร์ ขยัน (เนม)',
    goodReason: 'ช่วยประสานงานช่างนอกเข้ามาดูแลทันที',
    badStaff: '',
    badReason: '',
    extraNote: 'อยากให้เพิ่มรอบการทำ PM เครื่องรังสี'
  },
  {
    timestamp: '2026-08-18T10:45:00',
    dept: 'Cardio-Neuro Vascular Intervention',
    staffName: 'พยาบาลกาญจนา',
    q1_1: 5, q1_2: 5, q1_3: 5, q1_4: 5, q1_5: 5, q1_6: 5, q1_7: 5,
    q2_1: 5, q2_2: 5, q2_3: 5, q2_4: 5, q2_5: 5,
    goodStaff: 'สุดา ตั้งใจ (ดา)',
    goodReason: 'ประสานงานดี ยิ้มแย้มแจ่มใส',
    badStaff: '',
    badReason: '',
    extraNote: 'การบริการยอดเยี่ยมไร้ที่ติ'
  }
];

export const INITIAL_VOTES: VoteRecord[] = [
  {
    id: 'vote-1',
    timestamp: '2026-08-28 10:00:00',
    voter: '563770',
    category: 'พลังบวกประจำทีม (Positive Energy)',
    nominee: 'วิไล รักดี',
    voteMonth: '2026-08'
  },
  {
    id: 'vote-2',
    timestamp: '2026-08-28 11:30:00',
    voter: 'emp_nan',
    category: 'สุดยอดผู้ช่วยเหลือ (Super Helper)',
    nominee: 'สมชาย ใจดี',
    voteMonth: '2026-08'
  },
  {
    id: 'vote-3',
    timestamp: '2026-08-27 15:45:00',
    voter: 'emp_a',
    category: 'ดาวรุ่งนักสร้างสรรค์ (Creative Thinker)',
    nominee: 'สุดา ตั้งใจ',
    voteMonth: '2026-08'
  },
  {
    id: 'vote-4',
    timestamp: '2026-08-26 09:12:00',
    voter: 'emp_jiw',
    category: 'สุดยอดนักทำงานเป็นทีม (Team Player)',
    nominee: 'นรินทร์ ขยัน',
    voteMonth: '2026-08'
  }
];

export const INITIAL_ACTIVITIES: ActivityRecord[] = [
  {
    id: 'act-1',
    timestamp: '2026-08-29T17:30:00',
    username: '563770',
    fullName: 'สมชาย ใจดี',
    nickname: 'โจ',
    club: 'ชมรมฟุตบอล',
    activityCategory: 'Happy Life',
    activityName: 'ชมรมฟุตบอล',
    description: 'เตะฟุตบอลกระชับมิตรประจำสัปดาห์',
    hours: 2,
    minutes: 0,
    totalMinutes: 120,
    dateKey: '2026-08-29'
  },
  {
    id: 'act-2',
    timestamp: '2026-08-28T18:00:00',
    username: 'emp_nan',
    fullName: 'วิไล รักดี',
    nickname: 'แนน',
    club: 'ชมรมทำอาหาร',
    activityCategory: 'HR-PTP',
    activityName: 'เต้นแอโรบิก (HR-PTP)',
    description: 'เข้าร่วมเต้นแอโรบิกลานกิจกรรมหน้าโรงพยาบาล',
    hours: 1,
    minutes: 30,
    totalMinutes: 90,
    dateKey: '2026-08-28'
  },
  {
    id: 'act-3',
    timestamp: '2026-08-27T07:00:00',
    username: 'emp_name',
    fullName: 'นรินทร์ ขยัน',
    nickname: 'เนม',
    club: 'ชมรมเดิน-วิ่ง',
    activityCategory: 'Happy Life',
    activityName: 'ชมรมเดิน-วิ่ง',
    description: 'เดิน-วิ่ง เพื่อสุขภาพยามเช้าสวนสุขภาพ',
    hours: 1,
    minutes: 15,
    totalMinutes: 75,
    dateKey: '2026-08-27'
  },
  {
    id: 'act-4',
    timestamp: '2026-08-26T12:15:00',
    username: 'emp_da',
    fullName: 'สุดา ตั้งใจ',
    nickname: 'ดา',
    club: 'ชมรมทำอาหาร',
    activityCategory: 'HR-PTP',
    activityName: 'ตลาดปันสุข (HR-PTP)',
    description: 'ร่วมจัดซุ้มและแบ่งปันอาหารโครงการตลาดปันสุข',
    hours: 0,
    minutes: 45,
    totalMinutes: 45,
    dateKey: '2026-08-26'
  },
  {
    id: 'act-5',
    timestamp: '2026-08-25T16:45:00',
    username: 'emp_jiw',
    fullName: 'พรทิพย์ ดีงาม',
    nickname: 'จิ๋ว',
    club: 'ชมรมแบตมินตัน',
    activityCategory: 'Happy Life',
    activityName: 'ชมรมแบตมินตัน',
    description: 'ซ้อมแบดมินตันกับเพื่อนสมาชิกชมรม',
    hours: 2,
    minutes: 15,
    totalMinutes: 135,
    dateKey: '2026-08-25'
  },
  {
    id: 'act-6',
    timestamp: '2026-08-24T16:00:00',
    username: 'SPV_BME',
    fullName: 'ประวิทย์ ซูเปอร์ไวเซอร์',
    nickname: 'วิทย์',
    club: 'ชมรมเดิน-วิ่ง',
    activityCategory: 'HR-PTP',
    activityName: 'รดน้ำผัก (HR-PTP)',
    description: 'แปลงผักสาธิต HR-PTP หลังอาคาร BME',
    hours: 0,
    minutes: 30,
    totalMinutes: 30,
    dateKey: '2026-08-24'
  }
];
