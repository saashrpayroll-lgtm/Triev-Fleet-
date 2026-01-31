import { supabase } from '@/config/supabase';
import { ChatMessage, ChatSession, SenderRole, MessageType } from '@/types/chat';

export const ChatService = {

    // --- Sessions ---

    /**
     * Get or create an active chat session for the current user
     */
    getOrCreateSession: async (userId: string): Promise<ChatSession | null> => {
        try {
            // Check for existing active session
            const { data: existing } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (existing) return existing;

            // Create new session
            const { data: newSession, error: createError } = await supabase
                .from('chat_sessions')
                .insert({ user_id: userId, status: 'active' })
                .select()
                .single();

            if (createError) throw createError;
            return newSession;
        } catch (err) {
            console.error('Error in getOrCreateSession:', err);
            return null;
        }
    },

    /**
     * Fetch messages for a specific session
     */
    getMessages: async (sessionId: string): Promise<ChatMessage[]> => {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
        return data as ChatMessage[];
    },

    /**
     * Send a message
     */
    sendMessage: async (
        sessionId: string,
        senderId: string | null, // null for AI
        role: SenderRole,
        content: string,
        type: MessageType = 'text',
        mediaUrl?: string,
        fileName?: string
    ): Promise<ChatMessage | null> => {
        const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                session_id: sessionId,
                sender_id: senderId,
                sender_role: role,
                content,
                type,
                media_url: mediaUrl,
                file_name: fileName,
                is_read: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error sending message:', error);
            return null;
        }

        // Update session timestamp
        await supabase
            .from('chat_sessions')
            .update({ updated_at: new Date().toISOString(), last_message_at: new Date().toISOString() })
            .eq('id', sessionId);

        return data as ChatMessage;
    },

    /**
     * Mark messages as read
     */
    markAsRead: async (sessionId: string, _roleToMark: SenderRole) => {
        // Placeholder
        console.log('Marking as read', sessionId, _roleToMark);
    },

    // --- Attachments ---

    uploadAttachment: async (file: File): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Upload failed:', error);
            return null;
        }
    },

    // --- Subscriptions ---

    subscribeToSession: (sessionId: string, callback: (payload: any) => void) => {
        return supabase
            .channel(`chat:${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` },
                callback
            )
            .subscribe();
    }
};
