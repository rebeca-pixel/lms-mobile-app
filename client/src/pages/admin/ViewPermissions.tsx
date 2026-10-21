import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getStoredPermissions, updatePermissionStatus, PermissionRequest } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import { notifyUser } from '@/lib/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Check, X, Lock, Clock, Eye, Calendar, User as UserIcon } from 'lucide-react';
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

export default function ViewPermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedPermissionId, setSelectedPermissionId] = useState<string | null>(null);
  const [detailPermission, setDetailPermission] = useState<PermissionRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      const allPermissions = await getStoredPermissions();
      let pending = allPermissions.filter(p => p.status === 'Pending');

      // Enrich missing employee names by querying users table in batch (both user_id and username)
      const missingIds = Array.from(new Set(
        pending
          .filter((p: any) => !p.employeeName)
          .flatMap((p: any) => [p.employeeId, p.employeeCode])
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

          pending = pending.map((p: any) => {
            const keyId = p.employeeId || p.employeeCode;
            const resolved = userMap[p.employeeId] || userMap[p.employeeCode] || (keyId && userMap[keyId]);
            return {
              ...p,
              employeeName: p.employeeName || (resolved ? (resolved.name || resolved.username) : ''),
            };
          });
        } catch (e) {
          console.error('Error enriching permission names in admin view:', e);
        }
      }
      setPermissions(pending);
      setLoading(false);
    };
    loadPermissions();
  }, []);

  const handleAction = async (id: string, status: 'Approved' | 'Rejected', reason?: string) => {
    console.log('ViewPermissions.handleAction', { id, status, reason, user });
    if (!user) {
      console.warn('No user in context; aborting action');
      return;
    }

    const permToUpdate = permissions.find(p => p.id === id);
    await updatePermissionStatus(id, status, `${user.code} (${user.name})`, reason);

    // Notify the employee of the permission decision
    if (permToUpdate && permToUpdate.employeeId) {
      try {
        await notifyUser(
          permToUpdate.employeeId,
          status === 'Approved' ? '✅ Permission Approved' : '❌ Permission Rejected',
          `Your ${permToUpdate.type} for ${permToUpdate.date} was ${status.toLowerCase()} by ${user.name}.${reason ? ` Reason: ${reason}` : ''}`,
          status === 'Approved' ? 'permission_approved' : 'permission_rejected',
          'permission',
          parseInt(id)
        );
      } catch (e) {
        console.warn('Failed to notify employee of permission decision:', e);
      }
    }

    const allPermissions = await getStoredPermissions();
    setPermissions(allPermissions.filter(p => p.status === 'Pending'));

    toast({
      title: `Permission ${status}`,
      description: `Request has been ${status.toLowerCase()}.`,
      className: status === 'Approved'
        ? "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
        : "bg-red-500/10 border-red-500/20 text-red-700 font-medium"
    });

    setRejectReason('');
    setSelectedPermissionId(null);
  };

  const filteredPermissions = permissions.filter(p =>
    p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPermissionTypeColor = (type: string) => {
    switch (type) {
      case 'Late Entry Permission':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Early Exit Permission':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Personal Work Permission':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Emergency Permission':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">View Pending Permissions</h2>
          <p className="text-slate-600">Review and take action on permission requests</p>
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

      <div className="grid grid-cols-1 gap-4">
        {filteredPermissions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            No pending permission requests found.
          </div>
        ) : (
          filteredPermissions.map((permission) => (
            <Card key={permission.id} className="bg-white border-slate-200 hover:border-primary/50 transition-all duration-300 shadow-sm rounded-xl">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900 text-base sm:text-lg">{permission.employeeName ? `${permission.employeeName} (${permission.employeeId || permission.employeeCode})` : (permission.employeeCode || permission.employeeId)}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={`${getPermissionTypeColor(permission.type)} border text-xs`}>{permission.type}</Badge>
                          {permission.isLOPApplicable && (
                            <Badge className="bg-yellow-500/20 text-yellow-700 border border-yellow-500/30 font-semibold text-xs">
                              LOP Applicable
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-primary border-primary/20 text-xs font-mono">{permission.employeeId || permission.employeeCode}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 px-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Perm Date</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">{permission.date}</p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Start Time</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">{permission.startTime}</p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium">End Time</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">{permission.endTime}</p>
                    </div>
                    <div>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Duration</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">
                        {permission.durationMinutes ? `${Math.floor(permission.durationMinutes / 60)}h ${permission.durationMinutes % 60}m` : '-'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs sm:text-sm font-medium text-slate-700 mb-1">Reason:</p>
                    <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-100">{permission.reason}</p>
                  </div>

                  {permission.additionalInfo && (
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-slate-700 mb-1">Additional Info:</p>
                      <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-100">{permission.additionalInfo}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-slate-100">
                    <Button
                      onClick={() => setDetailPermission(permission)}
                      variant="outline"
                      className="w-full sm:w-auto h-10 border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Eye className="w-4 h-4" /> View Details
                    </Button>

                    <div className="flex gap-2 flex-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => setSelectedPermissionId(permission.id)}
                            className="flex-1 h-10 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] sm:max-w-md bg-white border-slate-200">
                          <DialogHeader>
                            <DialogTitle className="text-slate-900">Approve Permission Request</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm text-slate-600">
                              Employee: <span className="text-primary font-semibold">{permission.employeeName}</span>
                            </DialogDescription>
                          </DialogHeader>
                          <p className="text-xs sm:text-sm text-slate-600">Are you sure you want to approve this permission request?</p>
                          <DialogFooter className="flex-row justify-end gap-2">
                            <Button
                              variant="outline"
                              className="text-slate-600 border-slate-200 hover:bg-slate-50 text-xs"
                            >
                              Cancel
                            </Button>
                            <DialogClose asChild>
                              <Button
                                onClick={() => handleAction(permission.id, 'Approved')}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs"
                              >
                                Confirm Approval
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => setSelectedPermissionId(permission.id)}
                            className="flex-1 h-10 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white border-slate-200 w-[95vw] sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-slate-900">Reject Permission Request</DialogTitle>
                            <DialogDescription className="text-slate-600 text-xs sm:text-sm">
                              Employee: <span className="text-primary font-semibold">{permission.employeeName}</span>
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <Label className="text-slate-700 font-medium text-xs sm:text-sm">Reason for Rejection (Optional)</Label>
                            <Textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Provide a reason for rejection..."
                              className="bg-white border-slate-200 text-slate-900 text-sm"
                            />
                          </div>
                          <DialogFooter className="flex-row justify-end gap-2">
                            <Button
                              variant="outline"
                              className="text-slate-600 border-slate-200 hover:bg-slate-50 text-xs"
                            >
                              Cancel
                            </Button>
                            <DialogClose asChild>
                              <Button
                                onClick={() => handleAction(permission.id, 'Rejected', rejectReason)}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
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

      {/* Full Permission Details Modal */}
      <Dialog open={!!detailPermission} onOpenChange={(open) => !open && setDetailPermission(null)}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white border-slate-200 p-4 sm:p-6">
          {detailPermission && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900">
                      {detailPermission.employeeName || 'Permission Request'}
                    </DialogTitle>
                    <p className="text-xs text-primary font-mono font-bold mt-0.5">
                      Code: {detailPermission.employeeCode || detailPermission.employeeId}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-xs">
                    Pending
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-3.5 my-2">
                {/* Outlined Info Box: Type, Timing, Date */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Permission Type</span>
                      <span className="font-bold text-slate-800">{detailPermission.type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                      <span className="font-bold text-slate-800">{detailPermission.date}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Time Window</span>
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {detailPermission.startTime} - {detailPermission.endTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                      <span className="font-semibold text-slate-700">
                        {detailPermission.durationMinutes ? `${detailPermission.durationMinutes} minutes` : 'Up to 2 hours'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Applied On</span>
                      <span className="text-slate-600">{detailPermission.appliedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Reason Outlined Box */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Reason / Justification</span>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium whitespace-pre-wrap">
                    {detailPermission.reason || 'No reason provided'}
                  </p>
                </div>

                {/* Additional info if present */}
                {detailPermission.additionalInfo && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Additional Information</span>
                    <p className="text-xs sm:text-sm text-slate-700">
                      {detailPermission.additionalInfo}
                    </p>
                  </div>
                )}

                {/* LOP Warning badge if applicable */}
                {detailPermission.isLOPApplicable && (
                  <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs">
                    <p className="font-bold">⚠️ Monthly Permission Limit Reached</p>
                    <p className="text-[11px] text-red-600 mt-0.5">This employee has exceeded standard monthly permissions and is subject to LOP.</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setDetailPermission(null)}
                  className="w-full sm:w-auto text-xs"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const id = detailPermission.id;
                    setDetailPermission(null);
                    handleAction(id, 'Approved');
                  }}
                  className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Approve Permission
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
