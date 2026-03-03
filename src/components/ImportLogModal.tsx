import React from 'react';
import { X, AlertTriangle, FileSpreadsheet, Info } from 'lucide-react';

interface LogItem {
    row?: number;
    identifier?: string;
    reason: string;
    data?: any;
}

interface ImportLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: any | null; // The import history record
}

const ImportLogModal: React.FC<ImportLogModalProps> = ({ isOpen, onClose, record }) => {
    if (!isOpen || !record) return null;

    const errors = record.errors || [];
    const skips = record.skipped_details || [];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 shadow-2xl">
            <div className="bg-background rounded-2xl border w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-card">
                    <div>
                        <h2 className="text-xl font-extrabold flex items-center gap-2">
                            <FileSpreadsheet className="text-primary" />
                            Import Log Details
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {record.importType.toUpperCase()} Import • {new Date(record.timestamp).toLocaleString()} • by {record.adminName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="p-4 rounded-xl bg-muted/30 border border-muted/50 flex flex-col items-center justify-center">
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Rows</div>
                            <div className="text-2xl font-black">{record.totalRows}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex flex-col items-center justify-center">
                            <div className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1">New</div>
                            <div className="text-2xl font-black text-green-600 dark:text-green-400">{record.successCount}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center">
                            <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">Updated</div>
                            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{record.updated_count || 0}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center justify-center">
                            <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Skipped</div>
                            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{record.skipped_count ?? 0}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col items-center justify-center">
                            <div className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">Failed</div>
                            <div className="text-2xl font-black text-red-600 dark:text-red-400">{record.failureCount}</div>
                        </div>
                    </div>

                    {/* Failed Entries */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-red-600">
                            <AlertTriangle size={18} /> Failed Entries ({errors.length})
                        </h3>
                        {errors.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                                No errors found in this import.
                            </div>
                        ) : (
                            <div className="border rounded-xl overflow-hidden bg-card/50 shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-red-500/10 text-red-700 dark:text-red-300">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold w-20">Row</th>
                                            <th className="px-4 py-3 font-semibold w-48">Identifier</th>
                                            <th className="px-4 py-3 font-semibold">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {errors.map((err: LogItem, i: number) => (
                                            <tr key={i} className="hover:bg-muted/30">
                                                <td className="px-4 py-2.5 font-medium">{err.row || '-'}</td>
                                                <td className="px-4 py-2.5 text-muted-foreground">{err.identifier || '-'}</td>
                                                <td className="px-4 py-2.5 font-medium text-red-600/90">{err.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Skipped Entries */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-amber-600">
                            <Info size={18} /> Skipped Details ({skips.length}{skips.length === 100 ? '+' : ''})
                        </h3>
                        {skips.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                                No detailed skip logs available for this import.
                                {record.skipped_count > 0 && " (Detailed tracking was likely not enabled when this import ran)."}
                            </div>
                        ) : (
                            <div className="border rounded-xl overflow-hidden bg-card/50 shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold w-20">Row</th>
                                            <th className="px-4 py-3 font-semibold w-48">Identifier</th>
                                            <th className="px-4 py-3 font-semibold">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {skips.map((skip: LogItem, i: number) => (
                                            <tr key={i} className="hover:bg-muted/30">
                                                <td className="px-4 py-2.5 font-medium">{skip.row || '-'}</td>
                                                <td className="px-4 py-2.5 text-muted-foreground">{skip.identifier || '-'}</td>
                                                <td className="px-4 py-2.5 text-amber-600/90">{skip.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {skips.length >= 100 && (
                                    <div className="p-2 text-center text-xs font-semibold text-amber-700 bg-amber-50">
                                        Showing first 100 skipped items.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ImportLogModal;
