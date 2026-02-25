import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, ChevronRight, MoreHorizontal
} from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../ui/dropdown-menu';

import CollectionHistoryModal from './CollectionHistoryModal';

export interface TLSnapshot {
    id: string;
    name: string;
    email: string;
    totalRiders: number;
    activeRiders: number;
    wallet: {
        total: number;
        positiveCount: number;
        positiveAmount: number;
        negativeCount: number;
        negativeAmount: number;
    };
    leads: {
        total: number;
        converted: number;
        conversionRate: number;
    };
    status: string;
    totalCollection: number;
    dailyCollection: number;
    weeklyCollection: number;
    leadsToday: number;
    churnLeads: number;
    criticalDebtCount: number;
    allotments: number;
    submissions: number;
    netGrowth: number;
    lastActivity?: string;
}

interface TeamLeaderPerformanceTableProps {
    data: TLSnapshot[];
}

const TeamLeaderPerformanceTable: React.FC<TeamLeaderPerformanceTableProps> = ({ data }) => {
    const navigate = useNavigate();
    const [sortConfig, setSortConfig] = useState<{ key: keyof TLSnapshot | 'walletDiff', direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [historyModalData, setHistoryModalData] = useState<{ id: string, name: string } | null>(null);

    const filteredData = React.useMemo(() => {
        let processed = [...data];

        // 1. Filter by Status
        if (filterStatus !== 'all') {
            processed = processed.filter(tl => tl.status === filterStatus);
        }

        // 2. Filter by Search Term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            processed = processed.filter(tl =>
                tl.name.toLowerCase().includes(lowerTerm) ||
                tl.email.toLowerCase().includes(lowerTerm)
            );
        }

        return processed;
    }, [data, filterStatus, searchTerm]);

    const sortedData = React.useMemo(() => {
        let sortable = [...filteredData];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof TLSnapshot];
                let bValue: any = b[sortConfig.key as keyof TLSnapshot];

                if (sortConfig.key === 'walletDiff' as any) {
                    aValue = a.wallet.total;
                    bValue = b.wallet.total;
                } else {
                    aValue = a[sortConfig.key as keyof TLSnapshot];
                    bValue = b[sortConfig.key as keyof TLSnapshot];
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
    }, [filteredData, sortConfig]);

    const handleSort = (key: any) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-700 flex flex-col h-full max-h-[600px]">
            <div className="p-4 border-b space-y-4">
                <div className="flex justify-between items-center">
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

                {/* Advanced Filters Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <input
                            type="text"
                            placeholder="Search Team Leader..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-muted/30 focus:bg-background transition-colors outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="absolute left-3 top-2.5 text-muted-foreground">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        </div>
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e: any) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 text-sm border rounded-lg bg-muted/30 focus:bg-background outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    <div className="text-xs text-muted-foreground ml-auto font-medium">
                        Showing {sortedData.length} of {data.length}
                    </div>
                </div>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-sm relative">
                    <thead className="sticky top-0 z-10 bg-card shadow-sm">
                        <tr className="text-left border-b">
                            <th className="p-4 font-medium text-muted-foreground min-w-[180px] md:w-[250px] bg-card">Team Leader</th>
                            <th className="p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-card" onClick={() => handleSort('activeRiders')}>
                                Riders (Active)
                            </th>
                            <th className="p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-card" onClick={() => handleSort('criticalDebtCount')}>
                                Risk & Critical Dues
                            </th>
                            <th className="p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-card" onClick={() => handleSort('dailyCollection')}>
                                Collections (D/W/T)
                            </th>
                            <th className="p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-card" onClick={() => handleSort('netGrowth')}>
                                Fleet Flow (A/S/N)
                            </th>
                            <th className="p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-card" onClick={() => handleSort('leadsToday')}>
                                Leads Performance
                            </th>
                            <th className="p-4 font-medium text-muted-foreground text-right bg-card">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((tl) => (
                            <tr key={tl.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden border border-indigo-200">
                                                {tl.name.charAt(0)}
                                            </div>
                                            {/* Live Activity Pulse */}
                                            {tl.lastActivity && (new Date().getTime() - new Date(tl.lastActivity).getTime() < 30 * 60 * 1000) && (
                                                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground flex items-center gap-1.5">
                                                {tl.name}
                                                {tl.leadsToday > 2 && <span className="bg-orange-100 text-orange-600 text-[8px] px-1 rounded-sm font-black uppercase tracking-tighter">Hot Sourcing</span>}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">{tl.email}</p>
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base">{tl.activeRiders} <span className="text-xs font-normal text-muted-foreground">/ {tl.totalRiders}</span></span>
                                        <div className="w-20 h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full"
                                                style={{ width: `${tl.totalRiders > 0 ? (tl.activeRiders / tl.totalRiders) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 italic whitespace-nowrap">
                                                {tl.wallet.positiveCount} POSITIVE
                                            </span>
                                            <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100 italic whitespace-nowrap">
                                                {tl.wallet.negativeCount} NEGATIVE
                                            </span>
                                            {tl.criticalDebtCount > 0 && (
                                                <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse shadow-sm whitespace-nowrap">
                                                    {tl.criticalDebtCount} CRITICAL
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-2 text-xs font-bold">
                                            <span className="text-emerald-500">Vol: ₹{tl.wallet.positiveAmount.toLocaleString()}</span>
                                            <span className="text-rose-500">Risk: ₹{Math.abs(tl.wallet.negativeAmount).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="space-y-1">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Today</span>
                                            <span className="text-sm font-black text-emerald-600">₹{tl.dailyCollection.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-4 border-t border-muted/50 pt-1">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] text-muted-foreground font-medium uppercase">Weekly</span>
                                                <span className="text-[11px] font-bold text-foreground/80">₹{tl.weeklyCollection.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[8px] text-muted-foreground font-medium uppercase">Total</span>
                                                <span className="text-[11px] font-bold text-foreground/60">₹{tl.totalCollection.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="space-y-1">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Net Growth</span>
                                            <span className={`text-sm font-black ${tl.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tl.netGrowth > 0 ? '+' : ''}{tl.netGrowth}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center gap-4 border-t border-muted/50 pt-1">
                                            <div className="flex flex-col text-left">
                                                <span className="text-[8px] text-muted-foreground font-medium uppercase">Allotments</span>
                                                <span className="text-[11px] font-bold text-indigo-600">+{tl.allotments}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[8px] text-muted-foreground font-medium uppercase">Submissions</span>
                                                <span className="text-[11px] font-bold text-rose-500">-{tl.submissions}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-9 h-9 flex-shrink-0">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-muted/20" />
                                                <circle
                                                    cx="18" cy="18" r="15"
                                                    stroke="currentColor" strokeWidth="3" fill="transparent"
                                                    strokeDasharray={94}
                                                    strokeDashoffset={94 - (94 * tl.leads.conversionRate) / 100}
                                                    className="text-indigo-500 transition-all duration-1000"
                                                />
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black">
                                                {tl.leads.conversionRate}%
                                            </span>
                                        </div>
                                        <div className="text-[10px] space-y-0.5">
                                            <p className="flex justify-between gap-3 italic">
                                                <span className="text-muted-foreground">Today:</span>
                                                <span className="font-black text-indigo-600">+{tl.leadsToday}</span>
                                            </p>
                                            <p className="flex justify-between gap-3 italic">
                                                <span className="text-muted-foreground">Churn:</span>
                                                <span className="font-bold text-rose-500">{tl.churnLeads}</span>
                                            </p>
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
                                            <DropdownMenuItem onClick={() => setHistoryModalData({ id: tl.id, name: tl.name })}>
                                                View Collection History
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
                        {searchTerm ? 'No matches found.' : 'No active Team Leaders found.'}
                    </div>
                )}
            </div>

            {/* Collection History Modal */}
            {
                historyModalData && <CollectionHistoryModal
                    isOpen={!!historyModalData}
                    onClose={() => setHistoryModalData(null)}
                    teamLeaderId={historyModalData.id}
                    teamLeaderName={historyModalData.name}
                />
            }
        </div>
    );
};

export default TeamLeaderPerformanceTable;
