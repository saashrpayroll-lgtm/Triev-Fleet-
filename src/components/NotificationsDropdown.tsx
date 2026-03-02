import React, { useState, useEffect, useRef } from 'react';
import {
    Bell, Check, AlertCircle, AlertTriangle, CheckCircle, Info, X,
    Wallet, Flag, Zap, Calendar, CheckCheck, Trash2, BellOff, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/config/supabase';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Notification } from '@/types';
import { safeRender } from '@/utils/safeRender';

interface NotificationsDropdownProps {
    userId: string;
    userRole: 'admin' | 'teamLeader';
}

const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ userId, userRole }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const mapNotification = (n: any): Notification => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        tags: n.tags || (n.related_entity && n.related_entity.tags) || [],
        relatedEntity: n.related_entity,
        isRead: n.is_read,
        createdAt: n.created_at,
        readAt: n.read_at
    });

    const fetchNotifications = async () => {
        if (!userId) return;
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (!error && data) {
            const fetched = data.map(mapNotification);
            setNotifications(fetched);
            setUnreadCount(fetched.filter(n => !n.isRead).length);
        }
    };

    useEffect(() => {
        if (!userId) return;
        fetchNotifications();
        const channel = supabase.channel('notifications-dropdown')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => fetchNotifications())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notificationId);
        if (error) {
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: false } : n));
            setUnreadCount(prev => prev + 1);
        }
    };

    const handleMarkAllRead = async () => {
        if (unreadCount === 0 || isMarkingAll) return;
        setIsMarkingAll(true);
        try {
            const { error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: userId });
            if (error) {
                const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
                await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unreadIds);
            }
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            toast.success('All notifications marked as read');
        } catch { toast.error('Failed to mark all as read'); }
        finally { setIsMarkingAll(false); }
    };

    const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingId(notificationId);
        const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
        if (!error) {
            const wasUnread = notifications.find(n => n.id === notificationId)?.isRead === false;
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
        } else {
            toast.error('Failed to delete');
        }
        setDeletingId(null);
    };

    const handleClearAll = async () => {
        if (notifications.length === 0 || isDeletingAll) return;
        setIsDeletingAll(true);
        try {
            const ids = notifications.map(n => n.id);
            const { error } = await supabase.from('notifications').delete().in('id', ids);
            if (error) throw error;
            setNotifications([]);
            setUnreadCount(0);
            toast.success('All notifications cleared');
        } catch { toast.error('Failed to clear notifications'); }
        finally { setIsDeletingAll(false); }
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) handleMarkAsRead(notification.id);
        setIsOpen(false);
        if (notification.relatedEntity) {
            const { type, id } = notification.relatedEntity;
            if (type === 'rider') navigate(userRole === 'admin' ? '/admin/riders' : '/teamleader/my-riders', { state: { highlightRiderId: id } });
            else if (type === 'user') navigate('/admin/users', { state: { highlightUserId: id } });
        } else {
            if (notification.type === 'wallet' || notification.type === 'recharge') navigate('/admin/wallet');
            else if (notification.type === 'issue') navigate('/admin/requests');
            else navigate(userRole === 'admin' ? '/portal/notifications' : '/team-leader/notifications');
        }
    };

    const getIconConfig = (type: string): { icon: React.ReactNode; bg: string; color: string } => {
        const configs: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
            alert: { icon: <AlertCircle size={16} />, bg: 'bg-red-500/15', color: 'text-red-500' },
            riderAlert: { icon: <AlertCircle size={16} />, bg: 'bg-red-500/15', color: 'text-red-500' },
            warning: { icon: <AlertTriangle size={16} />, bg: 'bg-amber-500/15', color: 'text-amber-500' },
            walletAlert: { icon: <AlertTriangle size={16} />, bg: 'bg-amber-500/15', color: 'text-amber-500' },
            success: { icon: <CheckCircle size={16} />, bg: 'bg-green-500/15', color: 'text-green-500' },
            allotment: { icon: <CheckCircle size={16} />, bg: 'bg-green-500/15', color: 'text-green-500' },
            permissionChange: { icon: <Check size={16} />, bg: 'bg-purple-500/15', color: 'text-purple-500' },
            wallet: { icon: <Wallet size={16} />, bg: 'bg-emerald-500/15', color: 'text-emerald-500' },
            recharge: { icon: <Wallet size={16} />, bg: 'bg-emerald-500/15', color: 'text-emerald-500' },
            issue: { icon: <Flag size={16} />, bg: 'bg-orange-500/15', color: 'text-orange-500' },
            feature: { icon: <Zap size={16} />, bg: 'bg-indigo-500/15', color: 'text-indigo-500' },
            reminder: { icon: <Calendar size={16} />, bg: 'bg-blue-500/15', color: 'text-blue-500' },
        };
        return configs[type] || { icon: <Info size={16} />, bg: 'bg-primary/10', color: 'text-primary' };
    };

    const getPriorityAccent = (priority?: string) => {
        switch (priority) {
            case 'high': return 'border-l-red-500';
            case 'medium': return 'border-l-amber-400';
            case 'low': return 'border-l-blue-400';
            default: return 'border-l-transparent';
        }
    };

    const displayed = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                id="notifications-bell-btn"
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2.5 rounded-full transition-all duration-200 ${isOpen ? 'bg-primary/15 text-primary scale-110' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
            >
                <Bell size={22} className={isOpen ? 'animate-none' : unreadCount > 0 ? 'animate-[wiggle_1s_ease-in-out]' : ''} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-background shadow-lg animate-in zoom-in">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-[420px] bg-card border border-border/60 rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{ maxHeight: 'min(85vh, 640px)' }}>

                    {/* Header */}
                    <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-primary/10 rounded-lg">
                                    <Bell size={15} className="text-primary" />
                                </div>
                                <span className="font-bold text-sm">Notifications</span>
                                {unreadCount > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                                <X size={15} />
                            </button>
                        </div>

                        {/* Action Bar */}
                        <div className="flex items-center justify-between">
                            {/* Filter Tabs */}
                            <div className="flex bg-muted/60 rounded-lg p-0.5 gap-0.5">
                                {(['all', 'unread'] as const).map(tab => (
                                    <button key={tab} onClick={() => setFilter(tab)}
                                        className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all capitalize ${filter === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                        {tab} {tab === 'unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
                                    </button>
                                ))}
                            </div>
                            {/* Action Buttons */}
                            <div className="flex items-center gap-1">
                                {unreadCount > 0 && (
                                    <button onClick={handleMarkAllRead} disabled={isMarkingAll}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-lg transition-all disabled:opacity-50">
                                        <CheckCheck size={13} />
                                        {isMarkingAll ? 'Marking...' : 'Mark all read'}
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button onClick={handleClearAll} disabled={isDeletingAll}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50">
                                        <Trash2 size={13} />
                                        {isDeletingAll ? '...' : 'Clear all'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {displayed.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                                <div className="p-5 bg-muted/40 rounded-2xl">
                                    <BellOff size={28} className="opacity-40" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold">
                                        {filter === 'unread' ? 'All caught up!' : 'No notifications'}
                                    </p>
                                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                                        {filter === 'unread' ? 'No unread notifications' : "You're all set"}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            displayed.map((note) => {
                                const { icon, bg, color } = getIconConfig(note.type);
                                return (
                                    <div key={note.id}
                                        onClick={() => handleNotificationClick(note)}
                                        className={`group relative flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-l-[3px]
                                            ${getPriorityAccent(note.priority)}
                                            ${!note.isRead
                                                ? 'bg-primary/[0.04] hover:bg-primary/[0.07]'
                                                : 'hover:bg-accent/60 opacity-80 hover:opacity-100'
                                            }
                                        `}
                                    >
                                        {/* Unread dot */}
                                        {!note.isRead && (
                                            <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-primary" />
                                        )}

                                        {/* Icon */}
                                        <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${bg} ${color}`}>
                                            {icon}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-start justify-between gap-1 mb-0.5">
                                                <h4 className={`text-[13px] font-semibold leading-tight truncate ${!note.isRead ? 'text-foreground' : 'text-foreground/80'}`}>
                                                    {typeof note.title === 'string' ? note.title : String(note.title || 'Notification')}
                                                </h4>
                                            </div>
                                            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
                                                {safeRender(note.message)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] text-muted-foreground/60 font-medium">
                                                    {note.createdAt ? formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }).replace('about ', '') : ''}
                                                </span>
                                                {note.priority === 'high' && (
                                                    <span className="text-[9px] uppercase font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded tracking-wider">urgent</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Hover Actions */}
                                        <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-y-1 group-hover:translate-y-0">
                                            {!note.isRead && (
                                                <button onClick={(e) => handleMarkAsRead(note.id, e)}
                                                    title="Mark as read"
                                                    className="p-1.5 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-lg transition-all">
                                                    <Check size={11} />
                                                </button>
                                            )}
                                            <button onClick={(e) => handleDelete(note.id, e)}
                                                title="Delete"
                                                disabled={deletingId === note.id}
                                                className="p-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-lg transition-all disabled:opacity-40">
                                                <X size={11} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-border/50 bg-muted/20">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigate(userRole === 'admin' ? '/portal/notifications' : '/team-leader/notifications');
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 text-[12px] font-semibold text-primary hover:text-white hover:bg-primary rounded-lg transition-all duration-200 group"
                        >
                            <span>View All Notifications</span>
                            <ExternalLink size={13} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsDropdown;
