import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/config/supabase';
import { User } from '@/types';
import { Session } from '@supabase/supabase-js';

import liveSheetAutoSync from '@/services/LiveSheetAutoSyncService';

interface SupabaseAuthContextType {
    session: Session | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any | null;
    userData: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshUserData: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useSupabaseAuth = () => {
    const context = useContext(SupabaseAuthContext);
    if (!context) {
        throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
    }
    return context;
};

export const SupabaseAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [user, setUser] = useState<any | null>(null);
    const [userData, setUserData] = useState<User | null>(() => {
        try {
            const cached = localStorage.getItem('cached_user_data');
            if (cached) return JSON.parse(cached);
        } catch {}
        return null;
    });
    const [loading, setLoading] = useState<boolean>(() => {
        try {
            const cached = localStorage.getItem('cached_user_data');
            // If cached user profile exists, resolve loading state immediately (0ms instant startup)
            if (cached) return false;
        } catch {}
        return true;
    });
    // useRef instead of useState — updating it does NOT trigger re-renders,
    // which means event listeners are registered ONCE and never torn down/re-added.
    const lastActivityRef = React.useRef<number>(Date.now());
    const AUTO_LOGOUT_TIME = 30 * 60 * 1000; // 30 minutes

    // Auto-logout effect — runs once when user logs in, never re-runs on activity
    useEffect(() => {
        if (!user) return;

        const checkInactivity = () => {
            const stayActive = localStorage.getItem('stayActive') === 'true';
            if (!stayActive && Date.now() - lastActivityRef.current > AUTO_LOGOUT_TIME) {
                signOut();
            }
        };

        const interval = setInterval(checkInactivity, 30000);

        // Also check inactivity when tab/app regains focus.
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                checkInactivity();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        const updateActivity = () => { lastActivityRef.current = Date.now(); };

        window.addEventListener('mousemove', updateActivity, { passive: true });
        window.addEventListener('keydown', updateActivity, { passive: true });
        window.addEventListener('click', updateActivity, { passive: true });
        window.addEventListener('scroll', updateActivity, { passive: true });
        window.addEventListener('touchstart', updateActivity, { passive: true });

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keydown', updateActivity);
            window.removeEventListener('click', updateActivity);
            window.removeEventListener('scroll', updateActivity);
            window.removeEventListener('touchstart', updateActivity);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const formatUserData = (data: any): User => {
        return {
            id: data.id,
            userId: data.user_id || data.userId,
            email: data.email,
            mobile: data.mobile,
            fullName: data.full_name || data.fullName,
            role: typeof data.role === 'string' ? data.role : 'guest',
            status: typeof data.status === 'string' ? data.status : 'active',
            permissions: typeof data.permissions === 'string'
                ? JSON.parse(data.permissions)
                : (data.permissions || {}),
            reportingManager: data.reporting_manager || data.reportingManager,
            jobLocation: data.job_location || data.jobLocation,
            profilePicUrl: data.profile_pic_url || data.profilePicUrl,
            username: data.username,
            force_password_change: data.force_password_change ?? data.forcePasswordChange ?? false,
            last_password_change: data.last_password_change || data.lastPasswordChange,
            cityOpsId: data.city_ops_id || data.cityOpsId,
            createdAt: typeof (data.created_at || data.createdAt) === 'object' ? new Date(data.created_at || data.createdAt).toISOString() : (data.created_at || data.createdAt),
            updatedAt: typeof (data.updated_at || data.updatedAt) === 'object' ? new Date(data.updated_at || data.updatedAt).toISOString() : (data.updated_at || data.updatedAt),
            remarks: typeof data.remarks === 'object' ? JSON.stringify(data.remarks) : data.remarks,
            suspendedUntil: data.suspended_until || data.suspendedUntil,
        } as User;
    };

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let subscription: any = null;

        const setupSubscription = async (userId: string) => {
            subscription = supabase
                .channel(`public:users:id=eq.${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'users',
                        filter: `id=eq.${userId}`,
                    },
                    (payload) => {
                        const newData = formatUserData(payload.new);
                        setUserData(prev => ({ ...prev, ...newData }));
                        try { localStorage.setItem('cached_user_data', JSON.stringify(newData)); } catch {}
                    }
                )
                .subscribe();
        };

        // Safety Timeout: Force loading to false after 2.0 seconds max under any network situation
        const safetyTimer = setTimeout(() => {
            setLoading(false);
        }, 2000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserData(session.user.id, session.user.email);
                setupSubscription(session.user.id);
            } else {
                setUserData(null);
                try { localStorage.removeItem('cached_user_data'); } catch {}
                setLoading(false);
                clearTimeout(safetyTimer);
            }
        }).catch((err) => {
            console.error('Failed to get Supabase auth session:', err);
            clearTimeout(safetyTimer);
            setLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription: authListener },
        } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (event === 'SIGNED_OUT') {
                setUserData(null);
                try { localStorage.removeItem('cached_user_data'); } catch {}
                setLoading(false);
                return;
            }

            // Clean up previous subscription if exists
            if (subscription) supabase.removeChannel(subscription);

            if (session?.user) {
                fetchUserData(session.user.id, session.user.email);
                setupSubscription(session.user.id);
            } else {
                setUserData(null);
                try { localStorage.removeItem('cached_user_data'); } catch {}
                setLoading(false);
            }
        });

        return () => {
            clearTimeout(safetyTimer);
            authListener.unsubscribe();
            if (subscription) supabase.removeChannel(subscription);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchUserData = async (userId: string, email?: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
                    id,
                    userId:user_id,
                    fullName:full_name,
                    email,
                    mobile,
                    role,
                    status,
                    permissions,
                    reportingManager:reporting_manager,
                    jobLocation:job_location,
                    profilePicUrl:profile_pic_url,
                    remarks,
                    suspendedUntil:suspended_until,
                    username,
                    force_password_change,
                    last_password_change,
                    createdAt:created_at,
                    updatedAt:updated_at
                `)
                .eq('id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // User doesn't exist in public.users yet
            } else if (error) {
                console.error('Error fetching user data:', error);
            }

            if (data) {
                const formatted = formatUserData(data);
                setUserData(formatted);
                if (formatted.id) {
                    liveSheetAutoSync.initialize(formatted.id, formatted.fullName || `${formatted.role} User`);
                }
                try {
                    localStorage.setItem('cached_user_data', JSON.stringify(formatted));
                    localStorage.setItem('user_role', data.role || '');
                } catch {}
            } else {
                console.warn('User profile not found in database. Using minimal fallback.');
                setUserData({
                    id: userId,
                    email: email || '',
                    role: 'guest',
                    fullName: email?.split('@')[0] || 'Guest User',
                    status: 'active',
                    username: email?.split('@')[0] || 'guest',
                    permissions: {}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any as User);
            }

        } catch (err) {
            console.error('Unexpected error fetching user data:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshUserData = async () => {
        if (session?.user) {
            await fetchUserData(session.user.id, session.user.email);
        }
    };

    const login = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) throw error;
    };

    const signOut = async () => {
        // Read role NOW (before clearing anything) — also check localStorage as fallback
        // This ensures auto-logout's closure captures the correct role even if userData is stale.
        const roleFromContext = userData?.role as string | undefined;
        let role: string | undefined = roleFromContext;
        if (!role) {
            try { role = localStorage.getItem('user_role') ?? undefined; } catch { /* ignore */ }
        }
        try {
            // 1. Force kill all active Subscriptions/Channels
            await supabase.removeAllChannels();

            // Clear auth tokens from local storage
            Object.keys(localStorage).forEach(key => {
                if (key.includes('supabase.auth.token') || key === 'user_role') {
                    localStorage.removeItem(key);
                }
            });

            // 2. Attempt graceful signout with 2-second timeout
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Sign out timeout')), 2000)
            );

            try {
                await Promise.race([supabase.auth.signOut(), timeoutPromise]);
            } catch (authError) {
                console.warn('Backend signout timed out or failed, proceeding with local signout:', authError);
            }

            // Role-based redirect — admin → /admin-login, everyone else → /login
            if (role === 'admin') {
                window.location.href = '/admin-login';
            } else {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Logout failed fatally:', error);
            // Even in fatal error, use stored role for redirect (don't lose admin to /login)
            let fallbackRole: string | null = null;
            try { fallbackRole = localStorage.getItem('user_role'); } catch { /* ignore */ }
            window.location.href = (fallbackRole === 'admin' || role === 'admin') ? '/admin-login' : '/login';
        }
    };

    const value = {
        session,
        user,
        userData,
        loading,
        login,
        signInWithGoogle,
        signOut,
        refreshUserData
    };

    return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
};
