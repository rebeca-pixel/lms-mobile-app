import React from 'react';
import {
    Users, Building2, Clock, CheckCircle2, XCircle,
    Calendar, Briefcase, FileText, AlertCircle, PlusCircle,
    PieChart
} from 'lucide-react';
import './StatCards.css';

export interface Stat {
    label: string;
    value: number | string;
    type: 'info' | 'pending' | 'approved' | 'rejected' | 'quota' | 'total-leaves';
    subtext?: string;
}

interface StatCardsProps {
    stats: Stat[];
}

const iconMap: Record<string, any> = {
    'Total Employees': Users,
    'Departments': Building2,
    'Pending Leaves': Clock,
    'Approved': CheckCircle2,
    'Rejected': XCircle,
    'Total Casual': PieChart,
    'Total Sick': CheckCircle2,
    'Total OD': XCircle,
    'Total Comp Off': PlusCircle,
    'Total Permission': AlertCircle,
    'Total Leaves': FileText,
    'Leave Quota': PieChart,
    'Pending': Clock,
};

export const StatCards: React.FC<StatCardsProps> = ({ stats }) => {
    return (
        <div className="stat-cards-grid">
            {stats.map((stat, index) => {
                const Icon = iconMap[stat.label] || Users;
                return (
                    <div key={index} className={`stat-card card-glow-${stat.type}`}>
                        <div className="stat-card-inner">
                            <div className="stat-card-header">
                                <span className="stat-label">{stat.label}</span>
                                <div className="stat-icon-wrapper">
                                    <Icon className="stat-icon" />
                                </div>
                            </div>
                            <div className="stat-value-container">
                                <div className="stat-value">{stat.value}</div>
                                {stat.subtext && <div className="stat-subtext">{stat.subtext}</div>}
                            </div>
                        </div>
                        <div className="card-shine"></div>
                    </div>
                );
            })}
        </div>
    );
};
