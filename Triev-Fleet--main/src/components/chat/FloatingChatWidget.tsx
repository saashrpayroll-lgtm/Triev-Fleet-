import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, Minimize2, Sparkles, User, Bot, Loader2, Zap, Brain, Globe } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/config/supabase';
import { ChatService } from '@/services/ChatService';
import { AIService } from '@/services/AIService';
import { ChatMessage, ChatMode, ChatSession } from '@/types/chat';
import { safeRender } from '@/utils/safeRender';

// --- Engine Badge Config ---
const ENGINE_BADGE: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    groq:    { label: 'Groq',    icon: <Zap size={10} className="fill-current" />,   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
    gemini:  { label: 'Gemini',  icon: <Brain size={10} />,                           color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    mistral: { label: 'Mistral', icon: <Globe size={10} />,                           color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
    unknown: { label: 'AI',      icon: <Sparkles size={10} />,                        color: 'bg-muted text-muted-foreground' },
};

// Extended ChatMessage with provider info
interface AiChatMessage extends ChatMessage {
    provider?: string;
    isStreaming?: boolean;
}

const FloatingChatWidget: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const location = useLocation();

    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [mode, setMode] = useState<ChatMode>('ai'); // 'ai' or 'manual'
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);

    // Messages
    const [messages, setMessages] = useState<AiChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [connectionError, setConnectionError] = useState<string | null>(null);

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
        setConnectionError(null);
        try {
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
            } else {
                setConnectionError("Failed to initialize chat session.");
            }
        } catch (err) {
            console.error("Session load error", err);
            setConnectionError("Connection failed. Please retry.");
        }
    };

    // State for file upload
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    /** Simulates word-by-word streaming by progressively revealing text */
    const streamTextIntoMessage = (msgId: string, fullText: string) => {
        const words = fullText.split(' ');
        let idx = 0;

        const interval = setInterval(() => {
            idx += Math.floor(Math.random() * 3) + 1; // 1-3 words per tick for natural feel
            const visible = words.slice(0, idx).join(' ');
            const done = idx >= words.length;

            setMessages(prev => prev.map(m =>
                m.id === msgId
                    ? { ...m, content: done ? fullText : visible + '…', isStreaming: !done }
                    : m
            ));

            if (done) clearInterval(interval);
        }, 40); // ~40ms per tick = fast but readable
    };

    const handleSend = async () => {
        if (!inputValue.trim() && !selectedFile) return;

        const content = inputValue;
        const fileToSend = selectedFile;

        setInputValue(''); // Clear input immediately
        setSelectedFile(null); // Clear file

        // Optimistic Update
        const tempId = Math.random().toString(36).substring(7);
        const tempMessage: AiChatMessage = {
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
                // --- AI MODE with streaming ---
                let attachmentData = undefined;

                if (fileToSend && fileToSend.type.startsWith('image/')) {
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const res = reader.result as string;
                            resolve(res.split(',')[1]);
                        };
                        reader.readAsDataURL(fileToSend);
                    });
                    attachmentData = { mimeType: fileToSend.type, data: base64 };
                }

                // Use tracked variant to get engine info
                const { text: aiResponseText, provider } = await AIService.chatWithBotTracked(
                    content || (fileToSend ? "Analyze this image" : ""),
                    messages.map(m => ({
                        role: m.sender_role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }]
                    })),
                    {
                        role: userData?.role || 'guest',
                        userName: userData?.fullName,
                        page: location.pathname,
                        permissions: userData?.permissions,
                        stats: aiContextStats
                    },
                    attachmentData
                );

                // Create AI message with provider info, start empty for streaming effect
                const aiMsgId = Math.random().toString(36).substring(7);
                const aiMessage: AiChatMessage = {
                    id: aiMsgId,
                    session_id: 'ai-session',
                    sender_role: 'ai',
                    content: '',           // starts empty — will be streamed in
                    type: 'text',
                    is_read: true,
                    created_at: new Date().toISOString(),
                    provider,
                    isStreaming: true
                };

                setIsTyping(false);
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, isSending: false } : m).concat(aiMessage));

                // Stream text word by word
                streamTextIntoMessage(aiMsgId, aiResponseText);

            } else {
                // --- MANUAL MODE ---
                let sessionId = activeSession?.id;
                if (!sessionId && userData) {
                    const sess = await ChatService.getOrCreateSession(userData.id);
                    sessionId = sess?.id;
                    setActiveSession(sess);
                }

                if (sessionId) {
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

    // Drag State
    const [position, setPosition] = useState({ x: 20, y: 20 }); // Bottom-Right offset
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const widgetStartPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);

    const handleToggle = () => {
        if (!hasMoved.current) {
            setIsOpen(prev => !prev);
        }
    };

    // Drag Handlers
    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        hasMoved.current = false;
        setIsDragging(true);

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        dragStartPos.current = { x: clientX, y: clientY };
        widgetStartPos.current = { ...position };
    };

    // AI Context Data
    const [aiContextStats, setAiContextStats] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            if (!userData) return;
            try {
                const [riders, leads] = await Promise.all([
                    supabase.from('riders').select('id, status, wallet_amount', { count: 'exact' }),
                    supabase.from('leads').select('id, status', { count: 'exact' })
                ]);

                const activeRiders = riders.data?.filter(r => r.status === 'active').length || 0;
                const totalRiders = riders.count || 0;
                const totalWallet = riders.data?.reduce((sum, r) => sum + (r.wallet_amount || 0), 0) || 0;
                const totalLeads = leads.count || 0;

                setAiContextStats({ activeRiders, totalRiders, totalWallet, totalLeads, lastUpdated: new Date().toISOString() });
            } catch (e) {
                console.error("Failed to fetch AI stats", e);
            }
        };

        if (isOpen && mode === 'ai') fetchStats();
    }, [isOpen, mode, userData]);

    // Drag Event Listeners
    useEffect(() => {
        const handleDragMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;
            e.preventDefault();

            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            const deltaX = dragStartPos.current.x - clientX;
            const deltaY = dragStartPos.current.y - clientY;

            const moveDist = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
            if (moveDist > 10) hasMoved.current = true;

            setPosition({
                x: Math.max(10, widgetStartPos.current.x + deltaX),
                y: Math.max(10, widgetStartPos.current.y + deltaY)
            });
        };

        const handleDragEnd = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove, { passive: false });
            window.addEventListener('touchend', handleDragEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setSelectedFile(file);
    };

    if (!userData) return null;

    const dragHandlers = { onMouseDown: handleDragStart, onTouchStart: handleDragStart };

    if (!isOpen) {
        return (
            <button
                onClick={handleToggle}
                style={{ right: `${position.x}px`, bottom: `${position.y}px` }}
                {...dragHandlers}
                className="fixed z-[60] w-14 h-14 bg-gradient-to-r from-primary to-purple-600 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 transition-transform duration-300 animate-in zoom-in group touch-none cursor-move"
            >
                <MessageCircle size={30} className="group-hover:rotate-12 transition-transform pointer-events-none" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background pointer-events-none" />
            </button>
        );
    }

    return (
        <div
            style={{ right: `${position.x}px`, bottom: `${position.y}px` }}
            className={`fixed z-[60] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-[width,height] ${isMinimized ? 'w-72 h-16' : 'w-[400px] h-[600px] max-w-[calc(100vw-40px)]'}`}
        >
            {/* Header */}
            <div
                {...dragHandlers}
                className="p-4 bg-card border-b border-border flex items-center justify-between shrink-0 cursor-move touch-none select-none"
            >
                <div className="flex items-center gap-3 pointer-events-none">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'ai' ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white' : 'bg-blue-600 text-white'}`}>
                        {mode === 'ai' ? <Sparkles size={20} /> : <User size={20} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-sm flex items-center gap-2">
                            {mode === 'ai' ? 'Triev AI Assistant' : 'Admin Support'}
                            {mode === 'ai' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                    TRIPLE ENGINE
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${mode === 'ai' || activeSession ? 'bg-green-500 animate-pulse' : connectionError ? 'bg-red-500' : 'bg-gray-400'}`} />
                            {mode === 'ai' ? 'Groq · Gemini · Mistral' : (activeSession ? 'Connected' : connectionError ? 'Error' : 'Connecting...')}
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

            {/* Mode Switcher + Messages + Input */}
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
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                    {mode === 'ai' ? <Bot size={32} className="text-purple-500" /> : <MessageCircle size={32} />}
                                </div>
                                <p className="text-sm font-semibold">
                                    {mode === 'ai' ? 'Ask me anything about the fleet!' : 'Start a conversation with support.'}
                                </p>
                                {mode === 'ai' && (
                                    <p className="text-xs text-muted-foreground mt-1">Powered by Groq · Gemini · Mistral</p>
                                )}
                            </div>
                        )}

                        {messages.map(msg => {
                            const isMe = msg.sender_role === 'user';
                            const badge = !isMe && msg.provider ? ENGINE_BADGE[msg.provider] || ENGINE_BADGE.unknown : null;

                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className="flex flex-col gap-1 max-w-[82%]">
                                        <div className={`p-3 rounded-2xl text-sm ${isMe
                                            ? 'bg-primary text-primary-foreground rounded-br-none'
                                            : 'bg-card border border-border rounded-bl-none shadow-sm'
                                        }`}>
                                            <p className="leading-relaxed whitespace-pre-wrap">{safeRender(msg.content)}</p>
                                            {/* Streaming cursor */}
                                            {(msg as AiChatMessage).isStreaming && (
                                                <span className="inline-block w-1.5 h-3.5 bg-current opacity-70 animate-pulse ml-0.5 rounded-sm" />
                                            )}
                                            <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        {/* Engine Badge — shown below AI messages */}
                                        {badge && !isMe && !(msg as AiChatMessage).isStreaming && (
                                            <div className={`self-start flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}>
                                                {badge.icon}
                                                <span>via {badge.label}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce [animation-delay:300ms]" />
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
                                className="p-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg disabled:opacity-50 hover:scale-105 active:scale-95 transition-all"
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
