export type ChatMode = 'ai' | 'manual';
export type MessageType = 'text' | 'image' | 'document' | 'audio';
export type SenderRole = 'user' | 'admin' | 'ai' | 'system';
export type SessionStatus = 'active' | 'closed' | 'archived';

export interface ChatSession {
    id: string;
    user_id: string;
    assigned_to?: string;
    status: SessionStatus;
    created_at: string;
    updated_at: string;
    last_message_at: string;
    metadata?: Record<string, any>;
}

export interface ChatMessage {
    id: string;
    session_id: string;
    sender_id?: string;
    sender_role: SenderRole;
    content: string;
    type: MessageType;
    media_url?: string;
    file_name?: string;
    is_read: boolean;
    created_at: string;
    // UI-only state
    isSending?: boolean;
    error?: boolean;
}

export interface ChatAttachment {
    file: File;
    previewUrl: string;
    type: 'image' | 'document';
}
