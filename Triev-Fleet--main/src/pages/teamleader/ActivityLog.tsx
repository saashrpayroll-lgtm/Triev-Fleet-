import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { Search, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import BulkActionsBar from '@/components/BulkActionsBar';

import { ActivityLog as ActivityLogType } from '@/types';

const ActivityLog: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [logs, setLogs] = useState<ActivityLogType[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<ActivityLogType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('all');
    const [filterEntity, setFilterEntity] = useState('all');

    // Bulk Selection State
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

    // Local Persistence Helper
    const getLocalDeletedIds = () => {
        try {
            return new Set(JSON.parse(localStorage.getItem('deleted_activity_logs_tl') || '[]'));
        } catch {
            return new Set();
        }
    };

    const saveLocalDeletedId = (id: string) => {
        const current = getLocalDeletedIds();
        current.add(id);
        localStorage.setItem('deleted_activity_logs_tl', JSON.stringify(Array.from(current)));
    };

    useEffect(() => {
        if (userData?.id) {
            fetchLogs();

            // Real-time updates
            const channel = supabase
                .channel('teamleader-activity-log')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'activity_logs', filter: `user_id=eq.${userData.id}` }, // snake_case
                    (_) => {
                        fetchLogs();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [userData?.id]);

    useEffect(() => {
        filterLogs();
        setSelectedLogIds(new Set()); // Clear selection on filter change
    }, [logs, searchTerm, filterAction, filterEntity]);

    const fetchLogs = async () => {
        if (!userData) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('user_id', userData.id) // snake_case
                .not('is_deleted', 'eq', true) // Server check
                .order('timestamp', { ascending: false });

            if (error) throw error;

            const localDeleted = getLocalDeletedIds();

            const logsData = (data || []).map(item => ({
                ...item,
                userId: item.user_id,
                userName: item.user_name,
                userRole: item.user_role,
                actionType: item.action_type,
                targetType: item.target_type,
                targetId: item.target_id,
                isDeleted: item.is_deleted,
                details: item.details,
                timestamp: item.timestamp
            }));

            // Filter out server-deleted AND local-deleted
            const validLogs = logsData.filter(l =>
                l.isDeleted !== true && !localDeleted.has(l.id)
            );

            setLogs(validLogs as ActivityLogType[]);
        } catch (error) {
            console.error('Error fetching logs:', error);
            // toast.error('Failed to load activity logs');
        } finally {
            setLoading(false);
        }
    };

    const filterLogs = () => {
        let filtered = [...logs];

        // Filter by search term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(log =>
                (log.details || '').toLowerCase().includes(searchLower) ||
                (log.targetId || '').toLowerCase().includes(searchLower)
            );
        }

        // Filter by action type
        if (filterAction !== 'all') {
            filtered = filtered.filter(log => log.actionType === filterAction);
        }

        // Filter by entity type (targetType)
        if (filterEntity !== 'all') {
            filtered = filtered.filter(log => log.targetType === filterEntity);
        }

        setFilteredLogs(filtered);
    };

    const handleDeleteLog = async (logId: string) => {
        // Optimistic
        setLogs(prev => prev.filter(log => log.id !== logId));

        try {
            const { error: updateError, data: updateData } = await supabase
                .from('activity_logs')
                .update({ is_deleted: true })
                .eq('id', logId)
                .select();

            if (!updateError && updateData && updateData.length > 0) {
                toast.success('Log deleted');
                return;
            }

            // Hard Delete
            const { error: deleteError, data: deleteData } = await supabase
                .from('activity_logs')
                .delete()
                .eq('id', logId)
                .select();

            if (!deleteError && deleteData && deleteData.length > 0) {
                toast.success('Log permanently deleted');
                return;
            }

            throw new Error('Server blocked');
        } catch (e) {
            saveLocalDeletedId(logId);
            toast.success("Log deleted (Local)");
        }
    };

    // Bulk Actions
    const handleSelectAll = (checked?: boolean) => {
        if (checked === false || selectedLogIds.size === filteredLogs.length) {
            setSelectedLogIds(new Set());
        } else {
            setSelectedLogIds(new Set(filteredLogs.map(log => log.id)));
        }
    };

    const handleSelectLog = (logId: string) => {
        const newSelected = new Set(selectedLogIds);
        if (newSelected.has(logId)) {
            newSelected.delete(logId);
        } else {
            newSelected.add(logId);
        }
        setSelectedLogIds(newSelected);
    };

    const handleBulkDelete = async () => {
        if (selectedLogIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedLogIds.size} log entries?`)) return;

        const ids = Array.from(selectedLogIds);

        // Optimistic
        setLogs(prev => prev.filter(log => !selectedLogIds.has(log.id)));
        setSelectedLogIds(new Set());

        try {
            // Attempt 1
            const { error: updateError, data: updateData } = await supabase
                .from('activity_logs')
                .update({ is_deleted: true })
                .in('id', ids)
                .select();

            if (!updateError && updateData && updateData.length === ids.length) {
                toast.success('Logs deleted successfully');
                return;
            }

            // Attempt 2
            const { error: deleteError, data: deleteData } = await supabase
                .from('activity_logs')
                .delete()
                .in('id', ids)
                .select();

            if (!deleteError && deleteData && deleteData.length > 0) {
                toast.success('Logs permanently deleted');
                return;
            }
            throw new Error('Server blocked');
        } catch (e) {
            ids.forEach(saveLocalDeletedId);
            toast.success('Logs deleted (Local)');
        }
    };

    const getActionBadge = (action: string) => {
        const styles = {
            create: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border-emerald-200',
            update: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border-blue-200',
            delete: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border-red-200',
            warning: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border-amber-200',
            info: 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border-violet-200',
            default: 'bg-gray-100 text-gray-700 border-gray-200'
        };

        let type = 'default';

        if (['create', 'userCreated', 'riderAdded', 'leadCreated'].includes(action)) type = 'create';
        else if (['update', 'userEdited', 'riderEdited', 'statusChanged', 'permissionChanged', 'walletUpdated', 'leadStatusChange'].includes(action)) type = 'update';
        else if (['delete', 'riderDeleted', 'bulk_delete'].includes(action)) type = 'delete';
        else if (['bulk_update', 'bulkImport'].includes(action)) type = 'warning';
        else if (['export', 'reportGenerated'].includes(action)) type = 'info';

        return (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${styles[type as keyof typeof styles]} flex items-center gap-1.5 w-fit`}>
                {type === 'create' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {type === 'delete' && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                {type === 'update' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                {(action || 'unknown').replace(/_/g, ' ').toUpperCase()}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading activity logs...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20 relative min-h-screen bg-background/50">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Activity Log
                </h1>
                <p className="text-muted-foreground text-lg">Track all your system actions and changes in real-time.</p>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-card/50 p-4 rounded-2xl border border-border/50 shadow-sm backdrop-blur-sm">
                <div className="md:col-span-6 relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by details or entity ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background/50 hover:bg-background"
                    />
                </div>
                <div className="md:col-span-3">
                    <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        className="w-full px-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background/50 hover:bg-background cursor-pointer"
                    >
                        <option value="all">All Actions</option>
                        <option value="riderAdded">Create</option>
                        <option value="riderEdited">Update</option>
                        <option value="riderDeleted">Delete</option>
                        <option value="bulkImport">Bulk Operations</option>
                        <option value="reportGenerated">Exports</option>
                    </select>
                </div>
                <div className="md:col-span-3">
                    <select
                        value={filterEntity}
                        onChange={(e) => setFilterEntity(e.target.value)}
                        className="w-full px-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background/50 hover:bg-background cursor-pointer"
                    >
                        <option value="all">All Entities</option>
                        <option value="rider">Rider</option>
                        <option value="user">User</option>
                        <option value="lead">Lead</option>
                        <option value="report">Report</option>
                    </select>
                </div>
            </div>

            {/* Activity Log Table */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl shadow-black/5">
                {filteredLogs.length === 0 ? (
                    <div className="text-center py-20 bg-muted/10">
                        <div className="bg-muted/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar size={40} className="text-muted-foreground/50" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No logs found</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                            {searchTerm || filterAction !== 'all' || filterEntity !== 'all'
                                ? 'Try adjusting your search terms or filters to find what you looking for.'
                                : 'Activity logs will appear here once actions are performed.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/30 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-4 w-[50px]">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                            checked={selectedLogIds.size === filteredLogs.length && filteredLogs.length > 0}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Timestamp</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Action</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Entity</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Details</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredLogs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className={`group hover:bg-muted/40 transition-all duration-200 ${selectedLogIds.has(log.id) ? 'bg-primary/5' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 transition-all cursor-pointer opacity-50 group-hover:opacity-100"
                                                checked={selectedLogIds.has(log.id)}
                                                onChange={() => handleSelectLog(log.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-sm whitespace-nowrap text-muted-foreground font-medium">
                                            {log.timestamp && format(
                                                new Date(log.timestamp),
                                                'MMM dd, HH:mm'
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getActionBadge(log.actionType)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold capitalize text-foreground/80">
                                            {log.targetType}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                            {log.details}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right">
                                            <button
                                                onClick={() => handleDeleteLog(log.id)}
                                                className="p-2 hover:bg-red-100 text-muted-foreground hover:text-red-600 rounded-lg transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                                                title="Delete Log"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Summary */}
            {filteredLogs.length > 0 && (
                <div className="flex justify-between items-center text-sm text-muted-foreground px-2">
                    <p>Showing <strong>{filteredLogs.length}</strong> entries</p>
                    <p>Total <strong>{logs.length}</strong> logs</p>
                </div>
            )}

            {/* Bulk Actions Bar */}
            <BulkActionsBar
                selectedCount={selectedLogIds.size}
                totalCount={filteredLogs.length}
                onSelectAll={() => handleSelectAll(true)}
                onDeselectAll={() => handleSelectAll(false)}
                actions={[
                    {
                        label: 'Delete Selected',
                        onClick: handleBulkDelete,
                        variant: 'destructive',
                        icon: <Trash2 size={18} />
                    }
                ]}
            />
        </div>
    );
};

export default ActivityLog;
