/**
 * Attendance & Leave Report Settings Management
 *
 * Persists all admin-configurable settings in localStorage so they
 * survive page refreshes and work offline (Capacitor / PWA).
 */

// ─── Types ──────────────────────────────────────────────────────────

export type PresetShift = '09:30' | '10:00' | '11:00';
export type ShiftTime = PresetShift | string; // custom HH:mm

export interface EmployeeShiftAssignment {
  employeeCode: string;
  shiftTime: ShiftTime;
}

export interface AttendanceSettings {
  /** Default shift applied to employees without an explicit assignment */
  defaultShift: ShiftTime;

  /** Per-employee shift overrides  (code → HH:mm) */
  employeeShifts: Record<string, ShiftTime>;

  /** Grace period in minutes before marking late */
  gracePeriodMinutes: number;

  /** ── Repeat-issue thresholds ── */
  /** Late arrivals in the reporting window to flag as "repeated" */
  repeatLateThreshold: number;

  /** Permission requests in the reporting window to flag */
  repeatPermissionThreshold: number;

  /** Leave applications in the reporting window to flag */
  repeatLeaveThreshold: number;

  /** Rolling window in days used for repeat-issue detection */
  reportingPeriodDays: number;

  /** Whether to include inactive employees in the report */
  includeInactiveEmployees: boolean;

  /** Whether to auto-exclude weekends from late calculations */
  excludeWeekends: boolean;

  /** Custom company name for PDF/Word exports */
  companyName: string;
}

// ─── Defaults ───────────────────────────────────────────────────────

const STORAGE_KEY = 'lms_attendance_settings_v2';

export const DEFAULT_SETTINGS: AttendanceSettings = {
  defaultShift: '09:30',
  employeeShifts: {},
  gracePeriodMinutes: 15,
  repeatLateThreshold: 3,
  repeatPermissionThreshold: 2,
  repeatLeaveThreshold: 3,
  reportingPeriodDays: 30,
  includeInactiveEmployees: false,
  excludeWeekends: true,
  companyName: 'Knockturn LMS',
};

// ─── Getters / Setters ─────────────────────────────────────────────

export function getAttendanceSettings(): AttendanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    // Merge with defaults so new keys added in future versions are present
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAttendanceSettings(settings: AttendanceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save attendance settings:', e);
  }
}

/** Convenience: get the shift for a specific employee, falling back to default */
export function getEmployeeShift(empCode: string): ShiftTime {
  const settings = getAttendanceSettings();
  return settings.employeeShifts[empCode] || settings.defaultShift;
}

/** Convenience: save one employee's shift */
export function setEmployeeShift(empCode: string, shift: ShiftTime): void {
  const settings = getAttendanceSettings();
  settings.employeeShifts[empCode] = shift;
  saveAttendanceSettings(settings);
}

/** Convenience: bulk-assign the same shift to multiple employees */
export function bulkAssignShift(empCodes: string[], shift: ShiftTime): void {
  const settings = getAttendanceSettings();
  for (const code of empCodes) {
    settings.employeeShifts[code] = shift;
  }
  saveAttendanceSettings(settings);
}

/** Remove an employee's custom shift (reverts to default) */
export function clearEmployeeShift(empCode: string): void {
  const settings = getAttendanceSettings();
  delete settings.employeeShifts[empCode];
  saveAttendanceSettings(settings);
}

/** Reset everything to defaults */
export function resetAttendanceSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Migration: import old v1 shifts if present ────────────────────

const OLD_SHIFT_KEY = 'lms_employee_shifts_v1';

export function migrateV1Shifts(): void {
  try {
    const old = localStorage.getItem(OLD_SHIFT_KEY);
    if (!old) return;
    const shifts: Record<string, ShiftTime> = JSON.parse(old);
    const settings = getAttendanceSettings();
    // Only import if v2 has no employee shifts yet
    if (Object.keys(settings.employeeShifts).length === 0) {
      settings.employeeShifts = shifts;
      saveAttendanceSettings(settings);
    }
    localStorage.removeItem(OLD_SHIFT_KEY);
  } catch {
    // Silently ignore migration failures
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

export const PRESET_SHIFTS: { value: PresetShift; label: string }[] = [
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
];

export function formatShiftLabel(shift: ShiftTime): string {
  const preset = PRESET_SHIFTS.find((p) => p.value === shift);
  if (preset) return preset.label;
  // Format custom HH:mm to 12h
  return formatTime12h(shift);
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

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}
