import React from 'react';
import TLRiskWalletMatrix from '@/components/dashboard/TLRiskWalletMatrix';
import { Sliders, Sparkles } from 'lucide-react';

const RiskMatrixPage: React.FC = () => {
    return (
        <div className="p-3 sm:p-6 space-y-6 max-w-[1700px] mx-auto animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                            <Sliders className="text-emerald-500" size={26} />
                            TL Risk & Wallet Matrix Dashboard
                        </h1>
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                            <Sparkles size={11} /> Live Aggregation
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1.5">
                        Performance matrix, negative wallet tracking, 5-week historical trends, automated daily snapshots, and risk heatmaps.
                    </p>
                </div>
            </div>

            {/* Matrix Component */}
            <TLRiskWalletMatrix />
        </div>
    );
};

export default RiskMatrixPage;
