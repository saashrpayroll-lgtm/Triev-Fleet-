import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { Star, Users, Wallet, Zap, Activity, Shield, UserCheck, UserX, Sparkles, AlertTriangle, FileText, TrendingUp, X, Phone, MessageCircle, Bot, Trophy } from 'lucide-react';
import { Rider, User, Lead } from '@/types';
import Leaderboard from '@/components/Leaderboard';
import SmartMetricCard from '@/components/dashboard/SmartMetricCard';
import TodaysCollectionCard from '@/components/dashboard/TodaysCollectionCard';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { mapLeadFromDB } from '@/utils/leadUtils';
import { safeRender } from '@/utils/safeRender';
import ComponentErrorBoundary from '@/components/ComponentErrorBoundary';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import DebtRecoveryTasks from '@/components/dashboard/DebtRecoveryTasks';
import FleetAIHealthWidget from '@/components/dashboard/FleetAIHealthWidget';
import TLZomatoVIPSection from '@/components/dashboard/TLZomatoVIPSection';
import WalletWatchlist from '@/components/dashboard/WalletWatchlist';
import CollectionTargetCard from '@/components/dashboard/CollectionTargetCard';
import DefaulterAlertCard from '@/components/dashboard/DefaulterAlertCard';
import BadgeGallery from '@/components/BadgeGallery';
import ActivityStreak from '@/components/dashboard/ActivityStreak';
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget';
import AIVirtualOpsCopilot from '@/components/dashboard/AIVirtualOpsCopilot';
import QuickInsightStrip from '@/components/dashboard/QuickInsightStrip';
import CollectionHeatmap from '@/components/dashboard/CollectionHeatmap';
import NotificationCenter from '@/components/dashboard/NotificationCenter';
import LeadConversionFunnel from '@/components/dashboard/LeadConversionFunnel';
import { resolvePerformancePeriod, DateFilterType } from '@/utils/dateUtils';
import { calculateAIScore } from '@/utils/performance';
import { computeEarnedBadges } from '@/utils/badges';
import { getCallLink } from '@/utils/validationUtils';
import AIReminderModal from '@/components/AIReminderModal';
import ZomatoNegativeAlertModal from '@/components/ZomatoNegativeAlertModal';
import ZomatoLowBalanceAlertModal from '@/components/ZomatoLowBalanceAlertModal';
import {
    useZomatoVIPPopupConfig,
    filterZomatoEligibleRiders,
    filterZomatoLowBalanceRiders,
    isPopupVisibleForUser,
    isLowBalancePopupVisibleForUser
} from '@/hooks/useZomatoVIPPopupConfig';
import ElevenLabsCallModal from '@/components/ElevenLabsCallModal';
import BulkCollectionModal from '@/components/BulkCollectionModal';
import FieldCheckInModal from '@/components/FieldCheckInModal';
import LiveAlertCenter from '@/components/LiveAlertCenter';

interface DashboardStats {
    // Riders
    totalRiders: number;
    activeRiders: number;
    inactiveRiders: number;
    deletedRiders: number;
    lowBalanceCount: number;
    // Wallet
    positiveWallet: number;
    negativeWallet: number;
    zeroWallet: number;
    totalPositiveAmount: number;
    totalNegativeAmount: number;
    // Leads
    totalLeads: number;
    newLeads: number;
    convertedLeads: number;
    notConvertedLeads: number;
    // Zomato
    zomatoTotal: number;
    zomatoPosCount: number;
    zomatoNegCount: number;
    zomatoLowBalance: number;
    zomatoHighDebt: number;
    zomatoWalletTotal: number;
    zomatoAvgWallet: number;
    zomatoPosAmt: number;
    zomatoNegAmt: number;
}

const Dashboard: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    // Progressive rendering: defer heavy sections to avoid blocking sidebar/header
    const [renderPhase, setRenderPhase] = useState(0);
    // Fetch lock: prevent concurrent fetches
    const isFetchingRef = useRef(false);

    // Stats State mapped from Leaderboard logic to respect Date Filters
    const [dateFilter, setDateFilter] = useState<DateFilterType>('day');
    const [aiInsight, setAiInsight] = useState<string>('');

    const [selectedBracket, setSelectedBracket] = useState<string | null>(null);
    const [selectedReminderRider, setSelectedReminderRider] = useState<Rider | null>(null);
    const [reminderType, setReminderType] = useState<'low_balance' | 'warning' | 'critical' | 'inactive' | 'zero_collection'>('low_balance');

    // ElevenLabs AI Outbound Call State
    const [selectedCallRider, setSelectedCallRider] = useState<Rider | null>(null);
    const [showElevenLabsModal, setShowElevenLabsModal] = useState(false);

    // Zomato Alert State & Dynamic Admin Config
    const { negativeConfig: zomatoPopupConfig, lowBalanceConfig: zomatoLBPopupConfig } = useZomatoVIPPopupConfig();
    const [showZomatoAlert, setShowZomatoAlert] = useState(false);
    const [hasShownZomatoAlert, setHasShownZomatoAlert] = useState(false);
    const [showZomatoLBAlert, setShowZomatoLBAlert] = useState(false);
    const [hasShownZomatoLBAlert, setHasShownZomatoLBAlert] = useState(false);

    // Bulk Collection & Field Check-In Helper States
    const [showBulkCollectionModal, setShowBulkCollectionModal] = useState(false);
    const [selectedCheckInRider, setSelectedCheckInRider] = useState<Rider | null>(null);
    const [showFieldCheckInModal, setShowFieldCheckInModal] = useState(false);

    const handleCall = (phoneNumber: string) => {
        if (!phoneNumber) return;
        window.open(getCallLink(phoneNumber), '_self');
    };

    // Raw Data for Memo
    const [dailyCollectionsRaw, setDailyCollectionsRaw] = useState<any[]>([]);
    const [liveTodayByTLRaw, setLiveTodayByTLRaw] = useState<Record<string, number>>({});
    const [liveFleetByTLRaw, setLiveFleetByTLRaw] = useState<Record<string, number>>({});

    // Live Collections for Debt Recovery
    const [tlTodayCollectionsByRider, setTlTodayCollectionsByRider] = useState<Record<string, number>>({});

    // Leaderboard Data State
    const [leaderboardData, setLeaderboardData] = useState<{ teamLeaders: User[], riders: Rider[], leads: Lead[] }>({
        teamLeaders: [], riders: [], leads: []
    });

    const computedPeriodData = React.useMemo(() => {
        const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const now = new Date();
        const nowStr = istFormatter.format(now);
        const dayOfWeek = now.getDay() || 7;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek + 1);
        const weekStartStr = istFormatter.format(weekStart);
        const monthStartStr = nowStr.substring(0, 8) + '01';

        const dayMap: Record<string, number> = {};
        const weekMap: Record<string, number> = {};
        const monthMap: Record<string, number> = {};
        const allTimeMap: Record<string, number> = {};

        const tlTodayFleet: Record<string, number> = {};
        const tlLatestFleetInWeek: Record<string, number> = {};
        const tlLatestFleetInMonth: Record<string, number> = {};
        const tlsWithTodaySnapshot = new Set<string>();

        dailyCollectionsRaw.forEach((d: any) => {
            const tlId = d.team_leader_id;
            const amt = Number(d.total_collection) || 0;
            const fleetCount = Number(d.active_riders_count) || 0;
            const dDateStr = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;

            allTimeMap[tlId] = (allTimeMap[tlId] || 0) + amt;

            if (dDateStr === nowStr) {
                tlsWithTodaySnapshot.add(tlId);
                dayMap[tlId] = (dayMap[tlId] || 0) + amt;
                if (fleetCount > 0) tlTodayFleet[tlId] = fleetCount;
            }
            if (dDateStr >= weekStartStr) {
                weekMap[tlId] = (weekMap[tlId] || 0) + amt;
                if (fleetCount > 0 && !tlLatestFleetInWeek[tlId]) tlLatestFleetInWeek[tlId] = fleetCount;
            }
            if (dDateStr >= monthStartStr && dDateStr <= nowStr) {
                monthMap[tlId] = (monthMap[tlId] || 0) + amt;
                if (fleetCount > 0 && !tlLatestFleetInMonth[tlId]) tlLatestFleetInMonth[tlId] = fleetCount;
            }
        });

        Object.keys(liveTodayByTLRaw).forEach(tlId => {
            if (!tlsWithTodaySnapshot.has(tlId)) {
                dayMap[tlId] = liveTodayByTLRaw[tlId];
                weekMap[tlId] = (weekMap[tlId] || 0) + liveTodayByTLRaw[tlId];
                monthMap[tlId] = (monthMap[tlId] || 0) + liveTodayByTLRaw[tlId];
                allTimeMap[tlId] = (allTimeMap[tlId] || 0) + liveTodayByTLRaw[tlId];

                tlTodayFleet[tlId] = liveFleetByTLRaw[tlId] || 0;
                if (!tlLatestFleetInWeek[tlId]) tlLatestFleetInWeek[tlId] = liveFleetByTLRaw[tlId] || 0;
                if (!tlLatestFleetInMonth[tlId]) tlLatestFleetInMonth[tlId] = liveFleetByTLRaw[tlId] || 0;
            }
        });

        const resolveMap = (mapDay: any, mapWeek: any, mapMonth: any, mapAll: any) => {
            switch (dateFilter) {
                case 'day': return mapDay;
                case 'week': return mapWeek;
                case 'month': return mapMonth;
                case 'all': return mapAll;
                default: return mapAll;
            }
        };

        const resolveFleetMap = (_mapDay: any, mapWeek: any, mapMonth: any, mapAll: any) => {
            switch (dateFilter) {
                case 'day': return mapAll; // Live fleet is authoritative for today
                case 'week': return mapWeek;
                case 'month': return mapMonth;
                case 'all': return mapAll;
                default: return mapAll;
            }
        };

        return {
            collections: resolveMap(dayMap, weekMap, monthMap, allTimeMap),
            historicalFleet: resolveFleetMap(tlTodayFleet, tlLatestFleetInWeek, tlLatestFleetInMonth, liveFleetByTLRaw)
        };
    }, [dateFilter, dailyCollectionsRaw, liveTodayByTLRaw, liveFleetByTLRaw]);

    // ✅ Collection history for TL heatmap (moved from inline JSX to fix React hooks rules)
    const tlCollectionHistory = React.useMemo(() => {
        if (!userData) return {} as Record<string, number>;
        const map: Record<string, number> = {};
        (dailyCollectionsRaw || []).forEach((d: any) => {
            if (d.team_leader_id === userData.id) {
                const dateStr = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;
                map[dateStr] = (map[dateStr] || 0) + (Number(d.total_collection) || 0);
            }
        });
        return map;
    }, [dailyCollectionsRaw, userData]);

    const computedLeaderStats = React.useMemo(() => {
        if (!userData || !leaderboardData.riders.length) return null;
        return calculateAIScore(
            userData,
            leaderboardData.riders,
            leaderboardData.leads,
            computedPeriodData.collections[userData.id] || 0,
            resolvePerformancePeriod(dateFilter),
            computedPeriodData.historicalFleet[userData.id]
        );
    }, [userData, leaderboardData, computedPeriodData, dateFilter]);

    const stats: DashboardStats = React.useMemo(() => {
        if (!computedLeaderStats) return {
            totalRiders: 0, activeRiders: 0, inactiveRiders: 0, deletedRiders: 0, lowBalanceCount: 0,
            positiveWallet: 0, negativeWallet: 0, zeroWallet: 0, totalPositiveAmount: 0, totalNegativeAmount: 0,
            totalLeads: 0, newLeads: 0, convertedLeads: 0, notConvertedLeads: 0,
            zomatoTotal: 0, zomatoPosCount: 0, zomatoNegCount: 0,
            zomatoLowBalance: 0, zomatoHighDebt: 0, zomatoWalletTotal: 0, zomatoAvgWallet: 0, zomatoPosAmt: 0, zomatoNegAmt: 0
        };
        // Some fallback counts still need the myRiders data 
        const myRiders = leaderboardData.riders.filter(r => r.teamLeaderId === userData?.id);
        const lowBalanceCount = myRiders.filter(r => r.status === 'active' && r.walletAmount >= 0 && r.walletAmount < 250).length;

        // Zomato specific calculations — pre-filter once for efficiency
        const zomatoRiders = myRiders.filter(r => r.status === 'active' && (r.chassisNumber?.trim().toUpperCase().startsWith('P6DSVFMSP') || (r as any).chassis_number?.trim().toUpperCase().startsWith('P6DSVFMSP')));
        const vipPos = zomatoRiders.filter(r => r.walletAmount > 0);
        const vipNeg = zomatoRiders.filter(r => r.walletAmount <= 0);
        const vipWalletTotal = zomatoRiders.reduce((s, r) => s + r.walletAmount, 0);

        return {
            totalRiders: computedLeaderStats.totalRiders,
            activeRiders: computedLeaderStats.activeRiders,
            inactiveRiders: computedLeaderStats.inactiveRiders,
            deletedRiders: computedLeaderStats.churnRiders,
            lowBalanceCount: lowBalanceCount || 0,
            positiveWallet: computedLeaderStats.positiveWalletCount,
            negativeWallet: computedLeaderStats.negativeWalletCount,
            zeroWallet: 0,
            totalPositiveAmount: computedLeaderStats.positiveWallet,
            totalNegativeAmount: computedLeaderStats.negativeWallet,
            totalLeads: computedLeaderStats.leadsTotal,
            newLeads: 0,
            convertedLeads: computedLeaderStats.convertedLeads,
            notConvertedLeads: computedLeaderStats.leadsTotal - computedLeaderStats.convertedLeads,
            zomatoTotal: zomatoRiders.length,
            zomatoPosCount: vipPos.length,
            zomatoNegCount: vipNeg.length,
            zomatoLowBalance: zomatoRiders.filter(r => r.walletAmount >= 0 && r.walletAmount < 250).length,
            zomatoHighDebt: zomatoRiders.filter(r => r.walletAmount < -3000).length,
            zomatoWalletTotal: vipWalletTotal,
            zomatoAvgWallet: zomatoRiders.length > 0 ? Math.round(vipWalletTotal / zomatoRiders.length) : 0,
            zomatoPosAmt: vipPos.reduce((s, r) => s + r.walletAmount, 0),
            zomatoNegAmt: vipNeg.reduce((s, r) => s + r.walletAmount, 0),
        }
    }, [computedLeaderStats, leaderboardData.riders, userData?.id]);

    const eligibleZomatoAlertRiders = React.useMemo(() => {
        if (!userData?.id || !zomatoPopupConfig.isEnabled) return [];
        if (!isPopupVisibleForUser(userData, zomatoPopupConfig)) return [];
        const myRiders = leaderboardData.riders.filter(r => r.teamLeaderId === userData.id);
        return filterZomatoEligibleRiders(myRiders, zomatoPopupConfig);
    }, [leaderboardData.riders, userData, zomatoPopupConfig]);

    const eligibleZomatoLBAlertRiders = React.useMemo(() => {
        if (!userData?.id || !zomatoLBPopupConfig.isEnabled) return [];
        if (!isLowBalancePopupVisibleForUser(userData, zomatoLBPopupConfig)) return [];
        const myRiders = leaderboardData.riders.filter(r => r.teamLeaderId === userData.id);
        return filterZomatoLowBalanceRiders(myRiders, zomatoLBPopupConfig);
    }, [leaderboardData.riders, userData, zomatoLBPopupConfig]);

    const earnedBadges = React.useMemo(() => {
        if (!userData || !leaderboardData.riders.length) return [];
        const myRiders = leaderboardData.riders.filter(r => r.teamLeaderId === userData.id);
        const myLeads = leaderboardData.leads.filter(l => l.createdBy === userData.id);
        const myCollection = computedPeriodData.collections[userData.id] || 0;
        return computeEarnedBadges(userData, myRiders, myLeads, myCollection, userData.monthlyTarget || 0);
    }, [userData, leaderboardData, computedPeriodData]);

    const walletBifurcation = React.useMemo(() => {
        if (!userData || !leaderboardData.riders.length) return { b100: 0, b200: 0, b500: 0, b1000: 0, bMax: 0 };
        const myActiveRiders = leaderboardData.riders.filter(r => r.teamLeaderId === userData.id && r.status === 'active');
        
        let b100 = 0, b200 = 0, b500 = 0, b1000 = 0, bMax = 0;
        myActiveRiders.forEach(r => {
            const w = r.walletAmount;
            if (w < 0 && w >= -100) b100++;
            else if (w < -100 && w >= -200) b200++;
            else if (w < -200 && w >= -500) b500++;
            else if (w < -500 && w >= -1000) b1000++;
            else if (w < -1000) bMax++;
        });
        return { b100, b200, b500, b1000, bMax };
    }, [userData, leaderboardData.riders]);

    const bracketRiders = React.useMemo(() => {
        if (!selectedBracket || !userData || !leaderboardData.riders.length) return [];
        const myActiveRiders = leaderboardData.riders.filter(r => r.teamLeaderId === userData.id && r.status === 'active');
        return myActiveRiders.filter(r => {
            const w = r.walletAmount;
            if (selectedBracket === 'b100') return w < 0 && w >= -100;
            if (selectedBracket === 'b200') return w < -100 && w >= -200;
            if (selectedBracket === 'b500') return w < -200 && w >= -500;
            if (selectedBracket === 'b1000') return w < -500 && w >= -1000;
            if (selectedBracket === 'bMax') return w < -1000;
            return false;
        }).sort((a,b) => a.walletAmount - b.walletAmount);
    }, [selectedBracket, userData, leaderboardData.riders]);

    // --- Data Fetching & Real-time ---
    const fetchStats = React.useCallback(async () => {
        if (!userData) return;
        // Prevent concurrent fetches
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            // Stats are now handled by pure useMemo from leaderboard data

            // 3. Global Leaderboard Data
            const { data: tlsData } = await supabase.from('users').select('id, full_name, email, role, profile_pic_url').eq('role', 'teamLeader');
            const allTls = (tlsData || []).map((u: any) => ({
                id: u.id,
                fullName: u.full_name,
                email: u.email,
                role: u.role,
                profilePicUrl: u.profile_pic_url || undefined
            })) as User[];

            const { data: allRidersData } = await fetchAllRidersPaginated(
                'id, triev_id, status, rider_name, mobile_number, wallet_amount, team_leader_id, allotment_date, inactivated_at, created_at, updated_at, chassis_number, client_name'
            );
            const allRiders = (allRidersData || []).map((r: any) => {
                const rawAmt = r.wallet_amount ?? r.walletAmount ?? 0;
                const numAmt = typeof rawAmt === 'number' ? rawAmt : (parseFloat(String(rawAmt).replace(/[^0-9.-]+/g, '')) || 0);
                const normStatus = String(r.status || 'active').trim().toLowerCase() as RiderStatus;

                return {
                    id: r.id,
                    trievId: r.triev_id || r.trievId || '',
                    status: normStatus,
                    riderName: r.rider_name || r.riderName || '',
                    mobileNumber: r.mobile_number || r.mobileNumber || '',
                    walletAmount: numAmt,
                    teamLeaderId: r.team_leader_id || r.teamLeaderId || '',
                    allotmentDate: r.allotment_date,
                    inactivatedAt: r.inactivated_at,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    chassisNumber: r.chassis_number || '',
                    clientName: r.client_name || ''
                };
            }) as Rider[];

            const { data: allLeadsData } = await supabase.from('leads').select('*');
            const allLeads = ((allLeadsData || [])).map(mapLeadFromDB);

            setLeaderboardData({ teamLeaders: allTls, riders: allRiders, leads: allLeads });

            // 4. Fetch Collections for Leaderboard (History + Today)
            // Use same robust transaction_date vs created_at logic as Admin
            const fallbackOrQuery = (() => {
                const now = new Date();
                const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
                const [y, m, d] = todayIST.split('-').map(Number);
                const midnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
                return `transaction_date.gte.${midnight},and(transaction_date.is.null,created_at.gte.${midnight})`;
            })();

            const [dailyRes, todayLedgerRes] = await Promise.all([
                supabase.from('daily_collections').select('team_leader_id, date, total_collection, active_riders_count'),
                supabase
                    .from('wallet_ledger')
                    .select('amount, rider_id, rider:riders!inner(id, team_leader_id)')
                    .eq('mode', 'ADD')
                    .in('transaction_type', ['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION', 'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION'])
                    .or(fallbackOrQuery)
            ]);

            const collections: Record<string, number> = {};
            const tlsWithTodaySnapshot = new Set<string>();

            const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const todayStr = istFormatter.format(new Date());

            // Add Historical
            (dailyRes.data || []).forEach((d: any) => {
                const tlId = d.team_leader_id;
                const amt = Number(d.total_collection) || 0;
                const dDateStr = d.date && typeof d.date === 'string' ? d.date.split('T')[0].split(' ')[0] : d.date;

                collections[tlId] = (collections[tlId] || 0) + amt;

                if (dDateStr === todayStr) {
                    tlsWithTodaySnapshot.add(tlId);
                }
            });

            // Add Live Today (only for TLs without a daily_collections snapshot yet)
            const todayLedger = (todayLedgerRes.data as any[]) || [];
            const liveTodayByTL: Record<string, number> = {};
            const liveTodayByRider: Record<string, number> = {};

            todayLedger.forEach(txn => {
                const tlId = txn.rider?.team_leader_id;
                const riderId = txn.rider_id || txn.rider?.id;
                const amount = Number(txn.amount) || 0;

                if (tlId && !tlsWithTodaySnapshot.has(tlId)) {
                    liveTodayByTL[tlId] = (liveTodayByTL[tlId] || 0) + amount;
                }

                if (riderId) {
                    liveTodayByRider[riderId] = (liveTodayByRider[riderId] || 0) + amount;
                }
            });

            Object.keys(liveTodayByTL).forEach(tlId => {
                collections[tlId] = (collections[tlId] || 0) + liveTodayByTL[tlId];
            });

            const liveFleet: Record<string, number> = {};
            allRiders.forEach(r => {
                if (r.status === 'active' && r.teamLeaderId) {
                    liveFleet[r.teamLeaderId] = (liveFleet[r.teamLeaderId] || 0) + 1;
                }
            });

            setLiveFleetByTLRaw(liveFleet);
            setDailyCollectionsRaw(dailyRes.data || []);
            setLiveTodayByTLRaw(liveTodayByTL);

            setTlTodayCollectionsByRider(liveTodayByRider);


        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        fetchStats();

        // ✅ ENHANCED: Debounced realtime — prevents rapid re-renders on bulk updates
        let realtimeDebounce: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            // Skip re-fetches while tab is hidden (saves CPU + network)
            if (document.hidden) return;
            if (realtimeDebounce) clearTimeout(realtimeDebounce);
            realtimeDebounce = setTimeout(() => fetchStats(), 4000);
        };

        const channel = supabase
            .channel('tl-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchDebounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchDebounced)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, fetchDebounced)
            .subscribe();

        // ✅ FIX: Re-fetch data when PWA comes back from background
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchStats();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (realtimeDebounce) clearTimeout(realtimeDebounce);
            supabase.removeChannel(channel);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [userData]);

    // Progressive rendering: stagger heavy sections so sidebar stays responsive
    useEffect(() => {
        if (loading) return;
        const t1 = setTimeout(() => setRenderPhase(1), 50);
        const t2 = setTimeout(() => setRenderPhase(2), 200);
        const t3 = setTimeout(() => setRenderPhase(3), 400);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [loading]);

    useEffect(() => {
        if (!loading && stats.totalRiders > 0) {
            import('@/services/AIService').then(({ AIService }) => {
                AIService.getDashboardInsights(stats, 'teamLeader').then(setAiInsight);
            });
        }
    }, [loading, stats]);

    // Zomato Pop-up Effect (Controlled via Centralized Admin Config)
    useEffect(() => {
        if (!loading && zomatoPopupConfig.isEnabled && zomatoPopupConfig.enableAutoPopup && eligibleZomatoAlertRiders.length > 0 && !hasShownZomatoAlert) {
            setShowZomatoAlert(true);
            setHasShownZomatoAlert(true);
        } else if (!loading && zomatoLBPopupConfig.isEnabled && zomatoLBPopupConfig.enableAutoPopup && eligibleZomatoLBAlertRiders.length > 0 && !hasShownZomatoLBAlert) {
            setShowZomatoLBAlert(true);
            setHasShownZomatoLBAlert(true);
        }
    }, [loading, eligibleZomatoAlertRiders.length, eligibleZomatoLBAlertRiders.length, hasShownZomatoAlert, hasShownZomatoLBAlert, zomatoPopupConfig, zomatoLBPopupConfig]);

    const [activeTab, setActiveTab] = useState<'overview' | 'watchlist' | 'analytics'>(() => {
        return (localStorage.getItem('tl_dashboard_v2_tab') as any) || 'overview';
    });

    const handleTabChange = (tab: 'overview' | 'watchlist' | 'analytics') => {
        setActiveTab(tab);
        localStorage.setItem('tl_dashboard_v2_tab', tab);
    };

    const handleNavigate = (path: string, state?: any) => {
        navigate(path, { state });
    };

    if (loading) {
        return (
            <div className="space-y-5 pb-10 animate-in fade-in duration-500">
                {/* Skeleton Header */}
                <div className="bg-card/60 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="hidden sm:block w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 animate-pulse" />
                        <div className="space-y-2 flex-1">
                            <div className="h-7 w-56 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 animate-pulse" />
                            <div className="h-3 w-36 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
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
                    <div className="lg:col-span-2 h-52 rounded-2xl bg-card/50 border border-border/40 animate-pulse" />
                    <div className="h-52 rounded-2xl bg-card/50 border border-border/40 animate-pulse" />
                </div>
                <p className="text-center text-muted-foreground text-xs font-medium animate-pulse">Fetching real-time fleet data...</p>
            </div>
        );
    }

    if (!userData) return null;
    const canViewDashboard = userData?.permissions?.dashboard?.view ?? true;
    if (!canViewDashboard) return <div className="p-10 text-center text-red-500 font-bold">Access Restricted</div>;

    // TEMPORARY: Removed useMemo to test if the hook is causing the error
    let chartData;
    try {
        // FORCE all values to be numbers to prevent React Error #310
        // This ensures potential objects/nulls are converted to 0 or primitives
        const s = {
            activeRiders: Number(stats?.activeRiders || 0),
            inactiveRiders: Number(stats?.inactiveRiders || 0),
            deletedRiders: Number(stats?.deletedRiders || 0),
            totalPositiveAmount: Number(stats?.totalPositiveAmount || 0),
            totalNegativeAmount: Number(stats?.totalNegativeAmount || 0),
            convertedLeads: Number(stats?.convertedLeads || 0),
            totalLeads: Number(stats?.totalLeads || 0),
            lowBalanceCount: Number(stats?.lowBalanceCount || 0)
        };

        chartData = {
            riders: [
                { name: 'Active', value: s.activeRiders, color: '#10b981' },
                { name: 'Inactive', value: s.inactiveRiders, color: '#f59e0b' },
                { name: 'Deleted', value: s.deletedRiders, color: '#f43f5e' }
            ],
            wallet: [
                { name: 'Collections', value: s.totalPositiveAmount },
                { name: 'Risk / Dues', value: s.totalNegativeAmount }
            ],
            leads: [
                { name: 'Converted', value: s.convertedLeads, color: '#84cc16' },
                { name: 'Pipeline', value: Math.max(0, s.totalLeads - s.convertedLeads), color: '#94a3b8' }
            ]
        };
    } catch (error) {
        console.error('Error generating chart data:', error);
        // safe fallback
        chartData = { riders: [], wallet: [], leads: [] };
    }



    return (
        <div className="space-y-5 pb-10">

            <ZomatoNegativeAlertModal
                isOpen={showZomatoAlert}
                onClose={() => setShowZomatoAlert(false)}
                negativeRiders={eligibleZomatoAlertRiders}
                config={zomatoPopupConfig}
            />

            <ZomatoLowBalanceAlertModal
                isOpen={showZomatoLBAlert}
                onClose={() => setShowZomatoLBAlert(false)}
                lowBalanceRiders={eligibleZomatoLBAlertRiders}
                config={zomatoLBPopupConfig}
            />

            {/* ─── HEADER ─── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none"
            >
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="hidden sm:flex p-3 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 rounded-2xl border border-violet-500/20">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 bg-violet-500 blur-xl opacity-40 rounded-full" />
                            <Sparkles className="relative text-violet-500" size={24} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm mb-1">
                            Welcome back, {safeRender(userData?.fullName, 'Leader').split(' ')[0]}! 👋
                        </h1>
                        <p className="text-muted-foreground text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            Live Workspace &mdash; {format(new Date(), 'EEEE, MMMM do, yyyy')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {userData?.permissions?.aiCalling?.enabled && (
                        <button
                            type="button"
                            onClick={() => {
                                const targetRider = leaderboardData.riders.find(r => r.teamLeaderId === userData.id && (r.walletAmount < 0 || r.walletAmount < 250));
                                setSelectedCallRider(targetRider || leaderboardData.riders[0] || null);
                                setShowElevenLabsModal(true);
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-violet-500/20 hover:opacity-95 transition-all"
                        >
                            <Bot size={15} className="animate-pulse" />
                            AI Voice Call
                        </button>
                    )}
                    {/* WhatsApp 1-Click Share Riders */}
                    <button
                        type="button"
                        title="Share My Riders List via WhatsApp"
                        onClick={() => {
                            const myRiders = leaderboardData.riders.filter(r => r.teamLeaderId === userData.id && r.status === 'active');
                            if (myRiders.length === 0) { alert('No active riders to share.'); return; }
                            const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                            const lines = myRiders.map((r, i) => `${i + 1}. ${r.riderName} — 📱 ${r.mobileNumber || 'N/A'} | 💰 ₹${r.walletAmount ?? 0}`).join('\n');
                            const msg = encodeURIComponent(`🚀 *Rider Report — ${today}*\nTL: *${userData.fullName}*\nActive Riders: *${myRiders.length}*\n\n${lines}\n\n_Sent from Triev Fleet V2_`);
                            window.open(`https://wa.me/?text=${msg}`, '_blank');
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-green-500/20 hover:opacity-95 transition-all"
                    >
                        <MessageCircle size={15} />
                        <span className="hidden sm:inline">Share Riders</span>
                    </button>
                    <div className="px-4 py-2 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-400/20 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-inner">
                        <Shield size={14} className="text-violet-500" />
                        <span className="text-violet-600 dark:text-violet-400 uppercase tracking-widest">Team Leader</span>
                    </div>
                </div>
            </motion.div>

            {/* ─── Achievement Badges ─── */}
            {earnedBadges.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl"
                >
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 flex-shrink-0">Badges</span>
                    <BadgeGallery badges={earnedBadges} compact maxDisplay={6} />
                </motion.div>
            )}

            {/* Live Alert Center */}
            <LiveAlertCenter teamLeaderId={userData.id} portalBase="/team-leader" />

            {/* V2 Dashboard Tab Navigation */}
            <div className="flex items-center gap-1.5 p-1.5 bg-card/60 backdrop-blur-md rounded-2xl border border-border/50 overflow-x-auto hide-scrollbar my-4 shadow-sm">
                {[
                    { id: 'overview', label: 'Daily Tasks & Recovery', icon: Activity, badge: stats.negativeWallet > 0 ? `${stats.negativeWallet} Debt` : undefined },
                    { id: 'watchlist', label: 'Fleet & Wallet Watchlist', icon: Wallet, badge: `${stats.activeRiders} Active` },
                    { id: 'analytics', label: 'Performance & Leaderboard', icon: Trophy, badge: `${computedLeaderStats?.score ?? 0}% AI` }
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id as any)}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-300 whitespace-nowrap select-none
                                ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }
                            `}
                        >
                            <Icon size={15} />
                            <span>{tab.label}</span>
                            {tab.badge && (
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: DAILY TASKS & RECOVERY */}
            {activeTab === 'overview' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                    <QuickInsightStrip
                        insights={[
                            { label: 'Fleet', value: stats.activeRiders, suffix: ' active' },
                            { label: 'Collected', value: `₹${(computedPeriodData.collections[userData.id] || 0).toLocaleString('en-IN')}` },
                            { label: 'Leads', value: stats.totalLeads },
                            { label: 'Debt', value: stats.negativeWallet, suffix: ' riders' },
                            { label: 'AI Score', value: `${computedLeaderStats?.score ?? 0}%` },
                        ]}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <TodaysCollectionCard teamLeaderId={userData.id} />
                        {userData.monthlyTarget && userData.monthlyTarget > 0 ? (
                            <ComponentErrorBoundary name="Collection Target">
                                <CollectionTargetCard
                                    collected={computedPeriodData.collections[userData.id] || 0}
                                    target={userData.monthlyTarget}
                                    daysElapsed={new Date().getDate()}
                                    totalDays={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
                                />
                            </ComponentErrorBoundary>
                        ) : (
                            <ComponentErrorBoundary name="Defaulter Alerts">
                                <DefaulterAlertCard
                                    riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                                    onViewRider={(rider) => handleNavigate(`/team-leader/riders?filter=all&search=${encodeURIComponent(rider.mobileNumber || rider.trievId)}`, { highlight: rider.mobileNumber })}
                                    onSendReminder={(rider) => {
                                        const msg = `Hi ${rider.riderName}, your Triev wallet balance is ₹${rider.walletAmount.toLocaleString('en-IN')}. Please recharge at the earliest to avoid service disruption.`;
                                        window.open(`https://wa.me/${rider.mobileNumber}?text=${encodeURIComponent(msg)}`, '_blank');
                                    }}
                                />
                            </ComponentErrorBoundary>
                        )}
                    </div>

                    <ComponentErrorBoundary name="Debt Recovery Tasks">
                        <DebtRecoveryTasks
                            riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                            todayCollections={tlTodayCollectionsByRider}
                        />
                    </ComponentErrorBoundary>
                </div>
            )}

            {/* TAB 2: FLEET & WALLET WATCHLIST */}
            {activeTab === 'watchlist' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                    {/* Fleet & Operations */}
                    <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-2.5 sm:gap-3 px-1 mt-2">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500 blur-md opacity-40 rounded-full" />
                                <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30 border border-white/20">
                                    <UserCheck size={12} className="text-white sm:w-4 sm:h-4" />
                                </div>
                            </div>
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent dark:from-emerald-400 dark:to-emerald-200">Fleet & Operations</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/40 via-emerald-500/10 to-transparent" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-jakarta">
                            {(userData.permissions?.dashboard?.statsCards?.activeRiders ?? true) && (
                                <SmartMetricCard
                                    title="Fleet Strength"
                                    value={String(stats.activeRiders)}
                                    icon={UserCheck}
                                    color="emerald"
                                    trend={{ value: stats.totalRiders > 0 ? Math.round((stats.activeRiders / stats.totalRiders) * 100) : 0, label: 'health', direction: 'up' }}
                                    subtitle={`${stats.totalRiders} Total Assigned`}
                                    className="!bg-gradient-to-br !from-slate-950 !via-slate-900 !to-slate-950 dark:!from-slate-950 dark:!via-slate-900 dark:!to-slate-950 !border-slate-700/40 !text-white ring-1 !ring-emerald-500/20 shadow-xl shadow-slate-950/40 [&_p]:!text-slate-300 [&_span]:!text-slate-200"
                                    progress={stats.totalRiders > 0 ? (stats.activeRiders / stats.totalRiders) * 100 : 0}
                                    onClick={() => handleNavigate('/team-leader/riders', { filter: 'active' })}
                                    isCurrency={false}
                                />
                            )}
                            <SmartMetricCard
                                title="Churn Rider Monitor"
                                value={String(stats.inactiveRiders + stats.deletedRiders)}
                                icon={UserX}
                                color="slate"
                                trend={{ value: Math.round(((stats.inactiveRiders + stats.deletedRiders) / stats.totalRiders) * 100) || 0, label: 'churn rate', direction: 'down' }}
                                subtitle={`${stats.inactiveRiders} Inactive | ${stats.deletedRiders} Deleted`}
                                progress={stats.totalRiders > 0 ? ((stats.inactiveRiders + stats.deletedRiders) / stats.totalRiders) * 100 : 0}
                                onClick={() => handleNavigate('/team-leader/riders', { filter: 'inactive' })}
                                isCurrency={false}
                            />
                            {(userData.permissions?.dashboard?.statsCards?.totalLeads ?? true) && (
                                <SmartMetricCard
                                    title="Lead Pipeline"
                                    value={`${stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}% `}
                                    icon={Sparkles}
                                    color="fuchsia"
                                    trend={{ value: stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0, label: 'conversion', direction: 'up' }}
                                    subtitle={`${stats.convertedLeads} Successful Converts`}
                                    progress={stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}
                                    onClick={() => handleNavigate('/team-leader/leads?status=New')}
                                    isCurrency={false}
                                />
                            )}
                            {(userData.permissions?.dashboard?.statsCards?.revenue ?? true) && (
                                <SmartMetricCard
                                    title="Positive Wallet Balance"
                                    value={stats.totalPositiveAmount}
                                    icon={Wallet}
                                    color="indigo"
                                    trend={{ value: stats.totalRiders > 0 ? Math.round((stats.positiveWallet / stats.totalRiders) * 100) : 0, label: 'of fleet', direction: 'up' }}
                                    subtitle={`${stats.positiveWallet} Riders in Positive`}
                                    progress={stats.totalRiders > 0 ? (stats.positiveWallet / stats.totalRiders) * 100 : 0}
                                    onClick={() => handleNavigate('/team-leader/reports', { template: 'wallet_summary' })}
                                />
                            )}
                        </div>
                    </div>

                    <TLZomatoVIPSection stats={stats} onNavigate={handleNavigate} />

                    {/* Wallet Risk Bifurcation */}
                    <div className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-rose-500/10 rounded-lg"><Activity size={14} className="text-rose-500" /></div>
                                <h3 className="font-black text-sm text-foreground/90">Negative Wallet Bifurcation</h3>
                            </div>
                            <span className="text-[9px] font-black px-2 py-1 bg-muted rounded-full text-muted-foreground uppercase tracking-widest">Active Riders</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                            <div onClick={() => walletBifurcation.b100 > 0 && setSelectedBracket('b100')} className={`bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center ${walletBifurcation.b100 > 0 ? 'cursor-pointer hover:ring-2 hover:ring-slate-400 transition-all shadow-sm' : 'opacity-80'}`}>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">₹-1 to ₹-100</span>
                                <span className="text-xl font-black text-slate-700 dark:text-slate-300">{walletBifurcation.b100}</span>
                            </div>
                            <div onClick={() => walletBifurcation.b200 > 0 && setSelectedBracket('b200')} className={`bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-200 dark:border-orange-900/30 flex flex-col items-center justify-center text-center ${walletBifurcation.b200 > 0 ? 'cursor-pointer hover:ring-2 hover:ring-orange-400 transition-all shadow-sm' : 'opacity-80'}`}>
                                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">₹-101 to ₹-200</span>
                                <span className="text-xl font-black text-orange-600 dark:text-orange-400">{walletBifurcation.b200}</span>
                            </div>
                            <div onClick={() => walletBifurcation.b500 > 0 && setSelectedBracket('b500')} className={`bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-200 dark:border-rose-900/30 flex flex-col items-center justify-center text-center ${walletBifurcation.b500 > 0 ? 'cursor-pointer hover:ring-2 hover:ring-rose-400 transition-all shadow-sm' : 'opacity-80'}`}>
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">₹-201 to ₹-500</span>
                                <span className="text-xl font-black text-rose-600 dark:text-rose-400">{walletBifurcation.b500}</span>
                            </div>
                            <div onClick={() => walletBifurcation.b1000 > 0 && setSelectedBracket('b1000')} className={`bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-900/30 flex flex-col items-center justify-center text-center relative overflow-hidden ${walletBifurcation.b1000 > 0 ? 'cursor-pointer hover:ring-2 hover:ring-red-500 transition-all shadow-sm' : 'opacity-80'}`}>
                                <div className="absolute top-0 right-0 w-8 h-8 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">₹-501 to ₹-1000</span>
                                <span className="text-xl font-black text-red-600 dark:text-red-400 relative z-10">{walletBifurcation.b1000}</span>
                            </div>
                            <div onClick={() => walletBifurcation.bMax > 0 && setSelectedBracket('bMax')} className={`bg-rose-100 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-300 dark:border-rose-900/50 flex flex-col items-center justify-center text-center relative overflow-hidden lg:col-span-1 col-span-2 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] ${walletBifurcation.bMax > 0 ? 'cursor-pointer hover:ring-2 hover:ring-rose-500 transition-all' : 'opacity-80'}`}>
                                <div className="absolute -top-4 -right-4 w-12 h-12 bg-rose-500/20 rounded-full blur-md" />
                                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1"><AlertTriangle size={10} /> &lt; ₹-1000</span>
                                <span className="text-2xl font-black text-rose-700 dark:text-rose-300 relative z-10 drop-shadow-sm">{walletBifurcation.bMax}</span>
                            </div>
                        </div>
                    </div>

                    <WalletWatchlist riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)} />
                </div>
            )}

            {/* TAB 3: PERFORMANCE & LEADERBOARD */}
            {activeTab === 'analytics' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                    <ComponentErrorBoundary name="Fleet AI Health">
                        <FleetAIHealthWidget
                            riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                            title="My Fleet AI Health"
                        />
                    </ComponentErrorBoundary>
            {/* --- Debt Recovery Tasks --- */}
            {renderPhase >= 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2.5 sm:gap-3 px-1 mt-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-rose-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-500/30 border border-white/20">
                            <AlertTriangle size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-rose-600 to-rose-400 bg-clip-text text-transparent dark:from-rose-400 dark:to-rose-200">Debt Recovery Tasks</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-rose-500/40 via-rose-500/10 to-transparent" />
                </div>
                <ComponentErrorBoundary name="Debt Recovery Tasks">
                    <DebtRecoveryTasks
                        riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                        todayCollections={tlTodayCollectionsByRider}
                    />
                </ComponentErrorBoundary>

                {/* ─── Defaulter Alerts ─── */}
                <div className="mt-3">
                    <ComponentErrorBoundary name="Defaulter Alerts">
                        <DefaulterAlertCard
                            riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                            onViewRider={(rider) => handleNavigate(`/team-leader/riders?filter=all&search=${encodeURIComponent(rider.mobileNumber || rider.trievId)}`, { highlight: rider.mobileNumber })}
                            onSendReminder={(rider) => {
                                const msg = `Hi ${rider.riderName}, your Triev wallet balance is ₹${rider.walletAmount.toLocaleString('en-IN')}. Please recharge at the earliest to avoid service disruption.`;
                                window.open(`https://wa.me/${rider.mobileNumber}?text=${encodeURIComponent(msg)}`, '_blank');
                            }}
                        />
                    </ComponentErrorBoundary>
                </div>
            </motion.div>
            )}

            {/* --- Analytics & AI Coach --- */}
            {renderPhase >= 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2.5 sm:gap-3 px-1 mt-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-violet-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30 border border-white/20">
                            <Sparkles size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent dark:from-violet-400 dark:to-violet-200">Analytics & AI Coach</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-violet-500/40 via-violet-500/10 to-transparent" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Charts (2/3 width) */}
                    <div className="lg:col-span-2">
                        {(userData.permissions?.dashboard?.charts?.onboarding ?? true) ? (
                            <ComponentErrorBoundary name="Dashboard Charts">
                                <DashboardCharts
                                    riderData={chartData.riders}
                                    walletData={chartData.wallet}
                                    leadData={chartData.leads}
                                />
                            </ComponentErrorBoundary>
                        ) : (
                            <div className="h-full bg-card/40 border border-dashed rounded-xl flex items-center justify-center text-muted-foreground p-8 min-h-[250px]">
                                Charts access restricted
                            </div>
                        )}
                    </div>

                    {/* AI Panel (1/3 width) */}
                    <div className="space-y-3">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden border border-white/5"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-2 bg-indigo-500/30 rounded-lg backdrop-blur-xl border border-white/10">
                                        <Zap className="text-indigo-300 fill-indigo-300" size={14} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black tracking-tight">AI Team Coach</h3>
                                        <p className="text-[9px] uppercase font-black tracking-widest text-indigo-300/80">Performance Engine</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {aiInsight ? (
                                        <div className="p-3 rounded-xl bg-white/10 border border-white/20">
                                            <div className="flex items-center gap-1.5 mb-1.5 text-indigo-200 text-[9px] font-bold uppercase tracking-wider">
                                                <Sparkles size={9} className="text-yellow-400 animate-pulse" />
                                                Live Insight
                                            </div>
                                            <p className="text-xs font-medium leading-relaxed text-white">"{safeRender(aiInsight)}"</p>
                                            <button
                                                onClick={() => handleNavigate('/team-leader/riders')}
                                                className="mt-2 text-[9px] font-black uppercase tracking-widest bg-white text-indigo-900 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                            <p className="text-[10px] font-bold leading-relaxed text-indigo-100">
                                                "{stats.negativeWallet > 0 ? `${stats.negativeWallet} riders have negative wallets. Total outstanding: ₹${Math.abs(stats.totalNegativeAmount).toLocaleString('en-IN')}. Focus on recovery.` : `All ${stats.activeRiders} active riders are in good standing! Keep up the great work.`}"
                                            </p>
                                            <button onClick={() => handleNavigate('/team-leader/riders')} className="mt-2 text-[9px] font-black uppercase tracking-widest bg-indigo-500 px-2 py-1 rounded hover:bg-indigo-400 transition-colors">Action Now</button>
                                        </div>
                                    )}
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                        <p className="text-[10px] font-bold leading-relaxed text-emerald-100">
                                            "Your lead conversion speed is 15% higher than the fleet average this week. Keep it up!"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <div className="bg-card/50 backdrop-blur-sm border rounded-2xl p-4 shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={13} className="text-primary" />
                                <h3 className="font-black tracking-tight text-xs">Recent Performance</h3>
                            </div>
                            <div className="space-y-2.5">
                                {[
                                    { label: 'Fleet Utilization', value: `${stats.totalRiders > 0 ? Math.round((stats.activeRiders / stats.totalRiders) * 100) : 0}%`, color: 'bg-emerald-500', pct: stats.totalRiders > 0 ? Math.round((stats.activeRiders / stats.totalRiders) * 100) : 0 },
                                    { label: 'Lead Conversion', value: `${stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}%`, color: 'bg-indigo-500', pct: stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0 },
                                    { label: 'Wallet Health', value: `${stats.activeRiders > 0 ? Math.round((stats.positiveWallet / stats.activeRiders) * 100) : 0}%`, color: 'bg-violet-500', pct: stats.activeRiders > 0 ? Math.round((stats.positiveWallet / stats.activeRiders) * 100) : 0 },
                                ].map(item => (
                                    <div key={item.label}>
                                        <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                                            <span className="text-muted-foreground">{item.label}</span>
                                            <span className={item.color.replace('bg-', 'text-')}>{item.value}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div className={`${item.color} h-1.5 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${item.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
            )}

            {/* --- Quick Actions --- */}
            {renderPhase >= 3 && (<>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2.5 sm:gap-3 px-1 mt-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500 blur-md opacity-40 rounded-full" />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/30 border border-white/20">
                            <Zap size={12} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-cyan-600 to-cyan-400 bg-clip-text text-transparent dark:from-cyan-400 dark:to-cyan-200">Quick Actions</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/40 via-cyan-500/10 to-transparent" />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {[
                        { id: 'addRider', label: 'Add Rider', icon: Users, path: '/team-leader/riders?action=new', color: 'text-blue-500', bg: 'bg-blue-500/10', permission: userData.permissions?.riders?.create },
                        { id: 'newLead', label: 'New Lead', icon: Zap, path: '/team-leader/leads', color: 'text-yellow-500', bg: 'bg-yellow-500/10', permission: userData.permissions?.leads?.create },
                        { id: 'reports', label: 'Reports', icon: FileText, path: '/team-leader/reports', color: 'text-purple-500', bg: 'bg-purple-500/10', permission: userData.permissions?.modules?.reports },
                        { id: 'collections', label: 'Collections', icon: Wallet, path: '/team-leader/collections', color: 'text-emerald-500', bg: 'bg-emerald-500/10', permission: true },
                        { id: 'performance', label: 'Performance', icon: TrendingUp, path: '/team-leader/performance', color: 'text-indigo-500', bg: 'bg-indigo-500/10', permission: true },
                        { id: 'activity', label: 'My Activity', icon: Activity, path: '/team-leader/activity-log', color: 'text-orange-500', bg: 'bg-orange-500/10', permission: userData.permissions?.modules?.activityLog },
                    ].filter(action => action.permission ?? true).map((action, idx) => (
                        <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * idx }}
                            whileHover={{ scale: 1.06, y: -2 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleNavigate(action.path)}
                            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-card/70 border border-border/60 hover:border-primary/40 shadow-sm hover:shadow-lg hover:shadow-primary/10 transition-all group gap-2 backdrop-blur-sm"
                        >
                            <div className={`p-2.5 rounded-xl ${action.bg} ${action.color} group-hover:scale-110 transition-transform duration-200 ring-1 ring-current/20`}>
                                <action.icon size={14} />
                            </div>
                            <span className="font-black text-[9px] text-foreground leading-tight text-center uppercase tracking-wide">{action.label}</span>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            {/* ─── Activity Streak + Announcements + Notifications ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <ComponentErrorBoundary name="Activity Streak">
                    <ActivityStreak
                        riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                        todayCollections={tlTodayCollectionsByRider}
                    />
                </ComponentErrorBoundary>
                <ComponentErrorBoundary name="Notifications">
                    <NotificationCenter
                        riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData.id)}
                        totalCollection={computedPeriodData.collections[userData.id] || 0}
                        monthlyTarget={userData.monthlyTarget || 0}
                    />
                </ComponentErrorBoundary>
                <ComponentErrorBoundary name="Announcements">
                    <AnnouncementsWidget />
                </ComponentErrorBoundary>
            </div>

            {/* ─── Collection Heatmap + Lead Funnel ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ComponentErrorBoundary name="Collection Heatmap">
                    <CollectionHeatmap collections={tlCollectionHistory} weeks={6} />
                </ComponentErrorBoundary>
                <ComponentErrorBoundary name="Lead Funnel">
                    <LeadConversionFunnel leads={leaderboardData.leads.filter(l => l.createdBy === userData.id)} />
                </ComponentErrorBoundary>
            </div>

            {/* --- Fleet Champions Leaderboard --- */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative rounded-2xl sm:rounded-3xl p-[3px] bg-gradient-to-br from-primary/20 via-violet-500/20 to-indigo-500/20 shadow-2xl overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <div className="bg-card/80 dark:bg-slate-950/70 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/10">
                    {/* Leaderboard Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <motion.div
                                whileHover={{ rotate: [0, -8, 8, 0] }}
                                className="p-2.5 bg-gradient-to-br from-primary/20 to-violet-500/20 rounded-xl border border-primary/30"
                            >
                                <Star size={22} className="text-primary fill-primary/30 animate-pulse" />
                            </motion.div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-br from-slate-900 via-slate-600 to-slate-400 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                                    Fleet Champions
                                </h2>
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Live Performance Network</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/90 border border-white/20 rounded-full shadow-xl">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                            </span>
                            <span className="text-[9px] font-black tracking-widest text-white uppercase">Neural Realtime Sync</span>
                        </div>

                        {/* Period Selector */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-1 shadow-inner self-center sm:self-auto">
                            {(['day', 'week', 'month', 'all'] as DateFilterType[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setDateFilter(f)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${dateFilter === f
                                        ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                                        }`}
                                >
                                    {f === 'all' ? 'All Time' : f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="relative z-10">
                        {(userData.permissions?.dashboard?.statsCards?.leaderboard ?? true) ? (
                            <ComponentErrorBoundary name="Leaderboard">
                                <Leaderboard
                                    teamLeaders={leaderboardData.teamLeaders}
                                    riders={leaderboardData.riders}
                                    leads={leaderboardData.leads}
                                    collections={computedPeriodData.collections}
                                    historicalFleetCounts={computedPeriodData.historicalFleet}
                                    disableClick={true}
                                    period={resolvePerformancePeriod(dateFilter)}
                                    currentUserId={userData.id}
                                />
                            </ComponentErrorBoundary>
                        ) : (
                            <div className="p-16 text-center text-muted-foreground border-4 border-dashed rounded-2xl bg-slate-500/5">
                                <Shield className="mx-auto mb-4 opacity-10" size={48} />
                                <p className="font-black uppercase tracking-widest text-sm italic">Leaderboard Intelligence Restricted</p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Bracket Filter Focus Modal */}
            <AnimatePresence>
                {selectedBracket && (
                    <div className="fixed inset-[0px] z-[99999] flex items-center justify-center p-4 sm:p-6" style={{ pointerEvents: 'auto' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-[0px] bg-background/80 backdrop-blur-sm"
                            onClick={() => setSelectedBracket(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
                        >
                            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-500/10 rounded-lg">
                                        <AlertTriangle size={18} className="text-rose-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base md:text-lg text-foreground leading-tight">
                                            Wallet Defaulters
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Bracket: {selectedBracket === 'b100' ? '-1 to -100' : selectedBracket === 'b200' ? '-101 to -200' : selectedBracket === 'b500' ? '-201 to -500' : selectedBracket === 'b1000' ? '-501 to -1000' : '< -1000'} &nbsp; • &nbsp; {bracketRiders.length} Riders
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedBracket(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                    <X size={20} className="text-muted-foreground" />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/20">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {bracketRiders.map((rider) => (
                                        <div key={rider.id} className="bg-background border border-border rounded-xl p-3 flex flex-col justify-between hover:shadow-md hover:border-primary/30 transition-all group">
                                            <div className="overflow-hidden flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-bold text-sm text-foreground truncate">{rider.riderName}</h4>
                                                    <div className="flex flex-col mt-0.5">
                                                        <span className="text-[10px] text-muted-foreground font-mono">{rider.trievId}</span>
                                                        <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">{rider.mobileNumber}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 ml-2 shrink-0">
                                                    <span className="inline-block px-2.5 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg font-black text-[13px] self-end">
                                                        ₹{rider.walletAmount.toLocaleString('en-IN')}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleCall(rider.mobileNumber); }} 
                                                            className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" 
                                                            title="Call"
                                                        >
                                                            <Phone size={13} />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setSelectedReminderRider(rider); 
                                                                setReminderType(rider.walletAmount <= -1000 ? 'critical' : 'warning'); 
                                                            }} 
                                                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-1" 
                                                            title="AI WhatsApp message"
                                                        >
                                                            <MessageCircle size={13} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline-block">AI Message</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* renderPhase >= 3 closing bracket */}
            </>)}
            </div>
            )}

            {selectedReminderRider && (
                <AIReminderModal
                    rider={selectedReminderRider}
                    type={reminderType}
                    isOpen={!!selectedReminderRider}
                    onClose={() => setSelectedReminderRider(null)}
                />
            )}

            {/* ElevenLabs Outbound AI Voice Call Modal */}
            <ElevenLabsCallModal
                isOpen={showElevenLabsModal}
                onClose={() => { setShowElevenLabsModal(false); setSelectedCallRider(null); }}
                rider={selectedCallRider}
                currentUserName={userData?.fullName || userData?.email}
            />

            {/* Bulk Collection Entry Modal */}
            <BulkCollectionModal
                isOpen={showBulkCollectionModal}
                onClose={() => setShowBulkCollectionModal(false)}
                riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData?.id)}
                currentUserId={userData?.id}
                currentUserEmail={userData?.email}
                onSuccess={fetchStats}
            />

            {/* Field Check-In Modal */}
            <FieldCheckInModal
                isOpen={showFieldCheckInModal}
                onClose={() => { setShowFieldCheckInModal(false); setSelectedCheckInRider(null); }}
                rider={selectedCheckInRider}
                currentUserId={userData?.id}
                currentUserEmail={userData?.email}
            />

            {/* Global Floating AI Copilot */}
            <AIVirtualOpsCopilot
                roleName={safeRender(userData?.fullName, 'Team Leader')}
                riders={leaderboardData.riders.filter(r => r.teamLeaderId === userData?.id)}
                leads={leaderboardData.leads.filter(l => l.createdBy === userData?.id)}
            />
        </div>
    );
};

export default Dashboard;
