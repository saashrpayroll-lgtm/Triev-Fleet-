import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, LayoutDashboard, Target, Wallet, Activity, FileText, Bot, X, ArrowRight, Hash } from 'lucide-react';
import { supabase } from '@/config/supabase';

interface SearchResult {
    type: 'rider' | 'page';
    id: string;
    label: string;
    sub?: string;
    path?: string;
    icon?: React.ReactNode;
}

const PAGE_SHORTCUTS: SearchResult[] = [
    { type: 'page', id: 'dashboard', label: 'Dashboard', sub: 'Overview & Stats', path: '/portal', icon: <LayoutDashboard size={14} /> },
    { type: 'page', id: 'riders', label: 'Rider Management', sub: 'Manage fleet riders', path: '/portal/riders', icon: <Users size={14} /> },
    { type: 'page', id: 'leads', label: 'Leads', sub: 'Sales pipeline', path: '/portal/leads', icon: <Target size={14} /> },
    { type: 'page', id: 'wallet', label: 'Wallet Logs', sub: 'Transaction history', path: '/portal/wallet-history', icon: <Wallet size={14} /> },
    { type: 'page', id: 'activity', label: 'Activity Logs', sub: 'Audit trail', path: '/portal/activity-log', icon: <Activity size={14} /> },
    { type: 'page', id: 'reports', label: 'Reports', sub: 'Analytics & exports', path: '/portal/reports', icon: <FileText size={14} /> },
    { type: 'page', id: 'ai-calling', label: 'AI Call Center', sub: 'Outbound calling', path: '/portal/ai-calling', icon: <Bot size={14} /> },
];

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    portalBase?: string; // '/portal' for Admin, '/team-leader' for TL
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, portalBase = '/portal' }) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIdx(0);
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [isOpen]);

    const searchRiders = useCallback(async (q: string) => {
        if (q.length < 2) {
            setResults(PAGE_SHORTCUTS.filter(p => p.label.toLowerCase().includes(q.toLowerCase())));
            return;
        }
        setLoading(true);
        try {
            const { data } = await supabase
                .from('riders')
                .select('id, triev_id, rider_name, mobile_number, wallet_amount, status')
                .or(`rider_name.ilike.%${q}%,triev_id.ilike.%${q}%,mobile_number.ilike.%${q}%`)
                .neq('status', 'deleted')
                .limit(6);

            const riderResults: SearchResult[] = (data || []).map(r => ({
                type: 'rider',
                id: r.id,
                label: r.rider_name || r.triev_id,
                sub: `${r.mobile_number} • ₹${r.wallet_amount?.toLocaleString('en-IN') ?? 0} • ${r.status}`,
                path: `${portalBase}/riders?highlight=${r.id}`,
                icon: <Users size={14} />,
            }));

            const pageResults = PAGE_SHORTCUTS.filter(p => p.label.toLowerCase().includes(q.toLowerCase()));
            setResults([...riderResults, ...pageResults]);
        } finally {
            setLoading(false);
        }
    }, [portalBase]);

    useEffect(() => {
        if (debounceRef.current !== null) clearTimeout(debounceRef.current);
        if (!query) {
            setResults(PAGE_SHORTCUTS);
            return;
        }
        debounceRef.current = setTimeout(() => searchRiders(query), 250);
        return () => { if (debounceRef.current !== null) clearTimeout(debounceRef.current); };
    }, [query, searchRiders]);

    const handleSelect = (result: SearchResult) => {
        if (result.path) {
            navigate(result.path);
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
        if (e.key === 'Enter' && results[selectedIdx]) { handleSelect(results[selectedIdx]); }
        if (e.key === 'Escape') { onClose(); }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[99999] flex items-start justify-center pt-[15vh] px-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Search Card */}
                    <motion.div
                        className="relative w-full max-w-xl"
                        initial={{ opacity: 0, y: -20, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {/* Glow border */}
                        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-primary/40 via-violet-500/20 to-transparent" />

                        <div className="relative bg-card rounded-[14px] shadow-2xl border border-border/50 overflow-hidden">
                            {/* Input row */}
                            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50">
                                <Search size={18} className="text-muted-foreground shrink-0" />
                                <input
                                    ref={inputRef}
                                    value={query}
                                    onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Search riders, pages, IDs..."
                                    className="flex-1 bg-transparent text-foreground placeholder-muted-foreground/50 text-sm font-medium focus:outline-none"
                                />
                                {query && (
                                    <button onClick={() => setQuery('')} className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground">
                                        <X size={14} />
                                    </button>
                                )}
                                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-border text-[10px] font-mono text-muted-foreground bg-muted">
                                    ESC
                                </kbd>
                            </div>

                            {/* Results */}
                            <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                {loading && (
                                    <div className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
                                        <motion.div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
                                        Searching...
                                    </div>
                                )}
                                {!loading && results.length === 0 && (
                                    <div className="p-6 text-center text-muted-foreground text-sm">No results found for <span className="text-foreground font-bold">"{query}"</span></div>
                                )}
                                {!loading && results.map((result, idx) => (
                                    <motion.button
                                        key={result.id + result.type}
                                        onClick={() => handleSelect(result)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 group ${idx === selectedIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'}`}
                                        onMouseEnter={() => setSelectedIdx(idx)}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${result.type === 'rider' ? 'bg-indigo-500/15 text-indigo-500' : 'bg-primary/10 text-primary'}`}>
                                            {result.type === 'page' ? result.icon : <Hash size={13} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{result.label}</p>
                                            {result.sub && <p className="text-[11px] text-muted-foreground truncate">{result.sub}</p>}
                                        </div>
                                        <ArrowRight size={14} className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </motion.button>
                                ))}
                            </div>

                            {/* Footer hint */}
                            <div className="px-4 py-2 border-t border-border/50 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                                <span><kbd className="font-mono">↵</kbd> open</span>
                                <span><kbd className="font-mono">ESC</kbd> close</span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default GlobalSearch;
