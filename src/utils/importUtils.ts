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
        await supabase.from('importHistory').insert({
            adminId,
            adminName,
            importType: type,
            totalRows,
            successCount: summary.success,
            failureCount: summary.failed,
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
    // Supabase rate limits/concurrency handling
    // We'll process in small chunks to avoid overwhelming the client/connection

    // Pre-fetch Team Leaders to map Name -> ID
    const teamLeaderMap = new Map<string, string>(); // Name -> ID
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, fullName:full_name') // Aliasing for compatibility
            .eq('role', 'teamLeader');

        if (error) throw error;

        users?.forEach((user: any) => {
            teamLeaderMap.set(user.fullName.toLowerCase(), user.id);
        });
    } catch (error) {
        console.error("Error fetching team leaders:", error);
        throw new Error("Failed to fetch Team Leaders for validation.");
    }

    summary.total = fileData.length;

    // Process row by row for ensuring correct duplicate logic
    // (Batched queries for duplicates could be faster but much more complex to implement correctly with the OR logic)
    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2; // Assuming header is row 1

        try {
            // 1. Validation
            if (!row['Triev ID'] && !row['Mobile Number'] && !row['Chassis Number']) {
                throw new Error("Missing Identifier (Triev ID, Mobile, or Chassis required)");
            }
            if (!row['Rider Name']) throw new Error("Missing Rider Name");

            const teamLeaderName = row['Team Leader']?.trim();
            const teamLeaderId = teamLeaderMap.get(teamLeaderName?.toLowerCase());

            if (!teamLeaderId) {
                throw new Error(`Team Leader '${teamLeaderName}' not found`);
            }

            // 2. Data Preparation
            const mobile = String(row['Mobile Number'] || '').replace(/[^0-9]/g, '');
            const clientName = isValidClient(row['Client Name']) ? row['Client Name'] : 'Other';

            // Handle Date
            let allotmentDate = new Date().toISOString();
            if (row['Allotment Date']) {
                const d = new Date(row['Allotment Date']);
                if (!isNaN(d.getTime())) {
                    allotmentDate = d.toISOString();
                }
            }

            // 3. Duplicate Detection Logic 
            const conditions = [];

            if (row['Triev ID']) conditions.push(`trievId.eq.${row['Triev ID']}`);
            if (mobile) conditions.push(`mobileNumber.eq.${mobile}`);
            // Note: Supabase OR syntax is tricky with mixed fields.
            // Simplest robust way is to query based on hierarchy or construct explicit OR string

            let matchData = null;

            // Try explicit independent checks if OR is too complex or just chain them
            // Or use .or() syntax: .or(`trievId.eq.${id},mobileNumber.eq.${mobile}`)
            // But we need to handle missing values safely.

            let orString = '';
            if (row['Triev ID']) orString += `triev_id.eq.${row['Triev ID']},`;
            if (mobile) orString += `mobile_number.eq.${mobile},`;
            if (row['Chassis Number']) orString += `chassis_number.eq.${row['Chassis Number']},`;

            if (orString.endsWith(',')) orString = orString.slice(0, -1);

            if (orString) {
                const { data, error } = await supabase.from('riders').select('id').or(orString).maybeSingle();
                if (error && error.code !== 'PGRST116') { // PGRST116 is "one row expected" failure if multiple exist, but maybeSingle handles it mostly?
                    // actually .or can return multiple. .maybeSingle() returns one or null.
                    // If multiple match, we take the first one found essentially merging them.
                }
                matchData = data;
            }

            const riderData: any = {
                rider_name: row['Rider Name'],
                mobile_number: mobile,
                triev_id: row['Triev ID'] || '',
                chassis_number: row['Chassis Number'] || '',
                client_name: clientName as ClientName,
                client_id: row['Client ID'] || '',
                wallet_amount: parseCurrency(row['Wallet Amount'] || 0),
                allotment_date: allotmentDate,
                remarks: row['Remarks'] || '',
                team_leader_id: teamLeaderId,
                team_leader_name: teamLeaderName,
                status: 'active',
                updated_at: new Date().toISOString(),
            };

            if (matchData) {
                // Update Existing
                const { error } = await supabase
                    .from('riders')
                    .update(riderData)
                    .eq('id', matchData.id);
                if (error) throw error;
            } else {
                // Create New
                const newRider = {
                    ...riderData,
                    created_at: new Date().toISOString(),
                    // deleted_at is undefined/null by default in DB structure usually
                };
                const { error } = await supabase.from('riders').insert(newRider);
                if (error) throw error;
            }

            summary.success++;

        } catch (err: any) {
            summary.failed++;
            summary.errors.push({
                row: rowNum,
                identifier: row['Rider Name'] || `Row ${rowNum}`,
                reason: err.message || "Unknown error",
                data: row
            });
        }
    }

    // Log the overall activity to the main Activity page
    await logActivity({
        actionType: 'Rider Bulk Import',
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

    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2;

        try {
            // Priority: Triev ID -> Mobile
            const trievId = row['Triev ID']?.trim();
            const mobile = String(row['Mobile Number'] || '').replace(/[^0-9]/g, '');
            const amount = parseCurrency(row['Wallet Amount']);

            if (!trievId && !mobile) throw new Error("Missing Triev ID or Mobile Number");
            if (isNaN(amount)) throw new Error("Invalid Wallet Amount");

            let matchData = null;
            if (trievId) {
                const { data } = await supabase.from('riders').select('id').eq('triev_id', trievId).maybeSingle();
                matchData = data;
            } else if (mobile) {
                const { data } = await supabase.from('riders').select('id').eq('mobile_number', mobile).maybeSingle();
                matchData = data;
            }

            if (!matchData) {
                throw new Error(`Rider not found for ID: ${trievId || mobile}`);
            }

            // Update
            const { error } = await supabase.from('riders').update({
                wallet_amount: amount, // Direct set
                updated_at: new Date().toISOString()
            }).eq('id', matchData.id);

            if (error) throw error;

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

    // Log the overall activity to the main Activity page
    await logActivity({
        actionType: 'Wallet Bulk Update',
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
