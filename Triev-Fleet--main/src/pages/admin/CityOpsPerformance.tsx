/* eslint-disable */
// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/config/supabase';
import {
    Download, Search, TrendingUp, Users, Activity,
    Calendar, ChevronDown, ChevronRight, SearchX, Wallet, ArrowUpRight, History,
    Check, X as XIcon, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateAIScore, PerformancePeriod } from '@/utils/performance';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import PerformanceCard from '@/components/dashboard/PerformanceCard';
import AIPerformanceInsights from '@/components/dashboard/AIPerformanceInsights';
import { exportBrandedPerformancePDF } from '@/utils/exportUtils';
import { useDebounce } from '@/hooks/useDebounce';

/* ── Mini Sparkline (pure SVG) ──────────────────────────────────────────── */
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number; color?: string }> = ({
    data, width = 100, height = 28, color = '#6366f1'
}) => {
    if (!data.length || data.every(v => v === 0)) return <span className="text-[9px] text-muted-foreground italic">No data</span>;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pad = 2;
    const pts = data.map((v, i) => ({
        x: pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2),
        y: pad + (1 - (v - min) / range) * (height - pad * 2)
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`;
    const trend = data[data.length - 1] - data[0];
    const gradId = `sp-${color.replace('#', '')}`;
    return (
        <div className="flex items-center gap-1.5">
            <svg width={width} height={height} className="flex-shrink-0">
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <path d={area} fill={`url(#${gradId})`} />
                <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2" fill={color} />
            </svg>
            <span className={`text-[9px] font-black ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}
            </span>
        </div>
    );
};

interface CityOpsPerformanceProps {
    scopedCityOpsIds?: string[];
}

const CityOpsPerformance: React.FC<CityOpsPerformanceProps> = ({ scopedCityOpsIds }) => {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<{
        riders: any[];
        leads: any[];
        teamLeaders: any[];
        rms: any[];
        cityOps: any[];
        collections: any[];
        dailyCollectionsMap?: Record<string, number>;
        weeklyCollectionsMap?: Record<string, number>;
        fetchedTodayStr?: string;
    }>({ riders: [], leads: [], teamLeaders: [], rms: [], cityOps: [], collections: [] });

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
    const [selectedCityOps, setSelectedCityOps] = useState<string[]>([]);
    const [coDropdownOpen, setCoDropdownOpen] = useState(false);
    const coDropdownRef = useRef<HTMLDivElement>(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'rangeCollection', direction: 'desc' });
    const [expandedCO, setExpandedCO] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
            const now = new Date();
            const todayStr = formatter.format(now);
            const [year, month, day] = todayStr.split('-').map(Number);
            const workingDateUTC = new Date(Date.UTC(year, month - 1, day));
            const weekDay = workingDateUTC.getUTCDay();
            const diff = workingDateUTC.getUTCDate() - weekDay + (weekDay === 0 ? -6 : 1);
            const weekStartUTC = new Date(workingDateUTC);
            weekStartUTC.setUTCDate(diff);
            const weekStartStr = weekStartUTC.toISOString().split('T')[0];
            const midnightIST = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();
            const endOfDayIST = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000).toISOString();

            let cityOpsQuery = supabase.from('users').select('*').eq('role', 'cityOps');
            let rmQuery = supabase.from('users').select('*').eq('role', 'reportingManager');
            let tlQuery = supabase.from('users').select('*').in('role', ['teamLeader']);

            const [coRes, rmRes] = await Promise.all([cityOpsQuery, rmQuery]);
            if (coRes.error) throw coRes.error;
            if (rmRes.error) throw rmRes.error;

            const allCityOps = coRes.data || [];
            const allRms = rmRes.data || [];

            // Map Rms by their City Ops ID
            const rmNamesToCityOps = new Map();
            allRms.forEach(rm => {
                if (rm.city_ops_id && rm.full_name) {
                    rmNamesToCityOps.set(rm.full_name, rm.city_ops_id);
                }
            });

            // Get all TLs matching these RMs
            const rmNames = Array.from(rmNamesToCityOps.keys());
            if (rmNames.length > 0) {
                tlQuery = tlQuery.in('reporting_manager', rmNames);
            } else {
                tlQuery = tlQuery.eq('id', 'no-match-placeholder');
            }

            const { data: allTls, error: tlError } = await tlQuery;
            if (tlError) throw tlError;

            const validTlIds = (allTls || []).map(tl => tl.id);

            const [ridersRes, leadsRes, dailyRes, todayLedgerRes] = await Promise.all([
                validTlIds.length > 0 ? fetchAllRidersPaginated('*', { column: 'team_leader_id', value: validTlIds, type: 'in' }) : fetchAllRidersPaginated('*', {column: 'id', value: ['invalid'], type:'in'}),
                validTlIds.length > 0 ? supabase.from('leads').select('*').in('created_by', validTlIds) : supabase.from('leads').select('*').eq('id', 'invalid'),
                validTlIds.length > 0 ? supabase.from('daily_collections').select('*').in('team_leader_id', validTlIds).order('date', { ascending: false }).limit(20000) : supabase.from('daily_collections').select('*').limit(0),
                supabase.from('wallet_ledger').select('amount, rider: riders!inner(team_leader_id)')
                    .eq('mode', 'ADD')
                    .in('transaction_type', ['DAILY_COLLECTION', 'DAILY COLLECTION', 'RENT_COLLECTION', 'RENT COLLECTION', 'FTD_COLLECTION', 'FTD COLLECTION', 'COLLECTION', 'RENT'])
                    .or(`and(transaction_date.gte.${midnightIST}, transaction_date.lte.${endOfDayIST}), and(transaction_date.is.null, created_at.gte.${midnightIST})`)
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (leadsRes.error) throw leadsRes.error;
            if (dailyRes.error) throw dailyRes.error;
            if (todayLedgerRes.error) throw todayLedgerRes.error;

            const weekly = {};
            const daily = {};
            const tlsWithTodaySnapshot = new Set();

            dailyRes.data?.forEach(item => {
                const tlId = item.team_leader_id;
                const amt = Number(item.total_collection) || 0;
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                if (dDateStr >= weekStartStr) {
                    weekly[tlId] = (weekly[tlId] || 0) + amt;
                }
                if (dDateStr === todayStr) {
                    tlsWithTodaySnapshot.add(tlId);
                    daily[tlId] = (daily[tlId] || 0) + amt;
                }
            });

            const todayLedger = (todayLedgerRes?.data || []);
            todayLedger.forEach(txn => {
                if (txn.rider?.team_leader_id) {
                    const tlId = txn.rider.team_leader_id;
                    if (!tlsWithTodaySnapshot.has(tlId)) {
                        daily[tlId] = (daily[tlId] || 0) + (Number(txn.amount) || 0);
                    }
                }
            });

            Object.keys(daily).forEach(tlId => {
                if (!tlsWithTodaySnapshot.has(tlId)) {
                    weekly[tlId] = (weekly[tlId] || 0) + (daily[tlId] || 0);
                }
            });

            setRawData({
                riders: (ridersRes.data || []).map(r => ({
                    ...r,
                    walletAmount: Number(r.wallet_amount ?? r.walletAmount ?? 0),
                    teamLeaderId: r.team_leader_id ?? r.teamLeaderId,
                    allotmentDate: r.allotment_date ?? r.allotmentDate,
                    status: String(r.status || '').toLowerCase(),
                    createdAt: r.created_at ?? r.createdAt
                })),
                leads: leadsRes.data || [],
                teamLeaders: (allTls || []).map(u => ({
                    ...u,
                    fullName: u.full_name ?? u.fullName,
                    id: u.id
                })),
                rms: (allRms || []).map(u => ({
                    ...u,
                    fullName: u.full_name ?? u.fullName,
                    id: u.id
                })),
                cityOps: (allCityOps || []).map(u => ({
                    ...u,
                    fullName: u.full_name ?? u.fullName,
                    id: u.id
                })),
                collections: dailyRes.data || [],
                dailyCollectionsMap: daily,
                weeklyCollectionsMap: weekly,
                fetchedTodayStr: todayStr
            });
        } catch (error) {
            toast.error('Failed to load performance data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        let ledgerDebounce: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            if (ledgerDebounce) clearTimeout(ledgerDebounce);
            ledgerDebounce = setTimeout(() => fetchData(), 1000);
        };

        const channels = [
            supabase.channel('rm-perf-riders').on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchDebounced).subscribe(),
            supabase.channel('rm-perf-leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchDebounced).subscribe(),
            supabase.channel('rm-perf-collections').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchDebounced).subscribe(),
            supabase.channel('rm-perf-ledger').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, fetchDebounced).subscribe(),
        ];

        // ── Auto-reset at IST midnight — forces fresh data so "Today" zeroes out ─
        const scheduleMidnightReset = () => {
            const now = new Date();
            const istStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
            const [y, m, d] = istStr.split('-').map(Number);
            const nextMidnightUTC = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
            const msUntilMidnight = nextMidnightUTC.getTime() - now.getTime();
            return window.setTimeout(() => {
                fetchData();
                scheduleMidnightReset();
            }, msUntilMidnight + 500);
        };
        const midnightTimer = scheduleMidnightReset();

        // ── Auto-reset at IST Monday midnight (weekly reset) ─────────────────
        const scheduleWeeklyReset = () => {
            const now = new Date();
            const istStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
            const [y, m, d] = istStr.split('-').map(Number);
            const istDate = new Date(Date.UTC(y, m - 1, d));
            const dayOfWeek = istDate.getUTCDay();
            const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
            const nextMondayUTC = new Date(Date.UTC(y, m - 1, d + daysUntilMonday, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
            const msUntilMonday = nextMondayUTC.getTime() - now.getTime();
            return window.setTimeout(() => {
                fetchData();
                scheduleWeeklyReset();
            }, msUntilMonday + 500);
        };
        const weeklyTimer = scheduleWeeklyReset();

        // ── PWA/Background: Auto-refresh on tab visibility restore ───────────
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
        const nowMs = new Date().getTime();
        const now = new Date(nowMs);
        const nowISTStr = formatter.format(now);
        const [nYear, nMonth, nDay] = nowISTStr.split('-').map(Number);
        
        let startDateStr = nowISTStr;
        let endDateStr = nowISTStr;

        if (dateFilter === 'yesterday') {
            const yUTC = new Date(Date.UTC(nYear, nMonth - 1, nDay - 1));
            startDateStr = yUTC.toISOString().split('T')[0];
            endDateStr = startDateStr;
        } else if (dateFilter === 'week') {
            const workingDateUTC = new Date(Date.UTC(nYear, nMonth - 1, nDay));
            const weekDay = workingDateUTC.getUTCDay();
            const diff = workingDateUTC.getUTCDate() - weekDay + (weekDay === 0 ? -6 : 1);
            const weekStartUTC = new Date(workingDateUTC);
            weekStartUTC.setUTCDate(diff);
            startDateStr = weekStartUTC.toISOString().split('T')[0];
        } else if (dateFilter === 'month') {
            startDateStr = new Date(Date.UTC(nYear, nMonth - 1, 1)).toISOString().split('T')[0];
        } else if (dateFilter === 'custom' && customDateRange.start && customDateRange.end) {
            startDateStr = customDateRange.start;
            endDateStr = customDateRange.end;
        }

        const [year, month, day] = endDateStr.split('-').map(Number);
        const workingDateUTC = new Date(Date.UTC(year, month - 1, day));
        
        const period: PerformancePeriod = { start: startDateStr, end: endDateStr };
        const monthStartStr = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
        const monthEndStr = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

        // ── ALWAYS-COMPUTED week/month boundaries (independent of filter) ──
        const weekDayUTC = workingDateUTC.getUTCDay();
        const wDiff = workingDateUTC.getUTCDate() - weekDayUTC + (weekDayUTC === 0 ? -6 : 1);
        const alwaysWeekStartUTC = new Date(workingDateUTC);
        alwaysWeekStartUTC.setUTCDate(wDiff);
        const alwaysWeekStartStr = alwaysWeekStartUTC.toISOString().split('T')[0];

        const daysInPeriod = dateFilter === 'today' || dateFilter === 'yesterday' ? 1 
            : dateFilter === 'week' ? (() => { const d = new Date(Date.UTC(nYear, nMonth - 1, nDay)).getUTCDay(); return d === 0 ? 7 : d; })()
            : dateFilter === 'month' ? nDay 
            : Math.max(1, Math.ceil((new Date(endDateStr).getTime() - new Date(startDateStr).getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const tlMetrics = rawData.teamLeaders.map(tl => {
            const tlId = tl.id;
            const targetEndDate = endDateStr;
            const fetchedDay = (rawData as any).fetchedTodayStr || '';
            const isDataFresh = fetchedDay === nowISTStr;
            const todayLiveAmount = isDataFresh ? ((rawData as any).dailyCollectionsMap?.[tlId] || 0) : 0;
            
            let targetDayCollection = 0;
            if (endDateStr === nowISTStr) {
                targetDayCollection = todayLiveAmount;
            } else {
                targetDayCollection = rawData.collections.filter(item => {
                    if (item.team_leader_id !== tlId) return false;
                    const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                    return dDateStr === endDateStr;
                }).reduce((sum, item) => sum + (Number(item.total_collection) || 0), 0);
            }

            const pastSum = rawData.collections.filter(item => {
                if (item.team_leader_id !== tlId) return false;
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                return dDateStr >= startDateStr && dDateStr <= endDateStr && dDateStr !== nowISTStr;
            }).reduce((sum, item) => sum + (Number(item.total_collection) || 0), 0);
            
            const todayLive = (nowISTStr >= startDateStr && nowISTStr <= endDateStr) ? todayLiveAmount : 0;
            const tlCollection = pastSum + todayLive;

            const weeklyMapValue = isDataFresh ? ((rawData as any).weeklyCollectionsMap?.[tlId] || 0) : 0;
            const aiEvaluatingCollection = dateFilter === 'today' ? weeklyMapValue : tlCollection;

            const periodSnapshots = rawData.collections
                .filter(item => {
                    if (item.team_leader_id !== tlId) return false;
                    const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                    return dDateStr >= startDateStr && dDateStr <= endDateStr;
                })
                .sort((a: any, b: any) => {
                    const da = a.date && typeof a.date === 'string' ? a.date.split('T')[0].split(' ')[0] : a.date;
                    const db = b.date && typeof b.date === 'string' ? b.date.split('T')[0].split(' ')[0] : b.date;
                    return db.localeCompare(da);
                });
            const bestSnapshot = periodSnapshots[0];
            const historicalFleet = (targetEndDate < nowISTStr && bestSnapshot && Number(bestSnapshot.active_riders_count) > 0)
                ? Number(bestSnapshot.active_riders_count) : undefined;

            const metrics = calculateAIScore(tl, rawData.riders, rawData.leads, aiEvaluatingCollection, period, historicalFleet);

            const weeklyCollTL = rawData.collections.filter((item: any) => {
                if (item.team_leader_id !== tlId) return false;
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                return dDateStr >= alwaysWeekStartStr && dDateStr <= endDateStr && dDateStr !== nowISTStr;
            }).reduce((sum: number, item: any) => sum + (Number(item.total_collection) || 0), 0) + (endDateStr === nowISTStr ? targetDayCollection : 0);

            const monthlyCollTL = rawData.collections.filter((item: any) => {
                if (item.team_leader_id !== tlId) return false;
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                return dDateStr >= monthStartStr && dDateStr <= endDateStr && dDateStr !== nowISTStr;
            }).reduce((sum: number, item: any) => sum + (Number(item.total_collection) || 0), 0) + (endDateStr === nowISTStr ? targetDayCollection : 0);
            
            return { ...tl, ...metrics, collection: tlCollection, weeklyCollection: weeklyCollTL, monthlyCollection: monthlyCollTL, totalCollection: tlCollection, todayCollection: targetDayCollection };
        });

        const periodEndMs = new Date(endDateStr + 'T23:59:59').getTime();
        const isHistorical = endDateStr < nowISTStr;

        const cityOpsData = ((rawData).cityOps || []).map((co) => {
            const coName = co.fullName || '';
            const coId = co.id;
            
            // RMs under this City Ops
            const coRMs = rawData.rms.filter(rm => rm.city_ops_id === coId);
            const coRMNames = coRMs.map(rm => rm.fullName);
            const totalRMs = coRMs.length;

            // TLs under those RMs
            const assignedTLs = tlMetrics.filter(tl => coRMNames.includes((tl.reporting_manager || '').trim()));
            
            const totalTLs = assignedTLs.length;
            const activeTLs = assignedTLs.filter(tl => tl.status === 'active').length;
            const activeRiders = assignedTLs.reduce((sum, tl) => sum + tl.activeRiders, 0);
            const totalRiders = assignedTLs.reduce((sum, tl) => sum + tl.totalRiders, 0);
            
            const positiveWalletCount = assignedTLs.reduce((sum, tl) => sum + tl.positiveWalletCount, 0);
            const positiveWallet = assignedTLs.reduce((sum, tl) => sum + tl.positiveWallet, 0);
            const negativeWalletCount = assignedTLs.reduce((sum, tl) => sum + tl.negativeWalletCount, 0);
            const negativeWallet = assignedTLs.reduce((sum, tl) => sum + tl.negativeWallet, 0);

            const leadsTotal = assignedTLs.reduce((sum, tl) => sum + tl.leadsTotal, 0);
            const convertedLeads = assignedTLs.reduce((sum, tl) => sum + tl.convertedLeads, 0);
            
            const allotments = assignedTLs.reduce((sum, tl) => sum + tl.allotments, 0);
            const submissions = assignedTLs.reduce((sum, tl) => sum + tl.submissions, 0);
            const netGrowth = assignedTLs.reduce((sum, tl) => sum + tl.netGrowth, 0);

            const rangeCollection = assignedTLs.reduce((sum, tl) => sum + tl.collection, 0);
            
            let totalTenureDays = 0;
            let validTenureCount = 0;
            const rmRiders = rawData.riders.filter(r => {
                if (!assignedTLs.some(tl => tl.id === (r.team_leader_id || r.teamLeaderId))) return false;
                if (isHistorical) {
                    const allotDate = r.allotment_date || r.allotmentDate || r.created_at || r.createdAt;
                    if (!allotDate) return false;
                    const validAllotDate = getValidHistoricalDate(allotDate);
                    const finalAllotDateStr = validAllotDate || allotDate;
                    const allotStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(finalAllotDateStr));
                    if (allotStr > endDateStr) return false;
                    const inactDate = r.inactivated_at || r.inactivatedAt;
                    if (inactDate) {
                        const validInactDate = getValidHistoricalDate(inactDate);
                        const finalInactDateStr = validInactDate || inactDate;
                        const inactStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(finalInactDateStr));
                        if (inactStr <= endDateStr) return false;
                    }
                    return true;
                }
                return String(r.status || '').toLowerCase() === 'active';
            });
            rmRiders.forEach(r => {
                const joinDate = r.allotmentDate || r.allotment_date || r.createdAt || r.created_at;
                if (joinDate) {
                    const validJoinDate = getValidHistoricalDate(joinDate);
                    const finalJoinDateStr = validJoinDate || joinDate;
                    const days = Math.floor((periodEndMs - new Date(finalJoinDateStr).getTime()) / (1000 * 60 * 60 * 24));
                    if (days >= 0) { totalTenureDays += days; validTenureCount++; }
                }
            });
            const avgTenure = validTenureCount > 0 ? Math.round(totalTenureDays / validTenureCount) : 0;
            
            const historicalByDate = {};
            assignedTLs.forEach(tl => {
                rawData.collections.forEach(item => {
                    if (item.team_leader_id === tl.id) {
                        const rawDate = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                        if (!historicalByDate[rawDate]) historicalByDate[rawDate] = { date: rawDate, collection: 0, activeRiders: 0 };
                        historicalByDate[rawDate].collection += Number(item.total_collection) || 0;
                        historicalByDate[rawDate].activeRiders += Number(item.active_riders_count) || 0;
                    }
                });
            });
            const historicalDataRaw = Object.values(historicalByDate)
                .filter((d) => d.date >= startDateStr && d.date <= endDateStr)
                .sort((a, b) => b.date.localeCompare(a.date));
            
            const historicalData = historicalDataRaw.map((d) => ({
                ...d, avgPerRider: d.activeRiders > 0 ? Math.round(d.collection / d.activeRiders) : 0
            }));

            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(Date.UTC(year, month - 1, day - i));
                const ds = d.toISOString().split('T')[0];
                last7Days.push(historicalByDate[ds]?.collection || 0);
            }

            const score = totalTLs > 0 ? Math.round(assignedTLs.reduce((sum, tl) => sum + tl.score, 0) / totalTLs) : 0;
            const aiGrade = score >= 90 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'F';

            const walletPosPercent = activeRiders > 0 ? Math.round((positiveWalletCount / activeRiders) * 100) : 0;
            const walletNegPercent = activeRiders > 0 ? Math.round((negativeWalletCount / activeRiders) * 100) : 0;

            return {
                id: coName, name: coName, totalRMs, totalTLs, activeTLs, totalRiders, activeRiders, inactiveRiders: totalRiders - activeRiders,
                wallet: { total: positiveWallet + negativeWallet, positiveCount: positiveWalletCount, positiveAmount: positiveWallet, negativeCount: negativeWalletCount, negativeAmount: negativeWallet, posPercent: walletPosPercent, negPercent: walletNegPercent },
                leads: { total: leadsTotal, converted: convertedLeads, conversionRate: leadsTotal > 0 ? Math.round((convertedLeads / leadsTotal) * 100) : 0 },
                allotments, submissions, netGrowth, rangeCollection, 
                weeklyCollection: assignedTLs.reduce((sum, tl) => sum + (tl.weeklyCollection || 0), 0),
                monthlyCollection: assignedTLs.reduce((sum, tl) => sum + (tl.monthlyCollection || 0), 0),
                totalCollection: rangeCollection, 
                todayCollection: assignedTLs.reduce((sum, tl) => sum + (tl.todayCollection || 0), 0),
                avgTenure, periodDayAvg: daysInPeriod > 0 ? Math.round(rangeCollection / daysInPeriod) : 0,
                periodPerRiderAvg: activeRiders > 0 ? Math.round(rangeCollection / activeRiders) : 0,
                score, aiGrade, leadsToday: leadsTotal, churnLeads: leadsTotal - convertedLeads, status: activeTLs > 0 ? 'active' : 'inactive', historicalData, daysInPeriod,
                last7DaysTrend: last7Days,
                assignedTLs: assignedTLs.map(tl => {
                    const tlHistory = {};
                    rawData.collections.forEach(item => {
                        if (item.team_leader_id === tl.id) {
                            const rawDate = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                            tlHistory[rawDate] = (tlHistory[rawDate] || 0) + (Number(item.total_collection) || 0);
                        }
                    });
                    
                    const tlTrend = [];
                    for (let i = 6; i >= 0; i--) {
                        const d = new Date(Date.UTC(year, month - 1, day - i));
                        const ds = d.toISOString().split('T')[0];
                        tlTrend.push(tlHistory[ds] || 0);
                    }

                    return {
                        ...tl,
                        walletPosPercent: tl.activeRiders > 0 ? Math.round((tl.positiveWalletCount / tl.activeRiders) * 100) : 0,
                        walletNegPercent: tl.activeRiders > 0 ? Math.round((tl.negativeWalletCount / tl.activeRiders) * 100) : 0,
                        last7DaysTrend: tlTrend
                    };
                })
            };
        });

        return cityOpsData;
    }, [rawData, dateFilter, customDateRange]);


    // Close RM dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (coDropdownRef.current && !coDropdownRef.current.contains(e.target as Node)) setCoDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleCO = (name: string) => setSelectedCityOps(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

    const filteredData = useMemo(() => {
        let data = performanceData.filter(rm => {
            const matchesSearch = rm.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
            const matchesFilter = selectedCityOps.length === 0 || selectedCityOps.includes(rm.name);
            return matchesSearch && matchesFilter;
        });

        if (sortConfig) {
            data.sort((a: any, b: any) => {
                let aValue = sortConfig.key === 'walletHealth' ? Math.abs(a.wallet.negativeAmount) : sortConfig.key === 'conversion' ? a.leads.conversionRate : a[sortConfig.key];
                let bValue = sortConfig.key === 'walletHealth' ? Math.abs(b.wallet.negativeAmount) : sortConfig.key === 'conversion' ? b.leads.conversionRate : b[sortConfig.key];
                return aValue < bValue ? (sortConfig.direction === 'asc' ? -1 : 1) : aValue > bValue ? (sortConfig.direction === 'asc' ? 1 : -1) : 0;
            });
        }
        return data;
    }, [performanceData, debouncedSearchTerm, sortConfig, selectedCityOps]);

    const handleSort = (key: string) => setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

        const exportToExcel = () => {
        const filterLabel = dateFilter === 'today' ? 'Today' : dateFilter === 'yesterday' ? 'Yesterday' : dateFilter === 'week' ? 'This Week' : dateFilter === 'month' ? 'This Month' : `${customDateRange.start} to ${customDateRange.end}`;
        const data = filteredData.map(rm => ({
            'City Ops': rm.name,
            'Total TLs': rm.totalTLs,
            'Active TLs': rm.activeTLs,
            'Active Riders': rm.activeRiders,
            'Total Riders': rm.totalRiders,
            'Avg Fleet Tenure': Math.round(rm.avgTenure) + ' d',
            'Avg/Rider': rm.periodPerRiderAvg,
            'Positive Riders': rm.wallet.positiveCount,
            'Positive Amt': rm.wallet.positiveAmount,
            'Negative Riders': rm.wallet.negativeCount,
            'Negative Amt': Math.abs(rm.wallet.negativeAmount),
            'Today Collection': (rm as any).todayCollection || 0,
            'Weekly Collection': (rm as any).weeklyCollection || 0,
            'Monthly Collection': (rm as any).monthlyCollection || 0,
            [`Period Collection (${filterLabel})`]: rm.rangeCollection,
            'Fleet Flow (A/S/N)': `${rm.allotments}/${rm.submissions}/${rm.netGrowth}`,
            'Net Growth': rm.netGrowth,
            'Leads Sourced': rm.leads.total,
            'Leads Converted': rm.leads.converted,
            'Conversion Rate': rm.leads.conversionRate + '%',
            'Avg AI Score': rm.score,
            'AI Grade': rm.aiGrade,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'City Ops Performance');
        XLSX.writeFile(wb, `rm_performance_${filterLabel.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel report exported successfully');
        setIsExportOpen(false);
    };

    const exportToPDF = () => {
        const filterLabel = dateFilter === 'today' ? 'Today' : dateFilter === 'yesterday' ? 'Yesterday' : dateFilter === 'week' ? 'This Week' : dateFilter === 'month' ? 'This Month' : `${customDateRange.start} to ${customDateRange.end}`;

        const kpis = [
            { label: 'City Ops Count', value: `${performanceData.length}` },
            { label: 'Active Fleet', value: `${tActRiders}/${tTotRiders}` },
            { label: 'Period Collection', value: `₹${performanceData.reduce((a, b) => a + b.rangeCollection, 0).toLocaleString()}` },
            { label: 'Market Risk', value: `₹${tNegAmt.toLocaleString()}` },
            { label: 'Avg AI Score', value: `${avgAIScore} (${avgGrade})` }
        ];

        const cols = ['City Ops Name', 'TLs', 'Riders', 'Tenure', 'Today Coll.', 'Weekly Coll.', 'Monthly Coll.', 'Avg/Rider', 'Pos/Neg', 'A/S/N', 'Leads', 'AI Score'];
        const rows = filteredData.map(rm => [
            rm.name,
            rm.totalTLs,
            `${rm.activeRiders}/${rm.totalRiders}`,
            `${Math.round(rm.avgTenure)}d`,
            `₹${((rm as any).todayCollection || 0).toLocaleString()}`,
            `₹${((rm as any).weeklyCollection || 0).toLocaleString()}`,
            `₹${((rm as any).monthlyCollection || 0).toLocaleString()}`,
            `₹${rm.periodPerRiderAvg.toLocaleString()}`,
            `${rm.wallet.positiveCount}/${rm.wallet.negativeCount}`,
            `${rm.allotments}/${rm.submissions}/${rm.netGrowth}`,
            `${rm.leads.converted}/${rm.leads.total}`,
            `${rm.score} (${rm.aiGrade})`
        ]);

        const fileName = `CityOps_Performance_${filterLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
        exportBrandedPerformancePDF(`City Operations Performance (${filterLabel})`, kpis, cols, rows, fileName);
        toast.success('Branded PDF report exported successfully');
        setIsExportOpen(false);
    };

    const clearFilters = () => { setSearchTerm(''); setSelectedCityOps([]); };

    const avgAIScore = useMemo(() => performanceData.length > 0 ? Math.round(performanceData.reduce((s, t) => s + t.score, 0) / performanceData.length) : 0, [performanceData]);
    const avgGrade = avgAIScore >= 90 ? 'S' : avgAIScore >= 70 ? 'A' : avgAIScore >= 50 ? 'B' : avgAIScore >= 30 ? 'C' : 'F';

    // Compute Totals
    const tTLs = filteredData.reduce((s, t) => s + t.totalTLs, 0);
    const tActTLs = filteredData.reduce((s, t) => s + t.activeTLs, 0);
    const tActRiders = filteredData.reduce((s, t) => s + t.activeRiders, 0);
    const tTotRiders = filteredData.reduce((s, t) => s + t.totalRiders, 0);
    const tTotPerRiderAvg = tActRiders > 0 ? Math.round(filteredData.reduce((s, t) => s + t.rangeCollection, 0) / tActRiders) : 0;
    const tAvgTenure = filteredData.reduce((s, t) => s + t.avgTenure, 0) / (filteredData.length || 1);
    const tPosAmt = filteredData.reduce((s, t) => s + t.wallet.positiveAmount, 0);
    const tNegAmt = filteredData.reduce((s, t) => s + Math.abs(t.wallet.negativeAmount), 0);
    const tPosCount = filteredData.reduce((s, t) => s + t.wallet.positiveCount, 0);
    const tNegCount = filteredData.reduce((s, t) => s + t.wallet.negativeCount, 0);
    const tPosPct = tActRiders > 0 ? Math.round((tPosCount / tActRiders) * 100) : 0;
    const tNegPct = tActRiders > 0 ? Math.round((tNegCount / tActRiders) * 100) : 0;
    
    
    const tTodayCol = filteredData.reduce((s, t) => s + (t as any).todayCollection, 0);
    const tWeeklyCol = filteredData.reduce((s, t) => s + ((t as any).weeklyCollection || 0), 0);
    const tMonthlyCol = filteredData.reduce((s, t) => s + ((t as any).monthlyCollection || 0), 0);
    const tAllots = filteredData.reduce((s, t) => s + t.allotments, 0);
    const tSubs = filteredData.reduce((s, t) => s + t.submissions, 0);
    const tNet = filteredData.reduce((s, t) => s + t.netGrowth, 0);
    const tLds = filteredData.reduce((s, t) => s + t.leads.total, 0);
    const tCnv = filteredData.reduce((s, t) => s + t.leads.converted, 0);
    const tCnvPct = tLds > 0 ? Math.round((tCnv / tLds) * 100) : 0;

    const t7DTrend = [0,0,0,0,0,0,0];
    filteredData.forEach(rm => {
        (rm.last7DaysTrend || []).forEach((val: number, i: number) => {
            if (i < 7) t7DTrend[i] += val;
        });
    });

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
            <div className="relative bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white p-6 md:p-8 overflow-hidden">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-500/10 rounded-full blur-[60px] translate-y-1/3 pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/20">
                                <TrendingUp className="h-6 w-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black tracking-tight">City Ops Performance Center</h1>
                                <p className="text-sm text-white/50 font-medium">City Ops comprehensive analysis & history</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10">
                                {performanceData.length} City Opss
                            </span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/20">
                                {tActTLs} Active TLs
                            </span>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${avgAIScore >= 50 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20' : 'bg-rose-500/20 text-rose-300 border-rose-400/20'}`}>
                                Avg Score: {avgAIScore} ({avgGrade})
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 relative flex-shrink-0">
                        <div className="relative">
                            <button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-medium transition-colors">
                                <Download className="h-4 w-4" /> Export
                            </button>
                            {isExportOpen && (
                                <div className="absolute right-0 mt-2 w-52 bg-card text-foreground border border-border rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-in slide-in-from-top-2">
                                    <button onClick={exportToExcel} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel Spreadsheet (.xlsx)
                                    </button>
                                    <button onClick={exportToPDF} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-rose-500" /> PDF Document (.pdf)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 space-y-6">
                {/* ── STAT CARDS ROW V2 ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <PerformanceCard
                        title={`${dateFilter === 'today' ? "Today's" : dateFilter === 'yesterday' ? "Yesterday's" : dateFilter === 'week' ? 'Weekly' : dateFilter === 'month' ? 'Monthly' : 'Range'} Collection`}
                        value={`₹${performanceData.reduce((a, b) => a + b.rangeCollection, 0).toLocaleString()}`}
                        subtext="assigned city ops collection"
                        icon={TrendingUp}
                        colorScheme="emerald"
                    />
                    <PerformanceCard
                        title="Active Riders"
                        value={tActRiders.toLocaleString()}
                        subtext={`of ${tTotRiders.toLocaleString()} total`}
                        icon={Users}
                        colorScheme="blue"
                    />
                    <PerformanceCard
                        title="Avg Fleet Tenure"
                        value={`${Math.round(tAvgTenure)} Days`}
                        subtext="average active age"
                        icon={History}
                        colorScheme="indigo"
                    />
                    <PerformanceCard
                        title="Market Risk"
                        value={`₹${tNegAmt.toLocaleString()}`}
                        subtext={`${tNegCount} negative riders`}
                        icon={Wallet}
                        colorScheme="rose"
                    />
                    <PerformanceCard
                        title="Avg AI Score"
                        value={`${avgAIScore}`}
                        subtext={`Grade ${avgGrade}`}
                        icon={Activity}
                        colorScheme="purple"
                    />
                    <PerformanceCard
                        title="Avg / Rider"
                        value={`₹${tTotPerRiderAvg.toLocaleString()}`}
                        subtext="average daily yield"
                        icon={ArrowUpRight}
                        colorScheme="purple"
                    />
                </div>

                {/* ── AI Performance Insights ── */}
                <AIPerformanceInsights
                    roleName="City Operations Fleet"
                    totalCollection={performanceData.reduce((a, b) => a + b.rangeCollection, 0)}
                    activeRidersCount={tActRiders}
                    totalRidersCount={tTotRiders}
                    criticalDebtCount={tNegCount}
                    avgScore={avgAIScore}
                />

                <div className="bg-card border border-border/40 rounded-2xl shadow-xl">
                    <div className="p-6 border-b border-border/40 bg-muted/20">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h2 className="text-lg font-bold">City Ops Analysis</h2>
                                <p className="text-sm text-muted-foreground">Detailed metrics with expandable historical views</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative w-full md:w-auto">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input placeholder="Search City Ops Name..." className="w-full md:w-48 pl-9 pr-4 py-2 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                                {/* RM Multi-Select Filter */}
                                <div className="relative" ref={coDropdownRef}>
                                    <button onClick={() => setCoDropdownOpen(v => !v)}
                                        className={`flex items-center gap-2 px-3 py-2 bg-background border rounded-xl text-sm font-medium transition-all shadow-sm min-w-[150px] ${selectedCityOps.length > 0 ? 'border-indigo-500/40 bg-indigo-500/5 text-indigo-700 dark:text-indigo-400' : 'border-border/60'}`}>
                                        <Filter className="h-4 w-4 flex-shrink-0" />
                                        <span className="truncate">{selectedCityOps.length === 0 ? 'All Managers' : `${selectedCityOps.length} Selected`}</span>
                                        <ChevronDown className={`h-4 w-4 ml-auto transition-transform flex-shrink-0 ${coDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    <AnimatePresence>
                                        {coDropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute z-50 mt-2 w-60 bg-card border border-border rounded-xl shadow-2xl p-2 space-y-0.5 max-h-64 overflow-y-auto">
                                                <button onClick={() => setSelectedCityOps([])} className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors ${selectedCityOps.length === 0 ? 'bg-indigo-500/10 text-indigo-600' : 'hover:bg-muted'}`}>
                                                    <Users className="h-3.5 w-3.5" /> All Managers
                                                    {selectedCityOps.length === 0 && <Check className="h-3.5 w-3.5 ml-auto text-indigo-600" />}
                                                </button>
                                                <div className="h-px bg-border/50 my-1" />
                                                {Array.from(new Set(performanceData.map(rm => rm.name))).map(name => (
                                                    <button key={name} onClick={() => toggleCO(name)}
                                                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors ${selectedCityOps.includes(name) ? 'bg-indigo-500/10 text-indigo-600' : 'hover:bg-muted text-foreground'}`}>
                                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedCityOps.includes(name) ? 'bg-indigo-600 border-indigo-600' : 'border-border'}`}>
                                                            {selectedCityOps.includes(name) && <Check className="h-3 w-3 text-white" />}
                                                        </div>
                                                        {name}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                {/* Selected RM chips */}
                                {selectedCityOps.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {selectedCityOps.map(name => (
                                            <span key={name} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black border border-indigo-500/20">
                                                {name}
                                                <button onClick={() => toggleCO(name)} className="hover:bg-indigo-500/20 rounded-full p-0.5"><XIcon className="h-3 w-3" /></button>
                                            </span>
                                        ))}
                                        <button onClick={clearFilters} className="text-[10px] font-bold text-rose-600 hover:underline">Clear All</button>
                                    </div>
                                )}
                                <div className="relative flex-1 md:flex-none">
                                    <select value={dateFilter} onChange={(e: any) => setDateFilter(e.target.value)} className="w-full md:w-auto pl-9 pr-8 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer appearance-none shadow-sm font-black tracking-wide">
                                        <option value="today">Today Metrics</option>
                                        <option value="yesterday">Yesterday's Metrics</option>
                                        <option value="week">Weekly Metrics</option>
                                        <option value="month">Monthly Metrics</option>
                                        <option value="custom">Custom Date Range</option>
                                    </select>
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600 dark:text-indigo-400 pointer-events-none" />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600/70 pointer-events-none" />
                                </div>
                                {dateFilter === 'custom' && (
                                    <div className="flex items-center gap-2 bg-background border border-border/60 rounded-xl p-1 shadow-sm">
                                        <input type="date" className="text-xs py-1 px-2 focus:outline-none bg-transparent rounded [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" style={{ colorScheme: 'light dark' }} value={customDateRange.start} onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })} />
                                        <span className="text-muted-foreground text-xs font-bold">—</span>
                                        <input type="date" className="text-xs py-1 px-2 focus:outline-none bg-transparent rounded [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" style={{ colorScheme: 'light dark' }} value={customDateRange.end} onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1720px] text-sm text-left">
                            <thead className="text-[10px] text-muted-foreground uppercase bg-muted/10 font-black tracking-widest border-b border-border/40">
                                <tr>
                                    <th className="px-5 py-4 w-10"></th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">City Ops {sortConfig?.key === 'name' && <ChevronDown className="h-3 w-3" />}</div>
                                    </th>
                                    <th className="px-5 py-4 text-center cursor-pointer" onClick={() => handleSort('totalTLs')}>TLs</th>
                                    <th className="px-5 py-4 text-center cursor-pointer" onClick={() => handleSort('activeRiders')}>Riders</th>
                                    <th className="px-5 py-4 text-center cursor-pointer" onClick={() => handleSort('avgTenure')}>Avg Tenure</th>
                                    <th className="px-5 py-4 text-center cursor-pointer" onClick={() => handleSort('periodPerRiderAvg')}>Avg/Rider</th>
                                    <th className="px-5 py-4 cursor-pointer" onClick={() => handleSort('walletHealth')}>Wallet Health</th>
                                    <th className="px-5 py-4 cursor-pointer" onClick={() => handleSort('rangeCollection')}>Collection</th>
                                    <th className="px-4 py-4 text-center">7D Trend</th>
                                    <th className="px-5 py-4 cursor-pointer" onClick={() => handleSort('netGrowth')}>Fleet Flow</th>
                                    <th className="px-5 py-4 text-center cursor-pointer" onClick={() => handleSort('conversion')}>Leads</th>
                                    <th className="px-4 py-4 text-center cursor-pointer" onClick={() => handleSort('score')}>Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {filteredData.length === 0 && !loading ? (
                                    <tr><td colSpan={12} className="px-6 py-24 text-center"><div className="flex flex-col items-center"><SearchX className="h-10 w-10 opacity-20 mb-4"/><p className="font-bold text-lg">No Results</p></div></td></tr>
                                ) : filteredData.map((rm) => (
                                    <React.Fragment key={rm.id}>
                                        <motion.tr
                                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                            whileHover={{ backgroundColor: 'rgba(59,130,246,0.04)' }}
                                            className={`group transition-colors cursor-pointer ${expandedCO === rm.id ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                            onClick={() => setExpandedCO(expandedCO === rm.id ? null : rm.id)}>
                                            <td className="px-5 text-center text-muted-foreground">
                                                {expandedCO === rm.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-600">
                                                        {rm.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-foreground text-sm truncate">{rm.name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center"><span className="text-base font-black text-foreground">{rm.activeTLs} <span className="text-xs text-muted-foreground">/ {rm.totalTLs}</span></span></td>
                                            <td className="px-5 py-4 text-center"><span className="text-base font-black text-foreground">{rm.activeRiders} <span className="text-xs text-muted-foreground">/ {rm.totalRiders}</span></span></td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-sm font-bold text-orange-600 bg-orange-500/10 px-2 py-1 rounded-md">{rm.avgTenure} d</span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-sm font-bold text-indigo-600 bg-indigo-500/10 px-2 py-1 rounded-md">₹{rm.periodPerRiderAvg.toLocaleString()}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-1.5 min-w-[140px]">
                                                    {/* Wallet health % bar */}
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden flex">
                                                            <div className="h-full bg-emerald-500 rounded-l-full transition-all" style={{ width: `${rm.wallet.posPercent}%` }} />
                                                            <div className="h-full bg-rose-500 rounded-r-full transition-all" style={{ width: `${rm.wallet.negPercent}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] font-black">
                                                        <span className="text-emerald-600">{rm.wallet.posPercent}% Pos</span>
                                                        <span className="text-rose-600">{rm.wallet.negPercent}% Neg</span>
                                                    </div>
                                                    <div className="text-[10px] text-foreground/80 font-bold flex flex-col gap-0.5 mt-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-emerald-600/80">{rm.wallet.positiveCount} Riders</span>
                                                            <span className="text-emerald-600">+₹{rm.wallet.positiveAmount.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-rose-600/80">{rm.wallet.negativeCount} Riders</span>
                                                            <span className="text-rose-600">-₹{Math.abs(rm.wallet.negativeAmount).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-0.5 min-w-[150px]">
                                                    <div className="flex items-center gap-2 pl-2 border-l-2 border-emerald-500">
                                                        <span className="text-[9px] text-emerald-600/70 font-black uppercase w-14">Today</span>
                                                        <span className="text-sm font-black text-emerald-600">₹{(rm as any).todayCollection.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 pl-2 border-l-2 border-blue-500">
                                                        <span className="text-[9px] text-blue-600/70 font-black uppercase w-14">Weekly</span>
                                                        <span className="text-sm font-black text-blue-600">₹{((rm as any).weeklyCollection || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 pl-2 border-l-2 border-violet-500">
                                                        <span className="text-[9px] text-violet-600/70 font-black uppercase w-14">Monthly</span>
                                                        <span className="text-sm font-black text-violet-600">₹{((rm as any).monthlyCollection || 0).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <Sparkline data={(rm as any).last7DaysTrend || []} />
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-lg font-black ${rm.netGrowth > 0 ? 'text-emerald-600' : rm.netGrowth < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                                                        {rm.netGrowth > 0 ? '+' : ''}{rm.netGrowth}
                                                    </span>
                                                    <div className="text-[10px] text-muted-foreground font-black">({rm.allotments} / {rm.submissions})</div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="font-black text-indigo-600">{rm.leads.converted} / {rm.leads.total}</span>
                                                <div className="text-[10px] text-muted-foreground font-black">({rm.leads.conversionRate}%)</div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className={`text-sm font-black ${rm.score >= 70 ? 'text-emerald-600' : rm.score >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{rm.score}</span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${rm.aiGrade === 'A' || rm.aiGrade === 'S' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{rm.aiGrade}</span>
                                                </div>
                                            </td>
                                        </motion.tr>
                                        <AnimatePresence>
                                        {expandedCO === rm.id && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.25 }}>
                                                <td colSpan={12} className="p-0 border-b-2 border-indigo-500/20">
                                                    <div className="bg-gradient-to-b from-indigo-500/5 to-transparent p-4 overflow-x-auto">
                                                        <div className="px-2 sm:px-6 py-2 pb-4">
                                                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4 flex items-center gap-2">
                                                                <Users className="h-4 w-4"/> Team Leaders under {rm.name} ({(rm as any).assignedTLs?.length || 0})
                                                            </h4>
                                                            {!(rm as any).assignedTLs?.length ? (
                                                                <p className="text-sm text-foreground/60 italic">No Team Leaders assigned.</p>
                                                            ) : (
                                                                <table className="w-full text-xs text-left min-w-[900px]">
                                                                    <thead className="bg-background/80 font-black tracking-wider text-muted-foreground">
                                                                        <tr className="border-b border-border/40">
                                                                            <th className="px-4 py-2.5">Team Leader</th>
                                                                            <th className="px-4 py-2.5 text-center">Active Riders</th>
                                                                            <th className="px-4 py-2.5 text-center">Avg/Rider</th>
                                                                            <th className="px-4 py-2.5">Wallet Health</th>
                                                                            <th className="px-4 py-2.5 text-center">Collection</th>
                                                                            <th className="px-4 py-2.5 text-center">Trend</th>
                                                                            <th className="px-4 py-2.5 text-center">Fleet Flow</th>
                                                                            <th className="px-4 py-2.5 text-center">Leads</th>
                                                                            <th className="px-4 py-2.5 text-center">AI Score</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(rm as any).assignedTLs.map((tl: any, idx: number) => (
                                                                            <motion.tr key={tl.id || idx}
                                                                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                                                                transition={{ delay: idx * 0.04 }}
                                                                                className="border-b border-border/15 last:border-0 hover:bg-indigo-500/5 transition-colors">
                                                                                <td className="px-4 py-3">
                                                                                    <div className="flex items-center gap-2.5">
                                                                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-600">{(tl.fullName || tl.full_name || 'T').charAt(0)}</div>
                                                                                        <div>
                                                                                            <p className="font-bold text-foreground text-xs">{tl.fullName || tl.full_name || 'Unknown'}</p>
                                                                                            <p className="text-[9px] text-muted-foreground/60">{tl.status === 'active' ? '🟢 Active' : '⚪ Inactive'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <span className="text-sm font-black">{tl.activeRiders}<span className="text-muted-foreground font-medium text-[10px]">/{tl.totalRiders}</span></span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-500/10 px-2 py-1 rounded-md">₹{(tl.collectionPerRider || 0).toLocaleString()}</span>
                                                                                </td>
                                                                                <td className="px-4 py-3">
                                                                                    <div className="space-y-1">
                                                                                        <div className="flex items-center gap-1">
                                                                                            <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden flex max-w-[80px]">
                                                                                                <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${tl.walletPosPercent}%` }} />
                                                                                                <div className="h-full bg-rose-500 rounded-r-full" style={{ width: `${tl.walletNegPercent}%` }} />
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex gap-2 text-[9px] font-black">
                                                                                            <span className="text-emerald-600">{tl.walletPosPercent}%</span>
                                                                                            <span className="text-rose-600">{tl.walletNegPercent}%</span>
                                                                                        </div>
                                                                                        <div className="text-[9px] text-foreground/70 font-bold">{tl.positiveWalletCount} (+₹{(tl.positiveWallet || 0).toLocaleString()}) · {tl.negativeWalletCount} (-₹{Math.abs(tl.negativeWallet || 0).toLocaleString()})</div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-3">
                                                                                    <div className="flex flex-col gap-0.5 min-w-[120px]">
                                                                                        <div className="flex items-center gap-1.5 pl-1.5 border-l-2 border-emerald-500">
                                                                                            <span className="text-[8px] text-emerald-600/70 font-black uppercase w-11">Today</span>
                                                                                            <span className="text-xs font-black text-emerald-600">₹{((tl as any).todayCollection || 0).toLocaleString()}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1.5 pl-1.5 border-l-2 border-blue-500">
                                                                                            <span className="text-[8px] text-blue-600/70 font-black uppercase w-11">Weekly</span>
                                                                                            <span className="text-xs font-black text-blue-600">₹{((tl as any).weeklyCollection || 0).toLocaleString()}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1.5 pl-1.5 border-l-2 border-violet-500">
                                                                                            <span className="text-[8px] text-violet-600/70 font-black uppercase w-11">Monthly</span>
                                                                                            <span className="text-xs font-black text-violet-600">₹{((tl as any).monthlyCollection || 0).toLocaleString()}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-3">
                                                                                    <div className="w-24 mx-auto">
                                                                                        <Sparkline data={tl.last7DaysTrend || []} />
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <span className={`text-xs font-black ${tl.netGrowth > 0 ? 'text-emerald-600' : tl.netGrowth < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                                                                                        {tl.netGrowth > 0 ? '+' : ''}{tl.netGrowth}
                                                                                    </span>
                                                                                    <span className="text-[9px] text-muted-foreground ml-1">({tl.allotments}/{tl.submissions})</span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <span className="text-xs font-bold">{tl.convertedLeads}/{tl.leadsTotal}</span>
                                                                                    <span className="text-[9px] text-muted-foreground ml-1">({tl.conversionRate}%)</span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                                        <span className={`text-xs font-black ${tl.score >= 70 ? 'text-emerald-600' : tl.score >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{tl.score}</span>
                                                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${tl.aiGrade === 'A' || tl.aiGrade === 'S' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>{tl.aiGrade}</span>
                                                                                    </div>
                                                                                </td>
                                                                            </motion.tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )}
                                        </AnimatePresence>
                                    </React.Fragment>
                                ))}
                            </tbody>
                            <tfoot className="bg-muted/30 border-t-2 border-border/80 text-sm">
                                <tr>
                                    <td className="px-5 py-4"></td>
                                    <td className="px-5 py-4 font-black text-foreground">GRAND TOTALS</td>
                                    <td className="px-5 py-4 text-center font-black">{tActTLs} / {tTLs}</td>
                                    <td className="px-5 py-4 text-center font-black">{tActRiders} / {tTotRiders}</td>
                                    <td className="px-5 py-4 text-center font-black text-orange-600">{Math.round(tAvgTenure)} d</td>
                                    <td className="px-5 py-4 text-center font-black text-indigo-600">₹{tTotPerRiderAvg.toLocaleString()}</td>
                                    <td className="px-5 py-4 font-black">
                                        <div className="space-y-1.5 min-w-[140px]">
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden flex">
                                                    <div className="h-full bg-emerald-500 rounded-l-full transition-all" style={{ width: `${tPosPct}%` }} />
                                                    <div className="h-full bg-rose-500 rounded-r-full transition-all" style={{ width: `${tNegPct}%` }} />
                                                </div>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-black">
                                                <span className="text-emerald-600">{tPosPct}% Pos</span>
                                                <span className="text-rose-600">{tNegPct}% Neg</span>
                                            </div>
                                            <div className="text-[10px] text-foreground/80 font-bold flex flex-col gap-0.5 mt-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-emerald-600/80">{tPosCount} Riders</span>
                                                    <span className="text-emerald-600">+₹{tPosAmt.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-rose-600/80">{tNegCount} Riders</span>
                                                    <span className="text-rose-600">-₹{tNegAmt.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 font-black">
                                        <div className="flex flex-col gap-0.5 min-w-[150px]">
                                            <div className="flex items-center gap-2 pl-2 border-l-2 border-emerald-500">
                                                <span className="text-[9px] text-emerald-600/70 font-black uppercase w-14">Today</span>
                                                <span className="text-sm font-black text-emerald-600">₹{tTodayCol.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 pl-2 border-l-2 border-blue-500">
                                                <span className="text-[9px] text-blue-600/70 font-black uppercase w-14">Weekly</span>
                                                <span className="text-sm font-black text-blue-600">₹{tWeeklyCol.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 pl-2 border-l-2 border-violet-500">
                                                <span className="text-[9px] text-violet-600/70 font-black uppercase w-14">Monthly</span>
                                                <span className="text-sm font-black text-violet-600">₹{tMonthlyCol.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <Sparkline data={t7DTrend} />
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-lg font-black ${tNet > 0 ? 'text-emerald-600' : tNet < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                                                {tNet > 0 ? '+' : ''}{tNet}
                                            </span>
                                            <div className="text-[10px] text-muted-foreground font-black">({tAllots} / {tSubs})</div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <span className="font-black text-indigo-600">{tCnv} / {tLds}</span>
                                        <div className="text-[10px] text-muted-foreground font-black">({tCnvPct}%)</div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className={`text-sm font-black ${avgAIScore >= 70 ? 'text-emerald-600' : avgAIScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{avgAIScore}</span>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${avgGrade === 'A' || avgGrade === 'S' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{avgGrade}</span>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CityOpsPerformance;
