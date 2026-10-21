import { useState, useEffect } from 'react';
import { getStoredPermissions, PermissionRequest } from '@/lib/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Search, Download, Calendar, Clock, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

export default function ApprovedPermissions() {
    const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('ALL');
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const loadPermissions = async () => {
            const allPermissions = await getStoredPermissions();
            const approved = allPermissions.filter(p => p.status === 'Approved');
            setPermissions(approved);
            setLoading(false);
        };
        loadPermissions();
    }, []);

    const exportToExcel = () => {
        try {
            const exportData = filteredPermissions.map(p => ({
                'Employee Name': p.employeeName,
                'Employee Code': p.employeeCode,
                'Permission Type': p.type,
                'Date': p.date,
                'Start Time': p.startTime,
                'End Time': p.endTime,
                'Approved By': p.actionBy || '-',
                'Reason': p.reason
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Approved Permissions');
            XLSX.writeFile(wb, `Approved-Permissions-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

            toast({
                title: "Success",
                description: "Export completed successfully!",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to export data",
                variant: "destructive"
            });
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedType('ALL');
        setSelectedDate('');
    };

    const filteredPermissions = permissions.filter(p => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = term === '' ||
            (p.employeeName || '').toLowerCase().includes(term) ||
            (p.employeeCode || '').toLowerCase().includes(term);
        const matchesType = selectedType === 'ALL' || p.type === selectedType;
        const matchesDate = !selectedDate || p.date === selectedDate;
        return matchesSearch && matchesType && matchesDate;
    });

    const getPermissionTypeColor = (type: string) => {
        switch (type) {
            case 'Late Entry Permission': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
            case 'Early Exit Permission': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
            case 'Personal Work Permission': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'Emergency Permission': return 'bg-red-500/10 text-red-600 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
        }
    };

    return (
        <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-1">Approved Permissions</h2>
                    <p className="text-xs sm:text-sm text-slate-600">History of all finalized short-leave permissions</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                    {/* Employee Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search Employee / Code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 bg-white border-slate-200 text-xs sm:text-sm"
                        />
                    </div>

                    {/* Permission Type Filter */}
                    <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger className="h-10 bg-white border-slate-200 text-xs sm:text-sm">
                            <SelectValue placeholder="All Permission Types" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 text-slate-900">
                            <SelectItem value="ALL">All Permission Types</SelectItem>
                            <SelectItem value="Late Entry Permission">Late Entry Permission</SelectItem>
                            <SelectItem value="Early Exit Permission">Early Exit Permission</SelectItem>
                            <SelectItem value="Personal Work Permission">Personal Work Permission</SelectItem>
                            <SelectItem value="Emergency Permission">Emergency Permission</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Date Filter */}
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-9 h-10 bg-white border-slate-200 text-xs sm:text-sm"
                        />
                    </div>

                    {/* Action Buttons: Clear & Export */}
                    <div className="flex gap-2">
                        {(searchTerm || selectedType !== 'ALL' || selectedDate) && (
                            <Button
                                onClick={clearFilters}
                                variant="outline"
                                className="h-10 px-3 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1 shrink-0"
                                title="Clear filters"
                            >
                                <X className="w-3.5 h-3.5" /> Clear
                            </Button>
                        )}
                        <Button
                            onClick={exportToExcel}
                            className="flex-1 h-10 text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm flex items-center justify-center gap-1.5"
                        >
                            <Download className="w-4 h-4" /> Export Excel
                        </Button>
                    </div>
                </div>

                {/* Results Counter */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <span>
                        Showing <strong className="text-slate-800">{filteredPermissions.length}</strong> of {permissions.length} approved permissions
                    </span>
                    {(searchTerm || selectedType !== 'ALL' || selectedDate) && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px]">
                            Filters active
                        </Badge>
                    )}
                </div>
            </div>

            {/* Mobile Card View (visible on <640px) */}
            <div className="block sm:hidden space-y-3">
                {loading ? (
                    <div className="text-center py-8 text-slate-500 italic bg-white rounded-xl border border-slate-200">
                        Loading permissions...
                    </div>
                ) : filteredPermissions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 italic bg-white rounded-xl border border-slate-200">
                        No approved permissions found matching your filters.
                    </div>
                ) : (
                    filteredPermissions.map((item) => (
                        <Card key={item.id} className="bg-white border-slate-200 shadow-sm p-4 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">{item.employeeName}</h4>
                                    <span className="text-primary font-mono font-bold text-xs">{item.employeeCode}</span>
                                </div>
                                <Badge variant="outline" className={getPermissionTypeColor(item.type)}>
                                    {item.type}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Date</span>
                                    <span className="font-semibold text-slate-700">{item.date}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Timing</span>
                                    <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {item.startTime} - {item.endTime}
                                    </span>
                                </div>
                            </div>

                            {item.reason && (
                                <p className="text-xs text-slate-600 italic bg-white p-2 rounded border border-slate-100">
                                    "{item.reason}"
                                </p>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                                <span>Approved by: <strong className="text-slate-700">{item.actionBy || '-'}</strong></span>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Desktop Table View (hidden on <640px) */}
            <Card className="hidden sm:block bg-white border-slate-200 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold">Employee</TableHead>
                                    <TableHead className="font-bold">Type</TableHead>
                                    <TableHead className="font-bold">Timing</TableHead>
                                    <TableHead className="font-bold">Date</TableHead>
                                    <TableHead className="font-bold">Reason</TableHead>
                                    <TableHead className="font-bold">Approved By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500 italic">
                                            Loading permissions...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredPermissions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500 italic">
                                            No approved permissions found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPermissions.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-slate-50 border-slate-100">
                                            <TableCell>
                                                <div className="font-medium text-slate-900">{item.employeeName}</div>
                                                <div className="text-xs text-primary font-mono font-bold">{item.employeeCode}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getPermissionTypeColor(item.type)}>
                                                    {item.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-slate-600 text-sm font-medium">
                                                    <Clock className="w-3 h-3" />
                                                    {item.startTime} - {item.endTime}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-600 text-sm font-medium">
                                                {item.date}
                                            </TableCell>
                                            <TableCell className="text-slate-600 max-w-[200px] truncate" title={item.reason}>
                                                {item.reason}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs font-medium text-slate-700">{item.actionBy || '-'}</div>
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
