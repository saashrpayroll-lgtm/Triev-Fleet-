import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface Column<T> {
    header: string | React.ReactNode;
    accessorKey?: keyof T;
    cell?: (row: T) => React.ReactNode;
    className?: string;
}

export interface ResponsiveTableProps<T> {
    columns: Column<T>[];
    data: T[];
    onRowClick?: (row: T) => void;
    actions?: (row: T) => React.ReactNode;
    keyField: keyof T;
    isLoading?: boolean;
    emptyMessage?: string;
    highlightedRowId?: string | null;
}

function ResponsiveTable<T>({
    columns,
    data,
    onRowClick,
    actions,
    keyField,
    isLoading = false,
    emptyMessage = "No data available",
    highlightedRowId
}: ResponsiveTableProps<T>) {

    if (isLoading) {
        return (
            <div className="p-12 flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Loading data...</p>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="p-12 text-center">
                <p className="text-sm text-muted-foreground font-medium">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* ─── DESKTOP TABLE (md+) ─── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/30 border-b border-border">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground ${col.className || ''}`}>
                                    {col.header}
                                </th>
                            ))}
                            {actions && <th className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                        {data.map((row) => (
                            <tr
                                key={String(row[keyField])}
                                onClick={() => onRowClick && onRowClick(row)}
                                className={`group transition-colors duration-200 ${onRowClick ? 'cursor-pointer' : ''}
                                    ${highlightedRowId === String(row[keyField])
                                        ? 'bg-amber-50 dark:bg-amber-900/10 ring-2 ring-amber-400 ring-inset'
                                        : 'hover:bg-muted/30'
                                    }`}
                            >
                                {columns.map((col, idx) => (
                                    <td key={idx} className={`px-5 py-3.5 ${col.className || ''}`}>
                                        {col.cell ? col.cell(row) : (row[col.accessorKey!] as React.ReactNode)}
                                    </td>
                                ))}
                                {actions && (
                                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                        {actions(row)}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ─── MOBILE CARDS (< md) ─── */}
            <div className="md:hidden space-y-2 p-3">
                {data.map((row) => {
                    const isHighlighted = highlightedRowId === String(row[keyField]);
                    // First column is usually checkbox/ID, second is Name — show as card header
                    const primaryCol = columns.find(c => c.accessorKey === 'riderName' || c.accessorKey === 'fullName') || columns[1];
                    const secondaryCol = columns.find(c => c.accessorKey === 'trievId') || columns[0];
                    // Skip checkbox col (index 0), primary name col, and show rest
                    const detailCols = columns.filter(c =>
                        c !== columns[0] && // skip checkbox
                        c !== primaryCol &&
                        c !== secondaryCol
                    );

                    return (
                        <div
                            key={String(row[keyField])}
                            onClick={() => onRowClick && onRowClick(row)}
                            className={`rounded-2xl border transition-all shadow-sm ${onRowClick ? 'cursor-pointer active:scale-[0.99]' : ''}
                                ${isHighlighted
                                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10 ring-2 ring-amber-400'
                                    : 'border-border bg-card hover:border-primary/30 hover:shadow-md'
                                }`}
                        >
                            {/* Card header */}
                            <div className="flex items-start gap-3 p-3">
                                {/* Checkbox (first column) */}
                                <div onClick={e => e.stopPropagation()} className="flex-shrink-0 pt-0.5">
                                    {columns[0].cell ? columns[0].cell(row) : null}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            {/* Primary name */}
                                            <div className="font-bold text-foreground text-sm truncate">
                                                {primaryCol?.cell ? primaryCol.cell(row) : primaryCol?.accessorKey ? String(row[primaryCol.accessorKey] || '') : ''}
                                            </div>
                                            {/* Secondary ID */}
                                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                {secondaryCol?.cell ? secondaryCol.cell(row) : secondaryCol?.accessorKey ? String(row[secondaryCol.accessorKey] || '') : ''}
                                            </div>
                                        </div>
                                        {/* Actions button */}
                                        {actions && (
                                            <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                                                {actions(row)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Detail columns as mini badges/rows */}
                                    <div className="flex flex-wrap gap-2 mt-2.5">
                                        {detailCols.map((col, idx) => {
                                            const val = col.cell ? col.cell(row) : (col.accessorKey ? (row[col.accessorKey] as React.ReactNode) : null);
                                            const label = typeof col.header === 'string' ? col.header : null;
                                            if (!label || !val) return null;
                                            return (
                                                <div key={idx} className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2.5 py-1.5" onClick={e => e.stopPropagation()}>
                                                    <span className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">{label}</span>
                                                    <span className="text-[11px] font-semibold text-foreground">{val}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* View details hint */}
                            {onRowClick && !actions && (
                                <div className="border-t border-border/50 px-4 py-2 flex items-center justify-end gap-1 text-primary text-[10px] font-bold uppercase tracking-wide">
                                    View Details <ChevronRight size={12} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ResponsiveTable;
