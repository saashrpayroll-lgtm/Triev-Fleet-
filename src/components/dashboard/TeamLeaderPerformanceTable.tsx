import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, ChevronRight, MoreHorizontal
} from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../ui/dropdown-menu';

export interface TLSnapshot {
    id: string;
    name: string;
    email: string;
    totalRiders: number;
    activeRiders: number;
    wallet: {
        total: number;
        positiveCount: number;
        negativeCount: number;
        negativeAmount: number;
    };
    leads: {
        total: number;
        converted: number;
        conversionRate: number;
    };
    status: string;
    totalCollection: number; // New field
}

interface TeamLeaderPerformanceTableProps {
    data: TLSnapshot[];
}

const TeamLeaderPerformanceTable: React.FC<TeamLeaderPerformanceTableProps> = ({ data }) => {
    const navigate = useNavigate();
    const [sortConfig, setSortConfig] = useState<{ key: keyof TLSnapshot | 'walletDiff' | 'totalCollection', direction: 'asc' | 'desc' } | null>(null);

    const sortedData = React.useMemo(() => {
        let sortable = [...data];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof TLSnapshot];
                let bValue: any = b[sortConfig.key as keyof TLSnapshot];

                if (sortConfig.key === 'walletDiff' as any) {
                    aValue = a.wallet.total;
                    bValue = b.wallet.total;
                } else if (sortConfig.key === 'totalCollection' as any) {
                    aValue = a.totalCollection;
                    bValue = b.totalCollection;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        } else {
            // Default sort by Active Riders desc
            sortable.sort((a, b) => b.activeRiders - a.activeRiders);
        }
        return sortable;
    }, [data, sortConfig]);

    const handleSort = (key: any) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-700">
            <div className="p-6 border-b flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Users className="text-indigo-500" size={20} />
                        Team Leader Performance
                    </h3>
                    <p className="text-sm text-muted-foreground">Real-time metrics per supervisor</p>
                </div>
                <button
                    onClick={() => navigate('/portal/users', { state: { filter: 'teamLeader' } })}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                    View All <ChevronRight size={14} />
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-muted/50 text-left border-b">
                            <th className="p-4 font-medium text-muted-foreground w-[250px]">Team Leader</th>
                            <th className="p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('activeRiders')}>
                                Riders (Active)
                            </th>
                            <th className="p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('walletDiff')}>
                                Wallet Health
                            </th>
                            <th className="p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('totalCollection')}>
                                Collection
                            </th>
                            <th className="p-4 font-medium text-muted-foreground">
                                Lead Conversion
                            </th>
                            <th className="p-4 font-medium text-muted-foreground text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((tl) => (
                            <tr key={tl.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                            {tl.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground">{tl.name}</p>
                                            <p className="text-xs text-muted-foreground">{tl.email}</p>
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-lg">{tl.activeRiders} <span className="text-xs font-normal text-muted-foreground">/ {tl.totalRiders}</span></span>
                                        <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${tl.totalRiders > 0 ? (tl.activeRiders / tl.totalRiders) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">{tl.wallet.positiveCount} Positive</span>
                                            <span className="text-rose-600 font-medium bg-rose-50 px-1.5 py-0.5 rounded">{tl.wallet.negativeCount} Negative</span>
                                        </div>
                                        <div className="text-xs font-medium text-muted-foreground">
                                            Risk: <span className="text-rose-500">₹{Math.abs(tl.wallet.negativeAmount).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="font-bold text-green-600">
                                        ₹{tl.totalCollection.toLocaleString()}
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-10 h-10">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted/30" />
                                                <circle
                                                    cx="20" cy="20" r="16"
                                                    stroke="currentColor" strokeWidth="4" fill="transparent"
                                                    strokeDasharray={100}
                                                    strokeDashoffset={100 - tl.leads.conversionRate}
                                                    className="text-fuchsia-500"
                                                />
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                                                {tl.leads.conversionRate}%
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            <p>{tl.leads.converted} Converted</p>
                                            <p>{tl.leads.total - tl.leads.converted} Pipeline</p>
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger className="p-2 hover:bg-muted rounded-full">
                                            <MoreHorizontal size={16} />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => navigate('/portal/riders', { state: { filter: 'teamLeader', value: tl.id } })}>
                                                View Riders
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate('/portal/leads', { state: { filter: 'teamLeader', value: tl.id } })}>
                                                View Leads
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sortedData.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        No active Team Leaders found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamLeaderPerformanceTable;
