import React from 'react';
import TLRiskWalletMatrix from '@/components/dashboard/TLRiskWalletMatrix';
import { Sliders, Sparkles } from 'lucide-react';

const RiskMatrixPage: React.FC = () => {
    return (
        <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1700px] mx-auto animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 border-b border-border/50 pb-3 sm:pb-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            <Sliders className="text-emerald-500 flex-shrink-0" size={24} />
                            <span>TL Risk &amp; Wallet Matrix</span>
                        </h1>
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold px-2 sm:px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                            <Sparkles size={11} /> Live Aggregation
                        </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">
                        Performance matrix, negative wallet tracking, 5-week historical trends, automated snapshots, and risk heatmaps.
                    </p>

                    {/* ── COLOR LEGEND ── */}
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Row Health:</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            🔴 Critical — Negative &gt;8.5%
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            🟡 Warning — Some Negative / Low Wallet
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            🟢 Healthy — Zero Risk
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-400/30">
                            Wallet Range: &lt;₹0 Red · ₹0–₹249 Yellow · ≥₹250 Green
                        </span>
                    </div>
                </div>
            </div>

            {/* Matrix Component */}
            <TLRiskWalletMatrix />
        </div>
    );
};

export default RiskMatrixPage;
