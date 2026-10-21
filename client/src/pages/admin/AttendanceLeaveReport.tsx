import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import {
  fetchAttendanceReportData,
  exportAttendanceReportToPDF,
  exportAttendanceReportToWord,
  saveEmployeeShift,
  EmployeeAttendanceRow,
  AttendanceReportSummary,
  ShiftTime,
  formatTime12h,
} from '@/lib/attendanceReport';
import {
  Calendar,
  Clock,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Database,
  Users,
  Settings,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function AttendanceLeaveReport() {
  const { toast } = useToast();
  // Default to today's date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [rows, setRows] = useState<EmployeeAttendanceRow[]>([]);
  const [summary, setSummary] = useState<AttendanceReportSummary | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [repeatOnlyFilter, setRepeatOnlyFilter] = useState<boolean>(false);

  // Load report data
  const loadData = async (date: string) => {
    setIsLoading(true);
    try {
      const data = await fetchAttendanceReportData(date);
      setRows(data.rows);
      setSummary(data.summary);
    } catch (err: any) {
      console.error('Error loading attendance report:', err);
      toast({
        title: 'Error loading data',
        description: err.message || 'Failed to fetch attendance logs from payroll database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  // Handle single employee shift change
  const handleShiftChange = (empCode: string, newShift: ShiftTime) => {
    saveEmployeeShift(empCode, newShift);
    setRows((prev) =>
      prev.map((r) => {
        if (r.employeeCode !== empCode) return r;
        const shiftMinutes = newShift === '09:30' ? 9 * 60 + 30 : newShift === '10:00' ? 10 * 60 : 11 * 60;
        const graceExpiry = shiftMinutes + 15;
        let isLate = false;
        let lateMinutes = 0;
        if (r.firstPunch) {
          const parts = r.firstPunch.split(':');
          const punchMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          if (punchMins > graceExpiry) {
            isLate = true;
            lateMinutes = punchMins - shiftMinutes;
          }
        }
        let attendanceStatus = r.attendanceStatus;
        if (r.firstPunch) {
          attendanceStatus = isLate ? 'Late Arrival' : 'On Time';
        }
        return {
          ...r,
          shiftTime: newShift,
          isLate,
          lateMinutes,
          attendanceStatus,
        };
      })
    );
    toast({
      title: 'Shift Updated',
      description: `Shift start for ${empCode} set to ${formatTime12h(newShift)}.`,
    });
  };

  // Change date helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.department && r.department.trim()) set.add(r.department.trim());
    });
    return Array.from(set).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.department.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (departmentFilter !== 'all' && r.department !== departmentFilter) {
        return false;
      }

      if (repeatOnlyFilter && !r.hasRepeatedIssue) {
        return false;
      }

      if (statusFilter === 'all') return true;
      if (statusFilter === 'late') return r.isLate;
      if (statusFilter === 'ontime') return r.attendanceStatus === 'On Time';
      if (statusFilter === 'leave') return r.attendanceStatus === 'Approved Leave' || r.attendanceStatus === 'Pending Leave';
      if (statusFilter === 'permission') return r.attendanceStatus === 'Approved Permission';
      if (statusFilter === 'absent') return r.attendanceStatus === 'Absent';
      if (statusFilter === 'late_requests') return !!r.lateApplicationTag;

      return true;
    });
  }, [rows, searchTerm, statusFilter, departmentFilter, repeatOnlyFilter]);

  // Identify late leave/permission applications for alert banner
  const lateApplications = useMemo(() => {
    return rows.filter((r) => !!r.lateApplicationTag);
  }, [rows]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Payroll DB Integration
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-slate-200">
                <Database className="w-3.5 h-3.5 text-blue-300" />
                attendance_logs
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Attendance & Leave Report
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Live biometric punch analysis compared against employee shift timings (9:30 AM, 10:00 AM, 11:00 AM) with a 15-minute grace period, coupled with approved/pending leave and permission logs.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link href="/admin/attendance-settings">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 cursor-pointer transition-all shadow-sm"
              >
                <Settings className="w-4 h-4 text-amber-300" />
                Settings
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => summary && exportAttendanceReportToPDF(rows, summary, selectedDate)}
              disabled={isLoading || rows.length === 0}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 cursor-pointer transition-all shadow-sm"
            >
              <Download className="w-4 h-4 text-rose-300" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => summary && exportAttendanceReportToWord(rows, summary, selectedDate)}
              disabled={isLoading || rows.length === 0}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 cursor-pointer transition-all shadow-sm"
            >
              <FileText className="w-4 h-4 text-blue-300" />
              Download Word (.docx)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(selectedDate)}
              disabled={isLoading}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Date Selector Row */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevDay}
              className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/15"
              title="Previous Day"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-3 h-9 bg-white/10 border-white/20 text-white font-medium rounded-lg text-sm w-44 focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextDay}
              className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/15"
              title="Next Day"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-9 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs px-3"
            >
              Today
            </Button>
          </div>

          <div className="text-xs text-slate-300 flex items-center gap-4">
            <span>
              Selected Date: <strong className="text-white font-semibold">{selectedDate}</strong>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">
              Grace Period: <strong className="text-emerald-300">15 Minutes</strong> (Late marked only after expiration)
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Staff</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {summary?.totalEmployees ?? '—'}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">On Time</p>
              <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary?.onTimeCount ?? '—'}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Late Arrivals</p>
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400">
                {summary?.lateCount ?? '—'}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved Leave</p>
              <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {summary?.approvedLeaveCount ?? '—'}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Leave</p>
              <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {summary?.pendingLeaveCount ?? '—'}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Repeat Issues</p>
              <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {summary?.repeatedIssuesCount ?? '—'}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Late Application Alerts Banner (if any) */}
      {lateApplications.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                Late Leave / Permission Requests Identified Today ({lateApplications.length})
              </h4>
              <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                The following employees submitted leave or permission requests late (e.g. after shift commencement, short notice, or retrospectively after the date):
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lateApplications.map((emp) => (
                  <span
                    key={emp.employeeCode}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-200/80 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700"
                  >
                    <strong>{emp.name} ({emp.employeeCode})</strong>: {emp.lateApplicationTag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search by employee name, ID or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900"
              />
            </div>

            {/* Quick Segment Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={statusFilter === 'all' && !repeatOnlyFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setRepeatOnlyFilter(false);
                }}
                className="h-8 text-xs cursor-pointer"
              >
                All ({rows.length})
              </Button>
              <Button
                variant={statusFilter === 'late' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('late');
                  setRepeatOnlyFilter(false);
                }}
                className={`h-8 text-xs cursor-pointer ${
                  statusFilter === 'late' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 hover:bg-red-50'
                }`}
              >
                Late ({summary?.lateCount ?? 0})
              </Button>
              <Button
                variant={statusFilter === 'ontime' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('ontime');
                  setRepeatOnlyFilter(false);
                }}
                className={`h-8 text-xs cursor-pointer ${
                  statusFilter === 'ontime'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                On Time ({summary?.onTimeCount ?? 0})
              </Button>
              <Button
                variant={statusFilter === 'leave' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('leave');
                  setRepeatOnlyFilter(false);
                }}
                className="h-8 text-xs cursor-pointer"
              >
                Leaves ({summary?.approvedLeaveCount ?? 0})
              </Button>
              <Button
                variant={repeatOnlyFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setRepeatOnlyFilter(!repeatOnlyFilter);
                  setStatusFilter('all');
                }}
                className={`h-8 text-xs cursor-pointer ${
                  repeatOnlyFilter
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'text-orange-600 hover:bg-orange-50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                Repeated Issues ({summary?.repeatedIssuesCount ?? 0})
              </Button>

              {/* Department Dropdown */}
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-3">Department</th>
                <th className="py-3.5 px-3">Shift Start</th>
                <th className="py-3.5 px-3">Punch-In Time</th>
                <th className="py-3.5 px-3">Late Duration</th>
                <th className="py-3.5 px-4">Status & Leave Details</th>
                <th className="py-3.5 px-4">30-Day Repeat History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Fetching live attendance logs from payroll database...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No employees matched the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((emp) => {
                  const isRepeatedLate = emp.repeatLateCount >= 3;
                  const isRepeatedPerm = emp.repeatPermissionCount >= 2;
                  const isRepeatedLeave = emp.repeatLeaveCount >= 3;

                  return (
                    <tr
                      key={emp.employeeCode}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        emp.isLate ? 'bg-red-50/30 dark:bg-red-950/10' : ''
                      } ${emp.hasRepeatedIssue ? 'border-l-4 border-l-orange-500' : ''}`}
                    >
                      {/* Employee Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {emp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                              {emp.name}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              {emp.employeeCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Department & Designation */}
                      <td className="py-3.5 px-3">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {emp.department || '—'}
                        </p>
                        {emp.designation && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                            {emp.designation}
                          </p>
                        )}
                      </td>

                      {/* Shift Start Dropdown */}
                      <td className="py-3.5 px-3">
                        <Select
                          value={emp.shiftTime}
                          onValueChange={(val) => handleShiftChange(emp.employeeCode, val as ShiftTime)}
                        >
                          <SelectTrigger className="w-[105px] h-8 text-xs font-semibold bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="09:30">09:30 AM</SelectItem>
                            <SelectItem value="10:00">10:00 AM</SelectItem>
                            <SelectItem value="11:00">11:00 AM</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Punch-In Time */}
                      <td className="py-3.5 px-3">
                        {emp.firstPunch ? (
                          <div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                              {formatTime12h(emp.firstPunch)}
                            </span>
                            {emp.totalPunches > 1 && (
                              <span className="block text-[11px] text-slate-500 mt-0.5">
                                {emp.totalPunches} punches (last {formatTime12h(emp.lastPunch)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium italic">No punch log</span>
                        )}
                      </td>

                      {/* Late Duration */}
                      <td className="py-3.5 px-3">
                        {emp.firstPunch ? (
                          emp.isLate ? (
                            <div className="inline-flex flex-col">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                                <Clock className="w-3 h-3" />
                                {emp.lateMinutes} min late
                              </span>
                              <span className="text-[10px] text-slate-500 mt-0.5">
                                Grace expired at {formatTime12h(emp.shiftTime === '09:30' ? '09:45' : emp.shiftTime === '10:00' ? '10:15' : '11:15')}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              On Time
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Status & Leave / Permission details */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {emp.attendanceStatus === 'Approved Leave' && (
                            <Badge className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-xs font-semibold">
                              Approved Leave ({emp.leaveInfo?.type})
                            </Badge>
                          )}
                          {emp.attendanceStatus === 'Pending Leave' && (
                            <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs font-semibold">
                              Pending Leave Approval
                            </Badge>
                          )}
                          {emp.attendanceStatus === 'Approved Permission' && (
                            <Badge className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-xs font-semibold">
                              Permission: {formatTime12h(emp.permissionInfo?.fromTime || null)} – {formatTime12h(emp.permissionInfo?.toTime || null)}
                            </Badge>
                          )}
                          {emp.attendanceStatus === 'Absent' && (
                            <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 text-xs">
                              Absent / Not Punched In
                            </Badge>
                          )}
                          {emp.firstPunch && !emp.isLate && (
                            <span className="text-xs text-slate-500 block">
                              Punched within 15m grace window
                            </span>
                          )}

                          {/* Late Application Alert Tag */}
                          {emp.lateApplicationTag && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="truncate">{emp.lateApplicationTag}</span>
                            </div>
                          )}

                          {/* Leave / Perm Reason preview */}
                          {emp.leaveInfo?.reason && (
                            <p className="text-[11px] text-slate-500 italic truncate max-w-xs">
                              "{emp.leaveInfo.reason}"
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 30-Day Repeat History Counts */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Late Count Pill */}
                          <span
                            title="Total late arrivals in last 30 days"
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              isRepeatedLate
                                ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Late: <strong>{emp.repeatLateCount}</strong>
                          </span>

                          {/* Permission Count Pill */}
                          <span
                            title="Total permissions taken in last 30 days"
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              isRepeatedPerm
                                ? 'bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Perm: <strong>{emp.repeatPermissionCount}</strong>
                          </span>

                          {/* Leave Count Pill */}
                          <span
                            title="Total leaves taken in last 30 days"
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              isRepeatedLeave
                                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Leave: <strong>{emp.repeatLeaveCount}</strong>
                          </span>

                          {/* Frequent Issue Flag */}
                          {emp.hasRepeatedIssue && (
                            <span
                              className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800"
                              title="Flagged for repeated late arrivals or frequent absence"
                            >
                              ⚠️ Frequent
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
