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

                // 15-Day Rule: If inactive for > 15 days, reset allotment date
                if (rider.inactivated_at) {
                    const inactiveDate = new Date(rider.inactivated_at);
                    const daysDiff = (new Date().getTime() - inactiveDate.getTime()) / (1000 * 3600 * 24);
                    if (daysDiff > 15) {
                        newAllotmentDate = new Date().toISOString();
                    }
                } else {
                    // If no inactivation date, treat as new allotment to be safe
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
        if (selectedExtraIds.size === results.extraRiders.length) {
            setSelectedExtraIds(new Set());
        } else {
            setSelectedExtraIds(new Set(results.extraRiders.map(r => r.id)));
        }
    };

    const toggleSelectAllReturning = () => {
        if (!results) return;
        if (selectedReturningIds.size === results.returningRiders.length) {
            setSelectedReturningIds(new Set());
        } else {
            setSelectedReturningIds(new Set(results.returningRiders.map(r => r.id)));
        }
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
                                        <h3 className="text-lg font-bold flex items-center justify-between text-destructive">
                                            <span className="flex items-center gap-2">
                                                <UserX size={20} />
                                                Missing from Sheet ({results.extraRiders.length})
                                            </span>
                                            {results.extraRiders.length > 0 && (
                                                <button
                                                    onClick={handleDeactivateSelected}
                                                    disabled={selectedExtraIds.size === 0 || isProcessing}
                                                    className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-all font-bold disabled:opacity-50"
                                                >
                                                    Deactivate ({selectedExtraIds.size})
                                                </button>
                                            )}
                                        </h3>

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
                                                            {results.extraRiders.map(rider => (
                                                                <tr key={rider.id} className={`hover:bg-accent/50 ${selectedExtraIds.has(rider.id) ? 'bg-red-50/50' : ''}`}>
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
                                                                            className="rounded border-gray-300 text-destructive focus:ring-destructive mt-1"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <p className="font-bold text-destructive">{rider.rider_name}</p>
                                                                        <p className="text-xs text-muted-foreground">{rider.mobile_number} • {rider.triev_id}</p>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-xs text-muted-foreground align-top pt-4">{rider.team_leader_name || '-'}</td>
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
                                        <h3 className="text-lg font-bold flex items-center justify-between text-emerald-600">
                                            <span className="flex items-center gap-2">
                                                <UserCheck size={20} />
                                                Returning Riders ({results.returningRiders.length})
                                            </span>
                                            {results.returningRiders.length > 0 && (
                                                <button
                                                    onClick={handleReactivateSelected}
                                                    disabled={selectedReturningIds.size === 0 || isProcessing}
                                                    className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                                >
                                                    Reactivate ({selectedReturningIds.size})
                                                </button>
                                            )}
                                        </h3>

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
                                                            {results.returningRiders.map(rider => (
                                                                <tr key={rider.id} className={`hover:bg-emerald-50/50 ${selectedReturningIds.has(rider.id) ? 'bg-emerald-50' : ''}`}>
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
                                                                            className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-600 mt-1"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <p className="font-bold text-foreground">{rider.rider_name}</p>
                                                                        <p className="text-xs text-muted-foreground">{rider.mobile_number} • {rider.triev_id}</p>
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top pt-3">
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-muted text-muted-foreground">
                                                                            {rider.status}
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
