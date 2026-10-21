import { getStoredLeaves } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { startOfYear, format, getMonth, parseISO } from 'date-fns';

export default function Charts() {
  const [leaves, setLeaves] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const l = await getStoredLeaves();
        if (!mounted) return;
        setLeaves(l);
      } catch (err) {
        console.error('Error loading leaves for charts', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Data for Bar Chart (Leave Type Distribution)
  const typeCount = leaves.reduce((acc, leave) => {
    acc[leave.type] = (acc[leave.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.keys(typeCount).map(key => ({
    name: key,
    count: typeCount[key]
  }));

  // Data for Pie Chart (Status Distribution)
  const statusCount = leaves.reduce((acc, leave) => {
    acc[leave.status] = (acc[leave.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(statusCount).map(key => ({
    name: key,
    value: statusCount[key]
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Data for Line Chart (Trends) - Dynamic Calculation
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const leavesByMonth = new Array(12).fill(0);

  leaves.forEach(leave => {
    try {
      const date = parseISO(leave.startDate);
      const monthIndex = getMonth(date);
      leavesByMonth[monthIndex]++;
    } catch (e) {
      console.error("Invalid date", leave.startDate);
    }
  });

  const trendData = months.map((month, index) => ({
    name: month,
    leaves: leavesByMonth[index]
  }));

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-1 sm:mb-2">Analytics & Charts</h2>
        <p className="text-xs sm:text-sm text-slate-600">Visual insights into leave trends and productivity</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base sm:text-lg text-slate-900">Leave Type Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-[250px] sm:h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a' }}
                    itemStyle={{ color: '#0f172a' }}
                  />
                  <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base sm:text-lg text-slate-900">Request Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-[250px] sm:h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={75}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm lg:col-span-2 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base sm:text-lg text-slate-900">Monthly Leave Trends</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-[250px] sm:h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0' }} />
                  <Line type="monotone" dataKey="leaves" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
