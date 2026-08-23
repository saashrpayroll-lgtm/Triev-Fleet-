import { useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';

export type PresenceStatus = 'online' | 'idle' | 'offline';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function usePresence(userId: string | undefined, email: string | undefined, role: string | undefined) {
    const [status, setStatus] = useState<PresenceStatus>('offline');
    const idleTimer = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        if (!userId) return;

        // 1. Function to update database with current state
        const updatePresenceDB = async (newStatus: PresenceStatus) => {
            try {
                const { error } = await supabase.rpc('upsert_user_presence', {
                    p_user_id: userId,
                    p_email: email,
                    p_role: role,
                    p_status: newStatus
                });
                // Silently ignore if function doesn't exist (404) — non-critical feature
                if (error && error.code !== '42883' && !error.message?.includes('not found')) {
                    console.warn("Presence update issue:", error.message);
                }
            } catch {
                // Non-critical — don't block app startup
            }
        };

        // 2. Setup Realtime Channel for instant sub-second broadcasting
        const getOrCreateGlobalChannel = () => {
            const existing = supabase.getChannels().find(c => c.topic === 'realtime:global-presence');
            if (existing) return existing;

            const ch = supabase.channel('global-presence', {
                config: {
                    presence: {
                        key: userId,
                    },
                },
            });

            ch.on('presence', { event: 'sync' }, () => {
                window.dispatchEvent(new CustomEvent('global-presence-sync', { detail: ch.presenceState() }));
            });
            // \u2705 EGRESS OPTIMIZED: Removed postgres_changes listener on user_presence table.
            // The Realtime Presence channel above (presenceState) already handles all
            // online/offline updates without any DB query egress.

            return ch;
        };

        const channel = getOrCreateGlobalChannel();
        channelRef.current = channel;

        const broadcastPresence = async (newStatus: PresenceStatus) => {
            setStatus(newStatus);
            try {
                if (channel.state === 'joined') {
                    await channel.track({
                        user_id: userId,
                        email: email,
                        role: role,
                        status: newStatus,
                        online_at: new Date().toISOString(),
                    });
                }
            } catch (e) {
                console.warn('Presence track warning:', e);
            }
            // Also save to database for historical state when offline
            await updatePresenceDB(newStatus);
        };

        // Subscribe to channel if not already subscribed/subscribing
        if (channel.state !== 'joined' && channel.state !== 'joining') {
            channel.subscribe(async (subStatus) => {
                if (subStatus === 'SUBSCRIBED') {
                    await broadcastPresence('online');
                }
            });
        } else {
            broadcastPresence('online');
        }

        // 3. Activity Tracking for 'Idle' state
        // Throttle: only process activity events at most once per 10 seconds
        // to avoid flooding React with state updates on every mousemove/scroll.
        // The idle timer is still cleared/reset, but the state update is throttled.
        let lastActivityTime = 0;
        const ACTIVITY_THROTTLE_MS = 10_000; // 10 seconds

        const resetIdleTimer = () => {
            if (idleTimer.current) clearTimeout(idleTimer.current);

            const now = Date.now();
            if (now - lastActivityTime > ACTIVITY_THROTTLE_MS) {
                lastActivityTime = now;
                setStatus((currentStatus) => {
                    if (currentStatus === 'idle') {
                        // Transition back to online
                        broadcastPresence('online');
                    }
                    return 'online';
                });
            }

            idleTimer.current = setTimeout(() => {
                broadcastPresence('idle');
            }, IDLE_TIMEOUT_MS);
        };

        // Start tracking activity — use passive listeners to avoid blocking scroll/touch
        window.addEventListener('mousemove', resetIdleTimer, { passive: true });
        window.addEventListener('keydown', resetIdleTimer, { passive: true });
        window.addEventListener('click', resetIdleTimer, { passive: true });
        window.addEventListener('scroll', resetIdleTimer, { passive: true });
        window.addEventListener('touchstart', resetIdleTimer, { passive: true });

        // Initial setup
        resetIdleTimer();

        // 4. Safe Shutdown on tab close
        const handleBeforeUnload = () => {
            // Need to use sendBeacon or synchronous calls for reliable unload fires, 
            // but channel untrack is synchronous enough for Supabase
            channel.untrack();

            // We use standard async here, it's fire-and-forget on close. 
            // Often browsers will complete it if small enough.
            updatePresenceDB('offline');
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            // Cleanup on unmount
            if (idleTimer.current) clearTimeout(idleTimer.current);
            window.removeEventListener('mousemove', resetIdleTimer);
            window.removeEventListener('keydown', resetIdleTimer);
            window.removeEventListener('click', resetIdleTimer);
            window.removeEventListener('scroll', resetIdleTimer);
            window.removeEventListener('touchstart', resetIdleTimer);
            window.removeEventListener('beforeunload', handleBeforeUnload);

            channel.untrack();
            supabase.removeChannel(channel);
            updatePresenceDB('offline');
        };
    }, [userId, email, role]);

    return status;
}
