import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { Activity, Clock, Database, UploadCloud } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SystemHealthData {
    lastWalletSync: Date | null;
    lastCollectionSync: Date | null;
    lastRiderUpdate: Date | null;
}

export const SystemHealthWidget: React.FC = () => {
    const [healthData, setHealthData] = useState<SystemHealthData>({
        lastWalletSync: null,
        lastCollectionSync: null,
        lastRiderUpdate: null,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                // 1. Last Wallet Sync (RESET)
                const { data: walletData } = await supabase
                    .from('wallet_ledger')
                    .select('created_at')
                    .eq('source_type', 'RESET')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                // 2. Last Collection Sync (Any Collection Type)
                const { data: collectionData } = await supabase
                    .from('wallet_ledger')
                    .select('created_at')
                    .in('transaction_type', ['DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                // 3. Last Rider Update/Import
                const { data: riderData } = await supabase
                    .from('riders')
                    .select('created_at, updated_at')
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .single();

                const getLatestRiderDate = () => {
                    if (!riderData) return null;
                    const cDate = new Date(riderData.created_at);
                    const uDate = new Date(riderData.updated_at);
                    return uDate > cDate ? uDate : cDate;
                };

                setHealthData({
                    lastWalletSync: walletData?.created_at ? new Date(walletData.created_at) : null,
                    lastCollectionSync: collectionData?.created_at ? new Date(collectionData.created_at) : null,
                    lastRiderUpdate: getLatestRiderDate()
                });
            } catch (error) {
                console.error("Error fetching system health:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();

        // Refresh every 5 minutes
        const interval = setInterval(fetchHealth, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const renderTimeAgo = (date: Date | null) => {
        if (!date) return <span className="text-muted-foreground italic text-xs">Never</span>;

        const timeAgo = formatDistanceToNow(date, { addSuffix: true });

        // Coloring based on age
        const hoursDiff = (new Date().getTime() - date.getTime()) / (1000 * 60 * 60);
        let colorClass = "text-green-600 dark:text-green-400 font-medium text-xs"; // < 24h

        if (hoursDiff > 48) {
            colorClass = "text-red-500 font-bold text-xs"; // > 48h
        } else if (hoursDiff > 24) {
            colorClass = "text-orange-500 font-semibold text-xs"; // 24-48h
        }

        return <span className={colorClass}>{timeAgo}</span>;
    };

    if (loading) {
        return (
            <div className="bg-card text-card-foreground rounded-2xl p-5 shadow-sm border animate-pulse flex flex-col h-full">
                <div className="h-6 w-1/2 bg-muted rounded mb-4"></div>
                <div className="space-y-3">
                    <div className="h-10 w-full bg-muted rounded"></div>
                    <div className="h-10 w-full bg-muted rounded"></div>
                    <div className="h-10 w-full bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card text-card-foreground rounded-xl p-5 shadow-sm border flex flex-col h-full">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Activity size={20} className="text-blue-500" />
                System Health
            </h3>

            <div className="space-y-4 flex-grow">
                {/* Master Rider Sync */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Database size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tracking-tight">Master Database</p>
                            <p className="text-xs text-muted-foreground">Rider Profiles</p>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-1.5">
                        <Clock size={12} className="text-muted-foreground" />
                        {renderTimeAgo(healthData.lastRiderUpdate)}
                    </div>
                </div>

                {/* Bulk Update Sync */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <UploadCloud size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tracking-tight">Wallet Reset Sync</p>
                            <p className="text-xs text-muted-foreground">Triev Export Data</p>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-1.5">
                        <Clock size={12} className="text-muted-foreground" />
                        {renderTimeAgo(healthData.lastWalletSync)}
                    </div>
                </div>

                {/* Collections Sync */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <UploadCloud size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tracking-tight">Daily Collections</p>
                            <p className="text-xs text-muted-foreground">Bank Export Data</p>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-1.5">
                        <Clock size={12} className="text-muted-foreground" />
                        {renderTimeAgo(healthData.lastCollectionSync)}
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground text-center">
                Updates every 5 minutes
            </div>
        </div>
    );
};

export default SystemHealthWidget;
