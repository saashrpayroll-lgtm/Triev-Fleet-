import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import { ChevronDown, ChevronRight, Activity, AlertTriangle } from 'lucide-react';

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

interface TLBifurcation extends BracketStats {
    tlId: string;
    tlName: string;
}

interface RMBifurcation extends BracketStats {
    rmId: string;
    rmName: string;
    tls: TLBifurcation[];
    isExpanded: boolean;
}

const AdminWalletBifurcation: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [rmData, setRmData] = useState<RMBifurcation[]>([]);
    const [globalStats, setGlobalStats] = useState<BracketStats | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, ridersRes] = await Promise.all([
                supabase.from('users').select('id, full_name, role, reporting_manager').in('role', ['reportingManager', 'teamLeader']).eq('status', 'active'),
                fetchAllRidersPaginated('id, status, wallet_amount, team_leader_id')
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
                const myTls = tls.filter((tl: any) => tl.reporting_manager === rm.id);
                
                const tlStats: TLBifurcation[] = myTls.map((tl: any) => {
                    const tlRiders = activeRiders.filter(r => r.team_leader_id === tl.id);
                    return { tlId: tl.id, tlName: tl.full_name, ...calculateBrackets(tlRiders) };
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
            setRmData(computedRMs);
            
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

    const toggleRow = (id: string) => {
        setRmData(prev => prev.map(rm => rm.rmId === id ? { ...rm, isExpanded: !rm.isExpanded } : rm));
    };

    if (loading) return <div className="p-8 pb-[100px] text-center text-sm animate-pulse flex flex-col items-center justify-center"><Activity className="animate-pulse mb-3 text-indigo-500" />Loading Wallet Health Bifurcation...</div>;

    const renderBracket = (val: number, isCritical=false) => (
        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${val > 0 ? (isCritical ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300') : 'text-muted-foreground/40'}`}>
            {val || '-'}
        </span>
    );

    return (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-6 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                        <Activity className="text-violet-600 dark:text-violet-400" size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-foreground">Advanced Wallet Bifurcation</h3>
                        <p className="text-xs text-muted-foreground">Hierarchical Debt Liability analysis (RM & TL wise)</p>
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
                        {rmData.map(rm => (
                            <React.Fragment key={rm.rmId}>
                                <tr 
                                    onClick={() => toggleRow(rm.rmId)}
                                    className="hover:bg-muted/20 cursor-pointer transition-colors group"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {rm.isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
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
                                {rm.isExpanded && rm.tls.map(tl => (
                                    <tr key={tl.tlId} className="bg-muted/10 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-2 pl-12 flex items-center gap-2">
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
                                ))}
                            </React.Fragment>
                        ))}
                        {rmData.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No reporting managers found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminWalletBifurcation;
