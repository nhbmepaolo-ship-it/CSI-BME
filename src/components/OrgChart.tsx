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
  const [zoomScale, setZoomScale] = useState<number>(100);

  const chartRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-calculate zoom scale to fit preview nicely on screen
  const handleFitToScreen = () => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth - 32;
      if (containerWidth > 0) {
        // Calculate fit scale for 1400px chart width
        const calculatedScale = Math.min(100, Math.max(40, Math.floor((containerWidth / 1400) * 100)));
        setZoomScale(calculatedScale);
      }
    }
  };

  useEffect(() => {
    handleFitToScreen();
    window.addEventListener('resize', handleFitToScreen);
    return () => window.removeEventListener('resize', handleFitToScreen);
  }, []);

  useEffect(() => {
    // Load active employees from StorageService
    const allEmps = StorageService.getEmployees().filter(e => e.status === 'active');
    setEmployees(allEmps);
  }, []);

  // Verified master photos lookup for BME employees to ensure 100% reliable image loading
  const getVerifiedBmePhoto = (fullName: string, nickname?: string, currentPhoto?: string): string => {
    const clean = (s?: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const f = clean(fullName);
    const n = clean(nickname);

    if (f.includes('chalee') || f.includes('ชาลี') || n === 'ปิ้ง') {
      return 'https://img2.pic.in.th/S__6471704_0-removebg-preview.png';
    }
    if (f.includes('raschanee') || f.includes('รัชณี') || n === 'มิน') {
      return 'https://img1.pic.in.th/images/970d1e089ad78d07db702e1eab5698c6.png';
    }
    if (f.includes('supattra') || f.includes('สุพัตรา') || n === 'เปี้ยว') {
      return 'https://img2.pic.in.th/BME_563770..045756.png';
    }
    if (f.includes('suwapa') || f.includes('สุวาภา') || n === 'อ้อ') {
      return 'https://img2.pic.in.th/BME_612366..045835.png';
    }
    if (f.includes('aiyaret') || f.includes('ไอยเรศ') || n === 'เป๊ก') {
      return 'https://img2.pic.in.th/BME_603892..045611.png';
    }
    if (f.includes('suphawat') || f.includes('ศุภวัฒน์') || n === 'ลูกตาล' || n === 'ลูกตอล') {
      return 'https://img2.pic.in.th/BME_606675..045820.png';
    }
    if (f.includes('kanthida') || f.includes('กานต์ธิดา') || n === 'แฮม') {
      return 'https://img1.pic.in.th/images/5fb2f77d94121bd37.png';
    }
    if (f.includes('pannapat') || f.includes('พรรณพัชร') || n === 'อ้อน' || n === 'อ้น') {
      return 'https://img2.pic.in.th/4447b7344aeba4742.png';
    }
    if (f.includes('jatasig') || f.includes('จตสิกข์') || n === 'เอิ๊ก') {
      return 'https://img1.pic.in.th/images/625192.png';
    }
    if (f.includes('nattaporn') || f.includes('ณฐพร') || n === 'ณฐ') {
      return 'https://img1.pic.in.th/images/BME_563779..045629.png';
    }
    if (f.includes('thaweewat') || f.includes('ทวีวัฒน์') || n === 'ซัน') {
      return 'https://img1.pic.in.th/images/BME_614669..045936.png';
    }
    if (f.includes('titima') || f.includes('ฐิติมา') || n === 'จิ๊บ') {
      return 'https://img1.pic.in.th/images/BME_616475..050052.png';
    }
    if (f.includes('pinmanee') || f.includes('ปิ่นมณี') || n === 'ปิ่น') {
      return 'https://img2.pic.in.th/3dd5cdfa08338f7c4.png';
    }
    if (f.includes('salisa') || f.includes('ศลิษา') || n === 'ษา') {
      return 'https://img1.pic.in.th/images/6596ac2053383a160.png';
    }
    if (f.includes('naruemol') || f.includes('นฤมล')) {
      return 'https://api.dicebear.com/7.x/avataaars/svg?seed=Naruemol';
    }

    if (currentPhoto) {
      return currentPhoto
        .replace('https://img2.pic.in.th/images/BME_563770..045756.png', 'https://img2.pic.in.th/BME_563770..045756.png')
        .replace('https://img1.pic.in.th/images/BME_603892..045611.png', 'https://img2.pic.in.th/BME_603892..045611.png')
        .replace('https://img2.pic.in.th/images/BME_563779..045629.png', 'https://img1.pic.in.th/images/BME_563779..045629.png')
        .replace('https://img2.pic.in.th/images/BME_606675..045820.png', 'https://img2.pic.in.th/BME_606675..045820.png')
        .replace('https://img2.pic.in.th/images/BME_612366..045835.png', 'https://img2.pic.in.th/BME_612366..045835.png')
        .replace('https://img2.pic.in.th/S__6471705_0-removebg-preview.png', 'https://img1.pic.in.th/images/970d1e089ad78d07db702e1eab5698c6.png');
    }

    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;
  };

  const getProxiedImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.includes('/api/image-proxy')) return url;
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

  // Helper to convert images in canvas to data URLs reliably
  const prepareChartImagesForExport = async (container: HTMLElement) => {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgs.map(async (img) => {
        try {
          if (img.src && img.src.startsWith('data:')) return;

          const currentSrc = img.currentSrc || img.src;
          if (!currentSrc) return;

          // 1. If image is already fully loaded in DOM, try direct canvas draw
          if (img.complete && img.naturalWidth > 0) {
            try {
              const cvs = document.createElement('canvas');
              cvs.width = img.naturalWidth;
              cvs.height = img.naturalHeight;
              const ctx = cvs.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const dataUrl = cvs.toDataURL('image/png');
                if (dataUrl && dataUrl.length > 200) {
                  img.src = dataUrl;
                  return;
                }
              }
            } catch {
              // Canvas draw might fail if cross-origin tainted, proceed to fetch
            }
          }

          // 2. Fetch via proxy or directly
          let rawUrl = currentSrc;
          if (currentSrc.includes('/api/image-proxy?url=')) {
            try {
              const u = new URL(currentSrc, window.location.origin);
              rawUrl = u.searchParams.get('url') || currentSrc;
            } catch {
              rawUrl = currentSrc;
            }
          }

          const urlsToTry = [
            getProxiedImageUrl(rawUrl),
            rawUrl,
            currentSrc
          ];

          let blob: Blob | null = null;
          for (const u of urlsToTry) {
            try {
              const res = await fetch(u, { mode: 'cors' });
              if (res && res.ok) {
                blob = await res.blob();
                if (blob && blob.size > 0) break;
              }
            } catch {
              // try next
            }
          }

          if (blob) {
            await new Promise<void>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (reader.result && typeof reader.result === 'string') {
                  img.src = reader.result;
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

  // Asks the browser itself to resolve a single modern color expression
  // (oklab(), oklch(), color-mix(), etc.) down to a plain rgb()/rgba() string
  // that html2canvas's own CSS parser can understand.
  const resolveColorToken = (token: string): string => {
    try {
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d');
      if (ctx) {
        // Use an very-unlikely-to-occur sentinel color as the baseline, then read
        // back how the browser itself normalizes that exact string. If assigning
        // `token` afterwards leaves fillStyle unchanged (identical to that
        // baseline), the browser silently REJECTED `token` as unparsable (e.g. a
        // color-mix() referencing a CSS custom property that has no meaning in an
        // isolated canvas context) — not resolved it to black. Treating that
        // silent rejection as "resolved to black" was the bug that made every
        // failed-to-parse gradient/blob render as a solid opaque black shape in
        // the exported PNG instead of just fading out.
        const SENTINEL = 'rgba(1, 2, 3, 0.012)';
        ctx.fillStyle = SENTINEL;
        const baseline = ctx.fillStyle;
        ctx.fillStyle = token;
        const resolved = ctx.fillStyle;
        if (resolved && resolved !== baseline && !resolved.includes('oklab') && !resolved.includes('oklch') && !resolved.includes('color-mix')) {
          return resolved;
        }
      }
    } catch {
      // ignore, fall through to transparent fallback below
    }
    return 'rgba(0,0,0,0)';
  };

  // Finds every oklab()/oklch()/color-mix() expression in a chunk of CSS text
  // (including one level of nesting, e.g. color-mix(in oklab, oklch(...) 20%, transparent))
  // and replaces each with its browser-resolved plain rgb/rgba equivalent.
  const sanitizeCssText = (text: string): string => {
    if (!text || (!text.includes('oklab') && !text.includes('oklch') && !text.includes('color-mix'))) {
      return text;
    }
    let result = text;
    for (let pass = 0; pass < 3 && (result.includes('oklab') || result.includes('oklch') || result.includes('color-mix')); pass++) {
      result = result.replace(/(?:oklab|oklch|color-mix)\((?:[^()]|\([^()]*\))*\)/g, match => resolveColorToken(match));
    }
    return result;
  };

  const sanitizeStyleRuleList = (rules: CSSRuleList) => {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i] as CSSRule & { style?: CSSStyleDeclaration; cssRules?: CSSRuleList };
      try {
        if (rule.style && rule.style.cssText && /oklab|oklch|color-mix/.test(rule.style.cssText)) {
          rule.style.cssText = sanitizeCssText(rule.style.cssText);
        }
      } catch {
        // some rule types don't support cssText reassignment — skip them
      }
      try {
        if (rule.cssRules && rule.cssRules.length) {
          sanitizeStyleRuleList(rule.cssRules);
        }
      } catch {
        // ignore
      }
    }
  };

  // The exported build serves its Tailwind CSS as an external stylesheet
  // (<link rel="stylesheet">), not an inline <style> tag, so text-only sanitizing
  // of <style> elements never actually reaches it. This walks every stylesheet
  // attached to the cloned document (same-origin ones — cross-origin stylesheets
  // like Google Fonts / Font Awesome are skipped automatically since they never
  // contain oklab/oklch/color-mix anyway) and neutralizes it directly via the CSSOM,
  // which is what actually prevents html2canvas's "unsupported color function" crash.
  const sanitizeAllStylesheets = (doc: Document) => {
    Array.from(doc.styleSheets).forEach(sheet => {
      let rules: CSSRuleList | null = null;
      try {
        rules = (sheet as CSSStyleSheet).cssRules;
      } catch {
        return; // cross-origin stylesheet, inaccessible — safe to skip
      }
      if (!rules) return;
      try {
        sanitizeStyleRuleList(rules);
      } catch {
        // ignore, other stylesheets still get processed
      }
    });
  };

  // Capture canvas logic with exact visual preview match
  const captureOrgChartCanvas = async (element: HTMLElement) => {
    await prepareChartImagesForExport(element);

    const targetWidth = 1500;

    return await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#eaf4fb',
      logging: false,
      windowWidth: 1600,
      windowHeight: 1200,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        // Neutralize oklab/oklch/color-mix directly in every stylesheet (inline
        // <style> AND linked <link> files) via the CSSOM so html2canvas's CSS
        // parser never crashes on them — this is the fix for the "Attempting to
        // parse an unsupported color function 'oklab'" export error. (The old
        // text-only <style>-tag / inline-attribute replace never touched the
        // production build's external CSS file, so it never actually worked.)
        sanitizeAllStylesheets(clonedDoc);

        const clonedEl = clonedDoc.getElementById('org-chart-print-area') as HTMLElement;
        if (!clonedEl) return;

        // Hide edit buttons and interactive popups in export
        const buttons = clonedDoc.querySelectorAll('button');
        buttons.forEach(btn => {
          (btn as HTMLElement).style.display = 'none';
        });

        // Set exact poster width and layout
        clonedEl.style.width = `${targetWidth}px`;
        clonedEl.style.minWidth = `${targetWidth}px`;
        clonedEl.style.maxWidth = `${targetWidth}px`;
        clonedEl.style.height = 'auto';
        clonedEl.style.minHeight = 'auto';
        clonedEl.style.maxHeight = 'none';
        clonedEl.style.overflow = 'visible';
        clonedEl.style.position = 'relative';
        clonedEl.style.transform = 'none';
        clonedEl.style.margin = '0 auto';
        clonedEl.style.padding = '32px';
        clonedEl.style.boxSizing = 'border-box';
        clonedEl.style.background = 'linear-gradient(135deg, #eaf4fb 0%, #f4fafe 50%, #d6ebf7 100%)';
        clonedEl.style.backgroundColor = '#eaf4fb';
        clonedEl.style.color = '#0f2942';

        // Unwrap overflow parent containers
        let parent = clonedEl.parentElement;
        while (parent && parent !== clonedDoc.body) {
          parent.style.overflow = 'visible';
          parent.style.height = 'auto';
          parent.style.minHeight = 'auto';
          parent.style.maxHeight = 'none';
          parent.style.display = 'block';
          parent = parent.parentElement;
        }

        clonedDoc.body.style.overflow = 'visible';
        clonedDoc.body.style.height = 'auto';
        clonedDoc.body.style.backgroundColor = '#eaf4fb';
      }
    });
  };

  // PDF Export Handler using html2canvas & jsPDF
  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);

    try {
      if (showToast) showToast('success', 'กำลังสร้างไฟล์ PDF ผังองค์กร BME PTP ความละเอียดสูง...');

      const canvas = await captureOrgChartCanvas(chartRef.current);
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 210mm
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Fit landscape image perfectly on A4 page with 5mm margins
      const ratio = Math.min((pdfWidth - 10) / imgWidth, (pdfHeight - 10) / imgHeight);
      const renderW = imgWidth * ratio;
      const renderH = imgHeight * ratio;

      const xOffset = (pdfWidth - renderW) / 2;
      const yOffset = (pdfHeight - renderH) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderW, renderH);
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
      if (showToast) showToast('success', 'กำลังแปลงรูปภาพ PNG ความละเอียดสูง...');

      const canvas = await captureOrgChartCanvas(chartRef.current);

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
    // Dynamic matching with active Employees list to ensure latest photo from Google Sheet
    const matchedEmp = employees.find(e => {
      if (node.employeeId && (e.id === node.employeeId || e.username === node.employeeId)) return true;
      const cleanName = (s: string) => (s || '').replace(/\s+/g, ' ').toLowerCase().trim();
      const nodeF = cleanName(node.fullName);
      const empF = cleanName(e.fullName);
      if (nodeF && empF && (nodeF.includes(empF) || empF.includes(nodeF))) return true;
      const nodeN = cleanName(node.nickname || '');
      const empN = cleanName(e.nickname || '');
      if (nodeN && empN && nodeN === empN) return true;
      return false;
    });

    const nodePhoto = getVerifiedBmePhoto(node.fullName, node.nickname, node.photoUrl);
    const rawPhoto = (matchedEmp?.img && matchedEmp.img.trim().length > 5 && !matchedEmp.img.includes('images.unsplash')) 
      ? getVerifiedBmePhoto(matchedEmp.fullName, matchedEmp.nickname, matchedEmp.img)
      : nodePhoto;

    const displayPhoto = getProxiedImageUrl(rawPhoto);

    const badgeBgColor = 
      node.badgeLevel === 'Manager' || node.badgeLevel === 'Supervisor' || node.badgeLevel === 'Senior Staff' ? '#00c853' :
      node.badgeLevel === 'Junior Staff' ? '#ff9800' : '#0288d1';

    const badgeTextColor = node.badgeLevel === 'Junior Staff' ? '#0f172a' : '#ffffff';

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
          
          {/* Avatar Container Circle */}
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden shadow-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: '#f8fafc',
              borderColor: isTopLevel ? '#0288d1' : badgeBgColor,
              borderWidth: '3px',
              borderStyle: 'solid'
            }}
          >
            <img
              src={displayPhoto}
              alt={node.fullName}
              crossOrigin="anonymous"
              className="w-full h-full object-cover object-center"
              onError={e => {
                const img = e.currentTarget;
                if (rawPhoto && !img.dataset.retried) {
                  img.dataset.retried = 'true';
                  img.src = rawPhoto;
                } else {
                  img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(node.fullName)}`;
                }
              }}
            />
          </div>

          {/* Badge Level Pill - Perfectly spaced below avatar without any overlap */}
          {node.badgeLevel && (
            <div
              className="mt-1.5 z-10 px-3.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center justify-center text-center whitespace-nowrap min-w-[94px] shrink-0"
              style={{
                backgroundColor: badgeBgColor,
                color: badgeTextColor,
                borderColor: '#ffffff',
                borderWidth: '2px',
                borderStyle: 'solid'
              }}
            >
              <span className="block text-center leading-none w-full py-0.5" style={{ color: badgeTextColor }}>
                {node.badgeLevel}
              </span>
            </div>
          )}

          {/* Name Plate Box matching image dark blue styling */}
          <div
            className="mt-1.5 rounded-xl px-3.5 py-1.5 shadow-md flex flex-col items-center justify-center text-center min-w-[155px] max-w-[210px] transition-colors"
            style={{
              backgroundColor: '#0c2f5e',
              borderColor: '#184c8a',
              borderWidth: '1px',
              borderStyle: 'solid',
              color: '#ffffff'
            }}
          >
            <span className="font-th font-extrabold text-xs md:text-sm leading-tight break-words text-center w-full" style={{ color: '#ffffff' }}>
              {node.fullName}
            </span>
            {node.nickname && (
              <span className="text-[10px] md:text-[11px] font-bold leading-tight text-center mt-0.5" style={{ color: '#bae6fd' }}>
                ({node.nickname})
              </span>
            )}
            
            {/* System Badges attached (e.g. ระบบ 2, ระบบ 5, ระบบ 6, ระบบ 7) */}
            {node.systems && node.systems.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-1">
                {node.systems.map(sys => {
                  const sysBg = sys === 2 ? '#ffca28' : sys === 5 ? '#0d47a1' : '#2e7d32';
                  const sysColor = sys === 2 ? '#0f172a' : '#ffffff';
                  const sysBorder = sys === 2 ? '#fde047' : sys === 5 ? '#60a5fa' : '#86efac';

                  return (
                    <span
                      key={sys}
                      className="w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center shadow"
                      style={{
                        backgroundColor: sysBg,
                        color: sysColor,
                        borderColor: sysBorder,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}
                      title={`ระบบ ${sys}`}
                    >
                      {sys}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tags & Role Badges (HIGH CONTRAST & ULTRA READABLE) */}
          <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
            {node.tags && node.tags.map(tag => {
              const tagBg = tag.color === 'purple' ? '#7e22ce' : tag.color === 'orange' || tag.color === 'amber' ? '#fbbf24' : tag.color === 'cyan' ? '#14b8a6' : '#0288d1';
              const tagColor = tag.color === 'orange' || tag.color === 'amber' ? '#0f172a' : '#ffffff';
              const tagBorder = tag.color === 'purple' ? '#e9d5ff' : tag.color === 'orange' || tag.color === 'amber' ? '#fef08a' : tag.color === 'cyan' ? '#99f6e4' : '#bae6fd';

              return (
                <span
                  key={tag.id}
                  className="text-[11px] font-black px-2.5 py-0.5 rounded-md shadow-sm whitespace-nowrap leading-tight"
                  style={{
                    backgroundColor: tagBg,
                    color: tagColor,
                    borderColor: tagBorder,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
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
              <span>โหมดดูอย่างเดียว (ปรับแก้ผังเฉพาะ คุณปิ๊ง, คุณมิน, คุณเปี้ยว 563770)</span>
            </div>
          )}

          {/* Zoom & Fit Controls */}
          <div className="flex items-center bg-slate-800/90 border border-white/10 rounded-xl p-1 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setZoomScale(s => Math.max(40, s - 10))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="ย่อผัง (-)"
            >
              <i className="fa-solid fa-minus"></i>
            </button>
            <span className="px-2 font-mono font-bold text-sky-300 min-w-[45px] text-center text-[11px]">
              {zoomScale}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale(s => Math.min(150, s + 10))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="ขยายผัง (+)"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
            <button
              type="button"
              onClick={handleFitToScreen}
              className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-[11px] font-bold text-sky-300 hover:text-white transition-colors border border-sky-400/30 flex items-center gap-1"
              title="ปรับขนาดการแสดงผลให้พอดีหน้าจอ"
            >
              <i className="fa-solid fa-expand text-[10px]"></i>
              <span>พอดีหน้าจอ</span>
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(100)}
              className="px-2 py-1 rounded-lg hover:bg-slate-700 text-[10px] font-bold text-slate-400 hover:text-white transition-colors border border-white/5"
              title="รีเซ็ตเป็น 100%"
            >
              100%
            </button>
          </div>

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

      {/* Main Org Chart Visual Canvas (Designed with Modern Luxury Graphic Background) */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto pb-8 flex justify-center w-full min-h-[600px]">
        <div
          ref={chartRef}
          id="org-chart-print-area"
          style={{ transform: `scale(${zoomScale / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-out' }}
          className="w-[1400px] min-w-[1400px] bg-gradient-to-br from-[#e4f2fb] via-[#f2f8fd] to-[#cfebf9] border-2 border-sky-300/90 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden font-sans text-slate-800 my-2 h-fit"
        >
          
          {/* Modern Luxury Blueprint Graphic Grid Pattern Overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.15]"
            style={{
              backgroundImage: `
                radial-gradient(#0077b6 1.3px, transparent 1.3px),
                linear-gradient(to right, #0077b6 1px, transparent 1px),
                linear-gradient(to bottom, #0077b6 1px, transparent 1px)
              `,
              backgroundSize: `24px 24px, 72px 72px, 72px 72px`
            }}
          ></div>

          {/* High-End Ambient Glowing Blobs & Tech Line Accents */}
          <div className="absolute -top-20 -right-20 w-[450px] h-[450px] bg-sky-400/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -left-20 w-[450px] h-[450px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] bg-cyan-300/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="absolute top-5 left-5 w-10 h-10 border-t-2 border-l-2 border-sky-500/40 pointer-events-none"></div>
          <div className="absolute top-5 right-5 w-10 h-10 border-t-2 border-r-2 border-sky-500/40 pointer-events-none"></div>
          <div className="absolute bottom-5 left-5 w-10 h-10 border-b-2 border-l-2 border-sky-500/40 pointer-events-none"></div>
          <div className="absolute bottom-5 right-5 w-10 h-10 border-b-2 border-r-2 border-sky-500/40 pointer-events-none"></div>

          {/* Top Header Banner with Official BME Logo */}
          <div
            className="flex items-center justify-between border-b-2 pb-6 mb-8 relative z-10 p-4 rounded-2xl shadow-sm"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderColor: '#7dd3fc',
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-center gap-4">
              {/* Official BME Logo Container */}
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border-2 border-sky-300 shadow-md p-1.5 flex items-center justify-center overflow-hidden">
                <img
                  src={getProxiedImageUrl('https://img2.pic.in.th/logo-BME.png')}
                  alt="BME Logo"
                  className="w-full h-full object-contain"
                  onError={e => {
                    const img = e.currentTarget;
                    if (!img.dataset.retried) {
                      img.dataset.retried = 'true';
                      img.src = 'https://img2.pic.in.th/logo-BME.png';
                    } else if (img.parentElement) {
                      img.parentElement.innerHTML = '<div className="flex flex-col items-center justify-center text-[#0288d1] font-black text-xs leading-none"><span>BME</span><span className="text-[9px] text-slate-500 font-bold">PTP</span></div>';
                    }
                  }}
                />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black font-th tracking-tight" style={{ color: '#0c2f5e' }}>
                  BIOMEDICAL ENGINEERING
                </h1>
                <p className="text-xs md:text-sm font-extrabold tracking-widest uppercase mt-0.5" style={{ color: '#0083a8' }}>
                  Medical Device Management & Services
                </p>
              </div>
            </div>

            {/* Right Banner Badge matching BME10PTP.png */}
            <div
              className="text-white px-7 py-3 rounded-2xl shadow-xl text-right"
              style={{
                background: 'linear-gradient(90deg, #009beb 0%, #1162b7 100%)',
                backgroundColor: '#009beb',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              <h2 className="text-xl md:text-2xl font-black font-th tracking-wide" style={{ color: '#ffffff' }}>
                Organizational Chart
              </h2>
              <div className="text-sm font-bold font-th" style={{ color: '#e0f2fe' }}>
                BME PTP
              </div>
            </div>
          </div>

          {/* Org Tree Structure with Ultra-Sleek Thin Connectors & Vector Arrowheads */}
          <div className="flex flex-col items-center relative z-10">

            {/* LEVEL 1: Manager */}
            {managerNode && (
              <div className="flex flex-col items-center relative">
                {renderNodeCard(managerNode, true)}
                
                {/* Sleek Thin Downward Arrow to Supervisor */}
                <div className="flex flex-col items-center my-1">
                  <div className="w-[1.5px] h-6" style={{ backgroundColor: '#0288d1', width: '2px' }}></div>
                  <svg className="w-3.5 h-3.5 -mt-1.5" style={{ color: '#0288d1', fill: '#0288d1' }} viewBox="0 0 16 16">
                    <path d="M8 14L2 6h12L8 14z" fill="#0288d1" />
                  </svg>
                </div>
              </div>
            )}

            {/* LEVEL 2: Supervisor */}
            {supervisorNode && (
              <div className="flex flex-col items-center relative">
                {renderNodeCard(supervisorNode, true)}
                
                {/* Sleek Thin Downward Arrow to Branch Horizontal Bar */}
                <div className="flex flex-col items-center my-1">
                  <div className="w-[1.5px] h-6" style={{ backgroundColor: '#0288d1', width: '2px' }}></div>
                  <svg className="w-3.5 h-3.5 -mt-1.5" style={{ color: '#0288d1', fill: '#0288d1' }} viewBox="0 0 16 16">
                    <path d="M8 14L2 6h12L8 14z" fill="#0288d1" />
                  </svg>
                </div>
              </div>
            )}

            {/* Horizontal Branch Connector Bar with 3 Thin Downward Arrows */}
            <div className="w-[88%] h-[2px] relative mb-7 mt-1" style={{ backgroundColor: '#0288d1' }}>
              {/* Left Branch Arrow (Team UCC) */}
              <div className="absolute top-0 left-0 -translate-x-1/2 flex flex-col items-center">
                <div className="w-2 h-2 rounded-full -mt-1" style={{ backgroundColor: '#0288d1' }}></div>
                <div className="w-[1.5px] h-5" style={{ backgroundColor: '#0288d1', width: '2px' }}></div>
                <svg className="w-3.5 h-3.5 -mt-1.5" style={{ color: '#0288d1', fill: '#0288d1' }} viewBox="0 0 16 16">
                  <path d="M8 14L2 6h12L8 14z" fill="#0288d1" />
                </svg>
              </div>

              {/* Center Branch Arrow (ส่วนกลาง) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className="w-2 h-2 rounded-full -mt-1" style={{ backgroundColor: '#0288d1' }}></div>
                <div className="w-[1.5px] h-5" style={{ backgroundColor: '#0288d1', width: '2px' }}></div>
                <svg className="w-3.5 h-3.5 -mt-1.5" style={{ color: '#0288d1', fill: '#0288d1' }} viewBox="0 0 16 16">
                  <path d="M8 14L2 6h12L8 14z" fill="#0288d1" />
                </svg>
              </div>

              {/* Right Branch Arrow (Team UQC) */}
              <div className="absolute top-0 right-0 translate-x-1/2 flex flex-col items-center">
                <div className="w-2 h-2 rounded-full -mt-1" style={{ backgroundColor: '#0288d1' }}></div>
                <div className="w-[1.5px] h-5" style={{ backgroundColor: '#0288d1', width: '2px' }}></div>
                <svg className="w-3.5 h-3.5 -mt-1.5" style={{ color: '#0288d1', fill: '#0288d1' }} viewBox="0 0 16 16">
                  <path d="M8 14L2 6h12L8 14z" fill="#0288d1" />
                </svg>
              </div>
            </div>

            {/* LEVEL 3: 3 Main Branches (UCC, Center, UQC) */}
            <div className="grid grid-cols-3 gap-6 w-full pt-1">

              {/* BRANCH 1: Team UCC (Left) */}
              <div
                onDragOver={e => handleDragOver(e, 'ucc')}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, 'ucc')}
                className="flex flex-col items-center rounded-2xl p-4 transition-all shadow-md"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: dragOverBranch === 'ucc' ? '#0288d1' : '#bae6fd',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                {/* Branch Header Badge */}
                <div
                  className="px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-5 shadow-md flex items-center gap-2"
                  style={{ backgroundColor: '#0288d1', color: '#ffffff' }}
                >
                  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <span>Team UCC</span>
                </div>

                <div className="flex flex-col items-center gap-2 w-full">
                  {uccNodes.map((node, idx) => (
                    <React.Fragment key={node.id}>
                      {idx > 0 && (
                        <div className="flex flex-col items-center my-0.5">
                          <div className="w-[1.5px] h-3 bg-[#0288d1]/70"></div>
                          <svg className="w-3 h-3 text-[#0288d1]/80 -mt-1" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 14L2 6h12L8 14z" />
                          </svg>
                        </div>
                      )}
                      {renderNodeCard(node)}
                    </React.Fragment>
                  ))}
                </div>

                {isEditing && (
                  <button
                    onClick={() => handleAddNodeToBranch('ucc')}
                    className="mt-6 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-300 transition-colors flex items-center gap-1.5"
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
                className="flex flex-col items-center rounded-2xl p-4 transition-all shadow-md"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: dragOverBranch === 'center' ? '#0097a7' : '#bae6fd',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <div
                  className="px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-5 shadow-md flex items-center gap-2"
                  style={{ backgroundColor: '#0097a7', color: '#ffffff' }}
                >
                  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                  </svg>
                  <span>ส่วนกลาง & สินคลัง</span>
                </div>

                <div className="flex flex-col items-center gap-2 w-full">
                  {centerNodes.map((node, idx) => (
                    <React.Fragment key={node.id}>
                      {idx > 0 && (
                        <div className="flex flex-col items-center my-0.5">
                          <div className="w-[1.5px] h-3" style={{ backgroundColor: '#0288d1', width: '2px' }}></div>
                          <svg className="w-3 h-3 -mt-1" style={{ color: '#0288d1', fill: '#0288d1' }} viewBox="0 0 16 16">
                            <path d="M8 14L2 6h12L8 14z" fill="#0288d1" />
                          </svg>
                        </div>
                      )}
                      {renderNodeCard(node)}
                    </React.Fragment>
                  ))}
                </div>

                {isEditing && (
                  <button
                    onClick={() => handleAddNodeToBranch('center')}
                    className="mt-6 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300 transition-colors flex items-center gap-1.5"
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
                className="flex flex-col items-center rounded-2xl p-4 transition-all shadow-md"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: dragOverBranch === 'uqc' ? '#0288d1' : '#bae6fd',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <div
                  className="px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-5 shadow-md flex items-center gap-2"
                  style={{ backgroundColor: '#0288d1', color: '#ffffff' }}
                >
                  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                  </svg>
                  <span>Team UQC</span>
                </div>

                <div className="flex flex-col items-center gap-2 w-full">
                  {uqcNodes.map((node, idx) => (
                    <React.Fragment key={node.id}>
                      {idx > 0 && (
                        <div className="flex flex-col items-center my-0.5">
                          <div className="w-[1.5px] h-3" style={{ backgroundColor: '#0288d1', width: '2px' }}></div>
                          <svg className="w-3 h-3 -mt-1" style={{ color: '#0288d1', fill: '#0288d1' }} viewBox="0 0 16 16">
                            <path d="M8 14L2 6h12L8 14z" fill="#0288d1" />
                          </svg>
                        </div>
                      )}
                      {renderNodeCard(node)}
                    </React.Fragment>
                  ))}
                </div>

                {isEditing && (
                  <button
                    onClick={() => handleAddNodeToBranch('uqc')}
                    className="mt-6 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border border-indigo-300 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i>
                    <span>เพิ่มคนใน Team UQC</span>
                  </button>
                )}
              </div>

            </div>

          </div>

          {/* BOTTOM SECTION: โครงสร้างการบริหารงาน 10 ระบบ (Matching BME10PTP.png) */}
          <div className="mt-12 pt-6 border-t-2 relative z-10" style={{ borderColor: '#7dd3fc' }}>
            
            {/* Systems Header Pill */}
            <div className="flex justify-center mb-6">
              <div
                className="font-th font-extrabold text-sm md:text-base px-8 py-2 rounded-full shadow-lg uppercase tracking-wide"
                style={{
                  background: 'linear-gradient(90deg, #0288d1 0%, #1565c0 50%, #0d47a1 100%)',
                  backgroundColor: '#0288d1',
                  color: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.6)',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                โครงสร้างการบริหารงาน 10 ระบบ
              </div>
            </div>

            {/* 4 Category Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              
              {/* Category 1: Leadership & Governance */}
              <div
                className="rounded-2xl p-3 flex flex-col items-center justify-between text-center shadow-md min-h-[90px]"
                style={{ backgroundColor: '#ffffff', borderColor: '#fcd34d', borderWidth: '1px', borderStyle: 'solid' }}
              >
                <span
                  className="text-xs font-extrabold px-3 py-1 rounded-full font-th mb-2 whitespace-nowrap"
                  style={{ backgroundColor: '#fb8c00', color: '#ffffff' }}
                >
                  Leadership & Governance
                </span>
                <div className="flex items-center gap-2 my-auto">
                  {[1, 2, 4].map(num => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shadow-md"
                      style={{ backgroundColor: '#ffca28', color: '#0f172a', borderColor: '#fcd34d', borderWidth: '1px', borderStyle: 'solid' }}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              {/* Category 2: Planning & Deployment */}
              <div
                className="rounded-2xl p-3 flex flex-col items-center justify-between text-center shadow-md min-h-[90px]"
                style={{ backgroundColor: '#ffffff', borderColor: '#fda4af', borderWidth: '1px', borderStyle: 'solid' }}
              >
                <span
                  className="text-xs font-extrabold px-3 py-1 rounded-full font-th mb-2 whitespace-nowrap"
                  style={{ backgroundColor: '#e53935', color: '#ffffff' }}
                >
                  Planning & Deployment
                </span>
                <div className="flex items-center gap-2 my-auto">
                  {[3, 9, 10].map(num => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shadow-md"
                      style={{ backgroundColor: '#e53935', color: '#ffffff', borderColor: '#fda4af', borderWidth: '1px', borderStyle: 'solid' }}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              {/* Category 3: Operations & Customer Focus */}
              <div
                className="rounded-2xl p-3 flex flex-col items-center justify-between text-center shadow-md min-h-[90px]"
                style={{ backgroundColor: '#ffffff', borderColor: '#7dd3fc', borderWidth: '1px', borderStyle: 'solid' }}
              >
                <span
                  className="text-xs font-extrabold px-3 py-1 rounded-full font-th mb-2 whitespace-nowrap"
                  style={{ backgroundColor: '#1e88e5', color: '#ffffff' }}
                >
                  Operations & Customer Focus
                </span>
                <div className="flex items-center gap-2 my-auto">
                  {[5].map(num => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shadow-md"
                      style={{ backgroundColor: '#0d47a1', color: '#ffffff', borderColor: '#7dd3fc', borderWidth: '1px', borderStyle: 'solid' }}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              {/* Category 4: Review & Improvement */}
              <div
                className="rounded-2xl p-3 flex flex-col items-center justify-between text-center shadow-md min-h-[90px]"
                style={{ backgroundColor: '#ffffff', borderColor: '#6ee7b7', borderWidth: '1px', borderStyle: 'solid' }}
              >
                <span
                  className="text-xs font-extrabold px-3 py-1 rounded-full font-th mb-2 whitespace-nowrap"
                  style={{ backgroundColor: '#43a047', color: '#ffffff' }}
                >
                  Review & Improvement
                </span>
                <div className="flex items-center gap-2 my-auto">
                  {[6, 7, 8].map(num => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-full font-black text-sm flex items-center justify-center shadow-md"
                      style={{ backgroundColor: '#2e7d32', color: '#ffffff', borderColor: '#6ee7b7', borderWidth: '1px', borderStyle: 'solid' }}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            {/* Legend Section (Bottom Right matching image) */}
            <div className="flex flex-wrap items-center justify-end gap-3 text-xs font-th font-bold text-slate-700 pt-2">
              <div className="flex items-center gap-1.5 bg-[#ab47bc] text-white px-3.5 py-1 rounded-full shadow-sm whitespace-nowrap">
                <div className="w-2.5 h-2.5 rounded-full bg-white shrink-0"></div>
                <span style={{ color: '#ffffff' }}>แผนอนาคต</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#29b6f6] text-white px-3.5 py-1 rounded-full shadow-sm whitespace-nowrap">
                <div className="w-2.5 h-2.5 rounded-full bg-white shrink-0"></div>
                <span style={{ color: '#ffffff' }}>แผนงานปัจจุบัน</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#ff9800] text-white px-3.5 py-1 rounded-full shadow-sm whitespace-nowrap">
                <div className="w-2.5 h-2.5 rounded-full bg-white shrink-0"></div>
                <span style={{ color: '#ffffff' }}>Junior Staff</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#00c853] text-white px-3.5 py-1 rounded-full shadow-sm whitespace-nowrap">
                <div className="w-2.5 h-2.5 rounded-full bg-white shrink-0"></div>
                <span style={{ color: '#ffffff' }}>Senior Staff</span>
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
