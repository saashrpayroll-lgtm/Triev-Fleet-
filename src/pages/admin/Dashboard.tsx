import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Sparkles, Filter, Settings, Wifi, WifiOff
} from 'lucide-react';
import { Rider, User, Lead, Request } from '@/types';
import Leaderboard from '@/components/Leaderboard';
// import { AIService } from '@/services/AIService';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TLPerformanceAnalytics from '@/components/dashboard/TLPerformanceAnalytics';
import AINewsTicker from '@/components/AINewsTicker';
import SmartCardGrid from '@/components/dashboard/SmartCardGrid';
import DashboardCustomizer from '@/components/dashboard/DashboardCustomizer';
import { startOfWeek, startOfMonth, startOfDay } from 'date-fns';
import { sanitizeArray } from '@/utils/sanitizeData';

type DateFilter = 'all' | 'month' | 'week' | 'today' | 'custom';

// Define Dashboard Sections for the customizable layout
interface DashboardSection {
    id: string;
    // component: React.ReactNode; // Removed as it's not stored in state
    label: string;
    visible: boolean;
}

const DEFAULT_SECTIONS = [
    { id: 'metrics', label: 'Key Performance Indicators', visible: true },
    { id: 'analytics', label: 'Performance Analytics', visible: true },
    { id: 'charts', label: 'Trends & Charts', visible: true },
    { id: 'activity', label: 'Recent Activity', visible: true },
    { id: 'leaderboard', label: 'Leaderboard', visible: true },
];

const Dashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [dateFilter, setDateFilter] = useState<DateFilter>('month');
    const [loading, setLoading] = useState(true);
    const [aiInsight, setAiInsight] = useState<string>('');
    const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Customization State
    const [showCustomizer, setShowCustomizer] = useState(false);
    const [showAiTicker, setShowAiTicker] = useState(false); // Relocated to secondary section (hidden by default or collapsed)

    // Layout State (Persisted)
    const [sectionOrder, setSectionOrder] = useState<DashboardSection[]>(() => {
        const saved = localStorage.getItem('dashboard_layout');
        return saved ? JSON.parse(saved) : DEFAULT_SECTIONS.map(s => ({ id: s.id, label: s.label, visible: s.visible }));
    });

    // Save layout changes
    useEffect(() => {
        localStorage.setItem('dashboard_layout', JSON.stringify(sectionOrder));
    }, [sectionOrder]);

    const handleLayoutUpdate = (newOrder: any[]) => {
        setSectionOrder(newOrder);
    };

    const handleResetLayout = () => {
        setSectionOrder(DEFAULT_SECTIONS.map(s => ({ id: s.id, label: s.label, visible: s.visible })));
    };


    // Raw Data State
    const [rawData, setRawData] = useState({
        riders: [] as Rider[],
        leads: [] as Lead[],
        requests: [] as Request[],
        teamLeaders: [] as User[]
    });

    // --- Data Fetching & Real-time ---
    const fetchDashboardData = React.useCallback(async (isInitial = false) => {
        if (!userData) return;
        if (isInitial) setLoading(true);

        try {
            const [ridersRes, leadsRes, requestsRes, usersRes] = await Promise.all([
                supabase.from('riders').select('*'), // Select all for full stats (optimized select is better but for now * is safe for MVP)
                supabase.from('leads').select('*'),
                supabase.from('requests').select('*'),
                supabase.from('users').select('*').eq('role', 'teamLeader')
            ]);

            if (ridersRes.error) throw ridersRes.error;

            setRawData({
                riders: ridersRes.data as Rider[] || [],
                leads: leadsRes.data as Lead[] || [],
                requests: requestsRes.data as Request[] || [],
                teamLeaders: sanitizeArray(usersRes.data as User[] || [])
            });
            console.log('Dashboard Data Fetched:', {
                riders: ridersRes.data?.length,
                leads: leadsRes.data?.length,
                requests: requestsRes.data?.length,
                teamLeaders: usersRes.data?.length
            });
        } catch (error) {
            console.error('Data Load Error:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        fetchDashboardData(true);

        const channel = supabase
            .channel('dashboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, (payload) => {
                console.log('Realtime Update [Riders]:', payload);
                fetchDashboardData();
                setLastUpdated(new Date());
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
                console.log('Realtime Update [Leads]:', payload);
                fetchDashboardData();
                setLastUpdated(new Date());
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, (payload) => {
                console.log('Realtime Update [Requests]:', payload);
                fetchDashboardData();
                setLastUpdated(new Date());
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
                console.log('Realtime Update [Users]:', payload);
                fetchDashboardData();
                setLastUpdated(new Date());
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_metrics' }, (payload) => {
                console.log('Realtime Update [Metrics]:', payload);
                fetchDashboardData();
                setLastUpdated(new Date());
            })
            .subscribe((status) => {
                console.log('Realtime Subscription Status:', status);
                if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeStatus('disconnected');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDashboardData]);


    // --- Filtering Logic ---
    const filteredData = useMemo(() => {
        let { riders, leads, requests, teamLeaders } = rawData;
        const now = new Date();
        let filterDate: Date | null = null;


        if (dateFilter === 'today') {
            filterDate = startOfDay(now);
        } else if (dateFilter === 'week') {
            filterDate = startOfWeek(now);
        } else if (dateFilter === 'month') {
            filterDate = startOfMonth(now);
        }

        if (filterDate) {
            // Apply Date Filter to Creation Date
            leads = leads.filter(l => new Date(l.createdAt) >= filterDate!);
            requests = requests.filter(r => new Date(r.createdAt) >= filterDate!);
            // For riders, we typically want TOTAL snapshot, but "New Riders" depends on filtered date
            // Ideally, SmartCardGrid handles "Active vs Total" differently.
            // Let's pass FULL rider list to components, but maybe filter "New" logic there?
            // Actually, requirements say "track performance... with time filters".
            // If I filter riders by creation date, "Total Active Riders" becomes "New Active Riders".
            // Let's Keep Riders as FULL LIST for "Snapshot" stats, but filter for "Trend" stats within components or prepare separate lists.
            // For simplicity in this specific "Redesign", let's pass FULL data to SmartCardGrid, 
            // but pass FILTERED data to specific trend charts if needed.

            // However, TL Performance Analytics usually cares about the time window.
        }

        return { riders, leads, requests, teamLeaders, filterDate };
    }, [rawData, dateFilter]);


    // --- Derived Statistics for Charts ---
    const chartData = useMemo(() => {
        const { riders, leads } = rawData; // Use RAW active snapshot for these charts usually
        // Or if we want "New in this period", we use filteredData.
        // Let's use Raw for "Current State" charts (Active/Inactive), and Filtered for "Performance" (Leads generated)

        const totalCollection = riders.reduce((sum, r) => sum + (r.walletAmount > 0 ? r.walletAmount : 0), 0);
        const outstandingDues = Math.abs(riders.reduce((sum, r) => sum + (r.walletAmount < 0 ? r.walletAmount : 0), 0));

        return {
            riders: [
                { name: 'Active', value: riders.filter(r => r.status === 'active').length, color: '#10b981' },
                { name: 'Inactive', value: riders.filter(r => r.status === 'inactive').length, color: '#f59e0b' },
                { name: 'Deleted', value: riders.filter(r => r.status === 'deleted').length, color: '#f43f5e' }
            ],
            wallet: [
                { name: 'Collections', value: totalCollection },
                { name: 'Risk / Dues', value: outstandingDues }
            ],
            leads: [
                { name: 'Converted', value: leads.filter(l => l.status === 'Convert').length, color: '#84cc16' },
                { name: 'Pipeline', value: leads.length - leads.filter(l => l.status === 'Convert').length, color: '#94a3b8' }
            ]
        };
    }, [rawData]);


    // --- AI Insight Generation ---
    useEffect(() => {
        if (!loading && rawData.riders.length > 0) {
            // Calculate stats for AI Service
            // ... (Previously existing logic)
            // AIService.getDashboardInsights(stats, userData?.role || 'admin').then(setAiInsight);
            // Mocking simple insight for now to save tokens/complexity or uncomment above
            setAiInsight("Agentic Note: Ensure Team Leader 'Rahul' focuses on converting new leads from South Zone.");
        }
    }, [loading, dateFilter]);


    // --- Render Loading ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="text-center space-y-4">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-indigo-200 rounded-full animate-ping opacity-25"></div>
                        <div className="absolute inset-0 border-4 border-t-indigo-600 border-r-indigo-600 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-muted-foreground font-medium animate-pulse">Initializing Premium Command Center...</p>
                </div>
            </div>
        );
    }

    const isTL = userData?.role === 'teamLeader';

    // --- Component Mapping ---
    const renderSection = (id: string) => {
        switch (id) {
            case 'metrics':
                return (
                    <SmartCardGrid
                        riders={filteredData.riders}
                        leads={filteredData.leads}
                        requests={filteredData.requests}
                        teamLeaders={filteredData.teamLeaders}
                        onCardClick={(type) => {
                            if (type === 'riders') navigate('/portal/riders');
                            if (type === 'wallet') navigate('/portal/riders'); // filtering happens on page
                            if (type === 'leads') navigate('/portal/leads');
                            if (type === 'requests') navigate('/portal/requests');
                            if (type === 'leaderboard') navigate('/portal/leaderboard');
                        }}
                    />
                );
            case 'analytics':
                return !isTL ? (
                    <TLPerformanceAnalytics
                        teamLeaders={rawData.teamLeaders}
                        riders={rawData.riders}
                        leads={rawData.leads}
                        lastUpdated={lastUpdated}
                    />
                ) : null;
            case 'charts':
                return (
                    <div className="lg:col-span-2">
                        <DashboardCharts
                            riderData={chartData.riders}
                            walletData={chartData.wallet.filter(d => d.value !== 0)}
                            leadData={chartData.leads}
                        />
                    </div>
                );
            case 'activity':
                return (
                    <div className="h-full min-h-[400px]">
                        <RecentActivity />
                    </div>
                );
            case 'leaderboard':
                return (
                    <Leaderboard
                        teamLeaders={rawData.teamLeaders}
                        riders={rawData.riders}
                        leads={rawData.leads}
                        action={
                            <button
                                onClick={() => navigate('/portal/leaderboard')}
                                className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium flex items-center gap-1 bg-muted/30 px-3 py-1.5 rounded-full border border-transparent hover:border-primary/20"
                            >
                                View Full Leaderboard
                            </button>
                        }
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-8 pb-10 relative">
            {/* Customizer */}
            {showCustomizer && (
                <DashboardCustomizer
                    sections={sectionOrder}
                    onUpdate={handleLayoutUpdate}
                    onClose={() => setShowCustomizer(false)}
                    onReset={handleResetLayout}
                />
            )}

            {/* Header Section */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-6 justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1 animate-in slide-in-from-left duration-500">
                            {isTL ? "Team Command Center" : "Admin Command Center"}
                        </h1>
                        <p className="text-muted-foreground font-medium text-sm">
                            Real-time fleet performance system.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* AI Ticker Toggle */}
                        <button
                            onClick={() => setShowAiTicker(!showAiTicker)}
                            className={`p-2 rounded-lg border transition-all flex items-center gap-2 text-xs font-semibold ${showAiTicker ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
                        >
                            <Sparkles size={14} className={showAiTicker ? 'text-indigo-600' : 'text-gray-400'} />
                            {showAiTicker ? 'Hide AI Feed' : 'Show AI Feed'}
                        </button>

                        {/* Date Filters */}
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                            <Filter size={14} className="text-muted-foreground ml-2" />
                            <span className="w-px h-4 bg-gray-200 mx-1"></span>
                            {(['today', 'week', 'month', 'all'] as DateFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setDateFilter(filter)}
                                    className={`
                                        px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize
                                        ${dateFilter === filter
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-gray-500 hover:bg-gray-100'
                                        }
                                    `}
                                >
                                    {filter === 'all' ? 'All Time' : filter}
                                </button>
                            ))}
                        </div>

                        {/* Customize Button */}
                        <button
                            onClick={() => setShowCustomizer(!showCustomizer)}
                            className={`p-2 rounded-lg border transition-all ${showCustomizer ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
                            title="Customize Dashboard"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Ticker (Relocated/Collapsible) */}
            {showAiTicker && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <AINewsTicker />
                    {aiInsight && (
                        <div className="mt-2 text-sm text-indigo-600 font-medium bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-lg flex items-center gap-2">
                            <Sparkles size={16} />
                            <span className="font-bold">Strategic Insight:</span> {aiInsight}
                        </div>
                    )}
                </div>
            )}

            {/* Realtime Status Indicator */}
            <div className={`flex justify-end mb-2 transition-opacity duration-500 ${realtimeStatus === 'connected' ? 'opacity-50 hover:opacity-100' : 'opacity-100'}`}>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${realtimeStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-red-50 text-red-600 border-red-100'
                    }`}>
                    {realtimeStatus === 'connected' ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {realtimeStatus === 'connected' ? 'Live' : 'Disconnected'}
                    {realtimeStatus === 'connected' && (
                        <span className="text-emerald-400 ml-1">
                            • {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                </div>
            </div>

            {/* DYNAMIC SECTIONS RENDER */}
            <div className="space-y-8">
                {sectionOrder.map((section: DashboardSection) => {
                    if (!section.visible) return null;

                    // Specific Handling for Grid Layouts (Charts & Activity usually sit side-by-side)
                    // But our generic reorderer acts linearly. 
                    // To support "Charts + Activity" in one row, we'd need a more complex layout engine.
                    // For now, we render them as full width blocks, OR we can hack usage:
                    // If 'charts' and 'activity' are adjacent, maybe wrap them?
                    // Simpler approach: Just render them stacked or independently as the component defines.
                    // DashboardCharts returns a 2-col grid inside.
                    // RecentActivity is a panel.

                    // Let's special case the container style based on ID
                    if (section.id === 'charts' || section.id === 'activity') {
                        // We can try to make them side-by-side if default order? 
                        // But if user moves 'activity' to top, it should be full width?
                        // Let's render 'Charts' and 'Activity' as flexible grid items is tricky with linear list map.
                        // Compromise: All sections are full width rows, except Charts contains its own grid.
                    }

                    return (
                        <div key={section.id} className="animate-in slide-in-from-bottom duration-500">
                            {/* Section Title (Optional, helps in edit mode visualization) */}
                            {/* <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{section.label}</h3> */}
                            {renderSection(section.id)}
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default Dashboard;
