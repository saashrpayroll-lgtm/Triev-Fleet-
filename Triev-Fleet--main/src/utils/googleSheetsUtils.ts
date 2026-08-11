import { ImportSummary } from '@/types';
import { processRiderImport, processWalletUpdate, processRentCollectionImport } from './importUtils';

// Google Sheets API configuration would typically go here
// For client-side, we might need an API key or OAuth token

interface GoogleSheetConfig {
    sheetId: string;
    range: string;
    apiKey?: string;
}

export const extractSheetIdAndGid = (rawIdOrUrl: string): { sheetId: string; gid?: string } => {
    if (!rawIdOrUrl) return { sheetId: '' };
    const str = rawIdOrUrl.trim();
    let sheetId = str;
    let gid: string | undefined = undefined;

    const gidMatch = str.match(/[?&#]gid=([0-9]+)/i);
    if (gidMatch) gid = gidMatch[1];

    const urlMatch = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
    if (urlMatch) {
        sheetId = urlMatch[1];
    }

    return { sheetId, gid };
};

export const fetchGoogleSheetData = async (config: GoogleSheetConfig): Promise<any[]> => {
    if (!config.sheetId || !config.range) {
        throw new Error("Sheet ID and Range are required");
    }

    const { sheetId, gid } = extractSheetIdAndGid(config.sheetId);
    const apiKey = config.apiKey || import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';

    // Strategy 1: Google Sheets API (Preferred if Key exists)
    if (apiKey) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${config.range}?key=${apiKey}`;

        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (!data.values || data.values.length === 0) {
                    throw new Error("No data found in the spreadsheet or range.");
                }
                return data.values;
            } else {
                console.warn(`API Fetch Failed (${response.status}). Attempting CSV fallback...`);
            }
        } catch (error) {
            console.warn("API Fetch Error. Attempting CSV fallback...", error);
        }
    }

    // Strategy 2: CSV / GViz Export (Fallback for Public Sheets "Anyone with link")
    let sheetName = '';
    if (config.range && config.range.includes('!')) {
        sheetName = config.range.split('!')[0].replace(/^'|'$/g, '').trim();
    }

    const csvUrls: string[] = [];
    if (gid !== undefined) {
        csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
        csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`);
    }
    if (sheetName) {
        csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);
        csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`);
    }
    csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);
    csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`);

    let lastError: any = null;
    for (const csvUrl of csvUrls) {
        try {
            const response = await fetch(csvUrl);
            const contentType = response.headers.get('content-type') || '';

            if (response.ok && !contentType.includes('text/html')) {
                const csvText = await response.text();
                if (!csvText.trim().startsWith('<!DOCTYPE') && !csvText.trim().startsWith('<html')) {
                    const parsed = parseCSV(csvText);
                    if (parsed && parsed.length > 0 && parsed[0].some(cell => Boolean(cell))) {
                        return parsed;
                    }
                }
            }
        } catch (err) {
            lastError = err;
        }
    }

    throw new Error(lastError?.message || "Failed to fetch Sheet data. Ensure Sheet is set to 'Anyone with the link' or check Sheet ID & Range.");
};

// Simple CSV Parser to match API 'values' format (2D array of strings)
const parseCSV = (text: string): string[][] => {
    // Strip UTF-8 BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // Skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.replace(/[\uFEFF\u00A0\r\n]/g, ' ').trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.replace(/[\uFEFF\u00A0\r\n]/g, ' ').trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentRow.length > 0 || currentCell) {
        currentRow.push(currentCell.replace(/[\uFEFF\u00A0\r\n]/g, ' ').trim());
        rows.push(currentRow);
    }
    return rows;
};

export const parseGoogleSheetData = (rawData: any[]): any[] => {
    if (!rawData || rawData.length < 1) return [];

    const headers = (rawData[0] || []).map((header: any) => 
        String(header || '').replace(/[\uFEFF\u00A0\r\n]/g, '').trim()
    );
    const rows = rawData.slice(1);

    return rows.map(row => {
        const rowData: any = {};
        headers.forEach((header: string, index: number) => {
            if (header) {
                rowData[header] = row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : '';
            }
        });
        return rowData;
    });
};

export const fetchGoogleSheetHeaders = async (config: GoogleSheetConfig): Promise<string[]> => {
    const rawData = await fetchGoogleSheetData(config);
    if (!rawData || rawData.length === 0) return [];
    return (rawData[0] || [])
        .map((h: any) => String(h || '').replace(/[\uFEFF\u00A0\r\n]/g, '').trim())
        .filter(Boolean);
};

export const syncGoogleSheet = async (
    config: GoogleSheetConfig & { columnMapping?: any; staffFilter?: any },
    adminId: string,
    adminName: string,
    mode: 'rider' | 'wallet' | 'rent_collection',
    strictMirror: boolean = false
): Promise<ImportSummary> => {
    try {
        const rawData = await fetchGoogleSheetData(config);
        
        // Resilience Check: If sheet returned 0 rows or no header, abort to protect DB data
        if (!rawData || rawData.length < 2) {
            throw new Error("Sheet returned empty or invalid data (0 rows). Sync aborted to protect existing data.");
        }

        const parsedData = parseGoogleSheetData(rawData);

        if (mode === 'rider') {
            return await processRiderImport(
                parsedData,
                adminId,
                adminName,
                strictMirror,
                config.columnMapping,
                config.staffFilter
            );
        } else if (mode === 'wallet') {
            return await processWalletUpdate(parsedData, adminId, adminName);
        } else if (mode === 'rent_collection') {
            return await processRentCollectionImport(parsedData, adminId, adminName);
        } else {
            throw new Error("Invalid sync mode selected.");
        }
    } catch (error: any) {
        console.error("Google Sheets Sync Error:", error);
        throw error;
    }
};
