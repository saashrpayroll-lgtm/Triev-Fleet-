import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { Users, Search, Download, Filter, Activity, Wallet, AlertTriangle, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react';
import RiderDetailsModal from '@/components/RiderDetailsModal';
import { Rider } from '@/types';

const RMRiderOverview: React.FC = () => {
    const { teamLeaders, riders, loading, refresh } = useRMTeamData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTL, setFilterTL] = useState('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterWallet, setFilterWallet] = useState<'all' | 'positive' | 'negative' | 'zero'>('all');
    const [filterClient, setFilterClient] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
    const pageSize = 30;

    // Unique client names for filter
    const uniqueClients = useMemo(() => {
        const clients = [...new Set(riders.map(r => (r.clientName || '').trim()).filter(c => c.length > 0))].sort();
        return clients;
    }, [riders]);

    // Summary metrics
    const metrics = useMemo(() => {
        const active = riders.filter(r => r.status === 'active');
        const inactive = riders.filter(r => r.status === 'inactive');
        const positiveWallet = active.filter(r => r.walletAmount > 0);
        const negativeWallet = active.filter(r => r.walletAmount < 0);
        const criticalDebt = active.filter(r => r.walletAmount < -3000);
        const totalPositive = positiveWallet.reduce((s, r) => s + r.walletAmount, 0);
        const totalNegative = negativeWallet.reduce((s, r) => s + r.walletAmount, 0);
        return {
            total: riders.length,
            active: active.length,
            inactive: inactive.length,
            positiveCount: positiveWallet.length,
            negativeCount: negativeWallet.length,
            totalPositive,
            totalNegative,
            criticalDebt: criticalDebt.length,
            avgWallet: active.length > 0 ? Math.round((totalPositive + totalNegative) / active.length) : 0,
        };
    }, [riders]);

    // Active filter count
    const activeFilterCount = [filterTL !== 'all', filterStatus !== 'all', filterWallet !== 'all', filterClient !== 'all'].filter(Boolean).length;

    const filteredRiders = useMemo(() => {
        return riders.filter(r => {
            if (filterStatus !== 'all' && r.status !== filterStatus) return false;
            if (filterTL !== 'all' && r.teamLeaderId !== filterTL) return false;
            
            // For wallet filtering: inactive riders have 0 wallet
            const effectiveWallet = r.status === 'inactive' ? 0 : (r.walletAmount || 0);
            if (filterWallet === 'positive' && effectiveWallet <= 0) return false;
            if (filterWallet === 'negative' && effectiveWallet >= 0) return false;
            if (filterWallet === 'zero' && effectiveWallet !== 0) return false;

            if (filterClient !== 'all' && (r.clientName || '').trim() !== filterClient) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    (r.riderName || '').toLowerCase().includes(term) ||
                    (r.mobileNumber || '').includes(term) ||
                    (r.trievId || '').toLowerCase().includes(term) ||
                    (r.clientName || '').toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [riders, searchTerm, filterTL, filterStatus, filterWallet, filterClient]);

    const paginatedRiders = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRiders.slice(start, start + pageSize);
    }, [filteredRiders, currentPage]);

    const totalPages = Math.ceil(filteredRiders.length / pageSize);

    const clearAllFilters = () => {
        setFilterTL('all');
        setFilterStatus('all');
        setFilterWallet('all');
        setFilterClient('all');
        setSearchTerm('');
        setCurrentPage(1);
    };

    const exportCSV = () => {
        const headers = ['Triev ID', 'Name', 'Mobile', 'TL Name', 'Client', 'Status', 'Wallet', 'Allotment Date'];
        const rows = filteredRiders.map(r => [
            r.trievId, r.riderName, r.mobileNumber, r.teamLeaderName || '',
            r.clientName || '', r.status, r.walletAmount,
            r.allotmentDate ? new Date(r.allotmentDate).toLocaleDateString('en-IN') : ''
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rider_overview_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const handleRiderClick = (rider: any) => {
        // Map to Rider type for the modal
        setSelectedRider({
            ...rider,
            id: rider.id,
            trievId: rider.trievId || '',
            riderName: rider.riderName || '',
            mobileNumber: rider.mobileNumber || '',
            teamLeaderId: rider.teamLeaderId || '',
            teamLeaderName: rider.teamLeaderName || '',
            clientName: rider.clientName || '',
            clientId: rider.clientId || '',
            chassisNumber: rider.chassisNumber || '',
            status: rider.status || 'active',
            walletAmount: rider.walletAmount || 0,
            allotmentDate: rider.allotmentDate || '',
            createdAt: rider.createdAt || '',
            updatedAt: rider.updatedAt || '',
            inactivatedAt: rider.inactivatedAt || '',
            photoUrl: rider.photoUrl || '',
        } as Rider);
    };

    // Pagination page numbers
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground font-medium">Loading rider data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* ── PREMIUM HEADER ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-5 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-emerald-300/20 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black flex items-center gap-2.5">
                                <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm"><Users size={22} /></div>
                                Rider Overview
                            </h1>
                            <p className="text-teal-100 mt-1 text-sm">{filteredRiders.length} riders across your team</p>
                        </div>
                        <button onClick={exportCSV} className="px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-sm font-bold border border-white/20 transition-all flex items-center gap-2">
                            <Download size={15} /> Export
                        </button>
                    </div>
                </div>
            </div>

            {/* ── SUMMARY METRICS ── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-card border border-border/60 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg group-hover:scale-110 transition-transform"><Activity size={15} className="text-emerald-500" /></div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Active</span>
                    </div>
                    <p className="text-xl font-black text-emerald-600">{metrics.active} <span className="text-xs font-normal text-muted-foreground">/ {metrics.total}</span></p>
                </div>
                <div className="bg-card border border-border/60 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-rose-500/10 rounded-lg group-hover:scale-110 transition-transform"><Users size={15} className="text-rose-500" /></div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Inactive</span>
                    </div>
                    <p className="text-xl font-black text-rose-600">{metrics.inactive}</p>
                </div>
                <div className="bg-card border border-border/60 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg group-hover:scale-110 transition-transform"><Wallet size={15} className="text-emerald-500" /></div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">+ve Wallet</span>
                    </div>
                    <p className="text-lg font-black text-emerald-600">₹{metrics.totalPositive.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{metrics.positiveCount} riders</p>
                </div>
                <div className="bg-card border border-border/60 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-rose-500/10 rounded-lg group-hover:scale-110 transition-transform"><Wallet size={15} className="text-rose-500" /></div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">-ve Wallet</span>
                    </div>
                    <p className="text-lg font-black text-rose-600">₹{Math.abs(metrics.totalNegative).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{metrics.negativeCount} riders</p>
                </div>
                <div className={`col-span-2 md:col-span-1 border rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group ${metrics.criticalDebt > 0 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/30' : 'bg-card border-border/60'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg group-hover:scale-110 transition-transform ${metrics.criticalDebt > 0 ? 'bg-rose-500/20' : 'bg-orange-500/10'}`}>
                            <AlertTriangle size={15} className={metrics.criticalDebt > 0 ? 'text-rose-600' : 'text-orange-500'} />
                        </div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Critical Debt</span>
                    </div>
                    <p className={`text-xl font-black ${metrics.criticalDebt > 0 ? 'text-rose-600 animate-pulse' : 'text-muted-foreground'}`}>{metrics.criticalDebt}</p>
                    <p className="text-[10px] text-muted-foreground">riders below ₹-3,000</p>
                </div>
            </div>

            {/* ── TABLE CARD ── */}
            <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden">
                {/* ── STATUS TABS ── */}
                <div className="flex bg-muted/40 p-2 sm:p-3 border-b border-border/40 gap-2 overflow-x-auto hide-scrollbar">
                    {(['all', 'active', 'inactive'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black capitalize transition-all whitespace-nowrap flex items-center gap-2 ${filterStatus === s ? (s === 'active' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : s === 'inactive' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-card border-border/60 shadow-sm text-foreground') : 'hover:bg-accent/50 text-muted-foreground bg-transparent'}`}
                        >
                            {s === 'all' ? <Users size={16} /> : <Activity size={16} />}
                            {s} Riders
                        </button>
                    ))}
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-3 bg-gradient-to-r from-teal-500/5 via-transparent to-emerald-500/5">
                    <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by Name, ID, Mobile, Client..."
                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/60 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>

                        {/* TL Filter */}
                        <select value={filterTL} onChange={(e) => { setFilterTL(e.target.value); setCurrentPage(1); }}
                            className={`hidden md:block px-3 py-2.5 rounded-2xl text-sm font-bold border transition-all outline-none cursor-pointer ${filterTL !== 'all' ? 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300' : 'bg-background border-border/60 hover:bg-muted text-foreground'}`}>
                            <option value="all">All TLs</option>
                            {teamLeaders.filter(tl => tl.status === 'active').map(tl => <option key={tl.id} value={tl.id}>{tl.fullName}</option>)}
                        </select>

                        {/* Filter button */}
                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all ${isFilterOpen || activeFilterCount > 0
                                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-300'
                                    : 'bg-background border-border/60 hover:bg-muted'}`}
                            >
                                <Filter className="w-4 h-4" />
                                Filters
                                {activeFilterCount > 0 && (
                                    <span className="ml-1 w-5 h-5 rounded-full bg-teal-500 text-white text-[10px] font-black flex items-center justify-center">{activeFilterCount}</span>
                                )}
                            </button>
                            {isFilterOpen && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-4">
                                        {/* Status filter removed from here, moved to main tabs above */}
                                        {/* Wallet */}
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-wider">Wallet</p>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {(['all', 'positive', 'negative', 'zero'] as const).map(v => (
                                                    <button key={v} onClick={() => { setFilterWallet(v); setCurrentPage(1); }}
                                                        className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all capitalize ${filterWallet === v ? (v === 'positive' ? 'bg-emerald-500 text-white' : v === 'negative' ? 'bg-rose-500 text-white' : v === 'zero' ? 'bg-amber-500 text-white' : 'bg-teal-500 text-white') : 'bg-muted hover:bg-muted/80'}`}>
                                                        {v === 'positive' ? '+ve' : v === 'negative' ? '-ve' : v}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Client */}
                                        {uniqueClients.length > 0 && (
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-wider">Client</p>
                                                <select value={filterClient} onChange={(e) => { setFilterClient(e.target.value); setCurrentPage(1); }}
                                                    className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-muted border-0 outline-none cursor-pointer">
                                                    <option value="all">All Clients</option>
                                                    {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {/* TL (mobile) */}
                                        <div className="md:hidden">
                                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-wider">Team Leader</p>
                                            <select value={filterTL} onChange={(e) => { setFilterTL(e.target.value); setCurrentPage(1); }}
                                                className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-muted border-0 outline-none cursor-pointer">
                                                <option value="all">All TLs</option>
                                                {teamLeaders.filter(tl => tl.status === 'active').map(tl => <option key={tl.id} value={tl.id}>{tl.fullName}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-border/40">
                                        <button onClick={() => { clearAllFilters(); setIsFilterOpen(false); }}
                                            className="w-full py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                                            Clear All Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Result count */}
                    <div className="text-xs text-muted-foreground font-medium">
                        Showing <span className="font-black text-foreground">{filteredRiders.length}</span> riders
                    </div>
                </div>

                {/* Active filter chips */}
                {activeFilterCount > 0 && (
                    <div className="px-4 py-2 border-b border-border/30 flex items-center gap-2 flex-wrap bg-teal-500/5">
                        <span className="text-[10px] font-bold text-muted-foreground">Active:</span>
                        {filterTL !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                                TL: {teamLeaders.find(t => t.id === filterTL)?.fullName || '?'}
                                <button onClick={() => setFilterTL('all')}><X size={10} /></button>
                            </span>
                        )}
                        {filterStatus !== 'all' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${filterStatus === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700'}`}>
                                {filterStatus} <button onClick={() => setFilterStatus('all')}><X size={10} /></button>
                            </span>
                        )}
                        {filterWallet !== 'all' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${filterWallet === 'positive' ? 'bg-emerald-100 text-emerald-700' : filterWallet === 'negative' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                Wallet: {filterWallet} <button onClick={() => setFilterWallet('all')}><X size={10} /></button>
                            </span>
                        )}
                        {filterClient !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700">
                                {filterClient} <button onClick={() => setFilterClient('all')}><X size={10} /></button>
                            </span>
                        )}
                        <button onClick={clearAllFilters} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 ml-auto">Clear All</button>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10 shadow-sm">
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Triev ID</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Rider</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Mobile</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Team Leader</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Client</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest text-right">Wallet</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Allotment</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRiders.map(r => (
                                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
                                    <td className="p-3">
                                        <button
                                            onClick={() => handleRiderClick(r)}
                                            className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline underline-offset-2 transition-all cursor-pointer"
                                        >
                                            {r.trievId || '-'}
                                        </button>
                                    </td>
                                    <td className="p-3">
                                        <p className="font-semibold text-sm">{r.riderName || '-'}</p>
                                    </td>
                                    <td className="p-3 text-muted-foreground font-mono text-xs">{r.mobileNumber || '-'}</td>
                                    <td className="p-3 text-sm">{r.teamLeaderName || '-'}</td>
                                    <td className="p-3 text-sm text-muted-foreground">{r.clientName || '-'}</td>
                                    <td className="p-3">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${r.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                                            {(r.status || 'unknown')}
                                        </span>
                                    </td>
                                    <td className={`p-3 text-right font-bold tabular-nums ${r.status === 'inactive' ? 'text-muted-foreground' : (r.walletAmount || 0) > 0 ? 'text-emerald-600' : (r.walletAmount || 0) < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                                        ₹{r.status === 'inactive' ? '0' : (r.walletAmount || 0).toLocaleString()}
                                    </td>
                                    <td className="p-3 text-xs text-muted-foreground">
                                        {r.allotmentDate ? new Date(r.allotmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                    </td>
                                    <td className="p-3">
                                        <button
                                            onClick={() => handleRiderClick(r)}
                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-teal-500/10 text-teal-600 transition-all"
                                            title="View Details"
                                        >
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {paginatedRiders.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                            <Users size={32} className="opacity-20" />
                                            <p className="font-medium">No riders found</p>
                                            <p className="text-xs">Try adjusting your filters or search query</p>
                                            {activeFilterCount > 0 && (
                                                <button onClick={clearAllFilters} className="text-xs font-bold text-teal-600 hover:underline">Clear all filters</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-3 border-t border-border/40 flex items-center justify-between bg-muted/10">
                        <span className="text-xs text-muted-foreground font-medium">
                            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRiders.length)} of <span className="font-bold text-foreground">{filteredRiders.length}</span>
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage <= 1}
                                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {getPageNumbers().map((p, i) => (
                                typeof p === 'number' ? (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(p)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === p ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-accent'}`}
                                    >
                                        {p}
                                    </button>
                                ) : (
                                    <span key={i} className="text-muted-foreground text-xs px-1">...</span>
                                )
                            ))}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── RIDER DETAIL MODAL ── */}
            {selectedRider && (
                <RiderDetailsModal
                    rider={selectedRider}
                    onClose={() => setSelectedRider(null)}
                    onUpdate={() => { refresh(); }}
                />
            )}
        </div>
    );
};

export default RMRiderOverview;
