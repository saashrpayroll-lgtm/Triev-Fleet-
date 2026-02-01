import { supabase } from '@/config/supabase';

export type NotificationType = 'info' | 'success' | 'warning' | 'alert' | 'system' | 'riderAlert' | 'walletAlert' | 'permissionChange';

interface SendNotificationParams {
    title: string;
    message: string;
    type: NotificationType;
    targetUserId?: string; // Specific user
    targetRole?: 'admin' | 'teamLeader' | 'rider'; // specific role
    relatedEntityId?: string;
    relatedEntityType?: 'user' | 'rider' | 'system';
}

/**
 * Sends a notification to a specific user or all users with a specific role.
 */
export const sendNotification = async ({
    title,
    message,
    type,
    targetUserId,
    targetRole,
    relatedEntityId,
    relatedEntityType
}: SendNotificationParams) => {
    try {
        const timestamp = new Date().toISOString();
        const baseNotification = {
            title,
            message,
            type,
            related_entity: relatedEntityId ? { id: relatedEntityId, type: relatedEntityType } : {},
            is_read: false,
            created_at: timestamp
        };

        if (targetUserId) {
            // Send to single user
            await supabase.from('notifications').insert({
                ...baseNotification,
                user_id: targetUserId
            });
        } else if (targetRole) {
            // Send to all users with role
            const { data: users } = await supabase.from('users').select('id').eq('role', targetRole);

            if (users && users.length > 0) {
                const notifications = users.map(user => ({
                    ...baseNotification,
                    user_id: user.id
                }));
                await supabase.from('notifications').insert(notifications);
            }
        }
    } catch (error) {
        console.error('Failed to send notification:', error);
    }
};

/**
 * Convenience method to notify all admins
 */
export const notifyAdmins = async (title: string, message: string, type: NotificationType = 'info') => {
    // For now, let's assume filtering users by role 'admin'.
    // Logic for finding admins:
    // If we have a dedicated 'admin' role in Supabase 'users' table or permissions.

    // We can try sending to targetRole 'admin'
    await sendNotification({
        title,
        message,
        type,
        targetRole: 'admin'
    });
};

/**
 * Backward compatibility wrapper for createNotification
 * Used in RiderManagement.tsx
 */
export const createNotification = async (
    target: 'all_admins' | string,
    title: string,
    message: string,
    type: NotificationType
) => {
    if (target === 'all_admins') {
        await notifyAdmins(title, message, type);
    } else {
        // Assume target is userId
        await sendNotification({
            targetUserId: target,
            title,
            message,
            type
        });
    }
};

/**
 * Backward compatibility wrapper for notifyTeamLeader
 * Used in RiderManagement.tsx
 * Handles message construction based on action type
 */
export const notifyTeamLeader = async (
    teamLeaderId: string,
    action: 'create' | 'update' | 'status_active' | 'status_inactive' | 'reassign_from' | 'reassign_to',
    riderName: string,
    riderId: string
) => {
    if (!teamLeaderId) return;

    let title = '';
    let message = '';
    let type: NotificationType = 'info';

    switch (action) {
        case 'create':
            title = 'New Rider Assigned';
            message = `New rider ${riderName} has been assigned to your team.`;
            type = 'success';
            break;
        case 'update':
            title = 'Rider Updated';
            message = `Details for rider ${riderName} have been updated.`;
            type = 'info';
            break;
        case 'status_active':
            title = 'Rider Activated';
            message = `Rider ${riderName} is now Active.`;
            type = 'success';
            break;
        case 'status_inactive':
            title = 'Rider Deactivated';
            message = `Rider ${riderName} has been marked as Inactive.`;
            type = 'warning';
            break;
        case 'reassign_from':
            title = 'Rider Reassigned';
            message = `Rider ${riderName} has been reassigned to another Team Leader.`;
            type = 'info';
            break;
        case 'reassign_to':
            title = 'Rider Assigned';
            message = `Rider ${riderName} has been reassigned to you.`;
            type = 'success';
            break;
    }

    await sendNotification({
        targetUserId: teamLeaderId,
        title,
        message,
        type,
        relatedEntityId: riderId,
        relatedEntityType: 'rider'
    });
};
