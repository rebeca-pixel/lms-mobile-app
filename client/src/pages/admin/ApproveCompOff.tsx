import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getPendingCompOffRequests, adminActionCompOff, hrActionCompOff, CompOffRequest } from '@/lib/compoff';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Approved: 'bg-green-50 text-green-700 border-green-200',
    Rejected: 'bg-red-50 text-red-700 border-red-200',
  };
  return <Badge variant="outline" className={`font-medium text-xs ${map[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{status}</Badge>;
}

export default function ApproveCompOff() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<CompOffRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);

  const isHR = user?.role === 'HR';
  const myRoleLabel = isHR ? 'HR' : 'Admin';

  const load = async () => {
    const pending = await getPendingCompOffRequests();
    setRequests(pending);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (req: CompOffRequest, status: 'Approved' | 'Rejected', asRole?: 'Admin' | 'HR', reason?: string) => {
    if (!user) return;
    const actionBy = `${user.code} (${user.name})`;
    const targetRole = asRole || (isHR ? 'HR' : 'Admin');
    try {
      if (targetRole === 'HR') {
        await hrActionCompOff(req.id, status, actionBy, reason);
      } else {
        await adminActionCompOff(req.id, status, actionBy, reason);
      }
      toast({
        title: `Comp Off ${status} (${targetRole})`,
        description: status === 'Approved'
          ? 'Approval recorded. 1 day credited if both Admin and HR have approved.'
          : 'Request rejected.',
        className: status === 'Approved'
          ? 'bg-green-500/10 border-green-500/20 text-green-700 font-medium'
          : 'bg-red-500/10 border-red-500/20 text-red-700 font-medium',
      });
      setRejectReason('');
      load();
    } catch (err) {
      toast({ title: 'Action failed', description: (err as any)?.message || 'Could not record action.', variant: 'destructive' });
    }
  };

  const filtered = requests.filter(r =>
    r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Approve Comp Off Requests</h2>
          <p className="text-slate-600">Both Admin and HR must approve before Comp Off days are credited.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by Name or Code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-slate-200 text-slate-900"
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-bold">⚠️ Dual approval required: Comp Off is credited only after BOTH Admin and HR approve.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-100 italic">
            No pending Comp Off requests found.
          </div>
        ) : (
          filtered.map((r) => (
            <Card key={r.id} className="bg-white border-slate-200 hover:border-primary/50 transition-all duration-300 shadow-sm rounded-xl">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-6">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900">{r.employeeName} ({r.employeeCode})</h3>
                      <Badge variant="secondary" className="bg-slate-50 border-slate-200 text-slate-700 text-xs">{r.compOffDays} day(s)</Badge>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 font-medium">
                      <span className="text-slate-400">Earned:</span> {r.earnedStartDate} to {r.earnedEndDate} &nbsp;|&nbsp;
                      <span className="text-slate-400"> Applied:</span> {r.appliedDate}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                      <span>Admin: {statusBadge(r.adminStatus)}</span>
                      <span>HR: {statusBadge(r.hrStatus)}</span>
                      <span className="font-semibold text-slate-600">Final: {r.finalStatus}</span>
                    </div>
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs sm:text-sm text-slate-600 italic">"{r.reason}"</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-2 w-full md:w-48 shrink-0 justify-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {r.adminStatus === 'Pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(r, 'Approved', 'Admin')}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold w-full h-11 sm:h-10 text-sm"
                      >
                        <Check className="w-4 h-4 mr-1.5" /> Approve as Admin
                      </Button>
                    )}
                    {r.hrStatus === 'Pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(r, 'Approved', 'HR')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full h-11 sm:h-10 text-sm"
                      >
                        <Check className="w-4 h-4 mr-1.5" /> Approve as HR
                      </Button>
                    )}
                    {r.finalStatus !== 'Rejected' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 font-bold w-full h-11 sm:h-10 text-sm">
                            <X className="w-4 h-4 mr-1.5" /> Reject Request
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] sm:max-w-md bg-white border-slate-200">
                          <DialogHeader>
                            <DialogTitle className="text-slate-900">Reject Comp Off Request</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">Please provide a reason. This will be visible to the employee.</DialogDescription>
                          </DialogHeader>
                          <div className="py-3">
                            <Label className="text-slate-700 font-bold text-xs mb-2 block">Rejection Reason</Label>
                            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="bg-white border-slate-200 text-slate-900 mt-1 min-h-[80px]" />
                          </div>
                          <DialogFooter className="flex-row justify-end gap-2">
                            <Button variant="outline" className="border-slate-200">Cancel</Button>
                            <DialogClose asChild>
                              <Button onClick={() => handleAction(r, 'Rejected', isHR ? 'HR' : 'Admin', rejectReason)} disabled={!rejectReason} className="bg-red-600 hover:bg-red-700 text-white font-bold">Confirm Rejection</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
