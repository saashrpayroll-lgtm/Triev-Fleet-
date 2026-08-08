import { supabase } from '@/config/supabase';
import { NotificationType, NotificationPriority } from '@/types';

export interface SendNotificationParams {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    priority?: NotificationPriority;
    relatedEntity?: {
        type: 'rider' | 'user' | 'request' | 'wallet';
        id: string;
    };
    tags?: string[];
}

export const NotificationService = {
    /**
     * Send a notification to a specific user
     */
    send: async (params: SendNotificationParams) => {
        try {
            const { error } = await supabase.from('notifications').insert({
                user_id: params.userId,
                title: params.title,
                message: params.message,
                type: params.type,
                priority: params.priority || 'medium',
                related_entity: params.relatedEntity,
                is_read: false,
                created_at: new Date().toISOString()
            });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Failed to send notification:', error);
            return false;
        }
    },

    /**
     * Notify all Admins
     */
    notifyAdmins: async (title: string, message: string, type: NotificationType, relatedEntity?: SendNotificationParams['relatedEntity']) => {
        try {
            // Fetch all admins
            const { data: admins } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin');

            if (!admins || admins.length === 0) return;

            const notifications = admins.map(admin => ({
                user_id: admin.id,
                title,
                message,
                type,
                priority: 'high',
                related_entity: relatedEntity,
                is_read: false,
                created_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('notifications').insert(notifications);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Failed to notify admins:', error);
            return false;
        }
    },

    /**
     * Broadcast to multiple users
     */
    broadcast: async (userIds: string[], title: string, message: string, type: NotificationType, priority: NotificationPriority = 'medium', tags: string[] = [], announcementId?: string) => {
        try {
            const notifications = userIds.map(id => ({
                user_id: id,
                title,
                message,
                type,
                priority,
                related_entity: { tags, announcementId }, // Store tags and announcementLink
                is_read: false,
                created_at: new Date().toISOString()
            }));

            // Chunking
            const batchSize = 100;
            for (let i = 0; i < notifications.length; i += batchSize) {
                const chunk = notifications.slice(i, i + batchSize);
                await supabase.from('notifications').insert(chunk);
            }
            return true;
        } catch (error) {
            console.error('Broadcast failed:', error);
            return false;
        }
    }
};
