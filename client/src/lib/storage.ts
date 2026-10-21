import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { format } from 'date-fns';
import { User, LeaveRequest, Role, INITIAL_LEAVES, INITIAL_USERS } from './data';
export type { User, LeaveRequest, Role };

// Backwards-compatible synchronous getter for places that still call
// `getStoredUsers()` synchronously. This returns the initial in-memory
// user list until the app is fully migrated to async DB calls.
export function getStoredUsers(): User[] {
  return INITIAL_USERS;
}

export async function getAllUsersAsync(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    
    return (data || []).map((u: any) => {
       const dbRole = (u.role || 'employee').toString().toLowerCase();
       const mappedRole: Role = dbRole === 'admin' ? 'Admin' : dbRole === 'hr' ? 'HR' : 'Employee';
       return {
         id: String(u.user_id || u.username || ''),
         code: u.username || u.user_id || '',
         name: u.name || u.username || '',
         role: mappedRole,
         designation: u.designation || '',
         email: u.email || undefined,
       };
    });
  } catch (err) {
    console.error('Error fetching all users async:', err);
    return INITIAL_USERS;
  }
}

export function updateUser(id: string, updatedData: Partial<User>) {
  const updated = INITIAL_USERS.map(u => u.id === id ? { ...u, ...updatedData } : u);
  return updated;
}

export function deleteUser(id: string) {
  const filtered = INITIAL_USERS.filter(u => u.id !== id);
  return filtered;
}

const LEAVES_KEY = 'knockturn_leaves';

// ============================================================================
// LEAVES - Query Supabase `leaves` table
// ============================================================================

export async function getStoredLeaves(): Promise<LeaveRequest[]> {
  try {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leaves from Supabase', error);
      throw error;
    }

    // Map Supabase leaves to LeaveRequest format
    const mapped = (data || []).map((row: any) => ({
      id: String(row.id),
      employeeId: String(row.user_id || ''),
      // prefer `username` column if present, then `employee_name`, then `name`
      employeeName: row.username || row.employee_name || row.name || '',
      // prefer explicit employee_code, otherwise fall back to user_id
      employeeCode: row.employee_code || row.username || row.user_id || '',
      type: row.leave_type || '',
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      duration: row.leave_duration_type || 'Full Day',
      description: row.reason || '',
      status: row.status || 'Pending',
      attachment: row.attachment || undefined,
      reasonForAction: row.reason_for_action || undefined,
      actionBy: row.action_by || undefined,
      actionDate: row.action_date || undefined,
      appliedDate: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      odFromTime: row.from_time || row.od_from_time || undefined,
      odToTime: row.to_time || row.od_to_time || undefined,
      fromTime: row.from_time || row.od_from_time || undefined,
      toTime: row.to_time || row.od_to_time || undefined,
      compOffCoveredDays: row.comp_off_covered_days != null ? Number(row.comp_off_covered_days) : undefined,
      lopDays: row.lop_days != null ? Number(row.lop_days) : undefined,
      compOffUncoveredDates: row.comp_off_uncovered_dates || undefined,
    }));

    // Enrich mapped rows: if employeeName is missing or looks like an ID (e.g., E0053),
    // fetch the real `name` from `users` and replace it so UI shows human names.
    const needs = mapped
      .filter(r => !r.employeeName || /^E\d{3,}$/.test(r.employeeName) || r.employeeName === r.employeeCode)
      .map(r => r.employeeId)
      .filter(Boolean);

    if (needs.length > 0) {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('user_id,username')
          .in('user_id', needs);

        const userMap: Record<string, any> = {};
        (users || []).forEach((u: any) => { userMap[u.user_id] = u; });

        return mapped.map(m => {
          const u = userMap[m.employeeId];
          if (u && u.name && u.name !== '' && u.name !== m.employeeId) {
            return { ...m, employeeName: u.name };
          }
          return m;
        });
      } catch (e) {
        console.error('Error enriching leave names:', e);
        return mapped;
      }
    }

    return mapped;
  } catch (err) {
    console.error('Error fetching leaves:', err);
    return INITIAL_LEAVES;
  }
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  message?: string;
  isAllowedOdOtPair?: boolean;
}

/**
 * Validates leave date and hourly time conflicts.
 * Rules:
 * 1. For hourly requests (OD/OT), toTime must be strictly after fromTime.
 * 2. An employee cannot have overlapping leave requests on the same date(s).
 * 3. EXCEPTION: Hourly OD and Hourly OT are allowed on the same date IF and ONLY IF
 *    their time ranges do not overlap.
 * 4. All other conflicting requests on overlapping dates are blocked.
 */
export function checkLeaveConflict(
  newLeave: {
    startDate: string;
    endDate: string;
    type: string;
    duration?: string;
    fromTime?: string;
    toTime?: string;
  },
  existingLeaves: LeaveRequest[]
): ConflictCheckResult {
  if (!newLeave.startDate || !newLeave.endDate) {
    return { hasConflict: false };
  }

  // 1. Validate date order
  if (newLeave.endDate < newLeave.startDate) {
    return {
      hasConflict: true,
      message: 'End date cannot be earlier than start date.',
    };
  }

  // 2. Validate hourly time order
  const isNewHourly = newLeave.duration === 'Hourly' || newLeave.type === 'OT';
  if (isNewHourly) {
    if (!newLeave.fromTime || !newLeave.toTime) {
      return {
        hasConflict: true,
        message: 'From Time and To Time are required for Hourly requests.',
      };
    }

    const [fH, fM] = newLeave.fromTime.split(':').map(Number);
    const [tH, tM] = newLeave.toTime.split(':').map(Number);
    const fromMin = fH * 60 + fM;
    const toMin = tH * 60 + tM;

    if (toMin <= fromMin) {
      return {
        hasConflict: true,
        message: 'To Time (End time) must be strictly after From Time (Start time).',
      };
    }
  }

  // Filter only active existing leaves (Pending or Approved)
  const activeLeaves = (existingLeaves || []).filter(
    (l) => l.status === 'Pending' || l.status === 'Approved'
  );

  let hasAllowedOdOt = false;

  for (const existing of activeLeaves) {
    const existStart = existing.startDate;
    const existEnd = existing.endDate;

    // Check if dates overlap: [newStart, newEnd] and [existStart, existEnd]
    const datesOverlap = newLeave.startDate <= existEnd && newLeave.endDate >= existStart;
    if (!datesOverlap) continue;

    const isExistHourly =
      existing.duration === 'Hourly' ||
      existing.type === 'OT' ||
      (!!existing.fromTime && !!existing.toTime) ||
      (!!(existing as any).odFromTime && !!(existing as any).odToTime);

    const isNewOdOt = newLeave.type === 'OD' || newLeave.type === 'OT';
    const isExistOdOt = existing.type === 'OD' || existing.type === 'OT';

    // SPECIAL ALLOWED CASE:
    // OD and OT on the same single date are allowed ONLY when both are hourly and their time ranges do NOT overlap!
    if (
      isNewHourly &&
      isExistHourly &&
      isNewOdOt &&
      isExistOdOt &&
      newLeave.type !== existing.type && // One is OD, the other is OT
      newLeave.startDate === newLeave.endDate &&
      existStart === existEnd &&
      newLeave.startDate === existStart
    ) {
      const existFrom = existing.fromTime || (existing as any).odFromTime || '';
      const existTo = existing.toTime || (existing as any).odToTime || '';

      if (existFrom && existTo && newLeave.fromTime && newLeave.toTime) {
        const [nFH, nFM] = newLeave.fromTime.split(':').map(Number);
        const [nTH, nTM] = newLeave.toTime.split(':').map(Number);
        const [eFH, eFM] = existFrom.split(':').map(Number);
        const [eTH, eTM] = existTo.split(':').map(Number);

        const nFrom = nFH * 60 + nFM;
        const nTo = nTH * 60 + nTM;
        const eFrom = eFH * 60 + eFM;
        const eTo = eTH * 60 + eTM;

        // Overlap condition: nFrom < eTo && nTo > eFrom
        const timesOverlap = nFrom < eTo && nTo > eFrom;

        if (timesOverlap) {
          return {
            hasConflict: true,
            message: `Time range overlaps with an existing ${existing.type} (${existFrom} - ${existTo}) on ${existStart}. OD and OT cannot overlap in time.`,
          };
        }

        // Non-overlapping OD and OT: Allowed!
        hasAllowedOdOt = true;
        continue;
      }
    }

    // ALL OTHER CONFLICTS ARE BLOCKED
    const existDesc =
      isExistHourly && (existing.fromTime || (existing as any).odFromTime)
        ? `Hourly ${existing.type} [${existing.fromTime || (existing as any).odFromTime} - ${existing.toTime || (existing as any).odToTime}]`
        : `${existing.type} (${existing.duration || 'Full Day'})`;

    const existDates = existStart === existEnd ? existStart : `${existStart} to ${existEnd}`;

    return {
      hasConflict: true,
      message: `Conflicting leave request already exists: ${existDesc} for ${existDates} (${existing.status}).`,
    };
  }

  return {
    hasConflict: false,
    isAllowedOdOtPair: hasAllowedOdOt,
  };
}

export async function addLeaveRequest(leave: LeaveRequest) {
  // 1. Core conflict validation before submission
  try {
    const allLeaves = await getStoredLeaves();
    const userLeaves = allLeaves.filter(
      (l) =>
        l.employeeId === leave.employeeId ||
        l.employeeCode === leave.employeeCode ||
        l.employeeId === leave.employeeCode ||
        l.employeeCode === leave.employeeId
    );

    const conflict = checkLeaveConflict(leave, userLeaves);
    if (conflict.hasConflict) {
      console.error('Leave conflict blocked:', conflict.message);
      throw new Error(conflict.message || 'Conflicting leave request already exists.');
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Conflict') || err.message.includes('overlap') || err.message.includes('End time')) {
      throw err;
    }
    console.warn('Could not run pre-insert conflict check:', err);
  }

  try {
    const response = await fetch('/api/apply-leave', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leave)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('Conflict') || err.message.includes('overlap') || err.message.includes('End time'))) {
      throw err;
    }
    console.warn('Backend /api/apply-leave unavailable, using direct Supabase insert:', err);
  }

  // Direct Supabase insert fallback so the APK works standalone without an Express backend
  try {
    const row: any = {
      user_id: leave.employeeId,
      username: leave.employeeName || leave.employeeCode,
      employee_name: leave.employeeName || leave.employeeCode,
      leave_type: leave.type,
      start_date: leave.startDate,
      end_date: leave.endDate,
      leave_duration_type: leave.duration || 'Full Day',
      reason: leave.description,
      status: 'Pending',
      attachment: leave.attachment || null,
      from_time: (leave as any).odFromTime || (leave as any).fromTime || null,
      to_time: (leave as any).odToTime || (leave as any).toTime || null,
    };

    let { data, error } = await supabase.from('leaves').insert(row).select();
    if (error) {
      console.warn('Full leave insert encountered error, retrying with core columns:', error);
      const minimalRow: any = {
        user_id: leave.employeeId,
        username: leave.employeeName || leave.employeeCode,
        leave_type: leave.type,
        start_date: leave.startDate,
        end_date: leave.endDate,
        reason: leave.description,
        status: 'Pending',
        attachment: leave.attachment || null,
      };
      const retry = await supabase.from('leaves').insert(minimalRow).select();
      if (retry.error) {
        console.error('Direct Supabase insert error on retry:', retry.error);
        throw retry.error;
      }
      return retry.data;
    }
    return data;
  } catch (dbErr) {
    console.error('Error adding leave request to Supabase:', dbErr);
    throw dbErr;
  }
}

export async function updateLeaveStatus(
  id: string,
  status: LeaveRequest['status'],
  actionBy: string,
  reason?: string
) {
  try {
    // 1) Update the leave row status
    const { data: updatedLeave, error: updateErr } = await supabase
      .from('leaves')
      .update({ status, action_by: actionBy, action_date: new Date(), reason_for_action: reason || null })
      .eq('id', parseInt(id))
      .select();

    if (updateErr) {
      console.error('Error updating leave status in Supabase:', updateErr);
      throw updateErr;
    }

    // 2) If approved, update initial_leave_balances table in Supabase to sync live taken counts
    if (status === 'Approved' && updatedLeave && updatedLeave[0]) {
      try {
        const leaveRow = updatedLeave[0];
        const leaveType = leaveRow.leave_type;
        const code = leaveRow.username || leaveRow.employee_code || leaveRow.user_id;

        if (code && (leaveType === 'Casual' || leaveType === 'Sick' || leaveType === 'Privilege' || leaveType === 'Earned')) {
          const s = new Date(leaveRow.start_date);
          const e = new Date(leaveRow.end_date);
          const diffTime = Math.abs(e.getTime() - s.getTime());
          const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

          const manualMap = await getManualBalances();
          const existing = manualMap[code.toLowerCase()] || { casualTaken: 0, sickTaken: 0, privilegeTaken: 0 };

          const fieldMap: Record<string, 'casualTaken' | 'sickTaken' | 'privilegeTaken'> = {
            Casual: 'casualTaken',
            Sick: 'sickTaken',
            Privilege: 'privilegeTaken',
            Earned: 'privilegeTaken'
          };
          const field = fieldMap[leaveType];
          if (field) {
            existing[field] = (existing[field] || 0) + days;
            await saveManualBalance(code, {
              casualTaken: existing.casualTaken,
              sickTaken: existing.sickTaken,
              privilegeTaken: existing.privilegeTaken
            });
          }
        }
      } catch (syncErr) {
        console.warn('Could not sync approved leave to initial_leave_balances:', syncErr);
      }
    }

    // 3) Insert an approval record into the approvals table for audit
    const { data: approvalData, error: approvalErr } = await supabase
      .from('approvals')
      .insert({
        request_type: 'leave',
        request_id: parseInt(id),
        admin_status: status,
        admin_approved_by: actionBy,
        admin_approved_at: new Date(),
        comments: reason || null,
      })
      .select();

    if (approvalErr) {
      console.error('Error inserting approval for leave in Supabase:', approvalErr);
      // don't throw here — leave update succeeded; return both pieces
    }

    return { updatedLeave, approvalData };
  } catch (err) {
    console.error('Error in updateLeaveStatus:', err);
    throw err;
  }
}

// ============================================================================
// PERMISSIONS - Query Supabase `permissions` table
// ============================================================================

export interface PermissionRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  type: 'Late Entry Permission' | 'Early Exit Permission' | 'Personal Work Permission' | 'Emergency Permission';
  startTime: string;
  endTime: string;
  date: string;
  reason: string;
  additionalInfo?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  appliedDate: string;
  actionBy?: string;
  actionDate?: string;
  reasonForAction?: string;
  isLOPApplicable?: boolean;
  durationMinutes?: number;
}

// Helper function to calculate duration in minutes between two time strings (HH:mm format)
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  try {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;
    return Math.max(0, endTotalMin - startTotalMin);
  } catch {
    return 0;
  }
}

// Helper function to get monthly permission count for an employee
export async function getMonthlyPermissionCount(
  employeeId: string,
  date: string
): Promise<number> {
  try {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];

    // Fetch all permissions for this employee with Pending/Approved status
    const { data: allPermissions, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('user_id', employeeId)
      .in('status', ['Pending', 'Approved']);

    if (error) {
      console.error('Error counting monthly permissions:', error);
      return 0;
    }

    if (!allPermissions || allPermissions.length === 0) {
      return 0;
    }

    // Filter by month - use permission_date if available, fall back to created_at
    const monthCount = allPermissions.filter((p: any) => {
      const dateToCheck = p.permission_date ? new Date(p.permission_date) : new Date(p.created_at);
      return dateToCheck.getFullYear() === year && dateToCheck.getMonth() === month;
    }).length;

    return monthCount;
  } catch (err) {
    console.error('Error in getMonthlyPermissionCount:', err);
    return 0;
  }
}

export async function getStoredPermissions(): Promise<PermissionRequest[]> {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching permissions from Supabase', error);
      throw error;
    }

    const DB_TO_DISPLAY: Record<string, PermissionRequest['type']> = {
      late_entry: 'Late Entry Permission',
      early_exit: 'Early Exit Permission',
      personal_work: 'Personal Work Permission',
      emergency: 'Emergency Permission',
    };

    return (data || []).map((row: any) => {
      const startTime = row.from_time || '';
      const endTime = row.to_time || '';
      const durationMinutes = calculateDurationMinutes(startTime, endTime);

      return {
        id: String(row.id),
        employeeId: String(row.user_id || ''),
        employeeName: row.username || row.employee_name || row.name || '',
        employeeCode: row.employee_code || row.user_id || '',
        type: DB_TO_DISPLAY[row.permission_type] || row.permission_type,
        startTime,
        endTime,
        date: row.permission_date || row.created_at ? format(new Date(row.permission_date || row.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        reason: row.reason || '',
        additionalInfo: row.additional_info || undefined,
        status: row.status || 'Pending',
        appliedDate: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        actionBy: row.action_by || undefined,
        actionDate: row.action_date || undefined,
        reasonForAction: row.reason_for_action || undefined,
        isLOPApplicable: row.is_lop_applicable === true,
        durationMinutes,
      };
    });
  } catch (err) {
    console.error('Error fetching permissions:', err);
    return [];
  }
}

export async function addPermissionRequest(permission: PermissionRequest) {
  try {
    const DISPLAY_TO_DB: Record<PermissionRequest['type'], string> = {
      'Late Entry Permission': 'late_entry',
      'Early Exit Permission': 'early_exit',
      'Personal Work Permission': 'personal_work',
      'Emergency Permission': 'emergency',
    };

    const dbType = DISPLAY_TO_DB[permission.type] || permission.type;

    const safePerm: any = {
      user_id: permission.employeeId,
      ...(permission.employeeCode ? { username: permission.employeeCode } : {}),
      permission_type: dbType,
      from_time: permission.startTime,
      to_time: permission.endTime,
      permission_date: permission.date,
      reason: permission.reason,
      additional_info: permission.additionalInfo || null,
      is_lop_applicable: permission.isLOPApplicable || false,
    };

    const fullPerm: any = {
      ...safePerm,
      ...(permission.employeeName ? { employee_name: permission.employeeName, name: permission.employeeName } : {}),
    };

    let respPerm = await supabase.from('permissions').insert(safePerm).select();
    if (respPerm.error) {
      const errMsg = String(respPerm.error.message || '');
      if (!/column .* does not exist/i.test(errMsg) && !/Could not find the .* column/i.test(errMsg)) {
        respPerm = await supabase.from('permissions').insert(fullPerm).select();
      }
    }

    if (respPerm.error) {
      console.error('Error adding permission to Supabase after retry:', respPerm.error);
      throw respPerm.error;
    }

    return respPerm.data;
  } catch (err) {
    console.error('Error in addPermissionRequest:', err);
    throw err;
  }
}

export async function updatePermissionStatus(
  id: string,
  status: 'Approved' | 'Rejected',
  actionBy?: string,
  reason?: string
) {
  try {
    // 1) Update the permission row status
    const { data: updatedPermission, error: updateErr } = await supabase
      .from('permissions')
      .update({ status, action_by: actionBy || null, action_date: new Date(), reason_for_action: reason || null })
      .eq('id', parseInt(id))
      .select();

    if (updateErr) {
      console.error('Error updating permission status in Supabase:', updateErr);
      throw updateErr;
    }

    // 2) Insert an approval record for audit
    const { data: approvalData, error: approvalErr } = await supabase
      .from('approvals')
      .insert({
        request_type: 'permission',
        request_id: parseInt(id),
        admin_status: status,
        admin_approved_by: actionBy || null,
        admin_approved_at: new Date(),
        comments: reason || null,
      })
      .select();

    if (approvalErr) {
      console.error('Error inserting approval for permission in Supabase:', approvalErr);
      // don't throw here — the permission was updated
    }

    return { updatedPermission, approvalData };
  } catch (err) {
    console.error('Error in updatePermissionStatus:', err);
    throw err;
  }
}

// ============================================================================
// LEAVE BALANCE - Calculate from approved leaves and manual initial taken counts
// Quotas: Casual = 2, Sick = 3, Privilege = 10 (Total = 15)
// ============================================================================
export interface LeaveBalance {
  casual: { total: number; used: number; remaining: number };
  sick: { total: number; used: number; remaining: number };
  privilege: { total: number; used: number; remaining: number };
  total: { total: number; used: number; remaining: number };
}

export interface ManualEntry {
  casualTaken: number;
  sickTaken: number;
  privilegeTaken: number;
  isInitialSet?: boolean;
  updatedAt?: string;
}

const MANUAL_BALANCES_KEY = 'knockturn_manual_leave_balances';

export async function getManualBalances(): Promise<Record<string, ManualEntry>> {
  try {
    const { data, error } = await supabase.from('initial_leave_balances').select('*');
    if (!error && data && data.length > 0) {
      const map: Record<string, ManualEntry> = {};
      data.forEach((row: any) => {
        const key = (row.employee_code || row.user_code || '').trim().toLowerCase();
        if (key) {
          map[key] = {
            casualTaken: Number(row.casual_taken || 0),
            sickTaken: Number(row.sick_taken || 0),
            privilegeTaken: Number(row.privilege_taken || 0),
            isInitialSet: true,
            updatedAt: row.updated_at || undefined,
          };
        }
      });
      return map;
    }
  } catch (e) {
    console.warn('Error querying initial_leave_balances from Supabase:', e);
  }

  try {
    const raw = localStorage.getItem(MANUAL_BALANCES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return {};
}

export async function saveManualBalance(
  employeeCode: string, 
  balances: { casualTaken: number; sickTaken: number; privilegeTaken: number },
  userObj?: { id?: string; code?: string }
) {
  const codeStr = (userObj?.code || employeeCode || '').trim();
  const idStr = (userObj?.id || '').trim();
  const nowIso = new Date().toISOString();

  const entry: ManualEntry = {
    ...balances,
    isInitialSet: true,
    updatedAt: nowIso,
  };

  // 1. Save to Supabase initial_leave_balances table
  try {
    if (codeStr) {
      const { error: err1 } = await supabase.from('initial_leave_balances').upsert({
        employee_code: codeStr,
        casual_taken: balances.casualTaken,
        sick_taken: balances.sickTaken,
        privilege_taken: balances.privilegeTaken,
        updated_at: nowIso
      }, { onConflict: 'employee_code' });
      if (err1) console.warn('Supabase upsert by code error:', err1);
    }

    if (idStr && idStr !== codeStr) {
      const { error: err2 } = await supabase.from('initial_leave_balances').upsert({
        employee_code: idStr,
        casual_taken: balances.casualTaken,
        sick_taken: balances.sickTaken,
        privilege_taken: balances.privilegeTaken,
        updated_at: nowIso
      }, { onConflict: 'employee_code' });
      if (err2) console.warn('Supabase upsert by id error:', err2);
    }
  } catch (e) {
    console.warn('Error saving to initial_leave_balances in Supabase:', e);
  }

  // 2. Also save to local storage as instant local cache
  try {
    const current = await getManualBalances();
    if (codeStr) current[codeStr.toLowerCase()] = entry;
    if (idStr) current[idStr.toLowerCase()] = entry;
    localStorage.setItem(MANUAL_BALANCES_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

export async function getLeaveBalance(employeeCode: string, employeeId?: string): Promise<LeaveBalance> {
  try {
    const leaves = await getStoredLeaves();
    const manualMap = await getManualBalances();

    const normalizedQueryCode = employeeCode?.trim().toLowerCase();
    const normalizedQueryId = employeeId?.trim().toLowerCase();

    const manualEntry = (normalizedQueryCode && manualMap[normalizedQueryCode]) || (normalizedQueryId && manualMap[normalizedQueryId]);

    const employeeLeaves = leaves.filter(
      l => {
        const leaveCode = l.employeeCode?.trim().toLowerCase();
        const leaveId = l.employeeId?.trim().toLowerCase();

        return (
          (leaveCode === normalizedQueryCode || leaveCode === normalizedQueryId) ||
          (leaveId === normalizedQueryId || leaveId === normalizedQueryCode)
        ) && l.status === 'Approved';
      }
    );

    const calculateDays = (start: string, end: string) => {
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
      const diffTime = Math.abs(e.getTime() - s.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    };

    // Count only leaves applied on or after the day HR/Admin set the manual balance.
    // Using date-only comparison (YYYY-MM-DD) with >= avoids midnight vs. full-timestamp mismatch.
    const filteredLeaves = (manualEntry && manualEntry.updatedAt)
      ? employeeLeaves.filter(l => {
          const appliedDate = (l.appliedDate || l.startDate || '').split('T')[0];
          const setupDate = (manualEntry.updatedAt || '').split('T')[0];
          return appliedDate >= setupDate;
        })
      : employeeLeaves;

    const approvedCasual = filteredLeaves
      .filter(l => l.type === 'Casual')
      .reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);

    const approvedSick = filteredLeaves
      .filter(l => l.type === 'Sick')
      .reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);

    const approvedPrivilege = filteredLeaves
      .filter(l => l.type === 'Privilege' || l.type === 'Earned')
      .reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);

    const casualUsed = manualEntry ? (manualEntry.casualTaken || 0) + approvedCasual : 0;
    const sickUsed = manualEntry ? (manualEntry.sickTaken || 0) + approvedSick : 0;
    const privilegeUsed = manualEntry ? (manualEntry.privilegeTaken || 0) + approvedPrivilege : 0;

    const casualTotal = 2;
    const sickTotal = 3;
    const privilegeTotal = 10;

    const casualRemaining = Math.max(0, casualTotal - casualUsed);
    const sickRemaining = Math.max(0, sickTotal - sickUsed);
    const privilegeRemaining = Math.max(0, privilegeTotal - privilegeUsed);

    return {
      casual: {
        total: casualTotal,
        used: casualUsed,
        remaining: casualRemaining
      },
      sick: {
        total: sickTotal,
        used: sickUsed,
        remaining: sickRemaining
      },
      privilege: {
        total: privilegeTotal,
        used: privilegeUsed,
        remaining: privilegeRemaining
      },
      total: {
        total: casualTotal + sickTotal + privilegeTotal,
        used: casualUsed + sickUsed + privilegeUsed,
        remaining: casualRemaining + sickRemaining + privilegeRemaining
      }
    };
  } catch (err) {
    console.error('Error calculating leave balance:', err);
    return {
      casual: { total: 2, used: 0, remaining: 2 },
      sick: { total: 3, used: 0, remaining: 3 },
      privilege: { total: 10, used: 0, remaining: 10 },
      total: { total: 15, used: 0, remaining: 15 }
    };
  }
}

// ============================================================================
// ============================================================================
// Upload attachments to Supabase Storage
// ============================================================================

export async function uploadAttachment(
  employeeCode: string,
  file: File
): Promise<string | null> {
  try {
    const fileName = `${employeeCode}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('leave-attachments')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading attachment to Supabase Storage:', error);
      return null;
    }

    // Get public URL
    const { data: publicUrl } = await supabase.storage
      .from('leave-attachments')
      .getPublicUrl(fileName);

    return (publicUrl as any)?.publicUrl || null;
  } catch (err) {
    console.error('Error in uploadAttachment:', err);
    return null;
  }
}

// ============================================================================
// NOTIFICATIONS - helper to collect admin/hr emails for notifications
// ============================================================================
export async function getNotificationEmails() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username,email,role')
      .in('role', ['admin', 'hr']);

    if (error) {
      console.error('Error fetching notification users from Supabase', error);
      return { adminEmails: ['noreply@example.com'], hrEmails: ['noreply@example.com'] };
    }

    const adminEmails: string[] = [];
    const hrEmails: string[] = [];

    (data || []).forEach((u: any) => {
      const email = u.email || (u.username ? `${u.username.toLowerCase()}@example.com` : null);
      if (!email) return;
      if ((u.role || '').toString().toLowerCase() === 'admin') adminEmails.push(email);
      if ((u.role || '').toString().toLowerCase() === 'hr') hrEmails.push(email);
    });

    return {
      adminEmails: adminEmails.length ? adminEmails : ['noreply@example.com'],
      hrEmails: hrEmails.length ? hrEmails : ['noreply@example.com'],
    };
  } catch (err) {
    console.error('Error in getNotificationEmails:', err);
    return { adminEmails: ['noreply@example.com'], hrEmails: ['noreply@example.com'] };
  }
}
