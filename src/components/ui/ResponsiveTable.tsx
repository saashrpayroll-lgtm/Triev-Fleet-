import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface Column<T> {
    header: string | React.ReactNode;
    accessorKey?: keyof T;
    cell?: (row: T) => React.ReactNode;
    className?: string; // e.g. "text-right"
}

export interface ResponsiveTableProps<T> {
    columns: Column<T>[];
    data: T[];
    onRowClick?: (row: T) => void;
    actions?: (row: T) => React.ReactNode;
    keyField: keyof T; // Unique key for rows (e.g. 'id')
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
            <div className="p-8 text-center text-muted-foreground animate-pulse">
                Loading data...
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground bg-muted/5 rounded-lg border border-border/50">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-border/50 shadow-sm bg-card">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className={`px-6 py-4 ${col.className || ''}`}>
                                    {col.header}
                                </th>
                            ))}
                            {actions && <th className="px-6 py-4 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {data.map((row) => (
                            <tr
                                key={String(row[keyField])}
                                onClick={() => onRowClick && onRowClick(row)}
                                className={`group hover:bg-muted/50 transition-colors duration-500 ${onRowClick ? 'cursor-pointer' : ''} ${highlightedRowId === String(row[keyField]) ? 'bg-yellow-100/80 ring-2 ring-yellow-500 ring-inset' : ''
                                    }`}
                            >
                                {columns.map((col, idx) => (
                                    <td key={idx} className={`px-6 py-4 ${col.className || ''}`}>
                                        {col.cell ? col.cell(row) : (row[col.accessorKey!] as React.ReactNode)}
                                    </td>
                                ))}
                                {actions && (
                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                        {actions(row)}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {data.map((row) => (
                    <div
                        key={String(row[keyField])}
                        className="bg-card rounded-xl border border-border/50 p-4 shadow-sm active:scale-[0.99] transition-transform"
                        onClick={() => onRowClick && onRowClick(row)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            {/* Primary Column (First Column) usually Name/ID */}
                            <div className="font-semibold text-lg">
                                {columns[0].cell ? columns[0].cell(row) : (row[columns[0].accessorKey!] as React.ReactNode)}
                            </div>
                            {actions && (
                                <div onClick={(e) => e.stopPropagation()}>
                                    {actions(row)}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 text-sm">
                            {columns.slice(1).map((col, idx) => (
                                <div key={idx} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
                                    <span className="text-muted-foreground font-medium text-xs uppercase">
                                        {typeof col.header === 'string' ? col.header : 'Label'}
                                    </span>
                                    <span className={`font-medium ${col.className || ''}`}>
                                        {col.cell ? col.cell(row) : (row[col.accessorKey!] as React.ReactNode)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {onRowClick && (
                            <div className="mt-3 pt-2 text-primary text-xs font-semibold uppercase tracking-wider flex items-center justify-end gap-1">
                                View Details <ChevronRight size={14} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ResponsiveTable;
