import { supabase } from './supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, HeadingLevel, TextRun, AlignmentType, BorderStyle, ShadingType } from 'docx';

import { getAttendanceSettings, setEmployeeShift as setSettingEmployeeShift } from './attendanceSettings';

export type ShiftTime = string;

export interface EmployeeAttendanceRow {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  shiftTime: ShiftTime;
  firstPunch: string | null; // e.g. "09:47:02"
  lastPunch: string | null;
  totalPunches: number;
  isLate: boolean;
  lateMinutes: number;
  graceMinutes: number; // Configurable grace period
  attendanceStatus: 'On Time' | 'Late Arrival' | 'Approved Leave' | 'Pending Leave' | 'Approved Permission' | 'Absent';
  leaveInfo?: {
    id: string;
    type: string;
    status: 'Approved' | 'Pending' | 'Rejected';
    startDate: string;
    endDate: string;
    duration: string;
    reason: string;
    appliedAt: string;
    isLateApplication: boolean;
    lateApplicationReason?: string;
  };
  permissionInfo?: {
    id: string;
    status: 'Approved' | 'Pending' | 'Rejected';
    date: string;
    fromTime: string;
    toTime: string;
    totalHours?: number;
    reason: string;
    appliedAt: string;
    isLateApplication: boolean;
    lateApplicationReason?: string;
  };
  lateApplicationTag?: string;
  // Configurable window repeated counts
  repeatLateCount: number;
  repeatLeaveCount: number;
  repeatPermissionCount: number;
  hasRepeatedIssue: boolean;
}

export interface AttendanceReportSummary {
  totalEmployees: number;
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  approvedLeaveCount: number;
  pendingLeaveCount: number;
  approvedPermissionCount: number;
  absentCount: number;
  lateApplicationsCount: number;
  repeatedIssuesCount: number;
}

export function getSavedShifts(): Record<string, ShiftTime> {
  const settings = getAttendanceSettings();
  return settings.employeeShifts || {};
}

export function saveEmployeeShift(empCode: string, shift: ShiftTime) {
  setSettingEmployeeShift(empCode, shift);
}

/**
 * Parses time string HH:mm:ss or HH:mm into minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function formatTime12h(timeStr: string | null): string {
  if (!timeStr) return '—';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Fetch payroll database logs and LMS leaves/permissions
 */
export async function fetchAttendanceReportData(dateStr: string): Promise<{
  rows: EmployeeAttendanceRow[];
  summary: AttendanceReportSummary;
}> {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const savedShifts = getSavedShifts();

  // 1. Fetch live attendance data from Payroll DB endpoint
  let payrollData: { employees: any[]; punches: any[]; history: any[] } = {
    employees: [],
    punches: [],
    history: [],
  };

  try {
    const res = await fetch(`/api/payroll-attendance?date=${targetDate}`);
    if (res.ok) {
      payrollData = await res.json();
    } else {
      console.warn('Payroll API error status:', res.status);
    }
  } catch (err) {
    console.warn('Could not reach payroll API endpoint, checking direct fallbacks:', err);
  }

  // 2. Fetch leaves from LMS Supabase
  let lmsLeaves: any[] = [];
  try {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      lmsLeaves = data;
    }
  } catch (err) {
    console.error('Failed to fetch LMS leaves:', err);
  }

  // 3. Fetch permissions from LMS Supabase
  let lmsPermissions: any[] = [];
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      lmsPermissions = data;
    }
  } catch (err) {
    console.error('Failed to fetch LMS permissions:', err);
  }

  // 4. Fetch LMS users to ensure we have full employee profiles even if payroll DB has missing records
  let lmsUsers: any[] = [];
  try {
    const { data } = await supabase.from('users').select('*');
    if (data) lmsUsers = data;
  } catch (err) {
    console.error('Failed to fetch LMS users:', err);
  }

  // Combine employees from payroll DB and LMS users
  const employeeMap = new Map<string, { code: string; name: string; department: string; designation: string }>();

  // From payroll DB
  for (const emp of payrollData.employees || []) {
    const code = emp.employee_code || emp.id;
    if (code) {
      employeeMap.set(code, {
        code,
        name: emp.name || code,
        department: emp.department || 'General',
        designation: emp.designation || '',
      });
    }
  }

  // Add any LMS users not in payroll DB
  for (const u of lmsUsers) {
    const code = u.user_id || u.username;
    if (code && !employeeMap.has(code) && code !== 'E0000') {
      employeeMap.set(code, {
        code,
        name: u.username || code,
        department: 'Operations',
        designation: u.role || 'Employee',
      });
    }
  }

  // Ensure employees who punched today are also in employeeMap
  for (const p of payrollData.punches || []) {
    if (p.emp_code && !employeeMap.has(p.emp_code)) {
      employeeMap.set(p.emp_code, {
        code: p.emp_code,
        name: p.emp_code,
        department: 'Operations',
        designation: 'Staff',
      });
    }
  }

  // Index today's punches by emp_code
  const punchesByCode = new Map<string, any>();
  for (const p of payrollData.punches || []) {
    punchesByCode.set(p.emp_code, p);
  }

  // Compute 30-day history metrics per employee
  // 1) Late count in past 30 days
  const historyPunchesByCode = new Map<string, any[]>();
  for (const h of payrollData.history || []) {
    const list = historyPunchesByCode.get(h.emp_code) || [];
    list.push(h);
    historyPunchesByCode.set(h.emp_code, list);
  }

  const settings = getAttendanceSettings();
  const windowDays = settings.reportingPeriodDays || 30;

  // 2) Rolling window leaves & permissions
  const historyWindowStart = new Date(new Date(targetDate).getTime() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const leaves30dByCode = new Map<string, number>();
  for (const l of lmsLeaves) {
    if (l.status === 'Approved' && l.start_date >= historyWindowStart && l.start_date <= targetDate) {
      const code = l.user_id || l.employee_code;
      leaves30dByCode.set(code, (leaves30dByCode.get(code) || 0) + 1);
    }
  }

  const perms30dByCode = new Map<string, number>();
  for (const p of lmsPermissions) {
    if (p.status === 'Approved' && p.permission_date >= historyWindowStart && p.permission_date <= targetDate) {
      const code = p.user_id || p.employee_code;
      perms30dByCode.set(code, (perms30dByCode.get(code) || 0) + 1);
    }
  }

  const rows: EmployeeAttendanceRow[] = [];

  for (const [code, emp] of Array.from(employeeMap.entries())) {
    // Determine shift: saved shift or default from settings
    const shiftTime: ShiftTime = settings.employeeShifts[code] || settings.defaultShift || '09:30';
    const shiftMinutes = timeToMinutes(shiftTime);
    const graceMinutes = settings.gracePeriodMinutes ?? 15;
    const graceExpiryMinutes = shiftMinutes + graceMinutes;

    const punch = punchesByCode.get(code);
    const firstPunch = punch?.first_punch_time || null;
    const lastPunch = punch?.last_punch_time || null;
    const totalPunches = punch?.total_punches ? Number(punch.total_punches) : 0;

    let isLate = false;
    let lateMinutes = 0;

    if (firstPunch) {
      const punchMins = timeToMinutes(firstPunch);
      if (punchMins > graceExpiryMinutes) {
        isLate = true;
        lateMinutes = punchMins - shiftMinutes;
      }
    }

    // Check Leave covering targetDate
    const matchingLeave = lmsLeaves.find((l) => {
      const userMatch = l.user_id === code || l.employee_code === code;
      const dateMatch = l.start_date <= targetDate && l.end_date >= targetDate;
      return userMatch && dateMatch;
    });

    // Check Permission on targetDate
    const matchingPerm = lmsPermissions.find((p) => {
      const userMatch = p.user_id === code || p.employee_code === code;
      const dateMatch = p.permission_date === targetDate;
      return userMatch && dateMatch;
    });

    // Determine late leave/permission application
    let leaveInfo: EmployeeAttendanceRow['leaveInfo'] = undefined;
    if (matchingLeave) {
      let isLateApp = false;
      let lateAppReason = '';
      if (matchingLeave.created_at) {
        const createdDate = matchingLeave.created_at.split('T')[0];
        // If applied on or after the start date
        if (createdDate >= matchingLeave.start_date) {
          // Check time: if created today after shift start
          const timePart = matchingLeave.created_at.split('T')[1]?.slice(0, 5) || '';
          if (createdDate === targetDate) {
            isLateApp = true;
            lateAppReason = `Applied on same day (${formatTime12h(timePart)})`;
          } else if (createdDate > matchingLeave.start_date) {
            isLateApp = true;
            lateAppReason = `Applied late after leave date on ${createdDate}`;
          }
        }
      }

      leaveInfo = {
        id: String(matchingLeave.id),
        type: matchingLeave.leave_type || 'Leave',
        status: matchingLeave.status || 'Pending',
        startDate: matchingLeave.start_date,
        endDate: matchingLeave.end_date,
        duration: matchingLeave.leave_duration_type || 'Full Day',
        reason: matchingLeave.reason || '',
        appliedAt: matchingLeave.created_at || '',
        isLateApplication: isLateApp,
        lateApplicationReason: lateAppReason,
      };
    }

    let permissionInfo: EmployeeAttendanceRow['permissionInfo'] = undefined;
    if (matchingPerm) {
      let isLateApp = false;
      let lateAppReason = '';
      if (matchingPerm.created_at) {
        const createdDate = matchingPerm.created_at.split('T')[0];
        const createdTime = matchingPerm.created_at.split('T')[1]?.slice(0, 5) || '';
        if (createdDate === matchingPerm.permission_date) {
          const permStartMins = timeToMinutes(matchingPerm.from_time);
          const createdMins = timeToMinutes(createdTime);
          // Applied after permission start time or after shift grace
          if (createdMins >= permStartMins || createdMins >= graceExpiryMinutes) {
            isLateApp = true;
            lateAppReason = `Applied at ${formatTime12h(createdTime)} for ${formatTime12h(matchingPerm.from_time)}`;
          }
        } else if (createdDate > matchingPerm.permission_date) {
          isLateApp = true;
          lateAppReason = `Applied after date on ${createdDate}`;
        }
      }

      permissionInfo = {
        id: String(matchingPerm.id),
        status: matchingPerm.status || 'Pending',
        date: matchingPerm.permission_date,
        fromTime: matchingPerm.from_time || '',
        toTime: matchingPerm.to_time || '',
        totalHours: matchingPerm.total_hours,
        reason: matchingPerm.reason || '',
        appliedAt: matchingPerm.created_at || '',
        isLateApplication: isLateApp,
        lateApplicationReason: lateAppReason,
      };
    }

    // Determine late application tag
    let lateApplicationTag: string | undefined = undefined;
    if (leaveInfo?.isLateApplication) {
      lateApplicationTag = `Late Leave Request: ${leaveInfo.lateApplicationReason || 'Applied late'}`;
    } else if (permissionInfo?.isLateApplication) {
      lateApplicationTag = `Late Perm Request: ${permissionInfo.lateApplicationReason || 'Applied late'}`;
    }

    // Determine main attendance status
    let attendanceStatus: EmployeeAttendanceRow['attendanceStatus'] = 'Absent';
    if (firstPunch) {
      attendanceStatus = isLate ? 'Late Arrival' : 'On Time';
    } else if (leaveInfo) {
      attendanceStatus = leaveInfo.status === 'Approved' ? 'Approved Leave' : 'Pending Leave';
    } else if (permissionInfo && permissionInfo.status === 'Approved') {
      attendanceStatus = 'Approved Permission';
    } else {
      attendanceStatus = 'Absent';
    }

    // Calculate 30-day repeated late arrivals
    const historyList = historyPunchesByCode.get(code) || [];
    let repeatLateCount = 0;
    for (const h of historyList) {
      if (h.first_punch_time) {
        const m = timeToMinutes(h.first_punch_time);
        if (m > graceExpiryMinutes) {
          repeatLateCount++;
        }
      }
    }

    const repeatLeaveCount = leaves30dByCode.get(code) || 0;
    const repeatPermissionCount = perms30dByCode.get(code) || 0;

    // Repeated issue flag based on configurable thresholds
    const hasRepeatedIssue =
      repeatLateCount >= (settings.repeatLateThreshold ?? 3) ||
      repeatPermissionCount >= (settings.repeatPermissionThreshold ?? 2) ||
      repeatLeaveCount >= (settings.repeatLeaveThreshold ?? 3);

    rows.push({
      employeeId: code,
      employeeCode: code,
      name: emp.name,
      department: emp.department,
      designation: emp.designation,
      shiftTime,
      firstPunch,
      lastPunch,
      totalPunches,
      isLate,
      lateMinutes,
      graceMinutes,
      attendanceStatus,
      leaveInfo,
      permissionInfo,
      lateApplicationTag,
      repeatLateCount,
      repeatLeaveCount,
      repeatPermissionCount,
      hasRepeatedIssue,
    });
  }

  // Sort rows: Late arrivals & Late requests first, then present, then leaves, then absent
  const statusPriority: Record<EmployeeAttendanceRow['attendanceStatus'], number> = {
    'Late Arrival': 1,
    'On Time': 2,
    'Approved Leave': 3,
    'Pending Leave': 4,
    'Approved Permission': 5,
    'Absent': 6,
  };

  rows.sort((a, b) => {
    // If has late application, elevate
    if (a.lateApplicationTag && !b.lateApplicationTag) return -1;
    if (!a.lateApplicationTag && b.lateApplicationTag) return 1;
    const pA = statusPriority[a.attendanceStatus] || 99;
    const pB = statusPriority[b.attendanceStatus] || 99;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });

  // Calculate summary counts
  const summary: AttendanceReportSummary = {
    totalEmployees: rows.length,
    presentCount: rows.filter((r) => r.firstPunch !== null).length,
    onTimeCount: rows.filter((r) => r.attendanceStatus === 'On Time').length,
    lateCount: rows.filter((r) => r.isLate).length,
    approvedLeaveCount: rows.filter((r) => r.attendanceStatus === 'Approved Leave').length,
    pendingLeaveCount: rows.filter((r) => r.attendanceStatus === 'Pending Leave').length,
    approvedPermissionCount: rows.filter((r) => r.attendanceStatus === 'Approved Permission').length,
    absentCount: rows.filter((r) => r.attendanceStatus === 'Absent').length,
    lateApplicationsCount: rows.filter((r) => !!r.lateApplicationTag).length,
    repeatedIssuesCount: rows.filter((r) => r.hasRepeatedIssue).length,
  };

  return { rows, summary };
}

/**
 * Export report as a PDF document using jsPDF + autoTable
 */
export function exportAttendanceReportToPDF(
  rows: EmployeeAttendanceRow[],
  summary: AttendanceReportSummary,
  reportDate: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  // Document Title & Company Header
  doc.setFillColor(26, 61, 177); // Brand Primary
  doc.rect(0, 0, doc.internal.pageSize.width, 50, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Knockturn LMS – Attendance & Leave Report', 40, 32);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleString()}  |  Report Date: ${reportDate}`, doc.internal.pageSize.width - 40, 32, {
    align: 'right',
  });

  // Summary Metrics Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Summary Statistics', 40, 75);

  const metricsData = [
    [
      `Total Employees: ${summary.totalEmployees}`,
      `Present: ${summary.presentCount}`,
      `On Time: ${summary.onTimeCount}`,
      `Late Arrivals: ${summary.lateCount}`,
      `Approved Leaves: ${summary.approvedLeaveCount}`,
      `Pending Leaves: ${summary.pendingLeaveCount}`,
      `Absent: ${summary.absentCount}`,
      `Repeat Issues: ${summary.repeatedIssuesCount}`,
    ],
  ];

  autoTable(doc, {
    startY: 85,
    head: [],
    body: metricsData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 6,
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
    },
    margin: { left: 40, right: 40 },
  });

  // Main Attendance Table
  const tableHeaders = [
    ['Emp ID', 'Employee Name', 'Department', 'Shift', 'Punch-In', 'Late Duration', 'Status', 'Leave / Permission', '30d Repeat Stats'],
  ];

  const tableBody = rows.map((r) => {
    let lateText = '—';
    if (r.firstPunch) {
      lateText = r.isLate ? `${r.lateMinutes} mins late` : 'On Time';
    }

    let statusText = r.attendanceStatus;
    if (r.lateApplicationTag) {
      statusText += ` (Late Request)`;
    }

    let leaveOrPerm = '—';
    if (r.leaveInfo) {
      leaveOrPerm = `${r.leaveInfo.type} Leave (${r.leaveInfo.status})`;
      if (r.leaveInfo.reason) leaveOrPerm += ` - ${r.leaveInfo.reason.slice(0, 20)}`;
    } else if (r.permissionInfo) {
      leaveOrPerm = `Perm: ${formatTime12h(r.permissionInfo.fromTime)} - ${formatTime12h(r.permissionInfo.toTime)}`;
    }

    const repeatText = `Late: ${r.repeatLateCount} | Perm: ${r.repeatPermissionCount} | Leave: ${r.repeatLeaveCount}`;

    return [
      r.employeeCode,
      r.name,
      r.department || '—',
      formatTime12h(r.shiftTime),
      formatTime12h(r.firstPunch),
      lateText,
      statusText,
      leaveOrPerm,
      repeatText,
    ];
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: tableHeaders,
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 5,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 100 },
      2: { cellWidth: 70 },
      3: { cellWidth: 55 },
      4: { cellWidth: 55 },
      5: { cellWidth: 70 },
      6: { cellWidth: 85 },
      7: { cellWidth: 140 },
      8: { cellWidth: 100 },
    },
    didParseCell: (data) => {
      // Highlight Late rows
      if (data.section === 'body') {
        const row = rows[data.row.index];
        if (row?.isLate && data.column.index === 5) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.column.index === 5 && row?.firstPunch && !row.isLate) {
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        }

        if (row?.hasRepeatedIssue && data.column.index === 8) {
          data.cell.styles.textColor = [194, 65, 12];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 40, right: 40 },
  });

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages}  •  Knockturn LMS Attendance System`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 20,
      { align: 'center' }
    );
  }

  doc.save(`Attendance_Leave_Report_${reportDate}.pdf`);
}

/**
 * Export report as a Microsoft Word document (.docx)
 */
export async function exportAttendanceReportToWord(
  rows: EmployeeAttendanceRow[],
  summary: AttendanceReportSummary,
  reportDate: string
) {
  const tableHeaderCells = [
    'Emp ID',
    'Employee Name',
    'Department',
    'Shift Time',
    'Punch-In',
    'Late Duration',
    'Status',
    'Leave / Permission',
    '30-Day Repeat Stats',
  ].map(
    (header) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: header, bold: true, color: 'FFFFFF', size: 18 })],
          }),
        ],
        shading: { fill: '1A3DB1', type: ShadingType.CLEAR },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        },
      })
  );

  const tableRows = rows.map((r, idx) => {
    let lateText = '—';
    let lateColor = '000000';
    if (r.firstPunch) {
      if (r.isLate) {
        lateText = `${r.lateMinutes} mins late`;
        lateColor = 'DC2626';
      } else {
        lateText = 'On Time';
        lateColor = '166534';
      }
    }

    let statusText = r.attendanceStatus;
    if (r.lateApplicationTag) {
      statusText += ` [Late Request]`;
    }

    let leaveOrPerm = '—';
    if (r.leaveInfo) {
      leaveOrPerm = `${r.leaveInfo.type} Leave (${r.leaveInfo.status}) ${r.leaveInfo.reason ? '- ' + r.leaveInfo.reason : ''}`;
    } else if (r.permissionInfo) {
      leaveOrPerm = `Perm: ${formatTime12h(r.permissionInfo.fromTime)} - ${formatTime12h(r.permissionInfo.toTime)}`;
    }

    const repeatText = `Late: ${r.repeatLateCount} | Perm: ${r.repeatPermissionCount} | Leave: ${r.repeatLeaveCount}`;
    const bgColor = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';

    const cells = [
      r.employeeCode,
      r.name,
      r.department || '—',
      formatTime12h(r.shiftTime),
      formatTime12h(r.firstPunch),
      lateText,
      statusText,
      leaveOrPerm,
      repeatText,
    ];

    return new TableRow({
      children: cells.map((c, colIdx) => {
        const isLateCol = colIdx === 5;
        return new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: c,
                  bold: isLateCol && r.firstPunch !== null,
                  color: isLateCol ? lateColor : '1E293B',
                  size: 16,
                }),
              ],
            }),
          ],
          shading: { fill: bgColor, type: ShadingType.CLEAR },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          },
        });
      }),
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'Knockturn LMS – Attendance & Leave Report',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Knockturn LMS – Attendance & Leave Report', bold: true, color: '1A3DB1' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Report Date: ${reportDate}  |  Generated At: ${new Date().toLocaleString()}`,
                italics: true,
                color: '64748B',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: 'Summary Overview', bold: true, size: 22, color: '0F172A' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Total Employees: ${summary.totalEmployees}  •  Present: ${summary.presentCount}  •  On Time: ${summary.onTimeCount}  •  Late Arrivals: ${summary.lateCount}  •  Approved Leave: ${summary.approvedLeaveCount}  •  Pending Leave: ${summary.pendingLeaveCount}  •  Absent: ${summary.absentCount}  •  Repeat Issues: ${summary.repeatedIssuesCount}`,
                size: 18,
                color: '334155',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: tableHeaderCells }), ...tableRows],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_Leave_Report_${reportDate}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
