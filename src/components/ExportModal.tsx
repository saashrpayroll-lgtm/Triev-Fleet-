import React from 'react';
import { X } from 'lucide-react';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (format: ExportFormat, columns: string[]) => void;
    availableColumns: { key: string; label: string }[];
    title?: string;
}

const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    onExport,
    availableColumns,
    title = 'Export Data',
}) => {
    const [selectedFormat, setSelectedFormat] = React.useState<ExportFormat>('excel');
    // Store selected keys
    const [selectedColumns, setSelectedColumns] = React.useState<string[]>(availableColumns.map(c => c.key));
    const [isExporting, setIsExporting] = React.useState(false);

    React.useEffect(() => {
        setSelectedColumns(availableColumns.map(c => c.key));
    }, [availableColumns]);

    const toggleColumn = (columnKey: string) => {
        setSelectedColumns(prev =>
            prev.includes(columnKey)
                ? prev.filter(c => c !== columnKey)
                : [...prev, columnKey]
        );
    };

    const selectAll = () => {
        setSelectedColumns(availableColumns.map(c => c.key));
    };

    const deselectAll = () => {
        setSelectedColumns([]);
    };

    const handleExport = async () => {
        if (selectedColumns.length === 0) {
            alert('Please select at least one column to export');
            return;
        }

        setIsExporting(true);
        try {
            await onExport(selectedFormat, selectedColumns);
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-lg w-full">
                {/* Header */}
                <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-accent rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Format Selection */}
                    <div>
                        <label className="block text-sm font-medium mb-3">Export Format</label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedFormat('csv')}
                                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${selectedFormat === 'csv'
                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                    : 'border-input hover:border-primary/50'
                                    }`}
                            >
                                CSV
                            </button>
                            <button
                                onClick={() => setSelectedFormat('excel')}
                                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${selectedFormat === 'excel'
                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                    : 'border-input hover:border-primary/50'
                                    }`}
                            >
                                Excel
                            </button>
                            <button
                                onClick={() => setSelectedFormat('pdf')}
                                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${selectedFormat === 'pdf'
                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                    : 'border-input hover:border-primary/50'
                                    }`}
                            >
                                PDF
                            </button>
                        </div>
                    </div>

                    {/* Column Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium">Select Columns</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={selectAll}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-muted-foreground">|</span>
                                <button
                                    onClick={deselectAll}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>
                        <div className="border border-input rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                            {availableColumns.map(column => (
                                <label
                                    key={column.key}
                                    className="flex items-center gap-3 p-2 hover:bg-accent rounded cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(column.key)}
                                        onChange={() => toggleColumn(column.key)}
                                        className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
                                    />
                                    <span className="text-sm">{column.label}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {selectedColumns.length} of {availableColumns.length} columns selected
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isExporting}
                        className="px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting || selectedColumns.length === 0}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                    >
                        {isExporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                                Exporting...
                            </>
                        ) : (
                            `Export as ${selectedFormat.toUpperCase()}`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
