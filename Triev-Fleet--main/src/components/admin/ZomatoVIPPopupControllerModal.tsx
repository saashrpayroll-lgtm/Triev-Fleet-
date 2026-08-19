import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Sparkles, Palette, Users,
    Check, Eye, RefreshCw, Save,
    Search, Flame, Zap
} from 'lucide-react';
import { supabase } from '@/config/supabase';
import { User, Rider } from '@/types';
import {
    ZomatoVIPPopupConfig,
    ZomatoLowBalancePopupConfig,
    DEFAULT_ZOMATO_POPUP_CONFIG,
    DEFAULT_ZOMATO_LOW_BALANCE_POPUP_CONFIG,
    useZomatoVIPPopupConfig,
    ZomatoThemeColor,
    ZomatoLowBalanceThemeColor
} from '@/hooks/useZomatoVIPPopupConfig';
import ZomatoNegativeAlertModal from '@/components/ZomatoNegativeAlertModal';
import ZomatoLowBalanceAlertModal from '@/components/ZomatoLowBalanceAlertModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const NEGATIVE_THEME_OPTIONS: { id: ZomatoThemeColor; name: string; gradient: string; dotColor: string }[] = [
    { id: 'crimson', name: 'Crimson Red (Urgent)', gradient: 'from-red-600 to-rose-700', dotColor: 'bg-red-500' },
    { id: 'amber', name: 'Amber Flame (Warning)', gradient: 'from-amber-500 to-orange-600', dotColor: 'bg-amber-500' },
    { id: 'purple', name: 'Cyber Purple (VIP Ops)', gradient: 'from-purple-600 to-fuchsia-700', dotColor: 'bg-purple-500' },
    { id: 'emerald', name: 'Neon Emerald (Recovery)', gradient: 'from-emerald-500 to-teal-700', dotColor: 'bg-emerald-500' },
    { id: 'blue', name: 'Electric Blue (Standard)', gradient: 'from-blue-600 to-indigo-700', dotColor: 'bg-blue-500' }
];

const LOW_BALANCE_THEME_OPTIONS: { id: ZomatoLowBalanceThemeColor; name: string; gradient: string; dotColor: string }[] = [
    { id: 'gold', name: 'Sunflower Gold (Recharge)', gradient: 'from-yellow-500 to-amber-600', dotColor: 'bg-yellow-400' },
    { id: 'amber', name: 'Amber Glow (Warning)', gradient: 'from-amber-500 to-orange-600', dotColor: 'bg-amber-500' },
    { id: 'purple', name: 'Cyber Violet (VIP Priority)', gradient: 'from-purple-600 to-indigo-700', dotColor: 'bg-purple-500' },
    { id: 'emerald', name: 'Neon Mint (Safe Top-up)', gradient: 'from-emerald-500 to-teal-700', dotColor: 'bg-emerald-400' },
    { id: 'blue', name: 'Cobalt Electric (Fleet)', gradient: 'from-cyan-500 to-blue-700', dotColor: 'bg-cyan-400' }
];

const PRESET_NEGATIVE_THRESHOLDS = [0, -250, -500, -1000, -1500, -2000];
const PRESET_LOW_BALANCE_THRESHOLDS = [100, 150, 200, 250, 300, 500];

export const ZomatoVIPPopupControllerModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { negativeConfig, lowBalanceConfig, saveConfig } = useZomatoVIPPopupConfig();

    // Active Modal Mode Switcher
    const [popupMode, setPopupMode] = useState<'negative' | 'low_balance'>('negative');

    // Local state for Negative Config
    const [localNegativeConfig, setLocalNegativeConfig] = useState<ZomatoVIPPopupConfig>(DEFAULT_ZOMATO_POPUP_CONFIG);
    // Local state for Low Balance Config
    const [localLowBalanceConfig, setLocalLowBalanceConfig] = useState<ZomatoLowBalancePopupConfig>(DEFAULT_ZOMATO_LOW_BALANCE_POPUP_CONFIG);

    const [activeTab, setActiveTab] = useState<'rules' | 'visibility' | 'style' | 'preview'>('rules');

    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [loadingTLs, setLoadingTLs] = useState(false);
    const [tlSearchQuery, setTlSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    // Sync remote configs to local state on open
    useEffect(() => {
        if (isOpen) {
            if (negativeConfig) setLocalNegativeConfig({ ...negativeConfig });
            if (lowBalanceConfig) setLocalLowBalanceConfig({ ...lowBalanceConfig });
        }
    }, [isOpen, negativeConfig, lowBalanceConfig]);

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

    // Mock Sample Riders for Negative Preview
    const sampleNegativeRiders: Rider[] = useMemo(() => [
        {
            id: 'sample-neg-1',
            riderName: 'Rahul Sharma',
            mobileNumber: '9876543210',
            chassisNumber: 'P6DSVFMSP10293',
            walletAmount: -850,
            status: 'active'
        } as any,
        {
            id: 'sample-neg-2',
            riderName: 'Vikram Singh',
            mobileNumber: '9811223344',
            chassisNumber: 'P6DSVFMSP48201',
            walletAmount: -1650,
            status: 'active'
        } as any,
        {
            id: 'sample-neg-3',
            riderName: 'Amit Verma',
            mobileNumber: '9988776655',
            chassisNumber: 'P6DSVFMSP77123',
            walletAmount: -250,
            status: 'active'
        } as any
    ], []);

    // Mock Sample Riders for Low Balance Preview
    const sampleLowBalanceRiders: Rider[] = useMemo(() => [
        {
            id: 'sample-lb-1',
            riderName: 'Aakash Mehra',
            mobileNumber: '9876541122',
            chassisNumber: 'P6DSVFMSP30192',
            walletAmount: 85,
            status: 'active'
        } as any,
        {
            id: 'sample-lb-2',
            riderName: 'Sanjay Kumar',
            mobileNumber: '9811445566',
            chassisNumber: 'P6DSVFMSP61024',
            walletAmount: 180,
            status: 'active'
        } as any,
        {
            id: 'sample-lb-3',
            riderName: 'Deepak Yadav',
            mobileNumber: '9988112233',
            chassisNumber: 'P6DSVFMSP90142',
            walletAmount: 220,
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

    // Active Config References
    const isNeg = popupMode === 'negative';

    const handleToggleTL = (tlId: string) => {
        if (isNeg) {
            setLocalNegativeConfig(prev => {
                const exists = prev.selectedTlIds.includes(tlId);
                return {
                    ...prev,
                    selectedTlIds: exists
                        ? prev.selectedTlIds.filter(id => id !== tlId)
                        : [...prev.selectedTlIds, tlId]
                };
            });
        } else {
            setLocalLowBalanceConfig(prev => {
                const exists = prev.selectedTlIds.includes(tlId);
                return {
                    ...prev,
                    selectedTlIds: exists
                        ? prev.selectedTlIds.filter(id => id !== tlId)
                        : [...prev.selectedTlIds, tlId]
                };
            });
        }
    };

    const handleSelectAllTLs = () => {
        const allIds = teamLeaders.map(tl => tl.id);
        if (isNeg) {
            setLocalNegativeConfig(p => ({ ...p, selectedTlIds: allIds }));
        } else {
            setLocalLowBalanceConfig(p => ({ ...p, selectedTlIds: allIds }));
        }
    };

    const handleDeselectAllTLs = () => {
        if (isNeg) {
            setLocalNegativeConfig(p => ({ ...p, selectedTlIds: [] }));
        } else {
            setLocalLowBalanceConfig(p => ({ ...p, selectedTlIds: [] }));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveConfig(localNegativeConfig, localLowBalanceConfig);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 15 }}
                    className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-colors ${
                                isNeg
                                    ? 'bg-gradient-to-br from-red-500 to-rose-700 shadow-red-500/20'
                                    : 'bg-gradient-to-br from-yellow-500 to-amber-600 shadow-yellow-500/20'
                            }`}>
                                {isNeg ? <Flame size={20} /> : <Zap size={20} />}
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white flex items-center gap-2">
                                    Centralized Zomato VIP Pop-up Controller
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 font-mono">
                                        ADMIN MASTER
                                    </span>
                                </h2>
                                <p className="text-xs text-zinc-400">
                                    Manage Defaulter Negative and Low Balance (&lt; ₹250) pop-up alerts, TL visibility & styling in real-time
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Pop-up Mode Selector (Dual Modal Controls) */}
                    <div className="px-6 py-3 bg-zinc-900/40 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
                            <button
                                onClick={() => setPopupMode('negative')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                    isNeg
                                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Flame size={14} />
                                <span>🔴 Negative Debt Alert Modal</span>
                                {localNegativeConfig.isEnabled && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                )}
                            </button>

                            <button
                                onClick={() => setPopupMode('low_balance')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                    !isNeg
                                        ? 'bg-yellow-500 text-zinc-950 shadow-lg shadow-yellow-500/30'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Zap size={14} />
                                <span>🟡 Low Balance (&lt; ₹250) Modal</span>
                                {localLowBalanceConfig.isEnabled && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                )}
                            </button>
                        </div>

                        <div className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
                            <span>Active Controlling Mode:</span>
                            <strong className={isNeg ? 'text-red-400' : 'text-yellow-400'}>
                                {isNeg ? 'NEGATIVE DEBT POPUP' : 'LOW BALANCE TOP-UP POPUP'}
                            </strong>
                        </div>
                    </div>

                    {/* Sub-Navigation Tabs */}
                    <div className="px-6 pt-3 border-b border-zinc-800 bg-zinc-900/20 flex gap-2">
                        {[
                            { id: 'rules', label: 'Threshold & Rules', icon: <Sparkles size={14} /> },
                            { id: 'visibility', label: 'TL & Role Visibility', icon: <Users size={14} /> },
                            { id: 'style', label: 'Layout & Themes', icon: <Palette size={14} /> },
                            { id: 'preview', label: 'Live Interactive Preview', icon: <Eye size={14} /> }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
                                    activeTab === t.id
                                        ? isNeg
                                            ? 'border-red-500 text-red-400 bg-red-500/10'
                                            : 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                }`}
                            >
                                {t.icon}
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Modal Content Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/20">
                        {/* ── TAB 1: THRESHOLD & RULES ── */}
                        {activeTab === 'rules' && (
                            <div className="space-y-6 max-w-3xl mx-auto">
                                {/* Master Switches */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-white">
                                                Enable {isNeg ? 'Negative Alert' : 'Low Balance'} Pop-up
                                            </div>
                                            <div className="text-xs text-white/50 mt-0.5">Master toggle across the platform</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (isNeg) {
                                                    setLocalNegativeConfig(p => ({ ...p, isEnabled: !p.isEnabled }));
                                                } else {
                                                    setLocalLowBalanceConfig(p => ({ ...p, isEnabled: !p.isEnabled }));
                                                }
                                            }}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${
                                                (isNeg ? localNegativeConfig.isEnabled : localLowBalanceConfig.isEnabled)
                                                    ? isNeg ? 'bg-red-600' : 'bg-yellow-500'
                                                    : 'bg-white/20'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                                                (isNeg ? localNegativeConfig.isEnabled : localLowBalanceConfig.isEnabled)
                                                    ? 'left-7'
                                                    : 'left-1'
                                            }`} />
                                        </button>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-white">Auto-Trigger on Login</div>
                                            <div className="text-xs text-white/50 mt-0.5">Open automatically when dashboard opens</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (isNeg) {
                                                    setLocalNegativeConfig(p => ({ ...p, enableAutoPopup: !p.enableAutoPopup }));
                                                } else {
                                                    setLocalLowBalanceConfig(p => ({ ...p, enableAutoPopup: !p.enableAutoPopup }));
                                                }
                                            }}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${
                                                (isNeg ? localNegativeConfig.enableAutoPopup : localLowBalanceConfig.enableAutoPopup)
                                                    ? isNeg ? 'bg-red-600' : 'bg-yellow-500'
                                                    : 'bg-white/20'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                                                (isNeg ? localNegativeConfig.enableAutoPopup : localLowBalanceConfig.enableAutoPopup)
                                                    ? 'left-7'
                                                    : 'left-1'
                                            }`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Threshold Settings */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                                    {isNeg ? (
                                        <div>
                                            <label className="text-sm font-bold text-white flex items-center gap-2">
                                                <span>Negative Wallet Threshold Limit (₹)</span>
                                                <span className="text-[11px] font-normal text-white/50">
                                                    (Alert triggers when wallet is ≤ this amount)
                                                </span>
                                            </label>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {PRESET_NEGATIVE_THRESHOLDS.map(val => (
                                                    <button
                                                        key={val}
                                                        onClick={() => setLocalNegativeConfig(p => ({ ...p, negativeThreshold: val }))}
                                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                            localNegativeConfig.negativeThreshold === val
                                                                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/25'
                                                                : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {val === 0 ? '≤ ₹0 (Any Negative)' : `≤ ₹${val.toLocaleString('en-IN')}`}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="pt-3">
                                                <label className="text-xs text-white/60 font-semibold block mb-1">Custom Negative Limit (₹)</label>
                                                <input
                                                    type="number"
                                                    value={localNegativeConfig.negativeThreshold}
                                                    onChange={e => setLocalNegativeConfig(p => ({ ...p, negativeThreshold: Number(e.target.value) || 0 }))}
                                                    className="w-full max-w-xs px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm font-mono focus:border-red-500 focus:outline-none"
                                                    placeholder="-500"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-sm font-bold text-white flex items-center gap-2">
                                                <span>Low Balance Top-Up Threshold Limit (₹)</span>
                                                <span className="text-[11px] font-normal text-white/50">
                                                    (Alert triggers for positive riders having wallet &lt; this amount, i.e. ₹0 to ₹249)
                                                </span>
                                            </label>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {PRESET_LOW_BALANCE_THRESHOLDS.map(val => (
                                                    <button
                                                        key={val}
                                                        onClick={() => setLocalLowBalanceConfig(p => ({ ...p, lowBalanceThreshold: val }))}
                                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border ${
                                                            localLowBalanceConfig.lowBalanceThreshold === val
                                                                ? 'bg-yellow-500 text-zinc-950 border-yellow-400 shadow-md shadow-yellow-500/25'
                                                                : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        &lt; ₹{val.toLocaleString('en-IN')} {val === 250 && '(Default ₹0-249)'}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="pt-3">
                                                <label className="text-xs text-white/60 font-semibold block mb-1">Custom Low Balance Max Limit (₹)</label>
                                                <input
                                                    type="number"
                                                    value={localLowBalanceConfig.lowBalanceThreshold}
                                                    onChange={e => setLocalLowBalanceConfig(p => ({ ...p, lowBalanceThreshold: Number(e.target.value) || 250 }))}
                                                    className="w-full max-w-xs px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm font-mono focus:border-yellow-500 focus:outline-none"
                                                    placeholder="250"
                                                />
                                            </div>
                                        </div>
                                    )}
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
                                            checked={isNeg ? localNegativeConfig.excludeNewAllotments : localLowBalanceConfig.excludeNewAllotments}
                                            onChange={e => {
                                                if (isNeg) setLocalNegativeConfig(p => ({ ...p, excludeNewAllotments: e.target.checked }));
                                                else setLocalLowBalanceConfig(p => ({ ...p, excludeNewAllotments: e.target.checked }));
                                            }}
                                            className={`w-5 h-5 rounded cursor-pointer ${isNeg ? 'accent-red-600' : 'accent-yellow-500'}`}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                        <div>
                                            <div className="text-xs font-bold text-white">Exclude Stolen Tagged Vehicles</div>
                                            <div className="text-[11px] text-white/50">Filter out riders marked as stolen</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isNeg ? localNegativeConfig.excludeStolen : localLowBalanceConfig.excludeStolen}
                                            onChange={e => {
                                                if (isNeg) setLocalNegativeConfig(p => ({ ...p, excludeStolen: e.target.checked }));
                                                else setLocalLowBalanceConfig(p => ({ ...p, excludeStolen: e.target.checked }));
                                            }}
                                            className={`w-5 h-5 rounded cursor-pointer ${isNeg ? 'accent-red-600' : 'accent-yellow-500'}`}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                        <div>
                                            <div className="text-xs font-bold text-white">Exclude Company Tagged Vehicles</div>
                                            <div className="text-[11px] text-white/50">Filter out riders with company tag</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isNeg ? localNegativeConfig.excludeCompanyTagged : localLowBalanceConfig.excludeCompanyTagged}
                                            onChange={e => {
                                                if (isNeg) setLocalNegativeConfig(p => ({ ...p, excludeCompanyTagged: e.target.checked }));
                                                else setLocalLowBalanceConfig(p => ({ ...p, excludeCompanyTagged: e.target.checked }));
                                            }}
                                            className={`w-5 h-5 rounded cursor-pointer ${isNeg ? 'accent-red-600' : 'accent-yellow-500'}`}
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
                                    <h3 className="text-sm font-bold text-white">
                                        Team Leader Visibility Mode for {isNeg ? 'Negative Debt' : 'Low Balance'} Pop-up
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { id: 'all', title: 'All Team Leaders', desc: 'Show pop-up on all active TL dashboards' },
                                            { id: 'specific', title: 'Specific TLs Only', desc: 'Only selected TLs will see the pop-up' },
                                            { id: 'excluded', title: 'Exclude Selected TLs', desc: 'Hide pop-up for selected TLs, show for all others' }
                                        ].map(m => {
                                            const currentMode = isNeg ? localNegativeConfig.visibilityMode : localLowBalanceConfig.visibilityMode;
                                            const isSelected = currentMode === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    onClick={() => {
                                                        if (isNeg) setLocalNegativeConfig(p => ({ ...p, visibilityMode: m.id as any }));
                                                        else setLocalLowBalanceConfig(p => ({ ...p, visibilityMode: m.id as any }));
                                                    }}
                                                    className={`p-3 rounded-xl border text-left transition-all ${
                                                        isSelected
                                                            ? isNeg
                                                                ? 'bg-red-600/20 border-red-500 text-white shadow-lg shadow-red-600/20'
                                                                : 'bg-yellow-500/20 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <div className="text-xs font-black uppercase tracking-wider flex items-center justify-between">
                                                        <span>{m.title}</span>
                                                        {isSelected && <Check size={14} className={isNeg ? 'text-red-400' : 'text-yellow-400'} />}
                                                    </div>
                                                    <div className="text-[11px] text-white/50 mt-1">{m.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* TL Whitelist / Blacklist Matrix */}
                                {((isNeg ? localNegativeConfig.visibilityMode : localLowBalanceConfig.visibilityMode) !== 'all') && (
                                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-bold text-white">
                                                    Select Team Leaders ({((isNeg ? localNegativeConfig.selectedTlIds : localLowBalanceConfig.selectedTlIds) || []).length} Selected)
                                                </h3>
                                                <p className="text-xs text-white/50">
                                                    {(isNeg ? localNegativeConfig.visibilityMode : localLowBalanceConfig.visibilityMode) === 'specific'
                                                        ? 'Checked TLs WILL see the alert'
                                                        : 'Checked TLs WILL NOT see the alert'}
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
                                                placeholder="Search by TL Name, Reporting Manager or Email..."
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-white/30 focus:border-red-500 focus:outline-none"
                                            />
                                        </div>

                                        {/* Grid of TLs */}
                                        {loadingTLs ? (
                                            <div className="py-8 text-center text-white/50 text-xs flex items-center justify-center gap-2">
                                                <RefreshCw size={14} className="animate-spin" /> Loading Team Leaders...
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto custom-scrollbar p-1">
                                                {filteredTLs.map(tl => {
                                                    const selectedIds = isNeg ? localNegativeConfig.selectedTlIds : localLowBalanceConfig.selectedTlIds;
                                                    const isChecked = selectedIds.includes(tl.id);
                                                    return (
                                                        <div
                                                            key={tl.id}
                                                            onClick={() => handleToggleTL(tl.id)}
                                                            className={`p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                                                isChecked
                                                                    ? isNeg
                                                                        ? 'bg-red-500/15 border-red-500/40 text-white'
                                                                        : 'bg-yellow-500/15 border-yellow-500/40 text-white'
                                                                    : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5'
                                                            }`}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-xs font-bold text-white truncate">{tl.fullName}</div>
                                                                <div className="text-[10px] text-white/40 truncate">RM: {tl.reportingManager}</div>
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleToggleTL(tl.id)}
                                                                className={`w-4 h-4 rounded cursor-pointer ${isNeg ? 'accent-red-600' : 'accent-yellow-500'}`}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Role Multi-Select */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                                    <h3 className="text-sm font-bold text-white">Enable Pop-up for User Roles</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { id: 'teamLeader', label: 'Team Leader (TL)' },
                                            { id: 'reportingManager', label: 'Reporting Manager (RM)' },
                                            { id: 'cityOps', label: 'City Ops Manager' }
                                        ].map(r => {
                                            const enabledRoles = isNeg ? localNegativeConfig.enabledForRoles : localLowBalanceConfig.enabledForRoles;
                                            const isChecked = enabledRoles.includes(r.id as any);
                                            return (
                                                <div
                                                    key={r.id}
                                                    onClick={() => {
                                                        if (isNeg) {
                                                            setLocalNegativeConfig(p => ({
                                                                ...p,
                                                                enabledForRoles: isChecked
                                                                    ? p.enabledForRoles.filter(role => role !== r.id)
                                                                    : [...p.enabledForRoles, r.id as any]
                                                            }));
                                                        } else {
                                                            setLocalLowBalanceConfig(p => ({
                                                                ...p,
                                                                enabledForRoles: isChecked
                                                                    ? p.enabledForRoles.filter(role => role !== r.id)
                                                                    : [...p.enabledForRoles, r.id as any]
                                                            }));
                                                        }
                                                    }}
                                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                                        isChecked
                                                            ? isNeg
                                                                ? 'bg-red-600/20 border-red-500 text-white'
                                                                : 'bg-yellow-500/20 border-yellow-500 text-white'
                                                            : 'bg-white/5 border-white/10 text-white/50'
                                                    }`}
                                                >
                                                    <span className="text-xs font-bold">{r.label}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className={`w-4 h-4 rounded ${isNeg ? 'accent-red-600' : 'accent-yellow-500'}`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 3: LAYOUT & THEMES ── */}
                        {activeTab === 'style' && (
                            <div className="space-y-6 max-w-3xl mx-auto">
                                {/* Theme Picker */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                                    <h3 className="text-sm font-bold text-white">Select Pop-up Visual Color Theme</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(isNeg ? NEGATIVE_THEME_OPTIONS : LOW_BALANCE_THEME_OPTIONS).map(t => {
                                            const currentTheme = isNeg ? localNegativeConfig.themeColor : localLowBalanceConfig.themeColor;
                                            const isSelected = currentTheme === t.id;
                                            return (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        if (isNeg) setLocalNegativeConfig(p => ({ ...p, themeColor: t.id as any }));
                                                        else setLocalLowBalanceConfig(p => ({ ...p, themeColor: t.id as any }));
                                                    }}
                                                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                                                        isSelected
                                                            ? 'bg-white/15 border-white text-white shadow-lg'
                                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-4 h-4 rounded-full ${t.dotColor} shadow-sm`} />
                                                        <span className="text-xs font-bold">{t.name}</span>
                                                    </div>
                                                    {isSelected && <Check size={14} className="text-white" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Custom Text Fields */}
                                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                                    <h3 className="text-sm font-bold text-white">Custom Modal Copy & Action Button</h3>

                                    <div>
                                        <label className="text-xs text-white/60 font-semibold block mb-1">Pop-up Header Title</label>
                                        <input
                                            type="text"
                                            value={isNeg ? localNegativeConfig.customTitle : localLowBalanceConfig.customTitle}
                                            onChange={e => {
                                                if (isNeg) setLocalNegativeConfig(p => ({ ...p, customTitle: e.target.value }));
                                                else setLocalLowBalanceConfig(p => ({ ...p, customTitle: e.target.value }));
                                            }}
                                            className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-red-500 focus:outline-none"
                                            placeholder="Modal Title"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-white/60 font-semibold block mb-1">Pop-up Subtitle / Instructions</label>
                                        <input
                                            type="text"
                                            value={isNeg ? localNegativeConfig.customSubtitle : localLowBalanceConfig.customSubtitle}
                                            onChange={e => {
                                                if (isNeg) setLocalNegativeConfig(p => ({ ...p, customSubtitle: e.target.value }));
                                                else setLocalLowBalanceConfig(p => ({ ...p, customSubtitle: e.target.value }));
                                            }}
                                            className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-red-500 focus:outline-none"
                                            placeholder="Modal Subtitle"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-white/60 font-semibold block mb-1">Main Action Button Text</label>
                                        <input
                                            type="text"
                                            value={isNeg ? localNegativeConfig.actionButtonText : localLowBalanceConfig.actionButtonText}
                                            onChange={e => {
                                                if (isNeg) setLocalNegativeConfig(p => ({ ...p, actionButtonText: e.target.value }));
                                                else setLocalLowBalanceConfig(p => ({ ...p, actionButtonText: e.target.value }));
                                            }}
                                            className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-red-500 focus:outline-none"
                                            placeholder="Action Button"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 4: LIVE SIMULATED PREVIEW ── */}
                        {activeTab === 'preview' && (
                            <div className="space-y-4 max-w-2xl mx-auto">
                                <div className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-between text-xs text-white/60">
                                    <div className="flex items-center gap-2">
                                        <Eye size={14} className={isNeg ? 'text-red-400' : 'text-yellow-400'} />
                                        <span>Live Simulation of {isNeg ? 'Negative Debt' : 'Low Balance (< ₹250)'} Pop-up</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-white/40">Real-Time Responsive Preview</span>
                                </div>

                                <div className="rounded-3xl border border-white/10 p-2 bg-black/40 shadow-inner">
                                    {isNeg ? (
                                        <ZomatoNegativeAlertModal
                                            isOpen={true}
                                            onClose={() => {}}
                                            negativeRiders={sampleNegativeRiders}
                                            config={localNegativeConfig}
                                            isInteractivePreview={true}
                                        />
                                    ) : (
                                        <ZomatoLowBalanceAlertModal
                                            isOpen={true}
                                            onClose={() => {}}
                                            lowBalanceRiders={sampleLowBalanceRiders}
                                            config={localLowBalanceConfig}
                                            isInteractivePreview={true}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Changes will instantly apply across all TL, RM & CityOps browsers via Supabase Real-Time</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/25 active:scale-95 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Deploying...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} />
                                        <span>Save & Deploy Globally</span>
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
