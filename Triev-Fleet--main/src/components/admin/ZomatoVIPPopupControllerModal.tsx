import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ShieldAlert, Sparkles, Settings2, Sliders, Palette, Users,
    Check, AlertTriangle, Eye, RefreshCw, Save, CheckCircle2,
    Search, UserCheck, UserX, ArrowRight, ShieldCheck, Flame
} from 'lucide-react';
import { supabase } from '@/config/supabase';
import { User, Rider } from '@/types';
import {
    ZomatoVIPPopupConfig,
    DEFAULT_ZOMATO_POPUP_CONFIG,
    useZomatoVIPPopupConfig,
    ZomatoThemeColor
} from '@/hooks/useZomatoVIPPopupConfig';
import ZomatoNegativeAlertModal from '@/components/ZomatoNegativeAlertModal';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const THEME_OPTIONS: { id: ZomatoThemeColor; name: string; gradient: string; dotColor: string }[] = [
    { id: 'crimson', name: 'Crimson Red (Urgent)', gradient: 'from-red-600 to-rose-700', dotColor: 'bg-red-500' },
    { id: 'amber', name: 'Amber Flame (Warning)', gradient: 'from-amber-500 to-orange-600', dotColor: 'bg-amber-500' },
    { id: 'purple', name: 'Cyber Purple (VIP Ops)', gradient: 'from-purple-600 to-fuchsia-700', dotColor: 'bg-purple-500' },
    { id: 'emerald', name: 'Neon Emerald (Recovery)', gradient: 'from-emerald-500 to-teal-700', dotColor: 'bg-emerald-500' },
    { id: 'blue', name: 'Electric Blue (Standard)', gradient: 'from-blue-600 to-indigo-700', dotColor: 'bg-blue-500' }
];

const PRESET_THRESHOLDS = [0, -250, -500, -1000, -1500, -2000];

export const ZomatoVIPPopupControllerModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { config: remoteConfig, saveConfig, loading: configLoading } = useZomatoVIPPopupConfig();
    const [localConfig, setLocalConfig] = useState<ZomatoVIPPopupConfig>(DEFAULT_ZOMATO_POPUP_CONFIG);
    const [activeTab, setActiveTab] = useState<'rules' | 'visibility' | 'style' | 'preview'>('rules');

    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [loadingTLs, setLoadingTLs] = useState(false);
    const [tlSearchQuery, setTlSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    // Sync remote config to local state on open
    useEffect(() => {
        if (isOpen && remoteConfig) {
            setLocalConfig({ ...remoteConfig });
        }
    }, [isOpen, remoteConfig]);

    // Fetch TLs for Visibility Management
    useEffect(() => {
        if (!isOpen) return;

        const fetchTLs = async () => {
            setLoadingTLs(true);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, full_name, email, reporting_manager, role, status')
                    .eq('role', 'teamLeader')
                    .order('full_name', { ascending: true });

                if (!error && data) {
                    setTeamLeaders(data.map((u: any) => ({
                        ...u,
                        fullName: u.full_name || 'Unknown TL',
                        reportingManager: u.reporting_manager || 'Unassigned RM'
                    } as User)));
                }
            } catch (err) {
                console.error('Error fetching TLs for Zomato Controller:', err);
            } finally {
                setLoadingTLs(false);
            }
        };

        fetchTLs();
    }, [isOpen]);

    // Mock Sample Riders for Live Preview
    const samplePreviewRiders: Rider[] = useMemo(() => [
        {
            id: 'sample-1',
            riderName: 'Rahul Sharma',
            mobileNumber: '9876543210',
            chassisNumber: 'P6DSVFMSP10293',
            walletAmount: -850,
            status: 'active'
        } as any,
        {
            id: 'sample-2',
            riderName: 'Vikram Singh',
            mobileNumber: '9811223344',
            chassisNumber: 'P6DSVFMSP48201',
            walletAmount: -1650,
            status: 'active'
        } as any,
        {
            id: 'sample-3',
            riderName: 'Amit Verma',
            mobileNumber: '9988776655',
            chassisNumber: 'P6DSVFMSP77123',
            walletAmount: -250,
            status: 'active'
        } as any
    ], []);

    const filteredTLs = useMemo(() => {
        if (!tlSearchQuery.trim()) return teamLeaders;
        const q = tlSearchQuery.toLowerCase().trim();
        return teamLeaders.filter(tl =>
            (tl.fullName || '').toLowerCase().includes(q) ||
            (tl.reportingManager || '').toLowerCase().includes(q) ||
            (tl.email || '').toLowerCase().includes(q)
        );
    }, [teamLeaders, tlSearchQuery]);

    const handleToggleTL = (tlId: string) => {
        setLocalConfig(prev => {
            const exists = prev.selectedTlIds.includes(tlId);
            const next = exists
                ? prev.selectedTlIds.filter(id => id !== tlId)
                : [...prev.selectedTlIds, tlId];
            return { ...prev, selectedTlIds: next };
        });
    };

    const handleSelectAllTLs = () => {
        setLocalConfig(prev => ({
            ...prev,
            selectedTlIds: teamLeaders.map(tl => tl.id)
        }));
    };

    const handleDeselectAllTLs = () => {
        setLocalConfig(prev => ({
            ...prev,
            selectedTlIds: []
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        const success = await saveConfig(localConfig);
        setSaving(false);
        if (success) {
            onClose();
        }
    };

    const handleResetDefaults = () => {
        setLocalConfig(DEFAULT_ZOMATO_POPUP_CONFIG);
        toast.info('Reset to factory default values (Click Save to apply).');
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-5xl bg-zinc-950/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5 relative">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25 border border-white/20">
                                <Flame className="text-white" size={22} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h2 className="text-lg font-black text-white tracking-wide">Zomato VIP Pop-Up Controller</h2>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest flex items-center gap-1">
                                        <Sparkles size={10} /> Real-Time Sync
                                    </span>
                                </div>
                                <p className="text-xs text-white/50 font-medium mt-0.5">
                                    Manage wallet thresholds, new allotment rules, TL visibility & visual themes.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/5"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-zinc-900/60 overflow-x-auto scrollbar-none">
                        <button
                            onClick={() => setActiveTab('rules')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'rules'
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <Sliders size={15} /> 1. Threshold & Rules
                        </button>
                        <button
                            onClick={() => setActiveTab('visibility')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'visibility'
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <Users size={15} /> 2. TL Visibility ({localConfig.visibilityMode === 'all' ? 'All TLs' : `${localConfig.selectedTlIds.length} Selected`})
                        </button>
                        <button
                            onClick={() => setActiveTab('style')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'style'
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <Palette size={15} /> 3. Themes & Branding
                        </button>
                        <button
                            onClick={() => setActiveTab('preview')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ml-auto ${
                                activeTab === 'preview'
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <Eye size={15} /> Live Card Preview
                        </button>
                    </div>

                    {/* Tab Body */}
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                        {/* ── TAB 1: RULES & THRESHOLDS ── */}
                        {activeTab === 'rules' && (
                            <div className="space-y-6 max-w-3xl mx-auto">
                                {/* Master Switches */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-white">Global Pop-Up Enable</div>
                                            <div className="text-xs text-white/50 mt-0.5">Master toggle for Zomato VIP alert pop-up</div>
                                        </div>
                                        <button
                                            onClick={() => setLocalConfig(p => ({ ...p, isEnabled: !p.isEnabled }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${
                                                localConfig.isEnabled ? 'bg-red-600' : 'bg-white/20'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                                                localConfig.isEnabled ? 'left-7' : 'left-1'
                                            }`} />
                                        </button>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-white">Auto-Trigger on Login</div>
                                            <div className="text-xs text-white/50 mt-0.5">Open automatically when dashboard opens</div>
                                        </div>
                                        <button
                                            onClick={() => setLocalConfig(p => ({ ...p, enableAutoPopup: !p.enableAutoPopup }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${
                                                localConfig.enableAutoPopup ? 'bg-red-600' : 'bg-white/20'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                                                localConfig.enableAutoPopup ? 'left-7' : 'left-1'
                                            }`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Threshold Settings */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                                    <div>
                                        <label className="text-sm font-bold text-white flex items-center gap-2">
                                            <span>Negative Wallet Threshold Limit (₹)</span>
                                            <span className="text-[11px] font-normal text-white/50">
                                                (Alert triggers when wallet is ≤ this amount)
                                            </span>
                                        </label>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {PRESET_THRESHOLDS.map(val => (
                                                <button
                                                    key={val}
                                                    onClick={() => setLocalConfig(p => ({ ...p, negativeThreshold: val }))}
                                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                        localConfig.negativeThreshold === val
                                                            ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/25'
                                                            : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {val === 0 ? '≤ ₹0 (Any Negative)' : `≤ ₹${val.toLocaleString('en-IN')}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <label className="text-xs text-white/60 font-semibold block mb-1">Custom Threshold Input (₹)</label>
                                        <input
                                            type="number"
                                            value={localConfig.negativeThreshold}
                                            onChange={e => setLocalConfig(p => ({ ...p, negativeThreshold: Number(e.target.value) || 0 }))}
                                            className="w-full max-w-xs px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm font-mono focus:border-red-500 focus:outline-none"
                                            placeholder="-500"
                                        />
                                    </div>
                                </div>

                                {/* Exclusion Rules */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5">
                                    <h3 className="text-sm font-bold text-white mb-2">Exclusion Rules</h3>

                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                        <div>
                                            <div className="text-xs font-bold text-white">Exclude New Allotments (Last 24–48 Hours)</div>
                                            <div className="text-[11px] text-white/50">Do not trigger alert for riders allotted yesterday or today</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={localConfig.excludeNewAllotments}
                                            onChange={e => setLocalConfig(p => ({ ...p, excludeNewAllotments: e.target.checked }))}
                                            className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                        <div>
                                            <div className="text-xs font-bold text-white">Exclude Stolen Tagged Vehicles</div>
                                            <div className="text-[11px] text-white/50">Filter out riders marked as stolen</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={localConfig.excludeStolen}
                                            onChange={e => setLocalConfig(p => ({ ...p, excludeStolen: e.target.checked }))}
                                            className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                        <div>
                                            <div className="text-xs font-bold text-white">Exclude Company Tagged Vehicles</div>
                                            <div className="text-[11px] text-white/50">Filter out riders with company tag</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={localConfig.excludeCompanyTagged}
                                            onChange={e => setLocalConfig(p => ({ ...p, excludeCompanyTagged: e.target.checked }))}
                                            className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 2: TL-WISE VISIBILITY ── */}
                        {activeTab === 'visibility' && (
                            <div className="space-y-6 max-w-4xl mx-auto">
                                {/* Mode Switcher */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                                    <h3 className="text-sm font-bold text-white">Team Leader Visibility Mode</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <button
                                            onClick={() => setLocalConfig(p => ({ ...p, visibilityMode: 'all' }))}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                localConfig.visibilityMode === 'all'
                                                    ? 'bg-red-600/20 border-red-500 text-white shadow-lg shadow-red-600/20'
                                                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="text-xs font-black uppercase tracking-wider flex items-center justify-between">
                                                <span>All Team Leaders</span>
                                                {localConfig.visibilityMode === 'all' && <Check size={14} className="text-red-400" />}
                                            </div>
                                            <div className="text-[11px] text-white/50 mt-1">Show pop-up on all active TL dashboards</div>
                                        </button>

                                        <button
                                            onClick={() => setLocalConfig(p => ({ ...p, visibilityMode: 'specific' }))}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                localConfig.visibilityMode === 'specific'
                                                    ? 'bg-red-600/20 border-red-500 text-white shadow-lg shadow-red-600/20'
                                                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="text-xs font-black uppercase tracking-wider flex items-center justify-between">
                                                <span>Specific TLs Only</span>
                                                {localConfig.visibilityMode === 'specific' && <Check size={14} className="text-red-400" />}
                                            </div>
                                            <div className="text-[11px] text-white/50 mt-1">Only selected TLs will see the pop-up</div>
                                        </button>

                                        <button
                                            onClick={() => setLocalConfig(p => ({ ...p, visibilityMode: 'excluded' }))}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                localConfig.visibilityMode === 'excluded'
                                                    ? 'bg-red-600/20 border-red-500 text-white shadow-lg shadow-red-600/20'
                                                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="text-xs font-black uppercase tracking-wider flex items-center justify-between">
                                                <span>Exclude Selected TLs</span>
                                                {localConfig.visibilityMode === 'excluded' && <Check size={14} className="text-red-400" />}
                                            </div>
                                            <div className="text-[11px] text-white/50 mt-1">Hide pop-up for selected TLs, show for all others</div>
                                        </button>
                                    </div>
                                </div>

                                {/* TL Whitelist / Blacklist Matrix */}
                                {localConfig.visibilityMode !== 'all' && (
                                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-bold text-white">
                                                    Select Team Leaders ({localConfig.selectedTlIds.length} Selected)
                                                </h3>
                                                <p className="text-xs text-white/50">
                                                    {localConfig.visibilityMode === 'specific' ? 'Checked TLs WILL see the alert' : 'Checked TLs WILL NOT see the alert'}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleSelectAllTLs}
                                                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    onClick={handleDeselectAllTLs}
                                                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        </div>

                                        {/* Search Filter */}
                                        <div className="relative">
                                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                                            <input
                                                type="text"
                                                value={tlSearchQuery}
                                                onChange={e => setTlSearchQuery(e.target.value)}
                                                placeholder="Search TL Name or Reporting Manager..."
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-red-500 focus:outline-none"
                                            />
                                        </div>

                                        {/* TL Grid List */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                            {loadingTLs ? (
                                                <div className="col-span-full py-8 text-center text-white/40 text-xs">Loading Team Leaders...</div>
                                            ) : filteredTLs.length === 0 ? (
                                                <div className="col-span-full py-8 text-center text-white/40 text-xs">No matching Team Leaders found.</div>
                                            ) : (
                                                filteredTLs.map(tl => {
                                                    const isChecked = localConfig.selectedTlIds.includes(tl.id);
                                                    return (
                                                        <div
                                                            key={tl.id}
                                                            onClick={() => handleToggleTL(tl.id)}
                                                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                                                isChecked
                                                                    ? 'bg-red-600/20 border-red-500/60 text-white'
                                                                    : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5'
                                                            }`}
                                                        >
                                                            <div className="truncate pr-2">
                                                                <div className="text-xs font-bold truncate">{tl.fullName}</div>
                                                                <div className="text-[10px] text-white/40 truncate">RM: {tl.reportingManager || 'Unassigned'}</div>
                                                            </div>
                                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border ${
                                                                isChecked
                                                                    ? 'bg-red-600 border-red-500 text-white'
                                                                    : 'border-white/20 bg-black/40'
                                                            }`}>
                                                                {isChecked && <Check size={12} />}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── TAB 3: THEMES & BRANDING ── */}
                        {activeTab === 'style' && (
                            <div className="space-y-6 max-w-3xl mx-auto">
                                {/* Color Palette Selector */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                                    <h3 className="text-sm font-bold text-white">Color Palette & Urgency Theme</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {THEME_OPTIONS.map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setLocalConfig(p => ({ ...p, themeColor: opt.id }))}
                                                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                                                    localConfig.themeColor === opt.id
                                                        ? 'bg-white/10 border-white/40 shadow-xl'
                                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full ${opt.dotColor} shadow-md`} />
                                                    <span className="text-xs font-bold text-white">{opt.name}</span>
                                                </div>
                                                {localConfig.themeColor === opt.id && <Check size={16} className="text-white" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Text Fields */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                                    <h3 className="text-sm font-bold text-white">Custom Header & Button Text</h3>

                                    <div>
                                        <label className="text-xs text-white/60 font-semibold block mb-1.5">Alert Card Title</label>
                                        <input
                                            type="text"
                                            value={localConfig.customTitle}
                                            onChange={e => setLocalConfig(p => ({ ...p, customTitle: e.target.value }))}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold focus:border-red-500 focus:outline-none"
                                            placeholder="Critical Alert"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-white/60 font-semibold block mb-1.5">Alert Description / Subtitle</label>
                                        <textarea
                                            value={localConfig.customSubtitle}
                                            onChange={e => setLocalConfig(p => ({ ...p, customSubtitle: e.target.value }))}
                                            rows={2}
                                            className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-medium focus:border-red-500 focus:outline-none resize-none"
                                            placeholder="Zomato VIP Riders have 0 or negative wallet balances."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-white/60 font-semibold block mb-1.5">Action Button Label</label>
                                        <input
                                            type="text"
                                            value={localConfig.actionButtonText}
                                            onChange={e => setLocalConfig(p => ({ ...p, actionButtonText: e.target.value }))}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold focus:border-red-500 focus:outline-none"
                                            placeholder="Acknowledge & Close"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 4: LIVE PREVIEW ── */}
                        {activeTab === 'preview' && (
                            <div className="flex flex-col items-center justify-center p-4">
                                <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Eye size={14} className="text-purple-400" /> Interactive Real-Time Preview
                                </div>
                                <div className="w-full max-w-lg">
                                    <ZomatoNegativeAlertModal
                                        isOpen={true}
                                        onClose={() => {}}
                                        negativeRiders={samplePreviewRiders}
                                        config={localConfig}
                                        isInteractivePreview={true}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-5 border-t border-white/10 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <button
                            onClick={handleResetDefaults}
                            className="text-xs font-semibold text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5"
                        >
                            <RefreshCw size={12} /> Reset to Defaults
                        </button>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold transition-all border border-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black shadow-lg shadow-red-600/30 transition-all uppercase tracking-wider disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" /> Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} /> Save & Broadcast
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
