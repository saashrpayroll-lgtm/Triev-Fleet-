import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import {
    Download, Search, TrendingUp, Users, Activity,
    Calendar, ChevronDown, SearchX, Wallet, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateAIScore, PerformancePeriod } from '@/utils/performance';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';

const RMPerformance: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<{
        riders: any[];
        leads: any[];
        teamLeaders: any[];
        rms: any[];
        collections: any[];
        dailyCollectionsMap?: Record<string, number>;
        weeklyCollectionsMap?: Record<string, number>;
    }>({ riders: [], leads: [], teamLeaders: [], rms: [], collections: [] });

    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'rangeCollection', direction: 'desc' });

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

            const [ridersRes, leadsRes, usersRes, rmsRes, dailyRes, todayLedgerRes] = await Promise.all([
                fetchAllRidersPaginated('*'),
                supabase.from('leads').select('*'),
                supabase.from('users').select('*').in('role', ['teamLeader']),
                supabase.from('users').select('*').eq('role', 'reportingManager'),
                supabase.from('daily_collections').select('*').order('date', { ascending: false }).limit(10000),
                supabase.from('wallet_ledger').select(`amount, rider: riders!inner(team_leader_id)`)
                    .eq('mode', 'ADD')
                    .in('transaction_type', ['DAILY_COLLECTION', 'DAILY COLLECTION', 'RENT_COLLECTION', 'RENT COLLECTION', 'FTD_COLLECTION', 'FTD COLLECTION', 'COLLECTION', 'RENT'])
                    .or(`and(transaction_date.gte.${midnightIST}, transaction_date.lte.${endOfDayIST}), and(transaction_date.is.null, created_at.gte.${midnightIST})`)
            ]);

            if (ridersRes.error) throw ridersRes.error;
            if (leadsRes.error) throw leadsRes.error;
            if (usersRes.error) throw usersRes.error;
            if (rmsRes.error) throw rmsRes.error;
            if (dailyRes.error) throw dailyRes.error;
            if (todayLedgerRes.error) throw todayLedgerRes.error;

            const weekly: Record<string, number> = {};
            dailyRes.data?.forEach(item => {
                const tlId = item.team_leader_id;
                const amt = Number(item.total_collection) || 0;
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                if (dDateStr >= weekStartStr) {
                    weekly[tlId] = (weekly[tlId] || 0) + amt;
                }
            });

            const daily: Record<string, number> = {};
            const tlsWithTodaySnapshot = new Set<string>();
            dailyRes.data?.forEach(item => {
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                if (dDateStr === todayStr) {
                    tlsWithTodaySnapshot.add(item.team_leader_id);
                    daily[item.team_leader_id] = (daily[item.team_leader_id] || 0) + (Number(item.total_collection) || 0);
                }
            });

            const todayLedger = (todayLedgerRes?.data as any[]) || [];
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
                riders: (ridersRes.data || []).map((r: any) => ({
                    ...r,
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
                rms: (rmsRes.data || []).map((u: any) => ({
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
        let ledgerDebounce: ReturnType<typeof setTimeout> | null = null;
        const fetchDebounced = () => {
            if (ledgerDebounce) clearTimeout(ledgerDebounce);
            ledgerDebounce = setTimeout(() => fetchData(), 1000);
        };

        const channels = [
            supabase.channel('rm-perf-riders').on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchData).subscribe(),
            supabase.channel('rm-perf-leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData).subscribe(),
            supabase.channel('rm-perf-collections').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_collections' }, fetchData).subscribe(),
            supabase.channel('rm-perf-ledger').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, fetchDebounced).subscribe(),
        ];

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, []);

    const performanceData = useMemo(() => {
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        const now = new Date();
        const nowISTStr = formatter.format(now);
        const [year, month, day] = nowISTStr.split('-').map(Number);
        
        // Month boundaries & Week bounds
        const workingDateUTC = new Date(Date.UTC(year, month - 1, day));
        let startDateStr = nowISTStr;
        let endDateStr = nowISTStr;

        if (dateFilter === 'yesterday') {
            const yesterdayUTC = new Date(Date.UTC(year, month - 1, day - 1));
            startDateStr = yesterdayUTC.toISOString().split('T')[0];
            endDateStr = startDateStr;
        } else if (dateFilter === 'week') {
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
        const monthStartStr = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
        const monthEndStr = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

        // Days in current week elapsed (Mon=1 … Sun=7)
        const weekDayIST = (() => {
            const d = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
            return d === 0 ? 7 : d;
        })();
        const daysInPeriod = dateFilter === 'today' || dateFilter === 'yesterday' ? 1 : dateFilter === 'week' ? weekDayIST : dateFilter === 'month' ? day : Math.max(1, Math.ceil((new Date(endDateStr).getTime() - new Date(startDateStr).getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // Map Team Leaders
        const tlMetrics = rawData.teamLeaders.map(tl => {
            const tlId = tl.id;
            const targetEndDate = endDateStr === nowISTStr ? nowISTStr : endDateStr;
            const tlCollection = (dateFilter === 'today' ? (rawData as any).dailyCollectionsMap?.[tlId] : undefined) ??
                rawData.collections.filter(item => {
                    const isTL = item.team_leader_id === tlId;
                    if (!isTL) return false;
                    const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                    return dDateStr >= startDateStr && dDateStr <= endDateStr;
                }).reduce((sum, item) => sum + (Number(item.total_collection) || 0), 0);
            const collectionSnapshot = rawData.collections.find(item => {
                const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                return item.team_leader_id === tlId && dDateStr === targetEndDate;
            });
            const historicalFleet = (targetEndDate < nowISTStr && collectionSnapshot && Number(collectionSnapshot.active_riders_count) > 0)
                ? Number(collectionSnapshot.active_riders_count)
                : undefined;

            const tlRiders = rawData.riders.filter(r => (r.team_leader_id === tlId || r.teamLeaderId === tlId));
            const tlLeads = rawData.leads.filter(l => l.created_by === tlId || l.createdBy === tlId);

            const metrics = calculateAIScore(tl, rawData.riders, rawData.leads, tlCollection, period, historicalFleet);

            const lastLeadTime = tlLeads.length > 0 ? Math.max(...tlLeads.map(l => new Date(l.created_at || l.createdAt).getTime())) : 0;
            const lastRiderUpdate = tlRiders.length > 0 ? Math.max(...tlRiders.map(r => new Date(r.updated_at || r.updatedAt || r.created_at || r.createdAt).getTime())) : 0;
            const activityTime = Math.max(lastLeadTime, lastRiderUpdate);
            const lastActivity = activityTime > 0 ? new Date(activityTime).toISOString() : undefined;

            const monthlyCollection = rawData.collections
                .filter((item: any) => {
                    if (item.team_leader_id !== tlId) return false;
                    const dDateStr = item.date && typeof item.date === 'string' ? item.date.split('T')[0].split(' ')[0] : item.date;
                    return dDateStr >= monthStartStr && dDateStr <= monthEndStr;
                })
                .reduce((sum: number, item: any) => sum + (Number(item.total_collection) || 0), 0);

            const grandTotal = rawData.collections
                .filter((item: any) => item.team_leader_id === tlId)
                .reduce((sum: number, item: any) => sum + (Number(item.total_collection) || 0), 0);
            
            return {
                ...tl,
                ...metrics,
                lastActivity,
                monthlyCollection,
                grandTotal
            };
        });

        // Get unique RMs from TLs reporting_manager field or actual RMs list
        const rmNamesSet = new Set<string>();
        rawData.teamLeaders.forEach(tl => {
            const rmName = (tl.reporting_manager || '').trim();
            if (rmName) rmNamesSet.add(rmName);
        });
        rawData.rms.forEach(rm => rmNamesSet.add((rm.fullName || '').trim()));

        return Array.from(rmNamesSet).filter(rmName => rmName !== '').map(rmName => {
            const assignedTLs = tlMetrics.filter(tl => (tl.reporting_manager || '').trim() === rmName);
            
            const totalTLs = assignedTLs.length;
            const activeTLs = assignedTLs.filter(tl => tl.status === 'active').length;
            
            const activeRiders = assignedTLs.reduce((sum, tl) => sum + tl.activeRiders, 0);
            const totalRiders = assignedTLs.reduce((sum, tl) => sum + tl.totalRiders, 0);
            const inactiveRiders = totalRiders - activeRiders;
            
            const positiveWalletCount = assignedTLs.reduce((sum, tl) => sum + tl.positiveWalletCount, 0);
            const positiveWallet = assignedTLs.reduce((sum, tl) => sum + tl.positiveWallet, 0);
            const negativeWalletCount = assignedTLs.reduce((sum, tl) => sum + tl.negativeWalletCount, 0);
            const negativeWallet = assignedTLs.reduce((sum, tl) => sum + tl.negativeWallet, 0);

            const leadsTotal = assignedTLs.reduce((sum, tl) => sum + tl.leadsTotal, 0);
            const convertedLeads = assignedTLs.reduce((sum, tl) => sum + tl.convertedLeads, 0);
            const conversionRate = leadsTotal > 0 ? Math.round((convertedLeads / leadsTotal) * 100) : 0;
            const churnLeads = leadsTotal - convertedLeads;

            const allotments = assignedTLs.reduce((sum, tl) => sum + tl.allotments, 0);
            const submissions = assignedTLs.reduce((sum, tl) => sum + tl.submissions, 0);
            const netGrowth = assignedTLs.reduce((sum, tl) => sum + tl.netGrowth, 0);

            const rangeCollection = assignedTLs.reduce((sum, tl) => sum + tl.collection, 0);
            const monthlyCollection = assignedTLs.reduce((sum, tl) => sum + tl.monthlyCollection, 0);
            const grandTotal = assignedTLs.reduce((sum, tl) => sum + tl.grandTotal, 0);

            const periodDayAvg = daysInPeriod > 0 ? Math.round(rangeCollection / daysInPeriod) : 0;
            const periodPerRiderAvg = activeRiders > 0 ? Math.round(rangeCollection / activeRiders) : 0;
            const score = totalTLs > 0 ? Math.round(assignedTLs.reduce((sum, tl) => sum + tl.score, 0) / totalTLs) : 0;
            const aiGrade = score >= 90 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'F';

            const lastActivityTimes = assignedTLs.map(tl => tl.lastActivity ? new Date(tl.lastActivity).getTime() : 0);
            const maxActivityTime = Math.max(...lastActivityTimes, 0);
            const lastActivity = maxActivityTime > 0 ? new Date(maxActivityTime).toISOString() : undefined;

            return {
                id: rmName,
                name: rmName,
                totalTLs,
                activeTLs,
                totalRiders,
                activeRiders,
                inactiveRiders,
                wallet: {
                    total: positiveWallet + negativeWallet,
                    positiveCount: positiveWalletCount,
                    positiveAmount: positiveWallet,
                    negativeCount: negativeWalletCount,
                    negativeAmount: negativeWallet
                },
                leads: {
                    total: leadsTotal,
                    converted: convertedLeads,
                    conversionRate
                },
                allotments,
                submissions,
                netGrowth,
                rangeCollection,
                monthlyCollection,
                totalCollection: grandTotal,
                periodCollection: rangeCollection,
                periodDayAvg,
                periodPerRiderAvg,
                score,
                aiGrade,
                leadsToday: leadsTotal,
                churnLeads: churnLeads,
                status: activeTLs > 0 ? 'active' : 'inactive',
                lastActivity,
                daysInPeriod
            };
        });

    }, [rawData, dateFilter, customDateRange]);

    const filteredData = useMemo(() => {
        let data = performanceData.filter(rm => {
            const matchesSearch = rm.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });

        if (sortConfig) {
            data.sort((a: any, b: any) => {
                let aValue: any;
                let bValue: any;

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
    }, [performanceData, searchTerm, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const exportToExcel = () => {
        const data = filteredData.map(rm => ({
            'Reporting Manager': rm.name,
            'Total TLs': rm.totalTLs,
            'Active TLs': rm.activeTLs,
            'Active Riders': rm.activeRiders,
            'Total Riders': rm.totalRiders,
            'Positive Riders': rm.wallet.positiveCount,
            'Positive Amount': rm.wallet.positiveAmount,
            'Negative Riders': rm.wallet.negativeCount,
            'Negative Amount': Math.abs(rm.wallet.negativeAmount),
            'Period Collection': rm.periodCollection,
            'Period Day Avg': rm.periodDayAvg,
            'Period Rider Avg': rm.periodPerRiderAvg,
            'Grand Total': rm.totalCollection,
            'Fleet Flow (A/S/N)': `${rm.allotments}/${rm.submissions}/${rm.netGrowth}`,
            'Net Growth': rm.netGrowth,
            'Leads Sourced': rm.leads.total,
            'Leads Converted': rm.leads.converted,
            'Conversion Rate': rm.leads.conversionRate + '%',
            'Avg AI Score': rm.score,
            'AI Grade': rm.aiGrade,
            'Status': rm.status,
        }));

        data.push({
            'Reporting Manager': 'TOTALS',
            'Total TLs': filteredData.reduce((s, t) => s + t.totalTLs, 0),
            'Active TLs': filteredData.reduce((s, t) => s + t.activeTLs, 0),
            'Active Riders': filteredData.reduce((s, t) => s + t.activeRiders, 0),
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
            'Leads Sourced': filteredData.reduce((s, t) => s + t.leads.total, 0),
            'Leads Converted': filteredData.reduce((s, t) => s + t.leads.converted, 0),
            'Conversion Rate': '',
            'Avg AI Score': 0 as any,
            'AI Grade': '' as any,
            'Status': '' as any,
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "RM Performance");
        XLSX.writeFile(wb, `rm_performance_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel report exported successfully');
        setIsExportOpen(false);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229); 
        doc.text('Reporting Manager Performance Report', 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()} `, 14, 28);

        const tableColumn = [
            "Reporting Mgr", "TLs", "Riders", "Period Coll.", "Day Avg", "Rider Avg",
            "Pos/Neg", "Risk Amt", "A/S/N", "Leads", "Conv %", "Score"
        ];

        const tableRows = filteredData.map(rm => [
            rm.name,
            rm.totalTLs,
            `${rm.activeRiders}/${rm.totalRiders}`,
            `INR ${rm.periodCollection.toLocaleString()}`,
            `INR ${rm.periodDayAvg.toLocaleString()}`,
            `INR ${rm.periodPerRiderAvg.toLocaleString()}`,
            `${rm.wallet.positiveCount}/${rm.wallet.negativeCount}`,
            `INR ${Math.abs(rm.wallet.negativeAmount).toLocaleString()}`,
            `${rm.allotments}/${rm.submissions}/${rm.netGrowth}`,
            `${rm.leads.converted}/${rm.leads.total}`,
            `${rm.leads.conversionRate}%`,
            `${rm.score} (${rm.aiGrade})`
        ]);

        autoTable(doc, {
            head: [tableColumn], body: tableRows, startY: 35, theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, cellPadding: 3 },
            alternateRowStyles: { fillColor: [249, 250, 251] }
        });

        doc.save(`rm_performance_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('PDF report exported successfully');
        setIsExportOpen(false);
    };

    const avgAIScore = useMemo(() => performanceData.length > 0 ? Math.round(performanceData.reduce((s, t) => s + t.score, 0) / performanceData.length) : 0, [performanceData]);
    const avgGrade = avgAIScore >= 90 ? 'S' : avgAIScore >= 70 ? 'A' : avgAIScore >= 50 ? 'B' : avgAIScore >= 30 ? 'C' : 'F';
    const totalMonthlyCollection = useMemo(() => performanceData.reduce((s, t) => s + t.monthlyCollection, 0), [performanceData]);

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
                                <h1 className="text-2xl md:text-3xl font-black tracking-tight">RM Performance Center</h1>
                                <p className="text-sm text-white/50 font-medium">Reporting Manager hierarchy aggregation & analysis</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10">
                                {performanceData.length} Reporting Managers
                            </span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/20">
                                {performanceData.reduce((a, b) => a + b.activeTLs, 0)} Active TLs
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
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            <Activity className="h-3 w-3 animate-pulse" /> Live Sync
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: `${dateFilter === 'today' ? "Today's" : dateFilter === 'yesterday' ? "Yesterday's" : dateFilter === 'week' ? 'Weekly' : dateFilter === 'month' ? 'Monthly' : 'Range'} Collection`, value: `₹${performanceData.reduce((a, b) => a + b.rangeCollection, 0).toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
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
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-card border border-border/40 rounded-2xl shadow-xl">
                    <div className="p-6 border-b border-border/40 bg-muted/20">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h2 className="text-lg font-bold">Reporting Manager Analysis</h2>
                            </div>
                            <div className="flex items-center gap-2 relative">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-2 relative w-full md:w-auto">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hidden md:block" />
                                    <input
                                        placeholder="Search RM Name..."
                                        className="w-full md:w-64 pl-4 md:pl-9 pr-4 py-2 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    <div className="relative flex-1 md:flex-none">
                                        <select
                                            value={dateFilter}
                                            onChange={(e: any) => setDateFilter(e.target.value)}
                                            className="w-full md:w-auto pl-9 pr-8 py-2 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none shadow-sm font-medium text-primary"
                                        >
                                            <option value="today">Today Metrics</option>
                                            <option value="yesterday">Yesterday's Metrics</option>
                                            <option value="week">Weekly Metrics</option>
                                            <option value="month">Monthly Metrics</option>
                                            <option value="custom">Custom Date Range</option>
                                        </select>
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 pointer-events-none" />
                                    </div>
                                    {dateFilter === 'custom' && (
                                        <div className="flex items-center gap-2 bg-background border border-border/60 rounded-xl p-1 shadow-sm">
                                            <input type="date" className="text-xs py-1 px-2 focus:outline-none bg-transparent rounded" value={customDateRange.start} onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })} />
                                            <span className="text-muted-foreground text-xs font-bold">-</span>
                                            <input type="date" className="text-xs py-1 px-2 focus:outline-none bg-transparent rounded" value={customDateRange.end} onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1500px] text-sm text-left">
                            <thead className="text-[10px] text-muted-foreground uppercase bg-muted/10 font-black tracking-widest border-b border-border/40">
                                <tr>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">Reporting Manager {sortConfig?.key === 'name' && <ChevronDown className="h-3 w-3 rotate-180" />}</div>
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30 text-center" onClick={() => handleSort('totalTLs')}>
                                        <div className="flex items-center justify-center gap-1">TLs (Act/Tot) {sortConfig?.key === 'totalTLs' && <ChevronDown className="h-3 w-3" />}</div>
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30 text-center" onClick={() => handleSort('activeRiders')}>
                                        <div className="flex items-center justify-center gap-1">Riders {sortConfig?.key === 'activeRiders' && <ChevronDown className="h-3 w-3" />}</div>
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30" onClick={() => handleSort('walletHealth')}>
                                        <div className="flex items-center gap-1">Wallet Health {sortConfig?.key === 'walletHealth' && <ChevronDown className="h-3 w-3" />}</div>
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30" onClick={() => handleSort('rangeCollection')}>
                                        <div className="flex items-center gap-1">Collection {sortConfig?.key === 'rangeCollection' && <ChevronDown className="h-3 w-3" />}</div>
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30" onClick={() => handleSort('periodCollection')}>
                                      <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1 text-violet-600">Period</div>
                                      </div>
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30" onClick={() => handleSort('netGrowth')}>
                                        <div className="flex items-center gap-1">Fleet Flow {sortConfig?.key === 'netGrowth' && <ChevronDown className="h-3 w-3" />}</div>
                                    </th>
                                    <th className="px-5 py-4 cursor-pointer hover:bg-muted/30 text-center" onClick={() => handleSort('conversion')}>
                                        <div className="flex items-center justify-center gap-1">Leads % {sortConfig?.key === 'conversion' && <ChevronDown className="h-3 w-3" />}</div>
                                    </th>
                                    <th className="px-4 py-4 cursor-pointer text-center" onClick={() => handleSort('score')}>
                                        <div className="flex justify-center text-indigo-600">Score</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {loading ? (
                                    Array(4).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse"><td colSpan={9} className="px-6 py-8"><div className="h-8 bg-muted/40 rounded-lg w-full"></div></td></tr>
                                    ))
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-4">
                                                <div className="p-4 bg-muted/30 rounded-full"><SearchX className="h-10 w-10 text-muted-foreground/40" /></div>
                                                <p className="font-bold text-muted-foreground text-xl">No Results Found</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((rm) => (
                                        <tr key={rm.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors border-b border-border/20 last:border-0">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-600">
                                                        {rm.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-foreground text-sm truncate">{rm.name}</p>
                                                        {rm.leadsToday > 10 && <span className="px-1 py-0.5 bg-orange-500 rounded text-[8px] text-white font-black mt-1 inline-block">HOT</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-base font-black text-foreground">{rm.activeTLs} <span className="text-xs text-muted-foreground">/ {rm.totalTLs}</span></span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-base font-black text-foreground">{rm.activeRiders} <span className="text-xs text-muted-foreground">/ {rm.totalRiders}</span></span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-2">
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-black">{rm.wallet.positiveCount} POS</span>
                                                        <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[10px] font-black">{rm.wallet.negativeCount} NEG</span>
                                                    </div>
                                                    <div className="flex gap-4 text-[11px] font-bold">
                                                        <span className="text-emerald-600">₹{rm.wallet.positiveAmount.toLocaleString()}</span>
                                                        <span className="text-rose-600">₹{Math.abs(rm.wallet.negativeAmount).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col border-r pr-4 border-border/40">
                                                    <span className="text-[9px] text-muted-foreground font-black uppercase">Period Vol.</span>
                                                    <span className="text-base font-black text-emerald-600">₹{rm.periodCollection.toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col border-r pr-3 border-violet-500/20">
                                                    <span className="text-[9px] text-violet-400 font-black uppercase">Period Total</span>
                                                    <span className="text-base font-black text-violet-600">₹{rm.periodCollection.toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col border-r pr-4 border-border/40">
                                                        <span className="text-[9px] text-muted-foreground font-black uppercase">Net Growth</span>
                                                        <span className={`text-xl font-black ${rm.netGrowth > 0 ? 'text-emerald-600' : rm.netGrowth < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                                                            {rm.netGrowth > 0 ? '+' : ''}{rm.netGrowth}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between gap-3 text-[9px]"><span className="text-muted-foreground font-black uppercase">Allotment</span><span className="text-indigo-600 font-black">+{rm.allotments}</span></div>
                                                        <div className="flex items-center justify-between gap-3 text-[9px]"><span className="text-muted-foreground font-black uppercase">Submission</span><span className="text-rose-500 font-black">-{rm.submissions}</span></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black">{rm.leads.conversionRate}%</span>
                                                    <div className="space-y-1 text-[10px]">
                                                        <div className="flex gap-2"><span>Sourced</span><span className="text-indigo-600 font-black">+{rm.leads.total}</span></div>
                                                        <div className="flex gap-2"><span>Churned</span><span className="text-rose-500 font-black">-{rm.churnLeads}</span></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className={`text-sm font-black ${rm.score >= 70 ? 'text-emerald-600' : rm.score >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{rm.score}</span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${rm.aiGrade === 'A' || rm.aiGrade === 'S' ? 'bg-emerald-100 text-emerald-700' : rm.aiGrade === 'B' ? 'bg-blue-100 text-blue-700' : rm.aiGrade === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{rm.aiGrade}</span>
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
        </div>
    );
};

export default RMPerformance;
