import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { Rider, User, Request } from '@/types';
import {
    FileText, Download, TrendingUp,
    Users, Shield, Activity, Wallet, RefreshCw, BarChart3,
    ArrowUpRight, ArrowDownRight, Printer, LayoutDashboard, List
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
    REPORT_TEMPLATES,
    generateRiderListReport,
    generateWalletSummaryReport,
    generateClientDistributionReport,
    generateTeamLeaderPerformanceReport,
    generateRequestReport,
    generateActivityReport,
    generateSystemHealthReport,
    generateTLDailyCollectionReport,
    generateRevenueReport,
    generateDefaulterReport,
    generateCollectionSummaryReport,
    generateRiderTenureReport,
    generateWalletRiskReport,
    generatePaymentConsistencyReport,
    generateFleetHealthReport,
    transformRiderData,
    ActivityLogEntry,
} from '@/utils/reportUtils';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/exportUtils';

// --- Types ---
interface ReportFilters {
    status: string;
    client: string;
    teamLeader: string;
    startDate: string;
    endDate: string;
}

// --- Constants ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface SummaryStat {
    label: string;
    value: string | number;
    color: string;
}

const Reports: React.FC = () => {
    // --- State ---
    const [viewMode, setViewMode] = useState<'dashboard' | 'reports'>('dashboard');
    const [loading, setLoading] = useState(true);

    // Data State
    const [riders, setRiders] = useState<Rider[]>([]);
    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [requests, setRequests] = useState<Request[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [dailyCollections, setDailyCollections] = useState<any[]>([]);
    const [selectedTLs, setSelectedTLs] = useState<string[]>([]); // New State for Multi-select
    const [filters, setFilters] = useState<ReportFilters>({
        status: 'all',
        client: 'all',
        teamLeader: 'all',
        startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });
    const [threshold] = useState(-1000); // Default threshold for defaulters

    // Report Generation State
    const [selectedTemplate, setSelectedTemplate] = useState('active_riders');
    const [reportData, setReportData] = useState<any[]>([]);
    const [reportStats, setReportStats] = useState<SummaryStat[]>([]);
    const [reportGenerated, setReportGenerated] = useState(false);
    const [generating, setGenerating] = useState(false);

    // --- Effects ---
    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [ridersRes, usersRes, requestsRes, leadsRes, dailyCollectionsRes] = await Promise.all([
                supabase.from('riders').select(`
                    id, 
                    trievId:triev_id, 
                    riderName:rider_name, 
                    mobileNumber:mobile_number, 
                    chassisNumber:chassis_number, 
                    clientName:client_name, 
                    clientId:client_id, 
                    walletAmount:wallet_amount, 
                    allotmentDate:allotment_date, 
                    remarks,
                    status, 
                    teamLeaderId:team_leader_id,
                    teamLeaderName:team_leader_name,
                    createdAt:created_at
                `),
                supabase.from('users').select(`
                    id, fullName:full_name, email, role, status
                `),
                supabase.from('requests').select(`
                    id, ticketId:ticket_id, type, subject, description, priority, 
                    status, userId:user_id, userName:user_name, userRole:user_role, 
                    createdAt:created_at
                `),
                supabase.from('leads').select('id, created_at, status'),
                supabase.from('daily_collections').select('*')
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (usersRes.error) throw usersRes.error;
            if (requestsRes.error) throw requestsRes.error;
            if (leadsRes.error) throw leadsRes.error;
            if (dailyCollectionsRes.error) throw dailyCollectionsRes.error;

            setRiders((ridersRes.data || []) as any);
            setTeamLeaders((usersRes.data || []).filter((u: any) => u.role === 'teamLeader') as any);
            setRequests((requestsRes.data || []) as any);
            setLeads(leadsRes.data || []);
            setDailyCollections(dailyCollectionsRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error("Failed to fetch analytics data");
        } finally {
            setLoading(false);
        }
    };

    // --- Analytics Computations ---
    const analytics = useMemo(() => {
        // Filter base data by Date Range (using created_at for simplicity)
        const start = startOfDay(parseISO(filters.startDate));
        const end = endOfDay(parseISO(filters.endDate));

        const filteredRiders = riders.filter(r => {
            const dateMatch = isWithinInterval(parseISO(r.createdAt || new Date().toISOString()), { start, end });
            const clientMatch = filters.client === 'all' || r.clientName === filters.client;
            return dateMatch && clientMatch;
        });

        const requestsInPeriod = requests.filter(r => {
            return isWithinInterval(parseISO(r.createdAt), { start, end });
        });

        // KPI Calculations
        const totalWallet = riders.reduce((sum, r) => sum + (Number(r.walletAmount) || 0), 0);
        const activeRidersCount = riders.filter(r => r.status === 'active').length;
        const totalLeads = leads.length;
        const openTickets = requests.filter(r => r.status !== 'resolved' && r.status !== 'rejected').length;

        const periodCollection = dailyCollections.filter(c => {
            const d = parseISO(c.date);
            return d >= start && d <= end;
        }).reduce((sum, c) => sum + (c.total_collection || 0), 0);

        // Chart Data: Rider Growth (Group by Date)
        const growthMap = new Map<string, number>();
        filteredRiders.forEach(r => {
            const date = format(parseISO(r.createdAt || new Date().toISOString()), 'MMM dd');
            growthMap.set(date, (growthMap.get(date) || 0) + 1);
        });
        const growthData = Array.from(growthMap.entries()).map(([date, count]) => ({ date, count }));

        // Chart Data: Status Distribution
        const statusMap = new Map<string, number>();
        riders.forEach(r => {
            statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
        });
        const statusData = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));

        // Chart Data: TL Collection Distribution
        const tlCollMap = new Map<string, number>();
        dailyCollections.filter(c => {
            const d = parseISO(c.date);
            return d >= start && d <= end;
        }).forEach(c => {
            const tlName = teamLeaders.find(u => u.id === c.team_leader_id)?.fullName || 'Other';
            tlCollMap.set(tlName, (tlCollMap.get(tlName) || 0) + c.total_collection);
        });
        const tlCollData = Array.from(tlCollMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // Chart Data: Client Distribution
        const clientMap = new Map<string, number>();
        riders.forEach(r => {
            clientMap.set(r.clientName || 'Unknown', (clientMap.get(r.clientName || 'Unknown') || 0) + 1);
        });
        const clientData = Array.from(clientMap.entries()).map(([name, value]) => ({ name, value }));

        return {
            kpi: {
                totalWallet,
                activeRidersCount,
                totalLeads,
                openTickets,
                periodCollection,
                filteredRidersCount: filteredRiders.length,
                newRequestsCount: requestsInPeriod.length
            },
            charts: { growthData, statusData, clientData, tlCollData }
        };
    }, [riders, requests, leads, dailyCollections, teamLeaders, filters]);

    // --- Report Handlers ---
    const handleGenerateReport = async () => {
        setGenerating(true);
        let data: any[] = [];
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59);

        try {
            switch (selectedTemplate) {
                case 'active_riders':
                    // Explicitly filter for active riders only
                    const activeRiderList = riders.filter(r => r.status === 'active');
                    const filteredActive = generateRiderListReport(activeRiderList, {
                        client: filters.client !== 'all' ? filters.client : undefined
                    });
                    data = filteredActive.map(transformRiderData);
                    break;
                case 'inactive_riders':
                    // Filter for all inactive riders, not just 30+ days
                    const inactiveRiders = riders.filter(r => r.status === 'inactive');
                    data = inactiveRiders.map(transformRiderData);
                    break;
                case 'negative_wallet':
                    const negativeRiders = riders.filter(r => (r.walletAmount || 0) < 0).sort((a, b) => a.walletAmount - b.walletAmount);
                    data = negativeRiders.map(transformRiderData);
                    break;
                case 'positive_wallet':
                    const positiveRiders = riders.filter(r => (r.walletAmount || 0) > 0).sort((a, b) => b.walletAmount - a.walletAmount);
                    data = positiveRiders.map(transformRiderData);
                    break;
                case 'wallet_summary':
                    const walletSummary = generateWalletSummaryReport(riders);
                    data = [
                        { Category: 'Positive Balances', Count: walletSummary.positiveCount, Total: walletSummary.totalPositive },
                        { Category: 'Negative Balances', Count: walletSummary.negativeCount, Total: -walletSummary.totalNegative },
                        { Category: 'Zero Balances', Count: walletSummary.zeroCount, Total: 0 },
                        { Category: 'Net Total', Count: riders.length, Total: walletSummary.totalPositive - walletSummary.totalNegative },
                    ];
                    break;
                case 'client_distribution':
                    data = generateClientDistributionReport(riders);
                    break;
                case 'team_leader_performance':
                    data = generateTeamLeaderPerformanceReport(riders, teamLeaders);
                    break;
                case 'request_history':
                    data = generateRequestReport(requests, { status: filters.status, startDate, endDate });
                    break;
                case 'activity_log_report':
                    const logs = await fetchActivityLogs();
                    data = generateActivityReport(logs, { startDate, endDate });
                    break;
                case 'system_health':
                    data = generateSystemHealthReport(riders, teamLeaders, requests);
                    break;
                case 'revenue_report': {
                    // Fetch billing (Rent Charges) and Collections
                    const { data: ledgerEntries } = await supabase
                        .from('wallet_ledger')
                        .select('amount, mode, transaction_type, transaction_date, created_at')
                        .gte('created_at', startDate.toISOString())
                        .lte('created_at', endDate.toISOString())
                        .in('transaction_type', ['SYSTEM_RENT_CHARGE', 'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION']);

                    if (!ledgerEntries) throw new Error('Failed to fetch revenue data');

                    const revenueReportData = generateRevenueReport(ledgerEntries, startDate, endDate);
                    setReportData(revenueReportData);

                    // Summary Stats
                    const totalBillingRevenue = revenueReportData.find((r: any) => r.Date === 'TOTAL')?.['Billing (Rent)'] || 0;
                    const totalCollectionRevenue = revenueReportData.find((r: any) => r.Date === 'TOTAL')?.['Collection'] || 0;

                    setReportStats([
                        { label: 'Total Billed', value: `₹${totalBillingRevenue.toLocaleString()}`, color: 'blue' },
                        { label: 'Total Collected', value: `₹${totalCollectionRevenue.toLocaleString()}`, color: 'green' },
                        { label: 'Net Flow', value: `₹${(totalCollectionRevenue - totalBillingRevenue).toLocaleString()}`, color: totalCollectionRevenue - totalBillingRevenue >= 0 ? 'emerald' : 'rose' }
                    ]);
                    break;
                }

                case 'defaulter_list': {
                    // Fetch riders with negative wallet
                    const { data: defaulterRiders } = await supabase
                        .from('riders')
                        .select('*')
                        .lt('wallet_amount', 0) // Only negative
                        .order('wallet_amount', { ascending: true }); // Highest debt first

                    if (!defaulterRiders) throw new Error('Failed to fetch defaulter list');

                    // Filter by threshold if provided
                    const defaulterReportData = generateDefaulterReport(defaulterRiders, threshold);
                    setReportData(defaulterReportData);

                    // Summary Stats
                    const totalDebt = defaulterRiders.reduce((sum, r) => sum + Math.abs(r.wallet_amount), 0);
                    const avgDebt = defaulterRiders.length > 0 ? totalDebt / defaulterRiders.length : 0;

                    setReportStats([
                        { label: 'Total Defaulters', value: defaulterRiders.length, color: 'rose' },
                        { label: 'Total Debt', value: `₹${totalDebt.toLocaleString()}`, color: 'red' },
                        { label: 'Avg Debt', value: `₹${avgDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'orange' }
                    ]);
                    break;
                }

                case 'tl_daily_collection': {
                    // Fetch Active Team Leaders
                    const { data: teamLeadersData } = await supabase
                        .from('users')
                        .select('id, fullName:full_name')
                        .eq('role', 'teamLeader')
                        .eq('status', 'active');

                    // FIX: We must join riders to attribute collection to a TL.
                    // Rewriting query to include RIDER relationship.
                    const { data: ledgerWithRiders } = await supabase
                        .from('wallet_ledger')
                        .select(`
                            amount, 
                            created_at,
                            rider:riders (
                                team_leader_id
                            )
                        `)
                        .gte('created_at', startDate.toISOString())
                        .lte('created_at', endDate.toISOString())
                        .in('transaction_type', ['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION'])
                        .eq('mode', 'ADD');

                    if (!ledgerWithRiders || !teamLeadersData) throw new Error('Failed to fetch ledger data');

                    const logsForReport = ledgerWithRiders.map((entry: any) => ({
                        amount: entry.amount,
                        type: 'credit',
                        team_leader_id: entry.rider?.team_leader_id,
                        timestamp: entry.created_at
                    })).filter(l => l.team_leader_id); // Filter out unassigned

                    data = generateTLDailyCollectionReport(
                        logsForReport as any[],
                        teamLeadersData.map(tl => ({ ...tl, id: tl.id, fullName: tl.fullName })) as any[],
                        startDate,
                        endDate,
                        selectedTLs
                    );
                    break;
                }
                case 'fleet_health_report':
                    data = generateFleetHealthReport(riders, teamLeaders);
                    break;
                case 'collection_summary': {
                    let query = supabase.from('daily_collections').select('*')
                        .gte('date', filters.startDate)
                        .lte('date', filters.endDate);

                    if (selectedTLs.length > 0) {
                        query = query.in('team_leader_id', selectedTLs);
                    }

                    const { data: colls } = await query;
                    data = generateCollectionSummaryReport(colls || [], teamLeaders);
                    break;
                }
                case 'rider_tenure_report':
                    data = generateRiderTenureReport(riders);
                    if (filters.client !== 'all') {
                        data = data.filter(r => r.Client === filters.client);
                    }
                    break;
                case 'wallet_risk_report':
                    data = generateWalletRiskReport(riders);
                    if (selectedTLs.length > 0) {
                        data = data.filter(r => {
                            const tl = teamLeaders.find(u => u.fullName === r['TL Name']);
                            return tl && selectedTLs.includes(tl.id);
                        });
                    }
                    break;
                case 'payment_consistency': {
                    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
                    const { data: ledger } = await supabase
                        .from('wallet_ledger')
                        .select('rider_id, amount')
                        .in('transaction_type', ['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION'])
                        .eq('mode', 'ADD')
                        .gte('created_at', thirtyDaysAgo);
                    data = generatePaymentConsistencyReport(ledger || [], riders);
                    break;
                }
                default:
                    data = riders.map(transformRiderData);
            }
            setReportData(data);
            setReportGenerated(true);
            toast.success(`Generated ${data.length} records`);
        } catch (error) {
            console.error("Analysis failed", error);
            toast.error("Report generation failed");
        } finally {
            setGenerating(false);
        }
    };

    const fetchActivityLogs = async (start?: Date, end?: Date, actionType?: string) => {
        let query = supabase.from('activity_logs').select(`
            id,
            action:action_type,
            entityType:target_type,
            entityId:target_id,
            details,
            timestamp,
            performedBy:user_name,
            isDeleted:is_deleted,
            metadata
        `);

        if (start) query = query.gte('timestamp', start.toISOString());
        if (end) query = query.lte('timestamp', end.toISOString());
        if (actionType) query = query.eq('action_type', actionType);

        const { data } = await query.order('timestamp', { ascending: false }).limit(actionType ? 5000 : 2000);
        return (data || []) as ActivityLogEntry[];
    };

    // --- Render Helpers ---
    const renderKpiCard = (title: string, value: string | number, icon: React.ReactNode, trend?: string, colorClass: string = "text-primary") => (
        <div className="bg-card/50 backdrop-blur-sm border border-white/10 p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:bg-card/80 transition-all">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <div className={`text-3xl font-extrabold mt-2 ${colorClass}`}>{value}</div>
                </div>
                <div className={`p-3 rounded-xl bg-background/50 border border-white/5 ${colorClass}`}>
                    {icon}
                </div>
            </div>
            {trend && (
                <div className="flex items-center gap-1 mt-4 text-xs font-medium">
                    {trend.startsWith('+') ? <ArrowUpRight className="text-green-500" size={14} /> : <ArrowDownRight className="text-red-500" size={14} />}
                    <span className={trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}>{trend} vs last month</span>
                </div>
            )}
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
        </div>
    );

    if (loading) return <div className="p-20 text-center animate-pulse">Loading Analytics...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
                        Analytics Engine
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">Real-time system intelligence and reporting.</p>
                </div>

                {/* View Switcher */}
                <div className="flex bg-muted/30 p-1.5 rounded-xl border border-white/10">
                    <button
                        onClick={() => setViewMode('dashboard')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'dashboard' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <LayoutDashboard size={18} /> Dashboard
                    </button>
                    <button
                        onClick={() => setViewMode('reports')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${viewMode === 'reports' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <List size={18} /> Detailed Reports
                    </button>
                </div>
            </div>

            {/* Main Content */}
            {viewMode === 'dashboard' ? (
                <div className="space-y-8">
                    {/* Filters Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/10 p-4 rounded-xl border border-white/5">
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-semibold uppercase">Date Range</label>
                            <div className="flex gap-2">
                                <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="w-full bg-background border rounded-md px-2 py-1.5 text-sm" />
                                <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="w-full bg-background border rounded-md px-2 py-1.5 text-sm" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-semibold uppercase">Client</label>
                            <select
                                value={filters.client}
                                onChange={e => setFilters({ ...filters, client: e.target.value })}
                                className="w-full bg-background border rounded-md px-2 py-1.5 text-sm"
                            >
                                <option value="all">All Clients</option>
                                <option value="Zomato">Zomato</option>
                                <option value="Zepto">Zepto</option>
                                <option value="Swiggy">Swiggy</option>
                                <option value="Blinkit">Blinkit</option>
                            </select>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {renderKpiCard("Period Collection", `₹${analytics.kpi.periodCollection.toLocaleString()}`, <TrendingUp size={20} />, "+8.1%", "text-emerald-500")}
                        {renderKpiCard("Active Riders", analytics.kpi.activeRidersCount, <Users size={20} />, "+5.2%", "text-blue-500")}
                        {renderKpiCard("Total Lead Count", analytics.kpi.totalLeads, <Shield size={20} />, undefined, "text-amber-500")}
                        {renderKpiCard("Net Wallet Float", `₹${analytics.kpi.totalWallet.toLocaleString()}`, <Wallet size={20} />, "-2.5%", analytics.kpi.totalWallet >= 0 ? "text-green-500" : "text-rose-500")}
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* TL-wise Collection Bar Chart */}
                        <div className="bg-card/50 border border-white/10 p-6 rounded-2xl shadow-lg">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                <Activity size={18} className="text-primary" /> Top TLs by Collection
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analytics.charts.tlCollData}>
                                        <XAxis dataKey="name" fontSize={10} stroke="#666" interval={0} angle={-20} textAnchor="end" height={60} />
                                        <YAxis fontSize={12} stroke="#666" />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={0.4} fill="#10b981" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Status Distribution Donut Chart */}
                        <div className="bg-card/50 border border-white/10 p-6 rounded-2xl shadow-lg">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                <BarChart3 size={18} className="text-primary" /> Status Distribution
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.charts.statusData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {analytics.charts.statusData.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Report Generator View (Original Logic Enhanced) */
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Template Selection */}
                    <div className="xl:col-span-4 space-y-6">
                        <div className="bg-card border border-white/10 rounded-2xl p-6 shadow-xl sticky top-6">
                            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                <FileText size={20} className="text-primary" /> Report Templates
                            </h2>
                            <div className="space-y-3">
                                {REPORT_TEMPLATES.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => { setSelectedTemplate(template.id); setReportGenerated(false); }}
                                        className={`w-full text-left p-4 rounded-xl border transition-all ${selectedTemplate === template.id ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-muted'}`}
                                    >
                                        <div className="font-bold">{template.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Generator & Table */}
                    <div className="xl:col-span-8 space-y-6">
                        <div className="bg-card border border-white/10 rounded-2xl p-6">
                            <h2 className="font-bold text-xl mb-4">{REPORT_TEMPLATES.find(t => t.id === selectedTemplate)?.name}</h2>

                            {/* Generator Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="space-y-1">
                                    <label className="text-xs uppercase font-bold text-muted-foreground">Start Date</label>
                                    <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="w-full bg-background border px-3 py-2 rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs uppercase font-bold text-muted-foreground">End Date</label>
                                    <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="w-full bg-background border px-3 py-2 rounded-lg" />
                                </div>

                                {/* Dynamic Filters based on Template */}
                                {selectedTemplate === 'tl_daily_collection' && (
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">Team Leaders</label>
                                        <div className="relative">
                                            <select
                                                className="w-full bg-background border px-3 py-2 rounded-lg"
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'all') setSelectedTLs([]);
                                                    else {
                                                        if (!selectedTLs.includes(val)) setSelectedTLs([...selectedTLs, val]);
                                                    }
                                                }}
                                                value="Select..." // Always reset
                                            >
                                                <option disabled>Select...</option>
                                                <option value="all">All Team Leaders</option>
                                                {teamLeaders.map(tl => (
                                                    <option key={tl.id} value={tl.id}>{tl.fullName}</option>
                                                ))}
                                            </select>

                                            {selectedTLs.length > 0 && (
                                                <div className="mt-2 p-2 bg-card border rounded-lg shadow-sm w-full max-h-48 overflow-y-auto">
                                                    <div className="flex justify-between items-center mb-2 sticky top-0 bg-card pb-1 border-b">
                                                        <span className="text-xs font-bold text-muted-foreground">Selected ({selectedTLs.length})</span>
                                                        <button onClick={() => setSelectedTLs([])} className="text-xs text-red-500 hover:underline">Clear</button>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {selectedTLs.map(id => {
                                                            const tl = teamLeaders.find(u => u.id === id);
                                                            return (
                                                                <div key={id} className="flex justify-between items-center text-sm bg-muted/50 p-1.5 rounded hover:bg-muted">
                                                                    <span>{tl?.fullName || 'Unknown'}</span>
                                                                    <button onClick={() => setSelectedTLs(selectedTLs.filter(x => x !== id))} className="text-muted-foreground hover:text-red-500"><ArrowDownRight className="rotate-45" size={14} /></button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-end">
                                    <button
                                        onClick={handleGenerateReport}
                                        disabled={generating}
                                        className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                    >
                                        {generating ? <RefreshCw className="animate-spin" size={18} /> : <TrendingUp size={18} />}
                                        Generate
                                    </button>
                                </div>
                            </div>

                            {/* Summary Stats Cards */}
                            {reportGenerated && reportStats.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-in fade-in slide-in-from-bottom-4">
                                    {reportStats.map((stat, idx) => (
                                        <div key={idx} className={`p-4 rounded-xl border border-${stat.color}-500/20 bg-${stat.color}-500/10`}>
                                            <p className={`text-xs font-bold uppercase text-${stat.color}-500 mb-1`}>{stat.label}</p>
                                            <p className="text-2xl font-black">{stat.value}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Result Table */}
                            {reportGenerated && (
                                <div className="animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex justify-between items-center mb-4 bg-muted/20 p-3 rounded-lg">
                                        <span className="text-sm font-medium">Found <b>{reportData.length}</b> records</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => exportToCSV(reportData, `report_${selectedTemplate}`)} className="p-2 bg-background border rounded hover:bg-muted" title="CSV"><Download size={16} /></button>
                                            <button onClick={() => exportToExcel(reportData, `report_${selectedTemplate}`)} className="p-2 bg-background border rounded hover:bg-muted text-green-600" title="Excel"><Download size={16} /></button>
                                            <button onClick={() => exportToPDF(reportData, Object.keys(reportData[0] || {}), `report_${selectedTemplate}`, 'Report')} className="p-2 bg-background border rounded hover:bg-muted text-red-500" title="PDF"><Printer size={16} /></button>
                                        </div>
                                    </div>

                                    {reportData.length > 0 ? (
                                        <div className="overflow-x-auto border rounded-xl max-h-[500px]">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-muted sticky top-0 z-10">
                                                    <tr>
                                                        {Object.keys(reportData[0]).map(key => <th key={key} className="px-6 py-3 font-semibold">{key}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {reportData.map((row, i) => (
                                                        <tr key={i} className="hover:bg-muted/50">
                                                            {Object.keys(row).map((key, j) => <td key={j} className="px-6 py-3 whitespace-nowrap">{row[key]}</td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-muted-foreground">No data found matching criteria.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
