import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Activity, RefreshCw, Users, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PresenceUser {
    user_id: string;
    email: string;
    full_name?: string;
    role: string;
    status: 'online' | 'idle' | 'offline';
    last_seen_at: string;
}

// Get initials from name or email
const getInitials = (name?: string, email?: string): string => {
    if (name && name.trim()) {
        const parts = name.trim().split(' ').filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (email || '??').substring(0, 2).toUpperCase();
};

// Display name: prefer full_name, fallback to email prefix
const getDisplayName = (user: PresenceUser): string => {
    if (user.full_name && user.full_name.trim()) return user.full_name.trim();
    return user.email.split('@')[0]; // e.g. "kuldeepyadav70789"
};

const statusConfig = {
    online: { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30', ping: true, label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    idle: { dot: 'bg-amber-400', ring: 'ring-amber-400/30', ping: false, label: 'Idle', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
    offline: { dot: 'bg-slate-500', ring: 'ring-slate-500/20', ping: false, label: 'Away', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
};

const roleConfig: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'from-purple-500 to-indigo-600' },
    teamLeader: { label: 'Team Leader', color: 'from-blue-500 to-cyan-600' },
    rider: { label: 'Rider', color: 'from-slate-600 to-slate-800' },
};

const LivePresenceDashboard: React.FC = () => {
    const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map());
    const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Fetch full names for all presence users
    const enrichWithNames = async (presenceMap: Map<string, PresenceUser>) => {
        if (presenceMap.size === 0) return;
        const ids = Array.from(presenceMap.keys());
        try {
            const { data } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', ids);
            const nm = new Map<string, string>();
            (data || []).forEach((u: any) => { if (u.full_name) nm.set(u.id, u.full_name); });
            setNameMap(nm);
        } catch { /* ignore */ }
    };

    const fetchInitialPresence = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_presence')
                .select('*')
                .order('last_seen_at', { ascending: false });
            if (error) throw error;

            const userMap = new Map<string, PresenceUser>();
            (data || []).forEach(u => userMap.set(u.user_id, u as PresenceUser));
            setUsers(userMap);
            setLastUpdated(new Date());
            enrichWithNames(userMap);
        } catch (err) {
            console.error('Failed to fetch presence:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialPresence();

        const channel = supabase.channel('global-presence')
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();

                // newState contains only currently connected riders/admins.
                // We should completely rebuild the active users map from this to ensure those who drop are removed.
                setUsers(cur => {
                    const newMap = new Map<string, PresenceUser>();

                    // We can retain DB users that were recently active if needed, but PresenceState is the source of truth.
                    // Let's populate from PresenceState first.
                    Object.values(newState).forEach((arr: any) => {
                        const p = arr[0];
                        if (p?.user_id) {
                            newMap.set(p.user_id, {
                                user_id: p.user_id,
                                email: p.email || '',
                                role: p.role || 'user',
                                status: p.status || 'online',
                                last_seen_at: p.online_at || new Date().toISOString(),
                            });
                        }
                    });

                    // We can merge in DB users from `cur` ONLY IF they are not offline and seen within last 15 mins.
                    // This handles users transitioning between pages who might drop from presence briefly.
                    const now = new Date().getTime();
                    cur.forEach((user, id) => {
                        if (!newMap.has(id)) {
                            const isStale = now - new Date(user.last_seen_at).getTime() > 15 * 60 * 1000;
                            if (user.status !== 'offline' && !isStale) {
                                newMap.set(id, user);
                            }
                        }
                    });

                    enrichWithNames(newMap);
                    return newMap;
                });
                setLastUpdated(new Date());
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, payload => {
                if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                    const record = payload.new as PresenceUser;
                    setUsers(cur => {
                        const map = new Map(cur);
                        if (record.status === 'offline') {
                            map.delete(record.user_id);
                        } else {
                            map.set(record.user_id, record);
                        }
                        enrichWithNames(map);
                        return map;
                    });
                    setLastUpdated(new Date());
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const userList = useMemo(() => {
        const now = new Date().getTime();
        return Array.from(users.values())
            .map(u => ({ ...u, full_name: nameMap.get(u.user_id) }))
            .filter(u => u.status !== 'offline') // Do not show offline users
            .filter(u => {
                // Do not show users who haven't updated in 30 minutes
                const isStale = now - new Date(u.last_seen_at).getTime() > 30 * 60 * 1000;
                return !isStale;
            })
            .sort((a, b) => {
                const w = { online: 3, idle: 2, offline: 1 };
                if (w[a.status] !== w[b.status]) return w[b.status] - w[a.status];
                return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
            });
    }, [users, nameMap]);

    const onlineCount = userList.filter(u => u.status === 'online').length;
    const idleCount = userList.filter(u => u.status === 'idle').length;
    const offlineCount = userList.filter(u => u.status === 'offline').length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <Activity size={18} className="text-indigo-500" />
                        Network Presence
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        Real-time active personnel
                        <span className="flex items-center gap-1 bg-background/50 px-1.5 py-0.5 rounded border border-border text-[9px]">
                            <RefreshCw size={8} className="animate-spin" style={{ animationDuration: '3s' }} />
                            Live · {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                        </span>
                    </p>
                </div>

                {/* Status counters */}
                <div className="flex gap-2">
                    {[
                        { label: 'Online', count: onlineCount, dot: 'bg-emerald-500 animate-pulse' },
                        { label: 'Idle', count: idleCount, dot: 'bg-amber-400' },
                        { label: 'Offline', count: offlineCount, dot: 'bg-slate-500' },
                    ].map(s => (
                        <div key={s.label} className="bg-card border border-white/5 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                            <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            <span className="text-[10px] text-muted-foreground font-semibold">{s.label}</span>
                            <span className="text-sm font-black">{s.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="bg-card border border-white/5 rounded-xl overflow-hidden shadow-lg relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                {loading ? (
                    <div className="p-10 flex flex-col items-center justify-center text-muted-foreground">
                        <RefreshCw className="animate-spin mb-3 text-indigo-500" size={24} />
                        <p className="text-sm font-semibold">Connecting to presence network...</p>
                    </div>
                ) : userList.length === 0 ? (
                    <div className="p-10 flex flex-col items-center justify-center text-muted-foreground">
                        <Users size={36} className="mb-3 opacity-20" />
                        <p className="text-sm font-semibold">No active users detected</p>
                    </div>
                ) : (
                    // ── Compact grid — 3 columns on large, 2 on medium, 1 on small ──
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 relative z-10">
                        <AnimatePresence>
                            {userList.map(user => {
                                const sc = statusConfig[user.status] || statusConfig.offline;
                                const rc = roleConfig[user.role] || roleConfig.rider;
                                const displayName = getDisplayName(user);
                                const initials = getInitials(user.full_name, user.email);
                                const timeStr = user.status === 'online'
                                    ? 'Just now'
                                    : formatDistanceToNow(parseISO(user.last_seen_at), { addSuffix: true });

                                return (
                                    <motion.div
                                        key={user.user_id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.15 }}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors
                                            ${user.status === 'online'
                                                ? 'bg-indigo-500/[0.04] border-indigo-500/10 hover:bg-indigo-500/[0.07]'
                                                : 'bg-muted/20 border-white/5 hover:bg-muted/30'
                                            }`}
                                    >
                                        {/* Avatar with status dot */}
                                        <div className="relative flex-shrink-0">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white bg-gradient-to-br ${rc.color} shadow-sm ring-2 ${sc.ring}`}>
                                                {initials}
                                            </div>
                                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${sc.dot}`}>
                                                {sc.ping && <span className={`absolute inset-0 rounded-full ${sc.dot} animate-ping opacity-60`} />}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs font-bold text-foreground truncate leading-none">{displayName}</p>
                                                <span className={`flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border ${user.role === 'admin'
                                                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/20'
                                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    }`}>
                                                    {rc.label.replace('Team Leader', 'TL')}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">{user.email}</p>
                                        </div>

                                        {/* Time */}
                                        <div className="flex-shrink-0 text-right">
                                            <p className={`text-[10px] font-bold ${sc.color}`}>{timeStr}</p>
                                            <p className="text-[9px] text-muted-foreground mt-0.5 flex items-center justify-end gap-0.5">
                                                <Wifi size={8} />
                                                {new Date(user.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LivePresenceDashboard;
