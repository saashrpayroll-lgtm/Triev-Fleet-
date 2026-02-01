import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, AlertCircle, AlertTriangle, CheckCircle, Info, X, Wallet, Flag, Zap, Calendar } from 'lucide-react';
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
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to map DB notification to App model
    const mapNotification = (n: any): Notification => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        // Map tags from related_entity if available, or column if it exists later
        tags: n.tags || (n.related_entity && n.related_entity.tags) || [],
        relatedEntity: n.related_entity,
        isRead: n.is_read,
        createdAt: n.created_at,
        readAt: n.read_at
    });

    useEffect(() => {
        if (!userId) return;

        const fetchNotifications = async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId) // FIXED: snake_case
                .order('created_at', { ascending: false }) // FIXED: snake_case
                .limit(50);

            if (error) {
                console.error("Error fetching notifications:", error);
                return;
            }

            if (data) {
                const fetchedNotifications = data.map(mapNotification);
                setNotifications(fetchedNotifications);
                setUnreadCount(fetchedNotifications.filter(n => !n.isRead).length);
            }
        };

        fetchNotifications();

        const channel = supabase.channel('notifications-dropdown')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}` // FIXED: snake_case
                },
                () => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() }) // FIXED: snake_case
                .eq('id', notificationId);

            if (error) console.error('Error marking read:', error);

            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));

        } catch (error) { console.error('Error marking read:', error); }
    };

    const handleMarkAllRead = async () => {
        const unread = notifications.filter(n => !n.isRead);
        if (unread.length === 0) return;

        const ids = unread.map(n => n.id);

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() }) // FIXED: snake_case
                .in('id', ids);

            if (error) throw error;

            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);

        } catch (error) { console.error('Error marking all read:', error); }
    };

    const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation();
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) throw error;

            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) { console.error('Error deleting:', error); }
    };

    const handleClearAll = async () => {
        if (!confirm('Clear all notifications?')) return;
        try {
            const ids = notifications.map(n => n.id);
            const { error } = await supabase
                .from('notifications')
                .delete()
                .in('id', ids);

            if (error) throw error;

            setNotifications([]);
            setUnreadCount(0);
        } catch (error) { console.error('Error clearing all:', error); }
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) handleMarkAsRead(notification.id);
        setIsOpen(false);

        // Navigation Logic
        if (notification.relatedEntity) {
            const { type, id } = notification.relatedEntity;
            if (type === 'rider') {
                navigate(userRole === 'admin' ? '/admin/riders' : '/teamleader/my-riders', {
                    state: { highlightRiderId: id }
                });
            }
            else if (type === 'user') {
                navigate('/admin/users', {
                    state: { highlightUserId: id }
                });
            }
        } else {
            // Default routes based on type
            if (notification.type === 'permissionChange') navigate('/admin/profile');
            else if (notification.type === 'wallet' || notification.type === 'recharge') navigate('/admin/wallet');
            else if (notification.type === 'issue') navigate('/admin/requests'); // Assuming issues go to requests/support
            else navigate('/admin/activity-log');
        }
    };

    const getIcon = (type: string) => {
        const size = 18;
        switch (type) {
            case 'alert':
            case 'riderAlert': return <div className="bg-red-100 text-red-600 p-2 rounded-full"><AlertCircle size={size} /></div>;
            case 'warning':
            case 'walletAlert': return <div className="bg-amber-100 text-amber-600 p-2 rounded-full"><AlertTriangle size={size} /></div>;
            case 'success':
            case 'allotment': return <div className="bg-green-100 text-green-600 p-2 rounded-full"><CheckCircle size={size} /></div>;
            case 'permissionChange': return <div className="bg-purple-100 text-purple-600 p-2 rounded-full"><Check size={size} /></div>;
            case 'wallet':
            case 'recharge': return <div className="bg-emerald-100 text-emerald-600 p-2 rounded-full"><Wallet size={size} /></div>;
            case 'issue': return <div className="bg-orange-100 text-orange-600 p-2 rounded-full"><Flag size={size} /></div>;
            case 'feature': return <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full"><Zap size={size} /></div>;
            case 'reminder': return <div className="bg-blue-100 text-blue-600 p-2 rounded-full"><Calendar size={size} /></div>;
            default: return <div className="bg-blue-50 text-blue-600 p-2 rounded-full"><Info size={size} /></div>;
        }
    };

    const getPriorityBorder = (priority?: string) => {
        switch (priority) {
            case 'high': return 'border-l-4 border-l-red-500';
            case 'medium': return 'border-l-4 border-l-orange-400';
            case 'low': return 'border-l-4 border-l-blue-300';
            default: return 'border-l-4 border-l-transparent';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2.5 rounded-full transition-all duration-200 ${isOpen ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
            >
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-background animate-in zoom-in">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-[400px] bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-2xl z-50 flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-top-2 origin-top-right">
                    {/* Header */}
                    <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30 rounded-t-xl">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-medium">
                                    {unreadCount} New
                                </span>
                            )}
                        </div>
                        <div className="flex gap-3 text-xs font-medium">
                            {unreadCount > 0 && (
                                <button onClick={handleMarkAllRead} className="text-primary hover:text-primary/80 transition-colors">
                                    Mark all read
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button onClick={handleClearAll} className="text-muted-foreground hover:text-destructive transition-colors">
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 m-2 rounded-lg border border-dashed border-border/50">
                                <div className="bg-muted p-4 rounded-full mb-3 animate-pulse">
                                    <Bell size={32} className="opacity-40" />
                                </div>
                                <p className="text-sm font-medium">No notifications</p>
                                <p className="text-xs opacity-60">You're all caught up!</p>
                            </div>
                        ) : (
                            notifications.map((note) => (
                                <div
                                    key={note.id}
                                    onClick={() => handleNotificationClick(note)}
                                    className={`group flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden border
                                        ${getPriorityBorder(note.priority)} 
                                        ${!note.isRead
                                            ? 'bg-gradient-to-r from-primary/5 to-transparent border-primary/10 shadow-sm'
                                            : 'bg-card hover:bg-accent/50 border-transparent hover:border-border/50'
                                        }
                                        hover:shadow-md hover:translate-x-1
                                    `}
                                >
                                    {/* Unread Indicator */}
                                    {!note.isRead && (
                                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    )}

                                    <div className={`flex-shrink-0 mt-1 transition-transform group-hover:scale-110 duration-300`}>
                                        {getIcon(note.type)}
                                    </div>

                                    <div className="flex-1 min-w-0 z-10">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className={`text-sm font-semibold truncate transition-colors ${!note.isRead ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
                                                {typeof note.title === 'string' ? note.title : String(note.title || 'Notification')}
                                            </h4>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 font-medium">
                                                {note.createdAt ? formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }).replace('about ', '') : ''}
                                            </span>
                                        </div>
                                        <p className={`text-xs leading-relaxed ${!note.isRead ? 'text-foreground/90 font-medium' : 'text-muted-foreground'} line-clamp-2`}>
                                            {safeRender(note.message)}
                                        </p>
                                        {note.tags && (note.tags as any).length > 0 && ( // Cast tags as any if needed or use optional chaining if tags is valid
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {(note.tags as any).map((t: string) => ( // Cast needed if types mismatch, keeping simplistic here
                                                    <span key={safeRender(t)} className="text-[10px] bg-background/50 border border-border/50 px-2 py-0.5 rounded-full text-muted-foreground group-hover:border-primary/20 group-hover:text-primary transition-colors">
                                                        #{safeRender(t)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Related Entity Badge */}
                                        {note.relatedEntity && (
                                            <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit">
                                                <Info size={10} />
                                                <span>View Details</span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => handleDelete(e, note.id)}
                                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-white hover:bg-red-500 rounded-lg transition-all transform translate-y-2 group-hover:translate-y-0 duration-200 shadow-sm"
                                        title="Delete"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* View All Footer */}
                    <div className="p-3 border-t border-border/50 bg-muted/30 rounded-b-xl">
                        <button
                            onClick={() => { setIsOpen(false); navigate('/admin/notifications'); }}
                            className="w-full py-1.5 text-xs font-medium text-center text-primary hover:bg-primary/5 rounded transition-colors"
                        >
                            View All Notifications
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsDropdown;
