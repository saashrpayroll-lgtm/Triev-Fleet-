import React, { useState } from 'react';
import { Send } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { supabase } from '@/config/supabase';
import { NotificationType } from '@/types';
import { toast } from 'sonner';

const AdminBroadcastSystem: React.FC = () => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<NotificationType>('system');
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [isSending, setIsSending] = useState(false);

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) return toast.error('Title and message are required');

        setIsSending(true);
        try {
            // Fetch all Team Leaders
            const { data: teamLeaders, error: tlError } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'teamLeader');

            if (tlError) throw tlError;
            if (!teamLeaders || teamLeaders.length === 0) {
                toast.error('No team leaders found to receive the broadcast.');
                return;
            }

            // Create notification payloads
            const notifications = teamLeaders.map(tl => ({
                user_id: tl.id,
                title,
                message,
                type,
                priority,
                is_read: false,
                created_at: new Date().toISOString()
            }));

            // Insert notifications
            const { error: insertError } = await supabase.from('notifications').insert(notifications);
            if (insertError) throw insertError;

            toast.success(`Broadcast sent to ${teamLeaders.length} Team Leaders successfully!`);

            // Reset form
            setTitle('');
            setMessage('');
            setType('system');
            setPriority('medium');

        } catch (error) {
            console.error('Broadcast failed:', error);
            toast.error('Failed to send broadcast');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <GlassCard className="p-5 border-border/40 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 mb-6">
            <div className="flex items-center gap-3 mb-4 border-b border-border/50 pb-4">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                    <Send size={20} className="text-indigo-500" />
                </div>
                <div>
                    <h2 className="text-lg font-bold">Admin Broadcast System</h2>
                    <p className="text-xs text-muted-foreground">Send global alerts or announcements to all Team Leaders</p>
                </div>
            </div>

            <form onSubmit={handleBroadcast} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Title / Headline</label>
                        <input
                            type="text"
                            placeholder="e.g., Critical Collection Drive"
                            className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                            <select
                                className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                            >
                                <option value="low">Low (Normal)</option>
                                <option value="medium">Medium</option>
                                <option value="high">High (Urgent)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Alert Type</label>
                            <select
                                className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={type}
                                onChange={(e) => setType(e.target.value as NotificationType)}
                            >
                                <option value="system">Announcement</option>
                                <option value="alert">Alert</option>
                                <option value="warning">Warning</option>
                                <option value="success">Success / Milestone</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Detailed Message</label>
                    <textarea
                        placeholder="Type your broadcast message here. Be clear and concise."
                        className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-y"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isSending || !title.trim() || !message.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                        {isSending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send size={16} /> Broadcast to all TLs
                            </>
                        )}
                    </button>
                </div>
            </form>
        </GlassCard>
    );
};

export default AdminBroadcastSystem;
