import React, { useState } from 'react';
import { X, AlertTriangle, FileSpreadsheet, Info, Wallet, UserMinus, UserCheck, UserPlus } from 'lucide-react';
import { DetailedSyncChange } from '@/types';

interface ImportLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: any | null;
}

export const ImportLogModal: React.FC<ImportLogModalProps> = ({ isOpen, onClose, record }) => {
    const [activeTab, setActiveTab] = useState<'wallet' | 'inactivated' | 'reactivated' | 'added' | 'errors' | 'skips'>('wallet');

    if (!isOpen || !record) return null;

    const errors = record.errors || [];
    const skips = record.skipped_details || [];

    const detailedChanges = record.detailed_changes || record.metadata?.summary?.detailedChanges || {
        added: [],
        inactivated: [],
        reactivated: [],
        walletUpdates: [],
        dataUpdates: []
    };

    const added: DetailedSyncChange[] = detailedChanges.added || [];
    const inactivated: DetailedSyncChange[] = detailedChanges.inactivated || [];
    const reactivated: DetailedSyncChange[] = detailedChanges.reactivated || [];
    const walletUpdates: DetailedSyncChange[] = detailedChanges.walletUpdates || [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 shadow-2xl animate-in fade-in duration-200">
            <div className="bg-card border border-border/60 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-border/40 bg-muted/20">
                    <div>
                        <h2 className="text-xl font-extrabold flex items-center gap-2.5 text-foreground">
                            <FileSpreadsheet className="text-primary" />
                            Live Sync & Import Detailed History Log
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {record.importType.toUpperCase()} Sync Run • {new Date(record.timestamp).toLocaleString()} • by {record.adminName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-accent text-muted-foreground hover:text-foreground rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Summary Badges Bar */}
                <div className="px-6 py-4 bg-accent/30 border-b border-border/40 grid grid-cols-2 sm:grid-cols-6 gap-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-center">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Total Rows</div>
                        <div className="text-lg font-black text-foreground">{record.totalRows}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">New Added</div>
                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{record.successCount || added.length}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Wallet Updated</div>
                        <div className="text-lg font-black text-blue-600 dark:text-blue-400">{walletUpdates.length || record.updated_count || 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                        <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Inactivated</div>
                        <div className="text-lg font-black text-rose-600 dark:text-rose-400">{inactivated.length || record.inactivated_count || 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                        <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Reactivated</div>
                        <div className="text-lg font-black text-purple-600 dark:text-purple-400">{reactivated.length || record.reactivated_count || 0}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                        <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Skipped</div>
                        <div className="text-lg font-black text-amber-600 dark:text-amber-400">{record.skipped_count || 0}</div>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="px-6 pt-3 flex gap-2 border-b border-border/40 overflow-x-auto scrollbar-thin">
                    <button
                        onClick={() => setActiveTab('wallet')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'wallet' ? 'border-blue-500 text-blue-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Wallet size={14} /> Wallet Updates ({walletUpdates.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('inactivated')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'inactivated' ? 'border-rose-500 text-rose-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <UserMinus size={14} /> Auto-Inactivated ({inactivated.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('reactivated')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'reactivated' ? 'border-purple-500 text-purple-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <UserCheck size={14} /> Auto-Reactivated ({reactivated.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('added')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'added' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <UserPlus size={14} /> New Added ({added.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('errors')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'errors' ? 'border-red-500 text-red-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <AlertTriangle size={14} /> Errors ({errors.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('skips')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'skips' ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Info size={14} /> Skips ({skips.length})
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">

                    {/* Tab 1: Wallet Updates */}
                    {activeTab === 'wallet' && (
                        <div className="space-y-3">
                            {walletUpdates.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                                    No wallet balance updates in this sync run.
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden bg-card/60">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border-b border-border/40">
                                            <tr>
                                                <th className="px-4 py-3">Rider ID / Triev ID</th>
                                                <th className="px-4 py-3">Rider Name</th>
                                                <th className="px-4 py-3">Old Balance</th>
                                                <th className="px-4 py-3">New Balance</th>
                                                <th className="px-4 py-3 text-right">Difference</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {walletUpdates.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-accent/30 font-medium">
                                                    <td className="px-4 py-2.5 font-mono text-primary font-bold">{item.trievId || item.mobileNumber || '-'}</td>
                                                    <td className="px-4 py-2.5 font-bold text-foreground">{item.riderName}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground font-mono">₹{item.oldWallet ?? 0}</td>
                                                    <td className="px-4 py-2.5 font-mono font-bold text-foreground">₹{item.newWallet ?? 0}</td>
                                                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${(item.diff || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {(item.diff || 0) >= 0 ? `+₹${item.diff}` : `-₹${Math.abs(item.diff || 0)}`}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Auto-Inactivated Riders */}
                    {activeTab === 'inactivated' && (
                        <div className="space-y-3">
                            {inactivated.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                                    No riders were auto-inactivated in this sync run.
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden bg-card/60">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border-b border-border/40">
                                            <tr>
                                                <th className="px-4 py-3">Rider ID / Triev ID</th>
                                                <th className="px-4 py-3">Rider Name</th>
                                                <th className="px-4 py-3">Mobile Number</th>
                                                <th className="px-4 py-3">Team Leader</th>
                                                <th className="px-4 py-3 text-right">Status Change</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {inactivated.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-accent/30 font-medium">
                                                    <td className="px-4 py-2.5 font-mono text-primary font-bold">{item.trievId || '-'}</td>
                                                    <td className="px-4 py-2.5 font-bold text-foreground">{item.riderName}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground font-mono">{item.mobileNumber}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground">{item.teamLeaderName || 'Unassigned'}</td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-[10px]">
                                                            Active ➔ Inactive
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Auto-Reactivated Riders */}
                    {activeTab === 'reactivated' && (
                        <div className="space-y-3">
                            {reactivated.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                                    No riders were auto-reactivated in this sync run.
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden bg-card/60">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border-b border-border/40">
                                            <tr>
                                                <th className="px-4 py-3">Rider ID / Triev ID</th>
                                                <th className="px-4 py-3">Rider Name</th>
                                                <th className="px-4 py-3">Mobile Number</th>
                                                <th className="px-4 py-3">Team Leader</th>
                                                <th className="px-4 py-3 text-right">Status Change</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {reactivated.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-accent/30 font-medium">
                                                    <td className="px-4 py-2.5 font-mono text-primary font-bold">{item.trievId || '-'}</td>
                                                    <td className="px-4 py-2.5 font-bold text-foreground">{item.riderName}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground font-mono">{item.mobileNumber}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground">{item.teamLeaderName || 'Unassigned'}</td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 font-bold text-[10px]">
                                                            Inactive ➔ Active
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 4: New Added Riders */}
                    {activeTab === 'added' && (
                        <div className="space-y-3">
                            {added.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                                    No new riders created in this sync run.
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden bg-card/60">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-b border-border/40">
                                            <tr>
                                                <th className="px-4 py-3">Triev ID</th>
                                                <th className="px-4 py-3">Rider Name</th>
                                                <th className="px-4 py-3">Mobile Number</th>
                                                <th className="px-4 py-3">Team Leader</th>
                                                <th className="px-4 py-3 text-right">Initial Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {added.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-accent/30 font-medium">
                                                    <td className="px-4 py-2.5 font-mono text-primary font-bold">{item.trievId || '-'}</td>
                                                    <td className="px-4 py-2.5 font-bold text-foreground">{item.riderName}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground font-mono">{item.mobileNumber}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground">{item.teamLeaderName || 'Unassigned'}</td>
                                                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-500">₹{item.newWallet ?? 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 5: Errors */}
                    {activeTab === 'errors' && (
                        <div className="space-y-3">
                            {errors.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                                    No errors encountered in this sync run.
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden bg-card/60">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-red-500/10 text-red-600 font-bold border-b border-border/40">
                                            <tr>
                                                <th className="px-4 py-3 w-16">Row</th>
                                                <th className="px-4 py-3 w-48">Identifier</th>
                                                <th className="px-4 py-3">Error Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {errors.map((err: any, i: number) => (
                                                <tr key={i} className="hover:bg-accent/30">
                                                    <td className="px-4 py-2.5 font-bold text-muted-foreground">{err.row || '-'}</td>
                                                    <td className="px-4 py-2.5 font-mono font-bold text-foreground">{err.identifier || '-'}</td>
                                                    <td className="px-4 py-2.5 text-red-500 font-medium">{err.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 6: Skips */}
                    {activeTab === 'skips' && (
                        <div className="space-y-3">
                            {skips.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                                    No skip logs recorded.
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden bg-card/60">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-amber-500/10 text-amber-600 font-bold border-b border-border/40">
                                            <tr>
                                                <th className="px-4 py-3 w-16">Row</th>
                                                <th className="px-4 py-3 w-48">Identifier</th>
                                                <th className="px-4 py-3">Skip Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {skips.map((skip: any, i: number) => (
                                                <tr key={i} className="hover:bg-accent/30">
                                                    <td className="px-4 py-2.5 font-bold text-muted-foreground">{skip.row || '-'}</td>
                                                    <td className="px-4 py-2.5 font-mono font-bold text-foreground">{skip.identifier || '-'}</td>
                                                    <td className="px-4 py-2.5 text-amber-500 font-medium">{skip.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/40 bg-muted/20 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md shadow-primary/20"
                    >
                        Close History Log
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportLogModal;
