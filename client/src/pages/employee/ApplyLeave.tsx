import { useForm } from 'react-hook-form';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { addLeaveRequest, getLeaveBalance, getStoredLeaves, checkLeaveConflict, LeaveBalance, LeaveRequest } from '@/lib/storage';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { validateCompOffCoverage, consumeCompOffForLeave, getCompOffBalance, CompOffCoverage } from '@/lib/compoff';
import { notifyUser, notifyAdminAndHR } from '@/lib/notifications';
import { supabase } from '@/lib/supabaseClient';
import { notifyLeaveApplication } from '@/lib/pushNotifications';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const leaveSchema = z.object({
  type: z.enum(['Casual', 'Sick', 'OD', 'Comp Off', 'Privilege', 'LWP', 'Earned', 'OT']),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  duration: z.enum(['Full Day', 'Half Day', 'Hourly']).optional(),
  fromTime: z.string().optional(),
  toTime: z.string().optional(),
  description: z.string().min(5, "Reason is required"),
})
  .refine((data) => {
    // End date must not be earlier than start date
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  }, {
    message: "End date cannot be earlier than start date",
    path: ["endDate"],
  })
  .refine((data) => {
    // Hourly request is single day only
    if (data.duration === 'Hourly' || data.type === 'OT') {
      if (data.startDate && data.endDate) {
        return data.startDate === data.endDate;
      }
    }
    return true;
  }, {
    message: "Hourly OD / OT must be for a single date (Start Date and End Date must be the same)",
    path: ["endDate"],
  })
  .refine((data) => {
    // If Hourly is selected, fromTime and toTime are required
    if (data.duration === 'Hourly' || data.type === 'OT') {
      return !!data.fromTime && !!data.toTime;
    }
    return true;
  }, {
    message: "From Time and To Time are required for Hourly request (OD / OT)",
    path: ["fromTime"],
  })
  .refine((data) => {
    // End time must be strictly after start time
    if ((data.duration === 'Hourly' || data.type === 'OT') && data.fromTime && data.toTime) {
      const [fH, fM] = data.fromTime.split(':').map(Number);
      const [tH, tM] = data.toTime.split(':').map(Number);
      return (tH * 60 + tM) > (fH * 60 + fM);
    }
    return true;
  }, {
    message: "End time (To Time) must be strictly after start time (From Time)",
    path: ["toTime"],
  });

const permissionSchema = z.object({
  permissionType: z.enum(['Official', 'Personal']).optional(),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  reason: z.string().min(5, "Reason is required"),
});

type LeaveForm = z.infer<typeof leaveSchema>;
type PermissionForm = z.infer<typeof permissionSchema>;

export default function ApplyLeave() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [attachment, setAttachment] = useState<{
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [compOffCoverage, setCompOffCoverage] = useState<CompOffCoverage | null>(null);
  const [compOffBalanceDays, setCompOffBalanceDays] = useState<number | null>(null);
  const [lopConfirmOpen, setLopConfirmOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{ data: LeaveForm; coverage: CompOffCoverage } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isEmergencyPrivilege, setIsEmergencyPrivilege] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);

  const getMinPrivilegeDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  };

  const getStartDateMin = () => {
    if (watchedLeaveType === 'Privilege' && !isEmergencyPrivilege) {
      return getMinPrivilegeDateString();
    }
    return undefined;
  };

  const getEndDateMin = () => {
    if (watchedStartDate) return watchedStartDate;
    if (watchedLeaveType === 'Privilege' && !isEmergencyPrivilege) {
      return getMinPrivilegeDateString();
    }
    return undefined;
  };

  const fetchBalance = () => {
    if (user) {
      getLeaveBalance(user.code, user.id).then(setBalance);
    }
  };

  const fetchMyLeaves = () => {
    if (user) {
      getStoredLeaves().then((all) => {
        const mine = all.filter(
          (l) =>
            l.employeeId === user.id ||
            l.employeeCode === user.code ||
            l.employeeId === user.code ||
            l.employeeCode === user.id
        );
        setMyLeaves(mine);
      });
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchMyLeaves();
    getCompOffBalance(user?.id || '').then(b => setCompOffBalanceDays(b.remainingDays));
    // Refresh every 30 seconds to pick up newly approved leaves
    const interval = setInterval(() => {
      fetchBalance();
      fetchMyLeaves();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      type: 'Casual',
      duration: 'Full Day',
      fromTime: '',
      toTime: '',
    }
  });

  // Watch for changes to enable reactive rendering
  const watchedLeaveType = form.watch('type');
  const watchedDuration = form.watch('duration');
  const watchedStartDate = form.watch('startDate');
  const watchedEndDate = form.watch('endDate');
  const watchedFromTime = form.watch('fromTime');
  const watchedToTime = form.watch('toTime');

  // Automatically keep End Date matching Start Date when duration is Hourly
  useEffect(() => {
    if ((watchedDuration === 'Hourly' || watchedLeaveType === 'OT') && watchedStartDate) {
      form.setValue('endDate', watchedStartDate);
    }
  }, [watchedDuration, watchedLeaveType, watchedStartDate]);

  // Live conflict evaluation
  const liveConflict = (watchedStartDate && watchedEndDate) ? checkLeaveConflict({
    startDate: watchedStartDate,
    endDate: watchedEndDate,
    type: watchedLeaveType,
    duration: watchedDuration,
    fromTime: watchedFromTime,
    toTime: watchedToTime,
  }, myLeaves) : null;

  // Automatically reset start & end dates if they violate Privilege Leave 5-day rule when Emergency mode is disabled
  useEffect(() => {
    if (watchedLeaveType === 'Privilege' && !isEmergencyPrivilege) {
      const minDate = getMinPrivilegeDateString();
      if (watchedStartDate && watchedStartDate < minDate) {
        form.setValue('startDate', '');
      }
      if (watchedEndDate && watchedEndDate < minDate) {
        form.setValue('endDate', '');
      }
    }
  }, [watchedLeaveType, isEmergencyPrivilege, watchedStartDate, watchedEndDate]);

  useEffect(() => {
    if (watchedLeaveType !== 'Privilege') {
      setIsEmergencyPrivilege(false);
      setEmergencyReason('');
    }
    if (watchedLeaveType === 'OT') {
      form.setValue('duration', 'Hourly');
    }
  }, [watchedLeaveType]);

  // Live Comp Off coverage preview: whenever type is "Comp Off" and both dates
  // are set, show exactly which dates are covered by approved Comp Off balance
  // and which will fall through to LOP.
  useEffect(() => {
    if (!user || watchedLeaveType !== 'Comp Off' || !watchedStartDate || !watchedEndDate) {
      setCompOffCoverage(null);
      return;
    }
    let cancelled = false;
    validateCompOffCoverage(user.id, watchedStartDate, watchedEndDate).then(cov => {
      if (!cancelled) setCompOffCoverage(cov);
    });
    return () => { cancelled = true; };
  }, [user, watchedLeaveType, watchedStartDate, watchedEndDate]);

  const permissionForm = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      permissionType: 'Official',
    }
  });

  const [requestKind, setRequestKind] = useState<'Leave' | 'Permission'>('Leave');

  const onSubmit = async (data: LeaveForm) => {
    console.log('ApplyLeave onSubmit called', data);
    if (!user) return;

    const user_id = user.id;
    if (!user_id) {
      toast({ title: 'Error', description: 'User not properly logged in. Please log in again.', variant: 'destructive' });
      return;
    }

    // Optional: Check balance before submitting (soft check)
    if (data.type === 'Casual' && balance && balance.casual.remaining <= 0) {
      toast({
        title: "Warning",
        description: "You have exhausted your Casual Leave quota. This may be processed as LWP.",
        variant: "destructive"
      });
    }

    if (data.type === 'Privilege') {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const selDate = new Date(data.startDate);
      selDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((selDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays < 5 && !isEmergencyPrivilege) {
        toast({
          title: "5-Day Advance Notice Required",
          description: "Standard Privilege Leave must be applied at least 5 days in advance. Please use the Emergency Request option for short-notice leave.",
          variant: "destructive"
        });
        return;
      }

      if (isEmergencyPrivilege && (!emergencyReason || emergencyReason.trim().length < 5)) {
        toast({
          title: "Emergency Reason Required",
          description: "Please enter a detailed reason for applying short-notice Privilege Leave.",
          variant: "destructive"
        });
        return;
      }
    }

    // Validate conflict against existing leaves
    const conflict = checkLeaveConflict({
      startDate: data.startDate,
      endDate: data.endDate,
      type: data.type,
      duration: data.duration,
      fromTime: data.fromTime,
      toTime: data.toTime,
    }, myLeaves);

    if (conflict.hasConflict) {
      toast({
        title: "🚫 Leave Conflict Detected",
        description: conflict.message || "A conflicting leave request already exists.",
        variant: "destructive"
      });
      return;
    }

    // Comp Off: if requested days exceed approved balance, block submission and show error toast
    if (data.type === 'Comp Off') {
      const coverage = await validateCompOffCoverage(user_id, data.startDate, data.endDate);
      if (coverage.lopDays > 0) {
        toast({
          title: "🚫 Submission Blocked: Insufficient Balance",
          description: `You have ${coverage.approvedAvailable} approved Comp Off day(s) available. You cannot select ${coverage.requestedDays} days. Please adjust your end date to ${coverage.approvedAvailable} day(s).`,
          variant: "destructive"
        });
        return;
      }
      await doSubmitLeave(data, coverage);
      return;
    }

    await doSubmitLeave(data, null);
  };

  const doSubmitLeave = async (data: LeaveForm, coverage: CompOffCoverage | null) => {
    if (!user) return;
    const user_id = user.id;
    if (!user_id) return;

    setSubmitting(true);
    const finalDescription = (data.type === 'Privilege' && isEmergencyPrivilege)
      ? `[SHORT NOTICE EMERGENCY PRIVILEGE LEAVE - Reason: ${emergencyReason.trim()}] ${data.description}`
      : data.description;

    const leaveData = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: user_id,
      employeeName: user.name,
      employeeCode: user.code,
      ...data,
      description: finalDescription,
      status: 'Pending' as const,
      attachment: attachment?.dataUrl,
      appliedDate: new Date().toISOString().split('T')[0],
      ...(data.duration === 'Hourly' && (data.type === 'OD' || data.type === 'OT') ? {
        odFromTime: data.fromTime,
        odToTime: data.toTime,
      } : {})
    } as any;

    let insertedLeaveId: number | undefined;
    try {
      const inserted = await addLeaveRequest(leaveData);
      insertedLeaveId = Array.isArray(inserted) && inserted[0] ? inserted[0].id : undefined;
    } catch (err) {
      console.error('Failed to submit leave:', err);
      const message = (err as any)?.message || JSON.stringify(err) || 'Could not submit leave request.';
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    // Comp Off: consume the FIFO balance for covered dates, tag the leave row
    // with exactly which days were covered vs. LOP, and notify everyone.
    if (data.type === 'Comp Off' && coverage) {
      try {
        await consumeCompOffForLeave(user_id, insertedLeaveId, coverage.coveredDates);
        if (insertedLeaveId) {
          await supabase.from('leaves').update({
            comp_off_covered_days: coverage.coveredDates.length,
            lop_days: coverage.lopDays,
            comp_off_uncovered_dates: coverage.uncoveredDates.join(','),
          }).eq('id', insertedLeaveId);
        }

        if (coverage.lopDays > 0) {
          const uncoveredStr = coverage.uncoveredDates.join(', ');
          await notifyUser(
            user_id,
            'Comp Off Leave Partially Covered',
            `You have ${coverage.approvedAvailable} approved Comp Off day(s). ${coverage.coveredDates.join(', ') || 'None'} will be covered by Comp Off. ${uncoveredStr} will NOT be covered and will be treated as LOP.`,
            'comp_off_leave_lop_warning',
            'leave',
            insertedLeaveId
          );
          await notifyAdminAndHR(
            'Comp Off Leave — LOP Indication',
            `${user.name} (${user.code}) applied Comp Off leave ${data.startDate} to ${data.endDate}. Only ${coverage.approvedAvailable} day(s) approved Comp Off available — dates ${uncoveredStr} will be treated as LOP.`,
            'comp_off_leave_lop_warning',
            'leave',
            insertedLeaveId
          );
        } else {
          await notifyUser(
            user_id,
            'Comp Off Leave Applied',
            `Your Comp Off leave for ${data.startDate} to ${data.endDate} is fully covered by your approved Comp Off balance.`,
            'comp_off_leave_applied',
            'leave',
            insertedLeaveId
          );
          await notifyAdminAndHR(
            'Comp Off Leave Applied',
            `${user.name} (${user.code}) applied Comp Off leave ${data.startDate} to ${data.endDate}, fully covered by approved Comp Off balance.`,
            'comp_off_leave_applied',
            'leave',
            insertedLeaveId
          );
        }
      } catch (e) {
        console.error('Comp Off consumption/notification failed:', e);
      }
    }

    // Send email notification to HR and Admin (using fixed fallback emails)
    fetch('/api/send-leave-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeName: user.name,
        leaveType: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.description,
        duration: data.duration,
        ...(data.duration === 'Hourly' ? { fromTime: data.fromTime, toTime: data.toTime } : {}),
        hrEmails: ['naveen@ctint.in'],
        adminEmails: ['naveen@ctint.in']
      })
    }).catch(() => { });

    // Broadcast notification to all Admin and HR devices across the company
    try {
      await notifyAdminAndHR(
        `📋 New Leave Request: ${user.name}`,
        `${data.type} Leave${data.duration && data.duration !== 'Full Day' ? ` (${data.duration})` : ''} • ${data.startDate === data.endDate ? data.startDate : `${data.startDate} to ${data.endDate}`}${data.description ? ` • Reason: ${data.description.slice(0, 80)}` : ''}`,
        'leave_applied',
        'leave',
        insertedLeaveId
      );
    } catch (e) {
      console.warn('Failed to insert admin/hr notification for leave:', e);
    }

    toast({
      title: "✅ Leave Application Submitted",
      description: "Your manager will review it shortly. Notification sent to HR and Admin.",
      className: "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
    });

    setSubmitting(false);
    setLocation('/employee/dashboard');
  };

  const onPermissionSubmit = async (data: PermissionForm) => {
    console.log('Apply Permission onSubmit', data);
    if (!user) return;

    const user_id = user.id;
    if (!user_id) {
      toast({ title: 'Error', description: 'User not properly logged in. Please log in again.', variant: 'destructive' });
      return;
    }

    const permissionData = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: user_id,
      employeeName: user.name,
      employeeCode: user.code,
      type: 'Permission',
      permissionType: data.permissionType || 'Official',
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.reason,
      status: 'Pending',
      appliedDate: new Date().toISOString().split('T')[0]
    };

    try {
      await addLeaveRequest(permissionData as any);
    } catch (err) {
      console.error('Failed to submit permission:', err);
      const message = (err as any)?.message || JSON.stringify(err) || 'Could not submit permission request.';
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
      return;
    }

    // Send permission notification
    try {
      const { adminEmails, hrEmails } = await (await import('@/lib/storage')).getNotificationEmails();
      fetch('/api/send-permission-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: user.name,
          permissionType: data.permissionType || 'Official',
          startTime: data.startTime,
          endTime: data.endTime,
          reason: data.reason,
          hrEmails,
          adminEmails
        })
      }).catch(err => console.log('Permission email notification sent (demo)'));
    } catch (e) {
      console.log('Failed to resolve notification emails for permission, using defaults', e);
      fetch('/api/send-permission-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: user.name,
          permissionType: data.permissionType || 'Official',
          startTime: data.startTime,
          endTime: data.endTime,
          reason: data.reason,
          hrEmails: ['naveen@ctint.in'],
          adminEmails: ['naveen@ctint.in']
        })
      }).catch(() => { });
    }

    // Broadcast notification to all Admin and HR devices across the company
    try {
      await notifyAdminAndHR(
        `⏱️ New Permission Request: ${user.name}`,
        `${data.permissionType || 'Official'} Permission • ${data.date} [${data.startTime} - ${data.endTime}] • Reason: ${data.reason.slice(0, 80)}`,
        'permission_applied',
        'permission'
      );
    } catch (e) {
      console.warn('Failed to insert admin/hr notification for permission:', e);
    }

    toast({
      title: "✅ Permission Request Submitted",
      description: "HR/Admin will review it shortly. Notification sent.",
      className: "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
    });

    setLocation('/employee/dashboard');
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only PDF, JPG, PNG are allowed', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum allowed size is 5MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ name: file.name, size: file.size, type: file.type, dataUrl: reader.result as string });
      toast({ title: 'Attachment added', description: file.name });
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const removeAttachment = () => setAttachment(null);

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Apply for Leave</h2>
          <p className="text-xs sm:text-sm text-slate-600">Submit your leave request for approval</p>
        </div>
        {balance && (
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto text-xs">
            <div className="bg-white border border-slate-200 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm text-center">
              <span className="text-slate-500 block text-[11px] font-medium">Casual</span>
              <span className="font-bold text-primary text-xs sm:text-sm">
                {balance.casual.remaining} <span className="text-slate-400 font-normal text-[10px]">({balance.casual.used} used)</span>
              </span>
            </div>
            <div className="bg-white border border-slate-200 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm text-center">
              <span className="text-slate-500 block text-[11px] font-medium">Sick</span>
              <span className="font-bold text-primary text-xs sm:text-sm">
                {balance.sick.remaining} <span className="text-slate-400 font-normal text-[10px]">({balance.sick.used} used)</span>
              </span>
            </div>
            <div className="bg-white border border-slate-200 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm text-center">
              <span className="text-slate-500 block text-[11px] font-medium">Privilege</span>
              <span className="font-bold text-amber-600 text-xs sm:text-sm">
                {balance.privilege?.remaining ?? 10} <span className="text-slate-400 font-normal text-[10px]">({balance.privilege?.used ?? 0} used)</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
        {/* Outlined Box 1: Leave Type & Duration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Leave Category & Duration</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Leave Type *</Label>
            <Select onValueChange={(val) => form.setValue('type', val as any)} defaultValue={form.getValues('type')}>
              <SelectTrigger className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl font-medium">
                <SelectValue placeholder="Select leave category" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                <SelectItem value="Casual">Casual Leave</SelectItem>
                <SelectItem value="Sick">Sick Leave</SelectItem>
                <SelectItem value="OD">On Duty (OD)</SelectItem>
                <SelectItem value="Comp Off">Comp Off</SelectItem>
                <SelectItem value="Privilege">Privilege Leave</SelectItem>
                <SelectItem value="OT">Overtime (OT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {watchedLeaveType === 'Comp Off' && compOffBalanceDays === 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 sm:p-4 text-sm text-red-800 font-semibold flex items-start gap-2.5 animate-in fade-in duration-300">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">⚠️ No Approved Comp Off Balance Available</p>
                <p className="text-xs text-red-700 font-normal mt-1">
                  You currently have 0 approved Comp Off days. Please claim Comp Off on the <strong>Apply Comp Off</strong> page and receive dual-approval before applying.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Select Duration</Label>
            <RadioGroup
              defaultValue="Full Day"
              value={watchedDuration}
              onValueChange={(val) => {
                form.setValue('duration', val as any);
                if (val !== 'Hourly') {
                  form.setValue('fromTime', '');
                  form.setValue('toTime', '');
                }
              }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
            >
              <label
                htmlFor="full"
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  watchedDuration === 'Full Day'
                    ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-700'
                }`}
              >
                <RadioGroupItem value="Full Day" id="full" className="text-primary border-slate-300" />
                <span className="text-xs sm:text-sm">Full Day</span>
              </label>

              <label
                htmlFor="half"
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  watchedDuration === 'Half Day'
                    ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-700'
                }`}
              >
                <RadioGroupItem value="Half Day" id="half" className="text-primary border-slate-300" />
                <span className="text-xs sm:text-sm">Half Day</span>
              </label>

              {(watchedLeaveType === 'OD' || watchedLeaveType === 'OT') && (
                <label
                  htmlFor="hourly"
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    watchedDuration === 'Hourly'
                      ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-700'
                  }`}
                >
                  <RadioGroupItem value="Hourly" id="hourly" className="text-primary border-slate-300" />
                  <span className="text-xs sm:text-sm">Hourly</span>
                </label>
              )}
            </RadioGroup>
          </div>
        </div>

        {/* Outlined Box 2: Schedule & Dates */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Schedule & Dates</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Start Date *</Label>
              <Input
                type="date"
                min={getStartDateMin()}
                disabled={watchedLeaveType === 'Comp Off' && compOffBalanceDays === 0}
                {...form.register('startDate')}
                className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl text-xs sm:text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              {form.formState.errors.startDate && <p className="text-red-500 text-xs mt-1">{form.formState.errors.startDate.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold text-xs sm:text-sm">End Date *</Label>
              <Input
                type="date"
                min={getEndDateMin()}
                disabled={watchedLeaveType === 'Comp Off' && compOffBalanceDays === 0}
                {...form.register('endDate')}
                className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl text-xs sm:text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              {form.formState.errors.endDate && <p className="text-red-500 text-xs mt-1">{form.formState.errors.endDate.message}</p>}
            </div>
          </div>

          {/* Privilege Leave 5-day Notice Warning */}
          {watchedLeaveType === 'Privilege' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4 text-xs sm:text-sm space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-amber-900 font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span>Privilege Leave requires <strong>5 days advance notice</strong>.</span>
                    {!isEmergencyPrivilege && (
                      <span className="block text-xs text-amber-700 font-normal">
                        Earliest standard start date: <strong>{getMinPrivilegeDateString()}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isEmergencyPrivilege ? "destructive" : "outline"}
                  className={isEmergencyPrivilege ? "bg-red-600 text-white hover:bg-red-700 font-semibold text-xs shadow-xs" : "border-amber-400 text-amber-800 hover:bg-amber-100 bg-white font-semibold text-xs shadow-xs"}
                  onClick={() => {
                    const nextState = !isEmergencyPrivilege;
                    setIsEmergencyPrivilege(nextState);
                    if (!nextState) {
                      setEmergencyReason('');
                      const minDate = getMinPrivilegeDateString();
                      if (watchedStartDate && watchedStartDate < minDate) {
                        form.setValue('startDate', '');
                      }
                      if (watchedEndDate && watchedEndDate < minDate) {
                        form.setValue('endDate', '');
                      }
                    }
                  }}
                >
                  {isEmergencyPrivilege ? "Cancel Emergency" : "🚨 Emergency Request"}
                </Button>
              </div>

              {isEmergencyPrivilege && (
                <div className="pt-2 border-t border-amber-200 space-y-2 animate-in fade-in duration-300">
                  <Label className="text-amber-900 font-semibold text-xs">Detailed Emergency Reason *</Label>
                  <Textarea
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    placeholder="Please explain the urgent reason..."
                    className="bg-white border-amber-300 text-slate-900 text-xs min-h-[70px] rounded-xl"
                  />
                </div>
              )}
            </div>
          )}

          {/* Comp Off Coverage Overview */}
          {watchedLeaveType === 'Comp Off' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 sm:p-4 text-xs sm:text-sm space-y-1.5">
              <p className="font-bold text-blue-800">
                Approved Comp Off Balance: {compOffBalanceDays ?? '...'} day(s)
              </p>
              {compOffCoverage && (
                <div className="space-y-1 text-blue-700 text-xs">
                  <p>Requested: <strong className="text-slate-800">{compOffCoverage.requestedDays} day(s)</strong> | Available: <strong className="text-slate-800">{compOffCoverage.approvedAvailable} day(s)</strong></p>
                  {compOffCoverage.lopDays > 0 ? (
                    <div className="bg-red-100 border border-red-200 rounded-lg p-2.5 text-red-800 font-semibold mt-1">
                      ⚠️ Exceeds balance by {compOffCoverage.lopDays} day(s). Please reduce your end date.
                    </div>
                  ) : (
                    <p className="text-green-700 font-semibold">✓ Fully covered by your approved Comp Off balance.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hourly Window inputs if duration is Hourly */}
          {(watchedDuration === 'Hourly' || watchedLeaveType === 'OT') && (watchedLeaveType === 'OD' || watchedLeaveType === 'OT') && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-semibold text-xs sm:text-sm">From Time *</Label>
                  <Input
                    type="time"
                    {...form.register('fromTime')}
                    className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl text-xs sm:text-sm"
                  />
                  {form.formState.errors.fromTime && <p className="text-red-500 text-xs mt-1">{form.formState.errors.fromTime.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-semibold text-xs sm:text-sm">To Time *</Label>
                  <Input
                    type="time"
                    {...form.register('toTime')}
                    className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl text-xs sm:text-sm"
                  />
                  {form.formState.errors.toTime && <p className="text-red-500 text-xs mt-1">{form.formState.errors.toTime.message}</p>}
                </div>
              </div>

              {/* Real-time Time Order Validation / Duration Calculation */}
              {watchedFromTime && watchedToTime && (() => {
                const [fH, fM] = watchedFromTime.split(':').map(Number);
                const [tH, tM] = watchedToTime.split(':').map(Number);
                const diff = (tH * 60 + tM) - (fH * 60 + fM);

                if (diff <= 0) {
                  return (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>End time (To Time) must be after start time (From Time).</span>
                    </div>
                  );
                }

                const hrs = Math.floor(diff / 60);
                const mins = diff % 60;
                return (
                  <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-800 text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Duration: <strong>{hrs > 0 ? `${hrs}h ` : ''}{mins > 0 ? `${mins}m` : (hrs === 0 ? '0m' : '')}</strong> ({diff} mins)</span>
                    </span>
                    <span className="text-[11px] text-blue-600 font-semibold">Hourly {watchedLeaveType}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Live Conflict or OD/OT Non-overlapping Status */}
          {liveConflict && liveConflict.hasConflict && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 sm:p-4 text-xs sm:text-sm text-red-900 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Request Conflict</p>
                <p className="text-red-700 text-xs mt-0.5">{liveConflict.message}</p>
              </div>
            </div>
          )}

          {liveConflict && !liveConflict.hasConflict && liveConflict.isAllowedOdOtPair && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-900 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>✓ <strong>OD and OT on the same date:</strong> Non-overlapping time ranges detected. This combination is allowed.</span>
            </div>
          )}
        </div>

        {/* Outlined Box 3: Reason & Attachments */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Reason & Documentation</h3>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Reason / Description *</Label>
            <Textarea
              {...form.register('description')}
              placeholder="Please explain the reason for your leave request..."
              className="bg-slate-50/50 border-slate-200 text-slate-900 min-h-[95px] rounded-xl text-xs sm:text-sm focus:bg-white"
            />
            {form.formState.errors.description && <p className="text-red-500 text-xs mt-1">{form.formState.errors.description.message}</p>}
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Attachment (Optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={onFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              role="button"
              className="border-2 border-dashed border-slate-200 rounded-xl p-4 sm:p-5 text-center hover:border-primary/50 transition-colors cursor-pointer bg-slate-50/50"
            >
              {!attachment ? (
                <>
                  <p className="text-xs sm:text-sm text-slate-700 font-semibold">Tap to upload file or document</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">PDF, JPG, PNG up to 5MB</p>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-left overflow-hidden">
                    <p className="text-xs sm:text-sm text-slate-900 font-bold truncate">{attachment.name}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{(attachment.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); removeAttachment(); }}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2 text-xs font-bold"
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={submitting || (watchedLeaveType === 'Comp Off' && !!compOffCoverage && compOffCoverage.lopDays > 0)}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm sm:text-base shadow-md disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting Application...' : (watchedLeaveType === 'Comp Off' && !!compOffCoverage && compOffCoverage.lopDays > 0) ? '🚫 Submission Blocked (Exceeds Balance)' : 'Submit Leave Application'}
          </Button>
        </div>
      </form>

      <Dialog open={lopConfirmOpen} onOpenChange={setLopConfirmOpen}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" /> Insufficient Comp Off Balance
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {pendingSubmit && (
                <>
                  You have {pendingSubmit.coverage.approvedAvailable} approved Comp Off day(s) available.
                  {' '}{pendingSubmit.coverage.coveredDates.join(', ') || 'No dates'} will be covered by Comp Off.
                  {' '}{pendingSubmit.coverage.uncoveredDates.join(', ')} {pendingSubmit.coverage.uncoveredDates.length > 1 ? 'will' : 'will'} be treated as Loss of Pay (LOP) — {pendingSubmit.coverage.lopDays} day(s).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-200 hover:bg-slate-50 text-slate-600"
              onClick={() => { setLopConfirmOpen(false); setPendingSubmit(null); }}
            >
              Cancel
            </Button>
            <Button
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={async () => {
                if (!pendingSubmit) return;
                setLopConfirmOpen(false);
                await doSubmitLeave(pendingSubmit.data, pendingSubmit.coverage);
                setPendingSubmit(null);
              }}
            >
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}