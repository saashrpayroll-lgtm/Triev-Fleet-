import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, FileSpreadsheet, FileText, 
    RefreshCw, Filter, Sparkles, AlertTriangle, ShieldCheck,
    Users, Eye, Calendar, ArrowUpDown
} from 'lucide-react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Rider, TLRiskMatrixRow, TLRiskMatrixSummary } from '@/types';
import GlassCard from '@/components/GlassCard';
import RiderDetailsModal from '@/components/RiderDetailsModal';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';

export interface TLRiskWalletMatrixProps {
    className?: string;
}

const TLRiskWalletMatrix: React.FC<TLRiskWalletMatrixProps> = ({ className = '' }) => {
    const { userData } = useSupabaseAuth();
    const isAdmin = userData?.role === 'admin';

    // Data States
    const [riders, setRiders] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [snapshots, setSnapshots] = useState<any[]>([]);

    // Filter & Search States
    const [selectedCityOps, setSelectedCityOps] = useState<string>('all');
    const [selectedRM, setSelectedRM] = useState<string>('all');
    const [selectedTL, setSelectedTL] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedWeek, setSelectedWeek] = useState<string>('current');

    // Admin-Only Exclusion Toggles (Default: All Active Exclusions Enabled)
    const [excludeNewAllotments, setExcludeNewAllotments] = useState<boolean>(true);
    const [excludeStolen, setExcludeStolen] = useState<boolean>(true);
    const [excludeCompanyTagged, setExcludeCompanyTagged] = useState<boolean>(true);

    // Modal States for Rider Drill-Down
    const [selectedCellRiders, setSelectedCellRiders] = useState<Rider[] | null>(null);
    const [cellModalTitle, setCellModalTitle] = useState<string>('');
    const [detailRider, setDetailRider] = useState<Rider | null>(null);

    // Sort State
    const [sortField, setSortField] = useState<'negativePct' | 'range0To250Pct' | 'activeRiders' | 'tlName'>('negativePct');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Fetch Live Riders & Snapshots
    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all active riders with paginated helper (beyond 1000 limit)
            const { data: ridersData, error: ridersErr } = await fetchAllRidersPaginated('*', { column: 'status', value: 'active' });
            if (ridersErr) throw ridersErr;

            // 2. Fetch users table to map TL ID -> TL Name, RM Name, City Ops Name
            const { data: usersData, error: usersErr } = await fetchTablePaginated('users', 'id, full_name, email, role, reporting_manager, city_ops_id, status');
            if (!usersErr && usersData) {
                setUsers(usersData);
            }

            setRiders(ridersData || []);

            // Synchronize drill-down list and inspect rider modal with fresh fetched DB data
            if (ridersData && ridersData.length > 0) {
                const freshMap = new Map<string, any>(ridersData.map((rd: any) => [rd.id, rd]));

                setSelectedCellRiders(prevList => {
                    if (!prevList) return null;
                    return prevList.map(oldR => {
                        const fresh = freshMap.get(oldR.id);
                        if (!fresh) return oldR;
                        const isStolenVal = Boolean(fresh.is_stolen || fresh.isStolen);
                        const isCompVal = Boolean(fresh.is_company_tagged || fresh.isCompanyTagged);
                        return {
                            ...oldR,
                            isStolen: isStolenVal,
                            isCompanyTagged: isCompVal,
                            walletAmount: Number(fresh.wallet_amount ?? fresh.walletAmount ?? oldR.walletAmount)
                        };
                    });
                });

                setDetailRider(prevDetail => {
                    if (!prevDetail) return null;
                    const fresh = freshMap.get(prevDetail.id);
                    if (!fresh) return prevDetail;
                    const isStolenVal = Boolean(fresh.is_stolen || fresh.isStolen);
                    const isCompVal = Boolean(fresh.is_company_tagged || fresh.isCompanyTagged);
                    return {
                        ...prevDetail,
                        isStolen: isStolenVal,
                        isCompanyTagged: isCompVal,
                        walletAmount: Number(fresh.wallet_amount ?? fresh.walletAmount ?? prevDetail.walletAmount)
                    };
                });
            }

            // 3. Fetch daily snapshots for 5-week historical view
            const { data: snapshotsData, error: snapErr } = await supabase
                .from('matrix_daily_snapshots')
                .select('*')
                .order('snapshot_date', { ascending: false })
                .limit(500);

            if (!snapErr && snapshotsData) {
                setSnapshots(snapshotsData);
            }
        } catch (err: any) {
            console.error("Failed to load matrix data:", err);
            toast.error("Failed to load TL Risk Matrix data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Create User Lookup Map
    const userMap = useMemo(() => {
        const map = new Map<string, any>();
        users.forEach(u => {
            if (u.id) map.set(u.id, u);
        });
        return map;
    }, [users]);

    // Enrich Riders with Resolved Hierarchy & Wallet Amount
    const enrichedRiders = useMemo(() => {
        return riders.map(r => {
            const walletAmount = Number(r.wallet_amount ?? r.walletAmount ?? r.wallet_balance ?? 0);
            
            const tlId = r.team_leader_id || r.teamLeaderId;
            const tlUser = tlId ? userMap.get(tlId) : null;
            const tlName = (r.team_leader_name || r.team_leader || r.teamLeaderName || tlUser?.full_name || tlUser?.email || 'Unassigned TL').trim();

            const rmName = (r.reporting_manager || r.rm_name || r.reportingManager || tlUser?.reporting_manager || 'Saunvir Singh').trim();
            const cityOpsName = (r.skip_manager || r.city_ops_name || r.cityOps || 'Danish Abdulla khan').trim();

            const isStolen = Boolean(r.is_stolen || r.isStolen);
            const isCompanyTagged = Boolean(r.is_company_tagged || r.isCompanyTagged);

            return {
                ...r,
                walletAmount,
                tlName,
                rmName,
                cityOpsName,
                isStolen,
                isCompanyTagged
            };
        });
    }, [riders, userMap]);

    // Calculate Today IST & Yesterday IST for New Allotment Filter
    const isNewAllotment = (allotmentDateStr?: string) => {
        if (!allotmentDateStr) return false;
        try {
            const allotmentDate = new Date(allotmentDateStr).getTime();
            const now = new Date().getTime();
            const diffHours = (now - allotmentDate) / (1000 * 60 * 60);
            return diffHours >= 0 && diffHours <= 36;
        } catch {
            return false;
        }
    };

    // Filter Raw Riders based on Admin Exclusions
    const filteredRiders = useMemo(() => {
        return enrichedRiders.filter(r => {
            if (excludeNewAllotments && isNewAllotment(r.allotment_date || r.allotmentDate)) {
                return false;
            }
            if (excludeStolen && (r.is_stolen || r.isStolen)) {
                return false;
            }
            if (excludeCompanyTagged && (r.is_company_tagged || r.isCompanyTagged)) {
                return false;
            }
            return true;
        });
    }, [enrichedRiders, excludeNewAllotments, excludeStolen, excludeCompanyTagged]);

    // Build Live Matrix Rows
    const matrixRows: TLRiskMatrixRow[] = useMemo(() => {
        if (selectedWeek !== 'current' && snapshots.length > 0) {
            const targetWeekOffset = parseInt(selectedWeek.replace('week-', ''), 10) || 1;
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - (targetWeekOffset * 7));
            const targetDateStr = targetDate.toISOString().split('T')[0];

            const weekSnapshots = snapshots.filter(s => s.snapshot_date <= targetDateStr);
            const latestDate = weekSnapshots[0]?.snapshot_date;
            const targetDaySnaps = snapshots.filter(s => s.snapshot_date === latestDate);

            return targetDaySnaps.map(s => ({
                cityOpsName: s.city_ops_name || 'Danish Abdulla khan',
                rmName: s.rm_name || 'Saunvir Singh',
                tlName: s.tl_name || 'Unassigned TL',
                activeRiders: s.active_riders || 0,
                negativeCount: s.negative_count || 0,
                range0To250Count: s.range_0_250_count || 0,
                negativePct: Number(s.negative_pct || 0),
                range0To250Pct: Number(s.range_0_250_pct || 0)
            }));
        }

        const map = new Map<string, {
            cityOpsName: string;
            rmName: string;
            tlName: string;
            matchingRiders: any[];
        }>();

        // 1. Seed with active Team Leaders from users table so all assigned TLs are visible
        users.forEach(u => {
            if (u.role === 'teamLeader' && (u.status === 'active' || u.status === undefined)) {
                const tlName = (u.full_name || u.email || '').trim();
                const rmName = (u.reporting_manager || 'Saunvir Singh').trim();
                const cityOpsName = 'Danish Abdulla khan';
                if (tlName) {
                    const key = `${cityOpsName}___${rmName}___${tlName}`;
                    map.set(key, { cityOpsName, rmName, tlName, matchingRiders: [] });
                }
            }
        });

        // 2. Group riders into matching TL key
        filteredRiders.forEach(r => {
            const cityOpsName = r.cityOpsName || 'Danish Abdulla khan';
            const rmName = r.rmName || 'Saunvir Singh';
            const tlName = r.tlName || 'Unassigned TL';
            const key = `${cityOpsName}___${rmName}___${tlName}`;

            if (!map.has(key)) {
                map.set(key, { cityOpsName, rmName, tlName, matchingRiders: [] });
            }
            map.get(key)!.matchingRiders.push(r);
        });

        const rows: TLRiskMatrixRow[] = [];
        map.forEach(group => {
            const activeRiders = group.matchingRiders.length;
            const negRiders = group.matchingRiders.filter(r => r.walletAmount < 0);
            const rangeRiders = group.matchingRiders.filter(r => r.walletAmount >= -250 && r.walletAmount < 0);

            const negativeCount = negRiders.length;
            const range0To250Count = rangeRiders.length;
            const negativePct = activeRiders > 0 ? Number(((negativeCount / activeRiders) * 100).toFixed(2)) : 0;
            const range0To250Pct = activeRiders > 0 ? Number(((range0To250Count / activeRiders) * 100).toFixed(2)) : 0;

            rows.push({
                cityOpsName: group.cityOpsName,
                rmName: group.rmName,
                tlName: group.tlName,
                activeRiders,
                negativeCount,
                range0To250Count,
                negativePct,
                range0To250Pct
            });
        });

        return rows;
    }, [filteredRiders, selectedWeek, snapshots, users]);

    // Unique Dropdown Options derived directly from matrix rows
    const cityOpsOptions = useMemo(() => {
        const set = new Set<string>();
        matrixRows.forEach(r => {
            if (r.cityOpsName && r.cityOpsName.trim()) set.add(r.cityOpsName.trim());
        });
        return Array.from(set).sort();
    }, [matrixRows]);

    const rmOptions = useMemo(() => {
        const set = new Set<string>();
        matrixRows.forEach(r => {
            if (selectedCityOps !== 'all' && r.cityOpsName !== selectedCityOps) return;
            if (r.rmName && r.rmName.trim()) set.add(r.rmName.trim());
        });
        return Array.from(set).sort();
    }, [matrixRows, selectedCityOps]);

    const tlOptions = useMemo(() => {
        const set = new Set<string>();
        matrixRows.forEach(r => {
            if (selectedCityOps !== 'all' && r.cityOpsName !== selectedCityOps) return;
            if (selectedRM !== 'all' && r.rmName !== selectedRM) return;
            if (r.tlName && r.tlName.trim()) set.add(r.tlName.trim());
        });
        return Array.from(set).sort();
    }, [matrixRows, selectedCityOps, selectedRM]);

    // Apply Filter Dropdowns & Search Query
    const displayedRows = useMemo(() => {
        return matrixRows.filter(row => {
            if (selectedCityOps !== 'all' && row.cityOpsName !== selectedCityOps) return false;
            if (selectedRM !== 'all' && row.rmName !== selectedRM) return false;
            if (selectedTL !== 'all' && row.tlName !== selectedTL) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = row.tlName.toLowerCase().includes(q) ||
                                  row.rmName.toLowerCase().includes(q) ||
                                  row.cityOpsName.toLowerCase().includes(q);
                if (!matchName) return false;
            }
            return true;
        }).sort((a, b) => {
            const factor = sortDirection === 'asc' ? 1 : -1;
            if (sortField === 'tlName') return a.tlName.localeCompare(b.tlName) * factor;
            return (a[sortField] - b[sortField]) * factor;
        });
    }, [matrixRows, selectedCityOps, selectedRM, selectedTL, searchQuery, sortField, sortDirection]);

    // Calculate Top Summary Header Stats
    const summaryStats: TLRiskMatrixSummary = useMemo(() => {
        let totalActive = 0;
        let totalNeg = 0;
        let totalRange = 0;

        displayedRows.forEach(r => {
            totalActive += r.activeRiders;
            totalNeg += r.negativeCount;
            totalRange += r.range0To250Count;
        });

        const overallNegPct = totalActive > 0 ? Number(((totalNeg / totalActive) * 100).toFixed(2)) : 0;
        const overallRangePct = totalActive > 0 ? Number(((totalRange / totalActive) * 100).toFixed(2)) : 0;

        return {
            totalActiveRiders: totalActive,
            totalNegativeCount: totalNeg,
            totalRange0To250Count: totalRange,
            overallNegativePct: overallNegPct,
            overallRange0To250Pct: overallRangePct
        };
    }, [displayedRows]);

    // Heatmap Gradient Formatter (Exact Google Sheet Color Palette Matching)
    const getNegativePctStyle = (pct: number) => {
        if (pct === 0) return 'bg-[#6bb377]/25 text-[#1b5e20] dark:text-[#81c784] font-extrabold';
        if (pct <= 3.5) return 'bg-[#c8e6bf]/50 text-[#2e7d32] dark:text-[#a5d6a7] font-extrabold';
        if (pct <= 6.0) return 'bg-[#f6d5a1]/60 text-[#b78103] dark:text-[#ffe082] font-black';
        return 'bg-[#e06d6b]/50 text-[#c62828] dark:text-[#ef9a9a] font-black border border-[#e06d6b]/40';
    };

    const getRangePctStyle = (pct: number) => {
        if (pct === 0) return 'bg-[#6bb377]/25 text-[#1b5e20] dark:text-[#81c784] font-extrabold';
        if (pct <= 6.0) return 'bg-[#c8e6bf]/50 text-[#2e7d32] dark:text-[#a5d6a7] font-extrabold';
        if (pct <= 10.0) return 'bg-[#d5e8c1]/60 text-[#33691e] dark:text-[#c5e1a5] font-extrabold';
        if (pct <= 18.0) return 'bg-[#f6d5a1]/60 text-[#b78103] dark:text-[#ffe082] font-black';
        return 'bg-[#e06d6b]/50 text-[#c62828] dark:text-[#ef9a9a] font-black border border-[#e06d6b]/40';
    };

    // Open Drill-down Rider Modal
    const handleOpenCellRiders = (row: TLRiskMatrixRow, type: 'negative' | 'range0To250' | 'all') => {
        const groupRiders = filteredRiders.filter(r => {
            return r.cityOpsName === row.cityOpsName && r.rmName === row.rmName && r.tlName === row.tlName;
        });

        let result: any[] = groupRiders;
        let title = `${row.tlName} - Active Riders (${groupRiders.length})`;

        if (type === 'negative') {
            result = groupRiders.filter(r => r.walletAmount < 0);
            title = `${row.tlName} - Negative Wallet Riders (${result.length})`;
        } else if (type === 'range0To250') {
            result = groupRiders.filter(r => r.walletAmount >= -250 && r.walletAmount < 0);
            title = `${row.tlName} - Negative Wallet (₹0 to ₹250) Riders (${result.length})`;
        }

        const mappedRiders: Rider[] = result.map(r => ({
            id: r.id,
            trievId: r.triev_id || r.trievId || 'N/A',
            riderName: r.rider_name || r.riderName || 'Rider',
            mobileNumber: r.mobile_number || r.mobileNumber || '',
            chassisNumber: r.chassis_number || r.chassisNumber || '',
            clientName: r.client_name || r.clientName || 'Other',
            walletAmount: r.walletAmount,
            allotmentDate: r.allotment_date || r.allotmentDate || '',
            remarks: r.remarks || '',
            status: r.status || 'active',
            teamLeaderId: r.team_leader_id || r.teamLeaderId || '',
            teamLeaderName: r.team_leader || r.teamLeaderName || row.tlName,
            createdAt: r.created_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
            isStolen: Boolean(r.isStolen || r.is_stolen),
            isCompanyTagged: Boolean(r.isCompanyTagged || r.is_company_tagged)
        }));

        setCellModalTitle(title);
        setSelectedCellRiders(mappedRiders);
    };

    // One-Click Formatted Excel Export
    const handleExportExcel = () => {
        try {
            const dataToExport = [
                // Top Summary Row (Matching Google Sheet)
                {
                    'City Ops': 'TOTAL SUMMARY',
                    'CM': 'OVERALL FLEET',
                    'TL': 'TOTAL COUNT',
                    'Active Riders': summaryStats.totalActiveRiders,
                    'Current Riders Having Negative wallet Balance': summaryStats.totalNegativeCount,
                    'Current Riders Having Negative wallet Balance 0 to 250': summaryStats.totalRange0To250Count,
                    'Negative Count %': `${summaryStats.overallNegativePct}%`,
                    '0 to 250 %': `${summaryStats.overallRange0To250Pct}%`
                },
                {}, // Empty spacing row
                // Main Table Rows
                ...displayedRows.map(r => ({
                    'City Ops': r.cityOpsName,
                    'CM': r.rmName,
                    'TL': r.tlName,
                    'Active Riders': r.activeRiders,
                    'Current Riders Having Negative wallet Balance': r.negativeCount,
                    'Current Riders Having Negative wallet Balance 0 to 250': r.range0To250Count,
                    'Negative Count %': `${r.negativePct}%`,
                    '0 to 250 %': `${r.range0To250Pct}%`
                }))
            ];

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'TL Risk Matrix');

            // Auto column widths
            worksheet['!cols'] = [
                { wch: 22 }, { wch: 20 }, { wch: 22 }, 
                { wch: 15 }, { wch: 42 }, { wch: 45 }, 
                { wch: 18 }, { wch: 15 }
            ];

            const filename = `TL_Risk_Wallet_Matrix_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, filename);
            toast.success("Excel report exported successfully!");
        } catch (err) {
            console.error("Excel export error:", err);
            toast.error("Failed to export Excel report");
        }
    };

    // One-Click Formatted PDF Export
    const handleExportPDF = () => {
        try {
            const doc = new jsPDF('landscape', 'pt', 'a4');
            doc.setFontSize(16);
            doc.text("TriEV Fleet - TL Risk & Wallet Matrix Performance Report", 40, 40);

            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} | Scope: ${selectedWeek === 'current' ? 'Live Current Date' : selectedWeek}`, 40, 55);

            const tableHead = [[
                'City Ops', 'CM (RM)', 'TL Name', 
                'Active Riders', 'Negative Wallet Count', '0-250 Range Count', 
                'Negative %', '0-250 %'
            ]];

            const tableBody = [
                // Summary Row
                [
                    'TOTAL SUMMARY', 'OVERALL FLEET', 'TOTAL COUNT',
                    String(summaryStats.totalActiveRiders),
                    String(summaryStats.totalNegativeCount),
                    String(summaryStats.totalRange0To250Count),
                    `${summaryStats.overallNegativePct}%`,
                    `${summaryStats.overallRange0To250Pct}%`
                ],
                ...displayedRows.map(r => [
                    r.cityOpsName,
                    r.rmName,
                    r.tlName,
                    String(r.activeRiders),
                    String(r.negativeCount),
                    String(r.range0To250Count),
                    `${r.negativePct}%`,
                    `${r.range0To250Pct}%`
                ])
            ];

            autoTable(doc, {
                head: tableHead,
                body: tableBody,
                startY: 70,
                styles: { fontSize: 8, cellPadding: 4 },
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                didParseCell: (data) => {
                    if (data.row.index === 0) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [226, 232, 240];
                    }
                }
            });

            doc.save(`TL_Risk_Matrix_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("PDF Report exported successfully!");
        } catch (err) {
            console.error("PDF export error:", err);
            toast.error("Failed to export PDF report");
        }
    };

    return (
        <div className={`space-y-6 ${className}`}>

            {/* ── TOP HEADER & SUMMARY STAT CARDS (MATCHING GOOGLE SHEET TOP ROW) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <GlassCard className="p-5 border-l-4 border-l-slate-800 dark:border-l-slate-200">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Riders</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-foreground">{summaryStats.totalActiveRiders}</h3>
                        <Users size={20} className="text-slate-500 opacity-60" />
                    </div>
                </GlassCard>

                <GlassCard className="p-5 border-l-4 border-l-amber-500">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Negative Wallet Count</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-amber-500">{summaryStats.totalNegativeCount}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-mono font-bold">
                            {summaryStats.overallNegativePct}%
                        </span>
                    </div>
                </GlassCard>

                <GlassCard className="p-5 border-l-4 border-l-orange-500">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">0 to 250 Range Count</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-orange-500">{summaryStats.totalRange0To250Count}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 font-mono font-bold">
                            {summaryStats.overallRange0To250Pct}%
                        </span>
                    </div>
                </GlassCard>

                <GlassCard className="p-5 border-l-4 border-l-rose-500">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Negative Count %</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-rose-500">{summaryStats.overallNegativePct}%</h3>
                        <AlertTriangle size={20} className="text-rose-500 opacity-60" />
                    </div>
                </GlassCard>

                <GlassCard className="p-5 border-l-4 border-l-purple-500">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">0 to 250 %</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-purple-500">{summaryStats.overallRange0To250Pct}%</h3>
                        <Sparkles size={20} className="text-purple-500 opacity-60" />
                    </div>
                </GlassCard>
            </div>

            {/* ── ADMIN-ONLY EXCLUSION CONTROL BAR ── */}
            {isAdmin && (
                <GlassCard className="p-4 bg-purple-500/5 border-purple-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
                                Admin Exclusion Rules Power Controls
                                <span className="text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-mono">Admin Only</span>
                            </h4>
                            <p className="text-[11px] text-muted-foreground">Toggle active filtering rules for New Allotments, Theft, and Company Tagged Riders</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border cursor-pointer hover:bg-accent transition-all font-medium">
                            <input
                                type="checkbox"
                                checked={excludeNewAllotments}
                                onChange={e => setExcludeNewAllotments(e.target.checked)}
                                className="w-4 h-4 rounded accent-purple-600"
                            />
                            <span>Exclude New Allotments (&lt;= 36h)</span>
                        </label>

                        <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border cursor-pointer hover:bg-accent transition-all font-medium">
                            <input
                                type="checkbox"
                                checked={excludeStolen}
                                onChange={e => setExcludeStolen(e.target.checked)}
                                className="w-4 h-4 rounded accent-purple-600"
                            />
                            <span>Exclude Stolen Vehicles</span>
                        </label>

                        <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border cursor-pointer hover:bg-accent transition-all font-medium">
                            <input
                                type="checkbox"
                                checked={excludeCompanyTagged}
                                onChange={e => setExcludeCompanyTagged(e.target.checked)}
                                className="w-4 h-4 rounded accent-purple-600"
                            />
                            <span>Exclude Company Tagged</span>
                        </label>
                    </div>
                </GlassCard>
            )}

            {/* ── ADVANCED FILTER TOOLBAR & ONE-CLICK EXPORT ── */}
            <GlassCard className="p-4 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* City Ops Filter */}
                        <div className="flex items-center gap-1.5 bg-accent/40 border border-border/60 rounded-xl px-3 py-1.5 text-xs">
                            <Filter size={13} className="text-muted-foreground" />
                            <span className="text-muted-foreground font-medium">City Ops:</span>
                            <select
                                value={selectedCityOps}
                                onChange={e => setSelectedCityOps(e.target.value)}
                                className="bg-transparent font-bold text-foreground outline-none cursor-pointer"
                            >
                                <option value="all">All City Ops</option>
                                {cityOpsOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* CM / RM Filter */}
                        <div className="flex items-center gap-1.5 bg-accent/40 border border-border/60 rounded-xl px-3 py-1.5 text-xs">
                            <span className="text-muted-foreground font-medium">CM (RM):</span>
                            <select
                                value={selectedRM}
                                onChange={e => setSelectedRM(e.target.value)}
                                className="bg-transparent font-bold text-foreground outline-none cursor-pointer"
                            >
                                <option value="all">All CMs</option>
                                {rmOptions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        {/* TL Filter */}
                        <div className="flex items-center gap-1.5 bg-accent/40 border border-border/60 rounded-xl px-3 py-1.5 text-xs">
                            <span className="text-muted-foreground font-medium">TL:</span>
                            <select
                                value={selectedTL}
                                onChange={e => setSelectedTL(e.target.value)}
                                className="bg-transparent font-bold text-foreground outline-none cursor-pointer"
                            >
                                <option value="all">All TLs</option>
                                {tlOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {/* 5-Week History Selector */}
                        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl px-3 py-1.5 text-xs font-bold">
                            <Calendar size={13} />
                            <span>Scope:</span>
                            <select
                                value={selectedWeek}
                                onChange={e => setSelectedWeek(e.target.value)}
                                className="bg-transparent font-extrabold outline-none cursor-pointer"
                            >
                                <option value="current">Live Current Date</option>
                                <option value="week-1">Week -1 History</option>
                                <option value="week-2">Week -2 History</option>
                                <option value="week-3">Week -3 History</option>
                                <option value="week-4">Week -4 History</option>
                                <option value="week-5">Week -5 History</option>
                            </select>
                        </div>
                    </div>

                    {/* Right: Search & One-Click Exports */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search TL or Manager..."
                                className="pl-9 pr-3 py-1.5 rounded-xl border border-input bg-card text-xs text-foreground focus:ring-2 focus:ring-primary outline-none w-48 sm:w-56"
                            />
                        </div>

                        <button
                            onClick={handleExportExcel}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-md flex items-center gap-1.5"
                            title="Export formatted Excel report"
                        >
                            <FileSpreadsheet size={14} /> Excel
                        </button>

                        <button
                            onClick={handleExportPDF}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-all shadow-md flex items-center gap-1.5"
                            title="Export formatted PDF report"
                        >
                            <FileText size={14} /> PDF
                        </button>

                        <button
                            onClick={() => { setRefreshing(true); fetchData(); }}
                            disabled={refreshing}
                            className="p-2 rounded-xl bg-accent text-foreground hover:bg-accent/80 transition-all"
                            title="Refresh Data"
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* ── MAIN MATRIX DATA TABLE (EXACT GOOGLE SHEET LAYOUT) ── */}
            <GlassCard className="p-0 overflow-hidden shadow-2xl border border-border/80">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#0b383e] text-white select-none">
                            {/* TOP OVERALL SUMMARY NUMBERS ROW (MATCHING GOOGLE SHEET TOP STATS ROW) */}
                            <tr className="border-b border-[#14484f] font-mono text-sm">
                                <th colSpan={3} className="p-3 text-center border-r border-[#14484f] bg-[#082f34]">
                                    <span className="text-xl font-black tracking-widest text-emerald-300 uppercase">CM</span>
                                </th>
                                <th className="p-3 border-r border-[#14484f] text-center font-black text-base text-white">
                                    {summaryStats.totalActiveRiders}
                                </th>
                                <th className="p-3 border-r border-[#14484f] text-center font-black text-base text-amber-300">
                                    {summaryStats.totalNegativeCount}
                                </th>
                                <th className="p-3 border-r border-[#14484f] text-center font-black text-base text-orange-300">
                                    {summaryStats.totalRange0To250Count}
                                </th>
                                <th className="p-3 border-r border-[#14484f] text-center font-black text-base text-rose-300">
                                    {summaryStats.overallNegativePct}%
                                </th>
                                <th className="p-3 text-center font-black text-base text-purple-300">
                                    {summaryStats.overallRange0To250Pct}%
                                </th>
                            </tr>

                            {/* COLUMN HEADERS ROW (MATCHING SCREENSHOT COLUMN TITLES) */}
                            <tr className="border-b border-[#14484f] font-extrabold text-xs tracking-wide">
                                <th className="p-3 text-left border-r border-[#14484f] w-44">City Ops</th>
                                <th className="p-3 text-center border-r border-[#14484f] w-36">CM</th>
                                <th className="p-3 text-left border-r border-[#14484f] w-44">TL</th>
                                <th className="p-3 border-r border-[#14484f] text-center w-28">Active Riders</th>
                                <th className="p-3 border-r border-[#14484f] text-center max-w-[170px] leading-tight">
                                    Current Riders Having Negative wallet Balance
                                </th>
                                <th className="p-3 border-r border-[#14484f] text-center max-w-[190px] leading-tight">
                                    Current Riders Having Negative wallet Balance 0 to 250
                                </th>
                                <th className="p-3 border-r border-[#14484f] text-center cursor-pointer hover:bg-[#12444a] transition-all" onClick={() => { setSortField('negativePct'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>Negative Count %</span>
                                        <ArrowUpDown size={12} />
                                    </div>
                                </th>
                                <th className="p-3 text-center cursor-pointer hover:bg-[#12444a] transition-all" onClick={() => { setSortField('range0To250Pct'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>0 to 250 %</span>
                                        <ArrowUpDown size={12} />
                                    </div>
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-border/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw size={24} className="animate-spin text-primary" />
                                            <span>Calculating TL Risk & Wallet Matrix...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted-foreground font-medium">
                                        No Team Leader records found matching the selected filters.
                                    </td>
                                </tr>
                            ) : (
                                displayedRows.map((row, idx) => (
                                    <tr key={`${row.tlName}-${idx}`} className="hover:bg-accent/40 transition-colors">
                                        <td className="p-3 font-semibold text-foreground border-r border-border/40">{row.cityOpsName}</td>
                                        <td className="p-3 font-semibold text-foreground text-center border-r border-border/40">{row.rmName}</td>
                                        <td className="p-3 font-extrabold text-foreground border-r border-border/40 flex items-center justify-between">
                                            <span>{row.tlName}</span>
                                            <button 
                                                onClick={() => handleOpenCellRiders(row, 'all')}
                                                className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-all"
                                                title="View All Riders under this TL"
                                            >
                                                <Eye size={13} />
                                            </button>
                                        </td>

                                        {/* Metric Active Riders */}
                                        <td className="p-3 text-center font-bold text-foreground border-r border-border/40 font-mono">
                                            {row.activeRiders}
                                        </td>

                                        {/* Metric Negative Count (Clickable to Drill-Down) */}
                                        <td className="p-3 text-center border-r border-border/40 font-mono">
                                            <button
                                                onClick={() => handleOpenCellRiders(row, 'negative')}
                                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold hover:bg-amber-500/20 transition-all cursor-pointer"
                                                title="Click to view riders with negative wallet balance"
                                            >
                                                {row.negativeCount}
                                            </button>
                                        </td>

                                        {/* Metric 0 to 250 Range Count (Clickable to Drill-Down) */}
                                        <td className="p-3 text-center border-r border-border/40 font-mono">
                                            <button
                                                onClick={() => handleOpenCellRiders(row, 'range0To250')}
                                                className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold hover:bg-orange-500/20 transition-all cursor-pointer"
                                                title="Click to view riders in 0-250 range"
                                            >
                                                {row.range0To250Count}
                                            </button>
                                        </td>

                                        {/* Heatmap Negative Count % */}
                                        <td className={`p-3 text-center border-r border-border/40 font-mono ${getNegativePctStyle(row.negativePct)}`}>
                                            {row.negativePct}%
                                        </td>

                                        {/* Heatmap 0 to 250 % */}
                                        <td className={`p-3 text-center font-mono ${getRangePctStyle(row.range0To250Pct)}`}>
                                            {row.range0To250Pct}%
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* ── INTERACTIVE RIDER DRILL-DOWN MODAL ── */}
            {selectedCellRiders && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[25000] p-4">
                    <GlassCard className="w-full max-w-4xl max-h-[85vh] flex flex-col p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border/60 pb-3">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Users className="text-primary" size={18} /> {cellModalTitle}
                            </h3>
                            <button
                                onClick={() => setSelectedCellRiders(null)}
                                className="px-3 py-1 rounded-xl bg-accent text-xs font-bold hover:bg-accent/80 transition-all"
                            >
                                Close
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-muted/40 font-bold border-b border-border/60 text-muted-foreground">
                                        <th className="p-2.5">Rider Name</th>
                                        <th className="p-2.5">TriEV ID</th>
                                        <th className="p-2.5">Mobile</th>
                                        <th className="p-2.5">Chassis No</th>
                                        <th className="p-2.5 text-right">Wallet Balance</th>
                                        <th className="p-2.5 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {selectedCellRiders.map(r => (
                                        <tr key={r.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="p-2.5 font-bold text-foreground capitalize">{r.riderName}</td>
                                            <td className="p-2.5 font-mono text-muted-foreground">{r.trievId}</td>
                                            <td className="p-2.5 font-mono text-muted-foreground">{r.mobileNumber}</td>
                                            <td className="p-2.5 font-mono text-muted-foreground">{r.chassisNumber || '—'}</td>
                                            <td className={`p-2.5 font-mono font-bold text-right ${r.walletAmount < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                ₹{r.walletAmount.toLocaleString('en-IN')}
                                            </td>
                                            <td className="p-2.5 text-center">
                                                <button
                                                    onClick={() => setDetailRider(r)}
                                                    className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-bold text-[11px] hover:opacity-90 transition-all"
                                                >
                                                    Inspect Profile
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* ── RIDER DETAILS MODAL ── */}
            {detailRider && (
                <RiderDetailsModal
                    rider={detailRider}
                    onClose={() => setDetailRider(null)}
                    onUpdate={() => fetchData()}
                />
            )}

        </div>
    );
};

export default TLRiskWalletMatrix;
