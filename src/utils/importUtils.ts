import { supabase } from '@/config/supabase';
import { ImportSummary, ClientName } from '@/types';
import { logActivity } from './activityLog';

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
            status: summary.failed === 0 ? 'success' : (summary.success === 0 ? 'failed' : 'partial'),
            errors: summary.errors.slice(0, 50), // Limit errors stored
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
    adminName: string
): Promise<ImportSummary> => {
    const summary: ImportSummary = { total: 0, success: 0, failed: 0, errors: [] };

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
                // Regex looks for "KONTI/" followed by digits, possibly with spaces
                const idMatch = fullNameRaw.match(/KONTI\s*\/?\s*\d+/i);
                if (idMatch) {
                    // Standardize ID format to "konti/123" (lowercase, no spaces)
                    const uniqueId = idMatch[0].toLowerCase().replace(/\s+/g, '');
                    teamLeaderMap.set(uniqueId, userId);
                    // console.log(`[Mapping Debug] Extracted Unique ID: '${uniqueId}' for '${fullNameRaw}' -> ID: ${userId}`);
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
            let teamLeaderId = null;
            let assignmentStatus = 'Unassigned';

            // -- Logic Enhanced with UUID/Email/Fuzzy Matching --

            // Attempt Assignment
            if (teamLeaderName) {
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
                    teamLeaderId = teamLeaderEmailMap.get(normalizedTLName);
                    console.log(`[Row ${rowNum}] Match FOUND via Email!`);
                }
                // Strategy 2a: Check Processed Unique ID (KONTI/xxx)
                const idMatch = teamLeaderName.match(/KONTI\s*\/?\s*\d+/i);
                if (idMatch) {
                    const uniqueId = idMatch[0].toLowerCase().replace(/\s+/g, '');
                    if (teamLeaderMap.has(uniqueId)) {
                        teamLeaderId = teamLeaderMap.get(uniqueId);
                        console.log(`[Row ${rowNum}] Match FOUND via Unique ID ('${uniqueId}')!`);
                    }
                }

                // Strategy 3: Check Name (Exact)
                if (!teamLeaderId && teamLeaderMap.has(normalizedTLName)) {
                    teamLeaderId = teamLeaderMap.get(normalizedTLName);
                    console.log(`[Row ${rowNum}] Match FOUND via Exact Name! ID: ${teamLeaderId}`);
                }
                // Strategy 4: Check "Clean" Input Name (remove parens from Input)
                else if (!teamLeaderId) {
                    const cleanInputName = normalizedTLName.replace(/\s*\(.*?\)\s*/g, '').trim();
                    if (teamLeaderMap.has(cleanInputName)) {
                        teamLeaderId = teamLeaderMap.get(cleanInputName);
                        console.log(`[Row ${rowNum}] Match FOUND via Clean Input Name ('${cleanInputName}')! ID: ${teamLeaderId}`);
                    }
                }

                if (!teamLeaderId) {
                    teamLeaderId = null;
                }

                // Strategy 5: Smart Linear Fallback (Partial Match) - STRICTER NOW
                if (!teamLeaderId) {
                    const cleanInputName = normalizedTLName.replace(/\s*\(.*?\)\s*/g, '').trim();
                    console.log(`[Row ${rowNum}] Exact/ID/Clean match failed for '${cleanInputName}'. Trying Strict Fallback...`);

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
                        console.log(`[Row ${rowNum}] Match FOUND via Strict Fallback! Mapped '${teamLeaderName}' -> '${fallbackMatch.fullName}'`);
                    }
                }

                if (teamLeaderId) {
                    assignmentStatus = teamLeaderName; // Keep original casing
                } else {
                    console.warn(`Row ${rowNum}: Team Leader '${teamLeaderName}' NOT FOUND. Search keys checked: '${normalizedTLName}' against map.`);
                    // Add a warning to errors list but continue
                    summary.errors.push({
                        row: rowNum,
                        identifier: riderName,
                        reason: `Warning: Team Leader '${teamLeaderName}' not found. Rider assigned to 'Unassigned'.`,
                        data: { teamLeaderName, availableUsers: 'Check console' }
                    });
                }
            }

            // Handle Client
            const clientRaw = getValue(['Client Name', 'Client', 'Brand', 'Company', 'Clientname']);
            const clientName = isValidClient(clientRaw) ? clientRaw : 'Other';

            // Handle Date
            let allotmentDate = new Date().toISOString();
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
            if (chassis) orConditions.push(`chassis_number.eq.${chassis}`);

            if (orConditions.length > 0) {
                const { data, error } = await supabase
                    .from('riders')
                    .select('id')
                    .or(orConditions.join(','))
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') {
                    console.error("Duplicate search error:", error);
                } else if (data) {
                    matchData = data;
                }
            }

            // 3. Prepare Payload
            const riderData: any = {
                rider_name: riderName,
                mobile_number: mobile,
                triev_id: trievId,
                chassis_number: chassis,
                client_name: clientName,
                client_id: getValue(['Client ID', 'ClientId']),
                wallet_amount: parseCurrency(getValue(['Wallet Amount', 'Wallet', 'Balance', 'Amount', 'Wallet balance'])),
                allotment_date: allotmentDate,
                remarks: getValue(['Remarks', 'Remark', 'Note', 'Notes']),
                team_leader_id: teamLeaderId,
                team_leader_name: assignmentStatus,
                status: 'active',
                updated_at: new Date().toISOString(),
            };

            // 4. Upsert
            if (matchData) {
                const { error } = await supabase
                    .from('riders')
                    .update(riderData)
                    .eq('id', matchData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('riders').insert({
                    ...riderData,
                    created_at: new Date().toISOString()
                });
                if (error) throw error;
            }

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

    // Log the overall activity to the main Activity page
    await logActivity({
        actionType: 'bulkImport', // Fixed actionType to match schema
        targetType: 'system',
        targetId: 'multiple',
        details: `Imported ${summary.success} riders, ${summary.failed} failures.`,
        metadata: {
            adminName,
            success: summary.success,
            failed: summary.failed
        }
    }).catch(console.error);

    // Log Import History
    await logImportHistory(adminId, adminName, 'rider', summary, fileData.length);

    return summary;
};

// Start: Bulk Wallet Update Logic
export const processWalletUpdate = async (
    fileData: any[],
    adminId: string,
    adminName: string
): Promise<ImportSummary> => {
    const summary: ImportSummary = { total: 0, success: 0, failed: 0, errors: [] };

    summary.total = fileData.length;

    // Notification Accumulator: TL ID -> Count
    const tlNotificationCounts = new Map<string, number>();

    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2;

        try {
            // Helper to get value from normalized keys (Duplicate logic but scoped)
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

            // Priority: Triev ID -> Mobile
            const trievId = getValue(['Triev ID', 'TrievId', 'ID']);
            const mobileRaw = getValue(['Mobile Number', 'Mobile', 'Phone']);
            const mobile = mobileRaw.replace(/[^0-9]/g, '');
            const amount = parseCurrency(getValue(['Wallet Amount', 'Wallet', 'Balance', 'Amount', 'Wallet balance']));

            if (!trievId && !mobile) {
                throw new Error("Missing Identifier: 'Triev ID' or 'Mobile Number' is required column.");
            }
            if (isNaN(amount)) throw new Error("Invalid Wallet Amount value.");

            let matchData = null;
            let identifierUsed = '';

            // 1. Try Triev ID first (more precise)
            if (trievId) {
                const { data } = await supabase.from('riders').select('id, rider_name, team_leader_id').eq('triev_id', trievId).maybeSingle();
                if (data) {
                    matchData = data;
                    identifierUsed = `Triev ID: ${trievId}`;
                }
            }

            // 2. Try Mobile if Triev ID failed or wasn't provided
            if (!matchData && mobile) {
                const { data } = await supabase.from('riders').select('id, rider_name, team_leader_id').eq('mobile_number', mobile).maybeSingle();
                if (data) {
                    matchData = data;
                    identifierUsed = `Mobile: ${mobile}`;
                }
            }

            if (!matchData) {
                throw new Error(`Rider not found for ${trievId ? 'Triev ID: ' + trievId : 'Mobile: ' + mobile}. Ensure rider exists in system.`);
            }

            // Update
            const { error } = await supabase.from('riders').update({
                wallet_amount: amount,
                updated_at: new Date().toISOString()
            }).eq('id', matchData.id);

            if (error) throw error;

            console.log(`Successfully updated wallet for ${matchData.rider_name} using ${identifierUsed}`);

            // Track for Notification
            if (matchData.team_leader_id) {
                tlNotificationCounts.set(matchData.team_leader_id, (tlNotificationCounts.get(matchData.team_leader_id) || 0) + 1);
            }

            summary.success++;

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
            console.log(`Sent ${notifications.length} batched wallet notifications.`);
        }
    } catch (e) {
        console.error("Failed to send batched wallet notifications:", e);
    }

    // Log the overall activity to the main Activity page
    await logActivity({
        actionType: 'walletUpdated', // Fixed actionType to match schema ('walletUpdated' is better than 'Wallet Bulk Update')
        targetType: 'system',
        targetId: 'multiple',
        details: `Updated wallets for ${summary.success} riders, ${summary.failed} failures.`,
        metadata: {
            adminName,
            success: summary.success,
            failed: summary.failed
        }
    }).catch(console.error);

    // Log Import History
    await logImportHistory(adminId, adminName, 'wallet', summary, fileData.length);

    return summary;
};

// Auto-assignment features enhanced: ID, Email, Name matching
