import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Search, UserX, Database, FileSpreadsheet, UserCheck } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';
import DataImport from './DataImport';
import { normalizeKey } from '@/utils/importUtils';
import { logActivity } from '@/utils/activityLog';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface RiderAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AuditResult {
    extraRiders: any[]; // In DB as active, not in Sheet
    returningRiders: any[]; // In DB as inactive/deleted, BUT IS in Sheet
    matchedCount: number;
    dbCount: number; // Active DB standard count
    sheetCount: number;
}

const RiderAuditModal: React.FC<RiderAuditModalProps> = ({ isOpen, onClose }) => {
    const { userData } = useSupabaseAuth();
    const [step, setStep] = useState<'upload' | 'analyzing' | 'results'>('upload');
    const [results, setResults] = useState<AuditResult | null>(null);
    const [selectedExtraIds, setSelectedExtraIds] = useState<Set<string>>(new Set());
    const [selectedReturningIds, setSelectedReturningIds] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);

    // Search state
    const [searchExtra, setSearchExtra] = useState('');
    const [searchReturning, setSearchReturning] = useState('');

    if (!isOpen) return null;

    const handleAnalyze = async (sheetData: any[]) => {
        setStep('analyzing');
        try {
            // 1. Fetch ALL Riders from DB (Active and Inactive)
            const { data: dbRiders, error } = await supabase
                .from('riders')
                .select('id, rider_name, mobile_number, triev_id, status, team_leader_name, inactivated_at, allotment_date')
                .in('status', ['active', 'inactive', 'deleted']);

            if (error) throw error;
            if (!dbRiders) throw new Error("No riders found in database");

            const activeDbRiders = dbRiders.filter(r => r.status === 'active');
            const inactiveDbRiders = dbRiders.filter(r => r.status !== 'active');

            // 2. Normalize Sheet Data
            const sheetIdentifiers = new Set<string>();

            sheetData.forEach(row => {
                const normalizedRow: any = {};
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
            const extraRiders: any[] = [];
            const returningRiders: any[] = [];
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

            // Check Inactive Riders (Are they back on the sheet?)
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

        } catch (err: any) {
            console.error("Audit Failed:", err);
            toast.error("Audit Failed: " + err.message);
            setStep('upload');
        }
    };

    const handleDeactivateSelected = async () => {
        if (selectedExtraIds.size === 0) return;
        if (!confirm(`Are you sure you want to DEACTIVATE ${selectedExtraIds.size} riders? They will be marked as 'inactive'.`)) return;

        setIsProcessing(true);
        try {
            const ids = Array.from(selectedExtraIds);
            const { error } = await supabase
                .from('riders')
                .update({ status: 'inactive', updated_at: new Date().toISOString() })
                .in('id', ids);

            if (error) throw error;

            toast.success(`Successfully deactivated ${ids.length} riders.`);

            await logActivity({
                actionType: 'bulkUpdate',
                targetType: 'rider',
                targetId: 'multiple',
                details: `Audit Tool: Deactivated ${ids.length} extra riders`,
                performedBy: userData?.email
            });

            if (results) {
                setResults({
                    ...results,
                    extraRiders: results.extraRiders.filter(r => !selectedExtraIds.has(r.id)),
                    dbCount: results.dbCount - ids.length
                });
                setSelectedExtraIds(new Set());
            }

        } catch (err: any) {
            console.error("Deactivation Failed:", err);
            toast.error("Failed to deactivate riders.");
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
                const inactiveDateStr = rider.inactivated_at || rider.last_status_change_at;

                const nowISTStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                const nowIST = new Date(nowISTStr).getTime();

                if (inactiveDateStr) {
                    const inactiveISTStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(inactiveDateStr));
                    const inactiveIST = new Date(inactiveISTStr).getTime();

                    const daysDiff = (nowIST - inactiveIST) / (1000 * 3600 * 24);

                    if (daysDiff > 15) {
                        newAllotmentDate = new Date().toISOString(); // Give new allotment timestamp
                    }
                    // If <= 15 days, newAllotmentDate retains the old allotment_date
                } else {
                    // Fallback if no dates exist (should be rare)
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

        } catch (err: any) {
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
        const inactiveDateStr = inactivatedAt || lastStatusChangeAt;
        if (!inactiveDateStr) return { isWithin15Days: false, text: "New Allotment Date" };
        const inactiveDate = new Date(inactiveDateStr);
        const daysDiff = (new Date().getTime() - inactiveDate.getTime()) / (1000 * 3600 * 24);
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
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center p-6 border-b">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Search className="text-purple-500" /> Audit & Sync Check
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto">
                        {step === 'upload' && (
                            <div className="space-y-4">
                                <div className="mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex gap-3 text-sm text-blue-700">
                                    <AlertTriangle className="shrink-0" size={20} />
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
                                    <div className="bg-muted/30 p-4 rounded-xl border border-border">
                                        <div className="text-muted-foreground text-sm font-medium mb-1">Active System Riders (DB)</div>
                                        <div className="text-2xl font-bold flex items-center gap-2">
                                            <Database size={20} className="text-blue-500" /> {results.dbCount}
                                        </div>
                                    </div>
                                    <div className="bg-muted/30 p-4 rounded-xl border border-border">
                                        <div className="text-muted-foreground text-sm font-medium mb-1">Sheet Rows</div>
                                        <div className="text-2xl font-bold flex items-center gap-2">
                                            <FileSpreadsheet size={20} className="text-green-500" /> {results.sheetCount}
                                        </div>
                                    </div>
                                    <div className="bg-muted/30 p-4 rounded-xl border border-border">
                                        <div className="text-muted-foreground text-sm font-medium mb-1">Matched (Active)</div>
                                        <div className="text-2xl font-bold flex items-center gap-2">
                                            <CheckCircle size={20} className="text-emerald-500" /> {results.matchedCount}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                    {/* EXTRA RIDERS (Missing from Sheet) */}
                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <h3 className="text-lg font-bold flex items-center text-destructive">
                                                <UserX size={20} className="mr-2" />
                                                Missing from Sheet ({results.extraRiders.length})
                                            </h3>
                                            {results.extraRiders.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search..."
                                                            value={searchExtra}
                                                            onChange={e => setSearchExtra(e.target.value)}
                                                            className="pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg max-w-[140px]"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleDeactivateSelected}
                                                        disabled={selectedExtraIds.size === 0 || isProcessing}
                                                        className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-all font-bold disabled:opacity-50 shadow-sm"
                                                    >
                                                        Deactivate ({selectedExtraIds.size})
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
                                                                    <tr key={rider.id} className={`hover:bg-accent/50 transition-colors ${selectedExtraIds.has(rider.id) ? 'bg-red-50/50' : ''}`}>
                                                                        <td className="px-4 py-3 w-[40px] align-top">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedExtraIds.has(rider.id)}
                                                                                onChange={() => {
                                                                                    const newSet = new Set(selectedExtraIds);
                                                                                    if (newSet.has(rider.id)) newSet.delete(rider.id);
                                                                                    else newSet.add(rider.id);
                                                                                    setSelectedExtraIds(newSet);
                                                                                }}
                                                                                className="rounded border-gray-300 text-destructive focus:ring-destructive mt-1 cursor-pointer"
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <p className="font-bold text-destructive">{rider.rider_name}</p>
                                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                                                <span>{rider.mobile_number}</span>
                                                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                                                <span>{rider.triev_id}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-xs text-muted-foreground align-top pt-4">
                                                                            <span className="px-2 py-1 bg-muted rounded-md font-medium text-foreground/80">{rider.team_leader_name || 'Unassigned'}</span>
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
                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <h3 className="text-lg font-bold flex items-center text-emerald-600">
                                                <UserCheck size={20} className="mr-2" />
                                                Returning Riders ({results.returningRiders.length})
                                            </h3>
                                            {results.returningRiders.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600/50" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search..."
                                                            value={searchReturning}
                                                            onChange={e => setSearchReturning(e.target.value)}
                                                            className="pl-8 pr-3 py-1.5 text-xs bg-emerald-50/50 border-emerald-200 border rounded-lg max-w-[140px] focus:ring-emerald-500/20"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleReactivateSelected}
                                                        disabled={selectedReturningIds.size === 0 || isProcessing}
                                                        className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                                                    >
                                                        Reactivate ({selectedReturningIds.size})
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
                                                                        <tr key={rider.id} className={`hover:bg-emerald-50/80 transition-colors ${selectedReturningIds.has(rider.id) ? 'bg-emerald-50' : ''}`}>
                                                                            <td className="px-4 py-3 w-[40px] align-top">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedReturningIds.has(rider.id)}
                                                                                    onChange={() => {
                                                                                        const newSet = new Set(selectedReturningIds);
                                                                                        if (newSet.has(rider.id)) newSet.delete(rider.id);
                                                                                        else newSet.add(rider.id);
                                                                                        setSelectedReturningIds(newSet);
                                                                                    }}
                                                                                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-600 mt-1 cursor-pointer"
                                                                                />
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    <p className="font-bold text-foreground">{rider.rider_name}</p>
                                                                                    {rider.status === 'deleted' && (
                                                                                        <span className="bg-red-100 text-red-600 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Deleted</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex flex-col gap-1 mt-1">
                                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground/80 font-medium bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                                                                                        <span className="text-emerald-600/70" title="Locked Identity">🔒</span>
                                                                                        <span>{rider.mobile_number}</span>
                                                                                        <span className="w-1 h-1 rounded-full bg-border" />
                                                                                        <span>{rider.triev_id}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 ${reactivateInfo.isWithin15Days ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                                                                            {reactivateInfo.isWithin15Days ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                                                                                            {reactivateInfo.text}
                                                                                        </span>
                                                                                        {!reactivateInfo.isWithin15Days && reactivateInfo.days !== undefined && reactivateInfo.days > 0 && (
                                                                                            <span className="text-[9px] text-muted-foreground italic">Inactive &gt; 15d ({reactivateInfo.days}d)</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 align-top pt-4">
                                                                                <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-muted text-muted-foreground shadow-sm border border-border">
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
