import { supabase } from './supabaseClient';
import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { notifyUser, notifyAdminAndHR } from './notifications';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
export type CompOffFinalStatus = 'Pending' | 'Partially Approved / Pending Final Approval' | 'Approved' | 'Rejected';

export interface CompOffRequest {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  earnedStartDate: string;
  earnedEndDate: string;
  compOffDays: number;
  reason: string;
  appliedDate: string;
  adminStatus: ApprovalStatus;
  adminApprovedBy?: string;
  adminApprovedAt?: string;
  adminComments?: string;
  hrStatus: ApprovalStatus;
  hrApprovedBy?: string;
  hrApprovedAt?: string;
  hrComments?: string;
  finalStatus: CompOffFinalStatus;
  credited: boolean;
  creditedDays: number;
  usedDays: number;
}

function mapRow(row: any): CompOffRequest {
  return {
    id: String(row.id),
    employeeId: String(row.user_id || ''),
    employeeCode: row.username || row.user_id || '',
    employeeName: row.employee_name || '',
    earnedStartDate: row.earned_start_date,
    earnedEndDate: row.earned_end_date,
    compOffDays: Number(row.comp_off_days || 0),
    reason: row.reason || '',
    appliedDate: row.applied_date ? format(new Date(row.applied_date), 'yyyy-MM-dd') : '',
    adminStatus: row.admin_status || 'Pending',
    adminApprovedBy: row.admin_approved_by || undefined,
    adminApprovedAt: row.admin_approved_at || undefined,
    adminComments: row.admin_comments || undefined,
    hrStatus: row.hr_status || 'Pending',
    hrApprovedBy: row.hr_approved_by || undefined,
    hrApprovedAt: row.hr_approved_at || undefined,
    hrComments: row.hr_comments || undefined,
    finalStatus: row.final_status || 'Pending',
    credited: !!row.credited,
    creditedDays: Number(row.credited_days || 0),
    usedDays: Number(row.used_days || 0),
  };
}

function inclusiveDayCount(start: string, end: string): number {
  const s = parseISO(start);
  const e = parseISO(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(1, differenceInCalendarDays(e, s) + 1);
}

function enumerateDates(start: string, end: string): string[] {
  const s = parseISO(start);
  const e = parseISO(end);
  const days: string[] = [];
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return days;
  let cur = s;
  while (cur.getTime() <= e.getTime()) {
    days.push(format(cur, 'yyyy-MM-dd'));
    cur = addDays(cur, 1);
  }
  return days;
}

// ============================================================================
// Apply Comp Off
// ============================================================================

export async function applyCompOff(params: {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  earnedStartDate: string;
  earnedEndDate: string;
  reason: string;
}) {
  const compOffDays = inclusiveDayCount(params.earnedStartDate, params.earnedEndDate);

  const { data, error } = await supabase
    .from('comp_off_requests')
    .insert({
      user_id: params.employeeId,
      username: params.employeeCode,
      employee_name: params.employeeName,
      earned_start_date: params.earnedStartDate,
      earned_end_date: params.earnedEndDate,
      comp_off_days: compOffDays,
      reason: params.reason,
      admin_status: 'Pending',
      hr_status: 'Pending',
      final_status: 'Pending',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error applying Comp Off:', error);
    throw error;
  }

  const requestId = data?.id;

  // Notifications: employee gets a confirmation, Admin + HR get the request.
  await notifyUser(
    params.employeeId,
    'Comp Off Application Submitted',
    `Your Comp Off request for ${params.earnedStartDate} to ${params.earnedEndDate} (${compOffDays} day(s)) has been submitted and is awaiting Admin and HR approval.`,
    'comp_off_applied',
    'comp_off_request',
    requestId
  );
  await notifyAdminAndHR(
    'New Comp Off Request',
    `${params.employeeName} (${params.employeeCode}) applied for Comp Off: ${params.earnedStartDate} to ${params.earnedEndDate} (${compOffDays} day(s)). Reason: ${params.reason}`,
    'comp_off_applied',
    'comp_off_request',
    requestId
  );

  return mapRow(data);
}

// ============================================================================
// Fetching
// ============================================================================

export async function getMyCompOffRequests(employeeId: string): Promise<CompOffRequest[]> {
  try {
    const { data, error } = await supabase
      .from('comp_off_requests')
      .select('*')
      .eq('user_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapRow);
  } catch (err) {
    console.error('Error fetching my comp off requests:', err);
    return [];
  }
}

export async function getAllCompOffRequests(): Promise<CompOffRequest[]> {
  try {
    const { data, error } = await supabase
      .from('comp_off_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapRow);
  } catch (err) {
    console.error('Error fetching comp off requests:', err);
    return [];
  }
}

export async function getPendingCompOffRequests(): Promise<CompOffRequest[]> {
  const all = await getAllCompOffRequests();
  return all.filter(r => r.finalStatus !== 'Approved' && r.finalStatus !== 'Rejected');
}

// ============================================================================
// Dual Approval (Admin / HR act independently). Credit only fires once both
// sides have approved. Race-safe-ish: crediting update is guarded by
// `.eq('credited', false)` so it can only ever fire once per request.
// ============================================================================

function computeFinalStatus(adminStatus: ApprovalStatus, hrStatus: ApprovalStatus): CompOffFinalStatus {
  if (adminStatus === 'Rejected' || hrStatus === 'Rejected') return 'Rejected';
  if (adminStatus === 'Approved' && hrStatus === 'Approved') return 'Approved';
  if (adminStatus === 'Approved' || hrStatus === 'Approved') return 'Partially Approved / Pending Final Approval';
  return 'Pending';
}

function parseId(id: string): any {
  const num = Number(id);
  return !isNaN(num) && id.trim() !== '' ? num : id;
}

async function creditIfBothApproved(requestId: string, compOffDays: number, employeeId: string, employeeName: string, earnedStartDate: string, earnedEndDate: string) {
  // Guard against double-crediting: only succeeds if credited is currently false.
  const targetId = parseId(requestId);
  const { data, error } = await supabase
    .from('comp_off_requests')
    .update({ credited: true, credited_at: new Date().toISOString(), credited_days: compOffDays })
    .eq('id', targetId)
    .eq('credited', false)
    .select();

  if (error) {
    console.error('Error crediting Comp Off:', error);
    return;
  }

  if (data && data.length > 0) {
    await notifyUser(
      employeeId,
      'Comp Off Credited',
      `Both Admin and HR have approved your Comp Off request for ${earnedStartDate} to ${earnedEndDate}. ${compOffDays} day(s) have been credited to your balance.`,
      'comp_off_credited',
      'comp_off_request',
      parseInt(requestId)
    );
    await notifyAdminAndHR(
      'Comp Off Credited',
      `${employeeName}'s Comp Off request (${earnedStartDate} to ${earnedEndDate}) received final dual approval. ${compOffDays} day(s) credited.`,
      'comp_off_credited',
      'comp_off_request',
      parseInt(requestId)
    );
  }
}

export async function adminActionCompOff(requestId: string, status: 'Approved' | 'Rejected', actionBy: string, comments?: string) {
  const targetId = parseId(requestId);
  const { data: current, error: fetchErr } = await supabase
    .from('comp_off_requests')
    .select('*')
    .eq('id', targetId)
    .maybeSingle();
  if (fetchErr || !current) throw fetchErr || new Error('Comp Off request not found');

  const finalStatus = computeFinalStatus(status, current.hr_status || 'Pending');

  const { error } = await supabase
    .from('comp_off_requests')
    .update({
      admin_status: status,
      admin_approved_by: actionBy,
      admin_approved_at: new Date().toISOString(),
      admin_comments: comments || null,
      final_status: finalStatus,
    })
    .eq('id', targetId);

  if (error) {
    console.error('Error recording Admin Comp Off action:', error);
    throw error;
  }

  const employeeId = String(current.user_id);
  const employeeName = current.employee_name || current.username;
  const range = `${current.earned_start_date} to ${current.earned_end_date}`;

  if (status === 'Rejected') {
    await notifyUser(employeeId, 'Comp Off Rejected by Admin', `Your Comp Off request for ${range} was rejected by Admin.${comments ? ` Reason: ${comments}` : ''}`, 'comp_off_admin_rejected', 'comp_off_request', targetId);
    await notifyAdminAndHR('Comp Off Rejected', `${employeeName}'s Comp Off request (${range}) was rejected by Admin (${actionBy}).`, 'comp_off_admin_rejected', 'comp_off_request', targetId);
  } else {
    await notifyUser(employeeId, 'Comp Off Approved by Admin', `Admin approved your Comp Off request for ${range}. ${finalStatus === 'Approved' ? 'HR has also approved — your days are credited.' : 'Awaiting HR approval for final confirmation.'}`, 'comp_off_admin_approved', 'comp_off_request', targetId);
    if (finalStatus === 'Approved') {
      await creditIfBothApproved(requestId, Number(current.comp_off_days || 1), employeeId, employeeName, current.earned_start_date, current.earned_end_date);
    }
  }

  return finalStatus;
}

export async function hrActionCompOff(requestId: string, status: 'Approved' | 'Rejected', actionBy: string, comments?: string) {
  const targetId = parseId(requestId);
  const { data: current, error: fetchErr } = await supabase
    .from('comp_off_requests')
    .select('*')
    .eq('id', targetId)
    .maybeSingle();
  if (fetchErr || !current) throw fetchErr || new Error('Comp Off request not found');

  const finalStatus = computeFinalStatus(current.admin_status || 'Pending', status);

  const { error } = await supabase
    .from('comp_off_requests')
    .update({
      hr_status: status,
      hr_approved_by: actionBy,
      hr_approved_at: new Date().toISOString(),
      hr_comments: comments || null,
      final_status: finalStatus,
    })
    .eq('id', targetId);

  if (error) {
    console.error('Error recording HR Comp Off action:', error);
    throw error;
  }

  const employeeId = String(current.user_id);
  const employeeName = current.employee_name || current.username;
  const range = `${current.earned_start_date} to ${current.earned_end_date}`;

  if (status === 'Rejected') {
    await notifyUser(employeeId, 'Comp Off Rejected by HR', `Your Comp Off request for ${range} was rejected by HR.${comments ? ` Reason: ${comments}` : ''}`, 'comp_off_hr_rejected', 'comp_off_request', targetId);
    await notifyAdminAndHR('Comp Off Rejected', `${employeeName}'s Comp Off request (${range}) was rejected by HR (${actionBy}).`, 'comp_off_hr_rejected', 'comp_off_request', targetId);
  } else {
    await notifyUser(employeeId, 'Comp Off Approved by HR', `HR approved your Comp Off request for ${range}. ${finalStatus === 'Approved' ? 'Admin has also approved — your days are credited.' : 'Awaiting Admin approval for final confirmation.'}`, 'comp_off_hr_approved', 'comp_off_request', targetId);
    if (finalStatus === 'Approved') {
      await creditIfBothApproved(requestId, Number(current.comp_off_days || 1), employeeId, employeeName, current.earned_start_date, current.earned_end_date);
    }
  }

  return finalStatus;
}

// ============================================================================
// Balance
// ============================================================================

export interface CompOffBalance {
  approvedDays: number;   // total credited across all fully (dual) approved requests
  usedDays: number;
  remainingDays: number;
}

export async function getCompOffBalance(employeeId: string): Promise<CompOffBalance> {
  try {
    const requests = await getMyCompOffRequests(employeeId);
    const credited = requests.filter(r => r.credited);
    const approvedDays = credited.reduce((sum, r) => sum + r.creditedDays, 0);
    const usedDays = credited.reduce((sum, r) => sum + r.usedDays, 0);
    return { approvedDays, usedDays, remainingDays: Math.max(0, approvedDays - usedDays) };
  } catch (err) {
    console.error('Error computing Comp Off balance:', err);
    return { approvedDays: 0, usedDays: 0, remainingDays: 0 };
  }
}

// ============================================================================
// Leave-application validation: given a requested leave date range, determine
// how many days are covered by remaining approved Comp Off balance (FIFO,
// fungible balance) vs. how many fall through as LOP.
// ============================================================================

export interface CompOffCoverage {
  requestedDays: number;
  requestedDates: string[];
  approvedAvailable: number;
  coveredDates: string[];
  uncoveredDates: string[];
  lopDays: number;
}

export async function validateCompOffCoverage(employeeId: string, startDate: string, endDate: string): Promise<CompOffCoverage> {
  const requestedDates = enumerateDates(startDate, endDate);
  const balance = await getCompOffBalance(employeeId);
  const coveredDates = requestedDates.slice(0, balance.remainingDays);
  const uncoveredDates = requestedDates.slice(balance.remainingDays);

  return {
    requestedDays: requestedDates.length,
    requestedDates,
    approvedAvailable: balance.remainingDays,
    coveredDates,
    uncoveredDates,
    lopDays: uncoveredDates.length,
  };
}

// ============================================================================
// Consume Comp Off balance (FIFO across credited requests, oldest earned
// date first) once a Comp Off leave application is submitted. Writes one
// ledger row per consumed calendar day; a request's `used_days` can never
// exceed its `credited_days`, and a given (leave, request, date) triple can
// never be recorded twice — so used days can never be reused.
// ============================================================================

export async function consumeCompOffForLeave(employeeId: string, leaveId: string | number | undefined, coveredDates: string[]) {
  if (coveredDates.length === 0) return;

  const { data: rows, error } = await supabase
    .from('comp_off_requests')
    .select('*')
    .eq('user_id', employeeId)
    .eq('credited', true)
    .order('earned_start_date', { ascending: true });

  if (error) {
    console.error('Error loading Comp Off requests for consumption:', error);
    throw error;
  }

  let remainingToConsume = [...coveredDates];

  for (const row of rows || []) {
    if (remainingToConsume.length === 0) break;
    const available = Number(row.credited_days || 0) - Number(row.used_days || 0);
    if (available <= 0) continue;

    const takeCount = Math.min(available, remainingToConsume.length);
    const datesForThisRequest = remainingToConsume.slice(0, takeCount);
    remainingToConsume = remainingToConsume.slice(takeCount);

    // Insert ledger rows (one per date) — unique constraint prevents duplicates.
    const ledgerRows = datesForThisRequest.map(d => ({
      comp_off_request_id: row.id,
      leave_id: leaveId ? parseInt(String(leaveId)) : null,
      user_id: employeeId,
      used_date: d,
      days_used: 1,
    }));

    const { error: ledgerErr } = await supabase.from('comp_off_usage_ledger').insert(ledgerRows);
    if (ledgerErr) {
      console.error('Error inserting Comp Off usage ledger rows:', ledgerErr);
      continue;
    }

    // Increment used_days on the request.
    const newUsed = Number(row.used_days || 0) + takeCount;
    await supabase.from('comp_off_requests').update({ used_days: newUsed }).eq('id', row.id);
  }

  if (remainingToConsume.length > 0) {
    console.warn('Comp Off consumption: ran out of available balance for dates', remainingToConsume);
  }
}
