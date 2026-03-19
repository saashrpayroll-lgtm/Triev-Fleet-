import React, { useMemo, useState } from 'react';
import { useRMTeamData } from '@/hooks/useRMTeamData';
import { Target, Search, Download, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

const RMLeadOverview: React.FC = () => {
    const { teamLeaders, leads, loading } = useRMTeamData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTL, setFilterTL] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSource, setFilterSource] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 25;

    const uniqueSources = useMemo(() => {
        return [...new Set(leads.map(l => (l.source || '').trim()).filter(s => s.length > 0))].sort();
    }, [leads]);

    const filteredLeads = useMemo(() => {
        return leads.filter(l => {
            if (filterStatus !== 'all' && l.status !== filterStatus) return false;
            if (filterTL !== 'all' && l.createdBy !== filterTL) return false;
            if (filterSource !== 'all' && (l.source || '').trim() !== filterSource) return false;
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
    }, [leads, searchTerm, filterTL, filterStatus, filterSource]);

    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredLeads.slice(start, start + pageSize);
    }, [filteredLeads, currentPage]);

    const totalPages = Math.ceil(filteredLeads.length / pageSize);

    const statusColors: Record<string, string> = {
        'New': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        'Convert': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
        'Not Convert': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    };

    const stats = useMemo(() => {
        const total = leads.length;
        const newLeads = leads.filter(l => l.status === 'New').length;
        const converted = leads.filter(l => l.status === 'Convert').length;
        const notConverted = leads.filter(l => l.status === 'Not Convert').length;
        return { total, newLeads, converted, notConverted, rate: total > 0 ? Math.round((converted / total) * 100) : 0 };
    }, [leads]);

    const activeFilterCount = [filterTL !== 'all', filterStatus !== 'all', filterSource !== 'all'].filter(Boolean).length;

    const clearAll = () => { setFilterTL('all'); setFilterStatus('all'); setFilterSource('all'); setSearchTerm(''); setCurrentPage(1); };

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
        return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center space-y-3"><div className="w-12 h-12 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto" /><p className="text-sm text-muted-foreground">Loading leads...</p></div></div>;
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-500 to-purple-500 rounded-2xl p-5 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2.5">
                            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm"><Target size={22} /></div>
                            Lead Overview
                        </h1>
                        <p className="text-violet-100 mt-1 text-sm">{filteredLeads.length} leads across your team</p>
                    </div>
                    <button onClick={exportCSV} className="px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-sm font-bold border border-white/20 transition-all flex items-center gap-2">
                        <Download size={15} /> Export
                    </button>
                </div>
            </div>

            {/* Funnel Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-card border rounded-2xl p-3.5 text-center shadow-sm hover:shadow-md transition-all">
                    <p className="text-2xl font-black">{stats.total}</p>
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Total</p>
                </div>
                <div className="bg-card border rounded-2xl p-3.5 text-center shadow-sm hover:shadow-md transition-all">
                    <p className="text-2xl font-black text-blue-600">{stats.newLeads}</p>
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">New</p>
                </div>
                <div className="bg-card border rounded-2xl p-3.5 text-center shadow-sm hover:shadow-md transition-all">
                    <p className="text-2xl font-black text-emerald-600">{stats.converted}</p>
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Converted</p>
                </div>
                <div className="bg-card border rounded-2xl p-3.5 text-center shadow-sm hover:shadow-md transition-all">
                    <p className="text-2xl font-black text-rose-600">{stats.notConverted}</p>
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Not Conv</p>
                </div>
                <div className="col-span-2 md:col-span-1 bg-card border rounded-2xl p-3.5 text-center shadow-sm hover:shadow-md transition-all">
                    <p className="text-2xl font-black text-violet-600">{stats.rate}%</p>
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Conv Rate</p>
                    <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all" style={{ width: `${stats.rate}%` }} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-border/40 flex flex-wrap items-center gap-3 bg-gradient-to-r from-violet-500/5 via-transparent to-purple-500/5">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input type="text" placeholder="Search by name, mobile, city..." value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/60 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none" />
                    </div>
                    <select value={filterTL} onChange={(e) => { setFilterTL(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-2.5 rounded-2xl text-sm font-bold bg-background border border-border/60 cursor-pointer outline-none">
                        <option value="all">All TLs</option>
                        {teamLeaders.filter(tl => tl.status === 'active').map(tl => <option key={tl.id} value={tl.id}>{tl.fullName}</option>)}
                    </select>
                    <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-2.5 rounded-2xl text-sm font-bold bg-background border border-border/60 cursor-pointer outline-none">
                        <option value="all">All Status</option>
                        <option value="New">New</option>
                        <option value="Convert">Converted</option>
                        <option value="Not Convert">Not Converted</option>
                    </select>
                    {uniqueSources.length > 0 && (
                        <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2.5 rounded-2xl text-sm font-bold bg-background border border-border/60 cursor-pointer outline-none">
                            <option value="all">All Sources</option>
                            {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                    {activeFilterCount > 0 && (
                        <button onClick={clearAll} className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1">
                            <X size={12} /> Clear
                        </button>
                    )}
                </div>

                <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10 shadow-sm">
                            <tr className="text-left border-b">
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Name</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Mobile</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">City</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Category</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Source</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Created By</th>
                                <th className="p-3 font-black text-[10px] text-muted-foreground uppercase tracking-widest">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLeads.map(l => (
                                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="p-3 font-semibold">{l.riderName || '-'}</td>
                                    <td className="p-3 text-muted-foreground font-mono text-xs">{l.mobileNumber || '-'}</td>
                                    <td className="p-3">{l.city || '-'}</td>
                                    <td className="p-3">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${statusColors[l.status] || 'bg-muted text-muted-foreground'}`}>
                                            {l.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-xs">{l.category || '-'}</td>
                                    <td className="p-3 text-xs">{l.source || '-'}</td>
                                    <td className="p-3 text-xs">{l.createdByName || '-'}</td>
                                    <td className="p-3 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                </tr>
                            ))}
                            {paginatedLeads.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground"><AlertCircle size={24} className="mx-auto mb-2 opacity-20" />No leads found</td></tr>}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-3 border-t flex items-center justify-between bg-muted/10">
                        <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages} ({filteredLeads.length} results)</span>
                        <div className="flex gap-1">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30"><ChevronLeft size={16} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RMLeadOverview;
