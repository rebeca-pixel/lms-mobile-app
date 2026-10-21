import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { User as UserIcon, Mail, Briefcase, Building, AlertCircle, Calendar } from 'lucide-react';
import { ALL_HOLIDAYS } from '@/lib/data';
import { getLeaveBalance } from '@/lib/storage';
import { LeaveBalanceCard } from '@/components/LeaveBalanceCard';
import { useState, useEffect } from 'react';

export default function Profile() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBalance = async () => {
      if (user?.code || user?.id) {
        try {
          const data = await getLeaveBalance(user.code, user.id);
          setBalance(data);
        } catch (err) {
          console.error('Failed to load balance', err);
        }
      }
      setLoading(false);
    };
    loadBalance();
  }, [user]);

  if (!user) return null;

  // Get upcoming holidays (from current date onwards)
  const today = new Date();
  const upcomingHolidays = ALL_HOLIDAYS
    .filter(h => new Date(h.date) > today)
    .slice(0, 8);

  // upcomingHolidays computed below

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
        <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
          <span className="text-3xl sm:text-5xl font-bold text-white">{user.name.charAt(0)}</span>
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-1">{user.name}</h2>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-3 mt-2 sm:mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-600 font-medium">
              <Briefcase className="w-3.5 h-3.5 text-primary" />
              <span>{user.code}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-600 font-medium">
              <Building className="w-3.5 h-3.5 text-primary" />
              <span>{user.designation}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-600 font-medium">
              <UserIcon className="w-3.5 h-3.5 text-primary" />
              <span>{user.role}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Productivity Overview */}
        <Card className="bg-white border-slate-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-slate-900">Productivity Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Worked Days vs Target</span>
                <span className="text-slate-900 font-bold">— / — Days</span>
              </div>
              <Progress value={0} className="h-2 bg-primary/20" />
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Approved Leaves</p>
                  <p className="text-2xl font-bold text-slate-900">—</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Attendance Rate</p>
                  <p className="text-2xl font-bold text-primary">—</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <LeaveBalanceCard
          balance={balance}
          loading={loading}
          className="bg-white border-slate-200 shadow-sm"
        />

        {/* Holidays & Sundays Card */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Holidays & Sundays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-slate-600 font-medium">Public Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-slate-600 font-medium">Sunday (Off)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-slate-600 font-medium">Worked on Off Day</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Upcoming Holidays</p>
              {upcomingHolidays.map((holiday) => (
                <div key={holiday.date} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                  <span className="text-slate-700 font-medium">{holiday.name}</span>
                  <span className="text-slate-500">
                    {new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
