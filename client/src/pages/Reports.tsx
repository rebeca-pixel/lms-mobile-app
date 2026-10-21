import { getStoredLeaves, getStoredPermissions, getAllUsersAsync } from '@/lib/storage';
import { User } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Download, Mail, MessageCircle, Eye } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { StatCards } from '@/components/StatCards';
import { getAllCompOffRequests, CompOffRequest } from '@/lib/compoff';

export default function Reports() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [compOffRequests, setCompOffRequests] = useState<CompOffRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [searchDepartment, setSearchDepartment] = useState('');
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaves = async () => {
      const allLeaves = await getStoredLeaves();
      setLeaves(allLeaves);
      const allPermissions = await getStoredPermissions();
      setPermissions(allPermissions);
      const allUsers = await getAllUsersAsync();
      setUsers(allUsers);
      const allCompOff = await getAllCompOffRequests();
      setCompOffRequests(allCompOff);
      setLoading(false);
    };
    loadLeaves();
  }, []);

  const exportToCSV = () => {
    try {
      const employees = users.filter(u => u.role === 'Employee');
      const reportData = employees.map(user => {
        const userLeaves = leaves.filter(l =>
          (l.employeeCode === user.code || l.employeeCode === user.id || l.employeeName === user.name) &&
          l.status === 'Approved'
        );
        const userPermissions = permissions.filter(p =>
          (p.employeeCode === user.code || p.employeeCode === user.id || p.employeeName === user.name) &&
          p.status === 'Approved'
        );
        const casualCount = userLeaves.filter(l => l.type === 'Casual').length;
        const sickCount = userLeaves.filter(l => l.type === 'Sick').length;
        const odCount = userLeaves.filter(l => l.type === 'OD').length;
        const permissionCount = userPermissions.length;
        const compOffCount = userLeaves.filter(l => l.type === 'Comp Off').length;
        const lwpCount = userLeaves.filter(l => l.type === 'LWP').length;
        const earnedCount = userLeaves.filter(l => l.type === 'Earned').length;

        const userCompOffRequests = compOffRequests.filter(r => r.employeeId === user.id || r.employeeCode === user.code);
        const compOffApproved = userCompOffRequests.filter(r => r.credited).reduce((sum, r) => sum + r.creditedDays, 0);
        const compOffUsed = userCompOffRequests.filter(r => r.credited).reduce((sum, r) => sum + r.usedDays, 0);
        const compOffRemaining = Math.max(0, compOffApproved - compOffUsed);
        const compOffLeaveRows = userLeaves.filter(l => l.type === 'Comp Off');
        const compOffCoveredDays = compOffLeaveRows.reduce((sum, l) => sum + (l.compOffCoveredDays || 0), 0);
        const compOffLopDays = compOffLeaveRows.reduce((sum, l) => sum + (l.lopDays || 0), 0);

        return {
          name: user.name,
          code: user.code,
          designation: user.designation,
          casual: casualCount,
          permission: permissionCount,
          sick: sickCount,
          od: odCount,
          compOff: compOffCount,
          lwp: lwpCount,
          earned: earnedCount,
          total: casualCount + sickCount + odCount + compOffCount + lwpCount + earnedCount + permissionCount,
          compOffApproved,
          compOffUsed,
          compOffRemaining,
          compOffCoveredDays,
          compOffLopDays,
        };
      });

      let csv = 'Employee Name,Employee Code,Designation,Casual,Permission,Sick,OD,Comp Off,LWP,Earned,Total,Comp Off Approved,Comp Off Used,Comp Off Remaining,Comp Off Covered Days,LOP Days (Insufficient Comp Off)\n';
      reportData.forEach(row => {
        csv += `"${row.name}","${row.code}","${row.designation}",${row.casual},${row.permission},${row.sick},${row.od},${row.compOff},${row.lwp},${row.earned},${row.total},${row.compOffApproved},${row.compOffUsed},${row.compOffRemaining},${row.compOffCoveredDays},${row.compOffLopDays}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Leave-Report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Report exported successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive"
      });
    }
  };

  const exportToExcel = () => {
    try {
      const employees = users.filter(u => u.role === 'Employee');
      const reportData = employees.map(user => {
        const userLeaves = leaves.filter(l =>
          (l.employeeCode === user.code || l.employeeCode === user.id || l.employeeName === user.name) &&
          l.status === 'Approved'
        );
        const userPermissions = permissions.filter(p =>
          (p.employeeCode === user.code || p.employeeCode === user.id || p.employeeName === user.name) &&
          p.status === 'Approved'
        );
        const casualCount = userLeaves.filter(l => l.type === 'Casual').length;
        const sickCount = userLeaves.filter(l => l.type === 'Sick').length;
        const odCount = userLeaves.filter(l => l.type === 'OD').length;
        const permissionCount = userPermissions.length;
        const compOffCount = userLeaves.filter(l => l.type === 'Comp Off').length;
        const lwpCount = userLeaves.filter(l => l.type === 'LWP').length;
        const earnedCount = userLeaves.filter(l => l.type === 'Earned').length;
        const userCompOffRequests = compOffRequests.filter(r => r.employeeId === user.id || r.employeeCode === user.code);
        const compOffApproved = userCompOffRequests.filter(r => r.credited).reduce((sum, r) => sum + r.creditedDays, 0);
        const compOffUsed = userCompOffRequests.filter(r => r.credited).reduce((sum, r) => sum + r.usedDays, 0);
        const compOffRemaining = Math.max(0, compOffApproved - compOffUsed);
        const compOffLeaveRows = userLeaves.filter(l => l.type === 'Comp Off');
        const compOffCoveredDays = compOffLeaveRows.reduce((sum, l) => sum + (l.compOffCoveredDays || 0), 0);
        const compOffLopDays = compOffLeaveRows.reduce((sum, l) => sum + (l.lopDays || 0), 0);
        return {
          EmployeeName: user.name,
          EmployeeCode: user.code,
          Designation: user.designation,
          Casual: casualCount,
          Permission: permissionCount,
          Sick: sickCount,
          OD: odCount,
          CompOff: compOffCount,
          LWP: lwpCount,
          Earned: earnedCount,
          Total: casualCount + sickCount + odCount + compOffCount + lwpCount + earnedCount + permissionCount,
          CompOffApprovedDays: compOffApproved,
          CompOffUsed: compOffUsed,
          CompOffRemaining: compOffRemaining,
          CompOffCoveredDays: compOffCoveredDays,
          LOPDaysInsufficientCompOff: compOffLopDays,
        };
      });

      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Leave-Report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: 'Success', description: 'Excel report exported successfully!' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to export Excel report', variant: 'destructive' });
    }
  };

  const shareViaEmail = () => {
    toast({
      title: "Email Sharing",
      description: "To enable email sharing, please upgrade to full-stack. This requires backend integration.",
    });
  };

  const shareViaWhatsApp = () => {
    toast({
      title: "WhatsApp Sharing",
      description: "To enable WhatsApp sharing, please upgrade to full-stack. This requires backend integration.",
    });
  };

  // Build a comprehensive report with all leave types
  const reportData = users
    .filter(u => u.role === 'Employee')
    .map(user => {
      const userLeaves = leaves.filter(l =>
        (l.employeeCode === user.code || l.employeeCode === user.id || l.employeeName === user.name) &&
        l.status === 'Approved'
      );
      const userPermissions = permissions.filter(p =>
        (p.employeeCode === user.code || p.employeeCode === user.id || p.employeeName === user.name) &&
        p.status === 'Approved'
      );

      const casualCount = userLeaves.filter(l => l.type === 'Casual').length;
      const sickCount = userLeaves.filter(l => l.type === 'Sick').length;
      const odCount = userLeaves.filter(l => l.type === 'OD').length;
      const permissionCount = userPermissions.length;
      const compOffCount = userLeaves.filter(l => l.type === 'Comp Off').length;
      const lwpCount = userLeaves.filter(l => l.type === 'LWP').length;
      const earnedCount = userLeaves.filter(l => l.type === 'Earned').length;
      const totalLeaves = userLeaves.length + userPermissions.length;

      // Comp Off payroll validation: approved/used/remaining balance, how many
      // days across Comp Off leave applications were actually covered by that
      // balance, and how many became LOP due to insufficient Comp Off.
      const userCompOffRequests = compOffRequests.filter(r => r.employeeId === user.id || r.employeeCode === user.code);
      const compOffApproved = userCompOffRequests.filter(r => r.credited).reduce((sum, r) => sum + r.creditedDays, 0);
      const compOffUsed = userCompOffRequests.filter(r => r.credited).reduce((sum, r) => sum + r.usedDays, 0);
      const compOffRemaining = Math.max(0, compOffApproved - compOffUsed);

      const compOffLeaveRows = userLeaves.filter(l => l.type === 'Comp Off');
      const compOffCoveredDays = compOffLeaveRows.reduce((sum, l) => sum + (l.compOffCoveredDays || 0), 0);
      const compOffLopDays = compOffLeaveRows.reduce((sum, l) => sum + (l.lopDays || 0), 0);

      return {
        user,
        casual: casualCount,
        permission: permissionCount,
        sick: sickCount,
        od: odCount,
        compOff: compOffCount,
        lwp: lwpCount,
        earned: earnedCount,
        total: totalLeaves,
        compOffApproved,
        compOffUsed,
        compOffRemaining,
        compOffCoveredDays,
        compOffLopDays,
      };
    });

  const filteredData = reportData.filter(item =>
    (item.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!searchDepartment || item.user.designation.toLowerCase().includes(searchDepartment.toLowerCase()))
  );

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'Casual': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Sick': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'OD': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Comp Off': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Leave & OD Reports</h2>
          <p className="text-xs sm:text-sm text-slate-600">Comprehensive view of all employee leaves and on-duty requests</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full md:w-auto">
          <Button
            onClick={exportToExcel}
            className="flex-1 md:flex-initial text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)]"
            data-testid="button-export-excel"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </Button>
          <Button
            onClick={shareViaEmail}
            variant="outline"
            className="flex-1 md:flex-initial text-xs sm:text-sm border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
            data-testid="button-share-email"
          >
            <Mail className="w-4 h-4 mr-1.5" /> Email
          </Button>
          <Button
            onClick={shareViaWhatsApp}
            variant="outline"
            className="flex-1 md:flex-initial text-xs sm:text-sm border-green-500/30 text-green-600 hover:bg-green-500/10"
            data-testid="button-share-whatsapp"
          >
            <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 sm:gap-4 w-full">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search Employee Name or Code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-slate-200 text-slate-900 focus:border-primary/50 text-sm"
            data-testid="input-search-employee"
          />
        </div>
        <Input
          placeholder="Filter by Designation..."
          value={searchDepartment}
          onChange={(e) => setSearchDepartment(e.target.value)}
          className="bg-white border-slate-200 text-slate-900 focus:border-primary/50 text-sm"
          data-testid="input-search-designation"
        />
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-white border-slate-200 text-slate-900 focus:border-primary/50 text-sm"
          data-testid="input-filter-date"
        />
      </div>

      <StatCards stats={[
        { label: 'Total Casual', value: reportData.reduce((sum, r) => sum + r.casual, 0), type: 'info' },
        { label: 'Total Sick', value: reportData.reduce((sum, r) => sum + r.sick, 0), type: 'approved' },
        { label: 'Total OD', value: reportData.reduce((sum, r) => sum + r.od, 0), type: 'rejected' },
        { label: 'Total Comp Off', value: reportData.reduce((sum, r) => sum + r.compOff, 0), type: 'approved' },
        { label: 'Total Permission', value: reportData.reduce((sum, r) => sum + (r.permission || 0), 0), type: 'pending' },
        { label: 'Total Leaves', value: reportData.reduce((sum, r) => sum + r.total, 0), type: 'total-leaves' },
      ]} />

      {/* Payroll validation: Comp Off summary */}
      <StatCards stats={[
        { label: 'Approved Comp Off Days', value: reportData.reduce((sum, r) => sum + r.compOffApproved, 0), type: 'approved' },
        { label: 'Comp Off Used', value: reportData.reduce((sum, r) => sum + r.compOffUsed, 0), type: 'info' },
        { label: 'Comp Off Remaining', value: reportData.reduce((sum, r) => sum + r.compOffRemaining, 0), type: 'total-leaves' },
        { label: 'Comp Off Covered Days', value: reportData.reduce((sum, r) => sum + r.compOffCoveredDays, 0), type: 'approved' },
        { label: 'LOP Days (Insufficient Comp Off)', value: reportData.reduce((sum, r) => sum + r.compOffLopDays, 0), type: 'rejected' },
      ]} />

      {/* Mobile Card View (visible on <640px) */}
      <div className="block sm:hidden space-y-3">
        {filteredData.map((item) => (
          <Card key={item.user.id} className="bg-white border-slate-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-base">{item.user.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-primary font-mono font-bold text-xs">{item.user.code}</span>
                  <span className="text-slate-400 text-xs">•</span>
                  <span className="text-slate-500 text-xs">{item.user.designation}</span>
                </div>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 shrink-0 font-bold">
                {item.total} Total
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs mb-3">
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">Casual</span>
                <span className="font-bold text-blue-600">{item.casual}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">Sick</span>
                <span className="font-bold text-red-600">{item.sick}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">OD</span>
                <span className="font-bold text-green-600">{item.od}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">Comp Off</span>
                <span className="font-bold text-purple-600">{item.compOff}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">Permission</span>
                <span className="font-bold text-amber-600">{item.permission || 0}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">LOP</span>
                <span className={`font-bold ${item.compOffLopDays > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                  {item.compOffLopDays}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
              <span className="text-slate-500">Comp Off Rem: <strong className="text-slate-800">{item.compOffRemaining}</strong></span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/admin/individual-report/${item.user.id}`)}
                className="text-primary hover:text-primary/80 h-8 px-2 font-bold flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> View Report
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop Table View (hidden on <640px) */}
      <Card className="hidden sm:block bg-card/40 backdrop-blur border-white/10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-slate-600 font-bold">Employee</TableHead>
                  <TableHead className="text-slate-600 font-bold">Code</TableHead>
                  <TableHead className="text-slate-600 font-bold">Designation</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Casual</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Sick</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">OD</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Comp Off</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">LWP</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Permission</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Earned</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Total</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Comp Off Approved</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Comp Off Used</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Comp Off Remaining</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Comp Off Covered</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">LOP (Insufficient Comp Off)</TableHead>
                  <TableHead className="text-slate-600 font-bold text-center">Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.user.id} className="hover:bg-slate-50 border-slate-100 transition-colors">
                    <TableCell className="font-medium text-slate-900">{item.user.name}</TableCell>
                    <TableCell className="text-primary font-mono font-bold">{item.user.code}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{item.user.designation}</TableCell>
                    <TableCell className="text-center text-blue-400 font-bold">{item.casual}</TableCell>
                    <TableCell className="text-center text-red-400 font-bold">{item.sick}</TableCell>
                    <TableCell className="text-center text-green-400 font-bold">{item.od}</TableCell>
                    <TableCell className="text-center text-purple-400 font-bold">{item.compOff}</TableCell>
                    <TableCell className="text-center text-gray-400 font-bold">{item.lwp}</TableCell>
                    <TableCell className="text-center text-yellow-400 font-bold">{item.permission || 0}</TableCell>
                    <TableCell className="text-center text-yellow-400 font-bold">{item.earned}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {item.total}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-green-600 font-bold">{item.compOffApproved}</TableCell>
                    <TableCell className="text-center text-slate-600 font-bold">{item.compOffUsed}</TableCell>
                    <TableCell className="text-center text-blue-600 font-bold">{item.compOffRemaining}</TableCell>
                    <TableCell className="text-center text-purple-600 font-bold">{item.compOffCoveredDays}</TableCell>
                    <TableCell className="text-center">
                      {item.compOffLopDays > 0 ? (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 font-bold">
                          {item.compOffLopDays} LOP
                        </Badge>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/admin/individual-report/${item.user.id}`)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
