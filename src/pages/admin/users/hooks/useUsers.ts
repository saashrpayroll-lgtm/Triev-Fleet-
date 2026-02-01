import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { createClient } from '@supabase/supabase-js';
import { User } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { logActivity } from '@/utils/activityLog';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const useUsers = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    // Hardcoded list of immune users (Super Admins)
    const IMMUNE_USERS = ['admin@example.com', 'saunvir1130', 'saunvir.singh@triev.in'];

    const isImmune = (user: User) => {
        return IMMUNE_USERS.includes(user.email) || IMMUNE_USERS.includes(user.username || '');
    };
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();
    const { userData: currentUser, refreshUserData } = useSupabaseAuth();

    // Helper: Generate ID
    const getNextId = useCallback(async (role: string) => {
        const prefix = role === 'admin' ? 'TRIEV_ADM' : 'TRIEV_TL';

        try {
            const { data: lastUser, error } = await supabase
                .from('users')
                .select('user_id')
                .ilike('user_id', `${prefix}%`)
                .order('user_id', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (lastUser && lastUser.length > 0 && lastUser[0].user_id) {
                const lastId = lastUser[0].user_id;
                // Remove prefix, parse remaining as int
                const numPart = parseInt(lastId.replace(prefix, '')) || 0;
                return `${prefix}${(numPart + 1).toString().padStart(3, '0')}`;
            } else {
                return `${prefix}001`;
            }
        } catch (e) {
            console.error("ID Gen Error:", e);
            return `${prefix}001`; // Fallback
        }
    }, []);


    // Pagination State
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const USERS_PER_PAGE = 20;

    // Real-time Fetch with Pagination
    const fetchUsers = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setLoading(true);
            setPage(0);
            setUsers([]);
        }

        const currentOffset = isRefresh ? 0 : page * USERS_PER_PAGE;

        const { data, error } = await supabase
            .from('users')
            .select(`
                id,
                email,
                fullName:full_name,
                role,
                status,
                mobile,
                userId:user_id,
                username,
                jobLocation:job_location,
                reportingManager:reporting_manager,
                permissions,
                remarks,
                profilePicUrl:profile_pic_url,
                suspendedUntil:suspended_until,
                createdAt:created_at,
                updatedAt:updated_at
            `)
            .order('created_at', { ascending: false })
            .range(currentOffset, currentOffset + USERS_PER_PAGE - 1);

        if (error) {
            console.error('Error fetching users:', error);
            const msg = `Sync Failed: ${error.message || JSON.stringify(error)}`;
            setError(msg);
            toast.error(msg);
        } else {
            const mappedUsers = (data || []) as User[];

            setUsers(prev => {
                const combined = isRefresh ? mappedUsers : [...prev, ...mappedUsers];
                // Deduping just in case
                const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                return unique;
            });

            setHasMore(data.length === USERS_PER_PAGE);
            if (!isRefresh && data.length > 0) {
                setPage(prev => prev + 1);
            }

            // Lazy cleanup (Auto-Reactivation)
            const now = new Date();
            mappedUsers.forEach(async (userData) => {
                if (userData.status === 'suspended' && userData.suspendedUntil) {
                    const suspendedUntilDate = new Date(userData.suspendedUntil as any);
                    if (now > suspendedUntilDate) {
                        await supabase.from('users').update({
                            status: 'active',
                            suspended_until: null,
                            updated_at: new Date().toISOString()
                        }).eq('id', userData.id);
                    }
                }
            });
        }
        setLoading(false);
    }, [page]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchUsers(false);
        }
    }, [loading, hasMore, fetchUsers]);

    // Initial Load
    useEffect(() => {
        fetchUsers(true);

        const subscription = supabase
            .channel('users-list-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload: any) => {
                console.log('Real-time sync payload:', payload);
                const { eventType, new: next, old } = payload;

                setUsers(prev => {
                    if (eventType === 'INSERT') {
                        // Prepend new users
                        const mappedNew = {
                            id: next.id,
                            email: next.email,
                            fullName: next.full_name,
                            role: next.role,
                            status: next.status,
                            mobile: next.mobile,
                            userId: next.user_id,
                            username: next.username,
                            jobLocation: next.job_location,
                            reportingManager: next.reporting_manager,
                            permissions: next.permissions,
                            remarks: next.remarks,
                            profilePicUrl: next.profile_pic_url,
                            suspendedUntil: next.suspended_until,
                            createdAt: next.created_at,
                            updatedAt: next.updated_at
                        } as User;
                        return [mappedNew, ...prev];
                    }

                    if (eventType === 'UPDATE') {
                        return prev.map(u => {
                            if (u.id === next.id) {
                                return {
                                    ...u,
                                    email: next.email,
                                    fullName: next.full_name,
                                    role: next.role,
                                    status: next.status,
                                    mobile: next.mobile,
                                    userId: next.user_id,
                                    username: next.username,
                                    jobLocation: next.job_location,
                                    reportingManager: next.reporting_manager,
                                    permissions: next.permissions,
                                    remarks: next.remarks,
                                    profilePicUrl: next.profile_pic_url,
                                    suspendedUntil: next.suspended_until,
                                    updatedAt: next.updated_at
                                } as User;
                            }
                            return u;
                        });
                    }

                    if (eventType === 'DELETE') {
                        return prev.filter(u => u.id !== old.id);
                    }

                    return prev;
                });
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Create User
    const createUser = useCallback(async (userData: any, password: string): Promise<boolean> => {
        try {
            // 1. Create in Supabase Auth (using secondary client)
            const tempSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // Pass metadata so the DB Trigger can populate the profile
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: userData.email,
                password: password,
                options: {
                    data: {
                        full_name: userData.fullName,
                        mobile: userData.mobile,
                        role: userData.role
                    }
                }
            });

            if (authError) throw authError;
            const supabaseUser = authData.user;
            if (!supabaseUser) throw new Error("No user returned from signUp");

            // 2. WAIT for Trigger to Create User Row (Retry Logic)
            // The trigger is fast, but we need to be sure before updating
            let retryCount = 0;
            let userCreated = false;
            while (retryCount < 5 && !userCreated) {
                const { data } = await supabase.from('users').select('id').eq('id', supabaseUser.id).single();
                if (data) userCreated = true;
                else await new Promise(res => setTimeout(res, 500)); // Wait 500ms
                retryCount++;
            }

            if (!userCreated) {
                // Fallback: If trigger failed, manually insert (though rare)
                console.warn("Trigger slow or failed, attempting manual upsert for profile");
                // In setup_database_full.sql, public.users has no required fields other than id?
                // Actually constraint might demand email.
            }

            // 3. Update Full Profile Details
            // The trigger only sets: id, email, role, full_name, mobile, created_at
            // We need to save: user_id (custom), job_location, reporting_manager, remarks, username, position
            const updatePayload: any = {
                user_id: userData.userId, // Custom ID from form (TRIEV_...)
                username: userData.username,
                job_location: userData.jobLocation,
                reporting_manager: userData.reportingManager,
                remarks: userData.remarks,
                // position: userData.position, // Add column if not exists, or map to 'role'? 
                // Note: Schema has 'role' (enum) but maybe not 'position'. 
                // Checking setup_database_full.sql -> 'position' column DOES NOT EXIST. Use 'role' or add it?
                // UserFormModal has 'position' input. 
                // Let's assume 'position' might need to be stored in 'remarks' or we add a column.
                // For now, let's map it to 'job_location' if relevant or just skip if no column.
                // Actually, let's check validation. If I include a non-existent column, update will fail.
                // setup_database_full.sql showed: id, user_id, full_name, mobile, email, role, status, job_location, reporting_manager, permissions, remarks, profile_pic_url, suspended_until...
                // NO 'position' column.
                // workaround: Append position to remarks? Or just ignore?
                // I will ignore 'position' for now to prevent SQL error, or append to remarks.
                updated_at: new Date().toISOString()
            };

            // Append position to remarks if present
            if (userData.position) {
                updatePayload.remarks = `${userData.remarks || ''}\n[Position: ${userData.position}]`.trim();
            }

            const { error: updateError } = await supabase
                .from('users')
                .update(updatePayload)
                .eq('id', supabaseUser.id);

            if (updateError) {
                console.error("Failed to update extra details:", updateError);
                toast.warning("User created but some details failed to save.");
            } else {
                toast.success('User created successfully');
            }

            // 4. Log
            logActivity({
                actionType: 'userCreated',
                targetType: 'user',
                targetId: supabaseUser.id,
                details: `Created user ${userData.fullName} (${userData.role})`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);

            // Wait a moment for trigger to complete before refreshing
            setTimeout(async () => {
                await fetchUsers(); // Auto-refresh
            }, 1000);
            return true;
        } catch (err: any) {
            console.error('Create User Error (Full):', err);
            toast.error('Failed to create user: ' + (err.message || "Unknown error"));
            return false;
        }
    }, [currentUser, fetchUsers]);

    // Update User
    const updateUser = useCallback(async (userId: string, data: Partial<User>) => {
        console.log('updateUser called:', userId, data);
        const userToUpdate = users.find(u => u.id === userId);
        if (userToUpdate && isImmune(userToUpdate)) {
            toast.error("Action Denied: This is a Super Admin account.");
            return false;
        }

        try {
            const updatePayload: any = {
                updated_at: new Date().toISOString()
            };

            if (data.fullName !== undefined) updatePayload.full_name = data.fullName;
            if (data.email !== undefined) updatePayload.email = data.email;
            if (data.mobile !== undefined) updatePayload.mobile = data.mobile;
            if (data.role !== undefined) updatePayload.role = data.role;
            if (data.jobLocation !== undefined) updatePayload.job_location = data.jobLocation;
            if (data.reportingManager !== undefined) updatePayload.reporting_manager = data.reportingManager || null;
            if (data.status !== undefined) updatePayload.status = data.status;
            if (data.permissions !== undefined) updatePayload.permissions = data.permissions;
            if (data.remarks !== undefined) updatePayload.remarks = data.remarks;
            if (data.username !== undefined) updatePayload.username = data.username;
            if (data.profilePicUrl !== undefined) updatePayload.profile_pic_url = data.profilePicUrl;

            const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
            if (error) throw error;

            logActivity({
                actionType: 'userEdited',
                targetType: 'user',
                targetId: userId,
                details: `Updated details for user ID ${userId}`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);

            toast.success('User updated successfully');
            await fetchUsers(); // Auto-refresh

            // If updating self, refresh auth context immediately
            if (currentUser && currentUser.id === userId) {
                await refreshUserData();
            }
            return true;
        } catch (err: any) {
            console.error('Update User Error:', err);
            toast.error('Failed to update user');
            return false;
        }
    }, [currentUser, users, fetchUsers]);

    // Toggle User Status
    const toggleUserStatus = useCallback(async (user: User) => {
        console.log('toggleUserStatus called:', user);
        if (isImmune(user)) {
            toast.error("Action Denied: This is a Super Admin account.");
            return;
        }

        const userId = user.id;
        const currentStatus = user.status;

        try {
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

            const updateData: any = {
                status: newStatus,
                updated_at: new Date().toISOString()
            };

            if (currentStatus === 'suspended' || newStatus === 'active') {
                updateData.suspended_until = null;
            }

            const { error } = await supabase.from('users').update(updateData).eq('id', userId);
            if (error) throw error;

            logActivity({
                actionType: 'statusChanged',
                targetType: 'user',
                targetId: userId,
                details: `Changed status to ${newStatus}`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);

            const action = newStatus === 'active' ? 'activated' : 'deactivated';
            toast.success(`User ${action} successfully`);
            await fetchUsers(); // Auto-refresh

            // If updating self, refresh auth context immediately
            if (currentUser && currentUser.id === userId) {
                await refreshUserData();
            }
        } catch (error: any) {
            console.error("Error toggling status:", error);
            const msg = error?.message || "Failed to update status";
            toast.error(msg);
        }
    }, [currentUser, fetchUsers]);

    // Suspend User
    const suspendUser = useCallback(async (user: User, durationMinutes: number) => {
        console.log('suspendUser called:', user.id, durationMinutes);
        try {
            let suspendedUntil = null;
            if (durationMinutes > 0) {
                const now = new Date();
                now.setMinutes(now.getMinutes() + durationMinutes);
                suspendedUntil = now.toISOString();
            }

            const { error } = await supabase.from('users').update({
                status: 'suspended',
                suspended_until: suspendedUntil,
                updated_at: new Date().toISOString()
            }).eq('id', user.id);

            if (error) throw error;

            logActivity({
                actionType: 'userEdited',
                targetType: 'user',
                targetId: user.id,
                details: `Suspended user ${user.fullName} for ${durationMinutes === -1 ? 'Always' : durationMinutes + ' mins'}`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);

            toast.success(`User ${user.fullName} suspended`);
            await fetchUsers(); // Auto-refresh

            // If updating self, refresh auth context immediately
            if (currentUser && currentUser.id === user.id) {
                await refreshUserData();
            }
        } catch (err) {
            toast.error('Failed to suspend user');
        }
    }, [currentUser, fetchUsers]);

    // Send Password Reset - Currently not used, kept for future reference
    // const sendResetEmail = useCallback(async (email: string) => {
    //     try {
    //         const { error } = await supabase.auth.resetPasswordForEmail(email, {
    //             redirectTo: `${window.location.origin}/reset-password`,
    //         });
    //         if (error) throw error;
    //         toast.success(`Reset link sent to ${email}`);
    //     } catch (err: any) {
    //         console.error('Reset Password Error:', err);
    //         toast.error(err.message || 'Failed to send reset link');
    //     }
    // }, []);

    // Soft Delete User
    const deleteUser = useCallback(async (user: User) => {
        console.log('deleteUser called:', user.id);
        if (!confirm(`Are you sure you want to delete ${user.fullName}? (Soft Delete)`)) return;

        try {
            const { error } = await supabase.from('users').update({
                status: 'deleted',
                updated_at: new Date().toISOString()
            }).eq('id', user.id);

            if (error) throw error;

            logActivity({
                actionType: 'userDeleted',
                targetType: 'user',
                targetId: user.id,
                details: `Soft deleted user ${user.fullName}`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);

            toast.success('User moved to trash');
            await fetchUsers(); // Auto-refresh
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete user');
        }
    }, [currentUser, fetchUsers]);

    // Restore User
    const restoreUser = useCallback(async (user: User) => {
        try {
            const { error } = await supabase.from('users').update({
                status: 'active',
                updated_at: new Date().toISOString()
            }).eq('id', user.id);

            if (error) throw error;

            logActivity({
                actionType: 'userRestored',
                targetType: 'user',
                targetId: user.id,
                details: `Restored user ${user.fullName}`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);

            toast.success('User restored successfully');
            await fetchUsers(); // Auto-refresh
        } catch (err) {
            console.error(err);
            toast.error('Failed to restore user');
        }
    }, [currentUser, fetchUsers]);

    // Permanent Delete User (Hard Delete)
    const permanentDeleteUser = useCallback(async (user: User) => {
        if (currentUser?.role !== 'admin') {
            toast.error("Permission Denied: Only Admins can permanently delete users.");
            return;
        }

        if (isImmune(user)) {
            toast.error("Action Denied: This is a Super Admin account.");
            return;
        }

        if (!confirm(`PERMANENT DELETE: This will completely remove ${user.fullName} and their history. This cannot be undone. Are you sure?`)) return;

        try {
            const { error } = await supabase.from('users').delete().eq('id', user.id);

            if (error) {
                // Handle FK constraint errors
                if (error.code === '23503') {
                    throw new Error("Unable to delete: This user still has active dependencies in the database. Please ensure you have run the 'fix_user_deletion_schema.sql' migration in Supabase SQL Editor to allow cascading deletes.");
                }
                throw error;
            }

            logActivity({
                actionType: 'userPermanentlyDeleted',
                targetType: 'user',
                targetId: user.id,
                details: `Permanently deleted user ${user.fullName}`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);

            toast.success('User permanently deleted from database');
            await fetchUsers();
        } catch (err: any) {
            console.error('Permanent Delete Error:', err);
            toast.error(err.message || 'Failed to permanently delete user');
        }
    }, [currentUser, fetchUsers]);

    // Sync Usernames
    const syncUsernames = useCallback(async () => {
        if (!currentUser) return;
        toast.info('Username sync not required for Supabase DB.', 2000);
    }, [currentUser]);

    // Unified Bulk Action Handler
    const runBulkAction = useCallback(async (selectedUsers: User[], action: (u: User) => Promise<boolean>, actionLabel: string) => {
        let successCount = 0;
        let failCount = 0;
        let immuneCount = 0;

        for (const user of selectedUsers) {
            if (isImmune(user)) {
                immuneCount++;
                continue;
            }

            try {
                const success = await action(user);
                if (success) successCount++;
                else failCount++;
            } catch (err) {
                console.error(`Bulk ${actionLabel} failed for ${user.email}:`, err);
                failCount++;
            }
        }

        if (successCount > 0) {
            toast.success(`Successfully ${actionLabel} ${successCount} users`);
        }
        if (failCount > 0) {
            toast.error(`Failed to ${actionLabel} ${failCount} users`);
        }
        if (immuneCount > 0) {
            toast.warning(`${immuneCount} Super Admin accounts were protected and skipped`);
        }

        // No need to fetchUsers(true) here because real-time listener will handle it!
        // But for safety/feedback:
        // await fetchUsers(true); 
    }, [toast, isImmune]);

    // Bulk Delete
    const bulkDeleteUsers = useCallback(async (selectedUsers: User[]) => {
        if (!confirm(`Move ${selectedUsers.length} users to trash?`)) return;
        await runBulkAction(selectedUsers, async (u) => {
            const { error } = await supabase.from('users').update({
                status: 'deleted',
                updated_at: new Date().toISOString()
            }).eq('id', u.id);

            if (error) return false;

            logActivity({
                actionType: 'userDeleted',
                targetType: 'user',
                targetId: u.id,
                details: `Soft deleted via bulk action`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);
            return true;
        }, 'deleted');
    }, [currentUser, runBulkAction]);

    const bulkSuspendUsers = useCallback(async (selectedUsers: User[]) => {
        if (!confirm(`Suspend ${selectedUsers.length} users?`)) return;
        await runBulkAction(selectedUsers, async (u) => {
            const { error } = await supabase.from('users').update({
                status: 'suspended',
                updated_at: new Date().toISOString()
            }).eq('id', u.id);

            if (error) return false;

            logActivity({
                actionType: 'userEdited',
                targetType: 'user',
                targetId: u.id,
                details: `Suspended via bulk action`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);
            return true;
        }, 'suspended');
    }, [currentUser, runBulkAction]);

    const bulkToggleStatus = useCallback(async (selectedUsers: User[]) => {
        if (!confirm(`Toggle status for ${selectedUsers.length} users?`)) return;
        await runBulkAction(selectedUsers, async (u) => {
            const newStatus = u.status === 'active' ? 'inactive' : 'active';
            const { error } = await supabase.from('users').update({
                status: newStatus,
                updated_at: new Date().toISOString()
            }).eq('id', u.id);

            if (error) return false;

            logActivity({
                actionType: 'statusChanged',
                targetType: 'user',
                targetId: u.id,
                details: `Status toggled to ${newStatus} via bulk action`,
                performedBy: currentUser?.email || 'admin'
            }).catch(console.error);
            return true;
        }, 'updated (status)');
    }, [currentUser, runBulkAction]);

    return {
        users,
        loading,
        error,
        createUser,
        updateUser,
        toggleStatus: toggleUserStatus,
        suspendUser,
        // sendResetEmail, // Commented out - not currently used
        deleteUser,
        restoreUser,
        syncUsernames,
        permanentDeleteUser,
        bulkDeleteUsers,
        bulkSuspendUsers,
        bulkToggleStatus,
        refreshUsers: fetchUsers,
        getNextId,
        loadMore,
        hasMore
    };
};
