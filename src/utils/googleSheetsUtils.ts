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
    // This function would usually fetch data from the Google Sheets API
    // GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}?key={apiKey}

    if (!config.sheetId || !config.range) {
        throw new Error("Sheet ID and Range are required");
    }

    const apiKey = config.apiKey || 'AIzaSyDvUJI4Eg0e4G3PHdu12QKnfyR-MYyjIoc'; // Use provided key as default
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.range}?key=${apiKey}`;

    console.log(`Fetching Google Sheet: ${config.sheetId}, Range: ${config.range}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Google Sheets API Error: ${error.error?.message || response.statusText}`);
        }
        const data = await response.json();
        const values = data.values;

        if (!values || values.length === 0) {
            throw new Error("No data found in the spreadsheet.");
        }

        return values;
    } catch (error: any) {
        console.error("Google Sheets Fetch Error:", error);
        throw new Error("Failed to fetch Google Sheet data. Ensure the Sheet is Public (Viewer) or check the API Key.");
    }
};

export const parseGoogleSheetData = (rawData: any[]): any[] => {
    if (!rawData || rawData.length < 2) return [];

    const headers = rawData[0];
    const rows = rawData.slice(1);

    return rows.map(row => {
        const rowData: any = {};
        headers.forEach((header: string, index: number) => {
            rowData[header] = row[index];
        });
        return rowData;
    });
};

export const syncGoogleSheet = async (
    config: GoogleSheetConfig,
    adminId: string,
    adminName: string,
    mode: 'rider' | 'wallet' = 'rider'
): Promise<ImportSummary> => {
    try {
        const rawData = await fetchGoogleSheetData(config);
        const parsedData = parseGoogleSheetData(rawData);

        if (mode === 'rider') {
            return await processRiderImport(parsedData, adminId, adminName);
        } else {
            return await processWalletUpdate(parsedData, adminId, adminName);
        }
    } catch (error: any) {
        console.error("Google Sheets Sync Error:", error);
        throw error;
    }
};
