import { OrgChartConfig } from '../types';

export const INITIAL_ORG_CHART: OrgChartConfig = {
  title: 'Organizational Chart BME PTP',
  subtitle: 'โครงสร้างการบริหารงาน 10 ระบบ',
  nodes: [
    // Top Level - Manager
    {
      id: 'org-1',
      employeeId: 'emp-2',
      fullName: 'Chalee Meksuwan',
      nickname: 'ปิ้ง',
      roleTitle: 'Manager',
      badgeLevel: 'Manager',
      photoUrl: 'https://img2.pic.in.th/S__6471704_0-removebg-preview.png',
      branchId: 'manager',
      order: 1
    },
    // Level 2 - Supervisor
    {
      id: 'org-2',
      employeeId: 'emp-3',
      fullName: 'Raschanee Majanit',
      nickname: 'มิน',
      roleTitle: 'supervisor',
      badgeLevel: 'Supervisor',
      photoUrl: 'https://img2.pic.in.th/S__6471705_0-removebg-preview.png',
      branchId: 'supervisor',
      order: 1
    },

    // Left Branch - Team UCC
    {
      id: 'org-3',
      employeeId: 'emp-1',
      fullName: 'Supattra Kaewsuwan',
      nickname: 'เปี้ยว',
      roleTitle: 'Senior Staff',
      badgeLevel: 'Senior Staff',
      photoUrl: 'https://img2.pic.in.th/BME_563770..045756.png',
      systems: [2, 5],
      tags: [
        { id: 't-1', text: 'Research & Development', color: 'blue' },
        { id: 't-2', text: 'PM', color: 'blue' },
        { id: 't-3', text: 'CM', color: 'cyan' }
      ],
      branchId: 'ucc',
      order: 1
    },
    {
      id: 'org-4',
      employeeId: 'sheet-emp-612366',
      fullName: 'Suwapa Phuakphan',
      nickname: 'อ้อ',
      roleTitle: 'PM by Site',
      badgeLevel: 'Staff',
      photoUrl: 'https://img2.pic.in.th/BME_612366..045835.png',
      tags: [
        { id: 't-4', text: 'PM by Site', color: 'blue' }
      ],
      branchId: 'ucc',
      order: 2
    },
    {
      id: 'org-5',
      employeeId: 'sheet-emp-603892',
      fullName: 'Aiyaret Kitjachanchaikun',
      nickname: 'เป๊ก',
      roleTitle: 'Medical Gas',
      badgeLevel: 'Staff',
      photoUrl: 'https://img2.pic.in.th/BME_603892..045611.png',
      tags: [
        { id: 't-5', text: 'Medical Gas', color: 'blue' }
      ],
      branchId: 'ucc',
      order: 3
    },
    {
      id: 'org-6',
      employeeId: 'sheet-emp-606675',
      fullName: 'Suphawat Ketman',
      nickname: 'ลูกตาล',
      roleTitle: 'Transfer In,Out',
      badgeLevel: 'Staff',
      photoUrl: 'https://img2.pic.in.th/BME_606675..045820.png',
      tags: [
        { id: 't-6', text: 'Transfer In,Out', color: 'blue' }
      ],
      branchId: 'ucc',
      order: 4
    },
    {
      id: 'org-7',
      employeeId: 'emp-naruemol',
      fullName: 'Naruemol Jonkokguard',
      nickname: 'นฤมล',
      roleTitle: 'Admin / Junior Staff',
      badgeLevel: 'Junior Staff',
      photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Naruemol',
      tags: [
        { id: 't-7', text: 'Admin', color: 'orange' },
        { id: 't-8', text: 'Junior Staff', color: 'amber' }
      ],
      branchId: 'ucc',
      order: 5
    },

    // Center Branch
    {
      id: 'org-8',
      employeeId: 'sheet-emp-622659',
      fullName: 'Kanthida Hamontree',
      nickname: 'แฮม',
      roleTitle: 'Inventory, Training',
      badgeLevel: 'Staff',
      photoUrl: 'https://img1.pic.in.th/images/5fb2f77d94121bd37.png',
      tags: [
        { id: 't-9', text: 'Inventory', color: 'blue' },
        { id: 't-10', text: 'Training', color: 'cyan' }
      ],
      branchId: 'center',
      order: 1
    },
    {
      id: 'org-9',
      employeeId: 'sheet-emp-622947',
      fullName: 'Pannapat Pitpan',
      nickname: 'อ้อน',
      roleTitle: 'Plan battery',
      badgeLevel: 'Staff',
      photoUrl: 'https://img2.pic.in.th/4447b7344aeba4742.png',
      tags: [
        { id: 't-11', text: 'Plan battery', color: 'blue' }
      ],
      branchId: 'center',
      order: 2
    },
    {
      id: 'org-10',
      employeeId: 'sheet-emp-625192',
      fullName: 'Jatasig Imtour',
      nickname: 'เอิ๊ก',
      roleTitle: 'Medical Gas, Junior Staff',
      badgeLevel: 'Junior Staff',
      photoUrl: 'https://img1.pic.in.th/images/625192.png',
      tags: [
        { id: 't-12', text: 'Medical Gas', color: 'purple' },
        { id: 't-13', text: 'Junior Staff', color: 'amber' }
      ],
      branchId: 'center',
      order: 3
    },

    // Right Branch - Team UQC
    {
      id: 'org-11',
      employeeId: 'sheet-emp-563779',
      fullName: 'Nattaporn Sawisith',
      nickname: 'ณฐ',
      roleTitle: 'Senior Staff',
      badgeLevel: 'Senior Staff',
      photoUrl: 'https://img1.pic.in.th/images/BME_563779..045629.png',
      systems: [6, 7],
      tags: [
        { id: 't-14', text: 'PM by Vendor', color: 'blue' }
      ],
      branchId: 'uqc',
      order: 1
    },
    {
      id: 'org-12',
      employeeId: 'sheet-emp-614669',
      fullName: 'Thaweewat Thukruea',
      nickname: 'ซัน',
      roleTitle: 'ECRI',
      badgeLevel: 'Staff',
      photoUrl: 'https://img1.pic.in.th/images/BME_614669..045936.png',
      tags: [
        { id: 't-15', text: 'ECRI', color: 'blue' }
      ],
      branchId: 'uqc',
      order: 2
    },
    {
      id: 'org-13',
      employeeId: 'sheet-emp-616475',
      fullName: 'Titima Puchangthong',
      nickname: 'จิ๊บ',
      roleTitle: 'PM by Site, Stock',
      badgeLevel: 'Staff',
      photoUrl: 'https://img1.pic.in.th/images/BME_616475..050052.png',
      tags: [
        { id: 't-16', text: 'PM by Site', color: 'blue' },
        { id: 't-17', text: 'Stock', color: 'cyan' }
      ],
      branchId: 'uqc',
      order: 3
    },
    {
      id: 'org-14',
      employeeId: 'sheet-emp-625195',
      fullName: 'Pinmanee Thassakhang',
      nickname: 'ปิ่น',
      roleTitle: 'PM by Vendor, Junior Staff',
      badgeLevel: 'Junior Staff',
      photoUrl: 'https://img2.pic.in.th/3dd5cdfa08338f7c4.png',
      tags: [
        { id: 't-18', text: 'PM by Vendor', color: 'purple' },
        { id: 't-19', text: 'Junior Staff', color: 'amber' }
      ],
      branchId: 'uqc',
      order: 4
    },
    {
      id: 'org-15',
      employeeId: 'sheet-emp-620331',
      fullName: 'Salisa Saelim',
      nickname: 'ษา',
      roleTitle: 'Equipment Pool',
      badgeLevel: 'Staff',
      photoUrl: 'https://img1.pic.in.th/images/6596ac2053383a160.png',
      tags: [
        { id: 't-20', text: 'Equipment Pool', color: 'blue' }
      ],
      branchId: 'uqc',
      order: 5
    }
  ]
};
