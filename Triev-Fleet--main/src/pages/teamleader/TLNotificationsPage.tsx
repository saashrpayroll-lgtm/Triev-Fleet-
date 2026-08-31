import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Bell,
    CheckCircle2,
    Clock,
    Search,
    Trash2,
    Inbox,
    AlertCircle,
    Info,
    Check
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Notification } from '@/types';
import GlassCard from '@/components/GlassCard';
import { safeRender } from '@/utils/safeRender';

const TLNotificationsPage: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!userData?.id) return;
        fetchNotifications();

        const channel = supabase.channel('tl-personal-notifications')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userData.id}`
            }, () => fetchNotifications())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userData?.id]);

    const fetchNotifications = async () => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, user_id, title, message, type, priority, is_read, created_at, related_entity') // ✅ EGRESS
                .eq('user_id', userData?.id)
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
                    relatedEntity: n.related_entity
                })));
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Error marking read:', error);
            toast.error('Failed to update notification');
        }
    };

    const handleMarkAllRead = async () => {
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length === 0) return;

        try {
            const { error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: userData?.id });

            if (error) {
                await supabase
                    .from('notifications')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .in('id', unreadIds);
            }

            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all read:', error);
            toast.error('Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.filter(n => n.id !== id));
            toast.success('Notification deleted');
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete notification');
        }
    };

    const filteredNotifications = notifications.filter(note => {
        const matchesFilter = filter === 'all' || (filter === 'unread' ? !note.isRead : note.isRead);
        const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.message.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'system': return <Bell className="text-blue-500" size={20} />;
            case 'warning': return <AlertCircle className="text-amber-500" size={20} />;
            case 'wallet': return <Inbox className="text-emerald-500" size={20} />;
            default: return <Info className="text-primary" size={20} />;
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Post Box</h1>
                    <p className="text-muted-foreground">Manage and review your personal updates</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleMarkAllRead}
                        disabled={notifications.every(n => n.isRead)}
                        className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <CheckCircle2 size={16} /> Mark all read
                    </button>
                </div>
            </div>

            {/* Quick Stats & Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-2xl font-black text-primary">{notifications.length}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total</span>
                </GlassCard>
                <GlassCard className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-2xl font-black text-amber-500">{notifications.filter(n => !n.isRead).length}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Unread</span>
                </GlassCard>
                <div className="md:col-span-2 flex items-center gap-2 px-4 bg-muted/30 rounded-2xl border border-border/50">
                    <Search className="text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        className="flex-1 bg-transparent border-none focus:ring-0 py-3 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Main List */}
            <GlassCard className="overflow-hidden border-border/50 shadow-2xl">
                <div className="flex border-b border-border/50 px-2">
                    {(['all', 'unread', 'read'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${filter === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab}
                            {filter === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="divide-y divide-border/50 min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Loading Post...</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
                                <Bell size={32} className="text-muted-foreground/50" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">No notifications found</h3>
                                <p className="text-sm text-muted-foreground">You're all caught up!</p>
                            </div>
                        </div>
                    ) : (
                        filteredNotifications.map((note) => (
                            <div
                                key={note.id}
                                className={`group flex items-start gap-4 p-6 transition-all border-l-4 ${!note.isRead ? 'bg-primary/[0.02] border-primary' : 'hover:bg-muted/30 border-transparent'
                                    }`}
                            >
                                <div className={`p-3 rounded-2xl bg-card border shadow-sm ${!note.isRead ? 'border-primary/20 shadow-primary/10' : 'border-border'}`}>
                                    {getIcon(note.type)}
                                </div>

                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className={`font-bold transition-colors ${!note.isRead ? 'text-primary' : 'text-foreground'}`}>
                                            {note.title}
                                        </h4>
                                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                                            <Clock size={10} />
                                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {safeRender(note.message)}
                                    </p>

                                    <div className="flex items-center gap-3 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!note.isRead && (
                                            <button
                                                onClick={() => handleMarkAsRead(note.id)}
                                                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                                            >
                                                <Check size={12} /> Mark Read
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(note.id)}
                                            className="text-[10px] font-black uppercase tracking-widest text-destructive hover:underline flex items-center gap-1"
                                        >
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </GlassCard>
        </div>
    );
};

export default TLNotificationsPage;
