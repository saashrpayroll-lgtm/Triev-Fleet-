import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight, Settings2 } from 'lucide-react';
import { REQUIRED_RIDER_COLUMNS } from '@/utils/importUtils';

interface DataImportProps {
    onImport: (data: any[]) => Promise<void>;
    mode?: 'rider' | 'wallet';
}

const REQUIRED_WALLET_COLUMNS = ['Triev ID', 'Mobile Number', 'Wallet Amount'];

const DataImport: React.FC<DataImportProps> = ({ onImport, mode = 'rider' }) => {
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [rawData, setRawData] = useState<any[]>([]); // Data as array of objects with original keys
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // Required Field -> File Header
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const requiredColumns = mode === 'wallet' ? REQUIRED_WALLET_COLUMNS : REQUIRED_RIDER_COLUMNS;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const processFile = (file: File) => {
        setFile(file);
        setError(null);
        setSuccess(null);
        setRawData([]);

        const fileType = file.name.split('.').pop()?.toLowerCase();

        const handleData = (data: any[]) => {
            if (!data || data.length === 0) {
                setError("File is empty");
                return;
            }
            const headers = Object.keys(data[0]);
            setFileHeaders(headers);
            setRawData(data);

            // Auto-map columns
            const initialMapping: Record<string, string> = {};
            requiredColumns.forEach(reqCol => {
                const match = headers.find(h =>
                    h.toLowerCase().trim() === reqCol.toLowerCase().trim() ||
                    h.toLowerCase().includes(reqCol.toLowerCase()) ||
                    (reqCol === 'Mobile Number' && h.toLowerCase().includes('mobile')) ||
                    (reqCol === 'Triev ID' && h.toLowerCase().includes('triev'))
                );
                if (match) initialMapping[reqCol] = match;
            });
            // Specific alias for Team Leader -> Base
            if (!initialMapping['Team Leader']) {
                const baseHeader = headers.find(h => h.trim().toLowerCase() === 'base');
                if (baseHeader) initialMapping['Team Leader'] = baseHeader;
            }
            setColumnMapping(initialMapping);
            setStep('mapping');
        };

        if (fileType === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => handleData(results.data),
                error: (err) => setError(`CSV Parse Error: ${err.message}`)
            });
        } else if (fileType === 'xlsx' || fileType === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet);
                    handleData(jsonData);
                } catch (err) {
                    setError('Failed to parse Excel file');
                }
            };
            reader.readAsBinaryString(file);
        } else {
            setError('Unsupported file type. Please upload CSV or Excel.');
        }
    };

    const getMappedData = () => {
        return rawData.map(row => {
            const mappedRow: any = {};
            // For each required column, use the mapped header's value
            requiredColumns.forEach(reqCol => {
                const fileHeader = columnMapping[reqCol];
                if (fileHeader) {
                    mappedRow[reqCol] = row[fileHeader];
                }
            });
            // Preserve other columns? Maybe not needed for strict import, but good for context.
            // For now, strictly map required ones for cleanliness.
            return mappedRow;
        });
    };

    const handleImport = async () => {
        setStep('importing');
        try {
            const finalData = getMappedData();
            await onImport(finalData);
            setSuccess(`Successfully processed ${finalData.length} records.`);
            setStep('upload');
            setFile(null);
            setRawData([]);
        } catch (err) {
            console.error(err);
            setError('Import failed. Please check data format.');
            setStep('preview');
        }
    };

    return (
        <div className="space-y-6">
            {/* Step 1: Upload */}
            {step === 'upload' && (
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-accent/30 transition-colors">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                    />
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                            <Upload size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Upload {mode === 'rider' ? 'Rider' : 'Wallet'} Data</h3>
                            <p className="text-muted-foreground mt-1">Drag and drop or click to upload CSV/Excel</p>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                        >
                            Select File
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Mapping */}
            {step === 'mapping' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Settings2 size={20} /> Map Columns
                        </h3>
                        <div className="text-sm text-muted-foreground">
                            Map your file headers to the required system fields.
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {requiredColumns.map(reqCol => (
                            <div key={reqCol} className="bg-card border border-border p-4 rounded-lg">
                                <label className="block text-sm font-medium mb-1.5 text-primary">
                                    {reqCol} <span className="text-destructive">*</span>
                                </label>
                                <select
                                    value={columnMapping[reqCol] || ''}
                                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [reqCol]: e.target.value }))}
                                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                                >
                                    <option value="">-- Select Header --</option>
                                    {fileHeaders.map(header => (
                                        <option key={header} value={header}>{header}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            onClick={() => { setStep('upload'); setFile(null); }}
                            className="px-4 py-2 border border-input rounded-lg hover:bg-accent"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => setStep('preview')}
                            disabled={!requiredColumns.every(col => columnMapping[col])}
                            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                            Next: Preview
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Preview */}
            {(step === 'preview' || step === 'importing') && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold flex items-center gap-2">
                            <FileSpreadsheet className="text-primary" size={20} />
                            Preview: {file?.name} ({rawData.length} records)
                        </h4>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setStep('mapping')}
                                disabled={step === 'importing'}
                                className="px-4 py-2 text-muted-foreground hover:bg-accent rounded-lg"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={step === 'importing'}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium shadow-sm flex items-center gap-2"
                            >
                                {step === 'importing' ? (
                                    <>Processing...</>
                                ) : (
                                    <>Confirm Import <ArrowRight size={16} /></>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-border rounded-lg max-h-80">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-muted-foreground sticky top-0">
                                <tr>
                                    {requiredColumns.map(col => (
                                        <th key={col} className="px-4 py-3 font-medium border-b border-border">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                                {getMappedData().slice(0, 10).map((row, i) => (
                                    <tr key={i} className="hover:bg-accent/50">
                                        {requiredColumns.map(col => (
                                            <td key={col} className="px-4 py-2 border-border/50">
                                                {String(row[col] || '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {rawData.length > 10 && (
                            <div className="p-3 text-center text-muted-foreground border-t border-border bg-muted/20">
                                ...and {rawData.length - 10} more rows
                            </div>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle size={20} />
                    <p>{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 rounded-lg flex items-center gap-3">
                    <CheckCircle size={20} />
                    <p>{success}</p>
                </div>
            )}
        </div>
    );
};

export default DataImport;
