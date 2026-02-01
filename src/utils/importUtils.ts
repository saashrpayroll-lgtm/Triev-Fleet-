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

    // Pre-fetch Team Leaders to map Name -> ID
    const teamLeaderMap = new Map<string, string>(); // Name -> ID
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, fullName:full_name')
            .eq('role', 'teamLeader');

        if (error) throw error;

        users?.forEach((user: any) => {
            const name = (user.fullName || '').trim().toLowerCase();
            if (name) teamLeaderMap.set(name, user.id);
        });
    } catch (error) {
        console.error("Error fetching team leaders:", error);
        throw new Error("Failed to fetch Team Leaders for validation.");
    }

    summary.total = fileData.length;

    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2;

        try {
            // 1. Validation & Data Prep
            const riderName = (row['Rider Name'] || '').trim();
            const trievId = String(row['Triev ID'] || '').trim();
            const mobile = String(row['Mobile Number'] || '').replace(/[^0-9]/g, '');
            const chassis = String(row['Chassis Number'] || '').trim();

            if (!trievId && !mobile && !chassis) {
                throw new Error("Missing Identifier (Triev ID, Mobile, or Chassis required)");
            }
            if (!riderName) throw new Error("Missing Rider Name");

            const teamLeaderName = (row['Team Leader'] || '').trim();
            const teamLeaderId = teamLeaderMap.get(teamLeaderName.toLowerCase()) || null;

            // Handle Client
            const clientName = isValidClient(row['Client Name']) ? row['Client Name'] : 'Other';

            // Handle Date
            let allotmentDate = new Date().toISOString();
            if (row['Allotment Date']) {
                const d = new Date(row['Allotment Date']);
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
                client_id: row['Client ID'] || '',
                wallet_amount: parseCurrency(row['Wallet Amount'] || 0),
                allotment_date: allotmentDate,
                remarks: row['Remarks'] || '',
                team_leader_id: teamLeaderId,
                team_leader_name: teamLeaderId ? teamLeaderName : 'Unassigned',
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
            const trievId = String(row['Triev ID'] || '').trim();
            const mobile = String(row['Mobile Number'] || '').replace(/[^0-9]/g, '');
            const amount = parseCurrency(row['Wallet Amount']);

            if (!trievId && !mobile) {
                throw new Error("Missing Identifier: 'Triev ID' or 'Mobile Number' is required column.");
            }
            if (isNaN(amount)) throw new Error("Invalid Wallet Amount value.");

            let matchData = null;
            let identifierUsed = '';

            // 1. Try Triev ID first (more precise)
            if (trievId) {
                const { data } = await supabase.from('riders').select('id, rider_name').eq('triev_id', trievId).maybeSingle();
                if (data) {
                    matchData = data;
                    identifierUsed = `Triev ID: ${trievId}`;
                }
            }

            // 2. Try Mobile if Triev ID failed or wasn't provided
            if (!matchData && mobile) {
                const { data } = await supabase.from('riders').select('id, rider_name').eq('mobile_number', mobile).maybeSingle();
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
