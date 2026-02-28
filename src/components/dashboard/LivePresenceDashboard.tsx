import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabase';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Activity, Clock, Users, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PresenceUser {
    user_id: string;
    email: string;
    role: string;
    status: 'online' | 'idle' | 'offline';
    last_seen_at: string;
}

const LivePresenceDashboard: React.FC = () => {
    const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map());
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchInitialPresence = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_presence')
                .select('*')
                .order('last_seen_at', { ascending: false });

            if (error) throw error;

            const userMap = new Map<string, PresenceUser>();
            if (data) {
                data.forEach(user => userMap.set(user.user_id, user as PresenceUser));
            }
            setUsers(userMap);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch initial presence:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialPresence();

        // Subscribe to real-time changes
        const channel = supabase.channel('global-presence-admin')
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                console.log('Presence sync', newState);

                setUsers(currentUsers => {
                    const newMap = new Map(currentUsers);

                    // Iterate through all currently active signals
                    Object.values(newState).forEach((presenceArr: any) => {
                        const presence = presenceArr[0]; // Take the most recent if multiple connections
                        if (presence && presence.user_id) {
                            newMap.set(presence.user_id, {
                                user_id: presence.user_id,
                                email: presence.email || 'Unknown',
                                role: presence.role || 'user',
                                status: presence.status || 'online',
                                last_seen_at: presence.online_at || new Date().toISOString()
                            });
                        }
                    });
                    return newMap;
                });
                setLastUpdated(new Date());
            })
            // Listen for direct database updates (in case they close the tab and presence detaches)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload) => {
                if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                    const record = payload.new as PresenceUser;
                    setUsers(currentUsers => {
                        const newMap = new Map(currentUsers);
                        newMap.set(record.user_id, record);
                        return newMap;
                    });
                    setLastUpdated(new Date());
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const userList = Array.from(users.values()).sort((a, b) => {
        // Sort by status first (online > idle > offline), then by last seen
        const statusWeight = { online: 3, idle: 2, offline: 1 };
        if (statusWeight[a.status] !== statusWeight[b.status]) {
            return statusWeight[b.status] - statusWeight[a.status];
        }
        return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });

    const onlineCount = userList.filter(u => u.status === 'online').length;
    const idleCount = userList.filter(u => u.status === 'idle').length;
    const offlineCount = userList.filter(u => u.status === 'offline').length;

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'online':
                return (
                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
                    </div>
                );
            case 'idle':
                return (
                    <div className="flex items-center gap-2 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full border border-amber-500/20">
                        <Clock size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Idle</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-2 bg-muted/30 text-muted-foreground px-3 py-1 rounded-full border border-white/5">
                        <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Offline</span>
                    </div>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                        <Activity className="text-indigo-500" />
                        Network Presence
                    </h2>
                    <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2">
                        Real-time tracking of active personnel
                        <span className="flex items-center gap-1 text-[10px] bg-background/50 px-2 py-0.5 rounded border border-border">
                            <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
                            Live ({formatDistanceToNow(lastUpdated, { addSuffix: true })})
                        </span>
                    </p>
                </div>

                <div className="flex gap-2">
                    <div className="bg-card border border-white/5 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Online</span>
                            <span className="text-lg font-black leading-none">{onlineCount}</span>
                        </div>
                    </div>
                    <div className="bg-card border border-white/5 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Idle</span>
                            <span className="text-lg font-black leading-none">{idleCount}</span>
                        </div>
                    </div>
                    <div className="bg-card border border-white/5 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm hidden sm:flex">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Offline</span>
                            <span className="text-lg font-black leading-none">{offlineCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid List */}
            <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-50 pointer-events-none" />

                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
                        <RefreshCw className="animate-spin mb-4 text-indigo-500" size={32} />
                        <p className="font-bold">Establishing connection to presence network...</p>
                    </div>
                ) : userList.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
                        <Users size={48} className="mb-4 opacity-20" />
                        <p className="font-bold">No presence records found.</p>
                        <p className="text-sm opacity-60">System will detect users as they connect.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto relative z-10">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground font-black">
                                    <th className="px-6 py-4">Identity</th>
                                    <th className="px-6 py-4 text-center">Designation</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Last Signal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                <AnimatePresence>
                                    {userList.map((user) => (
                                        <motion.tr
                                            key={user.user_id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className={`hover:bg-muted/30 transition-colors ${user.status === 'online' ? 'bg-indigo-500/[0.02]' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm border border-white/10 ${user.role === 'admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'
                                                        }`}>
                                                        {user.email.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-sm tracking-tight text-foreground">{user.email}</p>
                                                        <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                                                            ID: {user.user_id.substring(0, 8)}...
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${user.role === 'admin'
                                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={user.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-bold text-sm ${user.status === 'online' ? 'text-indigo-400' : 'text-foreground'}`}>
                                                        {user.status === 'online' ? 'Just now' : formatDistanceToNow(parseISO(user.last_seen_at), { addSuffix: true })}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                                                        {new Date(user.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LivePresenceDashboard;
