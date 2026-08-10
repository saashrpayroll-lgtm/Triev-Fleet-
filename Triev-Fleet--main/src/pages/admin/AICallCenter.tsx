import React, { useEffect, useState, useMemo } from 'react';
import { Bot, PhoneCall, History, Settings, Play, ShieldAlert, AlertTriangle, Search, RefreshCw, CheckCircle2, XCircle, Zap, Trash2, Eye, FileText, Repeat, Volume2, Clock, Shield, Activity, Radio, Sparkles, PhoneOutgoing } from 'lucide-react';
import { OutboundCallService, CallScenario } from '@/services/OutboundCallService';
import { AutoCallScheduler } from '@/services/AutoCallScheduler';
import { AICallLog, AutoCallConfig, GlobalCallingRules, Rider, User } from '@/types';
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

    // Webhook & Integration status
    const [webhookInfo, setWebhookInfo] = useState(OutboundCallService.getWebhookInfo());
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);

    // Global Manual Campaign Execution State
    const [isExecutingCampaign, setIsExecutingCampaign] = useState(false);

    // Filter & Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [scenarioFilter, setScenarioFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Call Execution History Multi-Select & Delete
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

    // AI Transcript & Details Modal State
    const [viewingTranscriptLog, setViewingTranscriptLog] = useState<AICallLog | null>(null);

    // Per-Rider Call History Modal State
    const [viewingRiderHistoryRider, setViewingRiderHistoryRider] = useState<Rider | null>(null);
    const [riderHistoryLogs, setRiderHistoryLogs] = useState<AICallLog[]>([]);
    const [loadingRiderHistory, setLoadingRiderHistory] = useState(false);

    // Admin Global Rules State (Daily Call Limits & Loop System)
    const [globalRules, setGlobalRules] = useState<GlobalCallingRules>({
        maxCallsPerRiderDaily: 2,
        autoRetryHours: 4,
        enableLoopSystem: true,
        allowedTimeStart: '10:00',
        allowedTimeEnd: '18:00'
    });
    const [isSavingRules, setIsSavingRules] = useState(false);

    // Bulk Triggering state
    const [isTriggeringBulk, setIsTriggeringBulk] = useState(false);

    // Single call trigger modal state
    const [callingRider, setCallingRider] = useState<Rider | null>(null);
    const [callScenarioModal, setCallScenarioModal] = useState<CallScenario>('negative_balance');
    const [customPromptNote, setCustomPromptNote] = useState('');
    const [isTriggeringSingle, setIsTriggeringSingle] = useState(false);

    // Multi-select state for Targeted Riders
    const [selectedRiderIds, setSelectedRiderIds] = useState<Set<string>>(new Set());
    const [targetedCategoryFilter, setTargetedCategoryFilter] = useState<'all' | 'negative' | 'low'>('all');
    const [targetedTLFilter, setTargetedTLFilter] = useState<string>('all');
    const [targetedSearchQuery, setTargetedSearchQuery] = useState<string>('');

    // Load initial data
    const loadData = async () => {
        setLoading(true);
        try {
            const [logsData, ridersRes, usersRes] = await Promise.all([
                OutboundCallService.fetchCallLogs(150),
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

            // Fetch Global Rules
            const rules = await OutboundCallService.fetchGlobalCallingRules();
            if (rules) setGlobalRules(rules);

            // Refresh Webhook info
            setWebhookInfo(OutboundCallService.getWebhookInfo());

        } catch (e) {
            console.error('Failed to load AI Call Center data:', e);
            toast.error('Failed to load call logs');
        } finally {
            setLoading(false);
        }
    };

    // Test Webhook Connection
    const handleTestWebhook = async () => {
        setIsTestingWebhook(true);
        toast.info('Pinging n8n Outbound Webhook...');
        try {
            const res = await OutboundCallService.testWebhookConnection();
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        } catch (e: any) {
            toast.error('Webhook ping failed: ' + e.message);
        } finally {
            setIsTestingWebhook(false);
        }
    };

    // Run Manual Global Auto-Call Campaign
    const handleRunManualCampaign = async () => {
        const eligible = OutboundCallService.getEligibleTargetRiders(riders);
        if (eligible.totalTargeted.length === 0) {
            toast.warning('No eligible riders found for AI calling (Wallet balance ≥ ₹250 for all riders).');
            return;
        }

        setIsExecutingCampaign(true);
        toast.info(`Starting instant AI Call Campaign for ${eligible.totalTargeted.length} targeted riders...`);

        try {
            const res = await AutoCallScheduler.runAutoCallForAllTargetedRiders(
                riders,
                userData?.fullName || 'Admin Manual Trigger'
            );

            toast.success(`Campaign Completed! ${res.dispatched} of ${res.total} AI calls successfully dispatched to n8n.`);
            await loadData();
        } catch (e: any) {
            toast.error('Campaign encountered an error: ' + (e.message || e));
        } finally {
            setIsExecutingCampaign(false);
        }
    };

    // Single call dispatch
    const handleTriggerSingleCall = async () => {
        if (!callingRider) return;
        setIsTriggeringSingle(true);

        try {
            const res = await OutboundCallService.triggerCall({
                riderId: callingRider.id,
                riderName: callingRider.riderName,
                mobileNumber: callingRider.mobileNumber,
                walletAmount: callingRider.walletAmount,
                callScenario: callScenarioModal,
                customNote: customPromptNote || undefined,
                triggeredBy: userData?.fullName || 'Admin',
                triggeredById: userData?.id
            });

            if (res.success) {
                toast.success(`AI Call Dispatched to ${callingRider.riderName} (${res.callId})`);
                setCallingRider(null);
                setCustomPromptNote('');
                await loadData();
            } else {
                toast.error(res.message || 'Call failed to dispatch');
            }
        } catch (err: any) {
            toast.error('Failed to dispatch AI call: ' + (err.message || err));
        } finally {
            setIsTriggeringSingle(false);
        }
    };

    // Filtered Targeted Riders List
    const filteredTargetedRiders = useMemo(() => {
        const list = Array.isArray(riders) ? riders : [];
        return list.filter(r => {
            const isNegative = Number(r.walletAmount || 0) < 0;
            const isLow = Number(r.walletAmount || 0) >= 0 && Number(r.walletAmount || 0) < 250;
            if (!isNegative && !isLow) return false;
            if (r.status !== 'active') return false;

            // Category filter
            if (targetedCategoryFilter === 'negative' && !isNegative) return false;
            if (targetedCategoryFilter === 'low' && !isLow) return false;

            // TL filter
            if (targetedTLFilter !== 'all' && r.teamLeaderId !== targetedTLFilter) return false;

            // Search query
            const q = targetedSearchQuery.toLowerCase();
            const matchesSearch = !q || (r.riderName || '').toLowerCase().includes(q) ||
                (r.mobileNumber || '').includes(q) ||
                (r.trievId || '').toLowerCase().includes(q);

            return matchesSearch;
        });
    }, [riders, targetedCategoryFilter, targetedTLFilter, targetedSearchQuery]);

    // Toggle single rider selection
    const toggleSelectRider = (id: string) => {
        setSelectedRiderIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Toggle select all filtered riders
    const toggleSelectAll = () => {
        if (selectedRiderIds.size === filteredTargetedRiders.length) {
            setSelectedRiderIds(new Set());
        } else {
            setSelectedRiderIds(new Set(filteredTargetedRiders.map(r => r.id)));
        }
    };

    // Handle Bulk Call for Selected Riders
    const handleTriggerSelectedBulk = async () => {
        const selectedList = riders.filter(r => selectedRiderIds.has(r.id));
        if (selectedList.length === 0) {
            toast.warning('Please select at least one rider to call.');
            return;
        }

        setIsTriggeringBulk(true);
        toast.info(`Initiating bulk AI calls to ${selectedList.length} selected riders...`);

        try {
            const res = await OutboundCallService.triggerBulkCalls(
                selectedList.map(r => ({
                    id: r.id,
                    riderName: r.riderName,
                    mobileNumber: r.mobileNumber,
                    walletAmount: r.walletAmount
                })),
                'negative_balance',
                userData?.fullName || 'Admin',
                userData?.id
            );

            toast.success(`Dispatched ${res.dispatched} of ${res.total} AI calls successfully.`);
            setSelectedRiderIds(new Set());
            await loadData();
        } catch (e) {
            toast.error('Bulk call dispatch encountered errors.');
        } finally {
            setIsTriggeringBulk(false);
        }
    };

    // Delete single call log
    const handleDeleteSingleLog = async (id: string) => {
        const ok = await OutboundCallService.deleteCallLog(id);
        if (ok) {
            toast.success('Call log deleted successfully');
            setSelectedLogIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            await loadData();
        } else {
            toast.error('Failed to delete call log');
        }
    };

    // Bulk delete call logs
    const handleDeleteSelectedLogs = async () => {
        if (selectedLogIds.size === 0) return;
        const ids = Array.from(selectedLogIds);
        const ok = await OutboundCallService.deleteBulkCallLogs(ids);
        if (ok) {
            toast.success(`Deleted ${ids.length} call logs successfully`);
            setSelectedLogIds(new Set());
            await loadData();
        } else {
            toast.error('Failed to delete selected call logs');
        }
    };

    // Select/Deselect single log checkbox
    const toggleSelectLog = (id: string) => {
        setSelectedLogIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Select/Deselect all filtered logs
    const toggleSelectAllLogs = () => {
        if (selectedLogIds.size === filteredLogs.length) {
            setSelectedLogIds(new Set());
        } else {
            setSelectedLogIds(new Set(filteredLogs.map(l => l.id)));
        }
    };

    // Open rider call history modal
    const handleOpenRiderHistory = async (rider: Rider) => {
        setViewingRiderHistoryRider(rider);
        setLoadingRiderHistory(true);
        try {
            const logs = await OutboundCallService.fetchRiderCallHistory(rider.id);
            setRiderHistoryLogs(logs);
        } catch (e) {
            toast.error('Failed to fetch rider call history');
        } finally {
            setLoadingRiderHistory(false);
        }
    };

    // Save global calling rules
    const handleSaveGlobalRules = async () => {
        setIsSavingRules(true);
        const ok = await OutboundCallService.saveGlobalCallingRules(globalRules);
        setIsSavingRules(false);
        if (ok) {
            toast.success('Global AI Calling Rules saved successfully!');
        } else {
            toast.error('Failed to save rules');
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
        
        const totalNegativeAmount = negativeRiders.reduce((acc, r) => acc + Math.abs(Number(r.walletAmount || 0)), 0);

        return {
            negativeCount: negativeRiders.length,
            lowBalanceCount: lowBalanceRiders.length,
            totalTargetedCount: negativeRiders.length + lowBalanceRiders.length,
            totalNegativeAmount,
            negativeRiders,
            lowBalanceRiders,
            totalTargeted: [...negativeRiders, ...lowBalanceRiders]
        };
    }, [riders]);

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
            toast.success(`Auto-calling ${enabled ? 'ENABLED' : 'DISABLED'} for Team Leader`);
        } else {
            toast.error('Failed to update config');
        }
    };

    return (
        <PageTransition className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Main Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-violet-950 via-indigo-900 to-slate-900 text-white shadow-2xl border border-white/10 relative overflow-hidden">
                <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-violet-600/20 backdrop-blur-xl border border-violet-400/30 flex items-center justify-center shadow-inner">
                        <Bot className="w-8 h-8 text-violet-300 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black tracking-tight">AI Outbound Call Center</h1>
                            <GradientBadge variant="violet">v2.0 ElevenLabs + n8n</GradientBadge>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                            Automated AI Voice Calling system for Overdue Debt Recovery (&lt; ₹0) and Low Balance Warnings (&lt; ₹250).
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    <button
                        onClick={handleRunManualCampaign}
                        disabled={isExecutingCampaign}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50"
                    >
                        <PhoneOutgoing size={15} className={isExecutingCampaign ? 'animate-bounce' : ''} />
                        {isExecutingCampaign ? 'Executing Campaign...' : 'Launch Auto-Call Campaign'}
                    </button>

                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Logs
                    </button>
                </div>
            </div>

            {/* Integration & Webhook Health Strip */}
            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <Activity size={16} className="text-violet-500" />
                        <span className="font-bold text-muted-foreground">n8n Webhook:</span>
                        {webhookInfo.isWebhookConfigured ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-extrabold text-[11px] border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Active &amp; Connected
                            </span>
                        ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-extrabold text-[11px] border border-amber-500/20 flex items-center gap-1">
                                <AlertTriangle size={12} /> Default / Fallback Mode
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Radio size={16} className="text-indigo-500" />
                        <span className="font-bold text-muted-foreground">ElevenLabs Voice Agent:</span>
                        {webhookInfo.isAgentConfigured ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-extrabold text-[11px] border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Configured
                            </span>
                        ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-[11px]">
                                Default Agent ID
                            </span>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook}
                    className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                    <Sparkles size={14} className={isTestingWebhook ? 'animate-spin' : ''} />
                    {isTestingWebhook ? 'Pinging Webhook...' : 'Test Webhook Ping'}
                </button>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-violet-500/10 text-violet-600">
                        <PhoneCall size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Calls Initiated</p>
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
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overdue Defaulters (&lt;₹0)</p>
                        <h3 className="text-2xl font-black text-foreground mt-0.5 flex items-baseline gap-2">
                            <AnimatedCounter value={targetedAnalysis.negativeCount} />
                            <span className="text-xs font-mono font-bold text-red-500">₹{targetedAnalysis.totalNegativeAmount.toLocaleString('en-IN')}</span>
                        </h3>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Low Balance Targets (&lt;₹250)</p>
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
                    <Play size={16} /> Targeted Riders &amp; AI Dispatch ({filteredTargetedRiders.length})
                </button>

                <button
                    onClick={() => setActiveTab('auto_config')}
                    className={`px-5 py-3 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all ${
                        activeTab === 'auto_config'
                            ? 'border-primary text-primary bg-primary/5'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Settings size={16} /> TL Auto-Call Permissions &amp; Rules
                </button>
            </div>

            {/* TAB 1: Call Execution History */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Filters & Bulk Controls */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 rounded-3xl bg-card border border-border/80 shadow-sm">
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search by rider name, mobile..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-input rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                                />
                            </div>

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
                                <option value="completed">Completed / Connected</option>
                                <option value="initiated">Initiated</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>

                        {/* Bulk Delete Call Logs Button */}
                        {selectedLogIds.size > 0 && (
                            <button
                                type="button"
                                onClick={handleDeleteSelectedLogs}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow flex items-center gap-1.5 transition-all shrink-0"
                            >
                                <Trash2 size={14} /> Delete Selected ({selectedLogIds.size}) Logs
                            </button>
                        )}
                    </div>

                    {/* Log Table */}
                    <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-extrabold tracking-wider border-b border-border">
                                    <tr>
                                        <th className="p-4 w-10">
                                            <input
                                                type="checkbox"
                                                checked={filteredLogs.length > 0 && selectedLogIds.size === filteredLogs.length}
                                                onChange={toggleSelectAllLogs}
                                                className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                            />
                                        </th>
                                        <th className="p-4">Rider Details</th>
                                        <th className="p-4">Call Scenario</th>
                                        <th className="p-4">Wallet Balance</th>
                                        <th className="p-4">Triggered By</th>
                                        <th className="p-4">Status &amp; Connection</th>
                                        <th className="p-4">Date &amp; Time</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center p-12 text-muted-foreground">
                                                No AI Call logs found matching search filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map(log => {
                                            const isSelected = selectedLogIds.has(log.id);
                                            const isSuccess = log.status === 'completed' || log.status === 'success';
                                            const riderObj = riders.find(r => r.id === log.riderId);

                                            return (
                                                <tr key={log.id} className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                                                    <td className="p-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectLog(log.id)}
                                                            className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => riderObj && handleOpenRiderHistory(riderObj)}
                                                            className="font-extrabold text-foreground hover:text-primary transition-colors text-left group flex items-center gap-1"
                                                        >
                                                            {log.riderName} <History size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                                        </button>
                                                        <div className="text-[11px] font-mono text-indigo-500 font-bold">{log.mobileNumber}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="font-bold capitalize px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px]">
                                                            {log.callScenario.replace(/_/g, ' ')}
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
                                                        {isSuccess ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full font-bold text-[11px]">
                                                                <CheckCircle2 size={12} /> Connected
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-red-600 bg-red-500/10 px-2.5 py-1 rounded-full font-bold text-[11px]">
                                                                <XCircle size={12} /> Failed / Unanswered
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-muted-foreground font-mono text-[11px]">
                                                        {new Date(log.createdAt).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right space-x-1">
                                                        <button
                                                            onClick={() => setViewingTranscriptLog(log)}
                                                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                                                            title="View AI Transcript & Conversation"
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSingleLog(log.id)}
                                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                                                            title="Delete Call Log"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Targeted Riders & AI Dispatch */}
            {activeTab === 'bulk' && (
                <div className="space-y-6">
                    {/* Advance Filters Strip */}
                    <div className="p-5 rounded-3xl bg-card border border-border/80 space-y-4 shadow-sm">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black text-foreground">Targeted Defaulter &amp; Low Balance Riders</h3>
                                <p className="text-xs text-muted-foreground">Select individual riders or filter by category to trigger 1-on-1 or bulk AI voice calls.</p>
                            </div>

                            {/* Bulk trigger button for selected checkboxes */}
                            <button
                                type="button"
                                onClick={handleTriggerSelectedBulk}
                                disabled={isTriggeringBulk || selectedRiderIds.size === 0}
                                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-extrabold text-xs shadow-lg shadow-violet-500/20 hover:opacity-95 disabled:opacity-50 flex items-center gap-2 transition-all shrink-0"
                            >
                                <PhoneCall size={15} />
                                {isTriggeringBulk ? 'Dispatching...' : `Call Selected (${selectedRiderIds.size}) Riders`}
                            </button>
                        </div>

                        {/* Search + Dropdowns */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search by rider name, mobile, Triev ID..."
                                    value={targetedSearchQuery}
                                    onChange={e => setTargetedSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-input rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                                />
                            </div>

                            {/* Category Filter */}
                            <select
                                value={targetedCategoryFilter}
                                onChange={e => setTargetedCategoryFilter(e.target.value as any)}
                                className="px-3 py-2 border border-input rounded-xl text-xs bg-background font-semibold"
                            >
                                <option value="all">All Target Criteria ({targetedAnalysis.totalTargetedCount})</option>
                                <option value="negative">Negative Balance Only (&lt; ₹0) [{targetedAnalysis.negativeCount}]</option>
                                <option value="low">Low Balance Only (₹0 - ₹249) [{targetedAnalysis.lowBalanceCount}]</option>
                            </select>

                            {/* TL Filter */}
                            <select
                                value={targetedTLFilter}
                                onChange={e => setTargetedTLFilter(e.target.value)}
                                className="px-3 py-2 border border-input rounded-xl text-xs bg-background font-semibold"
                            >
                                <option value="all">All Team Leaders</option>
                                {teamLeaders.map(tl => (
                                    <option key={tl.id} value={tl.id}>
                                        {tl.fullName || tl.username || tl.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table of Targeted Riders */}
                    <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-extrabold tracking-wider border-b border-border">
                                    <tr>
                                        <th className="p-4 w-10">
                                            <input
                                                type="checkbox"
                                                checked={filteredTargetedRiders.length > 0 && selectedRiderIds.size === filteredTargetedRiders.length}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                            />
                                        </th>
                                        <th className="p-4">Rider Details</th>
                                        <th className="p-4">Mobile Number</th>
                                        <th className="p-4">Wallet Balance</th>
                                        <th className="p-4">Assigned Team Leader</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {filteredTargetedRiders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center p-12 text-muted-foreground">
                                                No targeted riders match the current filter options.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTargetedRiders.map(r => {
                                            const isSelected = selectedRiderIds.has(r.id);
                                            const tl = teamLeaders.find(t => t.id === r.teamLeaderId);
                                            const isNeg = Number(r.walletAmount || 0) < 0;

                                            return (
                                                <tr key={r.id} className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                                                    <td className="p-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectRider(r.id)}
                                                            className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => handleOpenRiderHistory(r)}
                                                            className="font-extrabold text-foreground hover:text-primary transition-colors text-left group flex items-center gap-1.5"
                                                        >
                                                            {r.riderName} <History size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                                        </button>
                                                        <div className="text-[10px] text-muted-foreground font-mono">{r.trievId || r.id}</div>
                                                    </td>
                                                    <td className="p-4 font-mono font-bold text-indigo-500">
                                                        {r.mobileNumber}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`inline-block px-2.5 py-1 rounded-lg font-mono font-extrabold text-xs ${
                                                            isNeg ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                        }`}>
                                                            ₹{Number(r.walletAmount || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-medium text-foreground">
                                                        {tl ? (tl.fullName || tl.username || tl.email) : 'Unassigned'}
                                                    </td>
                                                    <td className="p-4 text-right space-x-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenRiderHistory(r)}
                                                            className="px-2.5 py-1.5 rounded-xl border border-input text-foreground hover:bg-muted font-bold text-[11px] transition-all inline-flex items-center gap-1"
                                                            title="View Full Call History for this Rider"
                                                        >
                                                            <History size={12} /> History
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCallingRider(r)}
                                                            className="px-3 py-1.5 rounded-xl bg-violet-600 text-white font-extrabold text-[11px] shadow hover:bg-violet-700 transition-all inline-flex items-center gap-1.5"
                                                        >
                                                            <PhoneCall size={12} /> Call AI Voice
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: TL Auto-Call Permissions & Admin Rules */}
            {activeTab === 'auto_config' && (
                <div className="space-y-6">
                    {/* Global Admin Calling Rules & Limits */}
                    <div className="p-6 rounded-3xl bg-card border border-border/80 space-y-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                                    <Shield className="text-violet-600" size={18} /> Global Admin Limits &amp; Auto-Retry Loop System
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Enforce maximum daily call limits per rider and configure automated retry loop intervals.
                                </p>
                            </div>
                            <button
                                onClick={handleSaveGlobalRules}
                                disabled={isSavingRules}
                                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow transition-all"
                            >
                                {isSavingRules ? 'Saving...' : 'Save Calling Rules'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <PhoneCall size={14} className="text-amber-500" /> Max Calls Per Rider (Daily Limit):
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={globalRules.maxCallsPerRiderDaily}
                                    onChange={e => setGlobalRules(prev => ({ ...prev, maxCallsPerRiderDaily: Number(e.target.value) || 1 }))}
                                    className="w-full p-2.5 border border-input rounded-xl text-xs bg-background font-mono font-bold"
                                />
                                <p className="text-[10px] text-muted-foreground">Limits AI calls to a single rider to prevent spamming.</p>
                            </div>

                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Repeat size={14} className="text-violet-500" /> Auto-Retry Loop Interval (Hours):
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="48"
                                    value={globalRules.autoRetryHours}
                                    onChange={e => setGlobalRules(prev => ({ ...prev, autoRetryHours: Number(e.target.value) || 4 }))}
                                    className="w-full p-2.5 border border-input rounded-xl text-xs bg-background font-mono font-bold"
                                />
                                <p className="text-[10px] text-muted-foreground">Hours to wait before automatically retrying failed/unanswered calls.</p>
                            </div>

                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Clock size={14} className="text-emerald-500" /> Enable Loop Retry Engine:
                                </label>
                                <div className="pt-1 flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={globalRules.enableLoopSystem}
                                            onChange={e => setGlobalRules(prev => ({ ...prev, enableLoopSystem: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                                    </label>
                                    <span className="text-xs font-extrabold text-foreground">
                                        {globalRules.enableLoopSystem ? 'LOOP ENABLED' : 'LOOP PAUSED'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Automated background loop that retries defaulters until payment is made.</p>
                            </div>
                        </div>
                    </div>

                    {/* Team Leader Auto-Call Permissions */}
                    <div className="p-6 rounded-3xl bg-card border border-border/80 space-y-6 shadow-sm">
                        <div>
                            <h3 className="text-lg font-black text-foreground">Team Leader Auto-Call Permissions</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Grant or revoke permissions for Team Leaders to initiate automated voice campaigns for their assigned riders.
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
                </div>
            )}

            {/* 1-on-1 Call Scenario Modal */}
            {callingRider && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                                <Bot className="text-violet-600" size={20} /> Initiate ElevenLabs AI Call
                            </h3>
                            <button
                                onClick={() => setCallingRider(null)}
                                className="text-muted-foreground hover:text-foreground text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                            <div className="font-extrabold text-sm text-foreground">{callingRider.riderName}</div>
                            <div className="text-xs font-mono text-indigo-500 font-bold">{callingRider.mobileNumber}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Current Wallet: <span className="font-mono font-bold text-red-500">₹{callingRider.walletAmount}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-foreground">Select Call Scenario Script:</label>
                            <select
                                value={callScenarioModal}
                                onChange={e => setCallScenarioModal(e.target.value as CallScenario)}
                                className="w-full p-3 border border-input rounded-xl text-xs bg-background font-semibold"
                            >
                                <option value="negative_balance">Overdue Negative Balance Recovery (Hindi/Hinglish)</option>
                                <option value="low_balance">Low Balance Warning (Below ₹250)</option>
                                <option value="custom_reminder">Custom Prompt Instruction Scenario</option>
                            </select>
                        </div>

                        {callScenarioModal === 'custom_reminder' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground">Custom Prompt Instructions for Voice Agent</label>
                                <textarea
                                    value={customPromptNote}
                                    onChange={(e) => setCustomPromptNote(e.target.value)}
                                    placeholder="Enter custom instructions to pass to ElevenLabs agent..."
                                    rows={3}
                                    className="w-full p-3 border border-input rounded-2xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setCallingRider(null)}
                                className="px-4 py-2.5 rounded-xl border border-input text-xs font-bold hover:bg-muted"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleTriggerSingleCall}
                                disabled={isTriggeringSingle}
                                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-extrabold shadow-lg hover:opacity-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                <PhoneCall size={14} />
                                {isTriggeringSingle ? 'Dispatching Call...' : 'Dispatch AI Voice Call'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Transcript & Details Modal */}
            {viewingTranscriptLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                                <FileText className="text-violet-600" size={20} /> AI Call Conversation Transcript
                            </h3>
                            <button
                                onClick={() => setViewingTranscriptLog(null)}
                                className="text-muted-foreground hover:text-foreground text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Rider</p>
                                <p className="text-xs font-extrabold text-foreground">{viewingTranscriptLog.riderName}</p>
                                <p className="text-[10px] font-mono text-indigo-500 font-bold">{viewingTranscriptLog.mobileNumber}</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Call Status</p>
                                <p className="text-xs font-extrabold text-emerald-600 capitalize">{viewingTranscriptLog.status}</p>
                                <p className="text-[10px] text-muted-foreground">{new Date(viewingTranscriptLog.createdAt).toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Transcript Box */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                                <Volume2 size={14} className="text-violet-500" /> AI Agent Conversation Log:
                            </h4>
                            <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs max-h-48 overflow-y-auto space-y-2 border border-slate-800">
                                <p className="text-violet-400 font-bold">[AI Voice Script]: ElevenLabs Agent ({viewingTranscriptLog.callScenario.replace(/_/g, ' ')})</p>
                                <p className="leading-relaxed">"{viewingTranscriptLog.transcript || 'AI Voice call connected successfully to rider mobile. Conversation recorded.'}"</p>
                                {viewingTranscriptLog.summary && (
                                    <div className="pt-2 border-t border-slate-800 text-emerald-400 font-sans text-[11px] font-semibold">
                                        Summary Outcome: {viewingTranscriptLog.summary}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setViewingTranscriptLog(null)}
                                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow"
                            >
                                Close Transcript
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Per-Rider Call History Modal */}
            {viewingRiderHistoryRider && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-2xl space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                                    <History className="text-violet-600" size={20} /> Rider Call History: {viewingRiderHistoryRider.riderName}
                                </h3>
                                <p className="text-xs text-muted-foreground">Mobile: {viewingRiderHistoryRider.mobileNumber} · Triev ID: {viewingRiderHistoryRider.trievId}</p>
                            </div>
                            <button
                                onClick={() => setViewingRiderHistoryRider(null)}
                                className="text-muted-foreground hover:text-foreground text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Summary metrics for this rider */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                                <p className="text-[10px] font-bold uppercase text-violet-600">Total Calls Triggered</p>
                                <p className="text-xl font-black text-foreground">{riderHistoryLogs.length}</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                <p className="text-[10px] font-bold uppercase text-emerald-600">Connected Calls</p>
                                <p className="text-xl font-black text-foreground">{riderHistoryLogs.filter(l => l.status === 'completed' || l.status === 'success').length}</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                                <p className="text-[10px] font-bold uppercase text-red-600">Failed / Unanswered</p>
                                <p className="text-xl font-black text-foreground">{riderHistoryLogs.filter(l => l.status === 'failed').length}</p>
                            </div>
                        </div>

                        {/* History list */}
                        <div className="max-h-72 overflow-y-auto rounded-2xl border border-border/80 divide-y divide-border/60">
                            {loadingRiderHistory ? (
                                <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading rider call history...</div>
                            ) : riderHistoryLogs.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground">No call history records found for this rider.</div>
                            ) : (
                                riderHistoryLogs.map(log => (
                                    <div key={log.id} className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-extrabold text-xs text-foreground capitalize">{log.callScenario.replace(/_/g, ' ')}</span>
                                                <span className="text-[10px] font-mono text-muted-foreground">₹{log.walletAmountAtCall} Wallet</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()} · By {log.triggeredByName}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {log.status === 'completed' || log.status === 'success' ? (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center gap-1">
                                                    <CheckCircle2 size={10} /> Connected
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 font-bold text-[10px] flex items-center gap-1">
                                                    <XCircle size={10} /> Failed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setViewingRiderHistoryRider(null)}
                                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow"
                            >
                                Close Rider History
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageTransition>
    );
};

export default AICallCenter;
