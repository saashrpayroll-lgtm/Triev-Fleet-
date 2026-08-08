import React, { useState, useEffect, useRef } from 'react';
import { ChatService } from '@/services/ChatService';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { ChatMessage } from '@/types/chat';
import { Send, User, RefreshCw } from 'lucide-react';
import { safeRender } from '@/utils/safeRender';

const AdminChat: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<any | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch Sessions
    const loadSessions = async () => {
        setLoading(true);
        const data = await ChatService.getAllActiveSessions();
        setSessions(data);
        setLoading(false);
    };

    useEffect(() => {
        loadSessions();
        // Poll for new sessions every 30s
        const interval = setInterval(loadSessions, 30000);
        return () => clearInterval(interval);
    }, []);

    // Fetch Messages when session selected
    useEffect(() => {
        if (!selectedSession) return;

        const fetchMessages = async () => {
            const msgs = await ChatService.getMessages(selectedSession.id);
            setMessages(msgs);
        };
        fetchMessages();

        // Subscribe to this session
        const sub = ChatService.subscribeToSession(selectedSession.id, (payload) => {
            const newMessage = payload.new as ChatMessage;
            setMessages(prev => {
                if (prev.find(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });
            // Also update the session list last_message time if needed
        });

        return () => { sub.unsubscribe(); };
    }, [selectedSession]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || !selectedSession) return;

        const content = inputValue;
        setInputValue('');

        // Optimistic
        const tempId = Math.random().toString();
        const tempMsg: ChatMessage = {
            id: tempId,
            session_id: selectedSession.id,
            sender_id: userData?.id,
            sender_role: 'admin',
            content: content,
            type: 'text',
            is_read: true,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);

        await ChatService.sendMessage(
            selectedSession.id,
            userData?.id || null,
            'admin',
            content
        );
    };

    return (
        <div className="flex h-[calc(100vh-100px)] gap-4 p-4">
            {/* Sidebar List */}
            <div className="w-1/3 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h2 className="font-bold text-lg">Active Chats</h2>
                    <button onClick={loadSessions} className="p-2 hover:bg-accent rounded-full"><RefreshCw size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-muted-foreground">Loading...</div>
                    ) : sessions.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">No active sessions</div>
                    ) : (
                        sessions.map(session => (
                            <div
                                key={session.id}
                                onClick={() => setSelectedSession(session)}
                                className={`p-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors ${selectedSession?.id === session.id ? 'bg-accent border-l-4 border-l-primary' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="font-semibold">{session.user?.full_name || session.user?.email || 'Unknown User'}</div>
                                    <div className="text-xs text-muted-foreground">{new Date(session.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                                    <span className={`w-2 h-2 rounded-full ${session.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                    {session.user?.role || 'User'}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden shadow-sm">
                {!selectedSession ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                        <User size={48} className="mb-4 opacity-20" />
                        <p>Select a conversation to start chatting</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold">{selectedSession.user?.full_name || 'User'}</h3>
                                <p className="text-xs text-muted-foreground">{selectedSession.user?.email}</p>
                            </div>
                            <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                Direct Support
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5">
                            {messages.map(msg => {
                                const isMe = msg.sender_role === 'admin';
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${isMe
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-card border border-border rounded-bl-none shadow-sm'
                                            }`}>
                                            <p>{safeRender(msg.content)}</p>
                                            <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-100' : 'text-muted-foreground'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-border bg-card">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a reply..."
                                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim()}
                                    className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminChat;
