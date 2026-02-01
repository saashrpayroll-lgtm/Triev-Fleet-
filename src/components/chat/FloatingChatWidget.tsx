import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, Minimize2, Sparkles, User, Bot, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext'; // Assuming you have this
import { ChatService } from '@/services/ChatService';
import { AIService } from '@/services/AIService';
import { ChatMessage, ChatMode, ChatSession } from '@/types/chat';

const FloatingChatWidget: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const location = useLocation();

    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [mode, setMode] = useState<ChatMode>('ai'); // 'ai' or 'manual'
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);

    // Messages
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);



    // Initial Load & Auth logic
    useEffect(() => {
        if (isOpen && userData && mode === 'manual') {
            loadManualSession();
        }
    }, [isOpen, mode, userData]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const loadManualSession = async () => {
        if (!userData) return;
        const session = await ChatService.getOrCreateSession(userData.id);
        if (session) {
            setActiveSession(session);
            const msgs = await ChatService.getMessages(session.id);
            setMessages(msgs);

            // Subscribe to realtime
            const sub = ChatService.subscribeToSession(session.id, (payload) => {
                const newMessage = payload.new as ChatMessage;
                setMessages(prev => {
                    if (prev.find(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
            });

            return () => { sub.unsubscribe(); };
        }
    };

    // State for file upload
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleSend = async () => {
        if (!inputValue.trim() && !selectedFile) return;

        const content = inputValue;
        const fileToSend = selectedFile;

        setInputValue(''); // Clear input immediately
        setSelectedFile(null); // Clear file

        // Optimistic Update
        const tempId = Math.random().toString(36).substring(7);
        const tempMessage: ChatMessage = {
            id: tempId,
            session_id: activeSession?.id || 'temp',
            sender_id: userData?.id,
            sender_role: 'user',
            content: content || (fileToSend ? 'Sent an attachment' : ''),
            type: fileToSend ? (fileToSend.type.startsWith('image/') ? 'image' : 'document') : 'text',
            media_url: fileToSend ? URL.createObjectURL(fileToSend) : undefined,
            file_name: fileToSend?.name,
            is_read: false,
            created_at: new Date().toISOString(),
            isSending: true
        };

        setMessages(prev => [...prev, tempMessage]);
        setIsTyping(true);

        try {
            if (mode === 'ai') {
                // --- AI MODE ---
                let attachmentData = undefined;

                if (fileToSend && fileToSend.type.startsWith('image/')) {
                    // Convert to Base64
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const res = reader.result as string;
                            // Remove data:image/xxx;base64, prefix
                            resolve(res.split(',')[1]);
                        };
                        reader.readAsDataURL(fileToSend);
                    });
                    attachmentData = { mimeType: fileToSend.type, data: base64 };
                }

                const aiResponseText = await AIService.chatWithBot(
                    content || (fileToSend ? "Analyze this image" : ""),
                    messages.map(m => ({
                        role: m.sender_role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }]
                    })),
                    {
                        role: userData?.role || 'guest',
                        userName: userData?.fullName,
                        page: location.pathname,
                        permissions: userData?.permissions
                    },
                    attachmentData
                );

                // Add AI Response
                const aiMessage: ChatMessage = {
                    id: Math.random().toString(),
                    session_id: 'ai-session',
                    sender_role: 'ai',
                    content: aiResponseText,
                    type: 'text',
                    is_read: true,
                    created_at: new Date().toISOString()
                };

                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, isSending: false } : m).concat(aiMessage));

            } else {
                // --- MANUAL MODE ---
                // 1. Ensure Session
                let sessionId = activeSession?.id;
                if (!sessionId && userData) {
                    const sess = await ChatService.getOrCreateSession(userData.id);
                    sessionId = sess?.id;
                    setActiveSession(sess);
                }

                if (sessionId) {
                    // Upload File if exists
                    let mediaUrl = undefined;
                    let type: 'text' | 'image' | 'document' = 'text';

                    if (fileToSend) {
                        const uploadedUrl = await ChatService.uploadAttachment(fileToSend);
                        if (uploadedUrl) mediaUrl = uploadedUrl;
                        type = fileToSend.type.startsWith('image/') ? 'image' : 'document';
                    }

                    const sentMsg = await ChatService.sendMessage(
                        sessionId,
                        userData?.id || null,
                        'user',
                        content,
                        type,
                        mediaUrl,
                        fileToSend?.name
                    );

                    if (sentMsg) {
                        setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
                    }
                }
            }
        } catch (error) {
            console.error('Send failed', error);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, error: true, isSending: false } : m));
        } finally {
            setIsTyping(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };



    if (!userData) return null;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-[60] w-14 h-14 bg-gradient-to-r from-primary to-purple-600 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 transition-transform duration-300 animate-in zoom-in group"
            >
                <MessageCircle size={30} className="group-hover:rotate-12 transition-transform" />
                {/* Notification Badge could go here */}
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background"></span>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 z-[60] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${isMinimized ? 'w-72 h-16' : 'w-[400px] h-[600px] max-w-[calc(100vw-40px)]'}`}>

            {/* Header */}
            <div className="p-4 bg-card border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'ai' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}`}>
                        {mode === 'ai' ? <Sparkles size={20} /> : <User size={20} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-sm flex items-center gap-2">
                            {mode === 'ai' ? 'Triev AI Assistant' : 'Admin Support'}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${mode === 'ai' || activeSession ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {mode === 'ai' ? 'Online' : (activeSession ? 'Connected' : 'Connecting...')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-accent rounded-lg transition-colors">
                        <Minimize2 size={16} className="text-muted-foreground" />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-accent rounded-lg transition-colors">
                        <X size={16} className="text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Mode Switcher (Only visible if not minimized) */}
            {!isMinimized && (
                <>
                    <div className="p-2 border-b border-border bg-muted/20 flex gap-2">
                        <button
                            onClick={() => setMode('ai')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${mode === 'ai' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
                        >
                            <Sparkles size={14} /> AI Chatbot
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${mode === 'manual' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
                        >
                            <User size={14} /> Live Support
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-accent/5">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                    {mode === 'ai' ? <Bot size={32} /> : <MessageCircle size={32} />}
                                </div>
                                <p className="text-sm font-medium">
                                    {mode === 'ai' ? 'Ask me anything about the app!' : 'Start a conversation with support.'}
                                </p>
                            </div>
                        )}

                        {messages.map(msg => {
                            const isMe = msg.sender_role === 'user';
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe
                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                        : 'bg-card border border-border rounded-bl-none shadow-sm'
                                        }`}>
                                        <p>{typeof msg.content === 'string' ? msg.content : (typeof msg.content === 'object' ? JSON.stringify(msg.content) : String(msg.content || ''))}</p>
                                        <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-card border border-border px-4 py-2 rounded-2xl rounded-bl-none">
                                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-card border-t border-border">
                        {selectedFile && (
                            <div className="flex items-center gap-2 mb-2 p-2 bg-accent/20 rounded-lg text-xs">
                                <Paperclip size={14} className="text-primary" />
                                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                                <button onClick={() => setSelectedFile(null)} className="ml-auto hover:text-destructive">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <div className="flex items-end gap-2 bg-accent/30 p-2 rounded-xl border border-transparent focus-within:border-primary/50 transition-colors">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"
                            >
                                <Paperclip size={18} />
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                            </button>
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder={mode === 'ai' ? "Ask the AI..." : "Type a message..."}
                                className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-24 min-h-[40px] py-2 text-sm"
                                rows={1}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                                className="p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:scale-105 active:scale-95 transition-all"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default FloatingChatWidget;
