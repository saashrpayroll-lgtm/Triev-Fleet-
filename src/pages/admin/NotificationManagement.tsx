import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Bell, Send, Trash2, Users, User, Shield, Sparkles, Search, AlertCircle, X, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import { NotificationType, NotificationPriority } from '@/types';
import { AIService } from '@/services/AIService';
import { NotificationService } from '@/services/NotificationService';
import GlassCard from '@/components/GlassCard';
import { toast } from 'sonner';

interface SystemNotification {
    id: string;
    title: string;
    body: string;
    targetRole: 'all' | 'rider' | 'teamLeader' | 'single_user' | 'single_rider';
    targetId?: string; // For single user/rider
    targetName?: string; // Display name
    createdBy: string;
    createdAt: string; // ISO String
    priority: NotificationPriority;
    tags: string[];
    type: NotificationType;
}

const NotificationManagement: React.FC = () => {
    const { userData: currentUser } = useSupabaseAuth();
    // Data State
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Filter/Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');

    // Form State
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [targetRole, setTargetRole] = useState<'all' | 'rider' | 'teamLeader' | 'single_user' | 'single_rider'>('all');
    const [priority, setPriority] = useState<NotificationPriority>('medium');
    const [notificationType, setNotificationType] = useState<NotificationType>('system');
    const [tags, setTags] = useState<string[]>([]);
    const [currentTag, setCurrentTag] = useState('');

    // Single Target State
    const [searchTarget, setSearchTarget] = useState('');
    const [targetResults, setTargetResults] = useState<{ id: string, name: string, sub?: string }[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<{ id: string, name: string } | null>(null);

    // AI Modal
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState('professional');
    const [aiLoading, setAiLoading] = useState(false);

    // Fetch Notifications
    const fetchAnnouncements = async () => {
        setRefreshing(true);
        try {
            const { data } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) {
                const mappedAnnouncements: SystemNotification[] = data.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    body: item.body,
                    targetRole: item.target_role,
                    targetId: item.target_id,
                    targetName: item.target_name,
                    priority: item.priority,
                    tags: item.tags || [],
                    type: item.type,
                    createdBy: item.created_by,
                    createdAt: item.created_at
                }));
                setNotifications(mappedAnnouncements);
            }
        } catch (error) {
            console.error("Error fetching announcements:", error);
            toast.error("Failed to load history.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Real-time Subscription
    useEffect(() => {
        fetchAnnouncements();

        // Subscribe to changes
        const channel = supabase
            .channel('public:announcements')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'announcements' },
                (payload) => {
                    console.log('Real-time update received:', payload);
                    fetchAnnouncements();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Search Targets Logic
    useEffect(() => {
        const search = async () => {
            if (searchTarget.length < 2) {
                setTargetResults([]);
                return;
            }
            const results: { id: string, name: string, sub?: string }[] = [];
            try {
                if (targetRole === 'single_rider') {
                    // Use correct snake_case for Supabase query
                    const { data: riders } = await supabase
                        .from('riders')
                        .select('id, riderName:rider_name, mobileNumber:mobile_number')
                        .or(`rider_name.ilike.%${searchTarget}%,mobile_number.ilike.%${searchTarget}%`)
                        .limit(10);
                    riders?.forEach((r: any) => results.push({ id: r.id, name: r.riderName, sub: r.mobileNumber }));
                } else if (targetRole === 'single_user') {
                    const { data: users } = await supabase
                        .from('users')
                        .select('id, fullName:full_name, email')
                        .or(`full_name.ilike.%${searchTarget}%,email.ilike.%${searchTarget}%`)
                        .limit(10);
                    users?.forEach((u: any) => results.push({ id: u.id, name: u.fullName, sub: u.email }));
                }
                setTargetResults(results);
            } catch (err) { console.error(err); }
        };
        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [searchTarget, targetRole]);


    // Handlers
    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && currentTag.trim()) {
            e.preventDefault();
            if (!tags.includes(currentTag.trim())) setTags([...tags, currentTag.trim()]);
            setCurrentTag('');
        }
    };
    const removeTag = (t: string) => setTags(tags.filter(tag => tag !== t));

    const handleAiGenerate = async () => {
        if (!aiTopic) return;
        setAiLoading(true);
        try {
            const result = await AIService.generateNotificationContent(aiTopic, targetRole, aiTone);
            if (result) {
                setTitle(result.title);
                setBody(result.body);
                setPriority(result.priority as NotificationPriority);
                if (result.tags) setTags(result.tags);
                if (result.type) setNotificationType(result.type as NotificationType);
                setShowAiModal(false);
                toast.success("Content generated by AI");
            }
        } catch (e) {
            console.error(e);
            toast.error("AI Generation failed");
        } finally {
            setAiLoading(false);
        }
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        // Permission check
        if (currentUser?.permissions?.notifications?.broadcast === false) {
            toast.error("Permission Denied: You cannot send broadcasts.");
            return;
        }

        if (!currentUser) {
            toast.error("Session expired. Please login.");
            return;
        }
        if (!title || !body) {
            toast.error("Title and message are required.");
            return;
        }
        if ((targetRole === 'single_user' || targetRole === 'single_rider') && !selectedTarget) {
            toast.error("Please select a recipient.");
            return;
        }

        if (!confirm(`Send this ${priority} priority notification?`)) return;

        setSending(true);
        const toastId = toast.loading("Sending notification...");

        try {
            // 1. Create History Record
            const announcementData = {
                title,
                body,
                target_role: targetRole,
                target_id: selectedTarget?.id || null,
                target_name: selectedTarget?.name || null,
                priority,
                tags,
                type: notificationType,
                created_by: currentUser.fullName || currentUser.email || 'Admin',
                created_at: new Date().toISOString(),
            };

            const { data: insertedData, error: annError } = await supabase.from('announcements').insert(announcementData).select().single();
            if (annError) throw annError;
            const announcementId = insertedData.id;

            // 2. Fan-out
            const targets: string[] = [];
            // Logic to gather IDs...
            if (targetRole === 'single_user' || targetRole === 'single_rider') {
                if (selectedTarget) targets.push(selectedTarget.id);
            } else {
                if (targetRole === 'rider' || targetRole === 'all') {
                    const { data } = await supabase.from('riders').select('id');
                    data?.forEach((d: any) => targets.push(d.id));
                }
                if (targetRole === 'teamLeader' || targetRole === 'all') {
                    const { data } = await supabase.from('users').select('id').eq('role', 'teamLeader');
                    data?.forEach((d: any) => targets.push(d.id));
                }
                // Add Admin/Self for check
                if (currentUser.id && !targets.includes(currentUser.id)) targets.push(currentUser.id);
            }

            // 3. Send using Service (with announcementId link)
            await NotificationService.broadcast(targets, title, body, notificationType, priority, tags, announcementId);

            toast.success(`Sent to ${targets.length} recipients successfully!`, { id: toastId, duration: 5000 });

            // Reset Form (Wait briefly to ensure toast is visible)
            setTimeout(() => {
                setTitle('');
                setBody('');
                setTags([]);
                setPriority('medium');
                setSelectedTarget(null);
                setSearchTarget('');
            }, 500);

        } catch (error: any) {
            console.error("Send Error:", error);
            toast.error(error.message || "Failed to send.", { id: toastId, duration: 5000 });
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (currentUser?.permissions?.notifications?.delete === false) {
            toast.error("Permission Denied: You cannot delete/recall notifications.");
            return;
        }

        if (!confirm("Delete and recall message from all users?")) return;
        const toastId = toast.loading("Recalling message...");
        try {
            // Delete from notifications first (Recall from users)
            // Use JSON filter to find notifications linked to this announcement
            await supabase.from('notifications').delete().contains('related_entity', { announcementId: id });

            // Delete from history
            await supabase.from('announcements').delete().eq('id', id);

            toast.success("Message recalled and deleted.", { id: toastId, duration: 4000 });
            // Realtime will update list
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete.", { id: toastId });
        }
    };

    const filteredNotifications = useMemo(() => {
        return notifications.filter(note => {
            const lowSearch = searchTerm.toLowerCase();
            const matchSearch = note.title.toLowerCase().includes(lowSearch) || note.body.toLowerCase().includes(lowSearch);
            const matchType = filterType === 'all' || note.type === filterType;
            return matchSearch && matchType;
        });
    }, [notifications, searchTerm, filterType]);

    // Render Helpers
    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return 'bg-red-500/10 text-red-600 border-red-200';
            case 'medium': return 'bg-orange-500/10 text-orange-600 border-orange-200';
            default: return 'bg-green-500/10 text-green-600 border-green-200';
        }
    };

    return (
        <div className="space-y-8 p-2 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-primary to-primary/60 rounded-xl shadow-lg shadow-primary/20 text-white">
                        <Bell size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                            Broadcast Center
                        </h1>
                        <p className="text-muted-foreground font-medium">Manage system-wide alerts and notifications</p>
                    </div>
                </div>
                <button
                    onClick={fetchAnnouncements}
                    disabled={refreshing}
                    className="p-2.5 rounded-full hover:bg-accent/50 border border-transparent hover:border-border transition-all"
                >
                    <RefreshCcw size={20} className={refreshing ? "animate-spin text-primary" : "text-muted-foreground"} />
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Compose Section */}
                <div className="xl:col-span-5 space-y-6">
                    {currentUser?.permissions?.notifications?.broadcast !== false ? (
                        <GlassCard className="p-6 border-primary/10 shadow-xl relative overflow-hidden">
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                            <div className="flex justify-between items-center mb-6 relative">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Send className="text-primary" size={22} /> Compose Message
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowAiModal(true)}
                                    className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full flex items-center gap-2 hover:bg-indigo-100 transition-all shadow-sm hover:shadow-indigo-100 border border-indigo-200"
                                >
                                    <Sparkles size={14} className="animate-pulse" /> AI Assistant
                                </button>
                            </div>

                            <form onSubmit={handleSendNotification} className="space-y-5 relative">
                                {/* Target Selection */}
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-foreground/80">Recipients</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'all', icon: Users, label: 'Everyone' },
                                            { id: 'teamLeader', icon: Shield, label: 'Leaders' },
                                            { id: 'rider', icon: User, label: 'Riders' },
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => { setTargetRole(opt.id as any); setSelectedTarget(null); }}
                                                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all duration-200 ${targetRole === opt.id
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-105'
                                                    : 'bg-card hover:bg-accent border-border hover:border-primary/30'}`}
                                            >
                                                <opt.icon size={18} /> {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => { setTargetRole('single_user'); setSearchTarget(''); }}
                                            className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${targetRole === 'single_user' ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-accent'}`}
                                        >
                                            Specific User
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setTargetRole('single_rider'); setSearchTarget(''); }}
                                            className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${targetRole === 'single_rider' ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-accent'}`}
                                        >
                                            Specific Rider
                                        </button>
                                    </div>

                                    {/* Search Input for Single Target */}
                                    {(['single_user', 'single_rider'].includes(targetRole)) && (
                                        <div className="relative animate-in fade-in slide-in-from-top-2">
                                            {selectedTarget ? (
                                                <div className="flex items-center justify-between p-3 border border-primary/30 bg-primary/5 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                            <User size={14} />
                                                        </div>
                                                        <span className="font-semibold text-sm">{selectedTarget.name}</span>
                                                    </div>
                                                    <button onClick={() => setSelectedTarget(null)} className="p-1 hover:bg-background rounded-full"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                                    <input
                                                        className="w-full pl-9 p-2.5 bg-background border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                                        placeholder={`Search ${targetRole === 'single_user' ? 'User' : 'Rider'}...`}
                                                        value={searchTarget}
                                                        onChange={e => setSearchTarget(e.target.value)}
                                                    />
                                                    {targetResults.length > 0 && (
                                                        <div className="absolute w-full mt-1 bg-card border rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                                                            {targetResults.map(res => (
                                                                <div key={res.id} onClick={() => { setSelectedTarget({ id: res.id, name: res.name }); setSearchTarget(''); setTargetResults([]); }}
                                                                    className="p-3 hover:bg-accent cursor-pointer border-b last:border-0 text-sm">
                                                                    <div className="font-medium">{res.name}</div>
                                                                    <div className="text-xs text-muted-foreground">{res.sub}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Details */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground/70">Category</label>
                                        <select value={notificationType} onChange={e => setNotificationType(e.target.value as NotificationType)}
                                            className="w-full p-2.5 bg-background border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                                            <option value="system">System Alert</option>
                                            <option value="info">Information</option>
                                            <option value="warning">Warning</option>
                                            <option value="wallet">Wallet Update</option>
                                            <option value="feature">New Feature</option>
                                            <option value="maintenance">Maintenance</option>
                                            <option value="emergency">Emergency</option>
                                            <option value="promotion">Promotion</option>
                                            <option value="policy">Policy Update</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground/70">Priority</label>
                                        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                                            {(['low', 'medium', 'high'] as NotificationPriority[]).map(p => (
                                                <button key={p} type="button" onClick={() => setPriority(p)}
                                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${priority === p
                                                        ? (p === 'high' ? 'bg-white text-red-600 shadow-sm' : p === 'medium' ? 'bg-white text-orange-600 shadow-sm' : 'bg-white text-green-600 shadow-sm')
                                                        : 'text-muted-foreground hover:bg-white/50'}`}>
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/70">Content</label>
                                    <input
                                        value={title} onChange={e => setTitle(e.target.value)}
                                        className="w-full p-3 bg-background border rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/20"
                                        placeholder="Brief Title"
                                    />
                                    <textarea
                                        value={body} onChange={e => setBody(e.target.value)}
                                        className="w-full p-3 bg-background border rounded-lg text-sm min-h-[120px] focus:ring-2 focus:ring-primary/20 resize-none"
                                        placeholder="Detailed message..."
                                    />
                                </div>

                                {/* Tags */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/70">Tags</label>
                                    <div className="flex flex-wrap gap-2 min-h-[38px] p-2 bg-background border rounded-lg">
                                        {tags.map(tag => (
                                            <span key={tag} className="bg-primary/10 text-primary text-[10px] uppercase font-bold px-2 py-1 rounded-md flex items-center gap-1">
                                                #{tag} <button type="button" onClick={() => removeTag(tag)}><X size={10} /></button>
                                            </span>
                                        ))}
                                        <input
                                            value={currentTag} onChange={e => setCurrentTag(e.target.value)} onKeyDown={handleAddTag}
                                            className="flex-1 bg-transparent text-sm focus:outline-none min-w-[60px]"
                                            placeholder="Add tag..."
                                        />
                                    </div>
                                </div>

                                <button type="submit" disabled={sending}
                                    className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 ${priority === 'high' ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/25' :
                                        priority === 'medium' ? 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-500/25' :
                                            'bg-gradient-to-r from-primary to-primary/80 shadow-primary/25'
                                        }`}>
                                    {sending ? <span className="animate-spin mr-2">⟳</span> : <Send size={18} />}
                                    {sending ? 'Transmitting...' : 'Broadcast Notification'}
                                </button>
                            </form>
                        </GlassCard>
                    ) : (
                        <div className="p-6 border border-dashed border-border rounded-xl text-center text-muted-foreground flex flex-col items-center justify-center h-64 bg-muted/5">
                            <Shield size={48} className="mb-4 opacity-20" />
                            <p className="font-medium">Broadcast Permissions Restricted</p>
                            <p className="text-sm opacity-75 mt-1">Contact admin to enable broadcasting.</p>
                        </div>
                    )}
                </div>

                {/* History Section */}
                <div className="xl:col-span-7 h-full">
                    <GlassCard className="h-[820px] flex flex-col border-border/60 shadow-lg">
                        <div className="p-5 border-b border-border/50 bg-muted/5 space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <RefreshCcw size={18} className="text-muted-foreground" /> Recent Broadcasts
                                </h2>
                                <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{filteredNotifications.length} Records</span>
                            </div>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                    <input
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search history..."
                                        className="w-full pl-9 py-2 text-xs border rounded-lg bg-background shadow-sm focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                                    className="text-xs border rounded-lg bg-background px-3 shadow-sm focus:ring-1 focus:ring-primary">
                                    <option value="all">All Types</option>
                                    <option value="system">System</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <span className="text-xs">Loading history...</span>
                                </div>
                            ) : filteredNotifications.length === 0 ? (
                                <div className="text-center py-20 text-muted-foreground opacity-60">
                                    <Bell size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>No broadcast history found</p>
                                </div>
                            ) : (
                                filteredNotifications.map(note => (
                                    <div key={note.id} className="group p-4 rounded-xl border border-transparent hover:border-border hover:bg-accent/30 hover:shadow-md transition-all duration-200 relative bg-background/50">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`p-1.5 rounded-lg border ${getPriorityColor(note.priority)}`}>
                                                    {note.priority === 'high' ? <AlertCircle size={14} /> : <Bell size={14} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <h3 className="font-bold text-sm text-foreground/90">{note.title}</h3>
                                                    <span className="text-[10px] text-muted-foreground">From: {note.createdBy}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                    {format(new Date(note.createdAt), 'MMM dd, HH:mm')}
                                                </span>
                                                {currentUser?.permissions?.notifications?.delete !== false && (
                                                    <button onClick={() => handleDelete(note.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-xs text-muted-foreground leading-relaxed pl-10 mb-3">{note.body}</p>

                                        <div className="pl-10 flex flex-wrap items-center gap-2">
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${note.type === 'system' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                note.type === 'warning' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    'bg-slate-50 text-slate-600 border-slate-100'
                                                }`}>
                                                {note.type}
                                            </span>

                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                To: <span className="font-semibold text-foreground">
                                                    {note.targetRole === 'single_user' || note.targetRole === 'single_rider' ? (note.targetName || 'Specific User') : (note.targetRole === 'all' ? 'Everyone' : note.targetRole)}
                                                </span>
                                            </span>

                                            {note.tags?.length > 0 && (
                                                <div className="flex gap-1 ml-auto">
                                                    {note.tags.map(t => (
                                                        <span key={t} className="text-[10px] text-muted-foreground opacity-75">#{t}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* AI Modal */}
            {showAiModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5 border border-primary/20 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="text-indigo-500 fill-indigo-100" /> AI Assistant</h3>
                            <button onClick={() => setShowAiModal(false)} className="hover:bg-accent p-1 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Topic</label>
                                <textarea value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                                    className="w-full p-3 bg-muted/30 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="e.g. Server maintenance notice..." rows={3} autoFocus />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Tone</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['professional', 'urgent', 'friendly', 'authoritative'].map(t => (
                                        <button key={t} onClick={() => setAiTone(t)}
                                            className={`py-2 text-xs font-medium rounded-lg border capitalize transition-all ${aiTone === t ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'hover:bg-accent'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleAiGenerate} disabled={aiLoading || !aiTopic}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 transition-all text-sm flex items-center justify-center gap-2">
                                {aiLoading ? <span className="animate-spin">⟳</span> : <Sparkles size={16} />}
                                {aiLoading ? 'Generating Content...' : 'Generate Notification'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationManagement;
