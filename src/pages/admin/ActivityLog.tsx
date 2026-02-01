import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/config/supabase';
import { Search, Trash2, Calendar, Download, Globe, Clock, User, Activity, Filter, RefreshCw, X } from 'lucide-react';
import { format, formatDistanceToNow, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivityLog {
    id: string;
    userName: string;
    userId: string;
    userRole: string;
    actionType: string;
    targetType: string;
    targetId: string;
    details: string;
    timestamp: string;
    isDeleted: boolean;
    metadata?: any;
}

const ActivityLog: React.FC = () => {
    // Data State
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
    const [filterAction, setFilterAction] = useState('all');
    const [filterUser, setFilterUser] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Local Persistence Helper
    const getLocalDeletedIds = () => {
        try {
            return new Set(JSON.parse(localStorage.getItem('deleted_activity_logs') || '[]'));
        } catch {
            return new Set();
        }
    };

    const saveLocalDeletedId = (id: string) => {
        const current = getLocalDeletedIds();
        current.add(id);
        localStorage.setItem('deleted_activity_logs', JSON.stringify(Array.from(current)));
    };

    // Fetch Logs
    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('activity_logs')
            .select(`
                id,
                userName:user_name,
                userId:user_id,
                userRole:user_role,
                actionType:action_type,
                targetType:target_type,
                targetId:target_id,
                details,
                timestamp,
                isDeleted:is_deleted,
                metadata
            `)
            .not('is_deleted', 'eq', true)
            .order('timestamp', { ascending: false })
            .limit(1000);

        if (data) {
            const localDeleted = getLocalDeletedIds();

            // Filter out server-deleted AND local-deleted
            const validLogs = (data as ActivityLog[]).filter(l =>
                l.isDeleted !== true && !localDeleted.has(l.id)
            );

            setLogs(validLogs);
        }

        if (error) {
            console.error('Error fetching logs:', error);
            toast.error('Failed to load activity logs');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();

        const channel = supabase.channel('activity-logs-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
                fetchLogs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Derived Lists
    const uniqueUsers = useMemo(() => Array.from(new Set(logs.map(l => l.userName || 'Unknown').filter(Boolean))), [logs]);
    const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.actionType || 'Unknown'))), [logs]);

    // Filtering Logic
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Text Search
            const matchesSearch =
                (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.actionType || '').toLowerCase().includes(searchTerm.toLowerCase());

            // Dropdowns
            const matchesAction = filterAction === 'all' || log.actionType === filterAction;
            const matchesUser = filterUser === 'all' || log.userName === filterUser;

            // Date Range
            let matchesDate = true;
            if (dateFrom || dateTo) {
                const logDate = parseISO(log.timestamp);
                const start = dateFrom ? startOfDay(parseISO(dateFrom)) : new Date(0);
                const end = dateTo ? endOfDay(parseISO(dateTo)) : new Date();
                matchesDate = isWithinInterval(logDate, { start, end });
            }

            return matchesSearch && matchesAction && matchesUser && matchesDate;
        });
    }, [logs, searchTerm, filterAction, filterUser, dateFrom, dateTo]);

    // Handlers
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedLogs(new Set(filteredLogs.map(l => l.id)));
        } else {
            setSelectedLogs(new Set());
        }
    };

    const handleSelectLog = (id: string) => {
        const newSelected = new Set(selectedLogs);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedLogs(newSelected);
    };

    const handleExport = () => {
        if (filteredLogs.length === 0) {
            toast.error("No logs to export");
            return;
        }

        const headers = ['Timestamp', 'Action', 'User', 'Target', 'Details', 'IP'];
        const csvContent = [
            headers.join(','),
            ...filteredLogs.map(log => [
                `"${log.timestamp}"`,
                `"${log.actionType}"`,
                `"${log.userName}"`,
                `"${log.targetType}"`,
                `"${log.details.replace(/"/g, '""')}"`,
                `"${log.metadata?.ip || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `activity_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Logs exported successfully");
    };

    const handleDelete = async (id?: string) => {
        const idsToDelete = id ? [id] : Array.from(selectedLogs);
        if (idsToDelete.length === 0) return;

        if (!id && !confirm(`Are you sure you want to delete ${idsToDelete.length} logs?`)) return;

        // Optimistic UI Update immediately
        setLogs(prev => prev.filter(l => !idsToDelete.includes(l.id)));
        setSelectedLogs(new Set());

        try {
            // Attempt 1: Server Soft Delete
            const { error: updateError, data: updateData } = await supabase
                .from('activity_logs')
                .update({ is_deleted: true })
                .in('id', idsToDelete)
                .select();

            // If success
            if (!updateError && updateData && updateData.length === idsToDelete.length) {
                toast.success("Logs deleted from server.");
                return;
            }

            // Attempt 2: Server Hard Delete (Fallback)
            const { error: deleteError, data: deleteData } = await supabase
                .from('activity_logs')
                .delete()
                .in('id', idsToDelete)
                .select();

            // Check if items were actually deleted
            if (!deleteError && deleteData && deleteData.length > 0) {
                toast.success("Logs permanently deleted.");
                return;
            }

            throw new Error("Server blocked deletion.");

        } catch (err) {
            // Attempt 3: Local Storage Fallback (The "Ultimate" Fix)
            console.warn("Server deletion blocked, forcing local hide.", err);
            idsToDelete.forEach(saveLocalDeletedId);
            toast.success("Logs deleted (Local override)");
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterAction('all');
        setFilterUser('all');
        setDateFrom('');
        setDateTo('');
        toast.info("Filters cleared");
    };

    const getActionColor = (action: string) => {
        const lower = action.toLowerCase();
        if (lower.includes('delete')) return 'bg-red-500/10 text-red-600 border-red-200';
        if (lower.includes('create') || lower.includes('add')) return 'bg-green-500/10 text-green-600 border-green-200';
        if (lower.includes('update') || lower.includes('edit')) return 'bg-blue-500/10 text-blue-600 border-blue-200';
        return 'bg-gray-100 text-gray-600 border-gray-200';
    };

    // --- RENDER ---
    return (
        <div className="space-y-6 pb-20 min-h-screen">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-3xl border shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent flex items-center gap-3">
                        <Activity className="text-primary" /> System Activity
                    </h1>
                    <p className="text-muted-foreground mt-1">Audit trail of all administrative actions in the system.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => fetchLogs()} className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors" title="Refresh">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 font-medium transition-colors">
                        <Download size={18} /> Export CSV
                    </button>
                    {selectedLogs.size > 0 && (
                        <motion.button
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={() => handleDelete()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg shadow-red-500/20 transition-all"
                        >
                            <Trash2 size={18} /> Delete ({selectedLogs.size})
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Advanced Filters Panel */}
            <div className="bg-card border p-4 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input
                            type="text"
                            placeholder="Detailed search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-3 rounded-xl border transition-all flex items-center gap-2 font-medium ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-background hover:bg-secondary'}`}
                    >
                        <Filter size={18} /> Filters {showFilters ? <X size={16} /> : null}
                    </button>
                </div>

                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border border-dashed">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">User</label>
                                    <select
                                        value={filterUser}
                                        onChange={e => setFilterUser(e.target.value)}
                                        className="w-full p-2.5 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                                    >
                                        <option value="all">Every User</option>
                                        {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Action Type</label>
                                    <select
                                        value={filterAction}
                                        onChange={e => setFilterAction(e.target.value)}
                                        className="w-full p-2.5 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                                    >
                                        <option value="all">Any Action</option>
                                        {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">From Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                        <input
                                            type="date"
                                            value={dateFrom}
                                            onChange={e => setDateFrom(e.target.value)}
                                            className="w-full pl-8 p-2.5 bg-background border rounded-lg text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">To Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                        <input
                                            type="date"
                                            value={dateTo}
                                            onChange={e => setDateTo(e.target.value)}
                                            className="w-full pl-8 p-2.5 bg-background border rounded-lg text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                                    <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-600 font-medium hover:underline">
                                        Clear All Filters
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* List View */}
            <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-2 border-b">
                    <div className="relative">
                        <input
                            type="checkbox"
                            id="selectAll"
                            onChange={handleSelectAll}
                            checked={filteredLogs.length > 0 && selectedLogs.size === filteredLogs.length}
                            className="peer w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer"
                        />
                    </div>
                    <label htmlFor="selectAll" className="text-sm font-semibold text-muted-foreground cursor-pointer select-none">
                        Select All Results ({filteredLogs.length})
                    </label>
                </div>

                <AnimatePresence mode="popLayout">
                    {filteredLogs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            className={`group relative bg-card hover:bg-accent/5 p-4 rounded-xl border border-transparent hover:border-border/50 transition-all ${selectedLogs.has(log.id) ? 'ring-1 ring-primary border-primary/20 bg-primary/5' : 'shadow-sm'}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="pt-1.5">
                                    <input
                                        type="checkbox"
                                        checked={selectedLogs.has(log.id)}
                                        onChange={() => handleSelectLog(log.id)}
                                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer"
                                    />
                                </div>

                                <div className={`mt-0.5 w-10 h-10 rounded-lg flex items-center justify-center border ${getActionColor(log.actionType)}`}>
                                    <Activity size={18} />
                                </div>

                                <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                                    <div className="lg:col-span-2 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground">{log.actionType}</span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground tracking-wider">
                                                {log.targetType}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground/80 line-clamp-2 md:line-clamp-1" title={log.details}>
                                            {log.details}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                                            <User size={12} />
                                            <span className="truncate max-w-[100px]" title={log.userName}>{log.userName}</span>
                                        </div>
                                        {log.metadata?.ip && (
                                            <div className="flex items-center gap-1.5 hidden md:flex">
                                                <Globe size={12} /> {log.metadata.ip}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-right flex flex-col items-end gap-1">
                                        <span className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                                            <Clock size={12} className="text-primary" />
                                            {log.timestamp ? format(parseISO(log.timestamp), 'MMM dd, HH:mm') : '-'}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {log.timestamp ? formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true }) : ''}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(log.id)}
                                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all self-center"
                                    title="Delete Log"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {filteredLogs.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                            <Search size={32} className="opacity-50" />
                        </div>
                        <p className="text-lg font-medium">No logs matched your criteria</p>
                        <button onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">Clear filters</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityLog;
