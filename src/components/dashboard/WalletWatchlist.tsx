import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp, Eye, Skull, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Rider } from '@/types';

interface WalletWatchlistProps {
    riders: Rider[];
}

const WalletWatchlist: React.FC<WalletWatchlistProps> = ({ riders }) => {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(true);

    const watchlistRiders = useMemo(() => {
        const active = riders.filter(r => r.status === 'active' && r.walletAmount < 0);
        return active
            .sort((a, b) => a.walletAmount - b.walletAmount) // most negative first
            .slice(0, 10)
            .map(r => {
                const now = new Date();
                const allotDate = r.allotmentDate || (r as any).allotment_date;
                const daysSinceAllot = allotDate ? Math.floor((now.getTime() - new Date(allotDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                return {
                    id: r.id,
                    name: r.riderName || (r as any).rider_name || 'Unknown',
                    trievId: r.trievId || (r as any).triev_id || '',
                    wallet: r.walletAmount,
                    tenure: daysSinceAllot,
                    severity: r.walletAmount < -3000 ? 'critical' : r.walletAmount < -1000 ? 'high' : 'medium',
                };
            });
    }, [riders]);

    if (watchlistRiders.length === 0) return null;

    const severityConfig = {
        critical: { bg: 'bg-red-500/8 dark:bg-red-900/15', border: 'border-red-500/15', text: 'text-red-600 dark:text-red-400', icon: Skull, badge: 'bg-red-500 text-white' },
        high: { bg: 'bg-orange-500/8 dark:bg-orange-900/15', border: 'border-orange-500/15', text: 'text-orange-600 dark:text-orange-400', icon: AlertTriangle, badge: 'bg-orange-500 text-white' },
        medium: { bg: 'bg-amber-500/8 dark:bg-amber-900/15', border: 'border-amber-500/15', text: 'text-amber-600 dark:text-amber-400', icon: Shield, badge: 'bg-amber-500 text-white' },
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-900/20 dark:border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 shadow-2xl shadow-slate-900/30"
        >
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

            {/* Header */}
            <div
                className="relative z-10 flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500 blur-lg opacity-40 rounded-full animate-pulse" />
                        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30 border border-white/10">
                            <AlertTriangle size={14} className="text-white sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-black text-white tracking-tight">Wallet Watchlist</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Top {watchlistRiders.length} Most At-Risk Riders</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-[10px] font-black text-red-400 tabular-nums">
                        {watchlistRiders.length} riders
                    </span>
                    {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </div>

            {/* Watchlist Table */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-1.5">
                            {/* Column Headers */}
                            <div className="grid grid-cols-12 gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500 px-3 py-1.5">
                                <span className="col-span-1">#</span>
                                <span className="col-span-4">Rider</span>
                                <span className="col-span-2 text-right">Wallet</span>
                                <span className="col-span-2 text-center">Tenure</span>
                                <span className="col-span-2 text-center">Risk</span>
                                <span className="col-span-1 text-center">Act</span>
                            </div>

                            {watchlistRiders.map((rider, idx) => {
                                const config = severityConfig[rider.severity as keyof typeof severityConfig];
                                const SevIcon = config.icon;
                                return (
                                    <motion.div
                                        key={rider.id}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className={`
                                            grid grid-cols-12 gap-2 items-center
                                            ${config.bg} border ${config.border}
                                            rounded-xl px-3 py-2.5
                                            hover:bg-white/[0.05] hover:scale-[1.01] transition-all duration-200
                                            group cursor-pointer
                                        `}
                                        onClick={() => navigate(`/portal/riders`)}
                                    >
                                        <span className="col-span-1 text-xs font-black text-slate-500 tabular-nums">{idx + 1}</span>
                                        <div className="col-span-4 min-w-0">
                                            <p className="text-xs font-black text-white truncate">{rider.name}</p>
                                            <p className="text-[9px] font-medium text-slate-500 truncate">{rider.trievId}</p>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <span className={`text-sm font-black tabular-nums ${config.text}`}>
                                                ₹{rider.wallet.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <span className="text-xs font-bold text-slate-400 tabular-nums">{rider.tenure}d</span>
                                        </div>
                                        <div className="col-span-2 flex justify-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${config.badge}`}>
                                                <SevIcon size={8} />
                                                {rider.severity}
                                            </span>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <Eye size={13} className="text-slate-500 group-hover:text-white transition-colors" />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default WalletWatchlist;
