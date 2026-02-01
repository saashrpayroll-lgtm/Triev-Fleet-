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

    // Priority: 1. Config Key, 2. Env Var, 3. Default
    const apiKey = config.apiKey || import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || 'AIzaSyDvUJI4Eg0e4G3PHdu12QKnfyR-MYyjIoc';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.range}?key=${apiKey}`;

    console.log(`Fetching Google Sheet: ${config.sheetId}, Range: ${config.range}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            const message = error.error?.message || response.statusText;

            if (response.status === 403) {
                throw new Error("Access Denied: Ensure your Google Sheet is set to 'Anyone with the link can view' (Public).");
            } else if (response.status === 400) {
                throw new Error(`Bad Request: Check your Sheet ID and Range format. (${message})`);
            }
            throw new Error(`Google Sheets API Error: ${message}`);
        }
        const data = await response.json();
        const values = data.values;

        if (!values || values.length === 0) {
            throw new Error("No data found in the spreadsheet or range.");
        }

        return values;
    } catch (error: any) {
        console.error("Google Sheets Fetch Error:", error);
        throw error;
    }
};

export const parseGoogleSheetData = (rawData: any[]): any[] => {
    if (!rawData || rawData.length < 1) return [];

    const headers = rawData[0];
    const rows = rawData.slice(1);

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
