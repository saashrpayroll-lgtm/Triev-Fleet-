import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/config/supabase';
import { User } from '@/types';
import { Session } from '@supabase/supabase-js';

interface SupabaseAuthContextType {
    session: Session | null;
    user: any | null;
    userData: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshUserData: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export const useSupabaseAuth = () => {
    const context = useContext(SupabaseAuthContext);
    if (!context) {
        throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
    }
    return context;
};

export const SupabaseAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<any | null>(null);
    const [userData, setUserData] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const formatUserData = (data: any): User => {
        return {
            id: data.id,
            userId: data.user_id || data.userId,
            email: data.email,
            mobile: data.mobile,
            fullName: data.full_name || data.fullName,
            role: data.role,
            status: data.status,
            permissions: typeof data.permissions === 'string'
                ? JSON.parse(data.permissions)
                : (data.permissions || {}),
            reportingManager: data.reporting_manager || data.reportingManager,
            jobLocation: data.job_location || data.jobLocation,
            profilePicUrl: data.profile_pic_url || data.profilePicUrl,
            username: data.username,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            remarks: data.remarks,
            suspendedUntil: data.suspended_until || data.suspendedUntil,
            currentLocation: data.current_location || data.currentLocation
        } as User;
    };

    useEffect(() => {
        let subscription: any = null;

        const setupSubscription = async (userId: string) => {
            console.log(`Setting up real-time subscription for user ${userId}`);
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
                        console.log('Real-time user update received:', payload.new);
                        if (payload.new.permissions) {
                            console.log('New Permissions received:', typeof payload.new.permissions, payload.new.permissions);
                        }
                        const newData = formatUserData(payload.new);
                        // Force update state
                        setUserData(prev => ({ ...prev, ...newData }));
                    }
                )
                .subscribe((status) => {
                    console.log(`Subscription status for ${userId}:`, status);
                });
        };

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserData(session.user.id, session.user.email);
                setupSubscription(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const {
            data: { subscription: authListener },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            // Clean up previous subscription if exists
            if (subscription) supabase.removeChannel(subscription);

            if (session?.user) {
                fetchUserData(session.user.id, session.user.email);
                setupSubscription(session.user.id);
            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        return () => {
            authListener.unsubscribe();
            if (subscription) supabase.removeChannel(subscription);
        };
    }, []);

    const fetchUserData = async (userId: string, email?: string) => {
        try {
            // Try to get user from 'users' table
            let { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // User doesn't exist in public.users yet, maybe auto-create or just return basics
                console.log("User not found in public.users, basic access only");
                // Optional: Create basic user record here if needed
            } else if (error) {
                console.error('Error fetching user data:', error);
            }

            if (data) {
                setUserData(formatUserData(data));
            } else {
                // Fallback for visual debugging before DB migration is complete
                setUserData({
                    id: userId,
                    email: email || '',
                    role: 'admin', // DEFAULT TO ADMIN FOR INITIAL SETUP - CHANGE THIS LATER
                    fullName: 'Supabase User',
                    status: 'active',
                    username: email?.split('@')[0] || 'user'
                } as User);
            }

        } catch (err) {
            console.error('Unexpected error fetching user data:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshUserData = async () => {
        if (session?.user) {
            console.log('Manually refreshing user data...');
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
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
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
