import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { Target, Search, Download } from 'lucide-react';

const RMLeadOverview: React.FC = () => {
    const { teamLeaders, leads, loading } = useRMTeamData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTL, setFilterTL] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 25;

    const filteredLeads = useMemo(() => {
        return leads.filter(l => {
            if (filterStatus !== 'all' && l.status !== filterStatus) return false;
            if (filterTL !== 'all' && l.createdBy !== filterTL) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    (l.riderName || '').toLowerCase().includes(term) ||
                    (l.mobileNumber || '').includes(term) ||
                    (l.city || '').toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [leads, searchTerm, filterTL, filterStatus]);

    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredLeads.slice(start, start + pageSize);
    }, [filteredLeads, currentPage]);

    const totalPages = Math.ceil(filteredLeads.length / pageSize);

    const statusColors: Record<string, string> = {
        'New': 'bg-blue-100 text-blue-700',
        'Convert': 'bg-emerald-100 text-emerald-700',
        'Not Convert': 'bg-rose-100 text-rose-700',
    };

    const stats = useMemo(() => {
        const total = leads.length;
        const newLeads = leads.filter(l => l.status === 'New').length;
        const converted = leads.filter(l => l.status === 'Convert').length;
        const notConverted = leads.filter(l => l.status === 'Not Convert').length;
        return { total, newLeads, converted, notConverted, rate: total > 0 ? Math.round((converted / total) * 100) : 0 };
    }, [leads]);

    const exportCSV = () => {
        const headers = ['Name', 'Mobile', 'City', 'Status', 'Category', 'Source', 'Created By', 'Date'];
        const rows = filteredLeads.map(l => [l.riderName, l.mobileNumber, l.city, l.status, l.category || '', l.source || '', l.createdByName || '', l.createdAt]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lead_overview_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="text-teal-500" size={24} /> Lead Overview</h1>
                    <p className="text-sm text-muted-foreground mt-1">{filteredLeads.length} leads across your team</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input type="text" placeholder="Search leads..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-teal-500/20 outline-none w-48" />
                    </div>
                    <select value={filterTL} onChange={(e) => { setFilterTL(e.target.value); setCurrentPage(1); }} className="px-3 py-2 text-sm border rounded-lg bg-background cursor-pointer outline-none">
                        <option value="all">All TLs</option>
                        {teamLeaders.filter(tl => tl.status === 'active').map(tl => <option key={tl.id} value={tl.id}>{tl.fullName}</option>)}
                    </select>
                    <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="px-3 py-2 text-sm border rounded-lg bg-background cursor-pointer outline-none">
                        <option value="all">All Status</option>
                        <option value="New">New</option>
                        <option value="Convert">Convert</option>
                        <option value="Not Convert">Not Convert</option>
                    </select>
                    <button onClick={exportCSV} className="px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors flex items-center gap-1.5"><Download size={14} /> Export</button>
                </div>
            </div>

            {/* Funnel Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black">{stats.total}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Leads</p>
                </div>
                <div className="bg-card border rounded-xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-blue-600">{stats.newLeads}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">New</p>
                </div>
                <div className="bg-card border rounded-xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-emerald-600">{stats.converted}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Converted ({stats.rate}%)</p>
                </div>
                <div className="bg-card border rounded-xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-black text-rose-600">{stats.notConverted}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Not Converted</p>
                </div>
            </div>

            {/* Leads Table */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10 shadow-sm">
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Name</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Mobile</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">City</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Category</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Created By</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLeads.map(l => (
                                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="p-3 font-semibold">{l.riderName || '-'}</td>
                                    <td className="p-3 text-muted-foreground">{l.mobileNumber || '-'}</td>
                                    <td className="p-3">{l.city || '-'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${statusColors[l.status] || 'bg-muted text-muted-foreground'}`}>
                                            {l.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-xs">{l.category || '-'}</td>
                                    <td className="p-3 text-xs">{l.createdByName || '-'}</td>
                                    <td className="p-3 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString('en-IN')}</td>
                                </tr>
                            ))}
                            {paginatedLeads.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No leads found</td></tr>}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="p-3 border-t flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
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

export default RMLeadOverview;
