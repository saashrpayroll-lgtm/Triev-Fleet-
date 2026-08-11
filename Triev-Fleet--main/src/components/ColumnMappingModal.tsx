import React, { useState, useEffect } from 'react';
import { X, Check, RefreshCw, AlertCircle, Table } from 'lucide-react';
import { RiderColumnMapping } from '@/types';
import { fetchGoogleSheetHeaders } from '@/utils/googleSheetsUtils';
import { toast } from 'sonner';

interface ColumnMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    sheetId: string;
    range: string;
    apiKey?: string;
    currentMapping?: RiderColumnMapping;
    onSaveMapping: (mapping: RiderColumnMapping) => void;
}

const DEFAULT_MAPPING: RiderColumnMapping = {
    primaryKey: 'Triev ID',
    riderName: 'Rider Name',
    mobileNumber: 'Mobile Number',
    chassisNumber: 'Chassis Number',
    clientName: 'Client Name',
    clientId: 'Client ID',
    allotmentDate: 'Allotment Date',
    walletAmount: 'Wallet Amount',
    teamLeader: 'Team Leader',
    reportingManager: 'Reporting Manager',
    cityOps: 'City Ops',
    remarks: 'Remarks'
};

const SYSTEM_FIELDS: { key: keyof RiderColumnMapping; label: string; description: string; required?: boolean }[] = [
    { key: 'primaryKey', label: 'Rider ID / Triev ID / Mobile (Unique Key)', description: 'Primary identifier for matching riders in Live Sheet', required: true },
    { key: 'riderName', label: 'Rider Name', description: 'Full name of the rider', required: true },
    { key: 'mobileNumber', label: 'Mobile Number', description: 'Primary registered phone number', required: true },
    { key: 'chassisNumber', label: 'Chassis Number', description: 'Vehicle chassis/VIN number' },
    { key: 'clientName', label: 'Client Name', description: 'Brand client (Zomato, Zepto, Blinkit, Swiggy, etc.)' },
    { key: 'clientId', label: 'Client ID / App ID', description: 'ID assigned by client company' },
    { key: 'allotmentDate', label: 'Allotment Date', description: 'Vehicle allotment or joining date' },
    { key: 'walletAmount', label: 'Wallet Balance / Amount', description: 'Live wallet balance amount' },
    { key: 'teamLeader', label: 'Team Leader Name / Email / ID', description: 'Team leader assigned to rider' },
    { key: 'reportingManager', label: 'Reporting Manager (RM)', description: 'Reporting manager column if available' },
    { key: 'cityOps', label: 'City Ops Head', description: 'City operations head column if available' },
    { key: 'remarks', label: 'Remarks / Notes', description: 'General remarks or comments' }
];

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
    isOpen,
    onClose,
    sheetId,
    range,
    apiKey,
    currentMapping,
    onSaveMapping
}) => {
    const [mapping, setMapping] = useState<RiderColumnMapping>(currentMapping || DEFAULT_MAPPING);
    const [headers, setHeaders] = useState<string[]>([]);
    const [loadingHeaders, setLoadingHeaders] = useState(false);

    useEffect(() => {
        if (currentMapping) {
            setMapping(currentMapping);
        }
    }, [currentMapping]);

    useEffect(() => {
        if (isOpen && sheetId && range && sheetId.length >= 10) {
            handleFetchHeaders();
        }
    }, [isOpen, sheetId, range]);

    const handleFetchHeaders = async () => {
        if (!sheetId || !range) {
            toast.error("Please enter Sheet ID and Range in settings first");
            return;
        }
        setLoadingHeaders(true);
        try {
            const fetched = await fetchGoogleSheetHeaders({ sheetId, range, apiKey });
            if (fetched.length === 0) {
                toast.error("No headers found in the specified Sheet Range");
            } else {
                setHeaders(fetched);
                toast.success(`Successfully fetched ${fetched.length} column headers from Live Sheet!`);
            }
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to fetch headers: " + (err.message || 'Check Sheet visibility'));
        } finally {
            setLoadingHeaders(false);
        }
    };

    const handleChange = (key: keyof RiderColumnMapping, val: string) => {
        setMapping(prev => ({ ...prev, [key]: val }));
    };

    const handleSave = () => {
        if (!mapping.primaryKey || !mapping.riderName || !mapping.mobileNumber) {
            toast.error("Primary Key, Rider Name, and Mobile Number mappings are required.");
            return;
        }
        onSaveMapping(mapping);
        toast.success("Column Mapping updated successfully!");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border/60 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <Table size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Google Sheet Column Mapping Engine</h2>
                            <p className="text-xs text-muted-foreground">Map your Live Google Sheet headers to system rider fields</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-accent/40 border border-border/50">
                        <div className="text-sm">
                            <span className="font-semibold text-foreground">Auto-Detect Sheet Headers:</span>
                            <span className="text-muted-foreground ml-2 text-xs">Fetch column names directly from Live Sheet</span>
                        </div>
                        <button
                            onClick={handleFetchHeaders}
                            disabled={loadingHeaders}
                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={loadingHeaders ? 'animate-spin' : ''} />
                            <span>{loadingHeaders ? 'Fetching...' : 'Fetch Headers from Sheet'}</span>
                        </button>
                    </div>

                    {headers.length > 0 && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <Check size={16} />
                            <span>{headers.length} headers detected: <strong>{headers.join(', ')}</strong></span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SYSTEM_FIELDS.map(field => (
                            <div key={field.key} className="p-3.5 rounded-xl border border-border/50 bg-background/50 space-y-2 hover:border-primary/40 transition-all">
                                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <span>{field.label} {field.required && <span className="text-red-500">*</span>}</span>
                                </label>
                                <p className="text-[11px] text-muted-foreground">{field.description}</p>
                                {headers.length > 0 ? (
                                    <select
                                        value={mapping[field.key] || ''}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-card text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="">-- Select Sheet Header --</option>
                                        {mapping[field.key] && !headers.includes(mapping[field.key]) && (
                                            <option value={mapping[field.key]}>{mapping[field.key]} (Custom)</option>
                                        )}
                                        {headers.map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={mapping[field.key] || ''}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                        placeholder={`e.g. ${field.label}`}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-card text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertCircle size={14} className="text-amber-500" />
                        <span>Changes take effect immediately on next sync cycle</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium rounded-xl border border-border hover:bg-accent transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/25 transition-all"
                        >
                            Save Mapping Engine
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColumnMappingModal;
