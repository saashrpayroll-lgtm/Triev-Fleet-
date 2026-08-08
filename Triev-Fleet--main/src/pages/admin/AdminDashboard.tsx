import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Users, UserCheck, Wallet, Inbox, UserPlus, Sparkles, TrendingUp, TrendingDown, AlertTriangle, Coins, Activity, Smartphone, Trophy, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';
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
import FleetHealthSummary from '@/components/dashboard/FleetHealthSummary';
import FleetAIHealthWidget from '@/components/dashboard/FleetAIHealthWidget';
import ZomatoVIPSection from '@/components/dashboard/ZomatoVIPSection';
import WalletWatchlist from '@/components/dashboard/WalletWatchlist';
import PerformanceAlerts from '@/components/dashboard/PerformanceAlerts';
import RiderTenure from '@/components/dashboard/RiderTenure';
import RevenueForecast from '@/components/dashboard/RevenueForecast';
import QuickInsightStrip from '@/components/dashboard/QuickInsightStrip';
import TLComparisonCard from '@/components/dashboard/TLComparisonCard';
import FleetGrowthIndicator from '@/components/dashboard/FleetGrowthIndicator';
import { startOfWeek, startOfMonth } from 'date-fns';
import { sanitizeArray } from '@/utils/sanitizeData';
import { resolvePerformancePeriod, DateFilterType } from '@/utils/dateUtils';
import { calculateAIScore } from '@/utils/performance';

const Dashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [dateFilter, setDateFilter] = useState<DateFilterType>('day');
    const [loading, setLoading] = useState(true);
    // Progressive rendering: defer heavy sections to avoid blocking sidebar/header
    const [renderPhase, setRenderPhase] = useState(0); // 0=stats only, 1=charts, 2=tables, 3=leaderboard
    // Fetch lock: prevent concurrent fetches that pile up and freeze UI
    const isFetchingRef = useRef(false);


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
    // ✅ FIX: Separate period-aware rent collection total from wallet data
    const [periodRentTotal, setPeriodRentTotal] = useState<number>(0);
    // ✅ FIX: Period-aware fleet snapshots from daily_collections.active_riders_count
    const [fleetSnapshots, setFleetSnapshots] = useState<{
        today: number;    // sum of today's active_riders_count across all TLs
        week: number;     // sum of latest snapshot per TL within this week
        month: number;    // sum of latest snapshot per TL within this month
        allTime: number;  // live rider count (fallback)
    }>({ today: 0, week: 0, month: 0, allTime: 0 });

    // --- Data Fetching ---
    // --- Data Fetching & Real-time ---
    const fetchDashboardData = React.useCallback(async (isInitial = false) => {
        if (!userData) return;
        // Prevent concurrent fetches — if one is in-flight, skip this call
        if (isFetchingRef.current && !isInitial) return;
        isFetchingRef.current = true;
        if (isInitial) setLoading(true);

        try {
            const [ridersRes, leadsRes, requestsRes, usersRes, dailyRes, todayLedgerRes] = await Promise.all([
                fetchAllRidersPaginated(`
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
                `),
                fetchTablePaginated('leads', `
                    id,
                    leadId:lead_id,
                    riderName:rider_name,
                    status,
                    createdBy:created_by,
                    createdAt:created_at
                `),
                fetchTablePaginated('requests', `
                    id,
                    status,
                    createdAt:created_at
                `),
                fetchTablePaginated('users', `
                    id,
                    fullName:full_name,
                    email,
                    status,
                    role,
                    profilePicUrl:profile_pic_url
                `, [
                    { column: 'role', operator: 'eq', value: 'teamLeader' }
                ]),
                fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date, active_riders_count', [
                    { column: 'date', operator: 'gte', value: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) }
                ]),
                fetchTablePaginated('wallet_ledger', `
                    amount,
                    transaction_type,
                    transaction_date,
                    created_at,
                    rider:riders!inner (
                        team_leader_id
                    )
                `, [
                    { column: 'mode', operator: 'eq', value: 'ADD' },
                    { column: 'transaction_type', operator: 'in', value: [
                        'DAILY_COLLECTION', 'DAILY COLLECTION',
                        'RENT_COLLECTION', 'RENT COLLECTION',
                        'FTD_COLLECTION', 'FTD COLLECTION',
                        'COLLECTION', 'RENT'
                    ]},
                    { operator: 'or', value: (() => {
                        const now = new Date();
                        const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
                        const [y, m, d] = todayIST.split('-').map(Number);
                        const midnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
                        return `and(transaction_date.gte.${midnight},transaction_date.lte.${new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000).toISOString()}),and(transaction_date.is.null,created_at.gte.${midnight})`;
                    })() }
                ])
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

            // ✅ FIX: Fleet snapshot maps — track latest active_riders_count per TL per period
            // We use the MOST RECENT snapshot within each window (last ordered row since we order desc)
            const tlTodayFleet: Record<string, number> = {};      // TL → fleet on today
            const tlLatestFleetInWeek: Record<string, number> = {};  // TL → latest snapshot in week
            const tlLatestFleetInMonth: Record<string, number> = {}; // TL → latest snapshot in month

            const now2 = new Date();
            const ist2 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const nowStr2 = ist2.format(now2);
            const [yr2, mo2] = nowStr2.split('-').map(Number);
            const monthStart2 = `${yr2}-${String(mo2).padStart(2, '0')}-01`;

            dailyData.forEach((d: any) => {
                const tlId = d.team_leader_id;
                const amt = Number(d.total_collection) || 0;
                const fleetCount = Number(d.active_riders_count) || 0;
                const dDateStr = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;

                // All-time total
                collections[tlId] = (collections[tlId] || 0) + amt;

                // Today snapshot
                if (dDateStr === todayStr) {
                    tlsWithTodaySnapshot.add(tlId);
                    dayMap[tlId] = (dayMap[tlId] || 0) + amt;
                    // Fleet: take today's snapshot
                    if (fleetCount > 0) tlTodayFleet[tlId] = fleetCount;
                }

                // Weekly: use date string (authoritative) — includes today if snapshot exists
                if (dDateStr >= weekStart) {
                    weekMap[tlId] = (weekMap[tlId] || 0) + amt;
                    // Fleet: keep the most recent (dailyData is ordered desc, first encounter = latest)
                    if (fleetCount > 0 && !tlLatestFleetInWeek[tlId]) tlLatestFleetInWeek[tlId] = fleetCount;
                }

                // Monthly fleet snapshot
                if (dDateStr >= monthStart2 && dDateStr <= nowStr2) {
                    if (fleetCount > 0 && !tlLatestFleetInMonth[tlId]) tlLatestFleetInMonth[tlId] = fleetCount;
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

            // ✅ FIX: Per-TL fleet fleet snapshot with LIVE FALLBACK
            // Key problem: simple sum of snapshots misses TLs who don't have a daily_collections
            // entry yet for today (only TLs with today's import have one).
            // Solution: for each TL, use their snapshot if it exists, else count live active riders.
            const allRiderData = ridersRes.data || [];
            const liveFleetByTL: Record<string, number> = {};
            allRiderData.forEach((r: any) => {
                if (r.status === 'active' && r.team_leader_id) {
                    liveFleetByTL[r.team_leader_id] = (liveFleetByTL[r.team_leader_id] || 0) + 1;
                }
            });
            const allTlIds = Object.keys(liveFleetByTL);

            const computeFleetTotal = (snapshotMap: Record<string, number>): number =>
                allTlIds.reduce((sum, tlId) =>
                    sum + (snapshotMap[tlId] && snapshotMap[tlId] > 0 ? snapshotMap[tlId] : (liveFleetByTL[tlId] || 0)),
                    0);

            const liveActiveCount = allRiderData.filter((r: any) => r.status === 'active').length;
            setFleetSnapshots({
                today: computeFleetTotal(tlTodayFleet),
                week: computeFleetTotal(tlLatestFleetInWeek),
                month: computeFleetTotal(tlLatestFleetInMonth),
                allTime: liveActiveCount,  // live is always correct for all-time
            });

            // ✅ FIX: Compute total rent collected from daily_collections (authoritative source)
            // This is used for the Admin Dashboard "Total Collections" card
            const totalFromDailyCollections = Object.values(collections).reduce((a, b) => a + b, 0)
                + Object.values(liveTodayByTL).reduce((a, b) => a + b, 0);
            setPeriodRentTotal(totalFromDailyCollections);

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
            isFetchingRef.current = false;
            if (isInitial) setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        fetchDashboardData(true);

        // Debounce: avoid hammering fetchDashboardData on rapid ledger inserts
        let ledgerDebounce: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            // Skip re-fetches while tab is hidden (saves CPU + network)
            if (document.hidden) return;
            if (ledgerDebounce) clearTimeout(ledgerDebounce);
            ledgerDebounce = setTimeout(() => fetchDashboardData(), 4000);
        };

        const channel = supabase
            .channel('dashboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchDebounced)
            // ✅ FIX: wallet_ledger realtime — keeps today/weekly collection maps live
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, fetchDebounced)
            .subscribe();

        // ✅ FIX: Re-fetch data when app comes back from background
        // Mobile browsers kill WebSocket connections when the app is backgrounded.
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchDashboardData();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            supabase.removeChannel(channel);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchDashboardData]);

    // Progressive rendering: stagger heavy sections so sidebar stays responsive
    useEffect(() => {
        if (loading) return;
        // Phase 1: Charts & activity (after a short breath)
        const t1 = setTimeout(() => setRenderPhase(1), 50);
        // Phase 2: TL table, system health, analytics (after 200ms)
        const t2 = setTimeout(() => setRenderPhase(2), 200);
        // Phase 3: Leaderboard & presence (after 400ms)
        const t3 = setTimeout(() => setRenderPhase(3), 400);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [loading]);

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

        // Wallet Calcs — only for ACTIVE riders (wallet_amount for inactive is already 0 in rawData)
        const activeRidersList = riders.filter(r => r.status === 'active');
        const totalWallet = activeRidersList.reduce((sum, r) => sum + r.walletAmount, 0);
        const positiveWalletData = activeRidersList.filter(r => r.walletAmount > 0);
        const negativeWalletData = activeRidersList.filter(r => r.walletAmount < 0);
        // ✅ FIX: zeroWallet should only count ACTIVE riders with 0 balance, not inactive (all show 0)
        const zeroWalletData = activeRidersList.filter(r => r.walletAmount === 0);

        const negativeSum = negativeWalletData.reduce((sum, r) => sum + r.walletAmount, 0);
        const avgWallet = activeRidersList.length > 0 ? Math.round(totalWallet / activeRidersList.length) : 0;

        // Critical Monitors
        const highDebtRiders = negativeWalletData.filter(r => r.walletAmount < -3000);
        const criticalRequests = requests.filter(r => r.priority === 'high');

        // ✅ FIX: Compute period-specific rent total from daily_collections
        const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const nowStr = istFormatter.format(new Date());
        const dailyColRaw = (rawData as any).dailyCollectionsRaw || [];
        let periodRent = 0;
        if (dateFilter === 'all') {
            periodRent = periodRentTotal;
        } else if (dateFilter === 'day') {
            // Sum all TLs' today collection from dayMap
            periodRent = Object.values(dailyCollections).reduce((a, b) => a + b, 0);
        } else if (dateFilter === 'week') {
            periodRent = Object.values(weeklyCollections).reduce((a, b) => a + b, 0);
        } else if (dateFilter === 'month') {
            const yr = new Date().getUTCFullYear();
            const mo = new Date().getUTCMonth() + 1;
            const monthStart = `${yr}-${String(mo).padStart(2, '0')}-01`;
            periodRent = dailyColRaw
                .filter((d: any) => {
                    const dDate = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;
                    return dDate >= monthStart && dDate <= nowStr;
                })
                .reduce((s: number, d: any) => s + (Number(d.total_collection) || 0), 0);
        }

        return {
            // Riders — active fleet is period-aware via daily_collections snapshots
            totalRiders: riders.length,
            // ✅ FIX: Live count for today and all-time, snapshots for past periods
            activeRiders: dateFilter === 'day'
                ? activeRidersList.length
                : dateFilter === 'week'
                    ? (fleetSnapshots.week || activeRidersList.length)
                    : dateFilter === 'month'
                        ? (fleetSnapshots.month || activeRidersList.length)
                        : activeRidersList.length,  // 'all' = live count
            inactiveRiders: riders.filter(r => r.status === 'inactive').length,
            deletedRiders: riders.filter(r => r.status === 'deleted').length,

            // Wallet Counts (active riders only)
            positiveWalletCount: positiveWalletData.length,
            negativeWalletCount: negativeWalletData.length,
            zeroWalletCount: zeroWalletData.length,
            highDebtCount: highDebtRiders.length,
            lowBalanceCount: activeRidersList.filter(r => r.walletAmount >= 0 && r.walletAmount <= 250).length,

            // Finance Amounts
            // ✅ FIX: totalCollection = actual rent from daily_collections for selected period
            //         NOT wallet positive balances (which change daily)
            totalCollection: periodRent,
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
            activeTLs: teamLeaders.filter(u => u.status === 'active').length,
            
            // Zomato VIP Stats — pre-filter once for efficiency
            ...(() => {
                const vipRiders = activeRidersList.filter(r => r.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (r as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP'));
                const vipPos = vipRiders.filter(r => r.walletAmount >= 0);
                const vipNeg = vipRiders.filter(r => r.walletAmount < 0);
                const vipWalletTotal = vipRiders.reduce((s, r) => s + r.walletAmount, 0);
                return {
                    zomatoTotal: vipRiders.length,
                    zomatoPosCount: vipPos.length,
                    zomatoNegCount: vipNeg.length,
                    zomatoLowBalance: vipRiders.filter(r => r.walletAmount >= 0 && r.walletAmount <= 250).length,
                    zomatoHighDebt: vipRiders.filter(r => r.walletAmount < -3000).length,
                    zomatoWalletTotal: vipWalletTotal,
                    zomatoAvgWallet: vipRiders.length > 0 ? Math.round(vipWalletTotal / vipRiders.length) : 0,
                    zomatoPosAmt: vipPos.reduce((s, r) => s + r.walletAmount, 0),
                    zomatoNegAmt: vipNeg.reduce((s, r) => s + r.walletAmount, 0),
                };
            })()
        };
    }, [filteredData, periodRentTotal, dailyCollections, weeklyCollections, rawData, dateFilter, fleetSnapshots]);

    // --- Chart Data ---
    const chartData = useMemo(() => {

        return {
            riders: [
                { name: 'Active', value: stats.activeRiders, color: '#10b981' },
                { name: 'Inactive', value: stats.inactiveRiders, color: '#f59e0b' },
                { name: 'Deleted', value: stats.deletedRiders, color: '#f43f5e' }
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
                monthlyCollection: (() => {
                    const now = new Date();
                    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
                    const nowISTStr = formatter.format(now);
                    const [y, m] = nowISTStr.split('-').map(Number);
                    const monthStartStr = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0];
                    const monthEndStr = new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0];
                    const tlDailyData = (rawData as any).dailyCollectionsRaw || [];
                    return tlDailyData
                        .filter((d: any) => d.team_leader_id === tl.id && d.date >= monthStartStr && d.date <= monthEndStr)
                        .reduce((sum: number, d: any) => sum + (Number(d.total_collection) || 0), 0);
                })(),
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
                netGrowth: metrics.netGrowth,
                reportingManager: tl.reportingManager || '',
                score: metrics.score,
                aiGrade: metrics.aiGrade
            };
        });
    }, [rawData, tlCollections, dailyCollections, weeklyCollections, period]);

    // --- Render Loading ---
    if (loading) {
        return (
            <div className="space-y-5 pb-10 animate-in fade-in duration-500">
                {/* Skeleton Header */}
                <div className="bg-card/60 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 animate-pulse" />
                        <div className="space-y-2 flex-1">
                            <div className="h-7 w-64 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 animate-pulse" />
                            <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        </div>
                    </div>
                </div>
                {/* Skeleton Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-2xl border border-border/40 bg-card/50 space-y-3" style={{ animationDelay: `${i * 100}ms` }}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                            </div>
                            <div className="h-7 w-24 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        </div>
                    ))}
                </div>
                {/* Skeleton Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="lg:col-span-2 h-64 rounded-2xl bg-card/50 border border-border/40 animate-pulse" />
                    <div className="h-64 rounded-2xl bg-card/50 border border-border/40 animate-pulse" />
                </div>
                <p className="text-center text-muted-foreground text-xs font-medium animate-pulse">Initializing Premium Command Center...</p>
            </div>
        );
    }

    const isTL = userData?.role === 'teamLeader';

    return (
        <div className="space-y-4 pb-10">

            {/* --- HEADER --- */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card/60 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/30 relative overflow-hidden"
            >
                {/* Subtle animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] via-purple-500/[0.02] to-pink-500/[0.03] pointer-events-none animate-pulse" />

                <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                    <div className="hidden sm:flex p-3 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-40 rounded-full" />
                            <Sparkles className="relative text-indigo-500" size={24} />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-sm">
                                {isTL ? "Team Command Center" : "Admin Command Center"}
                            </h1>
                            {/* v2.0 Badge */}
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                <ShieldCheck size={10} /> v2.0
                            </span>
                        </div>
                        <p className="text-muted-foreground text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            Live System Sync &mdash; {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }).format(new Date())}
                            <span className="hidden md:inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black border border-emerald-500/20">
                                <Smartphone size={8} /> PWA
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex w-full sm:w-auto p-1.5 bg-slate-100/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-border/50 overflow-x-auto hide-scrollbar relative z-10">
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

            {/* Real-time Stats Ticker */}
            <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 overflow-x-auto hide-scrollbar px-1 py-1"
            >
                {[
                    { label: 'Active Fleet', value: stats.activeRiders, icon: '🟢', color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Collection', value: `₹${(stats.totalCollection || 0).toLocaleString('en-IN')}`, icon: '💰', color: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Dues', value: `₹${(stats.outstandingDues || 0).toLocaleString('en-IN')}`, icon: '⚠️', color: 'text-red-600 dark:text-red-400' },
                    { label: 'Leads', value: stats.totalLeads, icon: '📊', color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Pending', value: stats.pendingRequests, icon: '📬', color: 'text-violet-600 dark:text-violet-400' },
                ].map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card/50 border border-border/30 whitespace-nowrap shrink-0">
                        <span className="text-xs">{t.icon}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t.label}</span>
                        <span className={`text-xs font-black ${t.color}`}>{t.value}</span>
                    </div>
                ))}
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
                    {/* BLACK: System Health — premium dark card */}
                    <SmartMetricCard
                        title="System Health"
                        value={`${stats.activeRiders}/${stats.totalRiders}`}
                        icon={Activity}
                        color="emerald"
                        trend={{ value: stats.totalRiders > 0 ? Math.round((stats.activeRiders / stats.totalRiders) * 100) : 0, label: 'uptime', direction: 'up' }}
                        subtitle="Active Riders Ratio"
                        className="!bg-gradient-to-br !from-slate-950 !via-slate-900 !to-slate-950 dark:!from-slate-950 dark:!via-slate-900 dark:!to-slate-950 !border-slate-700/40 !text-white ring-1 !ring-emerald-500/20 shadow-xl shadow-slate-950/40 [&_p]:!text-slate-300 [&_span]:!text-slate-200"
                        progress={stats.totalRiders > 0 ? (stats.activeRiders / stats.totalRiders) * 100 : 0}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'active' } })}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Team Strength"
                        value={stats.totalTLs.toString()}
                        icon={Users}
                        color="violet"
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

            {/* --- Zomato VIP Intelligence --- */}
            <ZomatoVIPSection stats={stats} />

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

                    {/* NEW Projected vs Actual Revenue Card */}
                    <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-between hover:shadow-lg transition-all shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="text-xs font-black uppercase text-indigo-600/80 dark:text-indigo-400 tracking-wider">Revenue Projection (Daily)</h3>
                                <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 drop-shadow-sm">
                                    ₹{stats.totalCollection.toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
                                <TrendingUp size={16} className="sm:w-5 sm:h-5" />
                            </div>
                        </div>
                        <div className="mt-auto">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    Target: ₹{(stats.activeRiders * 500).toLocaleString('en-IN')}
                                </span>
                                <span className="text-[10px] sm:text-xs font-black text-indigo-600 dark:text-indigo-400">
                                    {stats.activeRiders > 0 ? Math.min(100, Math.round((stats.totalCollection / (stats.activeRiders * 500)) * 100)) : 0}% Formed
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden flex">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stats.activeRiders > 0 ? Math.min(100, ((stats.totalCollection / (stats.activeRiders * 500)) * 100)) : 0}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                />
                            </div>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1.5 font-medium flex items-center gap-1">
                                <Activity size={10} /> Based on approx. ₹500/day per active rider
                            </p>
                        </div>
                    </div>

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

                    {/* BLACK: Outstanding Risk — premium dark card */}
                    <SmartMetricCard
                        title="Outstanding Risk"
                        value={stats.outstandingDues}
                        icon={AlertTriangle}
                        color="rose"
                        aiInsight={stats.highDebtCount > 0 ? `${stats.highDebtCount} riders need immediate collection.` : undefined}
                        subtitle={`${stats.negativeWalletCount} Negative Wallets`}
                        className="!bg-gradient-to-br !from-slate-950 !via-slate-900 !to-slate-950 dark:!from-slate-950 dark:!via-slate-900 dark:!to-slate-950 !border-slate-700/40 !text-white ring-1 !ring-rose-500/30 shadow-xl shadow-slate-950/40 [&_p]:!text-slate-300 [&_span]:!text-slate-200"
                        onClick={() => navigate('/portal/riders', { state: { filter: 'negative_wallet' } })}
                        isCurrency={true}
                    />
                </div>
            </motion.div>

            {/* --- Growth & Retention --- */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2.5 sm:gap-3 px-1 mt-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-lime-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-lime-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-lime-500/30 border border-white/20">
                            <Zap size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-lime-600 to-emerald-500 bg-clip-text text-transparent dark:from-lime-400 dark:to-emerald-300">Growth & Retention</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-lime-500/40 via-lime-500/10 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-2 font-jakarta">
                    <SmartMetricCard
                        title="Lead Conversion"
                        value={stats.convertedLeads}
                        icon={Sparkles}
                        color="lime"
                        trend={{ value: stats.conversionRate, label: 'rate', direction: 'up' }}
                        subtitle={`${stats.totalLeads} Total Leads`}
                        progress={stats.conversionRate}
                        onClick={() => navigate('/portal/leads?status=Convert')}
                        isCurrency={false}
                    />

                    <SmartMetricCard
                        title="Churn Monitor"
                        value={stats.inactiveRiders}
                        icon={UserCheck}
                        color="slate"
                        trend={{ value: stats.totalRiders > 0 ? Math.round((stats.inactiveRiders / stats.totalRiders) * 100) : 0, label: 'churn rate', direction: 'down' }}
                        subtitle={`${stats.deletedRiders} Permanently Deleted`}
                        onClick={() => navigate('/portal/riders', { state: { filter: 'inactive' } })}
                        isCurrency={false}
                    />
                </div>
            </motion.div>

            {/* --- Wallet Watchlist --- */}
            <WalletWatchlist riders={rawData.riders} />

            {/* --- Fleet AI Health --- */}
            <FleetAIHealthWidget
                riders={rawData.riders}
                title="Fleet AI Health Overview"
            />
            {/* ── Charts & Activity ── */}
            {renderPhase >= 1 && (
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
            )}

            {/* TL Performance Table & System Health (Admin Only) */}
            {!isTL && renderPhase >= 2 && (
                <>
                    {/* Admin Quick Insight Strip */}
                    <QuickInsightStrip
                        insights={[
                            { label: 'Fleet', value: stats.activeRiders, suffix: ' riders' },
                            { label: 'Rent Collected', value: `₹${periodRentTotal.toLocaleString('en-IN')}` },
                            { label: 'TLs', value: rawData.teamLeaders.length },
                            { label: 'Leads', value: stats.totalLeads },
                            { label: 'Debt', value: stats.negativeWalletCount, suffix: ' riders' },
                        ]}
                    />

                    {/* Fleet Health + Performance Alerts + Revenue Forecast */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-in slide-in-from-bottom duration-700 delay-350 mb-4">
                        <FleetHealthSummary riders={rawData.riders} />
                        <PerformanceAlerts
                            teamLeaders={rawData.teamLeaders}
                            riders={rawData.riders}
                            leads={rawData.leads}
                            tlCollections={tlCollections}
                            onViewTL={(_tlId) => navigate('/portal/leaderboard')}
                        />
                        <RevenueForecast
                            riders={rawData.riders}
                            currentMonthCollection={periodRentTotal}
                            dailyCollectionsRaw={rawData.dailyCollectionsRaw}
                        />
                    </div>

                    {/* Rider Tenure + TL Comparison + Fleet Growth */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-in slide-in-from-bottom duration-700 delay-375 mb-4">
                        <RiderTenure riders={rawData.riders} />
                        <TLComparisonCard
                            teamLeaders={rawData.teamLeaders}
                            riders={rawData.riders}
                            leads={rawData.leads}
                            tlCollections={tlCollections}
                        />
                        <FleetGrowthIndicator riders={rawData.riders} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 animate-in slide-in-from-bottom duration-700 delay-400 mb-4">
                        <div className="lg:col-span-3">
                            <TeamLeaderPerformanceTable data={tlStats} />
                        </div>
                        <div className="lg:col-span-1">
                            <SystemHealthWidget />
                        </div>
                    </div>

                    {/* V4 Admin Live Presence Dashboard */}
                    {renderPhase >= 3 && (
                    <div className="animate-in slide-in-from-bottom duration-700 delay-500 mb-4">
                        <LivePresenceDashboard />
                    </div>
                    )}
                </>
            )}

            {/* Premium AI Leaderboard Section */}
            {renderPhase >= 3 && (
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
            )}
        </div>
    );
};

export default Dashboard;