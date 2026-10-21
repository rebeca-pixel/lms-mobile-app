import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { getStoredLeaves, getStoredPermissions, getAllUsersAsync } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Calendar, Clock, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, parseISO, getMonth, startOfYear, eachMonthOfInterval, endOfYear } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function IndividualReport() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const users = await getAllUsersAsync();
      const foundUser = users.find(u => u.id === id || u.code === id);
      setEmployee(foundUser);

      if (foundUser) {
        const allLeaves = await getStoredLeaves();
        const userLeaves = allLeaves.filter(l => 
          (l.employeeCode === foundUser.code || l.employeeCode === foundUser.id || l.employeeName === foundUser.name) && 
          l.status === 'Approved'
        );
        setLeaves(userLeaves);

        const allPermissions = await getStoredPermissions();
        const userPermissions = allPermissions.filter(p => 
          (p.employeeCode === foundUser.code || p.employeeCode === foundUser.id || p.employeeName === foundUser.name) && 
          p.status === 'Approved'
        );
        setPermissions(userPermissions);
      }
      setLoading(false);
    };
    loadData();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]">Loading report...</div>;
  if (!employee) return <div className="text-center py-12 text-slate-500">Employee not found.</div>;

  // Prepare Chart Data
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = months.map((month, index) => {
    const monthLeaves = leaves.filter(l => getMonth(parseISO(l.startDate)) === index).length;
    const monthPermissions = permissions.filter(p => getMonth(parseISO(p.date)) === index).length;
    return {
      name: month,
      leaves: monthLeaves,
      permissions: monthPermissions,
      total: monthLeaves + monthPermissions
    };
  });

  const stats = [
    { label: 'Casual Leaves', value: leaves.filter(l => l.type === 'Casual').length, color: 'text-blue-500' },
    { label: 'Sick Leaves', value: leaves.filter(l => l.type === 'Sick').length, color: 'text-red-500' },
    { label: 'OD Requests', value: leaves.filter(l => l.type === 'OD').length, color: 'text-green-500' },
    { label: 'Permissions', value: permissions.length, color: 'text-yellow-500' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start sm:items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/reports')} className="text-slate-600 shrink-0 mt-1 sm:mt-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Performance Analytics</h2>
          <p className="text-xs sm:text-sm text-slate-600">Detailed tracking for {employee.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Profile Info */}
        <Card className="bg-white border-slate-200 shadow-sm md:col-span-1">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Profile Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-4">
            <div>
              <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-wider">Employee Name</p>
              <p className="text-slate-900 font-semibold text-sm sm:text-base">{employee.name}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-wider">Employee Code</p>
              <p className="text-primary font-mono font-bold text-sm sm:text-base">{employee.code}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-bold tracking-wider">Designation</p>
              <p className="text-slate-700 text-sm sm:text-base">{employee.designation}</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Analytics Cards */}
        <div className="md:col-span-2 grid grid-cols-2 gap-3 sm:gap-4">
          {stats.map((stat, idx) => (
            <Card key={idx} className="bg-white border-slate-200 shadow-sm hover:border-primary/50 transition-colors">
              <CardContent className="p-4 sm:pt-6">
                <p className="text-xs sm:text-sm font-medium text-slate-600">{stat.label}</p>
                <p className={`text-2xl sm:text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Line Chart */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Monthly Activity Trend
            </CardTitle>
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                 <span className="text-xs text-slate-600 font-medium">Leaves</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                 <span className="text-xs text-slate-600 font-medium">Permissions</span>
               </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-4">
          <div className="h-[250px] sm:h-[350px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorLeaves" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPerms" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '8px', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="leaves" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorLeaves)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="permissions" 
                  stroke="#eab308" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorPerms)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Summary Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-md font-bold">Recent Approved Leaves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaves.slice(0, 5).length > 0 ? leaves.slice(0, 5).map((l, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{l.type} Leave</p>
                    <p className="text-xs text-slate-500">{l.startDate} to {l.endDate}</p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>
                </div>
              )) : <p className="text-sm text-slate-500 italic">No leaves recorded.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-md font-bold">Recent Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {permissions.slice(0, 5).length > 0 ? permissions.slice(0, 5).map((p, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{p.type}</p>
                    <p className="text-xs text-slate-500">{p.date} | {p.startTime}-{p.endTime}</p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>
                </div>
              )) : <p className="text-sm text-slate-500 italic">No permissions recorded.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
