import { getStoredLeaves, getStoredUsers, getStoredPermissions, PermissionRequest } from '@/lib/storage';
import { LeaveRequest, User } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Clock, FileText, UserCheck, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatCards } from '@/components/StatCards';
import { Link } from 'wouter';

import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [l, p] = await Promise.all([getStoredLeaves(), getStoredPermissions()]);
        const u = getStoredUsers();
        if (!mounted) return;
        setLeaves(l);
        setPermissions(p);
        setUsers(u);
      } catch (err) {
        console.error('Error loading dashboard data', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const pendingCount = leaves.filter(l => l.status === 'Pending').length + permissions.filter(p => p.status === 'Pending').length;
  const approvedCount = leaves.filter(l => l.status === 'Approved').length + permissions.filter(p => p.status === 'Approved').length;
  const rejectedCount = leaves.filter(l => l.status === 'Rejected').length + permissions.filter(p => p.status === 'Rejected').length;
  const employeesCount = users.filter(u => u.role === 'Employee').length;
  const departmentsCount = new Set(users.map(u => (u as any).department).filter(Boolean)).size;

  return (
    <div className="space-y-5 sm:space-y-8 pt-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-1">Admin Dashboard</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Overview of organization performance</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search Employee, Code, or Dept..."
            className="pl-10 h-11 bg-white border-slate-200 text-slate-900 focus:border-primary/50 text-sm"
          />
        </div>
      </div>

      <StatCards stats={[
        { label: 'Total Employees', value: employeesCount, type: 'info' },
        { label: 'Departments', value: departmentsCount, type: 'info' },
        { label: 'Pending Requests', value: pendingCount, type: 'pending' },
        { label: 'Approved', value: approvedCount, type: 'approved' },
        { label: 'Rejected', value: rejectedCount, type: 'rejected' },
      ]} />

      {/* Biometric Attendance & Late Arrivals Quick Access Card */}
      <Link href="/admin/attendance-report">
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-blue-800/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-400/30">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Attendance & Late Comers Report</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE PAYROLL
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                View biometric punch-in times, grace period expiry, late arrivals, approved leaves, and repeated issues.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-white shrink-0">
            Open Attendance Report
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </Link>

      {/* Quick Actions or Recent Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-lg sm:text-xl text-slate-900">Recent Pending Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-2">
            {pendingCount === 0 ? (
              <div className="text-slate-500 py-6 text-center text-sm italic">No pending requests</div>
            ) : (
              <div className="space-y-3">
                {[
                  ...leaves.filter(l => l.status === 'Pending').map(l => ({ ...l, kind: 'leave' })),
                  ...permissions.filter(p => p.status === 'Pending').map(p => ({ ...p, kind: 'permission' }))
                ]
                  .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime())
                  .slice(0, 5)
                  .map(request => (
                    <div key={`${(request as any).kind}-${request.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100/50 gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-full shrink-0 ${(request as any).kind === 'leave' ? 'bg-blue-500/10 text-[#3B82F6]' : 'bg-amber-500/10 text-[#F59E0B]'}`}>
                          {(request as any).kind === 'leave' ? <FileText className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-900 font-semibold text-sm truncate">{request.employeeName}</p>
                          <p className="text-xs text-slate-500 font-medium truncate">
                            {(request as any).kind === 'leave' ? `${request.type} Leave` : request.type}
                            {(request as any).duration ? ` • ${(request as any).duration}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs sm:text-right text-slate-500 font-medium shrink-0 pl-11 sm:pl-0">
                        <span>{(request as any).startDate || (request as any).startTime}</span>
                        <p className="text-[10px] opacity-70 text-slate-400">{request.appliedDate}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
