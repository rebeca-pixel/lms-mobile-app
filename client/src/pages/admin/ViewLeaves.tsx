import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getStoredLeaves, updateLeaveStatus } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import { notifyUser } from '@/lib/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Check, X, FileText, Eye, Calendar, Clock, User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ViewLeaves() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [detailLeave, setDetailLeave] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaves = async () => {
      const allLeaves = await getStoredLeaves();
      let pending = allLeaves.filter(l => l.status === 'Pending');

      // Enrich missing employee names by querying users table in batch
      const missingIds = Array.from(new Set(
        pending
          .filter((l: any) => !l.employeeName)
          .flatMap((l: any) => [l.employeeId, l.employeeCode])
          .filter(Boolean)
      ));

      if (missingIds.length > 0) {
        try {
          const { data: usersById } = await supabase.from('users').select('user_id,name,username').in('user_id', missingIds as any[]);
          const { data: usersByUsername } = await supabase.from('users').select('user_id,name,username').in('username', missingIds as any[]);
          const users = [...(usersById || []), ...(usersByUsername || [])];

          const userMap: Record<string, any> = {};
          users.forEach((u: any) => {
            if (u.user_id) userMap[u.user_id] = u;
            if (u.username) userMap[u.username] = u;
          });

          pending = pending.map((l: any) => {
            const keyId = l.employeeId || l.employeeCode;
            const resolved = userMap[l.employeeId] || userMap[l.employeeCode] || (keyId && userMap[keyId]);
            return {
              ...l,
              employeeName: l.employeeName || (resolved ? (resolved.name || resolved.username) : ''),
            };
          });
        } catch (e) {
          console.error('Error enriching leave names in admin view:', e);
        }
      }
      setLeaves(pending);
      setLoading(false);
    };
    loadLeaves();
  }, []);

  const handleAction = async (id: string, status: 'Approved' | 'Rejected', reason?: string) => {
    console.log('ViewLeaves.handleAction', { id, status, reason, user });
    if (!user) {
      console.warn('No user in context; aborting action');
      return;
    }

    const leaveToUpdate = leaves.find(l => l.id === id);
    await updateLeaveStatus(id, status, `${user.code} (${user.name})`, reason);

    // Notify the employee of the decision
    if (leaveToUpdate && leaveToUpdate.employeeId) {
      try {
        await notifyUser(
          leaveToUpdate.employeeId,
          status === 'Approved' ? '✅ Leave Request Approved' : '❌ Leave Request Rejected',
          `Your ${leaveToUpdate.type} leave (${leaveToUpdate.startDate} to ${leaveToUpdate.endDate}) was ${status.toLowerCase()} by ${user.name}.${reason ? ` Reason: ${reason}` : ''}`,
          status === 'Approved' ? 'leave_approved' : 'leave_rejected',
          'leave',
          parseInt(id)
        );
      } catch (e) {
        console.warn('Failed to notify employee of leave status update:', e);
      }
    }

    const allLeaves = await getStoredLeaves();
    setLeaves(allLeaves.filter(l => l.status === 'Pending'));

    toast({
      title: `Leave ${status}`,
      description: `Request has been ${status.toLowerCase()}.`,
      className: status === 'Approved'
        ? "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
        : "bg-red-500/10 border-red-500/20 text-red-700 font-medium"
    });

    setRejectReason('');
    setSelectedLeaveId(null);
  };

  const filteredLeaves = leaves.filter(l =>
    l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">View Pending Leaves</h2>
          <p className="text-slate-600">Review and take action on leave requests</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by Name, Code, Type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-slate-200 text-slate-900 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Note for OD/Comp Off dual approval */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-bold">⚠️ Note: OD and Comp Off leaves require approval from both HR and Admin before they are finalized.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredLeaves.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-100 italic">
            No pending leave requests found matching your search.
          </div>
        ) : (
          filteredLeaves.map((leave) => (
            <Card key={leave.id} className="bg-white border-slate-200 hover:border-primary/50 transition-all duration-300 shadow-sm rounded-xl">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-6">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                        {leave.employeeName ? `${leave.employeeName} (${leave.employeeId || leave.employeeCode})` : (leave.employeeCode || leave.employeeId)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="bg-slate-50 border-slate-200 text-slate-700 text-xs">{leave.type}</Badge>
                        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 font-mono text-xs">{leave.employeeId || leave.employeeCode}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-sm text-slate-500 font-medium pt-1">
                      <div><span className="text-slate-400">Duration:</span> {leave.startDate} to {leave.endDate} ({leave.duration})</div>
                      <div><span className="text-slate-400">Applied:</span> {leave.appliedDate}</div>
                      {leave.duration === 'Hourly' && (leave.type === 'OD' || leave.type === 'OT') && (
                        <div><span className="text-slate-400">{leave.type} Hours:</span> {leave.odFromTime} to {leave.odToTime}</div>
                      )}
                    </div>

                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs sm:text-sm text-slate-600 italic">"{leave.description}"</p>
                    </div>

                    {leave.type === 'Comp Off' && (leave.lopDays > 0 || leave.compOffCoveredDays != null) && (
                      <div className={`mt-2 p-3 rounded-lg border text-xs sm:text-sm ${leave.lopDays > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                        {leave.lopDays > 0 ? (
                          <p>
                            <span className="font-bold">⚠️ Partial Comp Off coverage:</span>{' '}
                            {leave.compOffCoveredDays || 0} day(s) covered by approved Comp Off.{' '}
                            {leave.compOffUncoveredDates && (
                              <>Dates <span className="font-semibold">{leave.compOffUncoveredDates}</span> not covered — will be treated as LOP ({leave.lopDays} day(s)).</>
                            )}
                          </p>
                        ) : (
                          <p><span className="font-bold">✓</span> Fully covered by approved Comp Off balance ({leave.compOffCoveredDays} day(s)). No LOP.</p>
                        )}
                      </div>
                    )}

                    {leave.attachment && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <div role="button" className="flex items-center gap-1.5 text-xs text-primary mt-2 cursor-pointer hover:underline font-semibold">
                            <FileText className="w-3.5 h-3.5" />
                            View Attachment
                          </div>
                        </DialogTrigger>
                        <DialogContent className="bg-white border-slate-200 w-[95vw] sm:w-[90vw] max-w-4xl p-4 sm:p-6">
                          <DialogHeader>
                            <DialogTitle className="text-slate-900">Attachment Preview</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm text-slate-500">Preview the uploaded attachment</DialogDescription>
                          </DialogHeader>
                          <div className="py-3">
                            {leave.attachment.startsWith('data:application/pdf') ? (
                              <iframe src={leave.attachment} className="w-full h-[60vh] sm:h-[70vh] border rounded" title="attachment-pdf" />
                            ) : (
                              <img src={leave.attachment} alt="attachment" className="mx-auto max-h-[60vh] sm:max-h-[70vh] object-contain rounded" />
                            )}
                          </div>
                          <DialogFooter>
                            <a href={leave.attachment} download className="text-sm text-primary hover:underline font-medium">Download</a>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center gap-2 w-full md:w-40 shrink-0 justify-center pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <Button
                      onClick={() => setDetailLeave(leave)}
                      variant="outline"
                      className="w-full h-10 border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" /> View Details
                    </Button>

                    <div className="flex gap-2 w-full">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => setSelectedLeaveId(leave.id)}
                            className="flex-1 h-10 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1"
                            data-testid={`button-approve-${leave.id}`}
                            title={['OD', 'Comp Off'].includes(leave.type) ? 'Requires approval from both HR and Admin' : ''}
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] sm:max-w-md bg-white border-slate-200">
                          <DialogHeader>
                            <DialogTitle className="text-slate-900">Approve Leave Request</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm text-slate-500 font-medium">Are you sure you want to approve this leave request?</DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="flex-row justify-end gap-2">
                            <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-600">Cancel</Button>
                            <DialogClose asChild>
                              <Button onClick={() => handleAction(leave.id, 'Approved')} className="bg-green-600 hover:bg-green-700 text-white font-bold">Confirm Approval</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="flex-1 h-10 bg-red-50 hover:bg-red-100 text-red-700 border-red-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1"
                            data-testid={`button-reject-${leave.id}`}
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white border-slate-200 w-[95vw] sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-slate-900">Reject Leave Request</DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium text-xs sm:text-sm">
                              Please provide a reason for rejection. This will be visible to the employee.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-3">
                            <Label htmlFor="reason" className="text-slate-700 font-bold mb-1.5 block text-xs sm:text-sm">Rejection Reason</Label>
                            <Textarea
                              id="reason"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="e.g. Critical project delivery deadline..."
                              className="bg-white border-slate-200 text-slate-900 text-sm"
                            />
                          </div>
                          <DialogFooter className="flex-row justify-end gap-2">
                            <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-600">Cancel</Button>
                            <DialogClose asChild>
                              <Button
                                onClick={() => handleAction(leave.id, 'Rejected', rejectReason)}
                                disabled={!rejectReason}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                              >
                                Confirm Rejection
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Full Request Details Modal */}
      <Dialog open={!!detailLeave} onOpenChange={(open) => !open && setDetailLeave(null)}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white border-slate-200 p-4 sm:p-6">
          {detailLeave && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900">
                      {detailLeave.employeeName || 'Employee Request'}
                    </DialogTitle>
                    <p className="text-xs text-primary font-mono font-bold mt-0.5">
                      Code: {detailLeave.employeeCode || detailLeave.employeeId}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-xs">
                    Pending
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-3.5 my-2">
                {/* Outlined Info Box: Leave Type & Period */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Leave Type</span>
                      <span className="font-bold text-slate-800">{detailLeave.type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                      <span className="font-bold text-slate-800">{detailLeave.duration}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Start Date</span>
                      <span className="font-semibold text-slate-700">{detailLeave.startDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">End Date</span>
                      <span className="font-semibold text-slate-700">{detailLeave.endDate}</span>
                    </div>
                    {detailLeave.duration === 'Hourly' && (detailLeave.fromTime || detailLeave.odFromTime) && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Hourly Window</span>
                        <span className="font-mono font-bold text-slate-800">
                          {detailLeave.fromTime || detailLeave.odFromTime} - {detailLeave.toTime || detailLeave.odToTime}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Applied On</span>
                      <span className="text-slate-600">{detailLeave.appliedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Reason Outlined Box */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Reason / Justification</span>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium whitespace-pre-wrap">
                    {detailLeave.description || 'No reason provided'}
                  </p>
                </div>

                {/* Comp Off details if applicable */}
                {detailLeave.type === 'Comp Off' && (detailLeave.lopDays > 0 || detailLeave.compOffCoveredDays != null) && (
                  <div className={`p-3 rounded-xl border text-xs ${detailLeave.lopDays > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    <p className="font-bold mb-1">Comp Off Coverage Validation:</p>
                    <p>Covered Days: <strong>{detailLeave.compOffCoveredDays || 0}</strong></p>
                    {detailLeave.lopDays > 0 && (
                      <p>LOP Days: <strong className="text-red-700">{detailLeave.lopDays}</strong> ({detailLeave.compOffUncoveredDates})</p>
                    )}
                  </div>
                )}

                {/* Attachment if present */}
                {detailLeave.attachment && (
                  <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between text-xs">
                    <span className="text-blue-900 font-semibold flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-primary" /> Attachment Uploaded
                    </span>
                    <a
                      href={detailLeave.attachment}
                      download
                      className="text-primary hover:underline font-bold"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setDetailLeave(null)}
                  className="w-full sm:w-auto text-xs"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const id = detailLeave.id;
                    setDetailLeave(null);
                    handleAction(id, 'Approved');
                  }}
                  className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Approve Request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
