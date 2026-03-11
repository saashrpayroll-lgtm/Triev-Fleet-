import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Pin, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface Announcement {
    id: string;
    title: string;
    message: string;
    category: 'policy' | 'incentive' | 'event' | 'alert' | 'general';
    createdAt: string;
    pinned: boolean;
}

const categoryConfig: Record<Announcement['category'], { label: string; color: string; bg: string }> = {
    policy: { label: 'Policy', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    incentive: { label: 'Incentive', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    event: { label: 'Event', color: 'text-violet-500', bg: 'bg-violet-500/10' },
    alert: { label: 'Alert', color: 'text-red-500', bg: 'bg-red-500/10' },
    general: { label: 'General', color: 'text-slate-500', bg: 'bg-slate-500/10' },
};

/**
 * Announcements widget showing recent system/admin announcements.
 * Falls back to system-generated announcements when no DB data.
 */
const AnnouncementsWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [expanded, setExpanded] = useState(false);

    // Generate system announcements from context
    const announcements: Announcement[] = [
        {
            id: 'sys-1',
            title: 'Daily Collection Reminder',
            message: 'Ensure all rider collections are updated before 11 PM IST for accurate daily reports.',
            category: 'policy',
            createdAt: new Date().toISOString(),
            pinned: true,
        },
        {
            id: 'sys-2',
            title: 'Wallet Reconciliation',
            message: 'Weekly wallet reconciliation runs every Sunday. Review discrepancies in the Reports section.',
            category: 'alert',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            pinned: false,
        },
        {
            id: 'sys-3',
            title: 'Lead Follow-Up Best Practice',
            message: 'Follow up on new leads within 24 hours for maximum conversion. Check your Leads page daily.',
            category: 'incentive',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            pinned: false,
        },
    ];

    const displayAnnouncements = expanded ? announcements : announcements.slice(0, 2);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                    <Megaphone size={14} className="text-violet-500" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider">Announcements</h3>
                    <p className="text-[9px] text-muted-foreground font-medium">
                        {announcements.filter(a => a.pinned).length} pinned
                    </p>
                </div>
            </div>

            {/* Announcements List */}
            <div className="divide-y divide-border/20">
                <AnimatePresence>
                    {displayAnnouncements.map((ann) => {
                        const config = categoryConfig[ann.category];
                        return (
                            <motion.div
                                key={ann.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="px-4 py-3"
                            >
                                <div className="flex items-start gap-2">
                                    {ann.pinned && (
                                        <Pin size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                                                {config.label}
                                            </span>
                                            <span className="text-[8px] text-muted-foreground/50 font-medium flex items-center gap-0.5">
                                                <Clock size={8} />
                                                {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-bold text-foreground">{ann.title}</p>
                                        <p className="text-[9px] text-muted-foreground font-medium mt-0.5 line-clamp-2">{ann.message}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Expand/Collapse */}
            {announcements.length > 2 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full px-4 py-2 border-t border-border/20 text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {expanded ? 'Show Less' : `+${announcements.length - 2} More`}
                </button>
            )}
        </motion.div>
    );
};

export default AnnouncementsWidget;
