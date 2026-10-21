import React, { useState, useEffect, useMemo } from 'react';
import {
  getAttendanceSettings,
  saveAttendanceSettings,
  resetAttendanceSettings,
  migrateV1Shifts,
  AttendanceSettings,
  ShiftTime,
  PRESET_SHIFTS,
  formatShiftLabel,
  formatTime12h,
  DEFAULT_SETTINGS,
} from '@/lib/attendanceSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Clock,
  Users,
  Shield,
  Save,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Timer,
  CalendarDays,
  Building2,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { useLocation } from 'wouter';

interface PayrollEmployee {
  id: string;
  employee_code: string;
  name: string;
  department: string;
  designation: string;
  status: string;
}

export default function AttendanceSettingsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [bulkShift, setBulkShift] = useState<ShiftTime>('09:30');
  const [customTime, setCustomTime] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('shifts');
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings and employees on mount
  useEffect(() => {
    migrateV1Shifts();
    const saved = getAttendanceSettings();
    setSettings(saved);

    // Fetch employees from payroll API
    fetch('/api/payroll-attendance?date=' + new Date().toISOString().split('T')[0])
      .then((r) => r.json())
      .then((data) => {
        if (data.employees) {
          setEmployees(data.employees.filter((e: PayrollEmployee) => e.employee_code !== 'E0000'));
        }
      })
      .catch((err) => {
        console.error('Failed to load employees:', err);
        toast({
          title: 'Error',
          description: 'Failed to load employee list from payroll database.',
          variant: 'destructive',
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Derived values
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department?.trim()) set.add(e.department.trim());
    });
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = deptFilter === 'all' || e.department === deptFilter;
      const matchStatus = settings.includeInactiveEmployees || e.status === 'active';
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, searchTerm, deptFilter, settings.includeInactiveEmployees]);

  const assignedCount = useMemo(() => {
    return employees.filter((e) => settings.employeeShifts[e.employee_code]).length;
  }, [employees, settings.employeeShifts]);

  // Handlers
  const updateSetting = <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleEmployeeShiftChange = (empCode: string, shift: ShiftTime) => {
    setSettings((prev) => ({
      ...prev,
      employeeShifts: { ...prev.employeeShifts, [empCode]: shift },
    }));
    setHasChanges(true);
  };

  const handleClearEmployeeShift = (empCode: string) => {
    setSettings((prev) => {
      const newShifts = { ...prev.employeeShifts };
      delete newShifts[empCode];
      return { ...prev, employeeShifts: newShifts };
    });
    setHasChanges(true);
  };

  const handleSelectEmployee = (empCode: string, checked: boolean) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (checked) next.add(empCode);
      else next.delete(empCode);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(filteredEmployees.map((e) => e.employee_code)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleBulkAssign = () => {
    if (selectedEmployees.size === 0) {
      toast({ title: 'No Employees Selected', description: 'Please select employees first.', variant: 'destructive' });
      return;
    }
    const shiftToAssign = customTime || bulkShift;
    setSettings((prev) => {
      const newShifts = { ...prev.employeeShifts };
      selectedEmployees.forEach((code) => {
        newShifts[code] = shiftToAssign;
      });
      return { ...prev, employeeShifts: newShifts };
    });
    setHasChanges(true);
    toast({
      title: 'Bulk Assignment Ready',
      description: `${selectedEmployees.size} employees assigned to ${formatShiftLabel(shiftToAssign)}. Click Save to apply.`,
    });
    setSelectedEmployees(new Set());
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      saveAttendanceSettings(settings);
      setHasChanges(false);
      toast({ title: 'Settings Saved', description: 'All attendance settings have been saved successfully.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    resetAttendanceSettings();
    setSettings({ ...DEFAULT_SETTINGS });
    setHasChanges(true);
    toast({
      title: 'Settings Reset',
      description: 'All settings have been reset to defaults. Click Save to confirm.',
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  // ─── Collapsible Section Component ──────────────────
  const Section = ({
    id,
    icon: Icon,
    title,
    subtitle,
    badge,
    children,
  }: {
    id: string;
    icon: React.ElementType;
    title: string;
    subtitle: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSection === id;
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{title}</h3>
              {badge}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{subtitle}</p>
          </div>
          <div className="shrink-0 text-slate-400">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>
        {isExpanded && (
          <CardContent className="pt-0 pb-5 px-4 sm:px-5 border-t border-slate-100 dark:border-slate-800">
            {children}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-5 sm:p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/attendance-report')}
              className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Report
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
                <Settings className="w-6 h-6 text-blue-300" />
                Attendance Settings
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
                Configure shift timings, grace periods, repeat-issue thresholds, and employee assignments for the Attendance & Leave Report.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
          {hasChanges && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded-lg px-3 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              You have unsaved changes. Click "Save Settings" to apply.
            </div>
          )}
        </div>
      </div>

      {/* Section 1: Default Shift & Grace Period */}
      <Section
        id="general"
        icon={Clock}
        title="General Settings"
        subtitle="Default shift time, grace period, and export settings"
      >
        <div className="space-y-6 pt-4">
          {/* Default Shift Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Default Shift Start Time
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Applied to employees without a specific shift assignment
              </p>
              <Select
                value={settings.defaultShift}
                onValueChange={(v) => updateSetting('defaultShift', v as ShiftTime)}
              >
                <SelectTrigger className="h-10 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_SHIFTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Time...</SelectItem>
                </SelectContent>
              </Select>
              {settings.defaultShift === 'custom' && (
                <Input
                  type="time"
                  value={settings.defaultShift === 'custom' ? '' : settings.defaultShift}
                  onChange={(e) => updateSetting('defaultShift', e.target.value)}
                  className="mt-1 h-10"
                  placeholder="HH:MM"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Grace Period (Minutes)
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Employees are marked late only after this grace period expires
              </p>
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.gracePeriodMinutes]}
                  onValueChange={(v) => updateSetting('gracePeriodMinutes', v[0])}
                  min={0}
                  max={60}
                  step={5}
                  className="flex-1"
                />
                <div className="w-16 text-center">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {settings.gracePeriodMinutes}
                  </span>
                  <span className="text-xs text-slate-500 block -mt-0.5">min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Include Inactive Employees</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Show terminated/inactive staff in the report
                </p>
              </div>
              <Switch
                checked={settings.includeInactiveEmployees}
                onCheckedChange={(v) => updateSetting('includeInactiveEmployees', v)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Exclude Weekends</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Skip Sat/Sun from late arrival calculations
                </p>
              </div>
              <Switch
                checked={settings.excludeWeekends}
                onCheckedChange={(v) => updateSetting('excludeWeekends', v)}
              />
            </div>
          </div>

          {/* Company name */}
          <div className="space-y-2 pt-1">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Company Name (for exports)</Label>
            <Input
              value={settings.companyName}
              onChange={(e) => updateSetting('companyName', e.target.value)}
              placeholder="Company name for PDF/Word report headers"
              className="h-10 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>
      </Section>

      {/* Section 2: Repeat-Issue Thresholds */}
      <Section
        id="thresholds"
        icon={Shield}
        title="Repeat-Issue Thresholds"
        subtitle="Configure when employees get flagged for repeated issues"
        badge={
          <Badge variant="outline" className="text-[10px] bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800">
            Configurable
          </Badge>
        }
      >
        <div className="space-y-6 pt-4">
          {/* Reporting Period */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              <CalendarDays className="w-4 h-4 inline mr-1.5 text-blue-500" />
              Reporting Period (Days)
            </Label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rolling window for counting repeated late arrivals, leaves, and permissions
            </p>
            <div className="flex items-center gap-3">
              <Slider
                value={[settings.reportingPeriodDays]}
                onValueChange={(v) => updateSetting('reportingPeriodDays', v[0])}
                min={7}
                max={90}
                step={1}
                className="flex-1"
              />
              <div className="w-16 text-center">
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {settings.reportingPeriodDays}
                </span>
                <span className="text-xs text-slate-500 block -mt-0.5">days</span>
              </div>
            </div>
          </div>

          {/* Threshold Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Late Threshold */}
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-100 dark:border-red-900/50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-red-500" />
                <span className="text-sm font-bold text-red-700 dark:text-red-400">Late Arrivals</span>
              </div>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mb-3">
                Flag after this many late arrivals in the reporting period
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.repeatLateThreshold}
                  onChange={(e) => updateSetting('repeatLateThreshold', Math.max(1, Number(e.target.value)))}
                  className="h-9 text-center font-bold bg-white dark:bg-slate-900 border-red-200 dark:border-red-800 w-20"
                />
                <span className="text-xs text-red-500 font-medium">times</span>
              </div>
            </div>

            {/* Permission Threshold */}
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-100 dark:border-amber-900/50">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Permissions</span>
              </div>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mb-3">
                Flag after this many permission requests
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.repeatPermissionThreshold}
                  onChange={(e) => updateSetting('repeatPermissionThreshold', Math.max(1, Number(e.target.value)))}
                  className="h-9 text-center font-bold bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800 w-20"
                />
                <span className="text-xs text-amber-500 font-medium">times</span>
              </div>
            </div>

            {/* Leave Threshold */}
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-100 dark:border-purple-900/50">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Leaves</span>
              </div>
              <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mb-3">
                Flag after this many leave applications
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.repeatLeaveThreshold}
                  onChange={(e) => updateSetting('repeatLeaveThreshold', Math.max(1, Number(e.target.value)))}
                  className="h-9 text-center font-bold bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-800 w-20"
                />
                <span className="text-xs text-purple-500 font-medium">times</span>
              </div>
            </div>
          </div>

          {/* Preview text */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <Zap className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
              <strong>Current rule:</strong> An employee will be flagged if they have{' '}
              <strong className="text-red-600">≥{settings.repeatLateThreshold} late arrivals</strong>,{' '}
              <strong className="text-amber-600">≥{settings.repeatPermissionThreshold} permissions</strong>, or{' '}
              <strong className="text-purple-600">≥{settings.repeatLeaveThreshold} leaves</strong> within the last{' '}
              <strong className="text-blue-600">{settings.reportingPeriodDays} days</strong>.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 3: Employee Shift Assignments */}
      <Section
        id="shifts"
        icon={Users}
        title="Employee Shift Assignments"
        subtitle="Assign individual or bulk shift timings to employees"
        badge={
          <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            {assignedCount}/{employees.length} assigned
          </Badge>
        }
      >
        <div className="space-y-4 pt-4">
          {/* Bulk Assignment Bar */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50">
            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" /> Bulk Shift Assignment
            </h4>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs font-medium text-blue-700 dark:text-blue-400">Shift Time</Label>
                <Select value={bulkShift} onValueChange={(v) => setBulkShift(v as ShiftTime)}>
                  <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_SHIFTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:w-32 space-y-1">
                <Label className="text-xs font-medium text-blue-700 dark:text-blue-400">Or Custom</Label>
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="HH:MM"
                  className="h-9 bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 text-sm"
                />
              </div>
              <Button
                onClick={handleBulkAssign}
                disabled={selectedEmployees.size === 0}
                className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 shadow-sm disabled:opacity-50"
              >
                Assign to {selectedEmployees.size} selected
              </Button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700"
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="h-9 w-full sm:w-40 text-xs border-slate-200 dark:border-slate-700">
                <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
              Loading employees...
            </div>
          ) : (
            <>
              {/* Select All Header */}
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                <Checkbox
                  checked={selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0}
                  onCheckedChange={(c) => handleSelectAll(!!c)}
                  className="data-[state=checked]:bg-blue-600"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {selectedEmployees.size > 0
                    ? `${selectedEmployees.size} of ${filteredEmployees.length} selected`
                    : `Select all ${filteredEmployees.length} employees`}
                </span>
              </div>

              {/* Employee Cards */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {filteredEmployees.map((emp) => {
                  const currentShift = settings.employeeShifts[emp.employee_code];
                  const isCustom = !!currentShift;
                  return (
                    <div
                      key={emp.employee_code}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        isCustom
                          ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                      }`}
                    >
                      <Checkbox
                        checked={selectedEmployees.has(emp.employee_code)}
                        onCheckedChange={(c) => handleSelectEmployee(emp.employee_code, !!c)}
                        className="data-[state=checked]:bg-blue-600 shrink-0"
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {emp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {emp.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                            {emp.employee_code}
                          </span>
                          {emp.department && (
                            <>
                              <span className="text-slate-300 text-[10px]">•</span>
                              <span className="text-[11px] text-slate-500 truncate">{emp.department}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Select
                          value={currentShift || settings.defaultShift}
                          onValueChange={(v) => handleEmployeeShiftChange(emp.employee_code, v as ShiftTime)}
                        >
                          <SelectTrigger className="h-8 w-[100px] text-xs font-semibold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRESET_SHIFTS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isCustom && (
                          <button
                            onClick={() => handleClearEmployeeShift(emp.employee_code)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                            title="Reset to default shift"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Sticky Save Bar (Mobile) */}
      {hasChanges && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3 sm:hidden shadow-lg">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <AlertTriangle className="w-4 h-4" />
            Unsaved changes
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
