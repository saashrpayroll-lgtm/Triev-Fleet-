import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import {
    Download,
    Search,
    TrendingUp,
    Users,
    Activity,
    ArrowUpRight,
    Filter,
    Wallet,
    SearchX,
    Calendar,
    ChevronDown,
    UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateAIScore, PerformancePeriod } from '@/utils/performance';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import { getValidHistoricalDate } from '@/utils/dateUtils';
import { useDebounce } from '@/hooks/useDebounce';

const TLPerformance: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<{
        riders: any[];
        leads: any[];
        teamLeaders: any[];
        collections: any[];
        dailyCollectionsMap?: Record<string, number>;
        weeklyCollectionsMap?: Record<string, number>;
    }>({ riders: [], leads: [], teamLeaders: [], collections: [] });

    // const [tlCollections, setTlCollections] = useState<Record<string, number>>({});
    // const [dailyCollections, setDailyCollections] = useState<Record<string, number>>({});
    // const [weeklyCollections, setWeeklyCollections] = useState<Record<string, number>>({});

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [riskFilter, setRiskFilter] = useState<'all' | 'high_risk' | 'low_risk'>('all');
    const [perfFilter, setPerfFilter] = useState<'all' | 'top_performers' | 'low_conversion'>('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);

    // New Date Filter States
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('today'); // Default to today
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

    // Reporting Manager Filter
    const [rmFilter, setRmFilter] = useState<string>('all');

    // Sorting & Multi-TL Filter States
    const [selectedTLs, setSelectedTLs] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'totalCollection', direction: 'desc' });

    const fetchData = async () => {
        try {
            // ── IST date/week helpers ─────────────────────────────────────────────
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const now = new Date();
            const todayStr = formatter.format(now);
            const [year2, month2, day2] = todayStr.split('-').map(Number);
            const workingDateUTC2 = new Date(Date.UTC(year2, month2 - 1, day2));
            const weekDay2 = workingDateUTC2.getUTCDay();
            const diff2 = workingDateUTC2.getUTCDate() - weekDay2 + (weekDay2 === 0 ? -6 : 1);
            const weekStartUTC2 = new Date(workingDateUTC2);
            weekStartUTC2.setUTCDate(diff2);
            const weekStartStr = weekStartUTC2.toISOString().split('T')[0];
            // IST midnight/end of day in UTC bounds — fallback for rows where transaction_date is NULL
            const midnightIST = new Date(Date.UTC(year2, month2 - 1, day2, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
            const endOfDayIST = new Date(Date.UTC(year2, month2 - 1, day2, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000).toISOString();

            const [ridersRes, leadsRes, usersRes, dailyRes, todayLedgerRes] = await Promise.all([
                fetchAllRidersPaginated('*'),
                supabase.from('leads').select('*'),
                supabase.from('users').select('*').eq('role', 'teamLeader'),
                supabase.from('daily_collections').select('*')
                    .order('date', { ascending: false })
                    .limit(10000),
                // Today's live: wallet_ledger entries for TODAY by IST transaction_date
                // ✅ FIX: Use transaction_date (DATE column, IST-pinned) instead of created_at >= midnight
                // This correctly includes AM-timestamped imports (e.g., 3:55 AM) regardless of when imported
                supabase.from('wallet_ledger').select(`amount, rider: riders!inner(team_leader_id)`)
                    .eq('mode', 'ADD')
                    .in('transaction_type', [
                        'DAILY_COLLECTION', 'DAILY COLLECTION',
                        'RENT_COLLECTION', 'RENT COLLECTION',
                        'FTD_COLLECTION', 'FTD COLLECTION',
                        'COLLECTION', 'RENT'
                    ])
                    // ✅ ROBUST: catch rows with transaction_date set (imports) OR NULL (legacy manual)
                    .or(`and(transaction_date.gte.${midnightIST}, transaction_date.lte.${endOfDayIST}), and(transaction_date.is.null, created_at.gte.${midnightIST})`)
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (leadsRes.error) throw leadsRes.error;
            if (usersRes.error) throw usersRes.error;
            if (dailyRes.error) throw dailyRes.error;
            if (todayLedgerRes.error) throw todayLedgerRes.error;

            // ── AUTHORITATIVE DATE-BASED COLLECTION MAP ─────────────────────────────
            // daily_collections.date is the SINGLE SOURCE OF TRUTH for all period calcs.
            // wallet_ledger.created_at is ONLY used for today's live running total.
            // Changing created_at in wallet_ledger does NOT affect weekly/total figures.

            const totals: Record<string, number> = {};   // all-time from daily_collections
            const weekly: Record<string, number> = {};   // week from daily_collections.date

            dailyRes.data?.forEach(item => {
                const tlId = item.team_leader_id;
                const amt = Number(item.total_collection) || 0;
                // Normalize date (strip time suffix if any)
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;

                totals[tlId] = (totals[tlId] || 0) + amt;

                // ✅ Weekly: use daily_collections.date >= weekStart (date string comparison)
                if (dDateStr >= weekStartStr) {
                    weekly[tlId] = (weekly[tlId] || 0) + amt;
                }
            });

            // ── TODAY'S LIVE MAP: wallet_ledger for entries since IST midnight ───────
            // Used ONLY for the "Today" filter. Entries here may not yet be snapshotted
            // into daily_collections. If they already are, they are already in daily_collections
            // for today's date, so we need to de-duplicate against daily_collections.
            //
            // De-dup strategy: if daily_collections already has a record for today for this TL,
            // that IS the authoritative total (from a bulk snap). Use it directly.
            // If not, use the live ledger sum.
            const daily: Record<string, number> = {};

            // Collect which TLs already have a daily_collections snapshot for today
            const tlsWithTodaySnapshot = new Set<string>();
            dailyRes.data?.forEach(item => {
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                if (dDateStr === todayStr) {
                    tlsWithTodaySnapshot.add(item.team_leader_id);
                    daily[item.team_leader_id] = (daily[item.team_leader_id] || 0) + (Number(item.total_collection) || 0);
                }
            });

            // For TLs that do NOT yet have a today snapshot, use live ledger
            const todayLedger = (todayLedgerRes?.data as any[]) || [];
            todayLedger.forEach(txn => {
                if (txn.rider?.team_leader_id) {
                    const tlId = txn.rider.team_leader_id;
                    if (!tlsWithTodaySnapshot.has(tlId)) {
                        // No snapshot yet — use live ledger
                        daily[tlId] = (daily[tlId] || 0) + (Number(txn.amount) || 0);
                    }
                    // If snapshot exists, daily already set above — don't double-count
                }
            });

            // ── Also add today's live into weekly (from daily_collections or live ledger) ─
            // Since weekly above excludes today if no snapshot yet, we add today's total:
            Object.keys(daily).forEach(tlId => {
                if (!tlsWithTodaySnapshot.has(tlId)) {
                    // Only add live amount for TLs without today's snapshot
                    // (snapshot-based TLs already included via daily_collections.date >= weekStart)
                    weekly[tlId] = (weekly[tlId] || 0) + (daily[tlId] || 0);
                }
            });


            setRawData({
                riders: (ridersRes.data || []).map((r: any) => ({
                    ...r,
                    // Robust mapping for internal usage if needed, 
                    // though calculateAIScore now does this itself.
                    walletAmount: Number(r.wallet_amount ?? r.walletAmount ?? 0),
                    teamLeaderId: r.team_leader_id ?? r.teamLeaderId,
                    allotmentDate: r.allotment_date ?? r.allotmentDate,
                    status: String(r.status || '').toLowerCase()
                })),
                leads: leadsRes.data || [],
                teamLeaders: (usersRes.data || []).map((u: any) => ({
                    ...u,
                    fullName: u.full_name ?? u.fullName,
                    id: u.id
                })),
                collections: dailyRes.data || [],
                dailyCollectionsMap: daily,
                weeklyCollectionsMap: weekly
            });
        } catch (error: any) {
            toast.error('Failed to load performance data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Debounce: avoid hammering fetchData on rapid ledger inserts
        let ledgerDebounce: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            if (ledgerDebounce) clearTimeout(ledgerDebounce);
            ledgerDebounce = setTimeout(() => fetchData(), 1000);
        };

        const channels = [
            supabase.channel('tl-perf-riders').on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchDebounced).subscribe(),
            supabase.channel('tl-perf-leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchDebounced).subscribe(),
            supabase.channel('tl-perf-collections').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchDebounced).subscribe(),
            supabase.channel('tl-perf-users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchDebounced).subscribe(),
            // ✅ FIX: wallet_ledger realtime — keeps today/weekly maps live
            supabase.channel('tl-perf-ledger').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, fetchDebounced).subscribe(),
        ];

        // ── Auto-reset at IST midnight every day ──────────────────────────────
        const scheduleISTMidnightReset = () => {
            const now = new Date();
            const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
            const [y, m, d] = istDateStr.split('-').map(Number);
            const nextMidnightUTC = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
            const msUntilMidnight = nextMidnightUTC.getTime() - now.getTime();
            return window.setTimeout(() => {
                fetchData();
                scheduleISTMidnightReset();
            }, msUntilMidnight + 500);
        };
        const midnightTimer = scheduleISTMidnightReset();

        // ── Auto-reset at IST Sunday midnight (weekly reset) ─────────────────
        // Fires at 00:00 IST every Monday so weekly collection clears for new week.
        const scheduleWeeklyReset = () => {
            const now = new Date();
            const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
            const [y, m, d] = istDateStr.split('-').map(Number);
            const istDate = new Date(Date.UTC(y, m - 1, d));
            const dayOfWeek = istDate.getUTCDay(); // 0=Sun
            const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // days until next Monday
            const nextMondayUTC = new Date(Date.UTC(y, m - 1, d + daysUntilMonday, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
            const msUntilMonday = nextMondayUTC.getTime() - now.getTime();
            return window.setTimeout(() => {
                fetchData(); // Re-fetch — weekly map will now start from new Monday 00:00 IST
                scheduleWeeklyReset(); // Re-schedule for following week
            }, msUntilMonday + 500);
        };
        const weeklyTimer = scheduleWeeklyReset();

        // ── PWA/Background: Auto-refresh on visibility restore ───────────────
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchData();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // ── Fallback: Poll every 2 minutes for stale-data protection ─────────
        const pollInterval = setInterval(() => fetchData(), 2 * 60 * 1000);

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
            window.clearTimeout(midnightTimer);
            window.clearTimeout(weeklyTimer);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(pollInterval);
        };
    }, []);

    const performanceData = useMemo(() => {
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const now = new Date();
        const nowISTStr = formatter.format(now);
        const [year, month, day] = nowISTStr.split('-').map(Number);

        // Use UTC Date object as a safe container for IST date math
        const workingDateUTC = new Date(Date.UTC(year, month - 1, day));

        // Determine Start and End dates for the selected filter
        let startDateStr = nowISTStr;
        let endDateStr = nowISTStr;

        if (dateFilter === 'week') {
            const weekDay = workingDateUTC.getUTCDay();
            const diff = workingDateUTC.getUTCDate() - weekDay + (weekDay === 0 ? -6 : 1);
            const weekStartUTC = new Date(workingDateUTC);
            weekStartUTC.setUTCDate(diff);
            startDateStr = weekStartUTC.toISOString().split('T')[0];
        } else if (dateFilter === 'month') {
            const monthStartUTC = new Date(Date.UTC(year, month - 1, 1));
            startDateStr = monthStartUTC.toISOString().split('T')[0];
        } else if (dateFilter === 'custom' && customDateRange.start && customDateRange.end) {
            startDateStr = customDateRange.start;
            endDateStr = customDateRange.end;
        }


        const period: PerformancePeriod = { start: startDateStr, end: endDateStr };

        // Month boundaries for monthly collection
        const monthStartStr = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
        const monthEndStr = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

        // Days in current week elapsed (Mon=1 … Sun=7)
        // FIX: use getUTCDay() on IST date anchor — avoids Intl locale short-name inconsistency
        const weekDayIST = (() => {
            const now2 = new Date();
            const istStr2 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now2);
            const [iy, im, id] = istStr2.split('-').map(Number);
            const istUTCDate = new Date(Date.UTC(iy, im - 1, id));
            const dayNum = istUTCDate.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
            return dayNum === 0 ? 7 : dayNum;      // Mon=1 … Sat=6, Sun=7
        })();

        return rawData.teamLeaders.map(tl => {
            const tlId = tl.id;
            const todayCollectionTemp = (rawData as any).dailyCollectionsMap?.[tlId] || 0;

            // Pure mathematical sum of exactly the filtered dates for correct UI amount
            const pastSum = rawData.collections.filter(item => {
                const isTL = item.team_leader_id === tlId;
                if (!isTL) return false;
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                return dDateStr >= startDateStr && dDateStr <= endDateStr && dDateStr !== nowISTStr;
            }).reduce((sum, item) => sum + (Number(item.total_collection) || 0), 0);
            
            const todayLive = (nowISTStr >= startDateStr && nowISTStr <= endDateStr) ? todayCollectionTemp : 0;
            const tlCollection = pastSum + todayLive;

            // AI Evaluating Collection (uses representative weekly volume when 'today' to prevent 0% grade drop)
            const aiEvaluatingCollection = dateFilter === 'today' ? ((rawData as any).weeklyCollectionsMap?.[tlId] || 0) : tlCollection;

            const targetEndDate = endDateStr === nowISTStr ? nowISTStr : endDateStr;
            const collectionSnapshot = rawData.collections.find(item => {
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                return item.team_leader_id === tlId && dDateStr === targetEndDate;
            });

            const historicalFleet = (targetEndDate < nowISTStr && collectionSnapshot && Number(collectionSnapshot.active_riders_count) > 0)
                ? Number(collectionSnapshot.active_riders_count)
                : undefined;

            // Activity Tracking
            const tlRiders = rawData.riders.filter(r => (r.team_leader_id === tlId || r.teamLeaderId === tlId));
            const tlLeads = rawData.leads.filter(l => l.created_by === tlId || l.createdBy === tlId);
            const lastLeadTime = tlLeads.length > 0 ? Math.max(...tlLeads.map(l => new Date(l.created_at || l.createdAt).getTime())) : 0;
            const lastRiderUpdate = tlRiders.length > 0 ? Math.max(...tlRiders.map(r => new Date(r.updated_at || r.updatedAt || r.created_at || r.createdAt).getTime())) : 0;
            const activityTime = Math.max(lastLeadTime, lastRiderUpdate);
            const lastActivity = activityTime > 0 ? new Date(activityTime).toISOString() : undefined;

            // Standardize metrics using our AI Core Utility
            const metrics = calculateAIScore(
                tl,
                rawData.riders,
                rawData.leads,
                aiEvaluatingCollection,
                period,
                historicalFleet
            );

            // ── MONTHLY COLLECTION: sum from daily_collections for this calendar month ──
            const monthlyCollection = rawData.collections
                .filter((item: any) => {
                    if (item.team_leader_id !== tlId) return false;
                    const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                    return dDateStr >= monthStartStr && dDateStr <= monthEndStr;
                })
                .reduce((sum: number, item: any) => sum + (Number(item.total_collection) || 0), 0);

            // ── GRAND TOTAL: all-time collection ──
            const grandTotal = rawData.collections
                .filter((item: any) => item.team_leader_id === tlId)
                .reduce((sum: number, item: any) => sum + (Number(item.total_collection) || 0), 0);

            // ── INACTIVE RIDERS ──
            const inactiveRiders = tlRiders.filter(r => r.status === 'inactive').length;

            // ── RIDER AVERAGE TENURE (days) ──
            const activeTlRiders = tlRiders.filter(r => r.status === 'active' && (r.allotment_date || r.allotmentDate));
            const avgTenureDays = activeTlRiders.length > 0
                ? Math.round(activeTlRiders.reduce((sum, r) => {
                    const allotDateStr = r.allotment_date || r.allotmentDate;
                    const validAllotDateStr = getValidHistoricalDate(allotDateStr);
                    const allotDate = new Date(validAllotDateStr || allotDateStr);
                    return sum + Math.max(0, Math.floor((Date.now() - allotDate.getTime()) / (1000 * 60 * 60 * 24)));
                }, 0) / activeTlRiders.length)
                : 0;

            // ── PER RIDER PER DAY AVG ──
            const daysInPeriod = dateFilter === 'today' ? 1 : dateFilter === 'week' ? weekDayIST : dateFilter === 'month' ? day : Math.max(1, Math.ceil((new Date(endDateStr).getTime() - new Date(startDateStr).getTime()) / (1000 * 60 * 60 * 24)) + 1);
            const perRiderPerDayAvg = (metrics.activeRiders > 0 && daysInPeriod > 0)
                ? Math.round(tlCollection / metrics.activeRiders / daysInPeriod)
                : 0;
            
            // ── DYNAMIC PERIOD METRICS ──
            // Instead of hardcoded "This Week", we use the exact selected date filter bounds
            const periodCollection = tlCollection; // Already bounded by startDateStr and endDateStr
            const periodDayAvg = daysInPeriod > 0 ? Math.round(periodCollection / daysInPeriod) : 0;
            const periodPerRiderAvg = metrics.activeRiders > 0 ? Math.round(periodCollection / metrics.activeRiders) : 0;

            // Keep the return structure compatible with existing table usage
            return {
                id: tlId,
                name: tl.full_name || tl.fullName || 'Unknown',
                email: tl.email,
                reportingManager: tl.reporting_manager || '',
                totalRiders: metrics.totalRiders,
                activeRiders: metrics.activeRiders,
                inactiveRiders,
                wallet: {
                    total: metrics.positiveWallet + metrics.negativeWallet,
                    positiveCount: metrics.positiveWalletCount,
                    positiveAmount: metrics.positiveWallet,
                    negativeCount: metrics.negativeWalletCount,
                    negativeAmount: metrics.negativeWallet
                },
                leads: {
                    total: metrics.leadsTotal,
                    converted: metrics.convertedLeads,
                    conversionRate: metrics.conversionRate
                },
                status: tl.status,
                totalCollection: grandTotal,
                rangeCollection: tlCollection,
                monthlyCollection,
                
                // Dynamic Period Metrics
                periodCollection,
                periodDayAvg,
                periodPerRiderAvg,
                daysInPeriod,

                perDayAverageCollection: periodDayAvg, // Legacy prop mapping
                perRiderPerDayAvg,
                avgRiderCollection: metrics.activeRiders > 0 ? Math.round(tlCollection / metrics.activeRiders) : 0,
                avgTenureDays,
                leadsToday: metrics.leadsTotal,
                churnLeads: metrics.leadsTotal - metrics.convertedLeads,
                criticalDebtCount: metrics.negativeWalletCount,
                allotments: metrics.allotments,
                submissions: metrics.submissions,
                netGrowth: metrics.netGrowth,
                lastActivity,
                score: metrics.score,
                aiGrade: metrics.aiGrade,
                isTrending: metrics.isTrending
            };
        });
    }, [rawData, dateFilter, customDateRange]);

    // Extract unique Reporting Managers
    const uniqueReportingManagers = useMemo(() => {
        const rmMap = new Map<string, number>();
        rawData.teamLeaders.forEach(tl => {
            const rm = (tl.reporting_manager || '').trim();
            if (rm) rmMap.set(rm, (rmMap.get(rm) || 0) + 1);
        });
        return Array.from(rmMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rawData.teamLeaders]);

    const filteredData = useMemo(() => {
        let data = performanceData.filter(tl => {
            const matchesSearch = tl.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                tl.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

            const matchesStatus = filterStatus === 'all' || tl.status === filterStatus;

            const matchesRisk = riskFilter === 'all' ||
                (riskFilter === 'high_risk' && tl.criticalDebtCount > 0) ||
                (riskFilter === 'low_risk' && tl.criticalDebtCount === 0);

            const matchesPerf = perfFilter === 'all' ||
                (perfFilter === 'top_performers' && tl.leads.conversionRate >= 50) ||
                (perfFilter === 'low_conversion' && tl.leads.conversionRate < 10 && tl.leads.total > 0);

            const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(tl.id);

            const matchesRM = rmFilter === 'all' || tl.reportingManager === rmFilter;

            return matchesSearch && matchesStatus && matchesRisk && matchesPerf && matchesTL && matchesRM;
        });

        // Apply Sorting
        if (sortConfig) {
            data.sort((a: any, b: any) => {
                let aValue: any;
                let bValue: any;

                // Handle nested keys or calculated values
                if (sortConfig.key === 'walletHealth') {
                    aValue = Math.abs(a.wallet.negativeAmount);
                    bValue = Math.abs(b.wallet.negativeAmount);
                } else if (sortConfig.key === 'conversion') {
                    aValue = a.leads.conversionRate;
                    bValue = b.leads.conversionRate;
                } else {
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [performanceData, debouncedSearchTerm, filterStatus, riskFilter, perfFilter, selectedTLs, sortConfig, rmFilter]);

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const exportToExcel = () => {
        const data = filteredData.map(tl => ({
            'Name': tl.name,
            'Email': tl.email,
            'Reporting Manager': tl.reportingManager || 'N/A',
            'Active Riders': tl.activeRiders,
            'Inactive Riders': tl.inactiveRiders,
            'Total Riders': tl.totalRiders,
            'Positive Riders': tl.wallet.positiveCount,
            'Positive Amount': tl.wallet.positiveAmount,
            'Negative Riders': tl.wallet.negativeCount,
            'Negative Amount': Math.abs(tl.wallet.negativeAmount),
            'Period Collection': tl.periodCollection,
            'Period Day Avg': tl.periodDayAvg,
            'Period Rider Avg': tl.periodPerRiderAvg,
            'Grand Total': tl.totalCollection,
            'Fleet Flow (A/S/N)': `${tl.allotments}/${tl.submissions}/${tl.netGrowth}`,
            'Net Growth': tl.netGrowth,
            'Leads Total': tl.leadsToday,
            'Leads Converted': tl.leads.converted,
            'Churn Leads': tl.churnLeads,
            'Conversion Rate': tl.leads.conversionRate + '%',
            'Avg Tenure (Days)': tl.avgTenureDays,
            'AI Score': tl.score,
            'AI Grade': tl.aiGrade,
            'Status': tl.status,
        }));

        // Add totals row
        data.push({
            'Name': 'TOTALS',
            'Email': '',
            'Reporting Manager': '',
            'Active Riders': filteredData.reduce((s, t) => s + t.activeRiders, 0),
            'Inactive Riders': filteredData.reduce((s, t) => s + t.inactiveRiders, 0),
            'Total Riders': filteredData.reduce((s, t) => s + t.totalRiders, 0),
            'Positive Riders': filteredData.reduce((s, t) => s + t.wallet.positiveCount, 0),
            'Positive Amount': filteredData.reduce((s, t) => s + t.wallet.positiveAmount, 0),
            'Negative Riders': filteredData.reduce((s, t) => s + t.wallet.negativeCount, 0),
            'Negative Amount': filteredData.reduce((s, t) => s + Math.abs(t.wallet.negativeAmount), 0),
            'Period Collection': filteredData.reduce((s, t) => s + t.periodCollection, 0),
            'Period Day Avg': 0,
            'Period Rider Avg': 0,
            'Grand Total': filteredData.reduce((s, t) => s + t.totalCollection, 0),
            'Fleet Flow (A/S/N)': '',
            'Net Growth': filteredData.reduce((s, t) => s + t.netGrowth, 0),
            'Leads Total': filteredData.reduce((s, t) => s + t.leadsToday, 0),
            'Leads Converted': filteredData.reduce((s, t) => s + t.leads.converted, 0),
            'Churn Leads': filteredData.reduce((s, t) => s + t.churnLeads, 0),
            'Conversion Rate': '',
            'Avg Tenure (Days)': 0 as any,
            'AI Score': 0 as any,
            'AI Grade': '' as any,
            'Status': '' as any,
        });

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
        doc.text(`Generated on: ${new Date().toLocaleString()} `, 14, 28);

        const tableColumn = [
            "TL Name",
            "Reporting Mgr",
            "Active/Total",
            "Period Coll.",
            "Day Avg",
            "Rider Avg",
            "Grand Total",
            "Pos/Neg",
            "Risk Amt",
            "A/S/N",
            "Leads",
            "Conv %",
            "Tenure",
            "Score"
        ];

        const tableRows = filteredData.map(tl => [
            tl.name,
            tl.reportingManager || 'N/A',
            `${tl.activeRiders}/${tl.totalRiders}`,
            `INR ${tl.periodCollection.toLocaleString()}`,
            `INR ${tl.periodDayAvg.toLocaleString()}`,
            `INR ${tl.periodPerRiderAvg.toLocaleString()}`,
            `INR ${tl.totalCollection.toLocaleString()}`,
            `${tl.wallet.positiveCount}/${tl.wallet.negativeCount}`,
            `INR ${Math.abs(tl.wallet.negativeAmount).toLocaleString()}`,
            `${tl.allotments}/${tl.submissions}/${tl.netGrowth}`,
            `${tl.leads.converted}/${tl.leadsToday}`,
            `${tl.leads.conversionRate}%`,
            `${tl.avgTenureDays}d`,
            `${tl.score} (${tl.aiGrade})`
        ]);

        autoTable(doc, {
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
        const headers = ['Name', 'Email', 'Reporting Manager', 'Active Riders', 'Inactive Riders', 'Total Riders', 'Positive Riders', 'Positive Amount', 'Negative Riders', 'Negative Amount', 'Period Collection', 'Period Day Avg', 'Period Rider Avg', 'Grand Total', 'Allotments', 'Submissions', 'Net Growth', 'Leads Total', 'Leads Converted', 'Churn Leads', 'Conversion Rate', 'Avg Tenure (Days)', 'AI Score', 'AI Grade', 'Status'];
        const rows = filteredData.map(tl => [
            tl.name,
            tl.email,
            tl.reportingManager || 'N/A',
            tl.activeRiders,
            tl.inactiveRiders,
            tl.totalRiders,
            tl.wallet.positiveCount,
            tl.wallet.positiveAmount,
            tl.wallet.negativeCount,
            Math.abs(tl.wallet.negativeAmount),
            tl.periodCollection,
            tl.periodDayAvg,
            tl.periodPerRiderAvg,
            tl.totalCollection,
            tl.allotments,
            tl.submissions,
            tl.netGrowth,
            tl.leadsToday,
            tl.leads.converted,
            tl.churnLeads,
            tl.leads.conversionRate + '%',
            tl.avgTenureDays,
            tl.score,
            tl.aiGrade,
            tl.status
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

    // Aggregate stats for header
    const topPerformer = useMemo(() => performanceData.length > 0 ? performanceData.reduce((best, tl) => tl.score > best.score ? tl : best, performanceData[0]) : null, [performanceData]);
    const avgAIScore = useMemo(() => performanceData.length > 0 ? Math.round(performanceData.reduce((s, t) => s + t.score, 0) / performanceData.length) : 0, [performanceData]);
    const avgGrade = avgAIScore >= 90 ? 'S' : avgAIScore >= 70 ? 'A' : avgAIScore >= 50 ? 'B' : avgAIScore >= 30 ? 'C' : 'F';
    const activeTLCount = useMemo(() => performanceData.filter(t => t.status === 'active').length, [performanceData]);
    const totalMonthlyCollection = useMemo(() => performanceData.reduce((s, t) => s + t.monthlyCollection, 0), [performanceData]);

    if (loading) {
        return (
            <div className="space-y-5 pb-10 animate-in fade-in duration-500 pt-6 px-4 md:px-8">
                <div className="bg-card/60 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 animate-pulse" />
                        <div className="space-y-2 flex-1">
                            <div className="h-7 w-64 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 animate-pulse" />
                            <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        </div>
                    </div>
                </div>
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
                <div className="h-96 rounded-2xl bg-card/50 border border-border/40 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-6 bg-background min-h-screen pb-20">
            {/* ── PREMIUM DARK HEADER ── */}
            <div className="relative bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white p-6 md:p-8 overflow-hidden">
                {/* Decorative blobs */}
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-500/10 rounded-full blur-[60px] translate-y-1/3 pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/20">
                                <TrendingUp className="h-6 w-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black tracking-tight">Team Leader Performance Center</h1>
                                <p className="text-sm text-white/50 font-medium">Real-time analytical depth and operational insights</p>
                            </div>
                        </div>

                        {/* Inline Stats Row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10">
                                {performanceData.length} Team Leaders
                            </span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/20">
                                {activeTLCount} Active
                            </span>
                            {topPerformer && (
                                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-400/20">
                                    🏆 {topPerformer.name.split(' ')[0]} ({topPerformer.aiGrade})
                                </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${avgAIScore >= 50 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20' : 'bg-rose-500/20 text-rose-300 border-rose-400/20'}`}>
                                Avg Score: {avgAIScore} ({avgGrade})
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 relative flex-shrink-0">
                        <div className="relative">
                            <button
                                onClick={() => setIsExportOpen(!isExportOpen)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Download className="h-4 w-4" />
                                Export
                            </button>
                            {isExportOpen && (
                                <div className="absolute right-0 mt-2 w-52 bg-card text-foreground border border-border rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-in slide-in-from-top-2">
                                    <button onClick={exportToExcel} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel Spreadsheet (.xlsx)
                                    </button>
                                    <button onClick={exportToPDF} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-rose-500" /> PDF Document (.pdf)
                                    </button>
                                    <button onClick={exportToCSV} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2 border-t pt-2">
                                        <div className="w-2 h-2 rounded-full bg-slate-400" /> CSV Export (.csv)
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            <Activity className="h-3 w-3 animate-pulse" />
                            Live Sync
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 space-y-6">
            {/* ── 6 SUMMARY CARDS ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: `${dateFilter === 'today' ? "Today's" : dateFilter === 'week' ? 'Weekly' : dateFilter === 'month' ? 'Monthly' : 'Range'} Collection`, value: `₹${performanceData.reduce((a, b) => a + b.rangeCollection, 0).toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
                    { label: 'Active Riders', value: performanceData.reduce((a, b) => a + b.activeRiders, 0).toLocaleString(), icon: Users, color: 'text-blue-500', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
                    { label: 'Leads Today', value: `+${performanceData.reduce((a, b) => a + b.leadsToday, 0)}`, icon: ArrowUpRight, color: 'text-indigo-500', border: 'border-indigo-500/20', bg: 'bg-indigo-500/5' },
                    { label: 'Market Risk', value: `₹${Math.abs(performanceData.reduce((a, b) => a + b.wallet.negativeAmount, 0)).toLocaleString()}`, icon: Wallet, color: 'text-rose-500', border: 'border-rose-500/20', bg: 'bg-rose-500/5' },
                    { label: 'Avg AI Score', value: `${avgAIScore}`, icon: Activity, color: avgAIScore >= 50 ? 'text-emerald-500' : 'text-amber-500', border: avgAIScore >= 50 ? 'border-emerald-500/20' : 'border-amber-500/20', bg: avgAIScore >= 50 ? 'bg-emerald-500/5' : 'bg-amber-500/5', badge: avgGrade },
                    { label: 'Monthly Total', value: `₹${totalMonthlyCollection.toLocaleString()}`, icon: Calendar, color: 'text-violet-500', border: 'border-violet-500/20', bg: 'bg-violet-500/5' },
                ].map((card, i) => (
                <div key={i} className={`p-3 sm:p-4 rounded-2xl border ${card.border} ${card.bg} shadow-sm space-y-1.5`}>
                        <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">{card.label}</span>
                            <card.icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${card.color} flex-shrink-0`} />
                        </div>
                        <div className="flex items-baseline gap-1.5 min-w-0">
                            <span className="text-base sm:text-xl font-black truncate">{card.value}</span>
                            {(card as any).badge && (
                                <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                    (card as any).badge === 'S' || (card as any).badge === 'A' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : (card as any).badge === 'B' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : (card as any).badge === 'C' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                }`}>{(card as any).badge}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Table Search & Filter */}
            <div className="bg-card border border-border/40 rounded-2xl shadow-xl">
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

                                    {/* Reporting Manager Filter */}
                                    {uniqueReportingManagers.length > 0 && (
                                        <div className="relative flex-1 md:flex-none">
                                            <select
                                                value={rmFilter}
                                                onChange={(e) => setRmFilter(e.target.value)}
                                                className={`w-full md:w-auto pl-9 pr-8 py-2 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer appearance-none shadow-sm font-medium transition-colors ${rmFilter !== 'all' ? 'border-teal-500 text-teal-700 bg-teal-50/50 dark:bg-teal-900/20 dark:text-teal-400 ring-2 ring-teal-500/20' : 'border-border/60 text-foreground'}`}
                                            >
                                                <option value="all">All Managers ({rawData.teamLeaders.length} TLs)</option>
                                                {uniqueReportingManagers.map(rm => (
                                                    <option key={rm.name} value={rm.name}>{rm.name} ({rm.count} TLs)</option>
                                                ))}
                                            </select>
                                            <UserCheck className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${rmFilter !== 'all' ? 'text-teal-600' : 'text-muted-foreground'}`} />
                                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${rmFilter !== 'all' ? 'text-teal-500/70' : 'text-muted-foreground/70'}`} />
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
                                            <button onClick={() => { setFilterStatus('all'); setRiskFilter('all'); setPerfFilter('all'); setRmFilter('all'); }} className="text-[10px] text-primary font-bold hover:underline">Reset All</button>
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

                                        <div className="space-y-1.5 pt-4 border-t">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Select Team Leaders</label>
                                            <div className="max-h-40 overflow-y-auto space-y-2 p-1 border rounded-lg bg-background/50 custom-scrollbar">
                                                {rawData.teamLeaders.map(tl => (
                                                    <label key={tl.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded text-xs cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedTLs.includes(tl.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedTLs([...selectedTLs, tl.id]);
                                                                } else {
                                                                    setSelectedTLs(selectedTLs.filter(id => id !== tl.id));
                                                                }
                                                            }}
                                                            className="rounded border-border text-primary focus:ring-primary/20"
                                                        />
                                                        <span className="truncate">{tl.full_name || tl.fullName}</span>
                                                    </label>
                                                ))}
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
                    <table className="w-full min-w-[1800px] text-sm text-left">
                        <thead className="text-[10px] text-muted-foreground uppercase bg-muted/10 font-black tracking-widest border-b border-border/40">
                            <tr>
                                <th className="px-5 py-4 min-w-[200px] cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wider">
                                        Team Leader
                                        {sortConfig?.key === 'name' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-5 py-4 min-w-[110px] cursor-pointer hover:bg-muted/30 transition-colors text-center" onClick={() => handleSort('activeRiders')}>
                                    <div className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-wider">
                                        Riders
                                        {sortConfig?.key === 'activeRiders' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-5 py-4 min-w-[180px] cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('walletHealth')}>
                                    <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wider">
                                        Wallet Health
                                        {sortConfig?.key === 'walletHealth' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-5 py-4 min-w-[220px] cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('rangeCollection')}>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wider">
                                            Collection
                                            {sortConfig?.key === 'rangeCollection' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground mt-0.5">
                                            <span>Period: <span className="text-foreground">₹{performanceData.reduce((a, b) => a + b.rangeCollection, 0).toLocaleString()}</span></span>
                                            <span className="text-emerald-500">Total: ₹{performanceData.reduce((a, b) => a + (b as any).totalCollection, 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </th>
                                <th className="px-5 py-4 min-w-[120px] cursor-pointer hover:bg-muted/30 transition-colors text-center" onClick={() => handleSort('periodDayAvg')}>
                                    <div className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-wider">
                                        Day Avg
                                        {sortConfig?.key === 'periodDayAvg' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                {/* ── DYNAMIC PERIOD METRICS ─────────────────────── */}
                                <th className="px-5 py-4 min-w-[210px] cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('periodCollection')}>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-violet-600">
                                            <Calendar className="h-3 w-3" />
                                            {dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This Week' : dateFilter === 'month' ? 'This Month' : 'Filtered Period'}
                                            {sortConfig?.key === 'periodCollection' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground mt-0.5">
                                            <span>Amt: <span className="text-violet-600">₹{performanceData.reduce((a, b) => a + (b as any).periodCollection, 0).toLocaleString()}</span></span>
                                            <span className="text-violet-400">({performanceData.length > 0 ? (performanceData[0] as any).daysInPeriod : 0} Days)</span>
                                        </div>
                                    </div>
                                </th>
                                <th className="px-5 py-4 min-w-[190px] cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('netGrowth')}>
                                    <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wider">
                                        Fleet Flow
                                        {sortConfig?.key === 'netGrowth' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-5 py-4 min-w-[160px] cursor-pointer hover:bg-muted/30 transition-colors text-center" onClick={() => handleSort('conversion')}>
                                    <div className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-wider">
                                        Leads %
                                        {sortConfig?.key === 'conversion' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-5 py-4 min-w-[90px] text-right text-xs font-black uppercase tracking-wider">Status</th>
                                <th className="px-4 py-4 min-w-[130px] cursor-pointer hover:bg-muted/30 transition-colors text-center" onClick={() => handleSort('periodPerRiderAvg')}>
                                    <div className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-wider text-orange-600">
                                        Rider Avg
                                        {sortConfig?.key === 'periodPerRiderAvg' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-4 py-4 min-w-[90px] cursor-pointer hover:bg-muted/30 transition-colors text-center" onClick={() => handleSort('avgTenureDays')}>
                                    <div className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-wider">
                                        Tenure
                                        {sortConfig?.key === 'avgTenureDays' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-4 py-4 min-w-[80px] cursor-pointer hover:bg-muted/30 transition-colors text-center" onClick={() => handleSort('score')}>
                                    <div className="flex items-center justify-center gap-1 text-xs font-black uppercase tracking-wider text-indigo-600">
                                        Score
                                        {sortConfig?.key === 'score' && <ChevronDown className={`h-3 w-3 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {loading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={9} className="px-6 py-8"><div className="h-8 bg-muted/40 rounded-lg w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-24 text-center">
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
                                    <tr key={tl.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors border-b border-border/20 last:border-0">
                                        {/* 1. Team Leader */}
                                        <td className="px-5 py-4 min-w-[200px]">
                                            <div className="flex items-center gap-3">
                                                <div className="relative shrink-0">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-600 text-base">
                                                        {tl.name.charAt(0)}
                                                    </div>
                                                    {tl.lastActivity && (new Date().getTime() - new Date(tl.lastActivity).getTime() < 30 * 60 * 1000) && (
                                                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-background"></span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-foreground text-sm flex items-center gap-1.5 truncate">
                                                        {tl.name}
                                                        {tl.leadsToday > 3 && (
                                                            <span className="shrink-0 px-1 py-0.5 bg-orange-500 rounded text-[8px] text-white font-black">HOT</span>
                                                        )}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{tl.email}</p>
                                                    {tl.reportingManager && (
                                                        <p className="text-[9px] text-teal-600 dark:text-teal-400 font-bold truncate mt-0.5">↳ {tl.reportingManager}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* 2. Rider Force */}
                                        <td className="px-5 py-4 min-w-[110px]">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className="text-base font-black text-foreground">{tl.activeRiders} <span className="text-xs font-medium text-muted-foreground">/ {tl.totalRiders}</span></span>
                                                <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                                        style={{ width: `${tl.totalRiders > 0 ? (tl.activeRiders / tl.totalRiders) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* 3. Wallet Health */}
                                        <td className="px-5 py-4 min-w-[180px]">
                                            <div className="space-y-2">
                                                <div className="flex gap-1.5 flex-wrap">
                                                    <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-black">{tl.wallet.positiveCount} POS</span>
                                                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[10px] font-black">{tl.wallet.negativeCount} NEG</span>
                                                </div>
                                                <div className="flex gap-4 text-[11px] font-bold">
                                                    <span className="text-emerald-600">₹{tl.wallet.positiveAmount.toLocaleString()}</span>
                                                    <span className="text-rose-600">₹{Math.abs(tl.wallet.negativeAmount).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 4. Collection Analytics */}
                                        <td className="px-5 py-4 min-w-[220px]">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col border-r pr-4 border-border/40">
                                                    <span className="text-[9px] text-muted-foreground font-black uppercase">Period Vol.</span>
                                                    <span className="text-base font-black text-emerald-600">₹{tl.periodCollection.toLocaleString()}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-[9px] text-muted-foreground font-black uppercase">Avg/Rider</span>
                                                        <span className="text-xs font-black text-blue-600">₹{tl.periodPerRiderAvg.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-[9px] text-muted-foreground font-black uppercase">Grand Total</span>
                                                        <span className="text-xs font-bold text-muted-foreground">₹{tl.totalCollection.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 5. Per Day Avg */}
                                        <td className="px-5 py-4 min-w-[120px] text-center">
                                            <span className="text-base font-black text-foreground">₹{(tl.periodDayAvg || 0).toLocaleString()}</span>
                                            <p className="text-[9px] text-muted-foreground font-medium mt-0.5">
                                                Daily Pace
                                            </p>
                                        </td>

                                        {/* 5b. Period Focus */}
                                        <td className="px-5 py-4 min-w-[210px]">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col border-r pr-3 border-violet-500/20">
                                                    <span className="text-[9px] text-violet-400 font-black uppercase">Period Total</span>
                                                    <span className="text-base font-black text-violet-600">₹{((tl as any).periodCollection || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[9px] text-muted-foreground font-black uppercase">Day Avg</span>
                                                        <span className="text-xs font-black text-violet-500">₹{((tl as any).periodDayAvg || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[9px] text-muted-foreground font-black uppercase">Per Rider</span>
                                                        <span className="text-xs font-bold text-violet-400">₹{((tl as any).periodPerRiderAvg || 0).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 6. Fleet Flow */}
                                        <td className="px-5 py-4 min-w-[190px]">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col border-r pr-4 border-border/40">
                                                    <span className="text-[9px] text-muted-foreground font-black uppercase">Net Growth</span>
                                                    <span className={`text-xl font-black ${tl.netGrowth > 0 ? 'text-emerald-600' : tl.netGrowth < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                                                        {tl.netGrowth > 0 ? '+' : ''}{tl.netGrowth}
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-[9px] text-muted-foreground font-black uppercase">Allotment</span>
                                                        <span className="text-xs font-black text-indigo-600">+{tl.allotments}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-[9px] text-muted-foreground font-black uppercase">Submission</span>
                                                        <span className="text-xs font-black text-rose-500">-{tl.submissions}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 7. Leads % */}
                                        <td className="px-5 py-4 min-w-[160px]">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-10 h-10 shrink-0">
                                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                                                        <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted/20" />
                                                        <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="4" fill="transparent"
                                                            strokeDasharray={113} strokeDashoffset={113 - (113 * tl.leads.conversionRate) / 100}
                                                            className="text-indigo-500 transition-all duration-1000" />
                                                    </svg>
                                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black">{tl.leads.conversionRate}%</span>
                                                </div>
                                                <div className="space-y-1 text-[10px]">
                                                    <div className="flex gap-2 items-center">
                                                        <span className="text-muted-foreground uppercase font-bold">Sourced</span>
                                                        <span className="text-indigo-600 font-black">+{tl.leadsToday}</span>
                                                    </div>
                                                    <div className="flex gap-2 items-center">
                                                        <span className="text-muted-foreground uppercase font-bold">Churned</span>
                                                        <span className="text-rose-500 font-black">-{tl.churnLeads}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 8. Status */}
                                        <td className="px-5 py-4 min-w-[90px] text-right">
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wide ${tl.status === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                                }`}>
                                                {tl.status}
                                            </span>
                                        </td>

                                        {/* 9. Period Rider Avg */}
                                        <td className="px-4 py-4 min-w-[130px] text-center">
                                            <span className="text-sm font-black text-orange-600">₹{tl.periodPerRiderAvg.toLocaleString()}</span>
                                        </td>

                                        {/* 11. Avg Tenure */}
                                        <td className="px-4 py-4 min-w-[90px] text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-black">{tl.avgTenureDays}d</span>
                                                <span className="text-[8px] text-muted-foreground font-bold">{tl.avgTenureDays >= 365 ? `${Math.floor(tl.avgTenureDays / 365)}y ${tl.avgTenureDays % 365}d` : tl.avgTenureDays >= 30 ? `${Math.floor(tl.avgTenureDays / 30)}m` : ''}</span>
                                            </div>
                                        </td>

                                        {/* 12. AI Score */}
                                        <td className="px-4 py-4 min-w-[80px] text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={`text-sm font-black ${tl.score >= 70 ? 'text-emerald-600' : tl.score >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{tl.score}</span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tl.aiGrade === 'A' || tl.aiGrade === 'S' ? 'bg-emerald-100 text-emerald-700' : tl.aiGrade === 'B' ? 'bg-blue-100 text-blue-700' : tl.aiGrade === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{tl.aiGrade}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>

                        {/* Grand Totals Row */}
                        {!loading && filteredData.length > 0 && (
                            <tfoot className="bg-slate-100/80 dark:bg-slate-900/50 border-t-2 border-primary/30 sticky bottom-0">
                                <tr className="text-xs font-black">
                                    <td className="px-5 py-3 uppercase tracking-wider text-primary">Totals ({filteredData.length} TLs)</td>
                                    <td className="px-5 py-3 text-center">{filteredData.reduce((s, t) => s + t.activeRiders, 0)} / {filteredData.reduce((s, t) => s + t.totalRiders, 0)}</td>
                                    <td className="px-5 py-3">
                                        <div className="flex gap-1.5 flex-wrap">
                                            <span className="text-emerald-600">{filteredData.reduce((s, t) => s + t.wallet.positiveCount, 0)} POS</span>
                                            <span className="text-rose-600">{filteredData.reduce((s, t) => s + t.wallet.negativeCount, 0)} NEG</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-emerald-600">₹{filteredData.reduce((s, t) => s + t.periodCollection, 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-center">–</td>
                                    <td className="px-5 py-3 text-violet-600">₹{filteredData.reduce((s, t) => s + (t as any).periodCollection, 0).toLocaleString()}</td>
                                    <td className="px-5 py-3">
                                        <span className="text-emerald-600">+{filteredData.reduce((s, t) => s + t.allotments, 0)}</span> / <span className="text-rose-600">-{filteredData.reduce((s, t) => s + t.submissions, 0)}</span> / <span className={filteredData.reduce((s, t) => s + t.netGrowth, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{filteredData.reduce((s, t) => s + t.netGrowth, 0)}</span>
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        {filteredData.reduce((s, t) => s + t.leads.converted, 0)} / {filteredData.reduce((s, t) => s + t.leadsToday, 0)}
                                    </td>
                                    <td className="px-5 py-3">–</td>
                                    <td className="px-4 py-3 text-center text-orange-600">–</td>
                                    <td className="px-4 py-3 text-center">–</td>
                                    <td className="px-4 py-3 text-center">–</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
            </div>{/* end px-6 wrapper */}
        </div>
    );
};

export default TLPerformance;
