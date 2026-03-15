import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { Users, Search, Download } from 'lucide-react';

const RMRiderOverview: React.FC = () => {
    const { teamLeaders, riders, loading } = useRMTeamData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTL, setFilterTL] = useState('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 25;

    const filteredRiders = useMemo(() => {
        return riders.filter(r => {
            if (filterStatus !== 'all' && r.status !== filterStatus) return false;
            if (filterTL !== 'all' && r.teamLeaderId !== filterTL) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    (r.riderName || '').toLowerCase().includes(term) ||
                    (r.mobileNumber || '').includes(term) ||
                    (r.trievId || '').toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [riders, searchTerm, filterTL, filterStatus]);

    const paginatedRiders = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRiders.slice(start, start + pageSize);
    }, [filteredRiders, currentPage]);

    const totalPages = Math.ceil(filteredRiders.length / pageSize);

    const exportCSV = () => {
        const headers = ['Triev ID', 'Name', 'Mobile', 'TL Name', 'Client', 'Status', 'Wallet'];
        const rows = filteredRiders.map(r => [r.trievId, r.riderName, r.mobileNumber, r.teamLeaderName || '', r.clientName || '', r.status, r.walletAmount]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rider_overview_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="text-teal-500" size={24} /> Rider Overview</h1>
                    <p className="text-sm text-muted-foreground mt-1">{filteredRiders.length} riders across your team</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input type="text" placeholder="Search riders..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-teal-500/20 outline-none w-48" />
                    </div>
                    <select value={filterTL} onChange={(e) => { setFilterTL(e.target.value); setCurrentPage(1); }} className="px-3 py-2 text-sm border rounded-lg bg-background cursor-pointer outline-none">
                        <option value="all">All TLs</option>
                        {teamLeaders.filter(tl => tl.status === 'active').map(tl => <option key={tl.id} value={tl.id}>{tl.fullName}</option>)}
                    </select>
                    <select value={filterStatus} onChange={(e: any) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="px-3 py-2 text-sm border rounded-lg bg-background cursor-pointer outline-none">
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button onClick={exportCSV} className="px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors flex items-center gap-1.5"><Download size={14} /> Export</button>
                </div>
            </div>

            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-auto max-h-[65vh]">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10 shadow-sm">
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Triev ID</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Rider</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Mobile</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Team Leader</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Client</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Wallet</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRiders.map(r => (
                                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="p-3 font-mono text-xs">{r.trievId || '-'}</td>
                                    <td className="p-3 font-semibold">{r.riderName || '-'}</td>
                                    <td className="p-3 text-muted-foreground">{r.mobileNumber || '-'}</td>
                                    <td className="p-3 text-sm">{r.teamLeaderName || '-'}</td>
                                    <td className="p-3 text-sm">{r.clientName || '-'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {(r.status || 'unknown').toUpperCase()}
                                        </span>
                                    </td>
                                    <td className={`p-3 font-bold ${(r.walletAmount || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ₹{(r.walletAmount || 0).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {paginatedRiders.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No riders found</td></tr>}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="p-3 border-t flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages} ({filteredRiders.length} results)</span>
                        <div className="flex gap-1">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1 text-xs border rounded hover:bg-accent disabled:opacity-50">Prev</button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1 text-xs border rounded hover:bg-accent disabled:opacity-50">Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RMRiderOverview;
