import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Search, UserX, Database, FileSpreadsheet } from 'lucide-react';
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
    extraRiders: any[]; // In DB, not in Sheet
    matchedCount: number;
    dbCount: number;
    sheetCount: number;
}

const RiderAuditModal: React.FC<RiderAuditModalProps> = ({ isOpen, onClose }) => {
    const { userData } = useSupabaseAuth();
    const [step, setStep] = useState<'upload' | 'analyzing' | 'results'>('upload');
    const [results, setResults] = useState<AuditResult | null>(null);
    const [selectedExtraIds, setSelectedExtraIds] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleAnalyze = async (sheetData: any[]) => {
        setStep('analyzing');
        try {
            // 1. Fetch ALL Active Riders from DB
            const { data: dbRiders, error } = await supabase
                .from('riders')
                .select('id, rider_name, mobile_number, triev_id, status, team_leader_name')
                .eq('status', 'active');

            if (error) throw error;
            if (!dbRiders) throw new Error("No active riders found in database");

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
            let matchedCount = 0;

            dbRiders.forEach(dbRider => {
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

            setResults({
                extraRiders,
                matchedCount,
                dbCount: dbRiders.length,
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

    const toggleSelectAll = () => {
        if (!results) return;
        if (selectedExtraIds.size === results.extraRiders.length) {
            setSelectedExtraIds(new Set());
        } else {
            setSelectedExtraIds(new Set(results.extraRiders.map(r => r.id)));
        }
    };

    return (
        <div className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
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
                                            <li>System compares it with <strong>Active Riders in Database</strong>.</li>
                                            <li>Riders found in DB but <strong>NOT</strong> in your sheet are flagged as "Extra".</li>
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
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-muted/30 p-4 rounded-xl border border-border">
                                        <div className="text-muted-foreground text-sm font-medium mb-1">System Riders (DB)</div>
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
                                        <div className="text-muted-foreground text-sm font-medium mb-1">Matched</div>
                                        <div className="text-2xl font-bold flex items-center gap-2">
                                            <CheckCircle size={20} className="text-emerald-500" /> {results.matchedCount}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold flex items-center gap-2 text-destructive">
                                            <UserX size={20} />
                                            Extra Riders Found ({results.extraRiders.length})
                                        </h3>
                                        <button
                                            onClick={() => setStep('upload')}
                                            className="text-sm text-muted-foreground hover:text-primary underline"
                                        >
                                            Start Over
                                        </button>
                                    </div>

                                    {results.extraRiders.length === 0 ? (
                                        <div className="p-8 text-center bg-green-50 border border-green-100 rounded-xl">
                                            <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
                                            <h4 className="text-xl font-bold text-green-700">All Good!</h4>
                                            <p className="text-green-600">No extra active riders in database.</p>
                                        </div>
                                    ) : (
                                        <div className="border rounded-xl overflow-hidden max-h-[400px] overflow-y-auto bg-card">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-muted sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-3 w-[40px]">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedExtraIds.size === results.extraRiders.length && results.extraRiders.length > 0}
                                                                onChange={toggleSelectAll}
                                                                className="rounded border-gray-300"
                                                            />
                                                        </th>
                                                        <th className="px-4 py-3 font-medium">Name</th>
                                                        <th className="px-4 py-3 font-medium">Mobile</th>
                                                        <th className="px-4 py-3 font-medium">Triev ID</th>
                                                        <th className="px-4 py-3 font-medium">Current TL</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {results.extraRiders.map(rider => (
                                                        <tr key={rider.id} className={`hover:bg-accent/50 ${selectedExtraIds.has(rider.id) ? 'bg-red-50/50' : ''}`}>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedExtraIds.has(rider.id)}
                                                                    onChange={() => {
                                                                        const newSet = new Set(selectedExtraIds);
                                                                        if (newSet.has(rider.id)) newSet.delete(rider.id);
                                                                        else newSet.add(rider.id);
                                                                        setSelectedExtraIds(newSet);
                                                                    }}
                                                                    className="rounded border-gray-300 text-destructive focus:ring-destructive"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-destructive">{rider.rider_name}</td>
                                                            <td className="px-4 py-3">{rider.mobile_number}</td>
                                                            <td className="px-4 py-3 font-mono text-xs">{rider.triev_id}</td>
                                                            <td className="px-4 py-3 text-xs text-muted-foreground">{rider.team_leader_name || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t bg-muted/20 flex justify-end gap-3 sticky bottom-0 rounded-b-2xl">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                        >
                            Close
                        </button>
                        {step === 'results' && results && results.extraRiders.length > 0 && (
                            <button
                                onClick={handleDeactivateSelected}
                                disabled={selectedExtraIds.size === 0 || isProcessing}
                                className="px-6 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-all font-bold shadow-lg shadow-destructive/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isProcessing ? 'Processing...' : (
                                    <>
                                        <UserX size={18} />
                                        Deactivate Selected ({selectedExtraIds.size})
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiderAuditModal;
