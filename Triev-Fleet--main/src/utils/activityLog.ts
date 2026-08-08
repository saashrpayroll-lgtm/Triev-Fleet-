import { supabase } from '@/config/supabase';
import { notifyAdmins, sendNotification, NotificationType } from '@/utils/notificationUtils';

export interface ActivityLogData {
    actionType: string;
    targetType: string;
    targetId: string;
    details: string;
    performedBy?: string; // email or name
    role?: string;
    metadata?: {
        ip?: string;
        userAgent?: string;
        location?: string; // Optional GPS
        teamLeaderId?: string; // For routing to TL
        [key: string]: any;
    };
}

export const logActivity = async (data: ActivityLogData) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id || 'system';
        const currentUserName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'System';
        const currentUserRole = user?.user_metadata?.role || 'admin';

        const logEntry = {
            user_id: currentUserId,
            user_name: currentUserName,
            user_role: currentUserRole,
            action_type: data.actionType,
            target_type: data.targetType,
            target_id: data.targetId,
            details: data.details,
            metadata: {
                ...data.metadata,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                screenHeight: window.screen.height,
                screenWidth: window.screen.width,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                language: navigator.language
            },
            timestamp: new Date().toISOString(),
            is_deleted: false
        };

        const { error } = await supabase.from('activity_logs').insert(logEntry);
        if (error) console.error("Supabase Log Error:", error);

        // --- AUTOMATIC NOTIFICATION DISPATCH ---

        // 1. Determine Notification Type based on action keywords
        let notifType: NotificationType = 'info';
        const lowerAction = data.actionType.toLowerCase();
        const lowerDetails = data.details.toLowerCase();

        if (lowerAction.includes('delete') || lowerAction.includes('suspend') || lowerAction.includes('ban')) {
            notifType = 'alert';
        } else if (lowerAction.includes('create') || lowerAction.includes('add') || lowerAction.includes('success')) {
            notifType = 'success';
        } else if (lowerAction.includes('update') || lowerAction.includes('edit') || lowerAction.includes('modify')) {
            notifType = 'info';
        } else if (lowerAction.includes('warn') || lowerAction.includes('fail') || lowerDetails.includes('error') || lowerDetails.includes('failed')) {
            notifType = 'warning';
        }

        // 2. Notify Admins (Global Catch-all)
        await notifyAdmins(
            `System Activity: ${data.actionType}`,
            `${data.details} (by ${currentUserName})`,
            notifType
        );

        // 3. Smart Routing to Team Leader
        if (data.targetType === 'rider' && data.metadata?.teamLeaderId) {
            await sendNotification({
                targetUserId: data.metadata.teamLeaderId,
                title: `Rider Update: ${data.actionType}`,
                message: data.details,
                type: notifType,
                relatedEntityId: data.targetId,
                relatedEntityType: 'rider'
            });
        }

    } catch (error) {
        console.error('Failed to log activity or send notification:', error);
    }
};
