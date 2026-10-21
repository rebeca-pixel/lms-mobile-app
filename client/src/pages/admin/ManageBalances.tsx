import { useState, useEffect } from 'react';
import { getAllUsersAsync, getManualBalances, saveManualBalance, getLeaveBalance, LeaveBalance } from '@/lib/storage';
import { User } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Save, SlidersHorizontal, User as UserIcon, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserBalanceState {
  casualTaken: number;
  sickTaken: number;
  privilegeTaken: number;
  saving?: boolean;
}

export default function ManageBalances() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [balances, setBalances] = useState<Record<string, UserBalanceState>>({});
  const [liveBalances, setLiveBalances] = useState<Record<string, LeaveBalance>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const userList = await getAllUsersAsync();
    setUsers(userList);

    const manualMap = await getManualBalances();
    const initialBalances: Record<string, UserBalanceState> = {};
    (userList || []).forEach(u => {
      if (!u || !u.code) return;
      const code = u.code.toLowerCase();
      const existing = manualMap[code] || { casualTaken: 0, sickTaken: 0, privilegeTaken: 0 };
      initialBalances[code] = {
        casualTaken: existing.casualTaken,
        sickTaken: existing.sickTaken,
        privilegeTaken: existing.privilegeTaken,
      };
    });
    setBalances(initialBalances);

    // Fetch live actual balance per user (manual + new approved leaves)
    // Use Promise.allSettled so one failure doesn't prevent others from loading
    const liveMap: Record<string, LeaveBalance> = {};
    const balanceResults = await Promise.allSettled(
      (userList || []).filter(u => u && u.code).map(async u => {
        const lb = await getLeaveBalance(u.code, u.id);
        return { key: u.code.toLowerCase(), lb };
      })
    );
    balanceResults.forEach(result => {
      if (result.status === 'fulfilled') {
        const { key, lb } = result.value;
        liveMap[key] = lb;
        // Update input box state so input fields directly show live total taken
        initialBalances[key] = {
          casualTaken: lb.casual.used,
          sickTaken: lb.sick.used,
          privilegeTaken: lb.privilege.used,
        };
      }
    });
    setBalances(initialBalances);
    setLiveBalances(liveMap);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTakenChange = (code: string, field: 'casualTaken' | 'sickTaken' | 'privilegeTaken', val: string) => {
    if (!code) return;
    const num = Math.max(0, parseInt(val) || 0);
    const key = code.toLowerCase();
    setBalances(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { casualTaken: 0, sickTaken: 0, privilegeTaken: 0 }),
        [field]: num
      }
    }));
  };

  const handleSave = async (user: User) => {
    if (!user || !user.code) return;
    const key = user.code.toLowerCase();
    const current = balances[key] || { casualTaken: 0, sickTaken: 0, privilegeTaken: 0 };

    setBalances(prev => ({ ...prev, [key]: { ...prev[key], saving: true } }));

    try {
      await saveManualBalance(user.code, {
        casualTaken: current.casualTaken,
        sickTaken: current.sickTaken,
        privilegeTaken: current.privilegeTaken
      }, user);

      toast({
        title: "✅ Balances Updated",
        description: `Updated taken leaves for ${user.name} (${user.code}). Remaining: Casual (${Math.max(0, 2 - current.casualTaken)}/2), Sick (${Math.max(0, 3 - current.sickTaken)}/3), Privilege (${Math.max(0, 10 - current.privilegeTaken)}/10)`,
        className: "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to save leave balances.",
        variant: "destructive"
      });
    } finally {
      setBalances(prev => ({ ...prev, [key]: { ...prev[key], saving: false } }));
    }
  };

  const filteredUsers = (users || []).filter(u =>
    u && (
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-8 h-8 text-primary" /> Manage Employee Leave Balances
          </h2>
          <p className="text-slate-600 mt-1">
            Set initial taken leaves per employee. Yearly Quotas: Casual (2), Sick (3), Privilege (10) — Total 15 Days.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 w-full sm:w-auto h-11 sm:h-10 text-sm justify-center">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Live Balance'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-sm rounded-xl">
          <CardContent className="p-3 sm:pt-6">
            <p className="text-[11px] sm:text-xs font-semibold text-blue-600 uppercase">Casual Quota</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-900 mt-0.5">2 Days / Yr</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-sm rounded-xl">
          <CardContent className="p-3 sm:pt-6">
            <p className="text-[11px] sm:text-xs font-semibold text-purple-600 uppercase">Sick Quota</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-900 mt-0.5">3 Days / Yr</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm rounded-xl">
          <CardContent className="p-3 sm:pt-6">
            <p className="text-[11px] sm:text-xs font-semibold text-amber-600 uppercase">Privilege Quota</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-900 mt-0.5">10 Days / Yr</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-sm rounded-xl">
          <CardContent className="p-3 sm:pt-6">
            <p className="text-[11px] sm:text-xs font-semibold text-emerald-600 uppercase">Total Yearly</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-900 mt-0.5">15 Days Total</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-slate-200 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">All Employees & Staff</CardTitle>
              <CardDescription className="text-slate-500">
                Manually input taken leaves for each employee to calculate their live remaining balance.
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, code or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-slate-200 text-slate-900"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading employee list...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No employees found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50">
                    <TableHead className="font-bold text-slate-700">Employee</TableHead>
                    <TableHead className="font-bold text-slate-700">Role & Designation</TableHead>
                    <TableHead className="font-bold text-slate-700 text-center">Casual Taken (out of 2)</TableHead>
                    <TableHead className="font-bold text-slate-700 text-center">Sick Taken (out of 3)</TableHead>
                    <TableHead className="font-bold text-slate-700 text-center">Privilege Taken (out of 10)</TableHead>
                    <TableHead className="font-bold text-slate-700 text-center">Remaining Balance</TableHead>
                    <TableHead className="font-bold text-slate-700 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const key = u.code.toLowerCase();
                    const b = balances[key] || { casualTaken: 0, sickTaken: 0, privilegeTaken: 0 };
                    const live = liveBalances[key];
                    // Use live balance (includes new approved leaves) if available, else fall back to manual math
                    const casRemaining = live ? live.casual.remaining : Math.max(0, 2 - b.casualTaken);
                    const sickRemaining = live ? live.sick.remaining : Math.max(0, 3 - b.sickTaken);
                    const privRemaining = live ? live.privilege.remaining : Math.max(0, 10 - b.privilegeTaken);
                    const totalRemaining = casRemaining + sickRemaining + privRemaining;

                    return (
                      <TableRow key={u.id || u.code} className="border-slate-100 hover:bg-slate-50/80">
                        <TableCell className="font-medium text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {u.name ? u.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{u.name}</p>
                              <p className="text-xs text-slate-500 font-mono">{u.code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 border-slate-200">
                              {u.role}
                            </Badge>
                            <p className="text-xs text-slate-500">{u.designation || 'Staff'}</p>
                          </div>
                        </TableCell>

                        {/* Casual Input */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="2"
                              value={b.casualTaken}
                              onChange={(e) => handleTakenChange(u.code, 'casualTaken', e.target.value)}
                              className="w-16 text-center font-bold bg-white border-slate-200"
                            />
                            <span className="text-xs text-slate-400 font-medium">/ 2</span>
                          </div>
                        </TableCell>

                        {/* Sick Input */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="3"
                              value={b.sickTaken}
                              onChange={(e) => handleTakenChange(u.code, 'sickTaken', e.target.value)}
                              className="w-16 text-center font-bold bg-white border-slate-200"
                            />
                            <span className="text-xs text-slate-400 font-medium">/ 3</span>
                          </div>
                        </TableCell>

                        {/* Privilege Input */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              value={b.privilegeTaken}
                              onChange={(e) => handleTakenChange(u.code, 'privilegeTaken', e.target.value)}
                              className="w-16 text-center font-bold bg-white border-slate-200"
                            />
                            <span className="text-xs text-slate-400 font-medium">/ 10</span>
                          </div>
                        </TableCell>

                        {/* Calculated Live Remaining */}
                        <TableCell className="text-center font-mono text-xs">
                          <span className="text-blue-600 font-semibold">Casual: {casRemaining}/2 Left</span>{' '}
                          <span className="text-purple-600 font-semibold">Sick: {sickRemaining}/3 Left</span>{' '}
                          <span className="text-amber-600 font-semibold">Privilege: {privRemaining}/10 Left</span>
                          <div className="text-slate-500 font-bold text-[11px] mt-1">
                            Total Left: {totalRemaining} / 15
                          </div>
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={b.saving}
                            onClick={() => handleSave(u)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-sm"
                          >
                            <Save className="w-3.5 h-3.5" /> {b.saving ? 'Saving...' : 'Save'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
