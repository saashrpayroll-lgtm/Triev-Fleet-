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
    adminId: string, // Kept for interface consistency if needed, or remove if not used in logs anymore
    adminName: string,
    strictMirror = false // New parameter for Google Sheets Sync
): Promise<ImportSummary> => {
    const summary: ImportSummary = { total: 0, success: 0, failed: 0, errors: [], updated: 0, skipped: 0, skippedDetails: [] };
    const processedRiderIds = new Set<string>();

    // Pre-fetch Users to map Name -> ID (Auto-assign Team Leader)
    const teamLeaderMap = new Map<string, string>(); // Name -> ID
    const teamLeaderEmailMap = new Map<string, string>(); // Email -> ID
    const teamLeaderIdMap = new Set<string>(); // Valid IDs used for validation
    let users: any[] | null = null;

    try {
        // console.log("Fetching users for Team Leader assignment...");
        const { data: fetchedUsers, error } = await supabase
            .from('users')
            .select('id, fullName:full_name, email, role')
            .in('role', ['teamLeader', 'admin', 'manager'])
            .range(0, 4999);

        if (error) throw error;
        users = fetchedUsers || [];
        // console.log(`[Import] Loaded ${users.length} potential Team Leaders.`);

        if (error) throw error;

        users?.forEach((user: any) => {
            const fullNameRaw = (user.fullName || '').trim();
            const email = (user.email || '').trim().toLowerCase();
            const userId = user.id;

            // Strategy 1: Map exact ID
            if (userId) teamLeaderIdMap.add(userId);

            // Strategy 2: Map exact Email
            if (email) teamLeaderEmailMap.set(email, userId);

            // Strategy 3: Map Normalized Names
            if (fullNameRaw) {
                const normalizedFull = fullNameRaw.toLowerCase();
                teamLeaderMap.set(normalizedFull, userId);

                // Strategy 4: Extract Unique ID (e.g. "KONTI/357")
                // Regex looks for "KONTI" followed by optional space/slash and digits
                const idMatch = fullNameRaw.match(/KONTI\s*[\/\-]?\s*\d+/i);
                if (idMatch) {
                    // Simpler: Just extract numbers and prefix
                    const numericPart = idMatch[0].match(/\d+/)?.[0];
                    if (numericPart) {
                        const stdId = `konti/${numericPart}`;
                        teamLeaderMap.set(stdId, userId);
                        // console.log(`[Mapping] ID '${stdId}' -> User: ${fullNameRaw}`);
                    }
                }

                // Strategy 5: Map "Clean" Name (remove content in parens e.g. "Name (ID)" -> "name")
                // Example: "Om Prakash Singh ( KONTI/357 )" -> "om prakash singh"
                const cleanName = fullNameRaw.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
                if (cleanName && cleanName !== normalizedFull) {
                    teamLeaderMap.set(cleanName, userId);
                }
            }
        });
        // console.log(`Loaded ${users?.length} users. Identifiers mapped: ${teamLeaderMap.size} Names/Aliases, ${teamLeaderEmailMap.size} Emails.`);
        // console.log("[Debug] Loaded Team Leaders:", Array.from(teamLeaderMap.keys()));
    } catch (error) {
        console.error("Error fetching users for validation:", error);
    }

    summary.total = fileData.length;

    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2;
        let riderName = '';
        let mobile = '';

        try {
            // 1. Validation & Data Prep
            // Helper to get value from normalized keys
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => {
                normalizedRow[normalizeKey(key)] = row[key];
            });

            const getValue = (keys: string[]) => {
                for (const key of keys) {
                    const val = normalizedRow[normalizeKey(key)];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        return String(val).trim();
                    }
                }
                return '';
            };

            riderName = getValue(['Rider Name', 'Name', 'RiderName', 'Full Name', 'FullName']);
            const trievId = getValue(['Triev ID', 'TrievId', 'ID', 'Rider id', 'RiderId']);
            const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone', 'Cell', 'Contact']);
            mobile = mobileRaw.replace(/[^0-9]/g, '');
            const chassis = getValue(['Chassis Number', 'Chassis', 'ChassisNo', 'Chasiss number', 'Chasiss Number']);

            if (!trievId && !mobile && !chassis) {
                throw new Error("Missing Identifier (Triev ID, Mobile, or Chassis required)");
            }
            if (!riderName) throw new Error("Missing Rider Name");

            // Check for 'Team Leader' OR 'Base' column
            const teamLeaderName = getValue(['Team Leader', 'TeamLeader', 'TL', 'Base', 'Hub', 'Team Leader name']);
            let teamLeaderId: string | null = null;
            let assignmentStatus = 'Unassigned';

            // -- Logic Enhanced with UUID/Email/Fuzzy Matching --

            // Attempt Assignment
            if (teamLeaderName && users) {
                const normalizedTLName = teamLeaderName.toLowerCase();
                // Debugging specific row match
                // console.log(`[Row ${rowNum}] Checking Team Leader: '${teamLeaderName}' (Normalized: '${normalizedTLName}')`);

                // Strategy 1: Check if input is a valid UUID
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(teamLeaderName) && teamLeaderIdMap.has(teamLeaderName)) {
                    teamLeaderId = teamLeaderName;
                    // console.log(`[Row ${rowNum}] Match FOUND via UUID!`);
                }
                // Strategy 2: Check Email
                else if (teamLeaderEmailMap.has(normalizedTLName)) {
                    teamLeaderId = teamLeaderEmailMap.get(normalizedTLName) || null;
                    // console.log(`[Row ${rowNum}] Match FOUND via Email!`);
                }
                // Strategy 2a: Check Processed Unique ID (KONTI/xxx)
                const idMatch = teamLeaderName.match(/KONTI\s*[\/\-]?\s*\d+/i);
                if (idMatch) {
                    const numericPart = idMatch[0].match(/\d+/)?.[0];
                    if (numericPart) {
                        const stdId = `konti/${numericPart}`;
                        if (teamLeaderMap.has(stdId)) {
                            teamLeaderId = teamLeaderMap.get(stdId) || null;
                            // console.log(`[Row ${rowNum}] Match FOUND via Unique ID!`);
                        }
                    }
                }

                // Strategy 3: Check Name (Exact)
                if (!teamLeaderId && teamLeaderMap.has(normalizedTLName)) {
                    teamLeaderId = teamLeaderMap.get(normalizedTLName) || null;
                    // console.log(`[Row ${rowNum}] Match FOUND via Exact Name!`);
                }
                // Strategy 4: Check "Clean" Input Name (remove parens from Input)
                else if (!teamLeaderId) {
                    const cleanInputName = normalizedTLName.replace(/\s*\(.*?\)\s*/g, '').trim();
                    if (teamLeaderMap.has(cleanInputName)) {
                        teamLeaderId = teamLeaderMap.get(cleanInputName) || null;
                        // console.log(`[Row ${rowNum}] Match FOUND via Clean Input Name!`);
                    }
                }

                if (!teamLeaderId) {
                    teamLeaderId = null;
                }

                // Strategy 5: Smart Linear Fallback (Partial Match) - STRICTER NOW
                if (!teamLeaderId) {
                    const cleanInputName = normalizedTLName.replace(/\s*\(.*?\)\s*/g, '').trim();
                    // console.log(`[Row ${rowNum}] Exact/ID/Clean match failed for '${cleanInputName}'. Trying Strict Fallback...`);

                    const fallbackMatch = users?.find((u: any) => {
                        const dbName = (u.fullName || '').toLowerCase();

                        // STRICTER RULES:
                        // 1. If Input has a Unique ID (KONTI/...), ONLY match if DB name contains THAT ID.
                        //    (Prevents "Mohit (KONTI/045)" matching "Mohit Prajapti (KONTI/205)")
                        const inputIdMatch = normalizedTLName.match(/konti\s*\/?\s*\d+/i);
                        const dbIdMatch = dbName.match(/konti\s*\/?\s*\d+/i);

                        if (inputIdMatch && dbIdMatch) {
                            // If both have IDs, they MUST match.
                            const inputId = inputIdMatch[0].replace(/\s+/g, '');
                            const dbId = dbIdMatch[0].replace(/\s+/g, '');
                            if (inputId !== dbId) return false;
                        }

                        // 2. Fallback to name containment only if IDs check passed (or didn't exist)
                        return dbName.includes(cleanInputName) || cleanInputName.includes(dbName);
                    });

                    if (fallbackMatch) {
                        teamLeaderId = fallbackMatch.id;
                        // console.log(`[Row ${rowNum}] Match FOUND via Strict Fallback!`);
                    }
                }

                if (teamLeaderId) {
                    // Update assignment status to be the DB User's Name if we found a match (Clean Data)
                    // We need to find the user object again or store it in map.
                    // Improving efficiency: Map stores ID. Users array has details.
                    const matchedUser = users?.find((u: any) => u.id === teamLeaderId);
                    assignmentStatus = matchedUser?.fullName || teamLeaderName;
                } else {
                    console.warn(`Row ${rowNum}: Team Leader NOT FOUND.`);
                    // Add a warning to errors list but continue
                    summary.errors.push({
                        row: rowNum,
                        identifier: riderName,
                        reason: `Warning: Team Leader not found. Rider assigned to 'Unassigned'.`,
                        data: { availableUsers: 'Check DB' }
                    });
                }
            }

            // Handle Client
            const clientRaw = getValue(['Client Name', 'Client', 'Brand', 'Company', 'Clientname']);
            const clientName = isValidClient(clientRaw) ? clientRaw : 'Other';

            // Handle Date
            let allotmentDate: string | undefined = undefined;
            const dateRaw = getValue(['Allotment Date', 'Date', 'Alloted Date', 'Joining Date', 'Allotment', 'Allotment date']);
            if (dateRaw) {
                const d = new Date(dateRaw);
                if (!isNaN(d.getTime())) {
                    allotmentDate = d.toISOString();
                }
            }

            // 2. Optimized Duplicate Detection
            let matchData = null;
            const orConditions = [];
            if (trievId) orConditions.push(`triev_id.eq.${trievId}`);
            if (mobile) orConditions.push(`mobile_number.eq.${mobile}`);
            // User Request: Do NOT use Chassis for duplicate check. Only ID and Mobile.
            // if (chassis) orConditions.push(`chassis_number.eq.${chassis}`);

            if (orConditions.length > 0) {
                const { data, error } = await supabase
                    .from('riders')
                    .select('id, triev_id, mobile_number')
                    .or(orConditions.join(','))
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') {
                    console.error("Duplicate search error:", error);
                } else if (data) {
                    matchData = data;
                }
            }

            // 3. Handle Existing Rider (Smart Update with Change Detection)
            if (matchData) {
                const updatePayload: any = {};

                // Helper to only add if changed
                const addIfChanged = (field: string, newValue: any, currentValue: any) => {
                    if (newValue !== undefined && newValue !== null && String(newValue).trim() !== '' && String(newValue).trim() !== String(currentValue || '')) {
                        updatePayload[field] = String(newValue).trim();
                    }
                };

                addIfChanged('rider_name', riderName, (matchData as any).rider_name);

                // EXCLUSION: wallet_amount is NO LONGER updated here.

                if (chassis && chassis !== (matchData as any).chassis_number) updatePayload.chassis_number = chassis;
                if (clientName && clientName !== 'Other' && clientName !== (matchData as any).client_name) updatePayload.client_name = clientName;

                const clientId = getValue(['Client ID', 'ClientId']);
                if (clientId && clientId !== (matchData as any).client_id) updatePayload.client_id = clientId;

                const remarks = getValue(['Remarks', 'Remark', 'Note', 'Notes']);
                if (remarks && remarks !== (matchData as any).remarks) updatePayload.remarks = remarks;

                if (allotmentDate && allotmentDate !== (matchData as any).allotment_date) updatePayload.allotment_date = allotmentDate;

                if (teamLeaderId && teamLeaderId !== (matchData as any).team_leader_id) {
                    updatePayload.team_leader_id = teamLeaderId;
                    updatePayload.team_leader_name = assignmentStatus;
                }

                // Only update if there are changes
                if (Object.keys(updatePayload).length > 0) {
                    updatePayload.updated_at = new Date().toISOString();
                    const { error } = await supabase
                        .from('riders')
                        .update(updatePayload)
                        .eq('id', (matchData as any).id);

                    if (error) {
                        summary.errors.push({
                            row: rowNum, identifier: riderName,
                            reason: "Update Failed: " + error.message, data: row
                        });
                        summary.failed++;
                    } else {
                        summary.updated = (summary.updated || 0) + 1;
                        summary.success++;
                        processedRiderIds.add((matchData as any).id);
                    }
                } else {
                    summary.skipped = (summary.skipped || 0) + 1;
                    if (!summary.skippedDetails) summary.skippedDetails = [];
                    summary.skippedDetails.push({
                        row: rowNum, identifier: riderName || trievId || mobile,
                        reason: "Exact Match found. No changes detected.", data: row
                    });
                    processedRiderIds.add((matchData as any).id);
                }
                continue;
            }

            // 4. Prepare Payload (Only for NEW riders)
            const riderData: any = {
                rider_name: riderName,
                mobile_number: mobile,
                triev_id: trievId,
                chassis_number: chassis,
                client_name: clientName,
                client_id: getValue(['Client ID', 'ClientId']),
                // WALLET EXCLUSION: wallet_amount is NO LONGER set here. Default is 0.
                allotment_date: allotmentDate || new Date().toISOString(),
                remarks: getValue(['Remarks', 'Remark', 'Note', 'Notes']),
                team_leader_id: teamLeaderId,
                team_leader_name: assignmentStatus,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // 5. Insert New Rider
            const { error, data: insertedRider } = await supabase.from('riders').insert(riderData).select('id').single();
            if (error) throw error;
            if (insertedRider) {
                processedRiderIds.add(insertedRider.id);
            }

            // STRICT WALLET RULE:
            // "New Rider Import" does NOT create wallet transactions.
            // Wallet Balance will be set by the "Bulk Wallet Update" file (Day Opening Balance).
            // We just create the rider record here.

            summary.success++;

        } catch (err: any) {
            summary.failed++;
            summary.errors.push({
                row: rowNum,
                identifier: riderName || (mobile ? `Mobile: ${mobile}` : `Row ${rowNum}`),
                reason: err.message || "Unknown error",
                data: row
            });
        }
    }

    // --- STRICT MIRROR CLEANUP ---
    if (strictMirror && processedRiderIds.size > 0 && summary.success > (fileData.length * 0.1)) {
        // Safety guard: Ensure at least some success before wiping out data
        try {
            const { data: activeRiders, error: activeError } = await supabase
                .from('riders')
                .select('id, status')
                .in('status', ['active']);

            if (!activeError && activeRiders) {
                const idsToDeactivate = activeRiders
                    .filter(r => !processedRiderIds.has(r.id))
                    .map(r => r.id);

                if (idsToDeactivate.length > 0) {
                    console.log(`[Strict Mirror] Deactivating ${idsToDeactivate.length} riders missing from Google Sheet`);

                    // Bulk update to deleted status
                    const { error: deactivateError } = await supabase
                        .from('riders')
                        .update({
                            status: 'deleted',
                            remarks: 'Auto-removed via Strict Mirror Sync (Not found in Sheet)',
                            updated_at: new Date().toISOString()
                        })
                        .in('id', idsToDeactivate);

                    if (deactivateError) {
                        console.error("[Strict Mirror] Failed to bulk deactivate riders:", deactivateError);
                    } else {
                        summary.success += idsToDeactivate.length; // Count cleanup as success operations
                        summary.errors.push({
                            row: 0,
                            identifier: 'Strict Mirror Cleanup',
                            reason: `Successfully deactivated ${idsToDeactivate.length} riders not found in the Google Sheet.`,
                            data: {}
                        });
                    }
                }
            }
        } catch (err) {
            console.error("[Strict Mirror] Cleanup failed:", err);
        }
    }

    // Log the overall activity to the main Activity page
    await logActivity({
        actionType: 'bulkImport',
        targetType: 'system',
        targetId: 'multiple',
        details: `Imported ${summary.success} riders (${summary.updated || 0} updated), ${summary.skipped || 0} skipped, ${summary.failed} failures.`,
        metadata: {
            adminName,
            success: summary.success,
            updated: summary.updated || 0,
            skipped: summary.skipped || 0,
            failed: summary.failed
        }
    }).catch(console.error);

    // Log Import History
    await logImportHistory(adminId, adminName, 'rider', summary, fileData.length);

    if (summary.failed > 0 || (summary.skipped || 0) > 0) {
        console.warn(`[Import] ${summary.failed} failed, ${summary.skipped} skipped.`);
    }

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
            // console.log(`Sent ${notifications.length} batched wallet notifications.`);
        }
    } catch (e) {
        console.error("Failed to send batched wallet notifications.");
    }

    // Log the overall activity to the main Activity page
    await logActivity({
        actionType: 'walletUpdated', // Fixed actionType to match schema ('walletUpdated' is better than 'Wallet Bulk Update')
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

    return summary;
};

// Auto-assignment features enhanced: ID, Email, Name matching
// Rent Collection Import Logic
export const REQUIRED_RENT_COLLECTION_COLUMNS = [
    'Triev ID',
    'Rider Name',
    'Mobile Number',
    'Type',
    'Amount',
    'Date', // Optional: For backdated entries
    'Transaction ID' // Added for duplicate prevention
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
            const rowNum = i + 2; // +1 for header, +1 for 0-index

            let trievId = '';
            let mobile = '';
            // let riderName = ''; // Optional if needed for error report

            try {
                // normalize keys
                const normalizedRow: any = {};
                Object.keys(row).forEach(key => {
                    normalizedRow[normalizeKey(key)] = row[key];
                });

                const getValue = (keys: string[]) => {
                    for (const key of keys) {
                        const val = normalizedRow[normalizeKey(key)];
                        if (val !== undefined && val !== null && String(val).trim() !== '') {
                            return String(val).trim();
                        }
                    }
                    return '';
                };

                trievId = getValue(['Triev ID', 'TrievId', 'ID']);
                const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone', 'Cell']);
                mobile = mobileRaw.replace(/[^0-9]/g, '');
                const amountRaw = getValue(['Amount', 'Amt', 'Collection']);

                if (!trievId && !mobile) {
                    throw new Error("Row skipped: Missing Triev ID or Mobile Number");
                }
                if (!amountRaw) {
                    throw new Error("Row skipped: Missing Amount");
                }

                // Amount logic: "Collection" means ADD to wallet (Credit).
                // User said: "currunt wallet positive me he to ... plus ho jayega"
                // "currunt wallet status Nagetive me he to ... less hoge positive ki taraf badega" (+,-)
                // This essentially means: New Balance = Old Balance + Collected Amount.
                // We treat the input amount as absolute positive value usually, but let's parse it safely.
                let amount = parseCurrency(amountRaw);
                if (amount < 0) amount = Math.abs(amount); // Assume collection is always positive inflow

                // 1. Find Rider (Robust Search)
                let riderId = null;
                // let teamLeaderId = null; // Unused
                // let currentBalance = 0; // Unused



                // Helper to search rider by exact field
                // Tries both String and Number to handle DB type differences
                const findRider = async (field: string, value: string) => {
                    // 1. Try as String
                    let { data } = await supabase
                        .from('riders')
                        .select('id, wallet_amount, triev_id, mobile_number, team_leader_id')
                        .eq(field, value)
                        .limit(1);

                    // 2. If valid number, Try as Number (for Integer/BigInt columns)
                    if ((!data || data.length === 0) && !isNaN(Number(value))) {
                        const numVal = Number(value);
                        const { data: numData } = await supabase
                            .from('riders')
                            .select('id, wallet_amount, triev_id, mobile_number, team_leader_id')
                            .eq(field, numVal)
                            .limit(1);
                        if (numData && numData.length > 0) data = numData;
                    }

                    return data && data.length > 0 ? data[0] : null;
                };

                // NOTE: 'findRiderFuzzy' removed because ILIKE on Numeric columns fails without casting,
                // and casting caused 400 errors. We stick to robust exact matching for now.

                // Strategy A: Triev ID Matching
                // User requirement: Input is always numeric (e.g., "23933", "27443")
                // DB might have "23933" OR "TRIEV23933"
                if (trievId) {
                    const numericId = trievId.replace(/[^0-9]/g, ''); // Ensure pure numeric

                    if (numericId) {
                        // 1. Try Exact Numeric (matches "23933" in DB)
                        let rider = await findRider('triev_id', numericId);

                        // 2. Try with TRIEV prefix (matches "TRIEV23933" in DB)
                        if (!rider) {
                            rider = await findRider('triev_id', `TRIEV${numericId}`);
                        }

                        if (rider) {
                            riderId = rider.id;
                            // teamLeaderId = rider.team_leader_id;
                        }
                    }
                }

                // Strategy B: Mobile Matching
                // User requirement: Inputs like "8929829059", "+918929829059", "918929829059"
                // Logic: Extract last 10 digits. Check DB for 10-digit, 91+10-digit, +91+10-digit.
                if (!riderId && mobile) {
                    let cleanMobile = mobile.replace(/[^0-9]/g, ''); // Remove non-digits

                    // Extract last 10 digits if longer (handles 91/0 prefix)
                    if (cleanMobile.length > 10) {
                        cleanMobile = cleanMobile.slice(-10);
                    }

                    if (cleanMobile.length === 10) {
                        // 1. Try exact 10 digits (e.g., "8929829059")
                        let rider = await findRider('mobile_number', cleanMobile);

                        // 2. Try with +91 (e.g., "+918929829059")
                        if (!rider) {
                            rider = await findRider('mobile_number', `+91${cleanMobile}`);
                        }

                        // 3. Try with 91 (e.g., "918929829059")
                        if (!rider) {
                            rider = await findRider('mobile_number', `91${cleanMobile}`);
                        }

                        if (rider) {
                            riderId = rider.id;
                            // teamLeaderId = rider.team_leader_id;
                        }
                    }
                }



                if (!riderId) {
                    throw new Error(`Rider not found (Triev ID: ${trievId}, Mobile: ${mobile})`);
                }

                const transactionId = row['Transaction ID'] || row['transaction_id'] || '';

                // 2. Duplicate Check using wallet_ledger
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

                // 4. Update Wallet via LedgerAPI
                // Collection = Credit = ADD mode (Standard Wallet: Adds to balance)
                // 4. Update Wallet via LedgerAPI
                // Collection = Credit = ADD mode (Standard Wallet: Adds to balance)
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

                // AUTO-SYNC SNAPSHOT REMOVED:
                // User Workflow: Snapshot is set ONLY by "Bulk Wallet Update" (Midnight Master).
                // Rent Collection should only ADD the transaction and update System Balance.
                // We do NOT update the Snapshot here, so that Snapshot acts as "Opening Balance".
                // if (txnResult && (txnResult as any).new_balance !== undefined) {
                //    await LedgerAPI.processSnapshot({...});
                // }

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
        summary.errors.push({
            row: 0,
            identifier: 'FILE',
            reason: `Fatal Error: ${error.message}`
        });
    }

    // Log Import History
    await logImportHistory(adminId, adminName, 'googleSheet', summary, fileData.length);

    return summary;
};
