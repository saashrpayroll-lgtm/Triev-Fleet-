import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import {
    Download,
    Search,
    Calendar,
    Users,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    SearchX,
    TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';

interface TLAllotmentMetric {
    team_leader_id: string;
    tl_name: string;
    tl_email: string;
    active_rider_count: number;
    positive_wallet_count: number;
    positive_wallet_total: number;
    negative_wallet_count: number;
    negative_wallet_total: number;
    allotment_count: number;
    submission_count: number;
    rent_collection_total: number;
}

const TLAllotment: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TLAllotmentMetric[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);

    // Date Range State - Default to TODAY (IST) for daily tracking
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
        const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const now = new Date();
        const istDateStr = istFormatter.format(now);

        // Create a date object that represents the start of the day in IST
        const [year, month, day] = istDateStr.split('-').map(Number);
        const istDate = new Date(year, month - 1, day);
        return [istDate, istDate];
    });
    const [startDate, endDate] = dateRange;

    const setPreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
        const now = new Date();
        const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
        const [year, month, day] = istDateStr.split('-').map(Number);

        // Use UTC Date objects to represent IST dates, preventing browser local timezone shifts
        // Midnight in our working UTC represents midnight in IST for DatePicker
        const workingDateUTC = new Date(year, month - 1, day); // Local browser date object trick

        switch (preset) {
            case 'today':
                setDateRange([workingDateUTC, workingDateUTC]);
                break;
            case 'yesterday':
                const yesterday = new Date(workingDateUTC);
                yesterday.setDate(workingDateUTC.getDate() - 1);
                setDateRange([yesterday, yesterday]);
                break;
            case 'week':
                const weekStart = new Date(workingDateUTC);
                weekStart.setDate(workingDateUTC.getDate() - 7);
                setDateRange([weekStart, workingDateUTC]);
                break;
            case 'month':
                const monthStart = new Date(workingDateUTC.getFullYear(), workingDateUTC.getMonth(), 1);
                setDateRange([monthStart, workingDateUTC]);
                break;
        }
    };

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const { data: metrics, error } = await supabase.rpc('get_tl_allotment_metrics', {
                p_start_date: startDate ? format(startDate, 'yyyy-MM-dd') : '1970-01-01',
                p_end_date: endDate ? format(endDate, 'yyyy-MM-dd') : '9999-12-31'
            });

            if (error) throw error;
            setData(metrics || []);
        } catch (error: any) {
            console.error('Error fetching allotment metrics:', error);
            toast.error('Failed to load metrics: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [startDate, endDate]);

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.tl_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.tl_email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const stats = useMemo(() => {
        return filteredData.reduce((acc, curr) => ({
            totalAllotments: acc.totalAllotments + Number(curr.allotment_count),
            totalSubmissions: acc.totalSubmissions + Number(curr.submission_count),
            totalRiders: acc.totalRiders + Number(curr.active_rider_count),
            totalCollection: acc.totalCollection + Number(curr.rent_collection_total)
        }), { totalAllotments: 0, totalSubmissions: 0, totalRiders: 0, totalCollection: 0 });
    }, [filteredData]);

    const exportToExcel = () => {
        const exportData = filteredData.map(item => ({
            'Team Leader': item.tl_name,
            'Email': item.tl_email,
            'Active Riders': item.active_rider_count,
            'Allotments (Period)': item.allotment_count,
            'Submissions (Period)': item.submission_count,
            'Net Growth': item.allotment_count - item.submission_count,
            'Rent Collection (Period)': item.rent_collection_total,
            'Positive Wallet Count': item.positive_wallet_count,
            'Positive Wallet Vol.': item.positive_wallet_total,
            'Negative Wallet Count': item.negative_wallet_count,
            'Negative Wallet Vol.': item.negative_wallet_total
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TL Allotments");
        XLSX.writeFile(wb, `tl_allotments_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast.success('Excel report exported');
        setIsExportOpen(false);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229);
        doc.text('TL Allotment & Submission Report', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Period: ${startDate ? format(startDate, 'PP') : 'Start'} - ${endDate ? format(endDate, 'PP') : 'End'}`, 14, 28);

        const tableColumn = ["TL Name", "Active Riders", "Allotments", "Submissions", "Net Growth", "Rent Col.", "Wallet Risk"];
        const tableRows = filteredData.map(item => [
            item.tl_name,
            item.active_rider_count,
            item.allotment_count,
            item.submission_count,
            item.allotment_count - item.submission_count,
            `INR ${Number(item.rent_collection_total).toLocaleString()}`,
            `INR ${Math.abs(item.negative_wallet_total).toLocaleString()}`
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 8 }
        });

        doc.save(`tl_allotments_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast.success('PDF report exported');
        setIsExportOpen(false);
    };

    return (
        <div className="p-6 space-y-6 bg-background min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">TL Allotment System</h1>
                    <p className="text-muted-foreground italic">Comprehensive tracking of Allotments vs EV Submissions (Inactivations).</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/40">
                        <button onClick={() => setPreset('today')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${!startDate || (startDate.toDateString() === new Date().toDateString() && (!endDate || endDate.toDateString() === new Date().toDateString())) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Today</button>
                        <button onClick={() => setPreset('yesterday')} className="px-3 py-1 text-[10px] font-black uppercase rounded-lg hover:bg-muted transition-all">Yesterday</button>
                        <button onClick={() => setPreset('week')} className="px-3 py-1 text-[10px] font-black uppercase rounded-lg hover:bg-muted transition-all">Last 7D</button>
                        <button onClick={() => setPreset('month')} className="px-3 py-1 text-[10px] font-black uppercase rounded-lg hover:bg-muted transition-all">This Month</button>
                    </div>

                    <div className="flex items-center bg-card border border-border rounded-xl px-3 py-1.5 shadow-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                        <DatePicker
                            selectsRange={true}
                            startDate={startDate}
                            endDate={endDate}
                            onChange={(update) => setDateRange(update)}
                            className="bg-transparent text-sm font-bold w-41 outline-none"
                            placeholderText="Custom Range"
                        />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                        >
                            <Download className="h-4 w-4" />
                            Export
                        </button>
                        {isExportOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2">
                                <button onClick={exportToExcel} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel Sheet (.xlsx)
                                </button>
                                <button onClick={exportToPDF} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500" /> PDF Report (.pdf)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Period Allotments', value: stats.totalAllotments, icon: ArrowUpRight, color: 'text-emerald-500', bg: 'from-emerald-500/10' },
                    { label: 'Period Submissions', value: stats.totalSubmissions, icon: ArrowDownRight, color: 'text-rose-500', bg: 'from-rose-500/10' },
                    { label: 'Active Force', value: stats.totalRiders, icon: Users, color: 'text-indigo-500', bg: 'from-indigo-500/10' },
                    { label: 'Total Collections', value: `₹${stats.totalCollection.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-500', bg: 'from-amber-500/10' },
                ].map((stat, i) => (
                    <div key={i} className={`p-5 rounded-2xl border border-border/50 bg-gradient-to-br ${stat.bg} to-transparent shadow-sm flex items-center justify-between`}>
                        <div>
                            <p className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">{stat.label}</p>
                            <h3 className="text-2xl font-black mt-1">{stat.value}</h3>
                        </div>
                        <div className={`p-3 rounded-xl bg-background border border-border/50 ${stat.color}`}>
                            <stat.icon className="h-5 w-5" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Table Container */}
            <div className="bg-card border border-border/40 rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/20">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by Team Leader..."
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/60 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-muted-foreground/60 uppercase tracking-tighter">
                            Live Allotment Sourcing Sync
                        </span>
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-muted/30 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b border-border/40">
                            <tr>
                                <th className="px-6 py-5">Team Leader</th>
                                <th className="px-6 py-5 text-center">Active Riders</th>
                                <th className="px-6 py-5 text-center">Wallet Status</th>
                                <th className="px-6 py-5 text-center">Allotments</th>
                                <th className="px-6 py-5 text-center">Submissions</th>
                                <th className="px-6 py-5 text-center">Rent Recovery</th>
                                <th className="px-6 py-5 text-center">Net Growth</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-8"><div className="h-8 bg-muted/40 rounded-xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <SearchX className="h-12 w-12 text-muted-foreground/20" />
                                            <p className="text-xl font-bold text-muted-foreground">No metrics found for this period.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((tl) => (
                                    <tr key={tl.team_leader_id} className="group hover:bg-primary/5 transition-all duration-300">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/20">
                                                    {tl.tl_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-foreground">{tl.tl_name}</p>
                                                    <p className="text-[10px] text-muted-foreground font-medium">{tl.tl_email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <span className="text-base font-black text-foreground">{tl.active_rider_count}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Riders</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="flex gap-2">
                                                    <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded border border-emerald-500/10">
                                                        {tl.positive_wallet_count} POS
                                                    </span>
                                                    <span className="text-[9px] font-black bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded border border-rose-500/10">
                                                        {tl.negative_wallet_count} NEG
                                                    </span>
                                                </div>
                                                <div className="flex justify-between w-full max-w-[120px] text-[10px] font-bold px-1">
                                                    <span className="text-emerald-500">₹{Number(tl.positive_wallet_total).toLocaleString()}</span>
                                                    <span className="text-rose-500">₹{Math.abs(tl.negative_wallet_total).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="inline-flex flex-col items-center p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20">
                                                <span className="text-lg font-black text-emerald-600">+{tl.allotment_count}</span>
                                                <Activity className="h-3 w-3 text-emerald-400 mt-1" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="inline-flex flex-col items-center p-2 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20">
                                                <span className="text-lg font-black text-rose-600">-{tl.submission_count}</span>
                                                <ArrowDownRight className="h-3 w-3 text-rose-400 mt-1" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-indigo-600">₹{Number(tl.rent_collection_total).toLocaleString()}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">Recovered</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className={`inline-flex flex-col items-center px-4 py-2 rounded-2xl border ${(tl.allotment_count - tl.submission_count) >= 0
                                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600'
                                                : 'bg-rose-500/5 border-rose-500/20 text-rose-600'
                                                }`}>
                                                <span className="text-lg font-black">
                                                    {(tl.allotment_count - tl.submission_count) > 0 ? '+' : ''}{tl.allotment_count - tl.submission_count}
                                                </span>
                                                <span className="text-[9px] font-black uppercase tracking-widest mt-0.5 italic">Net Growth</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TLAllotment;
