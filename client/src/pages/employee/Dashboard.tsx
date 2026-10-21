import { useAuth } from '@/context/AuthContext';
import { getStoredLeaves, getLeaveBalance, getStoredPermissions } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, XCircle, Lock, Briefcase } from 'lucide-react';
import { StatCards } from '@/components/StatCards';
import '@/components/DashboardButtons.css';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Permission from './Permission';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        const allLeaves = await getStoredLeaves();
        const matchedLeaves = allLeaves.filter((l: any) => (
          l.employeeCode === user.code ||
          l.employeeId === user.id ||
          l.employeeCode === user.id ||
          l.employeeId === user.code
        ));
        setLeaves(matchedLeaves);

        const allPermissions = await getStoredPermissions();
        const matchedPermissions = allPermissions.filter((p: any) => (
          p.employeeCode === user.code ||
          p.employeeId === user.id ||
          p.employeeCode === user.id ||
          p.employeeId === user.code
        ));
        setPermissions(matchedPermissions);
        const leaveBalance = await getLeaveBalance(user.code, user.id);
        setBalance(leaveBalance);
      }
      setLoading(false);
    };
    loadData();
  }, [user]);

  // include both leaves and permissions in counts so employees see overall totals
  const pending = leaves.filter(l => l.status === 'Pending').length + permissions.filter(p => p.status === 'Pending').length;
  const approved = leaves.filter(l => l.status === 'Approved').length + permissions.filter(p => p.status === 'Approved').length;
  const rejected = leaves.filter(l => l.status === 'Rejected').length + permissions.filter(p => p.status === 'Rejected').length;

  // Determine current active leave (today between start and end) or most recent request
  const today = new Date();
  const currentLeave = leaves.find(l => {
    try {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      return s <= today && today <= e;
    } catch (e) {
      return false;
    }
  });

  const mostRecent = ([...leaves, ...permissions]
    .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime())[0]) || null;

  return (
    <div className="space-y-5 sm:space-y-8 pt-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight mb-1">
            Welcome, {user?.name ? user.name.split(' ')[0] : 'Employee'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Here's an overview of your leave status</p>
        </div>
        <div className="dashboard-actions w-full sm:w-auto">
          <button
            onClick={() => setShowPermissionModal(true)}
            className="btn-premium-primary"
          >
            <Lock className="btn-icon" />
            Request Permission
          </button>
          <Link href="/employee/apply-leave" className="w-full sm:w-auto">
            <button className="btn-premium-secondary w-full">
              <Briefcase className="btn-icon" />
              Apply New Leave
            </button>
          </Link>
        </div>
      </div>

      <Dialog open={showPermissionModal} onOpenChange={setShowPermissionModal}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-slate-200 shadow-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Lock className="w-5 h-5 text-orange-500" />
              Request Permission
            </DialogTitle>
          </DialogHeader>
          <Permission onClose={() => setShowPermissionModal(false)} />
        </DialogContent>
      </Dialog>

      {/* Current Request summary */}
      <div className="mb-2 sm:mb-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Current Request</p>
                {currentLeave ? (
                  <p className="text-slate-900 font-bold text-base sm:text-lg">{currentLeave.type} — {currentLeave.status}</p>
                ) : mostRecent ? (
                  <p className="text-slate-900 font-bold text-base sm:text-lg">{mostRecent.type || mostRecent.title} — {mostRecent.status}</p>
                ) : (
                  <p className="text-slate-500 italic text-sm">No active requests</p>
                )}
              </div>
              <div className="flex items-center self-start sm:self-auto">
                {currentLeave ? (
                  <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold border ${currentLeave.status === 'Approved' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                    currentLeave.status === 'Rejected' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                      'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                    }`}>{currentLeave.status}</span>
                ) : mostRecent ? (
                  <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold border ${mostRecent.status === 'Approved' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                    mostRecent.status === 'Rejected' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                      'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                    }`}>{mostRecent.status}</span>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <StatCards stats={[
        {
          label: 'Leave Quota',
          value: `${balance?.total?.remaining ?? 15} Days`,
          type: 'quota',
          subtext: `Casual: ${balance?.casual?.remaining ?? 2}/2 | Sick: ${balance?.sick?.remaining ?? 3}/3 | Priv: ${balance?.privilege?.remaining ?? 10}/10`
        },
        { label: 'Pending', value: pending, type: 'pending' },
        { label: 'Approved', value: approved, type: 'approved' },
        { label: 'Rejected', value: rejected, type: 'rejected' },
      ]} />

      <div className="space-y-4">
        <h3 className="text-xl font-display font-semibold text-slate-900">Recent Activity</h3>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {(leaves.length + permissions.length) === 0 ? (
            <div className="p-8 text-center text-slate-500 italic">No leave or permission history found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* merge leaves and permissions into a single recent activity feed */}
              {([
                ...leaves.map(l => ({
                  ...l,
                  kind: 'leave',
                  title: `${l.type} Leave`,
                  sortDate: l.appliedDate,
                })),
                ...permissions.map(p => ({
                  ...p,
                  kind: 'permission',
                  title: p.type,
                  sortDate: p.appliedDate,
                }))
              ] as any)
                .sort((a: any, b: any) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
                .slice(0, 5)
                .map((item: any) => (
                  <div key={`${item.kind}-${item.id}`} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${item.status === 'Approved' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                        item.status === 'Rejected' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                          'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                        }`}>
                        {item.status === 'Approved' ? <CheckCircle2 className="w-5 h-5" /> :
                          item.status === 'Rejected' ? <XCircle className="w-5 h-5" /> :
                            <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-slate-900 font-semibold">{item.title}</p>
                        {item.kind === 'leave' ? (
                          <p className="text-sm text-slate-500 font-medium">{format(new Date(item.startDate), 'MMM dd, yyyy')} - {item.duration}</p>
                        ) : (
                          <p className="text-sm text-slate-500 font-medium">{item.startTime} - {item.endTime}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.status === 'Approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        item.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}>{item.status}</span>
                      <p className="text-xs text-slate-400 mt-1 font-medium">Applied: {format(new Date(item.appliedDate), 'MMM dd')}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
