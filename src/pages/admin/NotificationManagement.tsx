import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import {
    Bell, Send, Users, User, Shield, Sparkles, Search,
    AlertCircle, X, RefreshCcw, Radio, CheckCheck, Wallet, Flag,
    Zap, Calendar, Info, AlertTriangle, Wrench, Megaphone, Tag,
    Clock, RotateCcw, Eye, BarChart3, ChevronDown
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { NotificationType, NotificationPriority } from '@/types';
import { AIService } from '@/services/AIService';
import { NotificationService } from '@/services/NotificationService';
import GlassCard from '@/components/GlassCard';
import { toast } from 'sonner';
import { logActivity } from '@/utils/activityLog';

interface SystemNotification {
    id: string;
    title: string;
    body: string;
    targetRole: 'all' | 'teamLeader' | 'single_user' | 'single_rider';
    targetId?: string;
    targetName?: string;
    createdBy: string;
    createdAt: string;
    priority: NotificationPriority;
    tags: string[];
    type: NotificationType | string;
}

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
    { value: 'system', label: 'System Alert', icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { value: 'info', label: 'Information', icon: Info, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
    { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { value: 'wallet', label: 'Wallet Update', icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { value: 'feature', label: 'New Feature', icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    { value: 'reminder', label: 'Reminder', icon: Calendar, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    { value: 'issue', label: 'Issue Report', icon: Flag, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { value: 'allotment', label: 'Allotment', icon: CheckCheck, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
    { value: 'promotion', label: 'Promotion', icon: Megaphone, color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
    { value: 'policy', label: 'Policy Update', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { value: 'recharge', label: 'Recharge Alert', icon: Zap, color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
] as const;

const getCategoryConfig = (type: string) =>
    CATEGORIES.find(c => c.value === type) ?? CATEGORIES[0];

const NotificationManagement: React.FC = () => {
    const { userData: currentUser } = useSupabaseAuth();

    // ── Data ──────────────────────────────────────────────────────────────────
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [liveCount, setLiveCount] = useState(0); // real-time new count indicator

    // ── Filter ────────────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');

    // ── Form ──────────────────────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [targetRole, setTargetRole] = useState<SystemNotification['targetRole']>('all');
    const [priority, setPriority] = useState<NotificationPriority>('medium');
    const [notificationType, setNotificationType] = useState<string>('system');
    const [tags, setTags] = useState<string[]>([]);
    const [currentTag, setCurrentTag] = useState('');
    const [recipientPreview, setRecipientPreview] = useState<number | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // ── Target Search ─────────────────────────────────────────────────────────
    const [searchTarget, setSearchTarget] = useState('');
    const [targetResults, setTargetResults] = useState<{ id: string; name: string; sub?: string }[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<{ id: string; name: string } | null>(null);

    // ── AI Modal ──────────────────────────────────────────────────────────────
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState('professional');
    const [aiLoading, setAiLoading] = useState(false);

    // ── Category picker ───────────────────────────────────────────────────────
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const categoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setShowCategoryPicker(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchAnnouncements = useCallback(async (silent = false) => {
        if (!silent) setLoading(true); else setRefreshing(true);
        try {
            const { data } = await supabase
                .from('announcements')
                .select('id, title, body, targetRole:target_role, targetId:target_id, targetName:target_name, priority, tags, type, createdBy:created_by, createdAt:created_at')
                .order('created_at', { ascending: false });
            if (data) setNotifications(data as SystemNotification[]);
        } catch { toast.error('Failed to load history.'); }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => {
        fetchAnnouncements();
        const channel = supabase.channel('public:announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
                if (payload.eventType === 'INSERT') setLiveCount(c => c + 1);
                fetchAnnouncements(true);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchAnnouncements]);

    // ── Recipient Preview ─────────────────────────────────────────────────────
    useEffect(() => {
        const preview = async () => {
            if (targetRole === 'single_user' || targetRole === 'single_rider') {
                setRecipientPreview(selectedTarget ? 1 : 0);
                return;
            }
            setPreviewLoading(true);
            try {
                let count = 0;
                if (targetRole === 'all' || targetRole === 'teamLeader') {
                    const { count: c } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teamLeader');
                    count += c ?? 0;
                }
                if (targetRole === 'all') {
                    const { count: c } = await supabase.from('riders').select('*', { count: 'exact', head: true }).eq('status', 'active');
                    count += c ?? 0;
                }
                setRecipientPreview(count);
            } catch { setRecipientPreview(null); }
            finally { setPreviewLoading(false); }
        };
        preview();
    }, [targetRole, selectedTarget]);

    // ── Target search ─────────────────────────────────────────────────────────
    useEffect(() => {
        const search = async () => {
            if (searchTarget.length < 2) { setTargetResults([]); return; }
            const results: { id: string; name: string; sub?: string }[] = [];
            try {
                if (targetRole === 'single_rider') {
                    const { data } = await supabase.from('riders')
                        .select('id, riderName:rider_name, mobileNumber:mobile_number')
                        .or(`rider_name.ilike.%${searchTarget}%,mobile_number.ilike.%${searchTarget}%`).limit(10);
                    data?.forEach((r: any) => results.push({ id: r.id, name: r.riderName, sub: r.mobileNumber }));
                } else {
                    const { data } = await supabase.from('users')
                        .select('id, fullName:full_name, email')
                        .or(`full_name.ilike.%${searchTarget}%,email.ilike.%${searchTarget}%`).limit(10);
                    data?.forEach((u: any) => results.push({ id: u.id, name: u.fullName, sub: u.email }));
                }
                setTargetResults(results);
            } catch { }
        };
        const t = setTimeout(search, 300);
        return () => clearTimeout(t);
    }, [searchTarget, targetRole]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && currentTag.trim()) {
            e.preventDefault();
            if (!tags.includes(currentTag.trim())) setTags(prev => [...prev, currentTag.trim()]);
            setCurrentTag('');
        }
    };

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
                if (result.type) setNotificationType(result.type as string);
                setShowAiModal(false);
                toast.success('Content generated by AI');
            }
        } catch { toast.error('AI Generation failed'); }
        finally { setAiLoading(false); }
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (currentUser?.permissions?.notifications?.broadcast === false) {
            toast.error('Permission Denied: You cannot send broadcasts.'); return;
        }
        if (!currentUser || !title || !body) {
            toast.error('Title and message are required.'); return;
        }
        if ((targetRole === 'single_user' || targetRole === 'single_rider') && !selectedTarget) {
            toast.error('Please select a recipient.'); return;
        }

        setSending(true);
        const toastId = toast.loading('Transmitting notification...');
        try {
            const announcementData = {
                title, body,
                target_role: targetRole,
                target_id: selectedTarget?.id || null,
                target_name: selectedTarget?.name || null,
                priority, tags,
                type: notificationType,
                created_by: currentUser.fullName || currentUser.email || 'Admin',
                created_at: new Date().toISOString()
            };

            const { data: inserted, error: annError } = await supabase.from('announcements').insert(announcementData).select().single();
            if (annError) throw annError;

            const targets: string[] = [];
            if (targetRole === 'single_user' || targetRole === 'single_rider') {
                if (selectedTarget) targets.push(selectedTarget.id);
            } else {
                if (targetRole === 'all' || targetRole === 'teamLeader') {
                    const { data } = await supabase.from('users').select('id').eq('role', 'teamLeader');
                    data?.forEach((d: any) => targets.push(d.id));
                }
                if (targetRole === 'all') {
                    const { data } = await supabase.from('riders').select('id').eq('status', 'active');
                    data?.forEach((d: any) => targets.push(d.id));
                }
                if (currentUser.id && !targets.includes(currentUser.id)) targets.push(currentUser.id);
            }

            await NotificationService.broadcast(targets, title, body, notificationType as NotificationType, priority, tags, inserted.id);
            toast.success(`Broadcast sent to ${targets.length} recipient${targets.length !== 1 ? 's' : ''}!`, { id: toastId, duration: 5000 });

            setTitle(''); setBody(''); setTags([]); setPriority('medium');
            setSelectedTarget(null); setSearchTarget(''); setNotificationType('system');
            setLiveCount(0);

            await logActivity({
                actionType: 'Broadcast Sent', targetType: 'notification', targetId: inserted.id,
                details: `Broadcast "${title}" → ${targetRole} (${targets.length} recipients)`,
                performedBy: currentUser.fullName || currentUser.email
            }).catch(console.error);

        } catch (error: any) {
            toast.error(error.message || 'Failed to send.', { id: toastId });
        } finally { setSending(false); }
    };

    const handleDelete = async (id: string) => {
        if (currentUser?.permissions?.notifications?.delete === false) {
            toast.error('Permission Denied'); return;
        }
        const toastId = toast.loading('Recalling broadcast...');
        try {
            await supabase.from('notifications').delete().contains('related_entity', { announcementId: id });
            await supabase.from('announcements').delete().eq('id', id);
            toast.success('Broadcast recalled and deleted.', { id: toastId });
            await logActivity({ actionType: 'Broadcast Recalled', targetType: 'notification', targetId: id, details: 'Recalled broadcast.', performedBy: currentUser?.fullName || currentUser?.email }).catch(console.error);
        } catch { toast.error('Failed to recall.', { id: toastId }); }
    };

    const filteredNotifications = useMemo(() => notifications.filter(n => {
        const q = searchTerm.toLowerCase();
        const matchSearch = n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
        const matchType = filterType === 'all' || n.type === filterType;
        const matchPriority = filterPriority === 'all' || n.priority === filterPriority;
        return matchSearch && matchType && matchPriority;
    }), [notifications, searchTerm, filterType, filterPriority]);

    // ── Stats ─────────────────────────────────────────────────────────────────
    const stats = useMemo(() => ({
        total: notifications.length,
        high: notifications.filter(n => n.priority === 'high').length,
        today: notifications.filter(n => new Date(n.createdAt).toDateString() === new Date().toDateString()).length,
        types: new Set(notifications.map(n => n.type)).size,
    }), [notifications]);

    const selectedCategory = getCategoryConfig(notificationType);
    const CategoryIcon = selectedCategory.icon;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="p-3.5 bg-gradient-to-br from-primary to-primary/70 rounded-2xl shadow-xl shadow-primary/30 text-white">
                            <Radio size={26} />
                        </div>
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-background animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Broadcast Center</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Real-time notification management for all users</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {liveCount > 0 && (
                        <button onClick={() => { fetchAnnouncements(true); setLiveCount(0); }}
                            className="flex items-center gap-2 px-3 py-2 bg-green-500/15 text-green-600 border border-green-500/30 rounded-xl text-xs font-bold animate-in fade-in">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            {liveCount} new broadcast{liveCount > 1 ? 's' : ''}
                        </button>
                    )}
                    <button onClick={() => fetchAnnouncements(true)} disabled={refreshing}
                        className="p-2.5 border border-border/60 rounded-xl hover:bg-accent transition-all disabled:opacity-50">
                        <RefreshCcw size={16} className={refreshing ? 'animate-spin text-primary' : 'text-muted-foreground'} />
                    </button>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Sent', value: stats.total, icon: Send, color: 'text-primary', bg: 'from-primary/10 to-transparent' },
                    { label: 'Today', value: stats.today, icon: Clock, color: 'text-blue-500', bg: 'from-blue-500/10 to-transparent' },
                    { label: 'High Priority', value: stats.high, icon: AlertCircle, color: 'text-red-500', bg: 'from-red-500/10 to-transparent' },
                    { label: 'Categories Used', value: stats.types, icon: Tag, color: 'text-violet-500', bg: 'from-violet-500/10 to-transparent' },
                ].map(s => {
                    const SIcon = s.icon;
                    return (
                        <GlassCard key={s.label} className={`p-4 bg-gradient-to-br ${s.bg} border-border/40`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{s.label}</span>
                                <SIcon size={14} className={s.color} />
                            </div>
                            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                        </GlassCard>
                    );
                })}
            </div>

            {/* ── Main 2-Col Layout ── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* ── Compose Panel ── */}
                <div className="xl:col-span-5">
                    {currentUser?.permissions?.notifications?.broadcast !== false ? (
                        <GlassCard className="p-6 border-primary/10 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-72 h-72 bg-primary/4 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                            {/* Compose Header */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold flex items-center gap-2.5">
                                    <div className="p-1.5 bg-primary/10 rounded-lg"><Send size={16} className="text-primary" /></div>
                                    Compose Broadcast
                                </h2>
                                <button type="button" onClick={() => setShowAiModal(true)}
                                    className="text-xs font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 px-3.5 py-2 rounded-xl flex items-center gap-1.5 hover:bg-indigo-500/20 transition-all">
                                    <Sparkles size={13} className="animate-pulse" /> AI Write
                                </button>
                            </div>

                            <form onSubmit={handleSendNotification} className="space-y-5 relative">

                                {/* ── Recipients ── */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recipients</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'all', icon: Users, label: 'Everyone' },
                                            { id: 'teamLeader', icon: Shield, label: 'Leaders' },
                                        ].map(opt => (
                                            <button key={opt.id} type="button"
                                                onClick={() => { setTargetRole(opt.id as any); setSelectedTarget(null); }}
                                                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all duration-200
                                                    ${targetRole === opt.id ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25' : 'hover:bg-accent border-border hover:border-primary/30'}`}>
                                                <opt.icon size={17} /> {opt.label}
                                            </button>
                                        ))}
                                        <button type="button"
                                            onClick={() => { setTargetRole('single_user'); setSelectedTarget(null); setSearchTarget(''); }}
                                            className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all
                                                ${targetRole === 'single_user' ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25' : 'hover:bg-accent border-border hover:border-primary/30'}`}>
                                            <User size={17} /> Specific User
                                        </button>
                                    </div>
                                    <button type="button"
                                        onClick={() => { setTargetRole('single_rider'); setSelectedTarget(null); setSearchTarget(''); }}
                                        className={`w-full p-2.5 rounded-xl border text-xs font-bold transition-all text-center
                                            ${targetRole === 'single_rider' ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-accent border-border'}`}>
                                        Specific Rider
                                    </button>

                                    {/* Recipient Preview Badge */}
                                    {recipientPreview !== null && (
                                        <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-lg border border-border/50 text-xs">
                                            <Eye size={13} className="text-muted-foreground" />
                                            <span className="text-muted-foreground">Will reach</span>
                                            <span className="font-black text-primary">
                                                {previewLoading ? '...' : recipientPreview}
                                            </span>
                                            <span className="text-muted-foreground">recipient{recipientPreview !== 1 ? 's' : ''}</span>
                                        </div>
                                    )}

                                    {/* Single target search */}
                                    {(targetRole === 'single_user' || targetRole === 'single_rider') && (
                                        <div className="relative animate-in fade-in slide-in-from-top-1">
                                            {selectedTarget ? (
                                                <div className="flex items-center justify-between p-3 border border-primary/30 bg-primary/5 rounded-xl">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                                                            <User size={14} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold">{selectedTarget.name}</div>
                                                            <div className="text-[10px] text-muted-foreground capitalize">{targetRole.replace('single_', '')}</div>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => setSelectedTarget(null)} className="p-1.5 hover:bg-background rounded-lg text-muted-foreground hover:text-foreground"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                                    <input className="w-full pl-9 pr-3 py-2.5 bg-background border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                                                        placeholder={`Search ${targetRole === 'single_user' ? 'user' : 'rider'}...`}
                                                        value={searchTarget} onChange={e => setSearchTarget(e.target.value)} />
                                                    {targetResults.length > 0 && (
                                                        <div className="absolute w-full mt-1 bg-card border rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto">
                                                            {targetResults.map(r => (
                                                                <div key={r.id} onClick={() => { setSelectedTarget({ id: r.id, name: r.name }); setSearchTarget(''); setTargetResults([]); }}
                                                                    className="p-3 hover:bg-accent cursor-pointer border-b last:border-0 text-sm flex items-center gap-2">
                                                                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><User size={12} /></div>
                                                                    <div>
                                                                        <div className="font-semibold">{r.name}</div>
                                                                        <div className="text-xs text-muted-foreground">{r.sub}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ── Category + Priority ── */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Category Picker */}
                                    <div className="space-y-1.5" ref={categoryRef}>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category</label>
                                        <button type="button" onClick={() => setShowCategoryPicker(v => !v)}
                                            className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-sm font-semibold transition-all hover:border-primary/30 bg-background ${selectedCategory.border}`}>
                                            <span className={`p-1 rounded-lg ${selectedCategory.bg} ${selectedCategory.color}`}>
                                                <CategoryIcon size={13} />
                                            </span>
                                            <span className="flex-1 text-left text-xs truncate">{selectedCategory.label}</span>
                                            <ChevronDown size={13} className={`text-muted-foreground transition-transform ${showCategoryPicker ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showCategoryPicker && (
                                            <div className="absolute z-30 mt-1 w-64 bg-card border border-border rounded-xl shadow-2xl p-2 grid grid-cols-2 gap-1 animate-in fade-in slide-in-from-top-1">
                                                {CATEGORIES.map(cat => {
                                                    const CIcon = cat.icon;
                                                    return (
                                                        <button key={cat.value} type="button"
                                                            onClick={() => { setNotificationType(cat.value); setShowCategoryPicker(false); }}
                                                            className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold text-left transition-all hover:bg-accent
                                                                ${notificationType === cat.value ? `${cat.bg} ${cat.color} ${cat.border} border` : ''}`}>
                                                            <CIcon size={13} className={notificationType === cat.value ? cat.color : 'text-muted-foreground'} />
                                                            {cat.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Priority */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                                        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl h-[42px]">
                                            {(['low', 'medium', 'high'] as NotificationPriority[]).map(p => (
                                                <button key={p} type="button" onClick={() => setPriority(p)}
                                                    className={`flex-1 text-[9px] font-black uppercase rounded-lg transition-all ${priority === p
                                                        ? p === 'high' ? 'bg-red-500 text-white shadow-sm' : p === 'medium' ? 'bg-amber-500 text-white shadow-sm' : 'bg-blue-500 text-white shadow-sm'
                                                        : 'text-muted-foreground hover:bg-white/50'}`}>
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Content ── */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message Content</label>
                                    <input value={title} onChange={e => setTitle(e.target.value)}
                                        className="w-full p-3 bg-background border border-border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                                        placeholder="Notification title..." maxLength={120} />
                                    <div className="relative">
                                        <textarea value={body} onChange={e => setBody(e.target.value)}
                                            className="w-full p-3 bg-background border border-border rounded-xl text-sm min-h-[110px] focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-all"
                                            placeholder="Detailed notification message..." maxLength={1000} />
                                        <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/50">{body.length}/1000</span>
                                    </div>
                                </div>

                                {/* ── Tags ── */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Tag size={11} /> Tags <span className="font-normal text-muted-foreground/60">(Enter to add)</span>
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2.5 bg-background border rounded-xl">
                                        {tags.map(tag => (
                                            <span key={tag} className="bg-primary/10 text-primary text-[10px] uppercase font-bold px-2 py-1 rounded-lg flex items-center gap-1 border border-primary/20">
                                                #{tag} <button type="button" onClick={() => setTags(t => t.filter(x => x !== tag))}><X size={9} /></button>
                                            </span>
                                        ))}
                                        <input value={currentTag} onChange={e => setCurrentTag(e.target.value)} onKeyDown={handleAddTag}
                                            className="flex-1 bg-transparent text-sm focus:outline-none min-w-[80px] placeholder:text-muted-foreground/40"
                                            placeholder="urgent, update..." />
                                    </div>
                                </div>

                                {/* ── Send Button ── */}
                                <button type="submit" disabled={sending || !title || !body}
                                    className={`w-full py-3.5 rounded-xl font-black text-white shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 text-sm
                                        ${priority === 'high' ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/30'
                                            : priority === 'medium' ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/25'
                                                : 'bg-gradient-to-r from-primary to-primary/80 shadow-primary/25'}`}>
                                    {sending
                                        ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Transmitting...</>
                                        : <><Send size={16} /> Broadcast Now</>
                                    }
                                </button>
                            </form>
                        </GlassCard>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-2xl text-muted-foreground gap-3">
                            <Shield size={40} className="opacity-20" />
                            <p className="font-semibold">Broadcast permissions restricted</p>
                            <p className="text-sm opacity-60">Contact admin to enable broadcasting</p>
                        </div>
                    )}
                </div>

                {/* ── History Panel ── */}
                <div className="xl:col-span-7">
                    <GlassCard className="flex flex-col border-border/50 shadow-lg overflow-hidden" style={{ minHeight: '680px', maxHeight: '820px' }}>

                        {/* History Header */}
                        <div className="p-5 border-b border-border/40 bg-muted/10 space-y-3 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold flex items-center gap-2">
                                    <BarChart3 size={16} className="text-muted-foreground" />
                                    Broadcast History
                                    <span className="bg-muted text-muted-foreground text-[10px] font-black px-2 py-0.5 rounded-full">{filteredNotifications.length}</span>
                                </h2>
                                {refreshing && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
                            </div>

                            {/* Search */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search broadcasts..." className="w-full pl-9 py-2 text-xs border rounded-xl bg-background focus:ring-1 focus:ring-primary/30" />
                                    {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12} /></button>}
                                </div>
                                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                                    className="text-xs border rounded-xl bg-background px-2.5 focus:ring-1 focus:ring-primary/30">
                                    <option value="all">All Types</option>
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                                    className="text-xs border rounded-xl bg-background px-2.5 focus:ring-1 focus:ring-primary/30">
                                    <option value="all">All Priority</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                        </div>

                        {/* History List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs">Loading history...</span>
                                </div>
                            ) : filteredNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                                    <div className="p-5 bg-muted/30 rounded-2xl"><Bell size={32} className="opacity-25" /></div>
                                    <p className="text-sm font-semibold">No broadcasts found</p>
                                    <p className="text-xs opacity-60">{searchTerm ? 'Try a different search term' : 'Send your first broadcast above'}</p>
                                </div>
                            ) : (
                                filteredNotifications.map(note => {
                                    const cat = getCategoryConfig(note.type);
                                    const CatIcon = cat.icon;
                                    return (
                                        <div key={note.id}
                                            className={`group relative p-4 rounded-xl border transition-all duration-200 bg-background/60 hover:shadow-md
                                                ${note.priority === 'high' ? 'border-l-4 border-l-red-500 border-border/40' : note.priority === 'medium' ? 'border-l-4 border-l-amber-400 border-border/40' : 'border-border/40 hover:border-border'}`}>

                                            <div className="flex items-start gap-3">
                                                {/* Cat Icon */}
                                                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${cat.bg} ${cat.color} border ${cat.border}`}>
                                                    <CatIcon size={16} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <h3 className="font-bold text-sm text-foreground/90 leading-tight">{note.title}</h3>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            {/* Priority badge */}
                                                            <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border ${note.priority === 'high' ? 'bg-red-500/10 text-red-600 border-red-300' : note.priority === 'medium' ? 'bg-amber-500/10 text-amber-600 border-amber-300' : 'bg-blue-500/10 text-blue-600 border-blue-300'}`}>
                                                                {note.priority}
                                                            </span>
                                                            {/* Delete */}
                                                            {currentUser?.permissions?.notifications?.delete !== false && (
                                                                <button onClick={() => handleDelete(note.id)} title="Recall & Delete"
                                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                                                                    <RotateCcw size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">{note.body}</p>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {/* Category label */}
                                                        <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-lg border ${cat.bg} ${cat.color} ${cat.border}`}>
                                                            {cat.label}
                                                        </span>

                                                        {/* Target */}
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Users size={9} />
                                                            {note.targetRole === 'single_user' || note.targetRole === 'single_rider'
                                                                ? note.targetName || 'Individual'
                                                                : note.targetRole === 'all' ? 'Everyone' : 'Team Leaders'}
                                                        </span>

                                                        {/* Sent by */}
                                                        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                                                            <Clock size={9} />
                                                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                                        </span>
                                                    </div>

                                                    {/* Tags */}
                                                    {note.tags?.length > 0 && (
                                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                                            {note.tags.map(t => (
                                                                <span key={t} className="text-[9px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-full">#{t}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sender footer */}
                                            <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
                                                <span>By <span className="font-semibold text-foreground/70">{note.createdBy}</span></span>
                                                <span className="font-mono">{format(new Date(note.createdAt), 'dd MMM yyyy, hh:mm a')}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* ── AI Modal ── */}
            {showAiModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-indigo-500/20 overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                        <div className="p-6 space-y-5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl"><Sparkles size={18} className="text-indigo-500" /></div>
                                    <div>
                                        <h3 className="font-bold">AI Assistant</h3>
                                        <p className="text-xs text-muted-foreground">Generate notification content</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowAiModal(false)} className="p-2 hover:bg-accent rounded-xl text-muted-foreground"><X size={18} /></button>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Topic / Context</label>
                                <textarea value={aiTopic} onChange={e => setAiTopic(e.target.value)} rows={3} autoFocus
                                    className="w-full p-3 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                    placeholder="e.g. System maintenance tonight at 11 PM, all riders should be notified..." />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Tone</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'professional', label: '💼 Professional' },
                                        { value: 'urgent', label: '🚨 Urgent' },
                                        { value: 'friendly', label: '😊 Friendly' },
                                        { value: 'authoritative', label: '⚡ Authoritative' },
                                    ].map(t => (
                                        <button key={t.value} type="button" onClick={() => setAiTone(t.value)}
                                            className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${aiTone === t.value ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-700 font-bold' : 'hover:bg-accent border-border'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleAiGenerate} disabled={aiLoading || !aiTopic}
                                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                {aiLoading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating...</> : <><Sparkles size={15} /> Generate Content</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationManagement;
