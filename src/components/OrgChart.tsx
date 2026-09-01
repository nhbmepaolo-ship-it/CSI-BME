import React, { useState, useEffect, useRef } from 'react';
import { OrgNode, OrgChartConfig, Employee, OrgBadgeLevel } from '../types';
import { StorageService } from '../services/storage';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface OrgChartProps {
  key?: React.Key;
  currentUser?: Employee | null;
  showToast?: (type: 'success' | 'error', msg: string) => void;
}

export function OrgChart({ currentUser, showToast }: OrgChartProps) {
  const [config, setConfig] = useState<OrgChartConfig>(() => StorageService.getOrgChart());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Check 3 allowed users: Chalee Meksuwan, Raschanee Majanit, 563770
  const canEditOrgChart = React.useMemo(() => {
    if (!currentUser) return false;
    const username = (currentUser.username || '').toLowerCase().trim();
    const fullName = (currentUser.fullName || '').toLowerCase().trim();
    const id = (currentUser.id || '').toLowerCase().trim();

    // 1. Employee code / username 563770
    if (username === '563770' || id === 'sheet-emp-563770' || id === '563770') return true;

    // 2. Chalee Meksuwan
    if (fullName.includes('chalee') || username.includes('chalee')) return true;

    // 3. Raschanee Majanit
    if (fullName.includes('raschanee') || username.includes('raschanee')) return true;

    return false;
  }, [currentUser]);

  // Force editing off if user does not have permission
  useEffect(() => {
    if (!canEditOrgChart && isEditing) {
      setIsEditing(false);
    }
  }, [canEditOrgChart, isEditing]);

  // Drag and Drop state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOverBranch, setDragOverBranch] = useState<string | null>(null);

  // Modals state
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [selectingEmpForNodeId, setSelectingEmpForNodeId] = useState<string | null>(null);
  const [addNodeBranchModal, setAddNodeBranchModal] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load active employees from StorageService
    const allEmps = StorageService.getEmployees().filter(e => e.status === 'active');
    setEmployees(allEmps);
  }, []);

  // Live lookup maps so every node's photo always matches the current employee data
  // (instead of a stale photoUrl snapshot saved into the org chart config in the past)
  const employeeById = React.useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(e => map.set(e.id, e));
    return map;
  }, [employees]);

  const employeeByName = React.useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(e => map.set(e.fullName.trim().toLowerCase(), e));
    return map;
  }, [employees]);

  // Resolve the photo to show for a node: prefer the live employee record (matched by
  // employeeId, falling back to matching full name), then fall back to the node's saved
  // photoUrl, so the org chart photo always stays matched with employee data.
  const resolveNodePhoto = (node: OrgNode): string => {
    const matched =
      (node.employeeId && employeeById.get(node.employeeId)) ||
      employeeByName.get(node.fullName.trim().toLowerCase());
    return matched?.img || node.photoUrl || '';
  };

  const getProxiedImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const handleSaveConfig = (newConfig: OrgChartConfig) => {
    if (!canEditOrgChart) {
      if (showToast) showToast('error', 'คุณไม่มีสิทธิ์ปรับแก้ไขผังองค์กร (สิทธิ์เฉพาะ คุณปิ้ง, คุณมิน, คุณเปี้ยว 563770)');
      return;
    }
    setConfig(newConfig);
    StorageService.saveOrgChart(newConfig);
    if (showToast) showToast('success', 'บันทึกการเปลี่ยนแปลงผังองค์กรเรียบร้อยแล้ว');
  };

  const handleResetOrg = () => {
    if (!canEditOrgChart) {
      if (showToast) showToast('error', 'คุณไม่มีสิทธิ์รีเซ็ตผังองค์กร');
      return;
    }
    if (window.confirm('คุณต้องการรีเซ็ตผังองค์กรกลับเป็นค่ามาตรฐาน BME PTP หรือไม่?')) {
      const resetData = StorageService.resetOrgChart();
      setConfig(resetData);
      if (showToast) showToast('success', 'รีเซ็ตผังองค์กรกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว');
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    if (!canEditOrgChart || !isEditing) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', nodeId);
    setDraggedNodeId(nodeId);
  };

  const handleDragOver = (e: React.DragEvent, branchId: string) => {
    if (!canEditOrgChart || !isEditing) return;
    e.preventDefault();
    setDragOverBranch(branchId);
  };

  const handleDragLeave = () => {
    setDragOverBranch(null);
  };

  const handleDrop = (e: React.DragEvent, targetBranchId: string) => {
    if (!canEditOrgChart || !isEditing) return;
    e.preventDefault();
    setDragOverBranch(null);
    const nodeId = e.dataTransfer.getData('text/plain') || draggedNodeId;
    if (!nodeId) return;

    const nodeIndex = config.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;

    const updatedNodes = [...config.nodes];
    const targetNodesInBranch = updatedNodes.filter(n => n.branchId === targetBranchId);

    updatedNodes[nodeIndex] = {
      ...updatedNodes[nodeIndex],
      branchId: targetBranchId,
      order: targetNodesInBranch.length + 1
    };

    handleSaveConfig({ ...config, nodes: updatedNodes });
    setDraggedNodeId(null);
  };

  // Employee Selection Modal Handler
  const handleSelectEmployee = (nodeId: string, emp: Employee) => {
    if (!canEditOrgChart) return;
    const updatedNodes = config.nodes.map(node => {
      if (node.id === nodeId) {
        return {
          ...node,
          employeeId: emp.id,
          fullName: emp.fullName,
          nickname: emp.nickname,
          photoUrl: emp.img
        };
      }
      return node;
    });

    handleSaveConfig({ ...config, nodes: updatedNodes });
    setSelectingEmpForNodeId(null);
  };

  // Node Edit Handlers
  const handleOpenEditNode = (node: OrgNode) => {
    if (!canEditOrgChart) return;
    setEditingNode({ ...node });
  };

  const handleSaveEditedNode = () => {
    if (!canEditOrgChart || !editingNode) return;
    const updatedNodes = config.nodes.map(n => (n.id === editingNode.id ? editingNode : n));
    handleSaveConfig({ ...config, nodes: updatedNodes });
    setEditingNode(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!canEditOrgChart) return;
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบุคคลนี้ออกจากผังองค์กร?')) {
      const updatedNodes = config.nodes.filter(n => n.id !== nodeId);
      handleSaveConfig({ ...config, nodes: updatedNodes });
      setEditingNode(null);
    }
  };

  const handleAddNodeToBranch = (branchId: string) => {
    if (!canEditOrgChart) return;
    const newId = `org-custom-${Date.now()}`;
    const newNode: OrgNode = {
      id: newId,
      fullName: 'พนักงานใหม่ / ระบุชื่อ',
      nickname: '',
      roleTitle: 'ตำแหน่งงาน',
      badgeLevel: 'Staff',
      branchId,
      order: config.nodes.filter(n => n.branchId === branchId).length + 1,
      tags: []
    };

    handleSaveConfig({ ...config, nodes: [...config.nodes, newNode] });
    setAddNodeBranchModal(null);
    setEditingNode(newNode);
  };

  // Helper to convert images in canvas to data URLs
  const prepareChartImagesForExport = async (container: HTMLElement) => {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgs.map(async (img) => {
        try {
          const currentSrc = img.currentSrc || img.src;
          if (!currentSrc || currentSrc.startsWith('data:')) return;

          const proxyUrl = getProxiedImageUrl(currentSrc);
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const blob = await res.blob();
            await new Promise<void>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (reader.result) {
                  img.src = reader.result as string;
                }
                resolve();
              };
              reader.onerror = () => resolve();
              reader.readAsDataURL(blob);
            });
          }
        } catch (e) {
          console.warn('Image prep warning:', e);
        }
      })
    );
  };

  // PDF Export Handler using html2canvas & jsPDF
  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);

    try {
      if (showToast) showToast('success', 'กำลังแปลงรูปภาพและสร้างไฟล์ PDF ผังองค์กร BME PTP...');

      // Step 1: Pre-convert external images to base64 Data URLs so html2canvas never fails with CORS
      await prepareChartImagesForExport(chartRef.current);

      // Step 2: Render html2canvas
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0f172a',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const renderWidth = imgWidth * ratio;
      const renderHeight = imgHeight * ratio;
      const xOffset = (pdfWidth - renderWidth) / 2;
      const yOffset = (pdfHeight - renderHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight);
      pdf.save(`Organizational_Chart_BME_PTP_${new Date().toISOString().slice(0, 10)}.pdf`);

      if (showToast) showToast('success', 'ดาวน์โหลดไฟล์ PDF ผังองค์กรสำเร็จเรียบร้อย!');
    } catch (err: any) {
      console.error('Export PDF error:', err);
      if (showToast) showToast('error', `เกิดข้อผิดพลาดในการดาวน์โหลด PDF: ${err?.message || ''} กำลังใช้วิธีพิมพ์เอกสารแทน...`);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  // PNG Export Handler
  const handleExportPNG = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);

    try {
      await prepareChartImagesForExport(chartRef.current);

      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0f172a'
      });

      const link = document.createElement('a');
      link.download = `Organizational_Chart_BME_PTP_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      if (showToast) showToast('success', 'ดาวน์โหลดภาพ PNG เรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Export PNG error:', err);
      if (showToast) showToast('error', 'ไม่สามารถสร้างภาพ PNG ได้');
    } finally {
      setIsExporting(false);
    }
  };

  // Nodes grouped by branches
  const managerNode = config.nodes.find(n => n.branchId === 'manager') || config.nodes[0];
  const supervisorNode = config.nodes.find(n => n.branchId === 'supervisor');
  const uccNodes = config.nodes.filter(n => n.branchId === 'ucc').sort((a, b) => a.order - b.order);
  const centerNodes = config.nodes.filter(n => n.branchId === 'center').sort((a, b) => a.order - b.order);
  const uqcNodes = config.nodes.filter(n => n.branchId === 'uqc').sort((a, b) => a.order - b.order);

  // Render individual Person Node Card matching image BME10PTP.png
  const renderNodeCard = (node: OrgNode, isTopLevel = false) => {
    const badgeBg = 
      node.badgeLevel === 'Manager' ? 'bg-emerald-600 text-white' :
      node.badgeLevel === 'Supervisor' ? 'bg-emerald-500 text-white' :
      node.badgeLevel === 'Senior Staff' ? 'bg-emerald-600 text-white font-extrabold' :
      node.badgeLevel === 'Junior Staff' ? 'bg-amber-500 text-slate-950 font-bold' :
      'bg-sky-500 text-white';

    return (
      <div
        key={node.id}
        draggable
        onDragStart={e => handleDragStart(e, node.id)}
        className={`group relative flex flex-col items-center transition-all duration-200 cursor-grab active:cursor-grabbing ${
          draggedNodeId === node.id ? 'opacity-40 scale-95' : 'hover:scale-[1.02]'
        }`}
      >
        {/* Node Control Action Bar (Appears on Hover / Edit mode) */}
        <div className="absolute -top-3 right-0 z-30 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 shadow-xl backdrop-blur-md">
          <button
            onClick={() => setSelectingEmpForNodeId(node.id)}
            title="เปลี่ยนตัวพนักงาน"
            className="p-1.5 text-xs text-sky-300 hover:text-white hover:bg-sky-600/40 rounded transition-colors"
          >
            <i className="fa-solid fa-user-gear"></i>
          </button>
          <button
            onClick={() => handleOpenEditNode(node)}
            title="แก้ไขข้อความ / ตำแหน่ง"
            className="p-1.5 text-xs text-amber-300 hover:text-white hover:bg-amber-600/40 rounded transition-colors"
          >
            <i className="fa-solid fa-pen"></i>
          </button>
          <button
            onClick={() => handleDeleteNode(node.id)}
            title="ลบออกจากผัง"
            className="p-1.5 text-xs text-rose-400 hover:text-white hover:bg-rose-600/40 rounded transition-colors"
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>

        {/* Outer Card Wrapper */}
        <div className="flex flex-col items-center">
          
          {/* Avatar Container */}
          <div className="relative mb-1">
            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 shadow-lg bg-slate-800 ${
              isTopLevel ? 'border-sky-400 ring-4 ring-sky-500/20' : 'border-white/40'
            }`}>
              <img
                src={getProxiedImageUrl(resolveNodePhoto(node)) || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(node.fullName)}`}
                alt={node.fullName}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(node.fullName)}`;
                }}
              />
            </div>

            {/* Badge Level Pill overlay top of avatar or right */}
            {node.badgeLevel && (
              <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shadow-md whitespace-nowrap ${badgeBg}`}>
                {node.badgeLevel}
              </div>
            )}
          </div>

          {/* Name Plate Box matching image dark blue styling */}
          <div className="mt-1 bg-[#0c2f5e] hover:bg-[#123e7a] border border-sky-400/40 rounded-xl px-3 py-1.5 shadow-md flex flex-col items-center text-center min-w-[150px] max-w-[200px] transition-colors">
            <span className="font-th font-extrabold text-xs text-white leading-tight break-words">
              {node.fullName}
            </span>
            {node.nickname && (
              <span className="text-[10px] text-sky-200/90 font-medium">
                ({node.nickname})
              </span>
            )}
            
            {/* System Badges attached (e.g. ระบบ 2, ระบบ 5, ระบบ 6, ระบบ 7) */}
            {node.systems && node.systems.length > 0 && (
              <div className="flex items-center justify-center gap-1 mt-1">
                {node.systems.map(sys => (
                  <span
                    key={sys}
                    className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] flex items-center justify-center shadow border border-emerald-300"
                    title={`ระบบ ${sys}`}
                  >
                    {sys}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tags & Role Badges (e.g., Research & Development, PM, CM, Inventory) */}
          <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5 max-w-[180px]">
            {node.tags && node.tags.map(tag => {
              const tagBg =
                tag.color === 'purple' ? 'bg-purple-500/30 text-purple-200 border-purple-400/40' :
                tag.color === 'orange' || tag.color === 'amber' ? 'bg-amber-500/30 text-amber-200 border-amber-400/40' :
                tag.color === 'cyan' ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/40' :
                'bg-sky-500/30 text-sky-200 border-sky-400/40';

              return (
                <span
                  key={tag.id}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${tagBg}`}
                >
                  {tag.text}
                </span>
              );
            })}
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-y-auto p-3 md:p-6 font-sans">
      
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <i className="fa-solid fa-sitemap text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide font-th flex items-center gap-2">
                {config.title}
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  ลากโยกย้ายได้อิสระ
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-th">
                {config.subtitle} • รองรับการแก้ไขข้อมูล เปลี่ยนตัวพนักงานตามการหมุนเวียน และพิมพ์ออกมาเป็น PDF
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 font-th">
          {canEditOrgChart ? (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                  isEditing
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/40 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                }`}
              >
                <i className={`fa-solid ${isEditing ? 'fa-check' : 'fa-pen-to-square'}`}></i>
                <span>{isEditing ? 'เสร็จสิ้นการแก้ไข' : 'โหมดแก้ไขผัง'}</span>
              </button>

              <button
                onClick={handleResetOrg}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span>รีเซ็ตผัง BME PTP</span>
              </button>
            </>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-300 text-xs flex items-center gap-2">
              <i className="fa-solid fa-lock text-amber-400"></i>
              <span>โหมดดูอย่างเดียว (ปรับแก้ผังเฉพาะ คุณปิ้ง, คุณมิน, คุณเปี้ยว 563770)</span>
            </div>
          )}

          <button
            onClick={handleExportPNG}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/40 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-file-image"></i>
            <span>ส่งออก PNG</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500 transition-all flex items-center gap-2"
          >
            {isExporting ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <i className="fa-solid fa-file-pdf"></i>
            )}
            <span>ดาวน์โหลด PDF</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600 transition-all flex items-center gap-2"
            title="พิมพ์ลงกระดาษ หรือ บันทึกเป็น PDF ผ่านเบราว์เซอร์"
          >
            <i className="fa-solid fa-print"></i>
            <span>พิมพ์ / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Main Org Chart Visual Canvas (Designed to match BME10PTP.png poster layout) */}
      <div className="flex-1 overflow-x-auto pb-8">
        <div
          ref={chartRef}
          className="min-w-[1000px] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden font-sans"
        >
          
          {/* Subtle Background Art Watermark */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Top Header Banner matching Image Logo & Title */}
          <div className="flex items-center justify-between border-b border-sky-500/20 pb-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 p-2 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                <i className="fa-solid fa-hospital-user text-3xl text-sky-400"></i>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-indigo-200 to-white font-th tracking-tight">
                  BIOMEDICAL ENGINEERING
                </h1>
                <p className="text-xs text-sky-300/80 font-bold tracking-widest uppercase">
                  Medical Device Management & Services
                </p>
              </div>
            </div>

            {/* Right Banner Badge matching BME10PTP.png */}
            <div className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white px-6 py-3 rounded-2xl shadow-xl border border-sky-300/30 text-right">
              <h2 className="text-xl md:text-2xl font-black font-th tracking-wide">
                Organizational Chart
              </h2>
              <div className="text-sm font-bold text-sky-200 font-th">
                BME PTP
              </div>
            </div>
          </div>

          {/* Org Tree Structure */}
          <div className="flex flex-col items-center gap-8 relative z-10">

            {/* LEVEL 1: Manager */}
            {managerNode && (
              <div className="flex flex-col items-center relative">
                {renderNodeCard(managerNode, true)}
                {/* Connector Line down to Supervisor */}
                <div className="w-0.5 h-8 bg-sky-500/60 mt-2"></div>
              </div>
            )}

            {/* LEVEL 2: Supervisor */}
            {supervisorNode && (
              <div className="flex flex-col items-center relative">
                {renderNodeCard(supervisorNode, true)}
                {/* Connector Line down to Branches */}
                <div className="w-0.5 h-8 bg-sky-500/60 mt-2"></div>
              </div>
            )}

            {/* Horizontal Branch Connector Bar */}
            <div className="w-[85%] h-0.5 bg-sky-500/60 relative">
              <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-sky-400 -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-sky-400 -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-sky-400 translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* LEVEL 3: 3 Main Branches (UCC, Center, UQC) */}
            <div className="grid grid-cols-3 gap-6 w-full pt-2">

              {/* BRANCH 1: Team UCC (Left) */}
              <div
                onDragOver={e => handleDragOver(e, 'ucc')}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, 'ucc')}
                className={`flex flex-col items-center bg-slate-900/40 border rounded-2xl p-4 transition-all ${
                  dragOverBranch === 'ucc'
                    ? 'border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-500/20'
                    : 'border-slate-800'
                }`}
              >
                {/* Branch Header Badge */}
                <div className="bg-sky-600/30 text-sky-200 border border-sky-400/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-md flex items-center gap-2">
                  <i className="fa-solid fa-users text-sky-300"></i>
                  <span>Team UCC</span>
                </div>

                <div className="flex flex-col items-center gap-6 w-full">
                  {uccNodes.map(node => renderNodeCard(node))}
                </div>

                {isEditing && (
                  <button
                    onClick={() => handleAddNodeToBranch('ucc')}
                    className="mt-6 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i>
                    <span>เพิ่มคนใน Team UCC</span>
                  </button>
                )}
              </div>

              {/* BRANCH 2: Center Branch */}
              <div
                onDragOver={e => handleDragOver(e, 'center')}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, 'center')}
                className={`flex flex-col items-center bg-slate-900/40 border rounded-2xl p-4 transition-all ${
                  dragOverBranch === 'center'
                    ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-800'
                }`}
              >
                <div className="bg-cyan-600/30 text-cyan-200 border border-cyan-400/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-md flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-cyan-300"></i>
                  <span>ส่วนกลาง & สินคลัง</span>
                </div>

                <div className="flex flex-col items-center gap-6 w-full">
                  {centerNodes.map(node => renderNodeCard(node))}
                </div>

                {isEditing && (
                  <button
                    onClick={() => handleAddNodeToBranch('center')}
                    className="mt-6 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i>
                    <span>เพิ่มคนในส่วนกลาง</span>
                  </button>
                )}
              </div>

              {/* BRANCH 3: Team UQC (Right) */}
              <div
                onDragOver={e => handleDragOver(e, 'uqc')}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, 'uqc')}
                className={`flex flex-col items-center bg-slate-900/40 border rounded-2xl p-4 transition-all ${
                  dragOverBranch === 'uqc'
                    ? 'border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                    : 'border-slate-800'
                }`}
              >
                <div className="bg-indigo-600/30 text-indigo-200 border border-indigo-400/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-md flex items-center gap-2">
                  <i className="fa-solid fa-certificate text-indigo-300"></i>
                  <span>Team UQC</span>
                </div>

                <div className="flex flex-col items-center gap-6 w-full">
                  {uqcNodes.map(node => renderNodeCard(node))}
                </div>

                {isEditing && (
                  <button
                    onClick={() => handleAddNodeToBranch('uqc')}
                    className="mt-6 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i>
                    <span>เพิ่มคนใน Team UQC</span>
                  </button>
                )}
              </div>

            </div>

          </div>

          {/* BOTTOM SECTION: โครงสร้างการบริหารงาน 10 ระบบ (Matching BME10PTP.png) */}
          <div className="mt-12 pt-6 border-t border-slate-800">
            
            {/* Systems Header Pill */}
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 text-white font-th font-extrabold text-sm px-6 py-2 rounded-full shadow-lg border border-white/20 uppercase tracking-wide">
                โครงสร้างการบริหารงาน 10 ระบบ
              </div>
            </div>

            {/* 4 Category Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              
              {/* Category 1: Leadership & Governance */}
              <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-3 flex flex-col items-center text-center shadow-lg">
                <span className="text-xs font-extrabold text-amber-300 font-th mb-2">
                  Leadership & Governance
                </span>
                <div className="flex items-center gap-2">
                  {[1, 2, 4].map(num => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md border border-amber-300"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              {/* Category 2: Planning & Deployment */}
              <div className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-3 flex flex-col items-center text-center shadow-lg">
                <span className="text-xs font-extrabold text-rose-300 font-th mb-2">
                  Planning & Deployment
                </span>
                <div className="flex items-center gap-2">
                  {[3, 9, 10].map(num => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-full bg-rose-500 text-white font-black text-sm flex items-center justify-center shadow-md border border-rose-300"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              {/* Category 3: Operations & Customer Focus */}
              <div className="bg-slate-900/80 border border-sky-500/30 rounded-2xl p-3 flex flex-col items-center text-center shadow-lg">
                <span className="text-xs font-extrabold text-sky-300 font-th mb-2">
                  Operations & Customer Focus
                </span>
                <div className="flex items-center gap-2">
                  {[5].map(num => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-full bg-sky-500 text-white font-black text-sm flex items-center justify-center shadow-md border border-sky-300"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              {/* Category 4: Review & Improvement */}
              <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-3 flex flex-col items-center text-center shadow-lg">
                <span className="text-xs font-extrabold text-emerald-300 font-th mb-2">
                  Review & Improvement
                </span>
                <div className="flex items-center gap-2">
                  {[6, 7, 8].map(num => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md border border-emerald-300"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            {/* Legend Section (Bottom Right matching image) */}
            <div className="flex flex-wrap items-center justify-end gap-3 text-[11px] font-th font-bold text-slate-300 pt-2">
              <div className="flex items-center gap-1.5 bg-purple-500/20 border border-purple-400/30 px-3 py-1 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                <span>แผนอนาคต</span>
              </div>
              <div className="flex items-center gap-1.5 bg-sky-500/20 border border-sky-400/30 px-3 py-1 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-sky-400"></div>
                <span>แผนงานปัจจุบัน</span>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 px-3 py-1 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <span>Junior Staff</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                <span>Senior Staff</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* MODAL 1: Select Employee Modal */}
      {selectingEmpForNodeId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-th font-extrabold text-base text-white flex items-center gap-2">
                <i className="fa-solid fa-user-check text-sky-400"></i>
                <span>เลือกพนักงานที่จะนำมาวางในผัง</span>
              </h3>
              <button
                onClick={() => setSelectingEmpForNodeId(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, ชื่อเล่น, รหัสพนักงาน..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-th"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {employees
                .filter(e => 
                  e.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
                  e.nickname.toLowerCase().includes(empSearch.toLowerCase()) ||
                  e.username.toLowerCase().includes(empSearch.toLowerCase())
                )
                .map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => handleSelectEmployee(selectingEmpForNodeId, emp)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 hover:bg-sky-600/20 border border-slate-700/60 hover:border-sky-500/50 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.img}
                        alt={emp.nickname}
                        className="w-10 h-10 rounded-xl object-cover border border-white/20 bg-slate-700"
                        onError={e => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.fullName)}`;
                        }}
                      />
                      <div>
                        <div className="font-th font-bold text-sm text-white group-hover:text-sky-300">
                          {emp.fullName} ({emp.nickname})
                        </div>
                        <div className="text-[11px] text-slate-400">
                          รหัส: {emp.username} • {emp.club}
                        </div>
                      </div>
                    </div>
                    <button className="px-3 py-1 rounded-xl text-xs font-bold bg-sky-500 text-slate-950 opacity-0 group-hover:opacity-100 transition-opacity">
                      เลือกวาง
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Node Modal */}
      {editingNode && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-th font-extrabold text-base text-white flex items-center gap-2">
                <i className="fa-solid fa-sliders text-amber-400"></i>
                <span>แก้ไขรายละเอียดโหนดพนักงาน</span>
              </h3>
              <button
                onClick={() => setEditingNode(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-5 space-y-4 font-th">
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">ชื่อ - นามสกุล</label>
                <input
                  type="text"
                  value={editingNode.fullName}
                  onChange={e => setEditingNode({ ...editingNode, fullName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">ชื่อเล่น</label>
                <input
                  type="text"
                  value={editingNode.nickname || ''}
                  onChange={e => setEditingNode({ ...editingNode, nickname: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">ระดับตำแหน่ง (Badge Level)</label>
                <select
                  value={editingNode.badgeLevel || 'Staff'}
                  onChange={e => setEditingNode({ ...editingNode, badgeLevel: e.target.value as OrgBadgeLevel })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Manager">Manager</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Senior Staff">Senior Staff</option>
                  <option value="Junior Staff">Junior Staff</option>
                  <option value="Staff">Staff / ทั่วไป</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">สังกัดสายงาน (Branch)</label>
                <select
                  value={editingNode.branchId}
                  onChange={e => setEditingNode({ ...editingNode, branchId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="manager">ผู้จัดการ (Manager)</option>
                  <option value="supervisor">ซูเปอร์ไวเซอร์ (Supervisor)</option>
                  <option value="ucc">Team UCC (ฝั่งซ้าย)</option>
                  <option value="center">ส่วนกลาง / คลังสินค้า (ตรงกลาง)</option>
                  <option value="uqc">Team UQC (ฝั่งขวา)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">ระบบงานประเมินประจำโหนด (1-10)</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sysNum => {
                    const active = editingNode.systems?.includes(sysNum);
                    return (
                      <button
                        key={sysNum}
                        type="button"
                        onClick={() => {
                          const currentSys = editingNode.systems || [];
                          const updated = active
                            ? currentSys.filter(s => s !== sysNum)
                            : [...currentSys, sysNum];
                          setEditingNode({ ...editingNode, systems: updated });
                        }}
                        className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                          active
                            ? 'bg-emerald-500 text-slate-950 font-extrabold ring-2 ring-emerald-300'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                      >
                        {sysNum}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingNode(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 font-th"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEditedNode}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-sky-500 text-slate-950 hover:bg-sky-400 font-th shadow-lg shadow-sky-500/20"
              >
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
