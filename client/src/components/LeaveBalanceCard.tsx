import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, AlertCircle } from 'lucide-react';
import './LeaveBalanceCard.css';

interface LeaveBalance {
    casual: { total: number; used: number; remaining: number };
    sick: { total: number; used: number; remaining: number };
    privilege?: { total: number; used: number; remaining: number };
}

interface LeaveBalanceCardProps {
    balance: LeaveBalance | null;
    loading?: boolean;
    className?: string; // Allow passing styles
}

export const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({ balance, loading, className }) => {
    if (loading || !balance) {
        return (
            <Card className={`${className} animate-pulse`}>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-white/10 rounded-full" />
                        <div className="w-32 h-6 bg-white/10 rounded" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-3">
                            <div className="flex justify-between">
                                <div className="w-40 h-4 bg-white/10 rounded" />
                                <div className="w-12 h-4 bg-white/10 rounded" />
                            </div>
                            <div className="w-full h-2.5 bg-white/5 rounded" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    const casualPercent = (balance.casual.used / balance.casual.total) * 100;
    const sickPercent = (balance.sick.used / balance.sick.total) * 100;
    const privilegeBalance = balance.privilege || { total: 10, used: 0, remaining: 10 };
    const privilegePercent = (privilegeBalance.used / privilegeBalance.total) * 100;

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    Leave Balance
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Personal Leave */}
                <div className="leave-type-item">
                    <div className="type-info">
                        <span className="type-label text-slate-700 font-medium">Personal (Casual) Leave</span>
                        <div className="type-ratio flex flex-col items-end">
                            <span className="text-xs font-semibold text-slate-700">
                                {balance.casual.used} Used <span className="text-slate-400 font-normal">({balance.casual.remaining} Left)</span>
                            </span>
                        </div>
                    </div>
                    <div className="progress-track">
                        <div
                            className="progress-fill fill-personal"
                            style={{ width: `${Math.min(100, casualPercent)}%` }}
                        />
                    </div>
                </div>

                {/* Sick Leave */}
                <div className="leave-type-item">
                    <div className="type-info">
                        <span className="type-label text-slate-700 font-medium">Sick Leave</span>
                        <div className="type-ratio flex flex-col items-end">
                            <span className="text-xs font-semibold text-slate-700">
                                {balance.sick.used} Used <span className="text-slate-400 font-normal">({balance.sick.remaining} Left)</span>
                            </span>
                        </div>
                    </div>
                    <div className="progress-track">
                        <div
                            className="progress-fill fill-sick"
                            style={{ width: `${Math.min(100, sickPercent)}%` }}
                        />
                    </div>
                </div>

                {/* Privilege Leave */}
                <div className="leave-type-item">
                    <div className="type-info">
                        <span className="type-label text-slate-700 font-medium">Privilege Leave</span>
                        <div className="type-ratio flex flex-col items-end">
                            <span className="text-xs font-semibold text-slate-700">
                                {privilegeBalance.used} Used <span className="text-slate-400 font-normal">({privilegeBalance.remaining} Left)</span>
                            </span>
                        </div>
                    </div>
                    <div className="progress-track bg-amber-100">
                        <div
                            className="progress-fill bg-amber-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, privilegePercent)}%` }}
                        />
                    </div>
                </div>

                <div className="pt-2 border-t border-white/5 text-[10px] text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-cyan-500" />
                    <span>Balances reset on Jan 1st of every year.</span>
                </div>
            </CardContent>
        </Card>
    );
};
