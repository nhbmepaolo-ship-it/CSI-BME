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

export function isAuthorizedAdminUser(user: { username?: string; fullName?: string; isAdmin?: boolean } | null | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const username = (user.username || '').trim().toUpperCase();
  const fullName = (user.fullName || '').trim().toLowerCase();

  if (ADMIN_USERS.includes(username)) return true;
  if (username === '563770' || username === 'MGR_BME' || username === 'SPV_BME') return true;
  if (fullName.includes('chalee') || fullName.includes('ชาลี')) return true;
  if (fullName.includes('raschanee') || fullName.includes('รัชณี')) return true;
  if (fullName.includes('supattra') || fullName.includes('สุพัตรา')) return true;
  return false;
}

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    fullName: 'Supattra Kaewsuwan',
    nickname: 'เปี้ยว',
    username: '563770',
    password: '563770@Nhealth',
    img: 'https://img2.pic.in.th/BME_563770..045756.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: true,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-2',
    fullName: 'Chalee Meksuwan',
    nickname: 'ปิ้ง',
    username: 'MGR_BME',
    password: 'Mgr-BME',
    img: 'https://img2.pic.in.th/S__6471704_0-removebg-preview.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: true,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-3',
    fullName: 'Raschanee Majanit',
    nickname: 'มิน',
    username: 'SPV_BME',
    password: 'Spv-BME@PTP',
    img: 'https://img1.pic.in.th/images/970d1e089ad78d07db702e1eab5698c6.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: true,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-4',
    fullName: 'Aiyaret Kitjachanchaikun',
    nickname: 'เป๊ก',
    username: '603892',
    password: '603892@Nhealth',
    img: 'https://img2.pic.in.th/BME_603892..045611.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-5',
    fullName: 'Nattaporn Sawisith',
    nickname: 'ณฐ',
    username: '563779',
    password: '563779@Nhealth',
    img: 'https://img1.pic.in.th/images/BME_563779..045629.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-6',
    fullName: 'Suphawat Ketman',
    nickname: 'ลูกตอล',
    username: '606675',
    password: '606675@Nhealth',
    img: 'https://img2.pic.in.th/BME_606675..045820.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-7',
    fullName: 'Suwapa Phuakphan',
    nickname: 'อ้อ',
    username: '612366',
    password: '612366@Nhealth',
    img: 'https://img2.pic.in.th/BME_612366..045835.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-8',
    fullName: 'Thaweewat Thukruea',
    nickname: 'ซัน',
    username: '614669',
    password: '614669@Nhealth',
    img: 'https://img1.pic.in.th/images/BME_614669..045936.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-9',
    fullName: 'Titima Puchangthong',
    nickname: 'จิ๊บ',
    username: '616475',
    password: '616475@Nhealth',
    img: 'https://img1.pic.in.th/images/BME_616475..050052.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-10',
    fullName: 'Salisa Saelim',
    nickname: 'ษา',
    username: '620331',
    password: '620331@Nhealth',
    img: 'https://img1.pic.in.th/images/6596ac2053383a160.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-11',
    fullName: 'Kanthida Hamontree',
    nickname: 'แฮม',
    username: '622659',
    password: '622659@Nhealth',
    img: 'https://img1.pic.in.th/images/5fb2f77d94121bd37.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-12',
    fullName: 'Pannapat Pitpan',
    nickname: 'อ้น',
    username: '622947',
    password: '622947@Nhealth',
    img: 'https://img2.pic.in.th/4447b7344aeba4742.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-13',
    fullName: 'Jatasig Imtour',
    nickname: 'เอ็ก',
    username: '625192',
    password: '625192@Nhealth',
    img: 'https://img2.pic.in.th/images/625192.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-14',
    fullName: 'Pinmanee Thassakhang',
    nickname: 'ปิ่น',
    username: '625195',
    password: '625195@Nhealth',
    img: 'https://img2.pic.in.th/3dd5cdfa08338f7c4.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-15',
    fullName: 'Sutatip Aiemmee',
    nickname: 'ปุ๋ย',
    username: '627537',
    password: '627537@Nhealth',
    img: 'https://img2.pic.in.th/ChatGPT-Image-Sep-4-2026-05_05_36-PM.png',
    club: 'ชมรมเดิน-วิ่ง',
    status: 'active',
    isAdmin: false,
    dept: 'Biomedical Engineering'
  },
  {
    id: 'emp-16',
    fullName: 'Pichaya Narapong',
    nickname: 'ไอซ์',
    username: '627826',
    password: '627826@Nhealth',
    img: 'https://img1.pic.in.th/images/49d801c9-c50d-4ac0-b054-85b551c86d98.png',
    club: 'ชมรมเดิน-วิ่ง',
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
    nominee: 'Aiyaret Kitjachanchaikun',
    voteMonth: '2026-08'
  },
  {
    id: 'vote-2',
    timestamp: '2026-08-28 11:30:00',
    voter: '603892',
    category: 'สุดยอดผู้ช่วยเหลือ (Super Helper)',
    nominee: 'Nattaporn Sawisith',
    voteMonth: '2026-08'
  },
  {
    id: 'vote-3',
    timestamp: '2026-08-27 15:45:00',
    voter: '563779',
    category: 'ดาวรุ่งนักสร้างสรรค์ (Creative Thinker)',
    nominee: 'Suwapa Phuakphan',
    voteMonth: '2026-08'
  },
  {
    id: 'vote-4',
    timestamp: '2026-08-26 09:12:00',
    voter: '612366',
    category: 'สุดยอดนักทำงานเป็นทีม (Team Player)',
    nominee: 'Salisa Saelim',
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
    club: 'ชมรมเดิน-วิ่ง',
    activityCategory: 'Happy Life',
    activityName: 'ชมรมเดิน-วิ่ง',
    description: 'เดิน-วิ่ง เพื่อสุขภาพยามเช้า',
    hours: 2,
    minutes: 0,
    totalMinutes: 120,
    dateKey: '2026-08-29'
  },
  {
    id: 'act-2',
    timestamp: '2026-08-28T18:00:00',
    username: '603892',
    fullName: 'Aiyaret Kitjachanchaikun',
    nickname: 'เปิ้ก',
    club: 'ชมรมเดิน-วิ่ง',
    activityCategory: 'HR-PTP',
    activityName: 'เต้นแอโรบิก (HR-PTP)',
    description: 'เข้าร่วมเต้นแอโรบิกลานกิจกรรม',
    hours: 1,
    minutes: 30,
    totalMinutes: 90,
    dateKey: '2026-08-28'
  },
  {
    id: 'act-3',
    timestamp: '2026-08-27T07:00:00',
    username: '563779',
    fullName: 'Nattaporn Sawisith',
    nickname: 'ณฐ',
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
    username: '612366',
    fullName: 'Suwapa Phuakphan',
    nickname: 'อ้อ',
    club: 'ชมรมเดิน-วิ่ง',
    activityCategory: 'HR-PTP',
    activityName: 'ตลาดปันสุข (HR-PTP)',
    description: 'ร่วมจัดซุ้มและแบ่งปันอาหารโครงการตลาดปันสุข',
    hours: 0,
    minutes: 45,
    totalMinutes: 45,
    dateKey: '2026-08-26'
  }
];
