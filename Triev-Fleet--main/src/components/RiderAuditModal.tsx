import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Search, UserX, Database, FileSpreadsheet, UserCheck } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';
import DataImport from './DataImport';
import { normalizeKey } from '@/utils/importUtils';
import { fetchAllRidersPaginated } from '@/utils/dbUtils';
import { logActivity } from '@/utils/activityLog';
import { getValidHistoricalDate } from '@/utils/dateUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useCityOpsScope } from '@/hooks/useCityOpsScope';
import { User } from '@/types';

interface RiderAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AuditRiderRecord {
    id: string;
    rider_name: string;
    mobile_number: string;
    triev_id: string;
    status: string;
    team_leader_name: string;
    inactivated_at: string | null;
    last_status_change_at?: string | null;
    allotment_date: string | null;
    [key: string]: unknown; // allow extra DB fields
}

interface AuditResult {
    extraRiders: AuditRiderRecord[];
    returningRiders: AuditRiderRecord[];
    matchedCount: number;
    dbCount: number; // Active DB standard count
    sheetCount: number;
}

const RiderAuditModal: React.FC<RiderAuditModalProps> = ({ isOpen, onClose }) => {
    const { userData } = useSupabaseAuth();
    const { tlIds: myTlIds } = useCityOpsScope();
    const isCityOps = userData?.role === 'cityOps';

    const [step, setStep] = useState<'upload' | 'analyzing' | 'results'>('upload');
    const [results, setResults] = useState<AuditResult | null>(null);
    const [selectedExtraIds, setSelectedExtraIds] = useState<Set<string>>(new Set());
    const [selectedReturningIds, setSelectedReturningIds] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);

    // Scope Selectors
    const [managers, setManagers] = useState<User[]>([]);
    const [auditScopeType, setAuditScopeType] = useState<'global' | 'cityOps' | 'rm' | 'tl'>('global');
    const [selectedCityOpsId, setSelectedCityOpsId] = useState<string>('all');
    const [selectedRm, setSelectedRm] = useState<string>('all');
    const [selectedTlId, setSelectedTlId] = useState<string>('all');

    // Search state
    const [searchExtra, setSearchExtra] = useState('');
    const [searchReturning, setSearchReturning] = useState('');

    React.useEffect(() => {
        if (!isOpen || isCityOps) return;
        
        const fetchManagers = async () => {
            const { data } = await supabase.from('users')
                .select('id, fullName:full_name, role, reportingManager:reporting_manager, cityOpsId:city_ops_id')
                .in('role', ['cityOps', 'reportingManager', 'teamLeader']);
            if (data) setManagers(data as unknown as User[]);
        };
        fetchManagers();
    }, [isOpen, isCityOps]);

    if (!isOpen) return null;

    const handleAnalyze = async (sheetData: Record<string, unknown>[]) => {
        setStep('analyzing');
        try {
            let filterObj: { column: string; value: string | string[]; type: 'eq' | 'in' } | undefined = undefined;
            let validIds: string[] = [];

            if (isCityOps) {
                if (myTlIds.length === 0) throw new Error("No team leaders found in your scope to audit.");
                validIds = myTlIds;
            } else if (auditScopeType === 'cityOps' && selectedCityOpsId !== 'all') {
                validIds = managers.filter(m => m.role === 'teamLeader' && m.cityOpsId === selectedCityOpsId).map(m => m.id);
                if (validIds.length === 0) throw new Error("No Team Leaders found active under this City Ops.");
            } else if (auditScopeType === 'rm' && selectedRm !== 'all') {
                validIds = managers.filter(m => m.role === 'teamLeader' && m.reportingManager === selectedRm).map(m => m.id);
                if (validIds.length === 0) throw new Error("No Team Leaders found active under this Reporting Manager.");
            } else if (auditScopeType === 'tl' && selectedTlId !== 'all') {
                validIds = [selectedTlId];
            }

            if (validIds.length > 0) {
                filterObj = { column: 'team_leader_id', type: 'in', value: validIds };
            }

            // 1. Fetch Riders from DB (Active and Inactive) with applied Scope
            const { data: dbRiders, error } = await fetchAllRidersPaginated(
                'id, rider_name, mobile_number, triev_id, status, team_leader_name, inactivated_at, allotment_date',
                filterObj
            );

            if (error) throw error;
            if (!dbRiders) throw new Error("No riders found in database");

            const typedRiders = dbRiders as unknown as AuditRiderRecord[];
            const activeDbRiders = typedRiders.filter(r => r.status === 'active');
            const inactiveDbRiders = typedRiders.filter(r => r.status !== 'active');

            // 2. Normalize Sheet Data
            const sheetIdentifiers = new Set<string>();

            sheetData.forEach(row => {
                const normalizedRow: Record<string, unknown> = {};
                Object.keys(row).forEach(key => {
                    normalizedRow[normalizeKey(key)] = row[key];
                });

                const getValue = (keys: string[]) => {
                    for (const key of keys) {
                        const val = normalizedRow[normalizeKey(key)];
                        if (val !== undefined && val !== null && String(val).trim() !== '') {
                            return String(val).trim();
                        }
                    }
                    return '';
                };

                const trievId = getValue(['Triev ID', 'TrievId', 'ID', 'RiderId']);
                const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone']);
                const mobile = mobileRaw.replace(/[^0-9]/g, '');

                if (trievId) sheetIdentifiers.add(trievId.toLowerCase());
                if (mobile) sheetIdentifiers.add(mobile);
                if (mobile.length > 10) sheetIdentifiers.add(mobile.slice(-10));
            });

            // 3. Compare DB vs Sheet
            const extraRiders: AuditRiderRecord[] = [];
            let matchedCount = 0;

            // Check Active Riders (Are they missing from sheet?)
            activeDbRiders.forEach(dbRider => {
                const dbTrievId = (dbRider.triev_id || '').toLowerCase();
                const dbMobile = (dbRider.mobile_number || '').replace(/[^0-9]/g, '');
                const dbMobile10 = dbMobile.slice(-10);

                let isMatch = false;

                if (dbTrievId && sheetIdentifiers.has(dbTrievId)) isMatch = true;
                else if (dbMobile && sheetIdentifiers.has(dbMobile)) isMatch = true;
                else if (dbMobile10 && sheetIdentifiers.has(dbMobile10)) isMatch = true;

                if (isMatch) matchedCount++;
                else extraRiders.push(dbRider);
            });

            // 4. Find Returning Riders (In INACTIVE DB, but IS in Sheet)
            const returningRiders: AuditRiderRecord[] = [];
            inactiveDbRiders.forEach(dbRider => {
                const dbTrievId = (dbRider.triev_id || '').toLowerCase();
                const dbMobile = (dbRider.mobile_number || '').replace(/[^0-9]/g, '');
                const dbMobile10 = dbMobile.slice(-10);

                let isMatch = false;

                if (dbTrievId && sheetIdentifiers.has(dbTrievId)) isMatch = true;
                else if (dbMobile && sheetIdentifiers.has(dbMobile)) isMatch = true;
                else if (dbMobile10 && sheetIdentifiers.has(dbMobile10)) isMatch = true;

                if (isMatch) returningRiders.push(dbRider);
            });

            setResults({
                extraRiders,
                returningRiders,
                matchedCount,
                dbCount: activeDbRiders.length,
                sheetCount: sheetData.length
            });
            setStep('results');

        } catch (err: unknown) {
            console.error('Audit Analysis Error:', err);
            toast.error((err as Error).message || "Failed to analyze riders");
            setStep('upload');
        }
    };

    const handleDeactivateSelected = async () => {
        if (selectedExtraIds.size === 0) return;
        if (!confirm(`Are you sure you want to DEACTIVATE ${selectedExtraIds.size} riders? They will be marked as 'inactive'.`)) return;

        setIsProcessing(true);
        try {
            let deactivatedCount = 0;
            for (const id of Array.from(selectedExtraIds)) {
                const { error } = await supabase
                    .from('riders')
                    .update({ status: 'inactive', updated_at: new Date().toISOString() })
                    .eq('id', id);

                if (error) throw error;
                deactivatedCount++;
            }

            toast.success(`Successfully initiated deactivation process for ${deactivatedCount} riders`);
            
            // Log the activity
            await logActivity({
                actionType: 'bulkUpdate',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Audit Tool: Deactivated ${deactivatedCount} extra riders`,
                performedBy: userData?.email
            });

            // Update state inline instead of closing the modal
            if (results) {
                setResults({
                    ...results,
                    extraRiders: results.extraRiders.filter(r => !selectedExtraIds.has(r.id)),
                    dbCount: results.dbCount - deactivatedCount
                });
                setSelectedExtraIds(new Set());
            }

        } catch (err: unknown) {
            console.error('Action Failed:', err);
            toast.error((err as Error).message || "Failed to process deactivations");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReactivateSelected = async () => {
        if (selectedReturningIds.size === 0) return;
        if (!confirm(`Are you sure you want to REACTIVATE ${selectedReturningIds.size} returning riders? They will be marked as 'active' and their allotment date will reset to today.`)) return;

        setIsProcessing(true);
        try {
            if (!results) return;
            const ids = Array.from(selectedReturningIds);
            const selectedRiders = results.returningRiders.filter(r => selectedReturningIds.has(r.id));

            await Promise.all(selectedRiders.map(async (rider) => {
                let newAllotmentDate = rider.allotment_date;

                // 15-Day Rule: If inactive for > 15 days, reset allotment date to TODAY
                // We use IST dates for accurate comparison.
                const inactiveDateStr = getValidHistoricalDate(rider.inactivated_at || rider.last_status_change_at);
                const nowISTStr = getValidHistoricalDate(new Date().toISOString());

                if (inactiveDateStr && nowISTStr) {
                    const inactiveIST = new Date(inactiveDateStr).getTime();
                    const nowIST = new Date(nowISTStr).getTime();
                    const daysDiff = (nowIST - inactiveIST) / (1000 * 3600 * 24);

                    if (daysDiff > 15) {
                        newAllotmentDate = new Date().toISOString(); // Give new allotment timestamp
                    }
                    // If <= 15 days, newAllotmentDate retains the old allotment_date
                } else if (!rider.allotment_date) {
                    // Fallback only if no allotment date existed at all
                    newAllotmentDate = new Date().toISOString();
                }

                const { error } = await supabase
                    .from('riders')
                    .update({
                        status: 'active',
                        updated_at: new Date().toISOString(),
                        allotment_date: newAllotmentDate,
                        inactivated_at: null, // Clear inactivation date
                        last_status_change_at: new Date().toISOString()
                    })
                    .eq('id', rider.id);

                if (error) throw error;
            }));

            toast.success(`Successfully reactivated ${ids.length} riders.`);

            await logActivity({
                actionType: 'bulkUpdate',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Audit Tool: Reactivated ${ids.length} returning riders`,
                performedBy: userData?.email
            });

            if (results) {
                setResults({
                    ...results,
                    returningRiders: results.returningRiders.filter(r => !selectedReturningIds.has(r.id)),
                    matchedCount: results.matchedCount + ids.length,
                    dbCount: results.dbCount + ids.length
                });
                setSelectedReturningIds(new Set());
            }

        } catch (err: unknown) {
            console.error("Reactivation Failed:", err);
            toast.error("Failed to reactivate riders.");
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleSelectAllExtra = () => {
        if (!results) return;
        const filtered = results.extraRiders.filter(r =>
            r.rider_name?.toLowerCase().includes(searchExtra.toLowerCase()) ||
            r.team_leader_name?.toLowerCase().includes(searchExtra.toLowerCase())
        );
        if (selectedExtraIds.size === filtered.length && filtered.length > 0) {
            setSelectedExtraIds(new Set());
        } else {
            setSelectedExtraIds(new Set(filtered.map(r => r.id)));
        }
    };

    const toggleSelectAllReturning = () => {
        if (!results) return;
        const filtered = results.returningRiders.filter(r =>
            r.rider_name?.toLowerCase().includes(searchReturning.toLowerCase())
        );
        if (selectedReturningIds.size === filtered.length && filtered.length > 0) {
            setSelectedReturningIds(new Set());
        } else {
            setSelectedReturningIds(new Set(filtered.map(r => r.id)));
        }
    };

    // Helpers to calculate 15-day rule for UI
    const getReactivationDetails = (inactivatedAt: string | null, lastStatusChangeAt?: string | null) => {
        const inactiveDateStr = getValidHistoricalDate(inactivatedAt || lastStatusChangeAt);
        const nowISTStr = getValidHistoricalDate(new Date().toISOString());

        if (!inactiveDateStr || !nowISTStr) return { isWithin15Days: false, text: "New Allotment Date" };

        const inactiveIST = new Date(inactiveDateStr).getTime();
        const nowIST = new Date(nowISTStr).getTime();
        const daysDiff = (nowIST - inactiveIST) / (1000 * 3600 * 24);

        return {
            isWithin15Days: daysDiff <= 15,
            text: daysDiff <= 15 ? "Retains Old Date" : "New Allotment Date",
            days: Math.floor(daysDiff)
        };
    };


    return (
        <div className="fixed z-[20000] inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500"></div>
                    <div className="flex justify-between items-center p-6 border-b bg-muted/10">
                        <div>
                            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight">
                                <div className="p-2 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl">
                                    <Search size={22} />
                                </div>
                                Audit & Sync Check
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1 ml-12">Identify missing vs returning riders directly from your Master Sheet</p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-muted/50 hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto">
                        {step === 'upload' && (
                            <div className="space-y-6">
                                {isCityOps ? (
                                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-5 rounded-2xl flex items-start gap-4">
                                        <div className="p-2.5 bg-amber-500/20 rounded-xl">
                                            <AlertTriangle className="text-amber-500" size={24} />
                                        </div>
                                        <div>
                                            <p className="font-black text-amber-600/90 text-lg">Secure Scope Locking</p>
                                            <p className="text-sm text-amber-700/80 mt-1.5 leading-relaxed">
                                                Your audit scope is permanently restricted to your active Team Leaders. You can safely upload imports; the system guarantees out-of-scope riders cannot be falsely flagged or deactivated.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-slate-900 shadow-sm border border-border p-6 rounded-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
                                        
                                        <div className="relative">
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                                                    <Database size={18} />
                                                </div>
                                                <h3 className="font-bold text-lg">Define Database Context</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-5 pl-11">Bound the audit query scope to prevent false-negative matching.</p>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Primary Scope</label>
                                                    <select
                                                        value={auditScopeType}
                                                        onChange={e => {
                                                            setAuditScopeType(e.target.value as 'global' | 'cityOps' | 'rm' | 'tl');
                                                            setSelectedCityOpsId('all');
                                                            setSelectedRm('all');
                                                            setSelectedTlId('all');
                                                        }}
                                                        className="w-full text-sm p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                                                    >
                                                        <option value="global">Entire Company Database</option>
                                                        <option value="cityOps">Specific City Ops Territory</option>
                                                        <option value="rm">Specific Reporting Manager</option>
                                                        <option value="tl">Specific Team Leader</option>
                                                    </select>
                                                </div>

                                                {auditScopeType === 'cityOps' && (
                                                    <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Target City Ops</label>
                                                        <select
                                                            value={selectedCityOpsId}
                                                            onChange={e => setSelectedCityOpsId(e.target.value)}
                                                            className="w-full text-sm p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500/50 transition-all font-medium"
                                                        >
                                                            <option value="all">Select City Ops...</option>
                                                            {managers.filter(m => m.role === 'cityOps').map(co => (
                                                                <option key={co.id} value={co.id}>{co.fullName}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                
                                                {auditScopeType === 'rm' && (
                                                    <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Target Manager</label>
                                                        <select
                                                            value={selectedRm}
                                                            onChange={e => setSelectedRm(e.target.value)}
                                                            className="w-full text-sm p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500/50 transition-all font-medium"
                                                        >
                                                            <option value="all">Select Group RM...</option>
                                                            {managers.filter(m => m.role === 'reportingManager').map(rm => (
                                                                <option key={rm.id} value={rm.fullName}>{rm.fullName}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                
                                                {auditScopeType === 'tl' && (
                                                    <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Target Direct TL</label>
                                                        <select
                                                            value={selectedTlId}
                                                            onChange={e => setSelectedTlId(e.target.value)}
                                                            className="w-full text-sm p-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500/50 transition-all font-medium"
                                                        >
                                                            <option value="all">Select Team Leader...</option>
                                                            {managers.filter(m => m.role === 'teamLeader').map(tl => (
                                                                <option key={tl.id} value={tl.id}>{tl.fullName}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 flex gap-4 text-sm text-indigo-800 dark:text-indigo-300">
                                    <div className="shrink-0 pt-0.5"><AlertTriangle size={20} className="text-indigo-500" /></div>
                                    <div>
                                        <p className="font-bold">How this works:</p>
                                        <ul className="list-disc list-inside mt-1 space-y-1">
                                            <li>Upload your latest <strong>Master Rider Sheet</strong>.</li>
                                            <li>System compares it with <strong>Riders in Database</strong>.</li>
                                            <li>Finds active riders who are <strong>MISSING</strong> from your sheet (Extra).</li>
                                            <li>Finds inactive/deleted riders who are <strong>BACK</strong> on your sheet (Returning).</li>
                                        </ul>
                                    </div>
                                </div>
                                <h3 className="font-semibold text-lg">Step 1: Upload Master Sheet</h3>
                                <DataImport mode="rider" onImport={handleAnalyze} />
                            </div>
                        )}

                        {step === 'analyzing' && (
                            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-lg font-medium text-muted-foreground">Analyzing Database vs Sheet...</p>
                            </div>
                        )}

                        {step === 'results' && results && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-blue-50/50 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex flex-col justify-center relative overflow-hidden group">
                                        <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:scale-110 transition-transform duration-500">
                                            <Database size={80} />
                                        </div>
                                        <div className="text-blue-600 dark:text-blue-400 text-sm font-bold uppercase tracking-wider mb-2 z-10">Active System Riders</div>
                                        <div className="text-4xl font-black text-foreground z-10 flex items-center gap-3">
                                            {results.dbCount}
                                        </div>
                                    </div>
                                    <div className="bg-purple-50/50 dark:bg-purple-950/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-900/50 flex flex-col justify-center relative overflow-hidden group">
                                        <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:scale-110 transition-transform duration-500">
                                            <FileSpreadsheet size={80} />
                                        </div>
                                        <div className="text-purple-600 dark:text-purple-400 text-sm font-bold uppercase tracking-wider mb-2 z-10">Uploaded Sheet Rows</div>
                                        <div className="text-4xl font-black text-foreground z-10 flex items-center gap-3">
                                            {results.sheetCount}
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-center relative overflow-hidden group">
                                        <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:scale-110 transition-transform duration-500">
                                            <CheckCircle size={80} />
                                        </div>
                                        <div className="text-emerald-600 dark:text-emerald-400 text-sm font-bold uppercase tracking-wider mb-2 z-10">Perfect Matches</div>
                                        <div className="text-4xl font-black text-foreground z-10 flex items-center gap-3">
                                            {results.matchedCount}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                    {/* EXTRA RIDERS (Missing from Sheet) */}
                                    <div className="space-y-4 bg-red-50/20 dark:bg-red-950/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/30">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-100 dark:border-red-900/30 pb-4">
                                            <h3 className="text-lg font-black flex items-center text-red-600 dark:text-red-400 tracking-tight">
                                                <div className="p-1.5 bg-red-100 dark:bg-red-900/50 rounded-lg mr-3">
                                                    <UserX size={18} />
                                                </div>
                                                Missing from Sheet
                                                <span className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-md text-xs font-bold">{results.extraRiders.length}</span>
                                            </h3>
                                            {results.extraRiders.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search riders..."
                                                            value={searchExtra}
                                                            onChange={e => setSearchExtra(e.target.value)}
                                                            className="pl-8 pr-3 py-2 text-xs bg-background border border-border rounded-xl max-w-[150px] focus:ring-red-500/20"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleDeactivateSelected}
                                                        disabled={selectedExtraIds.size === 0 || isProcessing}
                                                        className="px-4 py-2 text-xs bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold disabled:opacity-50 shadow-md shadow-red-500/20 flex items-center gap-2"
                                                    >
                                                        Deactivate <span className="bg-black/20 px-1.5 py-0.5 rounded">{selectedExtraIds.size}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {results.extraRiders.length === 0 ? (
                                            <div className="p-8 text-center bg-green-50 border border-green-100 rounded-xl">
                                                <CheckCircle className="mx-auto text-green-500 mb-3" size={32} />
                                                <p className="text-green-600 font-medium">No extra active riders in database.</p>
                                            </div>
                                        ) : (
                                            <div className="border rounded-xl overflow-hidden bg-card">
                                                <div className="max-h-[350px] overflow-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-muted sticky top-0 z-10">
                                                            <tr>
                                                                <th className="px-4 py-3 w-[40px]">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedExtraIds.size === results.extraRiders.length && results.extraRiders.length > 0}
                                                                        onChange={toggleSelectAllExtra}
                                                                        className="rounded border-gray-300"
                                                                    />
                                                                </th>
                                                                <th className="px-4 py-3 font-medium">Rider Info</th>
                                                                <th className="px-4 py-3 font-medium">Current TL</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border">
                                                            {results.extraRiders
                                                                .filter(r =>
                                                                    r.rider_name?.toLowerCase().includes(searchExtra.toLowerCase()) ||
                                                                    r.team_leader_name?.toLowerCase().includes(searchExtra.toLowerCase())
                                                                )
                                                                .map(rider => (
                                                                    <tr key={rider.id} className={`hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors ${selectedExtraIds.has(rider.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                                        <td className="px-4 py-3 w-[40px] align-middle">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedExtraIds.has(rider.id)}
                                                                                onChange={() => {
                                                                                    const newSet = new Set(selectedExtraIds);
                                                                                    if (newSet.has(rider.id)) newSet.delete(rider.id);
                                                                                    else newSet.add(rider.id);
                                                                                    setSelectedExtraIds(newSet);
                                                                                }}
                                                                                className="rounded border-red-300 text-red-600 focus:ring-red-600 cursor-pointer w-4 h-4"
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <p className="font-bold text-foreground text-[13px]">{rider.rider_name}</p>
                                                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                                                                                <span className="bg-muted px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">📱 {rider.mobile_number}</span>
                                                                                <span className="bg-muted px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">🆔 {rider.triev_id}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 align-middle">
                                                                            <span className="px-2 py-1 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 rounded-md text-[11px] font-bold shadow-sm whitespace-nowrap">
                                                                                👤 {rider.team_leader_name || 'Unassigned'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* RETURNING RIDERS (Inactive but found in Sheet) */}
                                    <div className="space-y-4 bg-emerald-50/20 dark:bg-emerald-950/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 dark:border-emerald-900/30 pb-4">
                                            <h3 className="text-lg font-black flex items-center text-emerald-600 dark:text-emerald-400 tracking-tight">
                                                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg mr-3">
                                                    <UserCheck size={18} />
                                                </div>
                                                Returning Riders
                                                <span className="ml-2 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-md text-xs font-bold">{results.returningRiders.length}</span>
                                            </h3>
                                            {results.returningRiders.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search riders..."
                                                            value={searchReturning}
                                                            onChange={e => setSearchReturning(e.target.value)}
                                                            className="pl-8 pr-3 py-2 text-xs bg-background border border-border rounded-xl max-w-[150px] focus:ring-emerald-500/20"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleReactivateSelected}
                                                        disabled={selectedReturningIds.size === 0 || isProcessing}
                                                        className="px-4 py-2 text-xs bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        Reactivate <span className="bg-black/20 px-1.5 py-0.5 rounded">{selectedReturningIds.size}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {results.returningRiders.length === 0 ? (
                                            <div className="p-8 text-center bg-muted/50 border border-border rounded-xl">
                                                <p className="text-muted-foreground font-medium">No inactive riders found in the new sheet.</p>
                                            </div>
                                        ) : (
                                            <div className="border rounded-xl overflow-hidden bg-card border-emerald-200">
                                                <div className="max-h-[350px] overflow-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-emerald-50 sticky top-0 z-10 text-emerald-800">
                                                            <tr>
                                                                <th className="px-4 py-3 w-[40px]">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedReturningIds.size === results.returningRiders.length && results.returningRiders.length > 0}
                                                                        onChange={toggleSelectAllReturning}
                                                                        className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-600"
                                                                    />
                                                                </th>
                                                                <th className="px-4 py-3 font-medium">Rider Info</th>
                                                                <th className="px-4 py-3 font-medium">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-emerald-100">
                                                            {results.returningRiders
                                                                .filter(r => r.rider_name?.toLowerCase().includes(searchReturning.toLowerCase()))
                                                                .map(rider => {
                                                                    const reactivateInfo = getReactivationDetails(rider.inactivated_at, rider.last_status_change_at);

                                                                    return (
                                                                        <tr key={rider.id} className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors ${selectedReturningIds.has(rider.id) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                                                                            <td className="px-4 py-3 w-[40px] align-middle">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedReturningIds.has(rider.id)}
                                                                                    onChange={() => {
                                                                                        const newSet = new Set(selectedReturningIds);
                                                                                        if (newSet.has(rider.id)) newSet.delete(rider.id);
                                                                                        else newSet.add(rider.id);
                                                                                        setSelectedReturningIds(newSet);
                                                                                    }}
                                                                                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer w-4 h-4"
                                                                                />
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    <p className="font-bold text-foreground text-[13px]">{rider.rider_name}</p>
                                                                                    {rider.status === 'deleted' && (
                                                                                        <span className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-red-200 dark:border-red-800">Deleted</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex flex-col gap-2 mt-1.5">
                                                                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                                                                                        <span className="bg-muted pl-1.5 pr-2 py-0.5 rounded flex items-center gap-1.5 shadow-sm border border-border/50">
                                                                                            <span title="Fields Locked by Policy">🔒</span>
                                                                                            <span>📱 {rider.mobile_number}</span>
                                                                                            <span className="w-1 h-1 rounded-full bg-border mx-0.5" />
                                                                                            <span>🆔 {rider.triev_id}</span>
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 shadow-sm border ${reactivateInfo.isWithin15Days ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' : 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800'}`}>
                                                                                            {reactivateInfo.isWithin15Days ? <CheckCircle size={12} className="text-indigo-500" /> : <AlertTriangle size={12} className="text-orange-500" />}
                                                                                            {reactivateInfo.text}
                                                                                        </span>
                                                                                        {!reactivateInfo.isWithin15Days && reactivateInfo.days !== undefined && reactivateInfo.days > 0 && (
                                                                                            <span className="text-[10px] text-muted-foreground italic font-medium">Inactive For {reactivateInfo.days} Days</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 align-middle">
                                                                                <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-muted text-muted-foreground shadow-sm border border-border">
                                                                                    {rider.status}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t bg-muted/20 flex justify-between items-center sticky bottom-0 rounded-b-2xl">
                        {step === 'results' ? (
                            <button
                                onClick={() => setStep('upload')}
                                className="text-sm text-primary hover:underline font-medium"
                            >
                                ← Start Over
                            </button>
                        ) : <div></div>}
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-background hover:bg-muted font-bold rounded-xl transition-colors border border-border shadow-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiderAuditModal;
