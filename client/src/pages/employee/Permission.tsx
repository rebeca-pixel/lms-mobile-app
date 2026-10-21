import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, AlertTriangle, Clock, Info } from 'lucide-react';
import { addPermissionRequest, PermissionRequest, getMonthlyPermissionCount, calculateDurationMinutes } from '@/lib/storage';
import { notifyAdminAndHR } from '@/lib/notifications';
import { notifyPermissionApplication } from '@/lib/pushNotifications';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const permissionSchema = z.object({
  type: z.enum(['Late Entry Permission', 'Early Exit Permission', 'Personal Work Permission', 'Emergency Permission']),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  additionalInfo: z.string().optional(),
}).refine((data) => {
  // Validate that end time is after start time
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  return endTotalMin > startTotalMin;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine((data) => {
  // Validate that duration doesn't exceed 2 hours (120 minutes)
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  const durationMinutes = endTotalMin - startTotalMin;
  return durationMinutes <= 120;
}, {
  message: "Permission duration cannot exceed 2 hours (120 minutes)",
  path: ["endTime"],
});

type PermissionForm = z.infer<typeof permissionSchema>;

export default function Permission({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showLOPWarning, setShowLOPWarning] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      type: 'Late Entry Permission',
      date: new Date().toISOString().split('T')[0],
    }
  });

  const handleSubmitWithLOPCheck = async (data: PermissionForm) => {
    console.log('Permission onSubmit called', data);
    if (!user) return;

    // Get the correct user_id from AuthContext (the DB user_id stored in `user.id`)
    const user_id = user.id;
    if (!user_id) {
      toast({ title: 'Error', description: 'User not properly logged in. Please log in again.', variant: 'destructive' });
      return;
    }

    // Check monthly permission count
    const count = await getMonthlyPermissionCount(user_id, data.date);
    setMonthlyCount(count);

    const permissionRequest: PermissionRequest = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: user_id,
      employeeName: user.name,
      employeeCode: user.code,
      type: data.type,
      startTime: data.startTime,
      endTime: data.endTime,
      date: data.date,
      reason: data.reason,
      additionalInfo: data.additionalInfo,
      status: 'Pending',
      appliedDate: new Date().toISOString().split('T')[0],
      durationMinutes: calculateDurationMinutes(data.startTime, data.endTime),
      isLOPApplicable: count >= 3, // If already at 3 or more, mark as LOP
    };

    // If monthly limit exceeded (>= 3 requests already), show LOP warning
    if (count >= 3) {
      setPendingPermission(permissionRequest);
      setShowLOPWarning(true);
      return;
    }

    // Otherwise, directly submit
    await submitPermissionRequest(permissionRequest);
  };

  const submitPermissionRequest = async (permissionRequest: PermissionRequest) => {
    try {
      setIsSubmitting(true);
      await addPermissionRequest(permissionRequest);

      // Send email notification to HR and Admin
      fetch('/api/send-permission-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: user?.name,
          permissionType: permissionRequest.type,
          date: permissionRequest.date,
          startTime: permissionRequest.startTime,
          endTime: permissionRequest.endTime,
          reason: permissionRequest.reason,
          isLOPApplicable: permissionRequest.isLOPApplicable,
          hrEmails: ['naveen@ctint.in'],
          adminEmails: ['naveen@ctint.in']
        })
      }).catch(() => { });

      // Broadcast notification to all Admin and HR devices across the company
      try {
        await notifyAdminAndHR(
          `⏱️ New Permission Request: ${permissionRequest.employeeName}`,
          `${permissionRequest.type} • ${permissionRequest.date} [${permissionRequest.startTime} - ${permissionRequest.endTime}] • Reason: ${permissionRequest.reason.slice(0, 80)}`,
          'permission_applied',
          'permission'
        );
      } catch (e) {
        console.warn('Failed to insert admin/hr notification for permission:', e);
      }

      console.log('Permission Request Submitted:', permissionRequest);

      const message = permissionRequest.isLOPApplicable
        ? "⚠️ Permission request submitted and marked as Loss of Pay (LOP)."
        : "Your request has been sent to HR and Admin for approval. Notification sent to their email.";

      toast({
        title: "✅ Permission Request Submitted",
        description: message,
        className: permissionRequest.isLOPApplicable
          ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 font-medium"
          : "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
      });

      form.reset();
      setShowLOPWarning(false);
      setPendingPermission(null);

      if (onClose) {
        onClose();
      } else {
        setLocation('/employee/dashboard');
      }
    } catch (err) {
      console.error('Failed to submit permission:', err);
      const message = (err as any)?.message || JSON.stringify(err) || 'Could not submit permission request.';
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLOPContinue = async () => {
    if (pendingPermission) {
      await submitPermissionRequest(pendingPermission);
    }
  };

  const renderFormContent = () => (
    <form onSubmit={form.handleSubmit(handleSubmitWithLOPCheck)} className="space-y-4 sm:space-y-5">
      {/* Box 1: Permission Category & Timing */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Permission Details & Schedule</h3>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 text-primary" /> Max 2 Hours
          </span>
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Permission Type *</Label>
          <Select onValueChange={(val) => form.setValue('type', val as any)} defaultValue={form.getValues('type')}>
            <SelectTrigger className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl font-medium">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-900">
              <SelectItem value="Late Entry Permission">Late Entry Permission</SelectItem>
              <SelectItem value="Early Exit Permission">Early Exit Permission</SelectItem>
              <SelectItem value="Personal Work Permission">Personal Work Permission</SelectItem>
              <SelectItem value="Emergency Permission">Emergency Permission</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Permission Date *</Label>
          <Input
            type="date"
            {...form.register('date')}
            className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl"
          />
          {form.formState.errors.date && <p className="text-red-500 text-xs mt-1">{form.formState.errors.date.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Start Time *</Label>
            <Input
              type="time"
              {...form.register('startTime')}
              className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl"
            />
            {form.formState.errors.startTime && <p className="text-red-500 text-xs mt-1">{form.formState.errors.startTime.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-semibold text-xs sm:text-sm">End Time *</Label>
            <Input
              type="time"
              {...form.register('endTime')}
              className="bg-slate-50/50 border-slate-200 text-slate-900 h-11 rounded-xl"
            />
            {form.formState.errors.endTime && <p className="text-red-500 text-xs mt-1">{form.formState.errors.endTime.message}</p>}
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>Duration cannot exceed 120 minutes. Up to 3 requests/month are allowed before Loss of Pay (LOP) applies.</span>
        </div>
      </div>

      {/* Box 2: Reason & Additional Context */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            2
          </div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">Reason & Additional Details</h3>
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Reason / Justification *</Label>
          <Textarea
            {...form.register('reason')}
            placeholder="Please explain in detail why you need this permission..."
            className="bg-slate-50/50 border-slate-200 text-slate-900 min-h-[90px] rounded-xl text-sm"
          />
          {form.formState.errors.reason && <p className="text-red-500 text-xs mt-1">{form.formState.errors.reason.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Additional Information (Optional)</Label>
          <Textarea
            {...form.register('additionalInfo')}
            placeholder="Add any additional details or handover notes..."
            className="bg-slate-50/50 border-slate-200 text-slate-900 min-h-[70px] rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 text-sm sm:text-base bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
        >
          {isSubmitting ? "Submitting Request..." : "Submit Permission Request"}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      {!onClose ? (
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <div className="flex items-center gap-2 sm:gap-3 mb-1">
              <Lock className="w-6 h-6 text-primary" />
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Request Permission</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">Submit an official permission request for approval</p>
          </div>
          {renderFormContent()}
        </div>
      ) : (
        <div className="mt-2">
          {renderFormContent()}
        </div>
      )}

      {/* LOP Warning Modal */}
      <Dialog open={showLOPWarning} onOpenChange={setShowLOPWarning}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <DialogTitle className="text-yellow-900">Monthly Permission Limit Exceeded</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 mt-2">
              You have already utilized your maximum monthly permission limit of 3 requests. 
              Any additional permission request will be considered as <span className="font-semibold text-yellow-700">Loss of Pay (LOP)</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 my-4">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">This month's permission count:</span> {monthlyCount}
              <br />
              <span className="font-semibold">This request will be marked as:</span> <span className="text-yellow-700 font-bold">LOP Applicable</span>
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowLOPWarning(false);
                setPendingPermission(null);
              }}
              className="border-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleLOPContinue}
              disabled={isSubmitting}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isSubmitting ? "Submitting..." : "Continue & Submit as LOP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

