import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, FileSpreadsheet, Info, Wallet, UserMinus, UserCheck, UserPlus, Layers } from 'lucide-react';
import { DetailedSyncChange } from '@/types';

interface ImportLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: any | null;
}

const renderSafeString = (val: any): string => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
        if (val.message) return String(val.message);
        if (val.reason) return String(val.reason);
        try { return JSON.stringify(val); } catch { return String(val); }
    }
    return String(val);
};

const parseJsonSafely = (data: any): any => {
    if (!data) return null;
    if (typeof data === 'object') return data;
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch { return null; }
    }
    return null;
};

export const ImportLogModal: React.FC<ImportLogModalProps> = ({ isOpen, onClose, record }) => {
    const [activeTab, setActiveTab] = useState<'wallet' | 'inactivated' | 'reactivated' | 'added' | 'errors' | 'skips'>('wallet');

    const parsedErrors = parseJsonSafely(record?.errors);
    const errors = Array.isArray(parsedErrors) ? parsedErrors : (parsedErrors ? [parsedErrors] : []);

    const parsedSkips = parseJsonSafely(record?.skipped_details || record?.skippedDetails);
    const rawSkips = Array.isArray(parsedSkips) ? parsedSkips : [];
    const metaObj = (rawSkips.find((s: any) => s && s._meta)?._meta) || {};
    const skips = rawSkips.filter((s: any) => s && !s._meta);

    const parsedDetailed = parseJsonSafely(record?.detailed_changes || record?.detailedChanges) 
        || metaObj.detailedChanges 
        || parseJsonSafely(record?.metadata)?.summary?.detailedChanges 
        || {};

    const added: DetailedSyncChange[] = Array.isArray(parsedDetailed.added) ? parsedDetailed.added : [];
    const inactivated: DetailedSyncChange[] = Array.isArray(parsedDetailed.inactivated) ? parsedDetailed.inactivated : [];
    const reactivated: DetailedSyncChange[] = Array.isArray(parsedDetailed.reactivated) ? parsedDetailed.reactivated : [];
    const walletUpdates: DetailedSyncChange[] = Array.isArray(parsedDetailed.walletUpdates) ? parsedDetailed.walletUpdates : [];

    const importType = (record?.importType || record?.import_type || 'rider').toString();
    const adminName = (record?.adminName || record?.admin_name || 'Admin').toString();
    const totalRows = record?.totalRows ?? record?.total_rows ?? 0;
    const successCount = record?.successCount ?? record?.success_count ?? added.length;
    const updatedCount = walletUpdates.length || record?.updated_count || 0;
    const inactivatedCount = inactivated.length || metaObj.inactivated || record?.inactivated_count || 0;
    const reactivatedCount = reactivated.length || metaObj.reactivated || record?.reactivated_count || 0;
    const skippedCount = record?.skipped_count ?? skips.length;

    useEffect(() => {
        if (!isOpen || !record) return;
        if (walletUpdates.length > 0) setActiveTab('wallet');
        else if (inactivated.length > 0) setActiveTab('inactivated');
        else if (reactivated.length > 0) setActiveTab('reactivated');
        else if (added.length > 0) setActiveTab('added');
        else if (errors.length > 0) setActiveTab('errors');
        else if (skips.length > 0) setActiveTab('skips');
    }, [record?.id, isOpen]);

    if (!isOpen || !record) return null;

    const cards = [
        {
            id: 'wallet' as const,
            title: 'Wallet Updates',
            count: updatedCount,
            icon: Wallet,
            colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30 hover:border-blue-500',
            activeClass: 'ring-2 ring-blue-500 bg-blue-500/20 border-blue-500 font-extrabold shadow-md'
        },
        {
            id: 'inactivated' as const,
            title: 'Auto-Inactivated',
            count: inactivatedCount,
            icon: UserMinus,
            colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30 hover:border-rose-500',
            activeClass: 'ring-2 ring-rose-500 bg-rose-500/20 border-rose-500 font-extrabold shadow-md'
        },
        {
            id: 'reactivated' as const,
            title: 'Auto-Reactivated',
            count: reactivatedCount,
            icon: UserCheck,
            colorClass: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30 hover:border-purple-500',
            activeClass: 'ring-2 ring-purple-500 bg-purple-500/20 border-purple-500 font-extrabold shadow-md'
        },
        {
            id: 'added' as const,
            title: 'New Added',
            count: successCount,
            icon: UserPlus,
            colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500',
            activeClass: 'ring-2 ring-emerald-500 bg-emerald-500/20 border-emerald-500 font-extrabold shadow-md'
        },
        {
            id: 'errors' as const,
            title: 'Errors',
            count: errors.length,
            icon: AlertTriangle,
            colorClass: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30 hover:border-red-500',
            activeClass: 'ring-2 ring-red-500 bg-red-500/20 border-red-500 font-extrabold shadow-md'
        },
        {
            id: 'skips' as const,
            title: 'Skips',
            count: skippedCount,
            icon: Info,
            colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 hover:border-amber-500',
            activeClass: 'ring-2 ring-amber-500 bg-amber-500/20 border-amber-500 font-extrabold shadow-md'
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 shadow-2xl animate-in fade-in duration-200">
            <div className="bg-card border border-border/60 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-border/40 bg-muted/20">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-extrabold flex items-center gap-2 text-foreground">
                                <FileSpreadsheet className="text-primary" size={22} />
                                Live Sync & Import Detailed History Log
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center gap-1">
                                <Layers size={12} /> Total Rows: {totalRows}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {importType.toUpperCase()} Sync Run • {new Date(record.timestamp).toLocaleString()} • by {adminName}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-accent text-muted-foreground hover:text-foreground rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Clickable Interactive Category Cards Bar */}
                <div className="p-5 bg-accent/20 border-b border-border/40 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {cards.map(card => {
                        const Icon = card.icon;
                        const isActive = activeTab === card.id;
                        return (
                            <button
                                key={card.id}
                                type="button"
                                onClick={() => setActiveTab(card.id)}
                                className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between cursor-pointer ${
                                    isActive ? card.activeClass : `${card.colorClass} opacity-85 hover:opacity-100 hover:scale-[1.02]`
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{card.title}</span>
                                    <Icon size={14} className="opacity-75" />
                                </div>
                                <div className="text-xl font-black mt-1">
                                    {card.count}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Body Table Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">

                    {/* Tab 1: Wallet Updates */}
                    {activeTab === 'wallet' && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-extrabold uppercase text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                <Wallet size={14} /> Wallet Balance Updates ({walletUpdates.length})
                            </h3>
                            {walletUpdates.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                                    No wallet balance updates recorded in this sync run.
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
                            <h3 className="text-xs font-extrabold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-2">
                                <UserMinus size={14} /> Auto-Inactivated Riders ({inactivated.length})
                            </h3>
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
                            <h3 className="text-xs font-extrabold uppercase text-purple-600 dark:text-purple-400 flex items-center gap-2">
                                <UserCheck size={14} /> Auto-Reactivated Riders ({reactivated.length})
                            </h3>
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
                            <h3 className="text-xs font-extrabold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                <UserPlus size={14} /> New Added Riders ({added.length})
                            </h3>
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
                            <h3 className="text-xs font-extrabold uppercase text-red-600 dark:text-red-400 flex items-center gap-2">
                                <AlertTriangle size={14} /> Error Logs ({errors.length})
                            </h3>
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
                                                    <td className="px-4 py-2.5 text-red-500 font-medium">{renderSafeString(err.reason)}</td>
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
                            <h3 className="text-xs font-extrabold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                <Info size={14} /> Skip Logs ({skips.length})
                            </h3>
                            {skips.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                                    No skip logs recorded in this sync run.
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
                                                    <td className="px-4 py-2.5 text-amber-500 font-medium">{renderSafeString(skip.reason)}</td>
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
                        type="button"
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
