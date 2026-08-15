import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
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
import { parseIndianDate, getValidAllotmentDate } from '@/utils/dateUtils';

export interface TLRiskWalletMatrixProps {
    className?: string;
}

const TLRiskWalletMatrix: React.FC<TLRiskWalletMatrixProps> = ({ className = '' }) => {
    const { userData } = useSupabaseAuth();

    // Data States
    const [riders, setRiders] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [snapshots, setSnapshots] = useState<any[]>([]);

    const isAdmin = userData?.role === 'admin';

    // Filter & Search States
    const [selectedCityOps, setSelectedCityOps] = useState<string>('all');
    const [selectedRM, setSelectedRM] = useState<string>('all');
    const [selectedTL, setSelectedTL] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedWeek, setSelectedWeek] = useState<string>('current');
    const [quickFilter, setQuickFilter] = useState<'all' | 'high_risk' | 'low_wallet_risk' | 'zero_negative'>('all');

    // Global Admin Exclusion Settings (Persisted in Supabase DB & synced via Realtime across all panels)
    const [excludeNewAllotments, setExcludeNewAllotments] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('tl_matrix_exclusions');
            if (saved) return Boolean(JSON.parse(saved).excludeNewAllotments);
        } catch {}
        return false;
    });

    const [excludeStolen, setExcludeStolen] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('tl_matrix_exclusions');
            if (saved) return Boolean(JSON.parse(saved).excludeStolen);
        } catch {}
        return false;
    });

    const [excludeCompanyTagged, setExcludeCompanyTagged] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('tl_matrix_exclusions');
            if (saved) return Boolean(JSON.parse(saved).excludeCompanyTagged);
        } catch {}
        return false;
    });

    // Sync Global Exclusion Settings with Supabase DB (system_settings table)
    const fetchGlobalExclusions = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'tl_matrix_exclusions')
                .maybeSingle();

            if (!error && data?.value) {
                const val = data.value;
                if (val.excludeNewAllotments !== undefined) setExcludeNewAllotments(Boolean(val.excludeNewAllotments));
                if (val.excludeStolen !== undefined) setExcludeStolen(Boolean(val.excludeStolen));
                if (val.excludeCompanyTagged !== undefined) setExcludeCompanyTagged(Boolean(val.excludeCompanyTagged));
                try { localStorage.setItem('tl_matrix_exclusions', JSON.stringify(val)); } catch {}
            }
        } catch (err) {
            console.error("Failed to load global matrix exclusions from DB:", err);
        }
    }, []);

    // Realtime Listener for Global Exclusion Updates by Admin across all user panels
    useEffect(() => {
        fetchGlobalExclusions();

        const channel = supabase
            .channel('tl-matrix-global-settings')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'system_settings',
                filter: 'key=eq.tl_matrix_exclusions'
            }, (payload: any) => {
                if (payload.new?.value) {
                    const val = payload.new.value;
                    if (val.excludeNewAllotments !== undefined) setExcludeNewAllotments(Boolean(val.excludeNewAllotments));
                    if (val.excludeStolen !== undefined) setExcludeStolen(Boolean(val.excludeStolen));
                    if (val.excludeCompanyTagged !== undefined) setExcludeCompanyTagged(Boolean(val.excludeCompanyTagged));
                    try { localStorage.setItem('tl_matrix_exclusions', JSON.stringify(val)); } catch {}
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchGlobalExclusions]);

    // Admin Toggle Handler (Persists to Supabase DB & Broadcasts via Realtime to all user sessions)
    const handleToggleExclusion = async (key: 'newAllotments' | 'stolen' | 'company') => {
        if (!isAdmin) return;

        let nextNew = excludeNewAllotments;
        let nextStolen = excludeStolen;
        let nextCompany = excludeCompanyTagged;

        if (key === 'newAllotments') { nextNew = !excludeNewAllotments; setExcludeNewAllotments(nextNew); }
        if (key === 'stolen') { nextStolen = !excludeStolen; setExcludeStolen(nextStolen); }
        if (key === 'company') { nextCompany = !excludeCompanyTagged; setExcludeCompanyTagged(nextCompany); }

        const payload = {
            excludeNewAllotments: nextNew,
            excludeStolen: nextStolen,
            excludeCompanyTagged: nextCompany
        };

        try {
            localStorage.setItem('tl_matrix_exclusions', JSON.stringify(payload));
            
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'tl_matrix_exclusions',
                    value: payload,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.warn("Falling back to local persistence:", error);
            } else {
                toast.success("Global Risk Matrix Exclusions updated and synced across all user panels!");
            }
        } catch (err) {
            console.error("Error persisting matrix exclusion setting:", err);
        }
    };

    // Modal States for Rider Drill-Down
    const [selectedCellRiders, setSelectedCellRiders] = useState<Rider[] | null>(null);
    const [cellModalTitle, setCellModalTitle] = useState<string>('');
    const [detailRider, setDetailRider] = useState<Rider | null>(null);

    // Sort State
    const [sortField, setSortField] = useState<'negativePct' | 'range0To250Pct' | 'activeRiders' | 'tlName'>('negativePct');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Fetch Live Riders & Snapshots
    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        try {
            // 1. Fetch all active riders with paginated helper (beyond 1000 limit)
            const { data: ridersData, error: ridersErr } = await fetchAllRidersPaginated('*');
            if (ridersErr) throw ridersErr;

            // 2. Fetch users table to map TL ID -> TL Name, RM Name, City Ops Name
            const { data: usersData, error: usersErr } = await fetchTablePaginated('users', 'id, user_id, full_name, email, role, reporting_manager, city_ops_id, status, username');
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
                        const isStolenVal = fresh.is_stolen !== undefined && fresh.is_stolen !== null ? Boolean(fresh.is_stolen) : Boolean(oldR.isStolen);
                        const isCompVal = fresh.is_company_tagged !== undefined && fresh.is_company_tagged !== null ? Boolean(fresh.is_company_tagged) : Boolean(oldR.isCompanyTagged);
                        return {
                            ...oldR,
                            isStolen: isStolenVal,
                            is_stolen: isStolenVal,
                            isCompanyTagged: isCompVal,
                            is_company_tagged: isCompVal,
                            walletAmount: Number(fresh.wallet_amount ?? fresh.walletAmount ?? oldR.walletAmount)
                        };
                    });
                });

                setDetailRider(prevDetail => {
                    if (!prevDetail) return null;
                    const fresh = freshMap.get(prevDetail.id);
                    if (!fresh) return prevDetail;
                    const isStolenVal = fresh.is_stolen !== undefined && fresh.is_stolen !== null ? Boolean(fresh.is_stolen) : Boolean(prevDetail.isStolen);
                    const isCompVal = fresh.is_company_tagged !== undefined && fresh.is_company_tagged !== null ? Boolean(fresh.is_company_tagged) : Boolean(prevDetail.isCompanyTagged);
                    return {
                        ...prevDetail,
                        isStolen: isStolenVal,
                        is_stolen: isStolenVal,
                        isCompanyTagged: isCompVal,
                        is_company_tagged: isCompVal,
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

    // Helper: Strip parenthetical identifiers e.g. "Sachin Verma (KONTI/473)" -> "sachin verma"
    const cleanName = (nameStr: string) => {
        if (!nameStr) return '';
        return nameStr.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    };

    // Create User Lookup Maps (ID, User_ID, Email, Username, Full Name & Clean Name)
    const { userMap, userByNameMap } = useMemo(() => {
        const byId = new Map<string, any>();
        const byName = new Map<string, any>();

        users.forEach(u => {
            if (u.id) byId.set(u.id, u);
            if (u.user_id) byId.set(u.user_id, u);
            if (u.email) byId.set(u.email.trim().toLowerCase(), u);

            if (u.role === 'teamLeader') {
                const fullNameRaw = (u.full_name || '').trim().toLowerCase();
                const cleaned = cleanName(u.full_name || u.email || '');

                if (fullNameRaw) byName.set(fullNameRaw, u);
                if (cleaned) byName.set(cleaned, u);
                if (u.username) byName.set(u.username.trim().toLowerCase(), u);
            }
        });
        return { userMap: byId, userByNameMap: byName };
    }, [users]);

    // Enrich Riders with Resolved Hierarchy & Wallet Amount
    const enrichedRiders = useMemo(() => {
        return riders.map(r => {
            const walletAmount = Number(r.wallet_amount ?? r.walletAmount ?? r.wallet_balance ?? 0);
            
            const tlId = r.team_leader_id || r.teamLeaderId;
            let tlUser = tlId ? userMap.get(tlId) : null;
            if (!tlUser) {
                const rawTlName = (r.team_leader_name || r.team_leader || r.teamLeaderName || '').trim().toLowerCase();
                const cleanedTlName = cleanName(r.team_leader_name || r.team_leader || r.teamLeaderName || '');
                if (rawTlName) {
                    tlUser = userByNameMap.get(rawTlName) || userByNameMap.get(cleanedTlName) || null;
                }
            }

            const tlName = (tlUser?.full_name || r.team_leader_name || r.team_leader || r.teamLeaderName || 'Unassigned TL').trim();
            const rmName = (tlUser?.reporting_manager || r.reporting_manager || r.rm_name || r.reportingManager || 'Saunvir Singh').trim();
            const cityOpsName = (r.skip_manager || r.city_ops_name || r.cityOps || 'Danish Abdulla khan').trim();

            const isStolen = Boolean(r.is_stolen || r.isStolen);
            const isCompanyTagged = Boolean(r.is_company_tagged || r.isCompanyTagged);
            const validAllotment = getValidAllotmentDate(r.allotment_date || r.allotmentDate, r.created_at || r.createdAt);

            return {
                ...r,
                allotment_date: validAllotment,
                allotmentDate: validAllotment,
                walletAmount,
                tlName,
                rmName,
                cityOpsName,
                isStolen,
                isCompanyTagged
            };
        });
    }, [riders, userMap, userByNameMap]);

    // Calculate Today IST & Yesterday IST for New Allotment Filter
    const isNewAllotment = (allotmentDateStr?: string) => {
        if (!allotmentDateStr) return false;
        try {
            const parsedIso = parseIndianDate(allotmentDateStr) || allotmentDateStr;
            const allotmentDate = new Date(parsedIso);
            if (isNaN(allotmentDate.getTime())) return false;

            const now = new Date();
            // Hour difference safeguard (0 to 48 hours)
            const diffHours = (now.getTime() - allotmentDate.getTime()) / (1000 * 60 * 60);
            if (diffHours >= -2 && diffHours <= 48) return true;

            // Calendar day difference in IST
            const nowIstStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
            const allotmentIstStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(allotmentDate);

            const [nY, nM, nD] = nowIstStr.split('-').map(Number);
            const [aY, aM, aD] = allotmentIstStr.split('-').map(Number);

            const nDate = Date.UTC(nY, nM - 1, nD);
            const aDate = Date.UTC(aY, aM - 1, aD);

            const dayDiff = Math.round((nDate - aDate) / (1000 * 60 * 60 * 24));
            return dayDiff >= 0 && dayDiff <= 1; // 0 = Today IST, 1 = Yesterday IST
        } catch {
            return false;
        }
    };

    // Filter Raw Active Riders (Unfiltered by Exclusion Toggles for Active Count Parity)
    const allActiveRiders = useMemo(() => {
        return enrichedRiders.filter(r => {
            const status = String(r.status || '').toLowerCase().trim();
            return status === 'active';
        });
    }, [enrichedRiders]);

    // Check if a rider passes active exclusion toggles (used ONLY for Risk Metric columns)
    const passesRiskExclusions = (r: any) => {
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
    };

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
            matchingActiveRiders: any[];
        }>();

        // 1. Seed with active Team Leaders from users table so all assigned TLs are visible
        users.forEach(u => {
            if (u.role === 'teamLeader' && (u.status === 'active' || u.status === undefined || u.status === null)) {
                const tlName = (u.full_name || u.email || '').trim();
                const rmName = (u.reporting_manager || 'Saunvir Singh').trim();
                const cityOpsName = 'Danish Abdulla khan';
                if (tlName) {
                    const normKey = `${cleanName(cityOpsName)}___${cleanName(rmName)}___${cleanName(tlName)}`;
                    if (!map.has(normKey)) {
                        map.set(normKey, { cityOpsName, rmName, tlName, matchingActiveRiders: [] });
                    }
                }
            }
        });

        // 2. Group all active riders into matching TL key (UNFILTERED for Active Rider count parity)
        allActiveRiders.forEach(r => {
            const cityOpsName = r.cityOpsName || 'Danish Abdulla khan';
            const rmName = r.rmName || 'Saunvir Singh';
            const tlName = r.tlName || 'Unassigned TL';
            const normKey = `${cleanName(cityOpsName)}___${cleanName(rmName)}___${cleanName(tlName)}`;

            if (!map.has(normKey)) {
                map.set(normKey, { cityOpsName, rmName, tlName, matchingActiveRiders: [] });
            }
            map.get(normKey)!.matchingActiveRiders.push(r);
        });

        const rows: TLRiskMatrixRow[] = [];
        map.forEach(group => {
            const activeRiders = group.matchingActiveRiders.length; // 100% Matches My Riders!
            
            // Risk metrics apply exclusion toggles strictly on the active rider pool
            const riskFilteredRiders = group.matchingActiveRiders.filter(passesRiskExclusions);
            const negRiders = riskFilteredRiders.filter(r => r.walletAmount < 0);
            const rangeRiders = riskFilteredRiders.filter(r => r.walletAmount >= 0 && r.walletAmount < 250);

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
    }, [allActiveRiders, selectedWeek, snapshots, users, excludeNewAllotments, excludeStolen, excludeCompanyTagged]);

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

    // Auto-focus filter for Team Leader, RM, or City Ops logged-in user
    useEffect(() => {
        if (!userData) return;
        const uObj = userData as any;
        const role = uObj?.role;
        const userClean = cleanName(uObj?.fullName || uObj?.full_name || uObj?.email || '');

        if (role === 'teamLeader' && userClean) {
            const matchTL = tlOptions.find(t => cleanName(t) === userClean);
            if (matchTL && selectedTL === 'all') setSelectedTL(matchTL);
        } else if (role === 'reportingManager' && userClean) {
            const matchRM = rmOptions.find(r => cleanName(r) === userClean);
            if (matchRM && selectedRM === 'all') setSelectedRM(matchRM);
        } else if (role === 'cityOps' && userClean) {
            const matchCityOps = cityOpsOptions.find(c => cleanName(c) === userClean);
            if (matchCityOps && selectedCityOps === 'all') setSelectedCityOps(matchCityOps);
        }
    }, [userData, tlOptions, rmOptions, cityOpsOptions]);

    // Calculate Top 3 Critical Risk TLs for Copilot Alert Banner
    const top3RiskTLs = useMemo(() => {
        return [...matrixRows]
            .filter(r => r.negativePct > 0)
            .sort((a, b) => b.negativePct - a.negativePct)
            .slice(0, 3);
    }, [matrixRows]);

    // Apply Filter Dropdowns, Search Query & Admin Quick Risk Filter
    const displayedRows = useMemo(() => {
        return matrixRows.filter(row => {
            if (selectedCityOps !== 'all' && row.cityOpsName !== selectedCityOps) return false;
            if (selectedRM !== 'all' && row.rmName !== selectedRM) return false;
            if (selectedTL !== 'all' && row.tlName !== selectedTL) return false;

            if (isAdmin && quickFilter !== 'all') {
                if (quickFilter === 'high_risk' && row.negativePct <= 8.5) return false;
                if (quickFilter === 'low_wallet_risk' && row.range0To250Pct <= 11.0) return false;
                if (quickFilter === 'zero_negative' && row.negativeCount !== 0) return false;
            }

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
    }, [matrixRows, selectedCityOps, selectedRM, selectedTL, searchQuery, sortField, sortDirection, quickFilter, isAdmin]);

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

    // Strictly 3-Color Neon Glowing Heatmap Badges (Graduated Pure -> Light -> Moderate -> Critical)
    const getNegativePctStyle = (pct: number) => {
        // 🟢 PURE GREEN: Zero Negative Balance (0.00%)
        if (pct === 0) {
            return 'bg-emerald-500/30 text-emerald-950 dark:text-emerald-200 font-black border border-emerald-500/70 shadow-[0_0_14px_rgba(16,185,129,0.35)]';
        }
        // 🟢 LIGHT GREEN: Safe & Healthy Range (0.01% to 5.50%)
        if (pct <= 5.5) {
            return 'bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 font-black border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
        }
        // 🟡 YELLOW: Warning / Moderate Risk (5.51% to 8.50%)
        if (pct <= 8.5) {
            return 'bg-amber-500/25 text-amber-950 dark:text-amber-200 font-black border border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse';
        }
        // 🔴 RED: Critical High Risk (> 8.50%)
        return 'bg-rose-500/30 text-rose-950 dark:text-rose-200 font-black border border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse';
    };

    const getRangePctStyle = (pct: number) => {
        // 🟢 PURE GREEN: Zero Low Balance Riders (0.00%)
        if (pct === 0) {
            return 'bg-emerald-500/30 text-emerald-950 dark:text-emerald-200 font-black border border-emerald-500/70 shadow-[0_0_14px_rgba(16,185,129,0.35)]';
        }
        // 🟢 LIGHT GREEN: Safe & Healthy Range (0.01% to 8.00%)
        if (pct <= 8.0) {
            return 'bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 font-black border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
        }
        // 🟡 YELLOW: Warning / Moderate Risk (8.01% to 11.00%)
        if (pct <= 11.0) {
            return 'bg-amber-500/25 text-amber-950 dark:text-amber-200 font-black border border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse';
        }
        // 🔴 RED: Critical High Risk (> 11.00%)
        return 'bg-rose-500/30 text-rose-950 dark:text-rose-200 font-black border border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse';
    };

    // Open Drill-down Rider Modal
    const handleOpenCellRiders = (row: TLRiskMatrixRow, type: 'negative' | 'range0To250' | 'all') => {
        const rowTlClean = cleanName(row.tlName || '');
        const rowOpsClean = cleanName(row.cityOpsName || '');
        const rowRmClean = cleanName(row.rmName || '');

        const groupRiders = allActiveRiders.filter(r => {
            const rTlClean = cleanName(r.tlName || '');
            const rOpsClean = cleanName(r.cityOpsName || '');
            const rRmClean = cleanName(r.rmName || '');

            const matchTl = rTlClean === rowTlClean || (row.tlName && r.teamLeaderName === row.tlName) || (r.teamLeaderId && row.tlName === r.teamLeaderId);
            const matchOps = !rowOpsClean || rowOpsClean === 'all' || rOpsClean === rowOpsClean;
            const matchRm = !rowRmClean || rowRmClean === 'all' || rRmClean === rowRmClean;

            return matchTl && matchOps && matchRm;
        });

        let result: any[] = groupRiders;
        let title = `${row.tlName} - Active Riders (${groupRiders.length})`;

        if (type === 'negative') {
            result = groupRiders.filter(r => passesRiskExclusions(r) && r.walletAmount < 0);
            title = `${row.tlName} - Negative Wallet Riders (${result.length})`;
        } else if (type === 'range0To250') {
            result = groupRiders.filter(r => passesRiskExclusions(r) && r.walletAmount >= 0 && r.walletAmount < 250);
            title = `${row.tlName} - Low Wallet (+0 to +250) Riders (${result.length})`;
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
                    'Current Riders Having Low wallet Balance (+0 to +250)': summaryStats.totalRange0To250Count,
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
                    'Current Riders Having Low wallet Balance (+0 to +250)': r.range0To250Count,
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

            {/* ── TOP 3 CRITICAL RISK TL COPILOT BANNER ── */}
            {top3RiskTLs.length > 0 && (
                <GlassCard className="p-4 bg-gradient-to-r from-rose-500/15 via-amber-500/10 to-card border border-rose-500/30 shadow-xl rounded-2xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-300 shadow-inner flex-shrink-0 animate-pulse">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                    ⚡ Top Critical Risk Team Leaders Today
                                    <span className="text-[10px] bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-mono font-black">Immediate Collection Action Required</span>
                                </h4>
                                <p className="text-[11px] text-muted-foreground font-medium">Team leaders with the highest negative wallet percentage requiring priority fleet intervention</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {top3RiskTLs.map((tl, idx) => (
                                <div 
                                    key={tl.tlName}
                                    onClick={() => handleOpenCellRiders(tl, 'negative')}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-rose-500/40 text-xs font-bold shadow-sm hover:scale-105 transition-all cursor-pointer"
                                >
                                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center font-mono">#{idx + 1}</span>
                                    <span className="text-slate-900 dark:text-white truncate max-w-[130px]">{tl.tlName}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono font-black text-[11px]">
                                        {tl.negativePct}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </GlassCard>
            )}

            {/* ── TOP HEADER & SUMMARY STAT CARDS (MATCHING GOOGLE SHEET TOP ROW) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <GlassCard className="p-5 border-l-4 border-l-slate-700 dark:border-l-slate-200 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 border-t border-t-white/30 dark:border-t-white/10">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Riders</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{summaryStats.totalActiveRiders}</h3>
                        <div className="p-2 rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300">
                            <Users size={18} />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-5 border-l-4 border-l-amber-500 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 border-t border-t-white/30 dark:border-t-white/10">
                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Negative Wallet Count</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{summaryStats.totalNegativeCount}</h3>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono font-black border border-amber-500/30">
                            {summaryStats.overallNegativePct}%
                        </span>
                    </div>
                </GlassCard>

                <GlassCard className="p-5 border-l-4 border-l-orange-500 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 border-t border-t-white/30 dark:border-t-white/10">
                    <p className="text-[11px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">Low Wallet (+0 to +250) Count</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-orange-600 dark:text-orange-400 tracking-tight">{summaryStats.totalRange0To250Count}</h3>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 font-mono font-black border border-orange-500/30">
                            {summaryStats.overallRange0To250Pct}%
                        </span>
                    </div>
                </GlassCard>

                <GlassCard className="p-5 border-l-4 border-l-rose-500 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 border-t border-t-white/30 dark:border-t-white/10">
                    <p className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Negative Count %</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">{summaryStats.overallNegativePct}%</h3>
                        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <AlertTriangle size={18} />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-5 border-l-4 border-l-purple-500 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 border-t border-t-white/30 dark:border-t-white/10">
                    <p className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Low Wallet (+0 to +250) %</p>
                    <div className="flex items-baseline justify-between mt-2">
                        <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">{summaryStats.overallRange0To250Pct}%</h3>
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <Sparkles size={18} />
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* ── ADMIN-ONLY GLOBAL EXCLUSION CONTROL BAR ── */}
            {isAdmin && (
                <GlassCard className="p-4 bg-gradient-to-r from-purple-500/10 via-card to-card border border-purple-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-300 shadow-inner">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                Risk Matrix Exclusion Controls
                                <span className="text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">Admin Only</span>
                            </h4>
                            <p className="text-[11px] text-muted-foreground font-medium">Configure global exclusion parameters for all user accounts (New Allotments, Theft Vehicles, and Company Tagged Payouts)</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div 
                            onClick={() => handleToggleExclusion('newAllotments')}
                            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border cursor-pointer select-none transition-all shadow-sm font-bold ${excludeNewAllotments ? 'bg-purple-600 text-white border-purple-500 shadow-purple-500/20' : 'bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            <input
                                type="checkbox"
                                checked={excludeNewAllotments}
                                readOnly
                                className="w-4 h-4 rounded accent-purple-600 pointer-events-none"
                            />
                            <span>Exclude New Allotments (&lt;= 36h)</span>
                        </div>

                        <div 
                            onClick={() => handleToggleExclusion('stolen')}
                            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border cursor-pointer select-none transition-all shadow-sm font-bold ${excludeStolen ? 'bg-purple-600 text-white border-purple-500 shadow-purple-500/20' : 'bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            <input
                                type="checkbox"
                                checked={excludeStolen}
                                readOnly
                                className="w-4 h-4 rounded accent-purple-600 pointer-events-none"
                            />
                            <span>Exclude Stolen Vehicles</span>
                        </div>

                        <div 
                            onClick={() => handleToggleExclusion('company')}
                            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border cursor-pointer select-none transition-all shadow-sm font-bold ${excludeCompanyTagged ? 'bg-purple-600 text-white border-purple-500 shadow-purple-500/20' : 'bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            <input
                                type="checkbox"
                                checked={excludeCompanyTagged}
                                readOnly
                                className="w-4 h-4 rounded accent-purple-600 pointer-events-none"
                            />
                            <span>Exclude Company Tagged</span>
                        </div>
                    </div>
                </GlassCard>
            )}

            {/* ── ADVANCED FILTER TOOLBAR & ONE-CLICK EXPORT ── */}
            <GlassCard className="p-4 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* City Ops Filter */}
                        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs shadow-sm">
                            <Filter size={13} className="text-slate-500 dark:text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-200 font-bold">City Ops:</span>
                            <select
                                value={selectedCityOps}
                                onChange={e => setSelectedCityOps(e.target.value)}
                                className="bg-transparent font-extrabold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
                            >
                                <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">All City Ops</option>
                                {cityOpsOptions.map(c => <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">{c}</option>)}
                            </select>
                        </div>

                        {/* CM / RM Filter */}
                        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs shadow-sm">
                            <span className="text-slate-700 dark:text-slate-200 font-bold">CM (RM):</span>
                            <select
                                value={selectedRM}
                                onChange={e => setSelectedRM(e.target.value)}
                                className="bg-transparent font-extrabold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
                            >
                                <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">All CMs</option>
                                {rmOptions.map(r => <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">{r}</option>)}
                            </select>
                        </div>

                        {/* TL Filter */}
                        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs shadow-sm">
                            <span className="text-slate-700 dark:text-slate-200 font-bold">TL:</span>
                            <select
                                value={selectedTL}
                                onChange={e => setSelectedTL(e.target.value)}
                                className="bg-transparent font-extrabold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
                            >
                                <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">All TLs</option>
                                {tlOptions.map(t => <option key={t} value={t} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">{t}</option>)}
                            </select>
                        </div>

                        {/* 5-Week History Selector */}
                        <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm">
                            <Calendar size={13} />
                            <span className="text-emerald-800 dark:text-emerald-200">Scope:</span>
                            <select
                                value={selectedWeek}
                                onChange={e => setSelectedWeek(e.target.value)}
                                className="bg-transparent font-extrabold text-emerald-900 dark:text-emerald-100 outline-none cursor-pointer"
                            >
                                <option value="current" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Live Current Date</option>
                                <option value="week-1" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Week -1 History</option>
                                <option value="week-2" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Week -2 History</option>
                                <option value="week-3" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Week -3 History</option>
                                <option value="week-4" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Week -4 History</option>
                                <option value="week-5" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Week -5 History</option>
                            </select>
                        </div>
                    </div>

                    {/* Right: Search & One-Click Exports */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search TL or Manager..."
                                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary outline-none w-48 sm:w-56 shadow-sm"
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
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
                            title="Refresh Data"
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* ADMIN-ONLY QUICK RISK FILTER CHIPS */}
                {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold pt-3 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wider font-extrabold mr-1">Admin Quick Risk Filter:</span>
                        <button
                            onClick={() => setQuickFilter('all')}
                            className={`px-3 py-1 rounded-xl transition-all border ${quickFilter === 'all' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'}`}
                        >
                            All TLs
                        </button>
                        <button
                            onClick={() => setQuickFilter('high_risk')}
                            className={`px-3 py-1 rounded-xl transition-all border ${quickFilter === 'high_risk' ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/30' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25'}`}
                        >
                            🚨 High Risk Only (&gt;8.5%)
                        </button>
                        <button
                            onClick={() => setQuickFilter('low_wallet_risk')}
                            className={`px-3 py-1 rounded-xl transition-all border ${quickFilter === 'low_wallet_risk' ? 'bg-purple-600 text-white border-purple-500 shadow-purple-500/30' : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40 hover:bg-purple-500/25'}`}
                        >
                            ⚠️ Low Wallet Risk (&gt;11%)
                        </button>
                        <button
                            onClick={() => setQuickFilter('zero_negative')}
                            className={`px-3 py-1 rounded-xl transition-all border ${quickFilter === 'zero_negative' ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/30' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'}`}
                        >
                            🟢 Zero Negative TLs
                        </button>
                    </div>
                )}
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
                                    Current Riders Having Low wallet Balance (+0 to +250)
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
                                    <motion.tr 
                                        key={`${row.tlName}-${idx}`}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                                        className="hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all group"
                                    >
                                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100 border-r border-border/50">{row.cityOpsName}</td>
                                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100 text-center border-r border-border/50">{row.rmName}</td>
                                        <td className="p-3 font-black text-slate-950 dark:text-white border-r border-border/50 flex items-center justify-between gap-2">
                                            <span className="truncate group-hover:text-primary transition-colors">{row.tlName}</span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleOpenCellRiders(row, 'all'); }}
                                                className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 shadow-sm transition-all cursor-pointer flex-shrink-0 flex items-center gap-1 text-[11px] font-extrabold group-hover:scale-105"
                                                title="View All Active Riders under this TL"
                                            >
                                                <Eye size={13} /> View
                                            </button>
                                        </td>

                                        {/* Metric Active Riders (Unfiltered Parity with My Riders) */}
                                        <td 
                                            onClick={() => handleOpenCellRiders(row, 'all')}
                                            className="p-3 text-center font-black text-slate-900 dark:text-white border-r border-border/50 font-mono text-sm cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                                            title="Click to view all active riders"
                                        >
                                            {row.activeRiders}
                                        </td>

                                        {/* Metric Negative Count (Clickable to Drill-Down) */}
                                        <td className="p-3 text-center border-r border-border/50 font-mono">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenCellRiders(row, 'negative'); }}
                                                className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-900 dark:text-amber-300 font-black hover:bg-amber-500/30 border border-amber-500/40 shadow-sm transition-all cursor-pointer hover:scale-105"
                                                title="Click to view riders with negative wallet balance"
                                            >
                                                {row.negativeCount}
                                            </button>
                                        </td>

                                        {/* Metric 0 to 250 Range Count (Clickable to Drill-Down) */}
                                        <td className="p-3 text-center border-r border-border/50 font-mono">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenCellRiders(row, 'range0To250'); }}
                                                className="px-3 py-1.5 rounded-xl bg-orange-500/15 text-orange-900 dark:text-orange-300 font-black hover:bg-orange-500/30 border border-orange-500/40 shadow-sm transition-all cursor-pointer hover:scale-105"
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
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* ── INTERACTIVE RIDER DRILL-DOWN MODAL ── */}
            {selectedCellRiders && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[30000] p-3 sm:p-4">
                    <div className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Users className="text-emerald-600 dark:text-emerald-400" size={20} /> {cellModalTitle}
                            </h3>
                            <button
                                onClick={() => setSelectedCellRiders(null)}
                                className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
                            >
                                Close
                            </button>
                        </div>

                        <div className="overflow-y-auto overflow-x-auto flex-1 p-4 sm:p-5">
                            {selectedCellRiders.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                                    No riders found matching this criteria.
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                                            <th className="p-3">Rider Name</th>
                                            <th className="p-3">TriEV ID</th>
                                            <th className="p-3">Mobile</th>
                                            <th className="p-3">Chassis No</th>
                                            <th className="p-3 text-right">Wallet Balance</th>
                                            <th className="p-3 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {selectedCellRiders.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                                                <td className="p-3 font-bold text-slate-900 dark:text-white capitalize">{r.riderName}</td>
                                                <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{r.trievId}</td>
                                                <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{r.mobileNumber}</td>
                                                <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{r.chassisNumber || '—'}</td>
                                                <td className={`p-3 font-mono font-black text-right ${r.walletAmount < 0 ? 'text-rose-600 dark:text-rose-400' : r.walletAmount < 250 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    ₹{r.walletAmount.toLocaleString('en-IN')}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => setDetailRider(r)}
                                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer"
                                                    >
                                                        Inspect Profile
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── RIDER DETAILS MODAL ── */}
            {detailRider && (
                <RiderDetailsModal
                    rider={detailRider}
                    onClose={() => setDetailRider(null)}
                    onUpdate={() => fetchData(true)}
                />
            )}

        </div>
    );
};

export default TLRiskWalletMatrix;
