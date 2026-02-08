import { ImportSummary } from '@/types';
import { processRiderImport, processWalletUpdate } from './importUtils';

// Google Sheets API configuration would typically go here
// For client-side, we might need an API key or OAuth token

interface GoogleSheetConfig {
    sheetId: string;
    range: string;
    apiKey?: string; // Optional if using proxy or client-side key
}

export const fetchGoogleSheetData = async (config: GoogleSheetConfig): Promise<any[]> => {
    if (!config.sheetId || !config.range) {
        throw new Error("Sheet ID and Range are required");
    }

    // Priority: 1. Config Key, 2. Env Var, 3. Empty (Try Public Access)
    const apiKey = config.apiKey || import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';

    // Strategy 1: Google Sheets API (Preferred if Key exists)
    if (apiKey) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.range}?key=${apiKey}`;
        console.log(`Fetching Google Sheet via API: ${config.sheetId}, Range: ${config.range}`);

        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (!data.values || data.values.length === 0) {
                    throw new Error("No data found in the spreadsheet or range.");
                }
                return data.values;
            } else {
                // If 403, it might be Public but API Key is invalid or restricted. Fallback to CSV.
                console.warn(`API Fetch Failed (${response.status}). Attempting CSV fallback...`);
            }
        } catch (error) {
            console.warn("API Fetch Error. Attempting CSV fallback...", error);
        }
    }

    // Strategy 2: CSV Export (Fallback for Public Sheets "Anyone with link")
    console.log(`Attempting CSV Export fetch for Sheet: ${config.sheetId}`);

    // We'll use a CORS proxy if needed, or try direct if generic. 
    // Direct fetch to google docs export often has CORS issues in browser unless it's truly public and simple.
    // However, purely public sheets often allow this.
    const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=csv`;

    try {
        const response = await fetch(csvUrl);
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
            if (response.status === 403 || response.status === 401) { // auth error
                throw new Error("Access Denied: Sheet is private. Share it with 'Anyone with the link' or provide a valid API Key.");
            }
            throw new Error(`CSV Fetch Failed: ${response.statusText}`);
        }

        // Prevent HTML Login Page interpretation
        if (contentType.includes('text/html')) {
            throw new Error("Access Denied: Google returned an HTML Login Page instead of CSV. Ensure the Sheet is truly Public ('Anyone with the link').");
        }

        const csvText = await response.text();

        // Final sanity check on content
        if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
            throw new Error("Invalid CSV: Content appears to be HTML. Check Sheet permissions.");
        }

        console.log("[CSV Preview] First 100 chars:", csvText.substring(0, 100));

        return parseCSV(csvText); // We need a helper to parse CSV to 2D array

    } catch (error: any) {
        console.error("All Fetch Strategies Failed:", error);
        throw new Error(error.message || "Failed to fetch Sheet data. Ensure it is Public.");
    }
};

// Simple CSV Parser to match API 'values' format (2D array of strings)
const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // Skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell);
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentRow.length > 0 || currentCell) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }
    return rows;
};

export const parseGoogleSheetData = (rawData: any[]): any[] => {
    if (!rawData || rawData.length < 1) return [];

    const headers = rawData[0];
    const rows = rawData.slice(1);

    console.log("[Google Parse] Detetcted Headers:", headers);
    console.log("[Google Parse] First Row Data:", rows[0]);

    return rows.map(row => {
        const rowData: any = {};
        headers.forEach((header: string, index: number) => {
            // Trim headers to avoid matching issues
            const cleanHeader = (header || '').trim();
            if (cleanHeader) {
                rowData[cleanHeader] = row[index];
            }
        });
        return rowData;
    });
};

export const syncGoogleSheet = async (
    config: GoogleSheetConfig,
    adminId: string,
    adminName: string,
    mode: 'rider' | 'wallet'
): Promise<ImportSummary> => {
    try {
        const rawData = await fetchGoogleSheetData(config);
        const parsedData = parseGoogleSheetData(rawData);

        if (mode === 'rider') {
            return await processRiderImport(parsedData, adminId, adminName);
        } else if (mode === 'wallet') {
            return await processWalletUpdate(parsedData, adminId, adminName);
        } else {
            throw new Error("Invalid sync mode selected.");
        }
    } catch (error: any) {
        console.error("Google Sheets Sync Error:", error);
        throw error;
    }
};
