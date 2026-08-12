import React from 'react';
import TLRiskWalletMatrix from '@/components/dashboard/TLRiskWalletMatrix';

const RiskMatrixPage: React.FC = () => {
    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                        TL Risk & Wallet Matrix Dashboard
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Performance matrix, negative balance tracking, 5-week historical trends, and risk heatmaps.
                    </p>
                </div>
            </div>

            {/* Matrix Component */}
            <TLRiskWalletMatrix />
        </div>
    );
};

export default RiskMatrixPage;
