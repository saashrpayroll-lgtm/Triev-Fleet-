import React from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
            <div className="hidden md:block">
                <div className="relative rounded-3xl border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-950/40 backdrop-blur-2xl shadow-2xl overflow-hidden group/table">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-separate border-spacing-0">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-50/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/10">
                                    {columns.map((col, idx) => (
                                        <th
                                            key={idx}
                                            className={`
                                                px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10 first:pl-8
                                                ${col.className || ''}
                                            `}
                                        >
                                            {col.header}
                                        </th>
                                    ))}
                                    {actions && (
                                        <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 dark:text-slate-400/70 border-b border-white/10 pr-8">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="relative">
                                <AnimatePresence mode="popLayout">
                                    {data.map((row, index) => {
                                        const rowId = String(row[keyField]);
                                        const isHighlighted = highlightedRowId === rowId;

                                        return (
                                            <motion.tr
                                                key={rowId}
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.98 }}
                                                transition={{
                                                    duration: 0.4,
                                                    delay: Math.min(index * 0.03, 0.3),
                                                    ease: [0.23, 1, 0.32, 1]
                                                }}
                                                onClick={() => onRowClick && onRowClick(row)}
                                                className={`
                                                    group relative transition-all duration-500 
                                                    ${onRowClick ? 'cursor-pointer' : ''}
                                                    ${isHighlighted
                                                        ? 'bg-amber-400/10 dark:bg-amber-400/5'
                                                        : 'hover:bg-white/60 dark:hover:bg-slate-800/40'
                                                    }
                                                `}
                                            >
                                                {columns.map((col, idx) => (
                                                    <td key={idx} className={`px-6 py-5 relative first:pl-8 ${col.className || ''}`}>
                                                        {/* Floating Hover Indicator - Centered Pill */}
                                                        {idx === 0 && !isHighlighted && (
                                                            <div className="absolute left-2 top-2 bottom-2 w-1.5 bg-primary/0 group-hover:bg-primary rounded-full transition-all duration-500 opacity-0 group-hover:opacity-100 shadow-[0_0_15px_rgba(var(--primary),0.5)] scale-y-50 group-hover:scale-y-100" />
                                                        )}
                                                        {idx === 0 && isHighlighted && (
                                                            <div className="absolute left-2 top-2 bottom-2 w-1.5 bg-amber-400 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                                                        )}
                                                        <div className={`relative z-10 transition-transform duration-500 ${!isHighlighted && 'group-hover:translate-x-1'}`}>
                                                            {col.cell ? col.cell(row) : (row[col.accessorKey!] as React.ReactNode)}
                                                        </div>
                                                    </td>
                                                ))}
                                                {actions && (
                                                    <td className="px-6 py-5 text-right pr-8" onClick={(e) => e.stopPropagation()}>
                                                        <div className="relative z-10">
                                                            {actions(row)}
                                                        </div>
                                                    </td>
                                                )}

                                                {/* Bottom Border Glow on Hover */}
                                                <td className="absolute inset-x-4 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 underline-offset-4" colSpan={columns.length + (actions ? 1 : 0)} />
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ─── MOBILE CARDS (< md) ─── */}
            <div className="md:hidden bg-slate-50/30 dark:bg-slate-900/30">
                {/* ─── Mobile Select-All header (renders columns[0].header = checkbox) ─── */}
                {columns[0] && (
                    <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
                        <div onClick={e => e.stopPropagation()}>
                            {columns[0].header}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Select All
                        </span>
                    </div>
                )}
                <div className="space-y-4 p-4">
                    {data.map((row) => {
                        const isHighlighted = highlightedRowId === String(row[keyField]);
                        // Column[0] is often a checkbox — render it separately
                        const checkboxCol = columns[0];
                        const primaryCol = columns.find(c => c.accessorKey === 'riderName' || c.accessorKey === 'fullName') || columns[1];
                        const secondaryCol = columns.find(c => c.accessorKey === 'trievId') || columns[1];
                        const detailCols = columns.filter(c =>
                            c !== columns[0] &&
                            c !== primaryCol &&
                            c !== secondaryCol
                        );

                        return (
                            <div
                                key={String(row[keyField])}
                                onClick={() => onRowClick && onRowClick(row)}
                                className={`
                                relative rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm
                                ${onRowClick ? 'cursor-pointer active:scale-[0.98]' : ''}
                                ${isHighlighted
                                        ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10 ring-2 ring-amber-400'
                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40 hover:shadow-lg'
                                    }
                            `}
                            >
                                {/* Vertical Accent */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isHighlighted ? 'bg-amber-400' : 'bg-primary/20 group-hover:bg-primary transition-colors'}`} />

                                <div className="p-4">
                                    {/* Card Header — checkbox + name + action */}
                                    <div className="flex justify-between items-start gap-3 mb-4">
                                        {/* Checkbox column (column[0]) rendered here if it's a checkbox type */}
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            {checkboxCol && (
                                                <div
                                                    onClick={e => e.stopPropagation()}
                                                    className="flex-shrink-0 mt-0.5"
                                                >
                                                    {checkboxCol.cell ? checkboxCol.cell(row) : null}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                                                    {primaryCol?.cell ? primaryCol.cell(row) : primaryCol?.accessorKey ? String(row[primaryCol.accessorKey] || '') : ''}
                                                </div>
                                                <div className="text-[10px] font-mono font-bold tracking-widest text-slate-500 mt-1 uppercase bg-slate-100 dark:bg-slate-800 w-fit px-2 py-0.5 rounded-md">
                                                    {secondaryCol?.cell ? secondaryCol.cell(row) : secondaryCol?.accessorKey ? String(row[secondaryCol.accessorKey] || '') : ''}
                                                </div>
                                            </div>
                                        </div>
                                        {actions && (
                                            <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                                                {actions(row)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Badge Grid */}
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {detailCols.map((col, idx) => {
                                            const val = col.cell ? col.cell(row) : (col.accessorKey ? (row[col.accessorKey] as React.ReactNode) : null);
                                            const label = typeof col.header === 'string' ? col.header : null;
                                            if (!label || !val) return null;
                                            return (
                                                <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-slate-800/50 transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
                                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                        {val}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* View Detail Hint */}
                                {onRowClick && !actions && (
                                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 border-t border-border/40 flex items-center justify-end text-[10px] font-black uppercase tracking-widest text-primary gap-1.5">
                                        View Full History <ChevronRight size={14} className="animate-pulse" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}

export default ResponsiveTable;
