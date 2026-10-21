import { useState, useEffect } from "react";
import { LeaveRequest } from "@/lib/data";
import { getStoredLeaves, addLeaveRequest, updateLeaveStatus as updateLeaveStatusRemote } from "@/lib/storage";

export function useLeaves() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const rows = await getStoredLeaves();
      if (mounted) setLeaves(rows);
    })();
    return () => { mounted = false; };
  }, []);

  const addLeave = async (leave: Omit<LeaveRequest, "id" | "status" | "appliedDate">) => {
    const newLeave: LeaveRequest = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: (leave as any).employeeId || '',
      employeeName: (leave as any).employeeName || '',
      employeeCode: (leave as any).employeeCode || '',
      ...leave,
      status: "Pending",
      appliedDate: new Date().toISOString().split('T')[0],
    } as LeaveRequest;

    try {
      await addLeaveRequest(newLeave);
      const updated = [newLeave, ...leaves];
      setLeaves(updated);
      return newLeave;
    } catch (err) {
      console.error('Failed to add leave via Supabase', err);
      throw err;
    }
  };

  const updateLeaveStatus = async (id: string, status: LeaveRequest["status"], actionBy: string, reason?: string) => {
    try {
      await updateLeaveStatusRemote(id, status, actionBy, reason);
      const updated = leaves.map((leave) => {
        if (leave.id === id) {
          return {
            ...leave,
            status,
            actionBy,
            reasonForAction: reason,
            actionDate: new Date().toISOString().split('T')[0],
          };
        }
        return leave;
      });
      setLeaves(updated);
    } catch (err) {
      console.error('Failed to update leave status via Supabase', err);
      throw err;
    }
  };

  return { leaves, addLeave, updateLeaveStatus };
}
