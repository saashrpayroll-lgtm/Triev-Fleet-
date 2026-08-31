import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Bell, CheckCircle2, Clock, Search, Trash2,
    AlertCircle, AlertTriangle, Info, Check, CheckCheck,
    BellOff, Wallet, Flag, Zap, Calendar, Filter, X,
    RefreshCw, Square, CheckSquare
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { Notification } from '@/types';
import GlassCard from '@/components/GlassCard';
import { safeRender } from '@/utils/safeRender';
import AdminBroadcastSystem from '@/components/AdminBroadcastSystem';

type FilterTab = 'all' | 'unread' | 'read';
type TypeFilter = 'all' | 'alert' | 'warning' | 'success' | 'wallet' | 'issue' | 'feature' | 'reminder' | 'system';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const AdminNotificationsPage: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterTab>('all');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const fetchNotifications = useCallback(async (silent = false) => {
        if (!userData?.id) return;
        if (!silent) setLoading(true); else setRefreshing(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, user_id, title, message, type, priority, is_read, created_at, related_entity') // ✅ EGRESS
                .eq('user_id', userData.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setNotifications(data.map(n => ({
                    id: n.id,
                    userId: n.user_id,
                    title: n.title,
                    message: n.message,
                    type: n.type,
                    priority: n.priority,
                    isRead: n.is_read,
                    createdAt: n.created_at,
                    relatedEntity: n.related_entity,
                    tags: (n as any).tags || [],
                    actionUrl: (n as any).action_url || null
                })));
            }
        } catch { toast.error('Failed to load notifications'); }
        finally { setLoading(false); setRefreshing(false); }
    }, [userData?.id]);

    useEffect(() => {
        fetchNotifications();
        const channel = supabase.channel('admin-notifications-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userData?.id}` }, () => fetchNotifications(true))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchNotifications]);

    // ── Actions ─────────────────────────────────────────────────────────────
    const handleMarkAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
        if (error) { setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n)); toast.error('Failed'); }
    };

    const handleMarkAllRead = async () => {
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length === 0) return;
        setIsMarkingAll(true);
        try {
            const { error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: userData?.id });
            if (error) await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unreadIds);
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            toast.success(`${unreadIds.length} notifications marked as read`);
        } catch { toast.error('Operation failed'); }
        finally { setIsMarkingAll(false); }
    };

    const handleDelete = async (id: string) => {
        const prev = [...notifications];
        setNotifications(p => p.filter(n => n.id !== id));
        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (error) { setNotifications(prev); toast.error('Failed to delete'); }
        else toast.success('Notification deleted');
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsBulkDeleting(true);
        try {
            const ids = Array.from(selectedIds);
            const { error } = await supabase.from('notifications').delete().in('id', ids);
            if (error) throw error;
            setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
            setSelectedIds(new Set());
            toast.success(`${ids.length} notification${ids.length > 1 ? 's' : ''} deleted`);
        } catch { toast.error('Failed to delete selected'); }
        finally { setIsBulkDeleting(false); }
    };

    const handleBulkMarkRead = async () => {
        const ids = Array.from(selectedIds).filter(id => !notifications.find(n => n.id === id)?.isRead);
        if (ids.length === 0) { setSelectedIds(new Set()); return; }
        const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids);
        if (!error) {
            setNotifications(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, isRead: true } : n));
            setSelectedIds(new Set());
            toast.success(`${ids.length} marked as read`);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredNotifications.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    };

    // ── Filtering ────────────────────────────────────────────────────────────
    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread' && n.isRead) return false;
        if (filter === 'read' && !n.isRead) return false;
        if (typeFilter !== 'all' && !n.type?.includes(typeFilter)) return false;
        if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
        const term = searchTerm.toLowerCase();
        if (term && !n.title?.toLowerCase().includes(term) && !n.message?.toLowerCase().includes(term)) return false;
        return true;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // ── UI Helpers ────────────────────────────────────────────────────────────
    const getIconConfig = (type: string) => {
        const map: Record<string, { icon: React.ReactNode; bg: string; text: string; border: string }> = {
            alert: { icon: <AlertCircle size={18} />, bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
            riderAlert: { icon: <AlertCircle size={18} />, bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
            warning: { icon: <AlertTriangle size={18} />, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
            walletAlert: { icon: <AlertTriangle size={18} />, bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
            success: { icon: <CheckCircle2 size={18} />, bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20' },
            allotment: { icon: <CheckCircle2 size={18} />, bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20' },
            wallet: { icon: <Wallet size={18} />, bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
            recharge: { icon: <Wallet size={18} />, bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
            issue: { icon: <Flag size={18} />, bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' },
            feature: { icon: <Zap size={18} />, bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/20' },
            reminder: { icon: <Calendar size={18} />, bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
            system: { icon: <Bell size={18} />, bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
        };
        return map[type] || { icon: <Info size={18} />, bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' };
    };

    const getPriorityBadge = (priority?: string) => {
        if (!priority || priority === 'normal') return null;
        const map: Record<string, string> = {
            high: 'bg-red-500/15 text-red-600 border-red-500/30',
            medium: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
            low: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
        };
        return (
            <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border ${map[priority] || ''}`}>
                {priority}
            </span>
        );
    };

    const getBorderAccent = (priority?: string) => {
        if (priority === 'high') return 'border-l-red-500';
        if (priority === 'medium') return 'border-l-amber-400';
        return 'border-l-transparent';
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl">
                            <Bell size={24} className="text-primary" />
                        </div>
                        Notifications
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 ml-14">
                        Manage your alerts, updates, and system messages
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => fetchNotifications(true)} disabled={refreshing}
                        className="p-2.5 border border-border/60 rounded-xl hover:bg-accent transition-all disabled:opacity-50">
                        <RefreshCw size={16} className={refreshing ? 'animate-spin text-primary' : 'text-muted-foreground'} />
                    </button>
                    {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} disabled={isMarkingAll}
                            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
                            <CheckCheck size={15} />
                            {isMarkingAll ? 'Marking...' : `Mark ${unreadCount} as read`}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Admin Broadcast System ── */}
            <AdminBroadcastSystem />

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: notifications.length, color: 'text-foreground', bg: 'from-muted/40 to-muted/20' },
                    { label: 'Unread', value: unreadCount, color: 'text-amber-500', bg: 'from-amber-500/10 to-transparent' },
                    { label: 'Read', value: notifications.filter(n => n.isRead).length, color: 'text-green-500', bg: 'from-green-500/10 to-transparent' },
                    { label: 'High Priority', value: notifications.filter(n => n.priority === 'high').length, color: 'text-red-500', bg: 'from-red-500/10 to-transparent' },
                ].map(stat => (
                    <GlassCard key={stat.label} className={`p-4 bg-gradient-to-br ${stat.bg} border-border/40`}>
                        <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">{stat.label}</div>
                    </GlassCard>
                ))}
            </div>

            {/* ── Search & Filter Bar ── */}
            <GlassCard className="p-3 space-y-3">
                <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2.5 bg-background/60 border border-border/50 rounded-xl px-3.5 py-2.5">
                        <Search size={15} className="text-muted-foreground flex-shrink-0" />
                        <input type="text" placeholder="Search notifications..."
                            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="text-muted-foreground hover:text-foreground">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${showFilters ? 'bg-primary/10 text-primary border-primary/30' : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                        <Filter size={14} />
                        Filters
                        {(typeFilter !== 'all' || priorityFilter !== 'all') && (
                            <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                    </button>
                </div>

                {showFilters && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40 animate-in fade-in duration-150">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type:</span>
                            {(['all', 'alert', 'warning', 'wallet', 'issue', 'feature', 'reminder'] as TypeFilter[]).map(t => (
                                <button key={t} onClick={() => setTypeFilter(t)}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition-all ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:text-foreground'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Priority:</span>
                            {(['all', 'high', 'medium', 'low'] as PriorityFilter[]).map(p => (
                                <button key={p} onClick={() => setPriorityFilter(p)}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition-all ${priorityFilter === p ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:text-foreground'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </GlassCard>

            {/* ── Main List Card ── */}
            <GlassCard className="overflow-hidden border-border/40">
                {/* Tab Bar + Bulk Actions */}
                <div className="flex items-center justify-between border-b border-border/40 px-2 py-1 bg-muted/20">
                    <div className="flex">
                        {(['all', 'unread', 'read'] as FilterTab[]).map(tab => (
                            <button key={tab} onClick={() => { setFilter(tab); setSelectedIds(new Set()); }}
                                className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${filter === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>

                                {tab}
                                {tab === 'unread' && unreadCount > 0 && (
                                    <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                                )}
                                {filter === tab && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t" />}
                            </button>
                        ))}
                    </div>

                    {/* Bulk Actions */}
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2 mr-2 animate-in fade-in duration-150">
                            <span className="text-xs font-semibold text-muted-foreground">{selectedIds.size} selected</span>
                            <button onClick={handleBulkMarkRead}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-all">
                                <Check size={12} /> Mark Read
                            </button>
                            <button onClick={handleBulkDelete} disabled={isBulkDeleting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-all disabled:opacity-50">
                                <Trash2 size={12} />
                                {isBulkDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                            <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Select All Row */}
                {filteredNotifications.length > 0 && (
                    <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/30 bg-muted/10">
                        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            {selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0
                                ? <CheckSquare size={15} className="text-primary" />
                                : <Square size={15} />
                            }
                            <span className="font-medium">
                                {selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0
                                    ? 'Deselect all' : 'Select all'}
                            </span>
                        </button>
                        <span className="text-xs text-muted-foreground">
                            {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}

                {/* Notification List */}
                <div className="divide-y divide-border/30 min-h-[300px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Loading...</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <div className="p-6 bg-muted/30 rounded-3xl">
                                <BellOff size={40} className="text-muted-foreground/30" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold">No notifications</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {searchTerm ? 'No results for your search' : filter === 'unread' ? "You're all caught up!" : 'Nothing here yet'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        filteredNotifications.map((note) => {
                            const { icon, bg, text, border } = getIconConfig(note.type);
                            const isSelected = selectedIds.has(note.id);
                            return (
                                <div key={note.id}
                                    className={`group flex items-start gap-4 px-5 py-4 transition-all border-l-4 ${getBorderAccent(note.priority)}
                                        ${isSelected ? 'bg-primary/[0.06]' : !note.isRead ? 'bg-primary/[0.02] hover:bg-primary/[0.04]' : 'hover:bg-muted/30'}
                                    `}
                                >
                                    {/* Checkbox */}
                                    <button onClick={() => toggleSelect(note.id)}
                                        className="mt-1 flex-shrink-0 text-muted-foreground/40 hover:text-primary transition-colors">
                                        {isSelected
                                            ? <CheckSquare size={16} className="text-primary" />
                                            : <Square size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        }
                                    </button>

                                    {/* Type Icon */}
                                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${bg} ${text} ${border}`}>
                                        {icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className={`font-bold text-sm leading-tight ${!note.isRead ? 'text-foreground' : 'text-foreground/75'}`}>
                                                    {note.title}
                                                </h4>
                                                {!note.isRead && (
                                                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                                )}
                                                {getPriorityBadge(note.priority)}
                                            </div>
                                            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                                                <Clock size={10} />
                                                {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>

                                        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                                            {safeRender(note.message)}
                                        </p>

                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[10px] text-muted-foreground/50">
                                                {format(new Date(note.createdAt), 'dd MMM yyyy, hh:mm a')}
                                            </span>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-3 mt-2.5 opacity-0 group-hover:opacity-100 transition-all duration-150 -translate-y-1 group-hover:translate-y-0">
                                            {!note.isRead && (
                                                <button onClick={() => handleMarkAsRead(note.id)}
                                                    className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline">
                                                    <Check size={11} /> Mark as Read
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(note.id)}
                                                className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-red-500 transition-colors">
                                                <Trash2 size={11} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Summary */}
                {filteredNotifications.length > 0 && (
                    <div className="px-5 py-3 border-t border-border/30 bg-muted/10 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Showing <span className="font-semibold text-foreground">{filteredNotifications.length}</span> of <span className="font-semibold text-foreground">{notifications.length}</span> notifications
                        </span>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} disabled={isMarkingAll}
                                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                <CheckCheck size={12} />
                                Mark all {unreadCount} as read
                            </button>
                        )}
                    </div>
                )}
            </GlassCard>
        </div>
    );
};

export default AdminNotificationsPage;
