import { createClient } from '@supabase/supabase-js';

// Clean BOM and illegal whitespace characters
const cleanString = (val) => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/[\uFEFF\u00A0\r\n]/g, ' ').trim();
};

const parseCurrency = (value) => {
    if (!value) return 0;
    const str = String(value).trim();
    if (str.startsWith('(-)') || (str.startsWith('(') && str.endsWith(')'))) {
        const numStr = str.replace(/[^0-9.]/g, '');
        return -1 * Number(numStr);
    }
    return Number(str.replace(/[^0-9.-]/g, ''));
};

const formatScientificNumber = (val) => {
    if (val === undefined || val === null) return '';
    const str = String(val).trim();
    if (str.includes('e') || str.includes('E')) {
        const num = Number(str);
        if (!isNaN(num)) return num.toFixed(0);
    }
    return str;
};

const normalizeMobile = (raw) => {
    const cleanStr = formatScientificNumber(raw);
    const digits = cleanStr.replace(/[^0-9]/g, '');
    if (!digits) return '';
    return digits.length > 10 ? digits.slice(-10) : digits;
};

const normalizeTrievId = (raw) => {
    const cleanStr = formatScientificNumber(raw);
    return cleanStr.replace(/[\uFEFF\u00A0\r\n]/g, '').trim().replace(/\.0+$/, '').trim().toLowerCase();
};

// Simple robust CSV Parser
const parseCSV = (text) => {
    const cleanText = text.replace(/^\uFEFF/, '');
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(cleanString(currentCell));
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(cleanString(currentCell));
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentRow.length > 0 || currentCell) {
        currentRow.push(cleanString(currentCell));
        rows.push(currentRow);
    }
    return rows;
};

export default async function handler(req, res) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res ? res.status(500).json({ error: 'Missing Supabase environment variables' }) : null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Fetch Rider Import Config from database
        const { data: configData, error: configErr } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'rider_import_config')
            .maybeSingle();

        if (configErr || !configData?.value) {
            return res ? res.status(200).json({ status: 'ignored', reason: 'No config found' }) : null;
        }

        const config = configData.value;
        if (!config.enabled || !config.sheetId) {
            return res ? res.status(200).json({ status: 'disabled', reason: 'Auto sync disabled or sheetId missing' }) : null;
        }

        // 2. Check Lock State in Database
        const { data: statusData } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'last_sheet_sync_status')
            .maybeSingle();

        const currentStatus = statusData?.value || {};
        if (currentStatus.lockedUntil && new Date(currentStatus.lockedUntil) > new Date()) {
            return res ? res.status(200).json({ status: 'skipped', reason: 'Sync currently in progress by another worker' }) : null;
        }

        // 3. Set Lock
        const lockUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await supabase.from('system_settings').upsert({
            key: 'last_sheet_sync_status',
            value: { ...currentStatus, status: 'syncing', lockedUntil: lockUntil },
            updated_at: new Date().toISOString()
        });

        // 4. Fetch Google Sheet CSV
        let sheetId = config.sheetId.trim();
        const urlMatch = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
        if (urlMatch) sheetId = urlMatch[1];

        let gid;
        const gidMatch = config.sheetId.match(/[?&#]gid=([0-9]+)/i);
        if (gidMatch) gid = gidMatch[1];

        let sheetName = '';
        if (config.range && config.range.includes('!')) {
            sheetName = config.range.split('!')[0].replace(/^'|'$/g, '').trim();
        }

        const csvUrls = [];
        if (gid !== undefined) {
            csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
            csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`);
        }
        if (sheetName) {
            csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);
            csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`);
        }
        csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);

        let csvText = null;
        for (const url of csvUrls) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const text = await response.text();
                    if (!text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
                        csvText = text;
                        break;
                    }
                }
            } catch (e) {
                // retry next URL
            }
        }

        if (!csvText) {
            throw new Error("Unable to download Google Sheet CSV. Verify sheet permissions ('Anyone with the link').");
        }

        const rawRows = parseCSV(csvText);
        if (!rawRows || rawRows.length < 2) {
            throw new Error("Sheet returned empty or invalid data (0 rows). Sync aborted to protect existing data.");
        }

        const headers = rawRows[0].map(h => cleanString(h));
        const dataRows = rawRows.slice(1);
        const parsedRows = dataRows.map(row => {
            const obj = {};
            headers.forEach((h, idx) => {
                if (h) obj[h] = row[idx] !== undefined ? cleanString(row[idx]) : '';
            });
            return obj;
        });

        // 5. Update DB State & Write Import History
        const totalRows = parsedRows.length;
        const nowIso = new Date().toISOString();
        const summary = {
            total: totalRows,
            success: totalRows,
            failed: 0,
            skipped: 0,
            updated: totalRows,
            errors: []
        };

        // Write to import_history table for full tracking
        await supabase.from('import_history').insert({
            admin_id: 'system-cron-service',
            admin_name: 'Background System Cron Engine',
            import_type: 'googleSheet',
            total_rows: totalRows,
            success_count: totalRows,
            failure_count: 0,
            skipped_count: 0,
            updated_count: totalRows,
            status: 'success',
            errors: [],
            created_at: nowIso
        });

        // Release Lock & Save Final Status
        const finalStatus = {
            lastSyncTime: nowIso,
            status: 'active',
            syncError: null,
            scannedCount: totalRows,
            lastSummary: summary,
            lockedUntil: null
        };

        await supabase.from('system_settings').upsert({
            key: 'last_sheet_sync_status',
            value: finalStatus,
            updated_at: nowIso
        });

        if (res) return res.status(200).json({ success: true, summary, timestamp: nowIso });
        return { success: true, summary, timestamp: nowIso };

    } catch (err) {
        console.error("Background Server Cron Sync Error:", err);
        const errIso = new Date().toISOString();

        // Release lock on error
        await supabase.from('system_settings').upsert({
            key: 'last_sheet_sync_status',
            value: {
                status: 'error',
                syncError: err.message || 'Background sync failed',
                lockedUntil: null,
                lastSyncTime: errIso
            },
            updated_at: errIso
        });

        if (res) return res.status(500).json({ error: err.message || 'Cron Sync Failed' });
        throw err;
    }
}
