import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import { ChevronDown, ChevronRight, Activity, AlertTriangle, Search, Filter, Download, Maximize2, Minimize2 } from 'lucide-react';

interface BracketStats {
    b100: number; // 0 to -100
    b200: number; // -101 to -200
    b500: number; // -201 to -500
    b1000: number; // -501 to -1000
    bMax: number;  // < -1000
    totalNegativeCount: number;
    totalAmountDebt: number;
    totalActiveRiders: number;
}

interface RiderInfo {
    id: string;
    trievId: string;
    riderName: string;
    mobileNumber: string;
    walletAmount: number;
}

interface TLBifurcation extends BracketStats {
    tlId: string;
    tlName: string;
    negativeRiders: RiderInfo[];
    isExpanded: boolean;
}

interface RMBifurcation extends BracketStats {
    rmId: string;
    rmName: string;
    tls: TLBifurcation[];
    isExpanded: boolean;
}

const AdminWalletBifurcation: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [originalRmData, setOriginalRmData] = useState<RMBifurcation[]>([]);
    const [globalStats, setGlobalStats] = useState<BracketStats | null>(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRmFilter, setSelectedRmFilter] = useState('');
    
    // Expanded states (since filters recreate arrays, keep track of expanded IDs)
    const [expandedRms, setExpandedRms] = useState<Set<string>>(new Set());
    const [expandedTls, setExpandedTls] = useState<Set<string>>(new Set());

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, ridersRes] = await Promise.all([
                supabase.from('users').select('id, full_name, role, reporting_manager').in('role', ['reportingManager', 'teamLeader']).eq('status', 'active'),
                fetchAllRidersPaginated('id, triev_id, rider_name, mobile_number, status, wallet_amount, team_leader_id')
            ]);
            
            const users = usersRes.data || [];
            const activeRiders = (ridersRes.data || []).filter(r => r.status === 'active');

            const rms = users.filter((u: any) => u.role === 'reportingManager');
            const tls = users.filter((u: any) => u.role === 'teamLeader');
            
            const calculateBrackets = (riderList: any[]): BracketStats => {
                let b100=0, b200=0, b500=0, b1000=0, bMax=0, totalDebt=0, negCount=0;
                riderList.forEach(r => {
                    const w = r.wallet_amount || 0;
                    if (w < 0) {
                        negCount++;
                        totalDebt += Math.abs(w);
                        if (w >= -100) b100++;
                        else if (w >= -200) b200++;
                        else if (w >= -500) b500++;
                        else if (w >= -1000) b1000++;
                        else bMax++;
                    }
                });
                return { b100, b200, b500, b1000, bMax, totalAmountDebt: totalDebt, totalNegativeCount: negCount, totalActiveRiders: riderList.length };
            };

            const computedRMs: RMBifurcation[] = rms.map((rm: any) => {
                // Fix: reporting_manager stores the RM's full_name
                const rmNameNorm = (rm.full_name || '').trim().toLowerCase();
                const myTls = tls.filter((tl: any) => (tl.reporting_manager || '').trim().toLowerCase() === rmNameNorm);
                
                const tlStats: TLBifurcation[] = myTls.map((tl: any) => {
                    const tlRiders = activeRiders.filter(r => r.team_leader_id === tl.id);
                    
                    const negativeRiders = tlRiders
                        .filter(r => (r.wallet_amount || 0) < 0)
                        .map(r => ({
                            id: r.id,
                            trievId: r.triev_id || 'N/A',
                            riderName: r.rider_name || 'Unknown',
                            mobileNumber: r.mobile_number || 'N/A',
                            walletAmount: r.wallet_amount || 0
                        }))
                        .sort((a,b) => a.walletAmount - b.walletAmount); // Most negative first

                    return { 
                        tlId: tl.id, 
                        tlName: tl.full_name, 
                        negativeRiders,
                        isExpanded: false,
                        ...calculateBrackets(tlRiders) 
                    };
                }).filter(t => t.totalActiveRiders > 0);

                const validTlIds = new Set(myTls.map((t:any) => t.id));
                const rmRiders = activeRiders.filter(r => validTlIds.has(r.team_leader_id));
                
                return {
                    rmId: rm.id,
                    rmName: rm.full_name,
                    tls: tlStats.sort((a,b) => b.totalAmountDebt - a.totalAmountDebt),
                    isExpanded: false,
                    ...calculateBrackets(rmRiders)
                };
            }).filter(rm => rm.totalActiveRiders > 0).sort((a,b) => b.totalAmountDebt - a.totalAmountDebt);

            setGlobalStats(calculateBrackets(activeRiders));
            setOriginalRmData(computedRMs);
            
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const sub = supabase.channel('bifurcation-admin').on('postgres_changes', { event:'*', schema:'public', table:'riders' }, fetchData).subscribe();
        return () => { supabase.removeChannel(sub); };
    }, []);

    const toggleRmRow = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedRms(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleTlRow = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedTls(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const rmNamesDropdown = useMemo(() => {
        return originalRmData.map(rm => rm.rmName).sort();
    }, [originalRmData]);

    const filteredData = useMemo(() => {
        let result = originalRmData;

        if (selectedRmFilter) {
            result = result.filter(rm => rm.rmName === selectedRmFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.map(rm => {
                const matchRm = rm.rmName.toLowerCase().includes(q);
                // Filter TLs inside
                const matchedTls = rm.tls.filter(tl => tl.tlName.toLowerCase().includes(q) || matchRm);
                return {
                    ...rm,
                    tls: matchedTls
                };
            }).filter(rm => rm.tls.length > 0 || rm.rmName.toLowerCase().includes(q));
        }

        return result;
    }, [originalRmData, selectedRmFilter, searchQuery]);

    const isAnyExpanded = expandedRms.size > 0 || expandedTls.size > 0;

    const toggleExpandAll = () => {
        if (isAnyExpanded) {
            setExpandedRms(new Set());
            setExpandedTls(new Set());
        } else {
            const newRms = new Set<string>();
            const newTls = new Set<string>();
            filteredData.forEach(rm => {
                newRms.add(rm.rmId);
                rm.tls.forEach(tl => newTls.add(tl.tlId));
            });
            setExpandedRms(newRms);
            setExpandedTls(newTls);
        }
    };

    const handleExport = () => {
        const headers = [
            "Level", 
            "Reporting Manager", 
            "Team Leader", 
            "Rider Name", 
            "Triev ID", 
            "Mobile", 
            "Active Riders", 
            "(0 to -100)", 
            "(-101 to -200)", 
            "(-201 to -500)", 
            "(-501 to -1000)", 
            "(< -1000)", 
            "Total Defaulters", 
            "Total Debt Amount (INR)"
        ];

        const rows: any[] = [];
        
        filteredData.forEach(rm => {
            // RM Level Row
            rows.push([
                "Reporting Manager Summary",
                rm.rmName,
                "-",
                "-",
                "-",
                "-",
                rm.totalActiveRiders,
                rm.b100,
                rm.b200,
                rm.b500,
                rm.b1000,
                rm.bMax,
                rm.totalNegativeCount,
                rm.totalAmountDebt
            ]);

            rm.tls.forEach(tl => {
                // TL Level Row
                rows.push([
                    "Team Leader Summary",
                    rm.rmName,
                    tl.tlName,
                    "-",
                    "-",
                    "-",
                    tl.totalActiveRiders,
                    tl.b100,
                    tl.b200,
                    tl.b500,
                    tl.b1000,
                    tl.bMax,
                    tl.totalNegativeCount,
                    tl.totalAmountDebt
                ]);

                // Rider Level Rows
                tl.negativeRiders.forEach(rider => {
                    rows.push([
                        "Defaulter Rider",
                        rm.rmName,
                        tl.tlName,
                        rider.riderName,
                        rider.trievId,
                        rider.mobileNumber,
                        "-",
                        "-",
                        "-",
                        "-",
                        "-",
                        "-",
                        "-",
                        Math.abs(rider.walletAmount)
                    ]);
                });
            });
        });

        // Convert to CSV
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(v => `"${v}"`).join(","))
        ].join("\n");

        // Download logic
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Wallet_Bifurcation_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className="p-8 pb-[100px] text-center text-sm animate-pulse flex flex-col items-center justify-center"><Activity className="animate-pulse mb-3 text-indigo-500" />Loading Wallet Health Bifurcation...</div>;

    const renderBracket = (val: number, isCritical=false) => (
        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${val > 0 ? (isCritical ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300') : 'text-muted-foreground/40'}`}>
            {val || '-'}
        </span>
    );

    return (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-6 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                        <Activity className="text-violet-600 dark:text-violet-400" size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-foreground">Advanced Wallet Bifurcation</h3>
                        <p className="text-xs text-muted-foreground">Hierarchical Debt Liability analysis (RM &rarr; TL &rarr; Rider)</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <input 
                            type="text"
                            placeholder="Search RM or TL..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-48"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <select
                            value={selectedRmFilter}
                            onChange={(e) => setSelectedRmFilter(e.target.value)}
                            className="pl-9 pr-8 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer w-full md:w-48"
                        >
                            <option value="">All Reporting Managers</option>
                            {rmNamesDropdown.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                    </div>
                    
                    <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
                        <button 
                            onClick={toggleExpandAll}
                            className="p-1.5 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors flex items-center justify-center border border-transparent hover:border-border"
                            title={isAnyExpanded ? "Collapse All" : "Expand All Arrays"}
                        >
                            {isAnyExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        
                        <button 
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm active:scale-95"
                        >
                            <Download size={14} />
                            <span>Export CSV</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Overall Distribution Grid */}
            {globalStats && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center flex-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Active</span>
                        <span className="text-lg font-black">{globalStats.totalActiveRiders}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">0 to -100</span>
                        <span className="text-lg font-black">{globalStats.b100}</span>
                        {globalStats.totalActiveRiders > 0 && <span className="text-[9px] text-muted-foreground mt-0.5">{Math.round((globalStats.b100/globalStats.totalActiveRiders)*100)}% active</span>}
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-200 dark:border-orange-900/30 flex flex-col items-center">
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">-101 to -200</span>
                        <span className="text-lg font-black text-orange-600 dark:text-orange-400">{globalStats.b200}</span>
                        {globalStats.totalActiveRiders > 0 && <span className="text-[9px] text-muted-foreground mt-0.5">{Math.round((globalStats.b200/globalStats.totalActiveRiders)*100)}% active</span>}
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-200 dark:border-rose-900/30 flex flex-col items-center">
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">-201 to -500</span>
                        <span className="text-lg font-black text-rose-600 dark:text-rose-400">{globalStats.b500}</span>
                        {globalStats.totalActiveRiders > 0 && <span className="text-[9px] text-muted-foreground mt-0.5">{Math.round((globalStats.b500/globalStats.totalActiveRiders)*100)}% active</span>}
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-900/30 flex flex-col items-center flex-1">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">-501 to -1000</span>
                        <span className="text-lg font-black text-red-600 dark:text-red-400">{globalStats.b1000}</span>
                        {globalStats.totalActiveRiders > 0 && <span className="text-[9px] text-muted-foreground mt-0.5">{Math.round((globalStats.b1000/globalStats.totalActiveRiders)*100)}% active</span>}
                    </div>
                    <div className="bg-rose-100 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-300 dark:border-rose-900/50 flex flex-col items-center relative overflow-hidden flex-1 shadow-inner">
                        <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1"><AlertTriangle size={10} /> &lt; -1000</span>
                        <span className="text-xl font-black text-rose-700 dark:text-rose-300 relative z-10">{globalStats.bMax}</span>
                        {globalStats.totalActiveRiders > 0 && <span className="text-[9px] text-rose-600 font-bold mt-0.5 relative z-10">{Math.round((globalStats.bMax/globalStats.totalActiveRiders)*100)}% active</span>}
                    </div>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3">Reporting Manager / TL</th>
                            <th className="px-3 py-3 text-center">Active</th>
                            <th className="px-3 py-3 text-center">(-100)</th>
                            <th className="px-3 py-3 text-center">(-200)</th>
                            <th className="px-3 py-3 text-center">(-500)</th>
                            <th className="px-3 py-3 text-center">(-1000)</th>
                            <th className="px-3 py-3 text-center text-rose-500">&lt; -1000</th>
                            <th className="px-4 py-3 text-right">Total Debt</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {filteredData.map(rm => {
                            const rmExpanded = expandedRms.has(rm.rmId);
                            return (
                            <React.Fragment key={rm.rmId}>
                                <tr 
                                    onClick={(e) => toggleRmRow(rm.rmId, e)}
                                    className="hover:bg-muted/20 cursor-pointer transition-colors group"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {rmExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                                            <div className="w-6 h-6 rounded bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 dark:text-violet-400 font-bold text-[10px]">
                                                {rm.rmName.charAt(0)}
                                            </div>
                                            <span className="font-bold text-foreground group-hover:text-primary transition-colors">{rm.rmName}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-center font-bold text-muted-foreground">{rm.totalActiveRiders}</td>
                                    <td className="px-3 py-3 text-center">{renderBracket(rm.b100)}</td>
                                    <td className="px-3 py-3 text-center">{renderBracket(rm.b200)}</td>
                                    <td className="px-3 py-3 text-center">{renderBracket(rm.b500)}</td>
                                    <td className="px-3 py-3 text-center">{renderBracket(rm.b1000, true)}</td>
                                    <td className="px-3 py-3 text-center">{renderBracket(rm.bMax, true)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-rose-600 dark:text-rose-400">₹{rm.totalAmountDebt.toLocaleString('en-IN')}</span>
                                            {rm.totalActiveRiders > 0 && (
                                                <span className="text-[9px] text-muted-foreground font-medium">
                                                    {Math.round((rm.totalNegativeCount / rm.totalActiveRiders) * 100)}% default
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {rmExpanded && rm.tls.map(tl => {
                                    const tlExpanded = expandedTls.has(tl.tlId);
                                    return (
                                    <React.Fragment key={tl.tlId}>
                                        <tr 
                                            onClick={(e) => toggleTlRow(tl.tlId, e)}
                                            className="bg-muted/10 hover:bg-muted/30 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-4 py-2 pl-12 flex items-center gap-2">
                                                {tlExpanded ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground/60 group-hover:text-muted-foreground" />}
                                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-medium text-[9px]">
                                                    {tl.tlName.charAt(0)}
                                                </div>
                                                <span className="text-[13px] font-medium text-muted-foreground">{tl.tlName}</span>
                                            </td>
                                            <td className="px-3 py-2 text-center text-xs text-muted-foreground/80">{tl.totalActiveRiders}</td>
                                            <td className="px-3 py-2 text-center">{renderBracket(tl.b100)}</td>
                                            <td className="px-3 py-2 text-center">{renderBracket(tl.b200)}</td>
                                            <td className="px-3 py-2 text-center">{renderBracket(tl.b500)}</td>
                                            <td className="px-3 py-2 text-center">{renderBracket(tl.b1000, true)}</td>
                                            <td className="px-3 py-2 text-center">{renderBracket(tl.bMax, true)}</td>
                                            <td className="px-4 py-2 text-right">
                                                <span className="font-bold text-xs text-rose-500">₹{tl.totalAmountDebt.toLocaleString('en-IN')}</span>
                                                {tl.totalActiveRiders > 0 && <span className="block text-[8px] text-muted-foreground font-medium">{Math.round((tl.totalNegativeCount / tl.totalActiveRiders) * 100)}%</span>}
                                            </td>
                                        </tr>
                                        {/* Nested Rider List for this TL */}
                                        {tlExpanded && tl.negativeRiders.length > 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-3 bg-card border-b border-border/40">
                                                    <div className="pl-14 pr-2">
                                                        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-border p-3 overflow-hidden shadow-sm">
                                                            <div className="flex items-center gap-2 mb-3 px-1">
                                                                <AlertTriangle size={14} className="text-rose-500" />
                                                                <h4 className="text-xs font-bold text-foreground">Defaulter Riders for {tl.tlName} ({tl.negativeRiders.length})</h4>
                                                            </div>
                                                            <div className="max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {tl.negativeRiders.map(rider => (
                                                                        <div key={rider.id} className="flex justify-between items-center p-2 rounded bg-background border border-border hover:border-border/80 hover:shadow-sm transition-all group">
                                                                            <div className="flex flex-col overflow-hidden">
                                                                                <span className="text-[11px] font-bold text-foreground truncate block">{rider.riderName}</span>
                                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                                                    <span className="bg-muted px-1 rounded text-[9px] font-mono">{rider.trievId}</span> {rider.mobileNumber}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-xs font-black text-rose-600 dark:text-rose-400 shrink-0 ml-3">
                                                                                ₹{rider.walletAmount.toLocaleString('en-IN')}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {tlExpanded && tl.negativeRiders.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-3 bg-card text-center text-xs text-muted-foreground/60 italic border-b border-border/40">
                                                    No riders with negative wallet balance under this Team Leader.
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                            );
                        })}
                        {filteredData.length === 0 && !loading && (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No records found matching your filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminWalletBifurcation;
