import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import {
    Download,
    Search,
    Filter,
    TrendingUp,
    Users,
    Wallet,
    ArrowUpRight,
    Activity,
    SearchX,
    Calendar,
    ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


const TLPerformance: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<{
        riders: any[];
        leads: any[];
        teamLeaders: any[];
    }>({ riders: [], leads: [], teamLeaders: [] });

    const [tlCollections, setTlCollections] = useState<Record<string, number>>({});
    const [dailyCollections, setDailyCollections] = useState<Record<string, number>>({});
    const [weeklyCollections, setWeeklyCollections] = useState<Record<string, number>>({});

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [riskFilter, setRiskFilter] = useState<'all' | 'high_risk' | 'low_risk'>('all');
    const [perfFilter, setPerfFilter] = useState<'all' | 'top_performers' | 'low_conversion'>('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);

    // New Date Filter States
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week'); // Default to week
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

    const fetchData = async () => {
        try {
            const [ridersRes, leadsRes, usersRes, dailyRes] = await Promise.all([
                supabase.from('riders').select('*'),
                supabase.from('leads').select('*'),
                supabase.from('users').select('*').eq('role', 'teamLeader'),
                supabase.from('daily_collections').select('*')
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (leadsRes.error) throw leadsRes.error;
            if (usersRes.error) throw usersRes.error;
            if (dailyRes.error) throw dailyRes.error;

            // Process Collections - ALIGN TO IST (India Standard Time)
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const todayStr = formatter.format(new Date());

            const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const weekStart = new Date(nowIST);
            weekStart.setDate(nowIST.getDate() - nowIST.getDay() + (nowIST.getDay() === 0 ? -6 : 1));
            const weekStartStr = formatter.format(weekStart);

            const totals: Record<string, number> = {};
            const daily: Record<string, number> = {};
            const weekly: Record<string, number> = {};

            dailyRes.data?.forEach(item => {
                const tlId = item.team_leader_id;
                const amt = Number(item.total_collection) || 0;

                totals[tlId] = (totals[tlId] || 0) + amt;
                if (item.date === todayStr) daily[tlId] = (daily[tlId] || 0) + amt;
                if (item.date >= weekStartStr) weekly[tlId] = (weekly[tlId] || 0) + amt;
            });

            setTlCollections(totals);
            setDailyCollections(daily);
            setWeeklyCollections(weekly);
            setRawData({
                riders: ridersRes.data || [],
                leads: leadsRes.data || [],
                teamLeaders: usersRes.data || []
            });
        } catch (error: any) {
            toast.error('Failed to load performance data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const channels = [
            supabase.channel('tl-perf-riders').on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchData).subscribe(),
            supabase.channel('tl-perf-leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData).subscribe(),
            supabase.channel('tl-perf-collections').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchData).subscribe()
        ];

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, []);

    const performanceData = useMemo(() => {
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const nowISTStr = formatter.format(new Date());
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

        // Determine Start and End dates for the selected filter
        let startDateStr = nowISTStr;
        let endDateStr = nowISTStr;

        if (dateFilter === 'week') {
            const weekStart = new Date(nowIST);
            weekStart.setDate(nowIST.getDate() - nowIST.getDay() + (nowIST.getDay() === 0 ? -6 : 1));
            startDateStr = formatter.format(weekStart);
        } else if (dateFilter === 'month') {
            const monthStart = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
            startDateStr = formatter.format(monthStart);
        } else if (dateFilter === 'custom' && customDateRange.start && customDateRange.end) {
            startDateStr = customDateRange.start;
            endDateStr = customDateRange.end;
        }

        const todayStart = new Date(nowISTStr).getTime();

        return rawData.teamLeaders.map(tl => {
            const tlId = tl.id;
            // Support both snake_case and camelCase from Supabase mappings
            const tlRiders = rawData.riders.filter(r => (r.team_leader_id === tlId || r.teamLeaderId === tlId) && !r.deleted_at);
            const tlLeads = rawData.leads.filter(l => l.created_by === tlId || l.createdBy === tlId);

            const activeRiders = tlRiders.filter(r => r.status === 'active').length;

            const wallet = tlRiders.reduce((acc, r) => ({
                total: acc.total + (r.wallet_amount || 0),
                positiveCount: acc.positiveCount + (r.wallet_amount > 0 ? 1 : 0),
                positiveAmount: acc.positiveAmount + (r.wallet_amount > 0 ? r.wallet_amount : 0),
                negativeCount: acc.negativeCount + (r.wallet_amount < 0 && r.status === 'active' ? 1 : 0),
                negativeAmount: acc.negativeAmount + (r.wallet_amount < 0 && r.status === 'active' ? r.wallet_amount : 0)
            }), { total: 0, positiveCount: 0, positiveAmount: 0, negativeCount: 0, negativeAmount: 0 });

            const converted = tlLeads.filter(l => l.status === 'Convert').length;
            const churnLeads = tlLeads.filter(l => l.status === 'Not Convert').length;
            const leadsToday = tlLeads.filter(l => new Date(l.created_at || l.createdAt).getTime() >= todayStart).length;
            const criticalDebtCount = tlRiders.filter(r => r.status === 'active' && (r.wallet_amount || 0) < -3000).length;

            const conversionRate = tlLeads.length > 0 ? Math.round((converted / tlLeads.length) * 100) : 0;

            const lastLeadTime = tlLeads.length > 0 ? Math.max(...tlLeads.map(l => new Date(l.created_at || l.createdAt).getTime())) : 0;
            const lastRiderUpdate = tlRiders.length > 0 ? Math.max(...tlRiders.map(r => new Date(r.updated_at || r.updatedAt || r.created_at || r.createdAt).getTime())) : 0;
            const activityTime = Math.max(lastLeadTime, lastRiderUpdate);
            const lastActivity = activityTime > 0 ? new Date(activityTime).toISOString() : undefined;

            // Date Range metrics calculations
            const allotments = tlRiders.filter(r => {
                if (!r.allotment_date) return false;
                // Parse date string (assumes YYYY-MM-DD or timestamp)
                const adStr = typeof r.allotment_date === 'string' ? r.allotment_date.split('T')[0] : formatter.format(new Date(r.allotment_date));
                return adStr >= startDateStr && adStr <= endDateStr;
            }).length;

            const submissions = rawData.riders.filter(r => {
                // Must be inactive, and inactivated_at must fall in range, AND assigned to this TL
                if (r.status !== 'inactive' || !r.inactivated_at) return false;
                if (r.team_leader_id !== tlId && r.teamLeaderId !== tlId) return false;

                const sdStr = typeof r.inactivated_at === 'string' ? r.inactivated_at.split('T')[0] : formatter.format(new Date(r.inactivated_at));
                return sdStr >= startDateStr && sdStr <= endDateStr;
            }).length;

            const netGrowth = allotments - submissions;

            return {
                id: tlId,
                name: tl.full_name || tl.fullName || 'Unknown',
                email: tl.email,
                totalRiders: tlRiders.length,
                activeRiders,
                wallet,
                leads: {
                    total: tlLeads.length,
                    converted,
                    conversionRate
                },
                status: tl.status,
                totalCollection: tlCollections[tlId] || 0,
                dailyCollection: dailyCollections[tlId] || 0,
                weeklyCollection: weeklyCollections[tlId] || 0,
                leadsToday,
                churnLeads,
                criticalDebtCount,
                allotments,
                submissions,
                netGrowth,
                lastActivity
            };
        });
    }, [rawData, tlCollections, dailyCollections, weeklyCollections]);

    const filteredData = performanceData.filter(tl => {
        const matchesSearch = tl.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tl.email.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || tl.status === filterStatus;

        const matchesRisk = riskFilter === 'all' ||
            (riskFilter === 'high_risk' && tl.criticalDebtCount > 0) ||
            (riskFilter === 'low_risk' && tl.criticalDebtCount === 0);

        const matchesPerf = perfFilter === 'all' ||
            (perfFilter === 'top_performers' && tl.leads.conversionRate >= 50) ||
            (perfFilter === 'low_conversion' && tl.leads.conversionRate < 10 && tl.leads.total > 0);

        return matchesSearch && matchesStatus && matchesRisk && matchesPerf;
    });

    const exportToExcel = () => {
        const data = filteredData.map(tl => ({
            'Name': tl.name,
            'Email': tl.email,
            'Active Riders': tl.activeRiders,
            'Total Riders': tl.totalRiders,
            'Total Collection': tl.totalCollection,
            'Daily Collection': tl.dailyCollection,
            'Weekly Collection': tl.weeklyCollection,
            'Positive Riders': tl.wallet.positiveCount,
            'Positive Volume': tl.wallet.positiveAmount,
            'Negative Riders': tl.wallet.negativeCount,
            'Risk Amount': Math.abs(tl.wallet.negativeAmount),
            'Leads Today': tl.leadsToday,
            'Churn Leads': tl.churnLeads,
            'Conversion Rate': tl.leads.conversionRate + '%',
            'Allotments': tl.allotments,
            'Submissions': tl.submissions,
            'Net Growth': tl.netGrowth,
            'Date Filter Selected': dateFilter,
            'Custom Start': customDateRange.start,
            'Custom End': customDateRange.end
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Performance");
        XLSX.writeFile(wb, `tl_performance_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel report exported successfully');
        setIsExportOpen(false);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        // Branded Header
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229); // Indigo-600
        doc.text('Team Leader Performance Report', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        const tableColumn = [
            "TL Name",
            "Active",
            "Daily Col.",
            "Weekly Col.",
            "Pos/Neg",
            "Risk Amt",
            "Metrics (A/S/N)",
            "Conversion"
        ];

        const tableRows = filteredData.map(tl => [
            tl.name,
            `${tl.activeRiders}/${tl.totalRiders}`,
            `INR ${tl.dailyCollection.toLocaleString()}`,
            `INR ${tl.weeklyCollection.toLocaleString()}`,
            `${tl.wallet.positiveCount}/${tl.wallet.negativeCount}`,
            `INR ${Math.abs(tl.wallet.negativeAmount).toLocaleString()}`,
            `${tl.allotments}/${tl.submissions}/${tl.netGrowth}`,
            `${tl.leads.conversionRate}%`
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 8, cellPadding: 3 },
            alternateRowStyles: { fillColor: [249, 250, 251] }
        });

        doc.save(`tl_performance_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('PDF report exported successfully');
        setIsExportOpen(false);
    };

    const exportToCSV = () => {
        const headers = ['Name', 'Email', 'Active Riders', 'Total Riders', 'Total Collection', 'Daily Collection', 'Weekly Collection', 'Positive Riders', 'Positive Volume', 'Negative Riders', 'Risk Amount', 'Leads Today', 'Churn Leads', 'Conversion Rate', 'Allotments', 'Submissions', 'Net Growth'];
        const rows = filteredData.map(tl => [
            tl.name,
            tl.email,
            tl.activeRiders,
            tl.totalRiders,
            tl.totalCollection,
            tl.dailyCollection,
            tl.weeklyCollection,
            tl.wallet.positiveCount,
            tl.wallet.positiveAmount,
            tl.wallet.negativeCount,
            Math.abs(tl.wallet.negativeAmount),
            tl.leadsToday,
            tl.churnLeads,
            tl.leads.conversionRate + '%',
            tl.allotments,
            tl.submissions,
            tl.netGrowth
        ]);

        const csvContent = "data:text/csv;charset=utf-8," +
            headers.join(",") + "\n" +
            rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `tl_performance_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV report exported successfully');
        setIsExportOpen(false);
    };

    return (
        <div className="p-6 space-y-6 bg-background min-h-screen pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Team Leader Performance Center</h1>
                    <p className="text-muted-foreground">Real-time analytical depth and operational insights for all Team Leaders.</p>
                </div>
                <div className="flex items-center gap-3 relative">
                    <div className="relative">
                        <button
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors shadow-sm"
                        >
                            <Download className="h-4 w-4" />
                            Export Reports
                        </button>
                        {isExportOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-in slide-in-from-top-2">
                                <button onClick={exportToExcel} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel Spreadsheet (.xlsx)
                                </button>
                                <button onClick={exportToPDF} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500" /> Portable Document (.pdf)
                                </button>
                                <button onClick={exportToCSV} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2 border-t pt-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-400" /> Legacy CSV (.csv)
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full text-xs font-bold">
                        <Activity className="h-3 w-3 animate-pulse" />
                        Live Neural Sync
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Weekly Collection', value: `₹${Object.values(weeklyCollections).reduce((a, b) => a + b, 0).toLocaleString()}`, desc: 'All active Team Leaders', icon: TrendingUp, color: 'text-emerald-500', bg: 'from-emerald-500/10' },
                    { label: 'Total Leads Today', value: `+${performanceData.reduce((a, b) => a + b.leadsToday, 0)}`, desc: 'New opportunities in 24h', icon: ArrowUpRight, color: 'text-indigo-500', bg: 'from-indigo-500/10' },
                    { label: 'Total Active Riders', value: performanceData.reduce((a, b) => a + b.activeRiders, 0), desc: 'Currently on-road', icon: Users, color: 'text-amber-500', bg: 'from-amber-500/10' },
                    { label: 'Total Market Risk', value: `₹${Math.abs(performanceData.reduce((a, b) => a + b.wallet.negativeAmount, 0)).toLocaleString()}`, desc: 'Total negative balance', icon: Wallet, color: 'text-rose-500', bg: 'from-rose-500/10' }
                ].map((card, i) => (
                    <div key={i} className={`p-5 rounded-2xl border border-border/50 bg-gradient-to-br ${card.bg} to-transparent shadow-sm space-y-3`}>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{card.label}</span>
                            <card.icon className={`h-4 w-4 ${card.color}`} />
                        </div>
                        <div className="text-2xl font-black">{card.value}</div>
                        <p className="text-[10px] text-muted-foreground font-medium">{card.desc}</p>
                    </div>
                ))}
            </div>

            {/* Table Search & Filter */}
            <div className="bg-card border border-border/40 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-border/40 bg-muted/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <h2 className="text-lg font-bold">Team Leader Analysis Table</h2>
                            <p className="text-xs text-muted-foreground">Comprehensive breakdown of TL performance across all key verticals.</p>
                        </div>
                        <div className="flex items-center gap-2 relative">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 relative w-full md:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hidden md:block" />
                                <input
                                    placeholder="Search TL Name or Email..."
                                    className="w-full md:w-64 pl-4 md:pl-9 pr-4 py-2 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />

                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <div className="relative flex-1 md:flex-none">
                                        <select
                                            value={dateFilter}
                                            onChange={(e: any) => setDateFilter(e.target.value)}
                                            className="w-full md:w-auto pl-9 pr-8 py-2 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none shadow-sm font-medium text-primary"
                                        >
                                            <option value="today">Today Metrics</option>
                                            <option value="week">Weekly Metrics</option>
                                            <option value="month">Monthly Metrics</option>
                                            <option value="custom">Custom Date Range</option>
                                        </select>
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 pointer-events-none" />
                                    </div>

                                    {dateFilter === 'custom' && (
                                        <div className="flex items-center gap-2 bg-background border border-border/60 rounded-xl p-1 shadow-sm">
                                            <input
                                                type="date"
                                                className="text-xs py-1 px-2 focus:outline-none bg-transparent rounded"
                                                value={customDateRange.start}
                                                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                                            />
                                            <span className="text-muted-foreground text-xs font-bold">-</span>
                                            <input
                                                type="date"
                                                className="text-xs py-1 px-2 focus:outline-none bg-transparent rounded"
                                                value={customDateRange.end}
                                                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                                        className={`p-2 border border-border/60 rounded-xl transition-colors bg-background shadow-sm hover:bg-muted ml-auto ${(filterStatus !== 'all' || riskFilter !== 'all' || perfFilter !== 'all') ? 'ring-2 ring-primary/20 bg-primary/5 text-primary' : ''}`}
                                    >
                                        <Filter className="h-4 w-4" />
                                    </button>
                                </div>
                                {isFilterOpen && (
                                    <div className="absolute right-0 mt-3 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 p-6 space-y-5 animate-in slide-in-from-top-4">
                                        <div className="flex items-center justify-between border-b pb-3">
                                            <span className="font-black text-xs uppercase tracking-widest italic">Neural Filter Core</span>
                                            <button onClick={() => { setFilterStatus('all'); setRiskFilter('all'); setPerfFilter('all'); }} className="text-[10px] text-primary font-bold hover:underline">Reset All</button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Account Status</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {['all', 'active', 'inactive'].map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => setFilterStatus(s as any)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                                                        >
                                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Debt Exposure Matrix</label>
                                                <div className="space-y-2">
                                                    {[
                                                        { id: 'all', label: 'All Risks' },
                                                        { id: 'high_risk', label: 'Critical Debt Only' },
                                                        { id: 'low_risk', label: 'Safe Balance Only' }
                                                    ].map(r => (
                                                        <button
                                                            key={r.id}
                                                            onClick={() => setRiskFilter(r.id as any)}
                                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${riskFilter === r.id ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background hover:bg-muted'}`}
                                                        >
                                                            {r.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Performance Tier</label>
                                                <div className="space-y-2">
                                                    {[
                                                        { id: 'all', label: 'All Performance Tiers' },
                                                        { id: 'top_performers', label: 'High Conversion (50%+)' },
                                                        { id: 'low_conversion', label: 'Conversion Laggards (<10%)' }
                                                    ].map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => setPerfFilter(p.id as any)}
                                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${perfFilter === p.id ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background hover:bg-muted'}`}
                                                        >
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setIsFilterOpen(false)}
                                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
                                        >
                                            Engage Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-muted-foreground uppercase bg-muted/10 font-black tracking-widest border-b border-border/40">
                            <tr>
                                <th className="px-6 py-5">Team Leader</th>
                                <th className="px-6 py-5 text-center">Rider Force</th>
                                <th className="px-6 py-5">Wallet Health (Pos/Neg/Risk)</th>
                                <th className="px-6 py-5">Collections (Daily/Weekly)</th>
                                <th className="px-6 py-5">Fleet Flow (A/S/N)</th>
                                <th className="px-6 py-5">Leads Sourcing</th>
                                <th className="px-6 py-5 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {loading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-8"><div className="h-8 bg-muted/40 rounded-lg w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="p-4 bg-muted/30 rounded-full">
                                                <SearchX className="h-10 w-10 text-muted-foreground/40" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-muted-foreground text-xl">No Results Found</p>
                                                <p className="text-sm text-muted-foreground/60">Try adjusting your search criteria.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((tl) => (
                                    <tr key={tl.id} className="group hover:bg-muted/5 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="relative shrink-0">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-600 text-lg">
                                                        {tl.name.charAt(0)}
                                                    </div>
                                                    {tl.lastActivity && (new Date().getTime() - new Date(tl.lastActivity).getTime() < 30 * 60 * 1000) && (
                                                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-background"></span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-black text-foreground text-sm flex items-center gap-2">
                                                        {tl.name}
                                                        {tl.leadsToday > 3 && (
                                                            <span className="px-1.5 py-0.5 bg-orange-500 rounded text-[9px] text-white font-black animate-bounce">
                                                                HOT
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground font-medium">{tl.email}</p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-lg font-black text-foreground leading-none">{tl.activeRiders} <span className="text-xs font-bold text-muted-foreground/60">/ {tl.totalRiders}</span></span>
                                                <div className="w-24 h-2 bg-muted/50 rounded-full overflow-hidden border border-border/20">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000"
                                                        style={{ width: `${tl.totalRiders > 0 ? (tl.activeRiders / tl.totalRiders) * 100 : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="space-y-2.5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="shrink-0 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-black border border-emerald-500/10 italic">
                                                        {tl.wallet.positiveCount} POS
                                                    </span>
                                                    <span className="shrink-0 bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-md text-[10px] font-black border border-rose-500/10 italic">
                                                        {tl.wallet.negativeCount} NEG
                                                    </span>
                                                    {tl.criticalDebtCount > 0 && (
                                                        <span className="shrink-0 bg-rose-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black animate-pulse shadow-lg shadow-rose-500/20">
                                                            {tl.criticalDebtCount} CRITICAL
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center text-[11px] font-black px-1">
                                                    <span className="text-emerald-500">₹{tl.wallet.positiveAmount.toLocaleString()}</span>
                                                    <span className="text-rose-600">₹{Math.abs(tl.wallet.negativeAmount).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5 font-mono">
                                            <div className="space-y-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">Daily Vol.</span>
                                                    <span className="text-base font-black text-emerald-600">₹{tl.dailyCollection.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center border-t border-border/40 pt-1.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] text-muted-foreground font-black uppercase">Weekly</span>
                                                        <span className="text-xs font-black text-foreground/80 font-mono">₹{tl.weeklyCollection.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[8px] text-muted-foreground font-black uppercase">Grand</span>
                                                        <span className="text-xs font-black text-foreground/50 font-mono">₹{tl.totalCollection.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="space-y-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">Net Growth</span>
                                                    <span className={`text-base font-black ${tl.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {tl.netGrowth > 0 ? '+' : ''}{tl.netGrowth}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center border-t border-border/40 pt-1.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] text-muted-foreground font-black uppercase">Allotment</span>
                                                        <span className="text-xs font-black text-indigo-600">+{tl.allotments}</span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[8px] text-muted-foreground font-black uppercase">Submission</span>
                                                        <span className="text-xs font-black text-rose-500">-{tl.submissions}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="relative w-11 h-11 shrink-0">
                                                    <svg className="w-full h-full transform -rotate-90">
                                                        <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-muted/10" />
                                                        <circle
                                                            cx="22" cy="22" r="18"
                                                            stroke="currentColor" strokeWidth="3" fill="transparent"
                                                            strokeDasharray={113}
                                                            strokeDashoffset={113 - (113 * tl.leads.conversionRate) / 100}
                                                            className="text-indigo-500 transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                                        />
                                                    </svg>
                                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                                                        {tl.leads.conversionRate}%
                                                    </span>
                                                </div>
                                                <div className="space-y-1 text-[11px] font-black">
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-muted-foreground uppercase text-[9px]">Sourced</span>
                                                        <span className="text-indigo-600 italic">+{tl.leadsToday}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-muted-foreground uppercase text-[9px]">Churned</span>
                                                        <span className="text-rose-500 italic">-{tl.churnLeads}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5 text-right">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${tl.status === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                                }`}>
                                                {tl.status}
                                            </span>
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

export default TLPerformance;
