import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Skull, Wallet, Users, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ZomatoVIPSectionProps {
    stats: {
        zomatoTotal: number;
        zomatoPosCount: number;
        zomatoNegCount: number;
        zomatoLowBalance: number;
        zomatoHighDebt: number;
        zomatoWalletTotal: number;
        zomatoAvgWallet: number;
        zomatoPosAmt: number;
        zomatoNegAmt: number;
    };
}

const miniCards = [
    { key: 'pos', label: 'Positive Wallets', icon: TrendingUp, color: 'emerald', gradient: 'from-emerald-500 to-emerald-600' },
    { key: 'neg', label: 'Negative Wallets', icon: TrendingDown, color: 'rose', gradient: 'from-rose-500 to-rose-600' },
    { key: 'low', label: 'Low Balance (0-250)', icon: AlertTriangle, color: 'amber', gradient: 'from-amber-500 to-amber-600' },
    { key: 'debt', label: 'High Debt (>₹3K)', icon: Skull, color: 'red', gradient: 'from-red-500 to-red-600' },
] as const;

const ZomatoVIPSection: React.FC<ZomatoVIPSectionProps> = ({ stats }) => {
    const navigate = useNavigate();

    const getVal = (key: string) => {
        switch (key) {
            case 'pos': return stats.zomatoPosCount;
            case 'neg': return stats.zomatoNegCount;
            case 'low': return stats.zomatoLowBalance;
            case 'debt': return stats.zomatoHighDebt;
            default: return 0;
        }
    };

    const getSubtext = (key: string) => {
        switch (key) {
            case 'pos': return `₹${stats.zomatoPosAmt.toLocaleString('en-IN')} total`;
            case 'neg': return `₹${Math.abs(stats.zomatoNegAmt).toLocaleString('en-IN')} risk`;
            case 'low': return 'Needs collection';
            case 'debt': return 'Immediate action';
            default: return '';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="space-y-3 sm:space-y-4"
        >
            {/* Section Header */}
            <div className="flex items-center gap-2.5 sm:gap-3 px-1">
                <div className="relative">
                    <div className="absolute inset-0 bg-orange-500 blur-md opacity-50 rounded-full" />
                    <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/30 border border-white/20">
                        <Sparkles size={12} className="text-white sm:w-4 sm:h-4" />
                    </div>
                </div>
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent dark:from-orange-400 dark:to-red-400">
                    Zomato VIP Intelligence
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-orange-500/40 via-orange-500/10 to-transparent" />
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                    </span>
                    <span className="text-[8px] font-black tracking-widest text-orange-600 dark:text-orange-400 uppercase">Live</span>
                </div>
            </div>

            {/* Main VIP Container */}
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-amber-500/3 to-red-500/5 dark:from-orange-900/15 dark:via-amber-900/10 dark:to-red-900/10 shadow-xl shadow-orange-500/5 backdrop-blur-xl p-4 sm:p-5">
                {/* Background decoration */}
                <div className="absolute -right-16 -top-16 w-56 h-56 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-gradient-to-br from-red-500/8 to-transparent rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row gap-4 lg:gap-5">
                    {/* LEFT: Hero Stats */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                            <motion.div
                                whileHover={{ rotate: [0, -10, 10, 0] }}
                                className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-orange-500/15 to-red-500/15 ring-1 ring-orange-500/25"
                            >
                                <Sparkles className="text-orange-500 w-5 h-5 sm:w-6 sm:h-6" />
                            </motion.div>
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">VIP Fleet</h3>
                                <p className="text-[9px] font-bold text-muted-foreground">Series: P6DSVFMSP</p>
                            </div>
                        </div>

                        {/* Big number */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, type: 'spring' }}
                            className="mb-3"
                        >
                            <p className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                                {stats.zomatoTotal}
                                <span className="text-sm font-black text-muted-foreground ml-2">riders</span>
                            </p>
                        </motion.div>

                        {/* Hero KPIs */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-2.5 border border-white/30 dark:border-white/5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Wallet size={10} className="text-orange-500" />
                                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">Net Wallet</span>
                                </div>
                                <p className={`text-sm sm:text-base font-black tabular-nums ${stats.zomatoWalletTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ₹{stats.zomatoWalletTotal.toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-2.5 border border-white/30 dark:border-white/5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Users size={10} className="text-orange-500" />
                                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">Avg/VIP</span>
                                </div>
                                <p className={`text-sm sm:text-base font-black tabular-nums ${stats.zomatoAvgWallet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ₹{stats.zomatoAvgWallet.toLocaleString('en-IN')}
                                </p>
                            </div>
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                onClick={() => navigate('/portal/riders?filter=zomato')}
                                className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-2.5 cursor-pointer flex flex-col justify-center items-center shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-shadow"
                            >
                                <ArrowRight size={16} className="text-white mb-1" />
                                <span className="text-[8px] font-black text-white/90 uppercase tracking-wider">View All</span>
                            </motion.div>
                        </div>
                    </div>

                    {/* RIGHT: 4 Mini Stat Cards in 2x2 grid */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:w-[340px] xl:w-[380px]">
                        {miniCards.map((card, i) => {
                            const val = getVal(card.key);
                            const subtext = getSubtext(card.key);
                            const Icon = card.icon;
                            const isAlert = (card.key === 'neg' || card.key === 'debt') && val > 0;

                            return (
                                <motion.div
                                    key={card.key}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + i * 0.05 }}
                                    whileHover={{ y: -4, scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => navigate('/portal/riders?filter=zomato')}
                                    className={`
                                        relative overflow-hidden rounded-xl p-3 cursor-pointer group
                                        bg-white/60 dark:bg-slate-800/60 backdrop-blur-md
                                        border border-${card.color}-500/20 hover:border-${card.color}-500/40
                                        shadow-sm hover:shadow-lg hover:shadow-${card.color}-500/15
                                        transition-all duration-300
                                        ${isAlert ? 'ring-1 ring-' + card.color + '-500/30 animate-pulse' : ''}
                                    `}
                                >
                                    {/* Hover gradient overlay */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-xl`} />

                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className={`p-1.5 rounded-lg bg-${card.color}-500/10`}>
                                                <Icon size={13} className={`text-${card.color}-500`} />
                                            </div>
                                            <span className={`text-xl sm:text-2xl font-black tabular-nums text-${card.color}-600 dark:text-${card.color}-400`}>
                                                {val}
                                            </span>
                                        </div>
                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground truncate">{card.label}</p>
                                        <p className={`text-[8px] font-bold text-${card.color}-600/70 dark:text-${card.color}-400/70 mt-0.5 truncate`}>{subtext}</p>
                                    </div>

                                    {/* Ghost icon */}
                                    <div className={`absolute -right-2 -bottom-2 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity text-${card.color}-500`}>
                                        <Icon size={48} />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default ZomatoVIPSection;
