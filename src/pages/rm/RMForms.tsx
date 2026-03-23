import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/config/supabase';
import { ExternalLink, FileText, Link2Off, TableProperties, ArrowUpRight } from 'lucide-react';

interface ExternalForm {
    id: string;
    title: string;
    url: string;
    category: 'form' | 'sheet';
    is_active: boolean;
    display_order: number;
    created_at: string;
}

// Color palettes for form cards - cycles through these
const formPalettes = [
    { from: 'from-violet-500/15', to: 'to-violet-500/5', border: 'border-violet-500/25', text: 'text-violet-400', icon: 'bg-violet-500/15 text-violet-400', hover: 'hover:border-violet-400/60 hover:from-violet-500/25', glow: 'hover:shadow-violet-500/20' },
    { from: 'from-emerald-500/15', to: 'to-emerald-500/5', border: 'border-emerald-500/25', text: 'text-emerald-400', icon: 'bg-emerald-500/15 text-emerald-400', hover: 'hover:border-emerald-400/60 hover:from-emerald-500/25', glow: 'hover:shadow-emerald-500/20' },
    { from: 'from-sky-500/15', to: 'to-sky-500/5', border: 'border-sky-500/25', text: 'text-sky-400', icon: 'bg-sky-500/15 text-sky-400', hover: 'hover:border-sky-400/60 hover:from-sky-500/25', glow: 'hover:shadow-sky-500/20' },
    { from: 'from-orange-500/15', to: 'to-orange-500/5', border: 'border-orange-500/25', text: 'text-orange-400', icon: 'bg-orange-500/15 text-orange-400', hover: 'hover:border-orange-400/60 hover:from-orange-500/25', glow: 'hover:shadow-orange-500/20' },
    { from: 'from-rose-500/15', to: 'to-rose-500/5', border: 'border-rose-500/25', text: 'text-rose-400', icon: 'bg-rose-500/15 text-rose-400', hover: 'hover:border-rose-400/60 hover:from-rose-500/25', glow: 'hover:shadow-rose-500/20' },
    { from: 'from-amber-500/15', to: 'to-amber-500/5', border: 'border-amber-500/25', text: 'text-amber-400', icon: 'bg-amber-500/15 text-amber-400', hover: 'hover:border-amber-400/60 hover:from-amber-500/25', glow: 'hover:shadow-amber-500/20' },
];

const sheetPalettes = [
    { from: 'from-indigo-500/15', to: 'to-indigo-500/5', border: 'border-indigo-500/25', text: 'text-indigo-400', icon: 'bg-indigo-500/15 text-indigo-400', hover: 'hover:border-indigo-400/60 hover:from-indigo-500/25', glow: 'hover:shadow-indigo-500/20' },
    { from: 'from-teal-500/15', to: 'to-teal-500/5', border: 'border-teal-500/25', text: 'text-teal-400', icon: 'bg-teal-500/15 text-teal-400', hover: 'hover:border-teal-400/60 hover:from-teal-500/25', glow: 'hover:shadow-teal-500/20' },
    { from: 'from-lime-500/15', to: 'to-lime-500/5', border: 'border-lime-500/25', text: 'text-lime-400', icon: 'bg-lime-500/15 text-lime-400', hover: 'hover:border-lime-400/60 hover:from-lime-500/25', glow: 'hover:shadow-lime-500/20' },
    { from: 'from-cyan-500/15', to: 'to-cyan-500/5', border: 'border-cyan-500/25', text: 'text-cyan-400', icon: 'bg-cyan-500/15 text-cyan-400', hover: 'hover:border-cyan-400/60 hover:from-cyan-500/25', glow: 'hover:shadow-cyan-500/20' },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const RMForms: React.FC = () => {
    const [forms, setForms] = useState<ExternalForm[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchForms();

        const channel = supabase.channel('external-forms-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'external_forms' }, () => {
                fetchForms();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchForms = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('external_forms')
                .select('*')
                .eq('is_active', true)
                .eq('is_visible_to_rm', true)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });
            if (error) throw error;
            setForms(data || []);
        } catch (error: any) {
            console.error('Error fetching forms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFormClick = (url: string) => {
        window.open(url, '_blank');
    };

    const formsList = forms.filter(f => f.category === 'form' || !f.category);
    const sheetsList = forms.filter(f => f.category === 'sheet');

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative rounded-2xl overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-violet-500/5 to-indigo-500/10" />
                <div className="absolute inset-0 bg-card/80 backdrop-blur-sm" />
                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border border-border/60 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <FileText size={22} className="text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Company Forms</h1>
                            <p className="text-muted-foreground text-xs sm:text-sm font-medium">Access company Google Forms and Sheets.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full bg-green-500"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        Live Sync
                    </div>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-28 bg-card/50 border border-border rounded-2xl"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full mb-4"
                        />
                        <p className="text-muted-foreground font-semibold">Loading forms...</p>
                    </motion.div>
                ) : forms.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-24 bg-card/50 border border-dashed border-border rounded-2xl text-center"
                    >
                        <div className="w-16 h-16 bg-muted/40 rounded-2xl flex items-center justify-center mb-5">
                            <Link2Off size={32} className="text-muted-foreground/40" />
                        </div>
                        <h3 className="text-xl font-black mb-2 tracking-tight">No Active Forms</h3>
                        <p className="text-muted-foreground text-sm max-w-sm">No active forms or sheets have been assigned yet. Check back later.</p>
                    </motion.div>
                ) : (
                    <motion.div
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-8"
                    >
                        {/* Google Forms Section */}
                        {formsList.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <FileText size={15} className="text-primary" />
                                    </div>
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Google Forms</h2>
                                    <div className="flex-1 h-px bg-border/50" />
                                    <span className="text-[10px] font-bold text-muted-foreground/50">{formsList.length} available</span>
                                </div>

                                <motion.div
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {formsList.map((form, i) => {
                                        const palette = formPalettes[i % formPalettes.length];
                                        return (
                                            <motion.button
                                                key={form.id}
                                                variants={cardVariants}
                                                onClick={() => handleFormClick(form.url)}
                                                whileHover={{ y: -4, scale: 1.02 }}
                                                whileTap={{ scale: 0.97 }}
                                                className={`group relative flex flex-col text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${palette.from} ${palette.to} border ${palette.border} ${palette.hover} shadow-md ${palette.glow} hover:shadow-lg transition-all duration-300 overflow-hidden w-full`}
                                            >
                                                {/* Card shimmer on hover */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                                                {/* Top highlight */}
                                                <div className="absolute top-0 left-4 right-4 h-px bg-white/10" />

                                                <div className="flex items-start justify-between gap-2 mb-3">
                                                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${palette.icon} ring-1 ring-white/10`}>
                                                        <FileText size={18} />
                                                    </div>
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 group-hover:scale-110 transition-transform ${palette.text}`}>
                                                        <ArrowUpRight size={14} />
                                                    </div>
                                                </div>

                                                <span className="font-bold text-sm sm:text-base text-foreground leading-snug line-clamp-2">{form.title}</span>
                                                <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2 ${palette.text}`}>Open Form →</span>
                                            </motion.button>
                                        );
                                    })}
                                </motion.div>
                            </div>
                        )}

                        {/* Google Sheets Section */}
                        {sheetsList.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                        <TableProperties size={15} className="text-indigo-400" />
                                    </div>
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Google Sheets</h2>
                                    <div className="flex-1 h-px bg-border/50" />
                                    <span className="text-[10px] font-bold text-muted-foreground/50">{sheetsList.length} available</span>
                                </div>

                                <motion.div
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {sheetsList.map((sheet, i) => {
                                        const palette = sheetPalettes[i % sheetPalettes.length];
                                        return (
                                            <motion.button
                                                key={sheet.id}
                                                variants={cardVariants}
                                                onClick={() => handleFormClick(sheet.url)}
                                                whileHover={{ y: -4, scale: 1.02 }}
                                                whileTap={{ scale: 0.97 }}
                                                className={`group relative flex flex-col text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${palette.from} ${palette.to} border ${palette.border} ${palette.hover} shadow-md ${palette.glow} hover:shadow-lg transition-all duration-300 overflow-hidden w-full`}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                                                <div className="absolute top-0 left-4 right-4 h-px bg-white/10" />

                                                <div className="flex items-start justify-between gap-2 mb-3">
                                                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${palette.icon} ring-1 ring-white/10`}>
                                                        <TableProperties size={18} />
                                                    </div>
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 group-hover:scale-110 transition-transform ${palette.text}`}>
                                                        <ExternalLink size={14} />
                                                    </div>
                                                </div>

                                                <span className="font-bold text-sm sm:text-base text-foreground leading-snug line-clamp-2">{sheet.title}</span>
                                                <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2 ${palette.text}`}>Open Sheet →</span>
                                            </motion.button>
                                        );
                                    })}
                                </motion.div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RMForms;
