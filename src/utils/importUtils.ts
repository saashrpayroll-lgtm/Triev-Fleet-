import { supabase } from '@/config/supabase';
import { ImportSummary, ClientName } from '@/types';
import { logActivity } from './activityLog';
import { LedgerAPI } from '@/api/ledger';

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
            status: summary.failed === 0 ? 'success' : (summary.success === 0 ? 'failed' : 'partial'),
            errors: summary.errors.slice(0, 50), // Limit errors stored
            skipped_details: (summary.skippedDetails || []).slice(0, 100), // Limit skips stored
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Failed to log import history", e);
    }
};

// Start: Bulk Rider Import Logic
export const processRiderImport = async (
    fileData: any[],
    adminId: string,
    adminName: string,
    strictMirror = false
): Promise<ImportSummary> => {
    const summary: ImportSummary = { total: 0, success: 0, failed: 0, errors: [], updated: 0, skipped: 0, skippedDetails: [] };
    const processedRiderIds = new Set<string>();

    // 1. Pre-fetch Potential Team Leaders
    const teamLeaderMap = new Map<string, string>(); // Name -> ID
    const teamLeaderEmailMap = new Map<string, string>(); // Email -> ID
    const teamLeaderIdMap = new Set<string>(); // Valid IDs
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
            const fullNameRaw = (user.fullName || '').trim();
            const email = (user.email || '').trim().toLowerCase();
            const userId = user.id;

            if (userId) teamLeaderIdMap.add(userId);
            if (email) teamLeaderEmailMap.set(email, userId);
            if (fullNameRaw) {
                const normalizedFull = fullNameRaw.toLowerCase();
                teamLeaderMap.set(normalizedFull, userId);

                // Strategy: Extract Unique ID (e.g. "KONTI/357")
                const idMatch = fullNameRaw.match(/KONTI\s*[\/\-]?\s*\d+/i);
                if (idMatch) {
                    const numericPart = idMatch[0].match(/\d+/)?.[0];
                    if (numericPart) {
                        teamLeaderMap.set(`konti/${numericPart}`, userId);
                    }
                }

                const cleanName = fullNameRaw.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
                if (cleanName && cleanName !== normalizedFull) {
                    teamLeaderMap.set(cleanName, userId);
                }
            }
        });
    } catch (error) {
        console.error("Error pre-fetching users:", error);
    }

    // 2. High-Performance Pre-fetch: Load ALL Riders into Memory
    const riderTrievMap = new Map<string, any>();
    const riderMobileMap = new Map<string, any>();
    try {
        const { data: allRiders, error: riderError } = await supabase
            .from('riders')
            .select('*');

        if (riderError) throw riderError;
        allRiders?.forEach(r => {
            if (r.triev_id) riderTrievMap.set(String(r.triev_id).trim(), r);
            if (r.mobile_number) riderMobileMap.set(String(r.mobile_number).trim(), r);
        });
    } catch (error) {
        console.error("Error pre-fetching riders:", error);
        throw new Error("Critical: Failed to pre-fetch rider data for deduplication.");
    }

    summary.total = fileData.length;

    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2;
        let currentRiderName = '';

        try {
            // Data Prep
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => normalizedRow[normalizeKey(key)] = row[key]);

            const getValue = (keys: string[]) => {
                for (const key of keys) {
                    const val = normalizedRow[normalizeKey(key)];
                    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
                }
                return '';
            };

            currentRiderName = getValue(['Rider Name', 'Name', 'FullName', 'Full Name']);
            const trievId = getValue(['Triev ID', 'TrievId', 'ID', 'RiderId']);
            const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone', 'Contact']);
            const mobile = mobileRaw.replace(/[^0-9]/g, '');
            const chassis = getValue(['Chassis Number', 'Chassis', 'ChassisNo']);
            const teamLeaderName = getValue(['Team Leader', 'TeamLeader', 'TL', 'Base']);
            const clientRaw = getValue(['Client Name', 'Client', 'Brand']);
            const remarks = getValue(['Remarks', 'Remark', 'Note']);
            const dateRaw = getValue(['Allotment Date', 'Date', 'Joining Date']);

            if (!trievId && !mobile) throw new Error("Missing Unique Identifier (Triev ID or Mobile required)");
            if (!currentRiderName) throw new Error("Missing Rider Name");

            // Team Leader Logic
            let teamLeaderId: string | null = null;
            let finalTLName = teamLeaderName || 'Unassigned';

            if (teamLeaderName) {
                const normalizedTL = teamLeaderName.toLowerCase();
                const cleanTL = normalizedTL.replace(/\s*\(.*?\)\s*/g, '').trim();

                // 1. Direct Maps
                teamLeaderId = teamLeaderEmailMap.get(normalizedTL) ||
                    teamLeaderMap.get(normalizedTL) ||
                    teamLeaderMap.get(cleanTL) || null;

                // 2. KONTI ID Matching
                if (!teamLeaderId) {
                    const kontiMatch = teamLeaderName.match(/KONTI\s*[\/\-]?\s*\d+/i);
                    if (kontiMatch) {
                        const numeric = kontiMatch[0].match(/\d+/)?.[0];
                        if (numeric) teamLeaderId = teamLeaderMap.get(`konti/${numeric}`) || null;
                    }
                }

                // 3. Fuzzy Matching Fallback
                if (!teamLeaderId) {
                    const match = users.find(u => {
                        const dbName = (u.fullName || '').toLowerCase();
                        return dbName.includes(cleanTL) || cleanTL.includes(dbName);
                    });
                    if (match) teamLeaderId = match.id;
                }

                if (teamLeaderId) {
                    const matchedUser = users.find(u => u.id === teamLeaderId);
                    finalTLName = matchedUser?.fullName || teamLeaderName;
                } else {
                    // STORE NAME BUT NO ID (User Request)
                    finalTLName = teamLeaderName;
                }
            }

            const clientName = isValidClient(clientRaw) ? clientRaw : 'Other';
            let allotmentDate = '';
            if (dateRaw) {
                const d = new Date(dateRaw);
                if (!isNaN(d.getTime())) allotmentDate = d.toISOString();
            }

            // 3. DUPLICACY CHECK (Map-based)
            const existingRider = (trievId ? riderTrievMap.get(trievId) : null) || (mobile ? riderMobileMap.get(mobile) : null);

            if (existingRider) {
                // SMART SKIP & UPDATE LOGIC
                const updatePayload: any = {};

                // Helper: Compare and mark for update
                const addIfDiff = (dbProp: string, newVal: any) => {
                    const dbVal = existingRider[dbProp];
                    if (newVal && String(newVal).trim() !== String(dbVal || '').trim()) {
                        updatePayload[dbProp] = String(newVal).trim();
                    }
                };

                addIfDiff('rider_name', currentRiderName);
                addIfDiff('chassis_number', chassis);
                addIfDiff('remarks', remarks);
                addIfDiff('client_name', clientName);
                if (allotmentDate) addIfDiff('allotment_date', allotmentDate);

                // TL Update Logic
                if (teamLeaderId !== existingRider.team_leader_id || finalTLName !== existingRider.team_leader_name) {
                    updatePayload.team_leader_id = teamLeaderId;
                    updatePayload.team_leader_name = finalTLName;
                }

                // WALLET PROTECTION: Never update wallet_amount via bulk rider import

                if (Object.keys(updatePayload).length > 0) {
                    updatePayload.updated_at = new Date().toISOString();
                    const { error } = await supabase.from('riders').update(updatePayload).eq('id', existingRider.id);
                    if (error) throw error;
                    summary.updated = (summary.updated || 0) + 1;
                    summary.success++;
                } else {
                    summary.skipped = (summary.skipped || 0) + 1;
                    if (!summary.skippedDetails) summary.skippedDetails = [];
                    summary.skippedDetails.push({ row: rowNum, identifier: trievId || mobile, reason: "Identical Data", data: row });
                }
                processedRiderIds.add(existingRider.id);
                continue;
            }

            // 4. INSERT NEW RIDER
            const { error: insertError, data: newRider } = await supabase.from('riders').insert({
                rider_name: currentRiderName,
                triev_id: trievId,
                mobile_number: mobile,
                chassis_number: chassis,
                client_name: clientName,
                team_leader_id: teamLeaderId,
                team_leader_name: finalTLName,
                allotment_date: allotmentDate || new Date().toISOString(),
                remarks: remarks,
                wallet_amount: 0, // STRICT: Start with 0. Walle update tool handles balance.
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).select('id').single();

            if (insertError) throw insertError;
            summary.success++;
            if (newRider) processedRiderIds.add(newRider.id);

        } catch (err: any) {
            summary.failed++;
            summary.errors.push({ row: rowNum, identifier: currentRiderName || `Row ${rowNum}`, reason: err.message });
        }
    }

    // Strict Mirror (Optional deactivation)
    if (strictMirror && processedRiderIds.size > 0 && summary.success > (fileData.length * 0.1)) {
        try {
            const { data: activeRiders } = await supabase.from('riders').select('id').eq('status', 'active');
            if (activeRiders) {
                const idsToDeactivate = activeRiders.filter(r => !processedRiderIds.has(r.id)).map(r => r.id);
                if (idsToDeactivate.length > 0) {
                    await supabase.from('riders').update({ status: 'deleted', remarks: 'Removed via Sync' }).in('id', idsToDeactivate);
                    summary.success += idsToDeactivate.length;
                }
            }
        } catch (e) {
            console.error("Mirror cleanup failed", e);
        }
    }

    await logActivity({
        actionType: 'bulkImport',
        targetType: 'system',
        targetId: 'multiple',
        details: `Imported ${summary.total} records: ${summary.success} success, ${summary.updated} updated, ${summary.skipped} skipped.`,
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
    const { data: allRiders, error: fetchError } = await supabase
        .from('riders')
        .select('id, triev_id, mobile_number, rider_name, team_leader_id, wallet_amount, status');

    if (fetchError) throw fetchError;

    const trievMap = new Map<string, any>();
    const mobileMap = new Map<string, any>();
    allRiders?.forEach(r => {
        if (r.triev_id) trievMap.set(r.triev_id, r);
        if (r.mobile_number) mobileMap.set(r.mobile_number, r);
    });

    // Notification Accumulator: TL ID -> Count
    const tlNotificationCounts = new Map<string, number>();
    const nowISO = new Date().toISOString();
    const todayStr = new Date().toISOString().split('T')[0];

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

            const externalId = `RESET_${matchData.id}_${todayStr}`;
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
                    date: nowISO,
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

    // 4. Batch Touch: Metadata Updates (Drastically reduces network overhead)
    if (riderIdsToTouch.length > 0) {
        await supabase.from('riders').update({ updated_at: nowISO }).in('id', riderIdsToTouch);
    }
    if (ledgerExternalIdsToTouch.length > 0) {
        await supabase.from('wallet_ledger').update({ created_at: nowISO }).in('external_transaction_id', ledgerExternalIdsToTouch);
    }

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
    const summary: ImportSummary = { total: 0, success: 0, failed: 0, errors: [] };

    try {
        summary.total = fileData.length;

        for (let i = 0; i < fileData.length; i++) {
            const row = fileData[i];
            const rowNum = i + 2;

            let trievId = '';
            let mobile = '';

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

                trievId = getValue(['Triev ID', 'TrievId', 'ID']);
                const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone', 'Cell']);
                mobile = mobileRaw.replace(/[^0-9]/g, '');
                const amountRaw = getValue(['Amount', 'Amt', 'Collection']);

                if (!trievId && !mobile) throw new Error("Row skipped: Missing Triev ID or Mobile Number");
                if (!amountRaw) throw new Error("Row skipped: Missing Amount");

                let amount = parseCurrency(amountRaw);
                if (amount < 0) amount = Math.abs(amount);

                let riderId = null;

                const findRider = async (field: string, value: string) => {
                    let { data } = await supabase
                        .from('riders')
                        .select('id, wallet_amount, triev_id, mobile_number, team_leader_id')
                        .eq(field, value)
                        .limit(1);

                    if ((!data || data.length === 0) && !isNaN(Number(value))) {
                        const { data: numData } = await supabase
                            .from('riders')
                            .select('id, wallet_amount, triev_id, mobile_number, team_leader_id')
                            .eq(field, Number(value))
                            .limit(1);
                        if (numData && numData.length > 0) data = numData;
                    }

                    return data && data.length > 0 ? data[0] : null;
                };

                if (trievId) {
                    const numericId = trievId.replace(/[^0-9]/g, '');
                    if (numericId) {
                        let rider = await findRider('triev_id', numericId);
                        if (!rider) rider = await findRider('triev_id', `TRIEV${numericId}`);
                        if (rider) riderId = rider.id;
                    }
                }

                if (!riderId && mobile) {
                    let cleanMobile = mobile.replace(/[^0-9]/g, '');
                    if (cleanMobile.length > 10) cleanMobile = cleanMobile.slice(-10);

                    if (cleanMobile.length === 10) {
                        let rider = await findRider('mobile_number', cleanMobile);
                        if (!rider) rider = await findRider('mobile_number', `+91${cleanMobile}`);
                        if (!rider) rider = await findRider('mobile_number', `91${cleanMobile}`);
                        if (rider) riderId = rider.id;
                    }
                }

                if (!riderId) throw new Error(`Rider not found (Triev ID: ${trievId}, Mobile: ${mobile})`);

                const transactionId = row['Transaction ID'] || row['transaction_id'] || '';

                if (transactionId) {
                    const { data: existingTxn } = await supabase
                        .from('wallet_ledger')
                        .select('id')
                        .eq('metadata->>transaction_id', transactionId)
                        .limit(1);

                    if (existingTxn && existingTxn.length > 0) {
                        throw new Error(`Duplicate Transaction ID: ${transactionId}. Entry skipped.`);
                    }
                }

                let transactionDateStr = new Date().toISOString();
                const dateRaw = getValue(['Date', 'Transaction Date', 'Collection Date']);
                if (dateRaw) {
                    const d = new Date(dateRaw);
                    if (!isNaN(d.getTime())) {
                        transactionDateStr = d.toISOString();
                    } else {
                        const parts = dateRaw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
                        if (parts) {
                            transactionDateStr = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10)).toISOString();
                        }
                    }
                }

                await LedgerAPI.addTransaction({
                    riderId: riderId,
                    amount: amount,
                    type: 'DAILY_COLLECTION' as any,
                    mode: 'ADD',
                    description: `Rent Collected via Import`,
                    metadata: {
                        source: 'rent_import',
                        transaction_id: transactionId,
                        date_on_sheet: transactionDateStr,
                        adminName: adminName
                    },
                    externalId: transactionId || null,
                    source: 'IMPORT',
                    transactionDate: transactionDateStr
                });

                summary.success++;
            } catch (err: any) {
                summary.failed++;
                summary.errors.push({
                    row: rowNum,
                    identifier: trievId || mobile || `Row ${rowNum}`,
                    reason: err.message || "Unknown error",
                    data: row
                });
            }
        }
    } catch (error: any) {
        console.error("Critical error in rent import:", error);
        summary.errors.push({ row: 0, identifier: 'FILE', reason: `Fatal Error: ${error.message}` });
    }

    await logImportHistory(adminId, adminName, 'googleSheet', summary, fileData.length);
    return summary;
};
