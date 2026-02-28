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
                await supabase.rpc('upsert_user_presence', {
                    p_user_id: userId,
                    p_email: email,
                    p_role: role,
                    p_status: newStatus
                });
            } catch (err) {
                console.error("Failed to update presence DB:", err);
            }
        };

        // 2. Setup Realtime Channel for instant sub-second broadcasting
        const channel = supabase.channel('global-presence', {
            config: {
                presence: {
                    key: userId,
                },
            },
        });
        channelRef.current = channel;

        const broadcastPresence = async (newStatus: PresenceStatus) => {
            setStatus(newStatus);
            // Broadcast to all active listeners immediately
            await channel.track({
                user_id: userId,
                email: email,
                role: role,
                status: newStatus,
                online_at: new Date().toISOString(),
            });
            // Also save to database for historical state when offline
            await updatePresenceDB(newStatus);
        };

        // Subscribe to channel
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await broadcastPresence('online');
            }
        });

        // 3. Activity Tracking for 'Idle' state
        const resetIdleTimer = () => {
            if (idleTimer.current) clearTimeout(idleTimer.current);

            setStatus((currentStatus) => {
                if (currentStatus === 'idle') {
                    // Transition back to online
                    broadcastPresence('online');
                }
                return 'online';
            });

            idleTimer.current = setTimeout(() => {
                broadcastPresence('idle');
            }, IDLE_TIMEOUT_MS);
        };

        // Start tracking activity
        window.addEventListener('mousemove', resetIdleTimer);
        window.addEventListener('keydown', resetIdleTimer);
        window.addEventListener('click', resetIdleTimer);
        window.addEventListener('scroll', resetIdleTimer);
        window.addEventListener('touchstart', resetIdleTimer);

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
