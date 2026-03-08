import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Users, UserCheck, Wallet, Inbox, UserPlus, Sparkles, TrendingUp, TrendingDown, AlertTriangle, Coins, Activity, Smartphone, Trophy, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Rider, User, Lead, Request } from '@/types';
import Leaderboard from '@/components/Leaderboard';

import SmartMetricCard from '@/components/dashboard/SmartMetricCard';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TodaysCollectionCard from '@/components/dashboard/TodaysCollectionCard';
import { WalletSyncWidget } from '@/components/WalletSyncWidget';
import WeeklyCollectionChart from '@/components/dashboard/WeeklyCollectionChart';
import TeamLeaderPerformanceTable from '@/components/dashboard/TeamLeaderPerformanceTable';
import SystemHealthWidget from '@/components/dashboard/SystemHealthWidget';
import LivePresenceDashboard from '@/components/dashboard/LivePresenceDashboard';
import { startOfWeek, startOfMonth } from 'date-fns';
import { sanitizeArray } from '@/utils/sanitizeData';
import { resolvePerformancePeriod, DateFilterType } from '@/utils/dateUtils';
import { calculateAIScore } from '@/utils/performance';

const Dashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [dateFilter, setDateFilter] = useState<DateFilterType>('day');
    const [loading, setLoading] = useState(true);


    // Raw Data State
    const [rawData, setRawData] = useState({
        riders: [] as Rider[],
        leads: [] as Lead[],
        requests: [] as Request[],
        teamLeaders: [] as User[],
        dailyCollectionsRaw: [] as any[]
    });
    const [tlCollections, setTlCollections] = useState<Record<string, number>>({});
    const [dailyCollections, setDailyCollections] = useState<Record<string, number>>({});
    const [weeklyCollections, setWeeklyCollections] = useState<Record<string, number>>({});

    // --- Data Fetching ---
    // --- Data Fetching & Real-time ---
    const fetchDashboardData = React.useCallback(async (isInitial = false) => {
        if (!userData) return;
        if (isInitial) setLoading(true);

        try {
            const [ridersRes, leadsRes, requestsRes, usersRes, dailyRes, todayLedgerRes] = await Promise.all([
                supabase.from('riders').select(`
                    id,
                    trievId:triev_id,
                    riderName:rider_name,
                    mobileNumber:mobile_number,
                    chassisNumber:chassis_number,
                    clientName:client_name,
                    walletAmount:wallet_amount,
                    allotmentDate:allotment_date,
                    status,
                    teamLeaderId:team_leader_id,
                    inactivatedAt:inactivated_at,
                    updatedAt:updated_at,
                    createdAt:created_at
                `).limit(5000),
                supabase.from('leads').select(`
                    id,
                    leadId:lead_id,
                    riderName:rider_name,
                    status,
                    createdBy:created_by,
                    createdAt:created_at
                `),
                supabase.from('requests').select(`
                    id,
                    status,
                    createdAt:created_at
                `),
                supabase.from('users').select(`
                    id,
                    fullName:full_name,
                    email,
                    status,
                    role,
                    profilePicUrl:profile_pic_url
                `).eq('role', 'teamLeader'),
                supabase.from('daily_collections').select('team_leader_id, total_collection, date')
                    .gte('date', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)))
                    .order('date', { ascending: false })
                    .limit(50000),
                supabase.from('wallet_ledger').select(`
                    amount,
                    transaction_type,
                    transaction_date,
                    created_at,
                    rider:riders!inner (
                        team_leader_id
                    )
                `)
                    .eq('mode', 'ADD')
                    .in('transaction_type', [
                        'DAILY_COLLECTION', 'DAILY COLLECTION',
                        'RENT_COLLECTION', 'RENT COLLECTION',
                        'FTD_COLLECTION', 'FTD COLLECTION',
                        'COLLECTION', 'RENT'
                    ])
                    // ✅ ROBUST FIX: catch rows with transaction_date set (imports) OR NULL (legacy)
                    // - transaction_date = todayIST covers AM/PM imports correctly
                    // - fallback: transaction_date IS NULL AND created_at >= midnight IST
                    .or((() => {
                        const now = new Date();
                        const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
                        const [y, m, d] = todayIST.split('-').map(Number);
                        const midnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
                        return `transaction_date.gte.${midnight},and(transaction_date.is.null,created_at.gte.${midnight})`;
                    })())
            ]);

            // Note: Removed wallet_transactions fetch to avoid double counting. 
            // daily_collections now authoritative source.

            if (ridersRes.error) throw ridersRes.error;

            // ── AUTHORITATIVE DATE-BASED COLLECTION MAPS ─────────────────────────
            // daily_collections.date = single source of truth for period calcs.
            // wallet_ledger.created_at = ONLY used for live today amounts for TLs
            //   that do NOT yet have a daily_collections snapshot for today.
            // Changing wallet_ledger.created_at does NOT affect weekly/total figures.

            const collections: Record<string, number> = {};
            const dayMap: Record<string, number> = {};
            const weekMap: Record<string, number> = {};

            const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const now = new Date();
            const todayStr = istFormatter.format(now);
            const [year, month, day] = todayStr.split('-').map(Number);
            const workingDateUTC = new Date(Date.UTC(year, month - 1, day));

            // Week logic (Monday start in IST)
            const weekDay = workingDateUTC.getUTCDay();
            const diff = workingDateUTC.getUTCDate() - weekDay + (weekDay === 0 ? -6 : 1);
            const weekStartUTC = new Date(workingDateUTC);
            weekStartUTC.setUTCDate(diff);
            const weekStart = weekStartUTC.toISOString().split('T')[0];

            const dailyData = dailyRes.data || [];
            // Track TLs that already have a today snapshot in daily_collections
            const tlsWithTodaySnapshot = new Set<string>();

            dailyData.forEach((d: any) => {
                const tlId = d.team_leader_id;
                const amt = Number(d.total_collection) || 0;
                const dDateStr = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;

                // All-time total
                collections[tlId] = (collections[tlId] || 0) + amt;

                // Today snapshot
                if (dDateStr === todayStr) {
                    tlsWithTodaySnapshot.add(tlId);
                    dayMap[tlId] = (dayMap[tlId] || 0) + amt;
                }

                // Weekly: use date string (authoritative) — includes today if snapshot exists
                if (dDateStr >= weekStart) {
                    weekMap[tlId] = (weekMap[tlId] || 0) + amt;
                }
            });

            // Live today from wallet_ledger — ONLY for TLs without a today snapshot
            const liveTodayByTL: Record<string, number> = {};
            const todayLedger = (todayLedgerRes?.data as any[]) || [];
            todayLedger.forEach(txn => {
                if (txn.rider && txn.rider.team_leader_id) {
                    const tlId = txn.rider.team_leader_id;
                    if (!tlsWithTodaySnapshot.has(tlId)) {
                        liveTodayByTL[tlId] = (liveTodayByTL[tlId] || 0) + (Number(txn.amount) || 0);
                    }
                    // If snapshot exists: daily_collections is authoritative, skip ledger
                }
            });

            // Merge live today into dayMap and weekMap (only for no-snapshot TLs)
            Object.keys(liveTodayByTL).forEach(tlId => {
                dayMap[tlId] = liveTodayByTL[tlId]; // replace (live data is fresh total)
                weekMap[tlId] = (weekMap[tlId] || 0) + liveTodayByTL[tlId];
            });


            setTlCollections(collections);
            setDailyCollections(dayMap);
            setWeeklyCollections(weekMap);

            setRawData({
                riders: (ridersRes.data as Rider[] || []).map(r => ({ ...r, walletAmount: r.status === 'active' ? r.walletAmount : 0 })),
                leads: leadsRes.data as Lead[] || [],
                requests: requestsRes.data as Request[] || [],
                teamLeaders: sanitizeArray(usersRes.data as User[] || []),
                dailyCollectionsRaw: dailyRes.data || []
            });
        } catch (error) {
            console.error('Data Load Error:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        fetchDashboardData(true);

        // Debounce: avoid hammering fetchDashboardData on rapid ledger inserts
        let ledgerDebounce: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            if (ledgerDebounce) clearTimeout(ledgerDebounce);
            ledgerDebounce = setTimeout(() => fetchDashboardData(), 1200);
        };

        const channel = supabase
            .channel('dashboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, () => {
                fetchDashboardData();
            })
            // ✅ FIX: wallet_ledger realtime — keeps today/weekly collection maps live
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, fetchDebounced)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDashboardData]);


    // --- Filtering Logic (Date & Role) ---
    const filteredData = useMemo(() => {
        let { riders, leads, requests, teamLeaders } = rawData;
        const now = new Date();
        const filterDate = dateFilter === 'week' ? startOfWeek(now) :
            dateFilter === 'month' ? startOfMonth(now) : null;

        // 1. Role-Based Filtering
        if (userData?.role === 'teamLeader') {
            // const tlId = userData.id;
            // Filter riders assigned to this TL
            // Note: Assuming 'team_leader_id' or similar exists, otherwise showing all for now or empty
            // In a real scenario, we'd filter by riders where team_leader_id == tlId
            // riders = riders.filter(r => r.team_leader_id === tlId);
        }

        // 2. Date Filtering (Applied to CreatedAt fields)
        if (filterDate) {
            // riders = riders.filter(r => new Date(r.created_at) >= filterDate);
            leads = leads.filter(l => new Date(l.createdAt) >= filterDate);
            requests = requests.filter(r => new Date(r.createdAt) >= filterDate);
        }

        return { riders, leads, requests, teamLeaders };
    }, [rawData, dateFilter, userData]);


    // --- Derived Statistics ---
    const stats = useMemo(() => {
        const { riders, leads, requests, teamLeaders } = filteredData;

        // Wallet Calcs
        const totalWallet = riders.reduce((sum, r) => sum + r.walletAmount, 0);
        const positiveWalletData = riders.filter(r => r.walletAmount > 0);
        const negativeWalletData = riders.filter(r => r.walletAmount < 0);
        const zeroWalletData = riders.filter(r => r.walletAmount === 0);

        const positiveSum = positiveWalletData.reduce((sum, r) => sum + r.walletAmount, 0);
        const negativeSum = negativeWalletData.reduce((sum, r) => sum + r.walletAmount, 0);
        const avgWallet = riders.length > 0 ? Math.round(totalWallet / riders.length) : 0;

        // Critical Monitors
        const highDebtRiders = negativeWalletData.filter(r => r.walletAmount < -3000);
        const criticalRequests = requests.filter(r => r.priority === 'high');
        const activeRidersList = riders.filter(r => r.status === 'active');

        return {
            // Riders
            totalRiders: riders.length,
            activeRiders: activeRidersList.length,
            inactiveRiders: riders.filter(r => r.status === 'inactive').length,
            deletedRiders: riders.filter(r => r.status === 'deleted').length,

            // Wallet Counts
            positiveWalletCount: positiveWalletData.length,
            negativeWalletCount: negativeWalletData.length,
            zeroWalletCount: zeroWalletData.length,
            highDebtCount: highDebtRiders.length,
            lowBalanceCount: activeRidersList.filter(r => r.walletAmount >= 0 && r.walletAmount <= 250).length,

            // Finance Amounts
            totalCollection: positiveSum,
            outstandingDues: Math.abs(negativeSum),
            netBalance: totalWallet,
            avgBalance: avgWallet,

            // Leads
            totalLeads: leads.length,
            convertedLeads: leads.filter(l => l.status === 'Convert').length,
            newLeadsToday: leads.filter(l => {
                const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
                const leadDate = istFormatter.format(new Date(l.createdAt));
                const todayDate = istFormatter.format(new Date());
                return leadDate === todayDate;
            }).length,
            conversionRate: leads.length > 0 ? Math.round((leads.filter(l => l.status === 'Convert').length / leads.length) * 100) : 0,

            // Requests
            pendingRequests: requests.filter(r => r.status === 'pending').length,
            resolvedRequests: requests.filter(r => r.status === 'resolved').length,
            criticalRequests: criticalRequests.length,

            // TL Stats (Admin Only)
            totalTLs: teamLeaders.length,
            activeTLs: teamLeaders.filter(u => u.status === 'active').length
        };
    }, [filteredData]);

    // --- Chart Data ---
    const chartData = useMemo(() => {
        const { riders } = filteredData;

        return {
            riders: [
                { name: 'Active', value: riders.filter(r => r.status === 'active').length, color: '#10b981' },
                { name: 'Inactive', value: riders.filter(r => r.status === 'inactive').length, color: '#f59e0b' },
                { name: 'Deleted', value: riders.filter(r => r.status === 'deleted').length, color: '#f43f5e' }
            ],
            wallet: [
                { name: 'Collections', value: stats.totalCollection },
                { name: 'Risk / Dues', value: stats.outstandingDues }
            ],
            leads: [
                { name: 'Converted', value: stats.convertedLeads, color: '#84cc16' },
                { name: 'Pipeline', value: stats.totalLeads - stats.convertedLeads, color: '#94a3b8' }
            ]
        };
    }, [filteredData, stats]);

    // --- TL Performance Stats ---
    const period = useMemo(() => resolvePerformancePeriod(dateFilter), [dateFilter]);

    const tlStats = useMemo(() => {
        const { teamLeaders, riders, leads } = rawData;

        return teamLeaders.map(tl => {
            const tlCollectionAllTime = tlCollections[tl.id] || 0;

            // Period-specific collection for accurate Avg calculation
            let periodCollection = tlCollectionAllTime;
            let activeDays = 1;
            let perDayAverageCollection = 0;

            if (dateFilter === 'day') {
                // When viewing Today, "Per Day Avg" should act as a benchmark (Month-To-Date Average)
                periodCollection = dailyCollections[tl.id] || 0; // Today's actual

                const now = new Date();
                const year = now.getUTCFullYear();
                const month = now.getUTCMonth() + 1; // 1-12
                const monthStartUTC_local = new Date(Date.UTC(year, month - 1, 1));
                const monthStartStr_local = monthStartUTC_local.toISOString().split('T')[0];

                const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
                const nowISTStr = formatter.format(now);

                const tlDailyData = (rawData as any).dailyCollectionsRaw || [];
                const mtdData = tlDailyData.filter((d: any) => {
                    if (d.team_leader_id !== tl.id) return false;
                    const dDateStr = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;
                    // Include up to yesterday, today's data is in periodCollection
                    return dDateStr >= monthStartStr_local && dDateStr < nowISTStr;
                });

                const mtdHistoricalTotal = mtdData.reduce((sum: number, d: any) => sum + (Number(d.total_collection) || 0), 0);
                const mtdActiveDays = new Set(mtdData.filter((d: any) => Number(d.total_collection) > 0).map((d: any) => d.date)).size;

                // Total MTD = historical + today's live
                const totalMTD = mtdHistoricalTotal + periodCollection;
                const totalMTDDays = mtdActiveDays + (periodCollection > 0 ? 1 : 0);

                perDayAverageCollection = Math.round(totalMTDDays > 0 ? (totalMTD / totalMTDDays) : 0);
                activeDays = 1; // Unused for today's 'periodCollection', purely for local block return
            } else if (period) {
                const tlDailyData = (rawData as any).dailyCollectionsRaw || [];
                const filteredData = tlDailyData.filter((d: any) => d.team_leader_id === tl.id && d.date >= period.start && d.date <= period.end);
                periodCollection = filteredData.reduce((sum: number, d: any) => sum + (Number(d.total_collection) || 0), 0);
                activeDays = Math.max(1, new Set(filteredData.filter((d: any) => Number(d.total_collection) > 0).map((d: any) => d.date)).size);
                perDayAverageCollection = Math.round(periodCollection / activeDays);
            }

            const metrics = calculateAIScore(tl, riders, leads, periodCollection, period);

            // Activity Pulse Detection
            const tlRiders = riders.filter(r => r.teamLeaderId === tl.id || (r as any).team_leader_id === tl.id);
            const tlLeads = leads.filter(l => l.createdBy === tl.id || (l as any).created_by === tl.id);
            const lastLeadTime = tlLeads.length > 0 ? Math.max(...tlLeads.map(l => new Date(l.createdAt).getTime())) : 0;
            const lastRiderUpdate = tlRiders.length > 0 ? Math.max(...tlRiders.map(r => new Date(r.updatedAt || r.createdAt).getTime())) : 0;
            const lastActivity = new Date(Math.max(lastLeadTime, lastRiderUpdate)).toISOString();

            return {
                id: tl.id,
                name: tl.fullName || 'Unknown',
                email: tl.email,
                totalRiders: metrics.totalRiders,
                activeRiders: metrics.activeRiders,
                wallet: {
                    total: metrics.positiveWallet + metrics.negativeWallet,
                    positiveCount: tlRiders.filter(r => r.walletAmount > 0).length,
                    positiveAmount: metrics.positiveWallet,
                    negativeCount: tlRiders.filter(r => r.status === 'active' && r.walletAmount < 0).length,
                    negativeAmount: metrics.negativeWallet
                },
                leads: {
                    total: metrics.leadsTotal,
                    converted: metrics.convertedLeads,
                    conversionRate: metrics.conversionRate
                },
                status: tl.status,
                totalCollection: metrics.collection,
                dailyCollection: dailyCollections[tl.id] || 0,
                weeklyCollection: weeklyCollections[tl.id] || 0,
                avgRiderCollection: metrics.activeRiders > 0 ? Math.round(periodCollection / metrics.activeRiders) : 0,
                perDayAverageCollection: perDayAverageCollection || 0,
                activeDays, // Added activeDays here
                leadsToday: tlLeads.filter(l => {
                    const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
                    const leadDate = istFormatter.format(new Date(l.createdAt));
                    const todayDate = istFormatter.format(new Date());
                    return leadDate === todayDate;
                }).length,
                churnLeads: tlLeads.filter(l => l.status === 'Not Convert').length,
                criticalDebtCount: tlRiders.filter(r => r.status === 'active' && r.walletAmount < -3000).length,
                lastActivity,
                allotments: metrics.allotments,
                submissions: metrics.submissions,
                netGrowth: metrics.netGrowth
            };
        });
    }, [rawData, tlCollections, dailyCollections, weeklyCollections, period]);

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

    return (
        <div className="space-y-5 pb-10">

            {/* --- HEADER --- */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card/60 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none"
            >
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="hidden sm:flex p-3 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-40 rounded-full" />
                            <Sparkles className="relative text-indigo-500" size={24} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1 drop-shadow-sm">
                            {isTL ? "Team Command Center" : "Admin Command Center"}
                        </h1>
                        <p className="text-muted-foreground text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            Live System Sync &mdash; {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }).format(new Date())}
                        </p>
                    </div>
                </div>
                <div className="flex w-full sm:w-auto p-1.5 bg-slate-100/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-border/50 overflow-x-auto hide-scrollbar">
                    {(['all', 'day', 'week', 'month'] as DateFilterType[]).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setDateFilter(filter)}
                            className={`
                                flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap
                                ${dateFilter === filter
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md scale-100 ring-1 ring-black/5 dark:ring-white/5'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 scale-95 hover:scale-100'
                                }
                            `}
                        >
                            {filter === 'all' ? 'All Time' : filter === 'day' ? 'Today' : filter === 'month' ? 'Month' : 'Week'}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Wallet Sync Widget */}
            <WalletSyncWidget />
            {/* --- Fleet & Operations --- */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2.5 sm:gap-3 px-1">
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30 border border-white/20">
                            <Activity size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent dark:from-emerald-400 dark:to-emerald-200">Fleet & Operations</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/40 via-emerald-500/10 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 animate-in slide-in-from-bottom duration-700 font-jakarta">
                    <SmartMetricCard
                        title="System Health"
                        value={`${stats.activeRiders}/${stats.totalRiders}`}
                        icon={Activity}
                        color="emerald"
                        trend={{ value: 94, label: 'uptime', direction: 'up' }}
                        subtitle="Active Riders Ratio"
                        className="shadow-emerald-500/10"
                        progress={stats.totalRiders > 0 ? (stats.activeRiders / stats.totalRiders) * 100 : 0}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'active' } })}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Team Strength"
                        value={stats.totalTLs.toString()}
                        icon={Users}
                        color="orange"
                        subtitle={`${stats.activeTLs} Active Leaders`}
                        onClick={() => navigate('/portal/users?role=teamLeader')}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Pending Ops"
                        value={stats.pendingRequests}
                        icon={Inbox}
                        color="blue"
                        aiInsight={stats.criticalRequests > 0 ? `${stats.criticalRequests} critical tickets open.` : undefined}
                        subtitle={`${stats.criticalRequests} High Priority`}
                        onClick={() => navigate('/portal/requests?status=pending')}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Growth Engine"
                        value={`${stats.conversionRate}%`}
                        icon={UserPlus}
                        color="fuchsia"
                        trend={{ value: 5, label: 'velocity', direction: 'up' }}
                        subtitle={`${stats.newLeadsToday} New Leads Today`}
                        progress={stats.conversionRate}
                        onClick={() => navigate('/portal/leads?status=New')}
                        isCurrency={false}
                    />
                </div>
            </motion.div>

            {/* --- Financial Performance --- */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2.5 sm:gap-3 px-1 mt-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30 border border-white/20">
                            <TrendingUp size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent dark:from-indigo-400 dark:to-indigo-200">Financial Performance</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/40 via-indigo-500/10 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-jakarta">
                    {/* --- ROW 2: FINANCIAL PERFORMANCE --- */}
                    <SmartMetricCard
                        title="Total Collections"
                        value={stats.totalCollection}
                        icon={Wallet}
                        color="indigo"
                        trend={{ value: 12, label: 'revenue', direction: 'up' }}
                        subtitle={`${stats.positiveWalletCount} Positive Wallets`}
                        progress={stats.totalRiders > 0 ? (stats.positiveWalletCount / stats.totalRiders) * 100 : 0}
                        onClick={() => navigate('/portal/data', { state: { tab: 'import' } })}
                    />

                    <TodaysCollectionCard />

                    <SmartMetricCard
                        title="Net Liquidity"
                        value={stats.netBalance}
                        icon={Smartphone}
                        color="violet"
                        subtitle="Total System Value"
                        onClick={() => navigate('/portal/riders')}
                    />

                    <SmartMetricCard
                        title="Avg Wallet"
                        value={stats.avgBalance}
                        icon={TrendingUp}
                        color="cyan"
                        subtitle="Mean Fleet Balance"
                        onClick={() => navigate('/portal/riders')}
                    />
                </div>
            </motion.div>

            {/* --- Wallet Health & Risk --- */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2.5 sm:gap-3 px-1 mt-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-amber-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30 border border-white/20">
                            <ShieldCheck size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent dark:from-amber-400 dark:to-amber-200">Wallet Health & Risk</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-jakarta">
                    {/* --- ROW 3: RIDER WALLET HEALTH --- */}
                    <SmartMetricCard
                        title="Positive Riders"
                        value={stats.positiveWalletCount}
                        icon={TrendingUp}
                        color="emerald"
                        subtitle="Wallet > 0"
                        trend={{ value: Math.round((stats.positiveWalletCount / stats.totalRiders) * 100), label: 'of fleet', direction: 'up' }}
                        progress={stats.totalRiders > 0 ? (stats.positiveWalletCount / stats.totalRiders) * 100 : 0}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'positive_wallet' } })}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Negative Riders"
                        value={stats.negativeWalletCount}
                        icon={TrendingDown}
                        color="rose"
                        subtitle="Wallet < 0"
                        trend={{ value: Math.round((stats.negativeWalletCount / stats.totalRiders) * 100), label: 'of fleet', direction: 'down' }}
                        progress={stats.totalRiders > 0 ? (stats.negativeWalletCount / stats.totalRiders) * 100 : 0}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'negative_wallet' } })}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Zero Balance"
                        value={stats.zeroWalletCount}
                        icon={Coins}
                        color="amber"
                        subtitle="Dormant Wallets"
                        onClick={() => navigate('/portal/riders', { state: { filter: 'zero_balance' } })}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Low Balance (0-250)"
                        value={stats.lowBalanceCount}
                        icon={AlertTriangle}
                        color="orange"
                        className={stats.lowBalanceCount > 0 ? 'animate-pulse ring-1 ring-orange-500/30' : ''}
                        subtitle="At-Risk of Rejection"
                        onClick={() => navigate('/portal/riders', { state: { filter: 'low_balance' } })}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Highly Indebted"
                        value={stats.highDebtCount}
                        icon={TrendingDown}
                        color="red"
                        className={stats.highDebtCount > 5 ? 'animate-pulse ring-2 ring-red-500/50' : ''}
                        subtitle="Debt > ₹3000"
                        onClick={() => navigate('/portal/riders', { state: { filter: 'high_debt' } })}
                        isCurrency={false}
                    />

                    {/* --- ROW 4: SYSTEM RISK & CHURN --- */}
                    <SmartMetricCard
                        title="Outstanding Risk"
                        value={stats.outstandingDues}
                        icon={AlertTriangle}
                        color="rose"
                        aiInsight={stats.highDebtCount > 0 ? `${stats.highDebtCount} riders need immediate collection.` : undefined}
                        subtitle={`${stats.negativeWalletCount} Negative Wallets`}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'negative_wallet' } })}
                        isCurrency={true}
                    />

                    <SmartMetricCard
                        title="Conversion"
                        value={stats.convertedLeads}
                        icon={Sparkles}
                        color="lime"
                        subtitle="Last 30 Days"
                        onClick={() => navigate('/portal/leads?status=Convert')}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Churn Monitor"
                        value={stats.inactiveRiders}
                        icon={UserCheck}
                        color="slate"
                        subtitle={`${stats.deletedRiders} Permanently Deleted`}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'inactive' } })}
                        isCurrency={false}
                    />
                </div>
            </motion.div>

            {/* ── Charts & Activity ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-in slide-in-from-bottom duration-700 delay-300">
                {/* Charts Area (2/3 width) */}
                <div className="lg:col-span-2">
                    <DashboardCharts
                        riderData={chartData.riders}
                        walletData={chartData.wallet.filter(d => d.value !== 0)}
                        leadData={chartData.leads}
                    />
                </div>

                {/* Activity Feed (1/3 width) */}
                <div className="lg:col-span-1 flex flex-col gap-3">
                    <div>
                        <WeeklyCollectionChart />
                    </div>
                    <div className="flex-grow">
                        <RecentActivity />
                    </div>
                </div>
            </div>

            {/* TL Performance Table & System Health (Admin Only) */}
            {!isTL && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 animate-in slide-in-from-bottom duration-700 delay-400 mb-6">
                        <div className="lg:col-span-3">
                            <TeamLeaderPerformanceTable data={tlStats} />
                        </div>
                        <div className="lg:col-span-1">
                            <SystemHealthWidget />
                        </div>
                    </div>

                    {/* V4 Admin Live Presence Dashboard */}
                    <div className="animate-in slide-in-from-bottom duration-700 delay-500 mb-6">
                        <LivePresenceDashboard />
                    </div>
                </>
            )}

            {/* Premium AI Leaderboard Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="relative rounded-2xl sm:rounded-3xl p-[3px] bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 shadow-2xl overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                <div className="bg-card/80 dark:bg-slate-950/70 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <motion.div
                                whileHover={{ rotate: [0, -8, 8, 0] }}
                                className="p-2.5 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-xl border border-yellow-500/30"
                            >
                                <Trophy size={24} className="text-yellow-500" />
                            </motion.div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                                    Fleet Champions
                                </h2>
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mt-0.5">
                                    Live Performance Network
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/90 border border-white/20 rounded-full shadow-xl w-fit">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                            </span>
                            <span className="text-[9px] font-black tracking-widest text-white uppercase">Neural Realtime Sync</span>
                        </div>

                        <button
                            onClick={() => navigate('/portal/leaderboard')}
                            className="group relative flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white rounded-xl font-black text-xs uppercase tracking-widest text-white dark:text-slate-950 shadow-xl hover:scale-105 active:scale-95 transition-all self-start sm:self-auto"
                        >
                            <span className="relative z-10">Expand Rankings</span>
                            <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                        </button>
                    </div>

                    <Leaderboard
                        teamLeaders={rawData.teamLeaders}
                        riders={rawData.riders}
                        leads={rawData.leads}
                        collections={tlCollections}
                        period={period || undefined}
                    />
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;