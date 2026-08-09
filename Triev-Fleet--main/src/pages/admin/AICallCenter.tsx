import React, { useEffect, useState, useMemo } from 'react';
import { Bot, PhoneCall, History, Settings, Play, ShieldAlert, AlertTriangle, Search, RefreshCw, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { OutboundCallService, CallScenario } from '@/services/OutboundCallService';
import { AICallLog, AutoCallConfig, Rider, User } from '@/types';
import { fetchAllRidersPaginated, fetchTablePaginated } from '@/utils/dbUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from 'sonner';
import PageTransition from '@/components/ui/PageTransition';
import GradientBadge from '@/components/ui/GradientBadge';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

export const AICallCenter: React.FC = () => {
    const { userData } = useSupabaseAuth();
    const [activeTab, setActiveTab] = useState<'history' | 'bulk' | 'auto_config'>('history');
    const [loading, setLoading] = useState(true);
    const [callLogs, setCallLogs] = useState<AICallLog[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
    const [autoConfigs, setAutoConfigs] = useState<Record<string, AutoCallConfig>>({});

    // Filter & Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [scenarioFilter, setScenarioFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Bulk Triggering state
    const [selectedTargetGroup, setSelectedTargetGroup] = useState<'negative' | 'low' | 'all'>('negative');
    const [isTriggeringBulk, setIsTriggeringBulk] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [logsData, ridersRes, usersRes] = await Promise.all([
                OutboundCallService.fetchCallLogs(100),
                fetchAllRidersPaginated(`id, trievId:triev_id, riderName:rider_name, mobileNumber:mobile_number, walletAmount:wallet_amount, status, teamLeaderId:team_leader_id`),
                fetchTablePaginated('users', `id, fullName:full_name, username, role, status`)
            ]);

            setCallLogs(Array.isArray(logsData) ? logsData : []);

            const rawRiders = Array.isArray(ridersRes?.data) ? ridersRes.data : [];
            setRiders(rawRiders);

            const rawUsers = Array.isArray(usersRes?.data) ? usersRes.data : [];
            const tls = rawUsers.filter((u: any) => u.role === 'teamLeader');
            setTeamLeaders(tls);

            // Fetch auto call configs for all TLs
            const configMap: Record<string, AutoCallConfig> = {};
            for (const tl of tls) {
                const cfg = await OutboundCallService.fetchAutoCallConfig(tl.id);
                if (cfg) configMap[tl.id] = cfg;
            }
            setAutoConfigs(configMap);

        } catch (e) {
            console.error('Failed to load AI Call Center data:', e);
            toast.error('Failed to load call logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filtered Call Logs
    const filteredLogs = useMemo(() => {
        const list = Array.isArray(callLogs) ? callLogs : [];
        return list.filter(log => {
            const matchesSearch = (log.riderName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.mobileNumber || '').includes(searchQuery) ||
                (log.triggeredByName || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesScenario = scenarioFilter === 'all' || log.callScenario === scenarioFilter;
            const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
            return matchesSearch && matchesScenario && matchesStatus;
        });
    }, [callLogs, searchQuery, scenarioFilter, statusFilter]);

    // Targeted Riders Analysis
    const targetedAnalysis = useMemo(() => {
        const list = Array.isArray(riders) ? riders : [];
        const negativeRiders = list.filter(r => Number(r.walletAmount || 0) < 0 && r.status === 'active');
        const lowBalanceRiders = list.filter(r => Number(r.walletAmount || 0) >= 0 && Number(r.walletAmount || 0) < 250 && r.status === 'active');
        return {
            negativeCount: negativeRiders.length,
            lowBalanceCount: lowBalanceRiders.length,
            totalTargetedCount: negativeRiders.length + lowBalanceRiders.length,
            negativeRiders,
            lowBalanceRiders,
            totalTargeted: [...negativeRiders, ...lowBalanceRiders]
        };
    }, [riders]);

    // Handle Bulk Call Trigger
    const handleTriggerBulkCalls = async () => {
        let selectedRiders: Rider[] = [];
        let scenario: CallScenario = 'negative_balance';

        if (selectedTargetGroup === 'negative') {
            selectedRiders = targetedAnalysis.negativeRiders;
            scenario = 'negative_balance';
        } else if (selectedTargetGroup === 'low') {
            selectedRiders = targetedAnalysis.lowBalanceRiders;
            scenario = 'low_balance';
        } else {
            selectedRiders = targetedAnalysis.totalTargeted;
            scenario = 'negative_balance';
        }

        if (selectedRiders.length === 0) {
            toast.warning('No eligible riders found for selected target group.');
            return;
        }

        setIsTriggeringBulk(true);
        toast.info(`Initiating bulk AI calls to ${selectedRiders.length} riders...`);

        try {
            const res = await OutboundCallService.triggerBulkCalls(
                selectedRiders.map(r => ({
                    id: r.id,
                    riderName: r.riderName,
                    mobileNumber: r.mobileNumber,
                    walletAmount: r.walletAmount
                })),
                scenario,
                userData?.fullName || 'Admin',
                userData?.id
            );

            toast.success(`Dispatched ${res.dispatched} of ${res.total} AI calls successfully.`);
            await loadData();
        } catch (e) {
            toast.error('Bulk call dispatch encountered errors.');
        } finally {
            setIsTriggeringBulk(false);
        }
    };

    // Toggle Auto Call for TL
    const handleToggleAutoConfig = async (tlId: string, enabled: boolean) => {
        const current = autoConfigs[tlId] || {
            id: `cfg_${tlId}`,
            teamLeaderId: tlId,
            enabled: false,
            negativeBalanceThreshold: 0,
            lowBalanceThreshold: 250,
            maxCallsPerDay: 20,
            callTimeStart: '10:00',
            callTimeEnd: '18:00'
        };

        const updated = { ...current, enabled };
        setAutoConfigs(prev => ({ ...prev, [tlId]: updated }));

        const ok = await OutboundCallService.saveAutoCallConfig(updated);
        if (ok) {
            toast.success(`Auto-calling ${enabled ? 'ENABLED' : 'DISABLED'} for TL`);
        } else {
            toast.error('Failed to update config');
        }
    };

    return (
        <PageTransition className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-violet-900/90 via-indigo-900/90 to-slate-900 text-white shadow-2xl border border-white/10 relative overflow-hidden">
                <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-inner">
                        <Bot className="w-7 h-7 text-violet-300 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black tracking-tight">AI Outbound Call Center</h1>
                            <GradientBadge variant="violet">v2.0 ElevenLabs + n8n</GradientBadge>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                            Automated AI Voice Calling system targeting negative balance (&lt; ₹0) and low balance (&lt; ₹250) riders.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Logs
                    </button>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-violet-500/10 text-violet-600">
                        <PhoneCall size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Calls Made</p>
                        <h3 className="text-2xl font-black text-foreground mt-0.5">
                            <AnimatedCounter value={callLogs.length} />
                        </h3>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-red-500/10 text-red-600">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Negative Wallet Target (&lt;₹0)</p>
                        <h3 className="text-2xl font-black text-foreground mt-0.5">
                            <AnimatedCounter value={targetedAnalysis.negativeCount} />
                        </h3>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Low Balance Target (&lt;₹250)</p>
                        <h3 className="text-2xl font-black text-foreground mt-0.5">
                            <AnimatedCounter value={targetedAnalysis.lowBalanceCount} />
                        </h3>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
                        <Zap size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Auto-Call TLs</p>
                        <h3 className="text-2xl font-black text-foreground mt-0.5">
                            <AnimatedCounter value={Object.values(autoConfigs).filter(c => c.enabled).length} />
                        </h3>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-border gap-2">
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-5 py-3 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all ${
                        activeTab === 'history'
                            ? 'border-primary text-primary bg-primary/5'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <History size={16} /> Call Execution History ({callLogs.length})
                </button>

                <button
                    onClick={() => setActiveTab('bulk')}
                    className={`px-5 py-3 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all ${
                        activeTab === 'bulk'
                            ? 'border-primary text-primary bg-primary/5'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Play size={16} /> Bulk AI Call Dispatch
                </button>

                <button
                    onClick={() => setActiveTab('auto_config')}
                    className={`px-5 py-3 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all ${
                        activeTab === 'auto_config'
                            ? 'border-primary text-primary bg-primary/5'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Settings size={16} /> TL Auto-Call Permissions & Rules
                </button>
            </div>

            {/* TAB 1: Call Execution History */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border/80">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                placeholder="Search by rider name, mobile..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-input rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <select
                                value={scenarioFilter}
                                onChange={e => setScenarioFilter(e.target.value)}
                                className="px-3 py-2 border border-input rounded-xl text-xs bg-background font-semibold"
                            >
                                <option value="all">All Call Scenarios</option>
                                <option value="negative_balance">Overdue Debt Recovery</option>
                                <option value="low_balance">Low Balance Warning</option>
                                <option value="custom_reminder">Custom Voice Note</option>
                            </select>

                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="px-3 py-2 border border-input rounded-xl text-xs bg-background font-semibold"
                            >
                                <option value="all">All Statuses</option>
                                <option value="completed">Completed</option>
                                <option value="initiated">Initiated</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>
                    </div>

                    {/* Log Table */}
                    <div className="rounded-2xl bg-card border border-border/80 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-extrabold tracking-wider border-b border-border">
                                    <tr>
                                        <th className="p-4">Rider Info</th>
                                        <th className="p-4">Call Scenario</th>
                                        <th className="p-4">Wallet Balance at Call</th>
                                        <th className="p-4">Triggered By</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Date & Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center p-8 text-muted-foreground">
                                                No AI Call logs found matching search filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-extrabold text-foreground">{log.riderName}</div>
                                                    <div className="text-[11px] text-muted-foreground font-mono">{log.mobileNumber}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-bold capitalize">
                                                        {log.callScenario.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono font-extrabold">
                                                    <span className={log.walletAmountAtCall < 0 ? 'text-red-600' : 'text-amber-600'}>
                                                        ₹{log.walletAmountAtCall.toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-semibold text-foreground">{log.triggeredByName}</span>
                                                </td>
                                                <td className="p-4">
                                                    {log.status === 'completed' ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                                                            <CheckCircle2 size={12} /> Dispatched
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full font-bold">
                                                            <XCircle size={12} /> Failed
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-muted-foreground font-mono">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Bulk AI Call Dispatch */}
            {activeTab === 'bulk' && (
                <div className="p-6 rounded-3xl bg-card border border-border/80 space-y-6 shadow-sm">
                    <div>
                        <h3 className="text-lg font-black text-foreground">Bulk AI Call Dispatcher</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Target riders automatically using ElevenLabs AI Voice agent based on wallet thresholds.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            type="button"
                            onClick={() => setSelectedTargetGroup('negative')}
                            className={`p-5 rounded-2xl border text-left transition-all ${
                                selectedTargetGroup === 'negative'
                                    ? 'border-red-500 bg-red-500/5 ring-2 ring-red-500/20'
                                    : 'border-border bg-card hover:bg-muted/30'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <ShieldAlert size={20} className="text-red-500" />
                                <span className="text-xl font-black text-red-600">{targetedAnalysis.negativeCount}</span>
                            </div>
                            <h4 className="font-extrabold text-sm text-foreground">Negative Balance Riders</h4>
                            <p className="text-xs text-muted-foreground mt-1">Riders with wallet amount &lt; ₹0</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedTargetGroup('low')}
                            className={`p-5 rounded-2xl border text-left transition-all ${
                                selectedTargetGroup === 'low'
                                    ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                                    : 'border-border bg-card hover:bg-muted/30'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <AlertTriangle size={20} className="text-amber-500" />
                                <span className="text-xl font-black text-amber-600">{targetedAnalysis.lowBalanceCount}</span>
                            </div>
                            <h4 className="font-extrabold text-sm text-foreground">Low Balance Riders</h4>
                            <p className="text-xs text-muted-foreground mt-1">Riders with wallet amount between ₹0 and ₹249</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedTargetGroup('all')}
                            className={`p-5 rounded-2xl border text-left transition-all ${
                                selectedTargetGroup === 'all'
                                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                    : 'border-border bg-card hover:bg-muted/30'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Bot size={20} className="text-primary" />
                                <span className="text-xl font-black text-primary">{targetedAnalysis.totalTargetedCount}</span>
                            </div>
                            <h4 className="font-extrabold text-sm text-foreground">All Target Criteria</h4>
                            <p className="text-xs text-muted-foreground mt-1">Combined negative balance &amp; low balance riders</p>
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between">
                        <div>
                            <span className="text-xs text-muted-foreground font-semibold">Selected Target Pool:</span>
                            <h4 className="text-sm font-extrabold text-foreground mt-0.5">
                                {selectedTargetGroup === 'negative' ? `${targetedAnalysis.negativeCount} Negative Balance Riders` :
                                    selectedTargetGroup === 'low' ? `${targetedAnalysis.lowBalanceCount} Low Balance Riders` :
                                        `${targetedAnalysis.totalTargetedCount} Total Overdue & Low Balance Riders`}
                            </h4>
                        </div>

                        <button
                            type="button"
                            onClick={handleTriggerBulkCalls}
                            disabled={isTriggeringBulk || targetedAnalysis.totalTargetedCount === 0}
                            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-extrabold text-xs shadow-lg shadow-violet-500/20 hover:opacity-95 disabled:opacity-50 flex items-center gap-2 transition-all"
                        >
                            <PhoneCall size={16} />
                            {isTriggeringBulk ? 'Dispatching Calls...' : 'Start Bulk AI Call Dispatch'}
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 3: TL Auto-Call Permissions & Rules */}
            {activeTab === 'auto_config' && (
                <div className="p-6 rounded-3xl bg-card border border-border/80 space-y-6 shadow-sm">
                    <div>
                        <h3 className="text-lg font-black text-foreground">Team Leader Auto-Call Rules</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Control which Team Leaders have permission for automated background calls for their riders.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {teamLeaders.map(tl => {
                            const config = autoConfigs[tl.id] || { enabled: false, maxCallsPerDay: 20 };
                            return (
                                <div key={tl.id} className="p-5 rounded-2xl bg-muted/30 border border-border flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                                            {(tl.fullName || tl.username || tl.email || 'T').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-sm text-foreground">{tl.fullName || tl.username || tl.email || 'Team Leader'}</h4>
                                            <p className="text-xs text-muted-foreground">@{tl.username || 'user'} · Max {config.maxCallsPerDay || 20} calls/day</p>
                                        </div>
                                    </div>

                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.enabled}
                                            onChange={e => handleToggleAutoConfig(tl.id, e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </PageTransition>
    );
};

export default AICallCenter;
