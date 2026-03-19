import { supabase } from '@/config/supabase';
import { ImportSummary, ClientName } from '@/types';
import { logActivity } from './activityLog';
import { LedgerAPI } from '@/api/ledger';
import { parseIndianDate } from './dateUtils';

// Constants for Rider Import
export const REQUIRED_RIDER_COLUMNS = [
    'Rider Name',
    'Mobile Number',
    'Triev ID',
    'Chassis Number',
    'Client Name',
    'Team Leader', // Used for routing
    'Allotment Date',
    'Wallet Amount',
    'Remarks'
];

export const CLIENT_NAMES: ClientName[] = ['Zomato', 'Zepto', 'Blinkit', 'Uber', 'Porter', 'Rapido', 'Swiggy', 'FLK', 'Other'];

// Helper: Normalize keys (remove spaces, lowercase)
export const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, '');

// Helper: Validate Client Name
export const isValidClient = (client: string): boolean => {
    return CLIENT_NAMES.includes(client as ClientName);
};

// Helper: Parse Currency (handles "(-) 500", "500", "-500", etc.)
export const parseCurrency = (value: any): number => {
    if (!value) return 0;
    const str = String(value).trim();
    // Check for (-) pattern
    if (str.startsWith('(-)') || str.startsWith('(') && str.endsWith(')')) {
        const numStr = str.replace(/[^0-9.]/g, '');
        return -1 * Number(numStr);
    }
    // Normal cleanup
    return Number(str.replace(/[^0-9.-]/g, ''));
};

// Helper: Normalize mobile to last 10 digits (handles +91, 91, 0 prefixes)
const normalizeMobile = (raw: string): string => {
    const digits = String(raw || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    // Always use last 10 digits as canonical form
    return digits.length > 10 ? digits.slice(-10) : digits;
};

// Helper: Normalize Triev ID (strip whitespace, Excel .0 float suffix, lowercase trim)
const normalizeTrievId = (raw: string): string =>
    String(raw || '').trim().replace(/\.0+$/, '').trim();

// Helper: Log History
const logImportHistory = async (
    adminId: string,
    adminName: string,
    type: 'rider' | 'wallet' | 'googleSheet',
    summary: ImportSummary,
    totalRows: number
) => {
    try {
        await supabase.from('import_history').insert({
            admin_id: adminId,
            admin_name: adminName,
            import_type: type,
            total_rows: totalRows,
            success_count: summary.success,
            failure_count: summary.failed,
            skipped_count: summary.skipped || 0,
            updated_count: summary.updated || 0,
            status: summary.failed === 0 ? 'success' : (summary.success === 0 ? 'failed' : 'partial'),
            errors: summary.errors.slice(0, 50), // Limit errors stored
            skipped_details: (summary.skippedDetails || []).slice(0, 100), // Limit skips stored
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Failed to log import history", e);
    }
};

// Helper: chunk array for parallel batching
const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

// Start: Bulk Rider Import Logic
async function fetchAllRidersWithSelect(selectQuery: string) {
    const allData: any[] = [];
    let from = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('riders')
            .select(selectQuery)
            .range(from, from + limit - 1);
            
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < limit) break;
        from += limit;
    }
    return allData;
}

export const processRiderImport = async (
    fileData: any[],
    adminId: string,
    adminName: string,
    strictMirror = false
): Promise<ImportSummary> => {
    const summary: ImportSummary = { total: 0, success: 0, failed: 0, errors: [], updated: 0, skipped: 0, skippedDetails: [] };

    // ── 1. Pre-fetch Team Leaders ────────────────────────────────────────────
    const teamLeaderMap = new Map<string, string>();
    const teamLeaderEmailMap = new Map<string, string>();
    let users: any[] = [];
    try {
        const { data: fetchedUsers, error } = await supabase
            .from('users')
            .select('id, fullName:full_name, email, role')
            .in('role', ['teamLeader', 'admin', 'manager'])
            .range(0, 4999);
        if (error) throw error;
        users = fetchedUsers || [];
        users.forEach((user: any) => {
            const nameRaw = (user.fullName || '').trim();
            const email = (user.email || '').trim().toLowerCase();
            const uid = user.id;
            if (email) teamLeaderEmailMap.set(email, uid);
            if (nameRaw) {
                teamLeaderMap.set(nameRaw.toLowerCase(), uid);
                const clean = nameRaw.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
                if (clean) teamLeaderMap.set(clean, uid);
                const kontiMatch = nameRaw.match(/KONTI\s*[\/\-]?\s*\d+/i);
                if (kontiMatch) {
                    const num = kontiMatch[0].match(/\d+/)?.[0];
                    if (num) teamLeaderMap.set(`konti/${num}`, uid);
                }
            }
        });
    } catch (err) { console.error('Error pre-fetching users:', err); }

    // ── 2. Pre-fetch ALL Riders into memory (normalized keys) ────────────────
    //    KEY FIX: both Triev ID and Mobile are normalized the same way
    //    as we will normalize the incoming Excel values.
    const riderTrievMap = new Map<string, any>();   // normalizeTrievId(triev_id) → rider
    const riderMobileMap = new Map<string, any>();  // normalizeMobile(mobile)    → rider
    try {
        const allRiders = await fetchAllRidersWithSelect('id, triev_id, mobile_number, rider_name, chassis_number, client_name, allotment_date, team_leader_id, team_leader_name, remarks, status, inactivated_at');
        allRiders?.forEach(r => {
            const tid = normalizeTrievId(String(r.triev_id || ''));
            const mob = normalizeMobile(String(r.mobile_number || ''));
            if (tid) riderTrievMap.set(tid, r);
            if (mob) riderMobileMap.set(mob, r);
        });
    } catch (err) {
        console.error('Error pre-fetching riders:', err);
        throw new Error('Critical: Failed to pre-fetch rider data for deduplication.');
    }

    summary.total = fileData.length;

    // ── 3. PASS 1: Classify rows — NO DB calls inside this loop ─────────────
    const pendingInserts: any[] = [];
    const pendingUpdates: { id: string; payload: any; rowNum: number }[] = [];

    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2;
        let currentRiderName = '';
        try {
            const nr: any = {};
            Object.keys(row).forEach(k => nr[normalizeKey(k)] = row[k]);
            const getValue = (keys: string[]) => {
                for (const k of keys) {
                    const v = nr[normalizeKey(k)];
                    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
                }
                return '';
            };

            currentRiderName = getValue(['Rider Name', 'Name', 'FullName', 'Full Name']);
            const trievIdRaw = getValue(['Triev ID', 'TrievId', 'ID', 'RiderId']);
            const trievId = normalizeTrievId(trievIdRaw);   // ← normalize
            const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone', 'Contact']);
            const mobile = normalizeMobile(mobileRaw);       // ← normalize to last-10
            const chassis = getValue(['Chassis Number', 'Chassis', 'ChassisNo']);
            const teamLeaderName = getValue(['Team Leader', 'TeamLeader', 'TL', 'Base']);
            const clientRaw = getValue(['Client Name', 'Client', 'Brand']);
            const remarks = getValue(['Remarks', 'Remark', 'Note']);
            const dateRaw = getValue(['Allotment Date', 'Date', 'Joining Date']);

            if (!trievId && !mobile) throw new Error('Missing Unique Identifier (Triev ID or Mobile required)');
            if (!currentRiderName) throw new Error('Missing Rider Name');

            // Resolve Team Leader
            let teamLeaderId: string | null = null;
            let finalTLName = teamLeaderName || 'Unassigned';
            if (teamLeaderName) {
                const nl = teamLeaderName.toLowerCase();
                const cl = nl.replace(/\s*\(.*?\)\s*/g, '').trim();
                teamLeaderId = teamLeaderEmailMap.get(nl) || teamLeaderMap.get(nl) || teamLeaderMap.get(cl) || null;
                if (!teamLeaderId) {
                    const km = teamLeaderName.match(/KONTI\s*[\/\-]?\s*\d+/i);
                    if (km) { const num = km[0].match(/\d+/)?.[0]; if (num) teamLeaderId = teamLeaderMap.get(`konti/${num}`) || null; }
                }
                if (!teamLeaderId) {
                    const fuzzy = users.find(u => { const d = (u.fullName || '').toLowerCase(); return d.includes(cl) || cl.includes(d); });
                    if (fuzzy) teamLeaderId = fuzzy.id;
                }
                if (teamLeaderId) finalTLName = users.find(u => u.id === teamLeaderId)?.fullName || teamLeaderName;
            }

            const clientName = isValidClient(clientRaw) ? clientRaw : 'Other';
            let allotmentDate = '';
            if (dateRaw) {
                const parsed = parseIndianDate(dateRaw);
                if (parsed) allotmentDate = parsed;
            }

            // ── Lookup: prefer Triev ID, fallback to mobile ──────────────────
            const existingRider = (trievId ? riderTrievMap.get(trievId) : null)
                ?? (mobile ? riderMobileMap.get(mobile) : null);

            if (existingRider) {
                // ── PASS 1: Calculate New Status and Potential Date Reset ──
                
                const updatePayload: any = {};
                
                // NEW BEHAVIOR (Requested): Auto-reactivate inactive/deleted riders found in the import sheet.
                if (existingRider.status !== 'active') {
                    updatePayload.status = 'active';
                    updatePayload.inactivated_at = null;
                }

                // ── Check what changed ───────────────────────────────────────
                const addIfDiff = (dbProp: string, newVal: any, dbVal: any = existingRider[dbProp]) => {
                    const cleanNew = String(newVal || '').trim();
                    const cleanDb = String(dbVal || '').trim();
                    if (cleanNew && cleanNew !== cleanDb) {
                        updatePayload[dbProp] = cleanNew;
                    }
                };

                addIfDiff('rider_name', currentRiderName);
                addIfDiff('chassis_number', chassis);
                addIfDiff('remarks', remarks);
                addIfDiff('client_name', clientName);

                // CRITICAL (LOCK UNIQUE IDENTITY): Never update triev_id or mobile_number for existing riders

                // Date Handling: STRICTLY IGNORED for existing riders.
                // The Bulk Importer will NEVER update `allotment_date` or `submission_date` for existing riders.
                // Dates are permanently locked here. Any updates to dates MUST be done via "Audit & Sync Check" tool.
                if (allotmentDate && String(allotmentDate).trim() !== String(existingRider.allotment_date || '').trim()) {
                    // We intentionally do nothing here.
                    // The date in the sheet is ignored.
                }

                if (teamLeaderId !== existingRider.team_leader_id || finalTLName !== existingRider.team_leader_name) {
                    updatePayload.team_leader_id = teamLeaderId;
                    updatePayload.team_leader_name = finalTLName;
                }

                // WALLET PROTECTION: never touch wallet_amount in rider import
                // Remove any accidentally added wallet keys if they slipped in (though they shouldn't here)
                delete updatePayload.wallet_amount;

                if (Object.keys(updatePayload).length > 0) {
                    updatePayload.updated_at = new Date().toISOString();
                    pendingUpdates.push({ id: existingRider.id, payload: updatePayload, rowNum });
                } else {
                    // Truly identical — skip
                    summary.skipped = (summary.skipped || 0) + 1;
                    summary.skippedDetails!.push({ row: rowNum, identifier: trievId || mobile, reason: 'No changes detected (identical data)', data: row });
                }
            } else {
                // ── Brand new rider ─────────────────────────────────────────
                pendingInserts.push({
                    rider_name: currentRiderName,
                    triev_id: trievId || null,
                    mobile_number: mobile || null,   // store normalized 10-digit
                    chassis_number: chassis,
                    client_name: clientName,
                    team_leader_id: teamLeaderId,
                    team_leader_name: finalTLName,
                    allotment_date: allotmentDate || new Date().toISOString(),
                    remarks,
                    wallet_amount: 0,
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    _rowNum: rowNum  // temp field, stripped before insert
                });
            }
        } catch (err: any) {
            summary.failed++;
            summary.errors.push({ row: rowNum, identifier: currentRiderName || `Row ${rowNum}`, reason: err.message });
        }
    }

    // ── 4. PASS 2: Execute pending updates in parallel chunks ────────────────
    const updateChunks = chunkArray(pendingUpdates, 20);
    for (const chunk of updateChunks) {
        await Promise.all(chunk.map(async ({ id, payload, rowNum }) => {
            try {
                const { error } = await supabase.from('riders').update(payload).eq('id', id);
                if (error) throw error;
                summary.updated = (summary.updated || 0) + 1;
            } catch (err: any) {
                summary.failed++;
                summary.errors.push({ row: rowNum, identifier: id, reason: err.message });
            }
        }));
    }

    // ── 5. PASS 2: Bulk-insert all new riders in one call ───────────────────
    if (pendingInserts.length > 0) {
        // Strip temp _rowNum field before insert
        const insertBatches = chunkArray(pendingInserts, 200); // Supabase safe limit
        for (const batch of insertBatches) {
            const cleanBatch = batch.map(({ _rowNum: _, ...rest }) => rest);
            try {
                const { error } = await supabase.from('riders').insert(cleanBatch);
                if (error) throw error;
                summary.success += cleanBatch.length;
            } catch (err: any) {
                // If batch fails, fall back to individual inserts for granular error reporting
                for (const item of batch) {
                    const { _rowNum: rn, ...clean } = item;
                    try {
                        const { error } = await supabase.from('riders').insert(clean);
                        if (error) throw error;
                        summary.success++;
                    } catch (e: any) {
                        summary.failed++;
                        summary.errors.push({ row: rn, identifier: clean.rider_name || `Row ${rn}`, reason: e.message });
                    }
                }
            }
        }
    }

    // ── Strict Mirror (Optional) ─────────────────────────────────────────────
    if (strictMirror && summary.success > fileData.length * 0.1) {
        try {
            const { data: activeRiders } = await supabase.from('riders').select('id').eq('status', 'active');
            if (activeRiders) {
                const idsToDeactivate = activeRiders.filter(r => {
                    return !riderTrievMap.has(r.id) && !riderMobileMap.has(r.id);
                }).map(r => r.id);
                if (idsToDeactivate.length > 0) {
                    await supabase.from('riders').update({ status: 'deleted', remarks: 'Removed via Sync' }).in('id', idsToDeactivate);
                }
            }
        } catch (e) { console.error('Mirror cleanup failed', e); }
    }

    await logActivity({
        actionType: 'bulkImport',
        targetType: 'system',
        targetId: 'multiple',
        details: `Rider Import: ${summary.success} new, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed. Total: ${summary.total}`,
        metadata: { adminName, summary }
    });
    await logImportHistory(adminId, adminName, 'rider', summary, fileData.length);
    return summary;
};


// Start: Bulk Wallet Update Logic

export const processWalletUpdate = async (
    fileData: any[],
    adminId: string,
    adminName: string
): Promise<ImportSummary> => {
    const summary: ImportSummary = { total: 0, success: 0, failed: 0, errors: [], skipped: 0, skippedDetails: [] };
    summary.total = fileData.length;

    // 1. Pre-fetch ALL Riders for Map-based lookup (Massive performance gain)
    // Uses pagination helper to bypass 1000 row limits
    const allRiders = await fetchAllRidersWithSelect('id, triev_id, mobile_number, rider_name, team_leader_id, wallet_amount, status');

    const trievMap = new Map<string, any>();
    const mobileMap = new Map<string, any>();
    allRiders?.forEach(r => {
        if (r.triev_id) trievMap.set(r.triev_id, r);
        if (r.mobile_number) mobileMap.set(r.mobile_number, r);
    });

    // Notification Accumulator: TL ID -> Count
    const tlNotificationCounts = new Map<string, number>();
    const nowISO = new Date().toISOString();

    // Use IST today string for consistent externalId and midnight pinning
    const todayStrIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const [yr, mo, dy] = todayStrIST.split('-').map(Number);
    // Correct IST midnight for the reset baseline
    const istMidnightISO = new Date(Date.UTC(yr, mo - 1, dy, 0, 0, 0) - 5.5 * 60 * 60 * 1000).toISOString();

    // Data structures for batch processing
    const pendingUpdates: any[] = [];
    const riderIdsToTouch: string[] = [];
    const ledgerExternalIdsToTouch: string[] = [];

    // Helper: Chunk array for parallel processing
    const chunkArray = (arr: any[], size: number) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
        return result;
    };

    // 2. Initial Loop: Validation and Prep (No DB calls here)
    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2;

        try {
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => normalizedRow[normalizeKey(key)] = row[key]);

            const getValue = (keys: string[]) => {
                for (const key of keys) {
                    const val = normalizedRow[normalizeKey(key)];
                    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
                }
                return '';
            };

            const trievId = getValue(['Triev ID', 'TrievId', 'ID']);
            const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone']);
            const mobile = mobileRaw.replace(/[^0-9]/g, '');
            const amount = parseCurrency(getValue(['Wallet Amount', 'Wallet', 'Balance', 'Amount', 'Wallet balance']));

            if (!trievId && !mobile) throw new Error("Missing Identifier ('Triev ID' or 'Mobile Number')");
            if (isNaN(amount)) throw new Error("Invalid Wallet Amount");

            const matchData = (trievId ? trievMap.get(trievId) : null) || (mobile ? mobileMap.get(mobile) : null);

            if (!matchData) {
                throw new Error(`Rider not found for ${trievId || mobile}`);
            }

            // Skip Logic: Identical balance or Inactive
            if (matchData.wallet_amount === amount) {
                if (summary.skipped === undefined) summary.skipped = 0;
                summary.skipped++;
                summary.skippedDetails?.push({ row: rowNum, identifier: trievId || mobile, reason: "Balance identical", data: row });
                continue;
            }

            if (matchData.status === 'inactive') {
                if (summary.skipped === undefined) summary.skipped = 0;
                summary.skipped++;
                summary.skippedDetails?.push({ row: rowNum, identifier: trievId || mobile, reason: "Rider is Inactive", data: row });
                continue;
            }

            const externalId = `RESET_${matchData.id}_${todayStrIST}`;
            pendingUpdates.push({
                riderId: matchData.id,
                newBalance: amount,
                externalId,
                rowNum,
                tlId: matchData.team_leader_id
            });

        } catch (err: any) {
            summary.failed++;
            summary.errors.push({ row: rowNum, identifier: `Row ${rowNum}`, reason: err.message, data: row });
        }
    }

    // 3. Parallel Execution: RPC Calls in Chunks (Avoid rate limits/overhead)
    const updateBatches = chunkArray(pendingUpdates, 15); // Process 15 at a time
    for (const batch of updateBatches) {
        await Promise.all(batch.map(async (update: any) => {
            try {
                const response: any = await LedgerAPI.processDailyUpdate({
                    riderId: update.riderId,
                    newBalance: update.newBalance,
                    date: istMidnightISO, // Pin to IST Midnight to prevent "eating" today's collections
                    externalId: update.externalId
                });

                if (!response || response.success === false) {
                    throw new Error(response?.error || "Update Failed");
                }

                summary.success++;
                riderIdsToTouch.push(update.riderId);
                ledgerExternalIdsToTouch.push(update.externalId);

                if (update.tlId) {
                    tlNotificationCounts.set(update.tlId, (tlNotificationCounts.get(update.tlId) || 0) + 1);
                }
            } catch (err: any) {
                summary.failed++;
                summary.errors.push({ row: update.rowNum, identifier: update.riderId, reason: err.message });
            }
        }));
    }

    // 4. Batch Touch: Metadata Updates
    if (riderIdsToTouch.length > 0) {
        await supabase.from('riders').update({ updated_at: nowISO }).in('id', riderIdsToTouch);
    }
    // DELETED: `ledgerExternalIdsToTouch` batch touch. 
    // It manually overwrote the correct server NOW() with the client's nowISO, 
    // artificially shifting created_at and triggering the DB sync_wallet_balance 
    // to apply an older RESET balance, reverting the bulk wallet update.

    // --- BATCH NOTIFICATIONS SENDING ---
    try {
        const notifications = Array.from(tlNotificationCounts.entries()).map(([tlId, count]) => ({
            user_id: tlId,
            title: 'Bulk Wallet Update',
            message: `Admin updated wallet balance for ${count} of your riders.`,
            type: 'wallet',
            created_at: new Date().toISOString(),
            is_read: false
        }));

        if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
        }
    } catch (e) {
        console.error("Failed to send batched wallet notifications.");
    }

    // Log the overall activity
    await logActivity({
        actionType: 'walletUpdated',
        targetType: 'system',
        targetId: 'multiple',
        details: `Updated wallets for ${summary.success} riders, ${summary.skipped || 0} skipped, ${summary.failed} failures.`,
        metadata: {
            adminName,
            success: summary.success,
            skipped: summary.skipped || 0,
            failed: summary.failed
        }
    }).catch(console.error);

    // Log Import History
    await logImportHistory(adminId, adminName, 'wallet', summary, fileData.length);

    // ─── Auto-Cleanup: Remove stale DAY_OPENING_BALANCE (RESET) entries ───────
    // Only entries from PREVIOUS dates with mode=RESET and type=DAY_OPENING_BALANCE
    // are removed. Today's entries are preserved. Runs silently — any failure here
    // is non-fatal and does not affect the summary returned to the UI.
    if (summary.success > 0) {
        try {
            const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_wallet_ledger');
            if (cleanupError) {
                console.warn('[Auto-Cleanup] cleanup_wallet_ledger RPC failed:', cleanupError.message);
            } else if (cleanupResult?.deleted_count > 0) {
                console.log(`[Auto-Cleanup] Removed ${cleanupResult.deleted_count} stale DAY_OPENING_BALANCE entries from previous dates.`);
            }

            // Also silently prune old >21 days wallet ledger data to save DB space
            const { data: pruneResult, error: pruneError } = await supabase.rpc('prune_old_wallet_ledger_data');
            if (pruneError) {
                console.warn('[Auto-Cleanup] prune_old_wallet_ledger_data failed:', pruneError.message);
            } else if (pruneResult?.success && pruneResult?.deleted_count > 0) {
                console.log(`[Auto-Cleanup] Automatically pruned ${pruneResult.deleted_count} old wallet rows (>21 days).`);
            }
        } catch (cleanupErr) {
            // Non-fatal: log and move on
            console.warn('[Auto-Cleanup] Failed silently:', cleanupErr);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return summary;
};

// Rent Collection Import Logic
export const REQUIRED_RENT_COLLECTION_COLUMNS = [
    'Triev ID',
    'Rider Name',
    'Mobile Number',
    'Type',
    'Amount',
    'Date',
    'Transaction ID'
];

export const processRentCollectionImport = async (
    fileData: any[],
    adminId: string,
    adminName: string
): Promise<ImportSummary> => {
    const summary: ImportSummary = { total: 0, success: 0, failed: 0, errors: [], skipped: 0, skippedDetails: [] };

    try {
        summary.total = fileData.length;

        // 1. Pre-fetch All Riders (Cache in memory)
        const allRiders = await fetchAllRidersWithSelect('id, triev_id, mobile_number');

        const trievMap = new Map<string, string>();
        const mobileMap = new Map<string, string>();

        allRiders?.forEach(r => {
            if (r.triev_id) {
                const numericId = String(r.triev_id).replace(/[^0-9]/g, '');
                if (numericId) {
                    trievMap.set(numericId, r.id);
                    trievMap.set(`TRIEV${numericId}`, r.id);
                }
            }
            if (r.mobile_number) {
                const cleanMob = String(r.mobile_number).replace(/[^0-9]/g, '');
                const last10 = cleanMob.length > 10 ? cleanMob.slice(-10) : cleanMob;
                mobileMap.set(last10, r.id);
            }
        });

        // 2. Pre-fetch existing Transaction IDs to prevent duplicates
        const sheetTxnIds = fileData.map(r => r['Transaction ID'] || r['transaction_id']).filter(Boolean);
        const existingTxns = new Set<string>();
        if (sheetTxnIds.length > 0) {
            const txnChunks = chunkArray(sheetTxnIds, 100);
            for (const chunk of txnChunks) {
                const { data: txns } = await supabase
                    .from('wallet_ledger')
                    .select('metadata')
                    // Note: To be safe across versions, we just check metadata->>transaction_id via filter
                    // Better yet, just fetch all transactions in current month/sheet if needed.
                    // A safer way if in query is not supported perfectly on JSONB is to query explicitly:
                    .in('metadata->>transaction_id', chunk);
                txns?.forEach((t: any) => existingTxns.add(t.metadata?.transaction_id));
            }
        }

        const pendingTransactions: any[] = [];

        // 3. Process Sheet Data Fast (No DB Calls)
        for (let i = 0; i < fileData.length; i++) {
            const row = fileData[i];
            const rowNum = i + 2;

            try {
                const normalizedRow: any = {};
                Object.keys(row).forEach(key => normalizedRow[normalizeKey(key)] = row[key]);

                const getValue = (keys: string[]) => {
                    for (const key of keys) {
                        const val = normalizedRow[normalizeKey(key)];
                        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
                    }
                    return '';
                };

                const trievIdRaw = getValue(['Triev ID', 'TrievId', 'ID']);
                const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone', 'Cell']);
                let amountRaw = getValue(['Amount', 'Amt', 'Collection']);

                if (!trievIdRaw && !mobileRaw) throw new Error("Row skipped: Missing Triev ID or Mobile Number");
                if (!amountRaw) throw new Error("Row skipped: Missing Amount");

                let amount = parseCurrency(amountRaw);
                if (amount < 0) amount = Math.abs(amount);

                let riderId = null;

                if (trievIdRaw) {
                    const numericId = trievIdRaw.replace(/[^0-9]/g, '');
                    if (numericId) {
                        riderId = trievMap.get(numericId) || trievMap.get(`TRIEV${numericId}`);
                    }
                }

                if (!riderId && mobileRaw) {
                    let cleanMobile = mobileRaw.replace(/[^0-9]/g, '');
                    if (cleanMobile.length > 10) cleanMobile = cleanMobile.slice(-10);
                    if (cleanMobile.length === 10) {
                        riderId = mobileMap.get(cleanMobile);
                    }
                }

                if (!riderId) throw new Error(`Rider not found (Triev ID: ${trievIdRaw}, Mobile: ${mobileRaw})`);

                const transactionId = row['Transaction ID'] || row['transaction_id'] || row['OrdertransactionId'] || row['OrderTransactionId'] || '';
                if (transactionId && existingTxns.has(transactionId)) {
                    if (summary.skipped === undefined) summary.skipped = 0;
                    summary.skipped++;
                    summary.skippedDetails?.push({ row: rowNum, identifier: transactionId, reason: "Duplicate Transaction ID", data: row });
                    continue;
                }

                // Default to Noon IST of today if no date provided
                let transactionDateStr = ((): string => {
                    const now = new Date();
                    const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
                    return `${istDateStr}T12:00:00.000+05:30`;
                })();
                const dateRaw = getValue(['Date', 'Transaction Date', 'Collection Date', 'PaymentStamp', 'Payment Stamp']);
                if (dateRaw) {
                    const parsedDate = parseIndianDate(dateRaw);
                    if (parsedDate) {
                        transactionDateStr = parsedDate;
                    }
                }

                pendingTransactions.push({
                    riderId,
                    amount,
                    transactionId,
                    transactionDateStr,
                    rowNum,
                    row
                });

            } catch (err: any) {
                summary.failed++;
                summary.errors.push({
                    row: rowNum,
                    identifier: row['Triev ID'] || row['Mobile Number'] || `Row ${rowNum}`,
                    reason: err.message || "Unknown error",
                    data: row
                });
            }
        }

        // 4. Sequential Execution (Wait for Postgres triggers to complete safely)
        // We do not use Promise.all here because parallel inserts cause Postgres AFTER INSERT
        // triggers to aggregate concurrently before rows are committed, leading to lost daily collection totals.
        for (const tx of pendingTransactions) {
            try {
                await LedgerAPI.addTransaction({
                    riderId: tx.riderId,
                    amount: tx.amount,
                    type: 'DAILY_COLLECTION' as any,
                    mode: 'ADD',
                    description: `Rent Collected via Import`,
                    metadata: {
                        source: 'rent_import',
                        transaction_id: tx.transactionId,
                        date_on_sheet: tx.transactionDateStr,
                        adminName: adminName
                    },
                    externalId: tx.transactionId || null,
                    source: 'IMPORT',
                    transactionDate: tx.transactionDateStr
                });
                summary.success++;
            } catch (err: any) {
                summary.failed++;
                summary.errors.push({
                    row: tx.rowNum,
                    identifier: tx.riderId,
                    reason: err.message || "Failed to add transaction",
                    data: tx.row
                });
            }
        }

    } catch (error: any) {
        console.error("Critical error in rent import:", error);
        summary.errors.push({ row: 0, identifier: 'FILE', reason: `Fatal Error: ${error.message}` });
    }

    await logImportHistory(adminId, adminName, 'googleSheet', summary, fileData.length);

    // Silently prune old >21 days wallet ledger data to save DB space
    if (summary.success > 0) {
        try {
            const { data: pruneResult, error: pruneError } = await supabase.rpc('prune_old_wallet_ledger_data');
            if (pruneError) {
                console.warn('[Rent-Cleanup] prune_old_wallet_ledger_data failed:', pruneError.message);
            } else if (pruneResult?.success && pruneResult?.deleted_count > 0) {
                console.log(`[Rent-Cleanup] Automatically pruned ${pruneResult.deleted_count} old wallet rows (>21 days).`);
            }
        } catch (e) {
            console.warn('[Rent-Cleanup] Failed silently:', e);
        }
    }

    return summary;
};
