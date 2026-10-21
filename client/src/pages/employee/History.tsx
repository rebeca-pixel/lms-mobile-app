import { useAuth } from '@/context/AuthContext';
import { getStoredLeaves } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEffect, useState } from 'react';

export default function LeaveHistory() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      const all = await getStoredLeaves();
      if (!mounted) return;
      // Match by employeeCode (username) OR employeeId (user_id) to handle different DB states
      const matched = all.filter((l: any) => (
        l.employeeCode === user.code ||
        l.employeeId === user.id ||
        l.employeeCode === user.id ||
        l.employeeId === user.code
      ));
      // sort newest first
      matched.sort((a: any, b: any) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
      setLeaves(matched);
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-2 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-1 sm:mb-2">Leave History</h2>
        <p className="text-sm sm:text-base text-slate-600">Track all your past and current leave applications</p>
      </div>

      {/* Mobile Card List (Visible on phones) */}
      <div className="sm:hidden space-y-3">
        {leaves.length === 0 ? (
          <div className="text-center py-10 text-slate-500 bg-white rounded-xl border border-slate-200 italic text-sm">
            No records found
          </div>
        ) : (
          leaves.map((leave) => (
            <Card key={`mobile-${leave.id}`} className="bg-white border-slate-200 shadow-sm overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 text-base">{leave.type}</span>
                  <Badge variant="outline" className={getStatusColor(leave.status)}>
                    {leave.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block font-medium">Dates:</span>
                    <span className="font-semibold text-slate-700">
                      {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Duration:</span>
                    <span className="font-semibold text-slate-700">
                      {leave.duration}
                      {leave.duration === 'Hourly' && leave.type === 'OD' && (
                        <span className="block text-[11px] text-slate-500">{leave.odFromTime} - {leave.odToTime}</span>
                      )}
                    </span>
                  </div>
                </div>

                {leave.description && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs text-slate-600">
                    <span className="text-slate-400 block font-medium mb-0.5">Reason:</span>
                    <p className="italic">{leave.description}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Applied: {format(new Date(leave.appliedDate), 'MMM dd, yyyy')}</span>
                  {leave.attachment && (
                    <a href={leave.attachment} target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline">
                      View Attachment
                    </a>
                  )}
                </div>

                {leave.actionBy && (
                  <div className="text-[11px] bg-slate-50/80 p-2 rounded text-slate-500 flex justify-between">
                    <span>Action by: <strong className="text-slate-700">{leave.actionBy}</strong></span>
                    {leave.actionDate && <span>{format(new Date(leave.actionDate), 'MMM dd')}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop/Tablet Table (Hidden on small phones) */}
      <Card className="hidden sm:block bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Type</TableHead>
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Dates</TableHead>
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Duration</TableHead>
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Reason</TableHead>
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Applied On</TableHead>
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Attachment</TableHead>
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Action By</TableHead>
                  <TableHead className="text-slate-600 font-bold whitespace-nowrap">Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500 italic">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  leaves.map((leave) => (
                    <TableRow key={leave.id} className="hover:bg-slate-50 border-slate-100 transition-colors">
                      <TableCell className="font-semibold text-slate-900 whitespace-nowrap">{leave.type}</TableCell>
                      <TableCell className="text-slate-600 font-medium whitespace-nowrap">
                        {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium whitespace-nowrap">
                        {leave.duration}
                        {leave.duration === 'Hourly' && leave.type === 'OD' && (
                          <div className="text-xs text-slate-500 font-normal">{leave.odFromTime} - {leave.odToTime}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-[200px] truncate" title={leave.description}>
                        {leave.description}
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium whitespace-nowrap">{format(new Date(leave.appliedDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {leave.attachment ? (
                          <a href={leave.attachment} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                            View
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={getStatusColor(leave.status)}>
                          {leave.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 font-medium whitespace-nowrap">
                        {leave.actionBy ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-700">{leave.actionBy}</span>
                            <span className="text-[10px]">{leave.actionDate ? format(new Date(leave.actionDate), 'MMM dd, yyyy') : ''}</span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[220px] truncate italic" title={leave.reasonForAction || ''}>
                        {leave.reasonForAction || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
