import { supabase } from '@/config/supabase';
import { ImportSummary, ClientName, RiderColumnMapping, LiveSyncStaffFilter } from '@/types';
import { logActivity } from './activityLog';
import { LedgerAPI } from '@/api/ledger';
import { fetchAllRidersPaginated, fetchTablePaginated } from './dbUtils';
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

export const cleanString = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/[\uFEFF\u00A0\r\n]/g, ' ').trim();
};

export const normalizeKey = (key: string) => 
    String(key || '').replace(/[\uFEFF\u00A0\r\n]/g, '').trim().toLowerCase().replace(/\s+/g, '');

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

const formatScientificNumber = (val: any): string => {
    if (val === undefined || val === null) return '';
    const str = String(val).trim();
    if (str.includes('e') || str.includes('E')) {
        const num = Number(str);
        if (!isNaN(num)) {
            return num.toFixed(0);
        }
    }
    return str;
};

// Helper: Normalize mobile to last 10 digits (handles +91, 91, 0 prefixes & scientific notation)
const normalizeMobile = (raw: string): string => {
    const cleanStr = formatScientificNumber(raw);
    const digits = cleanStr.replace(/[^0-9]/g, '');
    if (!digits) return '';
    return digits.length > 10 ? digits.slice(-10) : digits;
};

// Helper: Normalize Triev ID (strip whitespace, Excel .0 float suffix, lowercase trim)
const normalizeTrievId = (raw: string): string => {
    const cleanStr = formatScientificNumber(raw);
    return cleanStr.replace(/[\uFEFF\u00A0\r\n]/g, '').trim().replace(/\.0+$/, '').trim().toLowerCase();
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
        const skippedWithMeta = [
            {
                _meta: {
                    inactivated: summary.inactivated || 0,
                    reactivated: summary.reactivated || 0,
                    detailedChanges: summary.detailedChanges || null
                }
            },
            ...((summary.skippedDetails || []).slice(0, 100))
        ];

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
            errors: summary.errors.slice(0, 50),
            skipped_details: skippedWithMeta,
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



export const processRiderImport = async (
    fileData: any[],
    adminId: string,
    adminName: string,
    strictMirror = false,
    columnMapping?: RiderColumnMapping,
    staffFilter?: LiveSyncStaffFilter
): Promise<ImportSummary> => {
    const summary: ImportSummary = { 
        total: 0, 
        success: 0, 
        failed: 0, 
        errors: [], 
        updated: 0, 
        skipped: 0, 
        inactivated: 0,
        reactivated: 0,
        skippedDetails: [] 
    };

    // ── 1. Pre-fetch ALL Team Leaders, RMs & City Ops Users (Paginated) ──────
    const teamLeaderMap = new Map<string, string[]>();
    const teamLeaderEmailMap = new Map<string, string[]>();
    const superCleanMap = new Map<string, string[]>();
    const kontiIdMap = new Map<string, string[]>();
    const userByIdMap = new Map<string, any>();
    let users: any[] = [];
    try {
        const { data: fetchedUsers, error } = await fetchTablePaginated('users', 'id, full_name, email, role, reporting_manager, city_ops_id');
        if (error) throw error;
        users = (fetchedUsers || []).map((u: any) => ({
            ...u,
            fullName: (u.full_name || '').replace(/[\uFEFF\u00A0\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
        }));

        const addToMap = (map: Map<string, string[]>, key: string, id: string) => {
            if (!key || !id) return;
            const list = map.get(key) || [];
            if (!list.includes(id)) list.push(id);
            map.set(key, list);
        };

        users.forEach((user: any) => {
            userByIdMap.set(user.id, user);
            const nameRaw = (user.fullName || '').trim();
            const email = (user.email || '').trim().toLowerCase();
            const uid = user.id;
            if (email) addToMap(teamLeaderEmailMap, email, uid);

            if (nameRaw) {
                const lowerRaw = nameRaw.toLowerCase();
                addToMap(teamLeaderMap, lowerRaw, uid);

                const clean = lowerRaw.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();
                if (clean) addToMap(teamLeaderMap, clean, uid);

                const sc = clean.replace(/[^a-z0-9]/gi, '');
                if (sc) addToMap(superCleanMap, sc, uid);

                const tagMatches = nameRaw.match(/(?:KONTI|TL|EMP|ID)[\s\/\-_]*\d+/gi);
                if (tagMatches) {
                    tagMatches.forEach((tag: string) => {
                        const numOnly = tag.match(/\d+/)?.[0];
                        if (numOnly) {
                            addToMap(kontiIdMap, numOnly, uid);
                            addToMap(kontiIdMap, `konti/${numOnly}`, uid);
                        }
                    });
                }
            }
        });
    } catch (err) { console.error('Error pre-fetching users:', err); }

    // Multi-Strategy TL Resolver Helper (handles duplicate TL names disambiguated by RM Name)
    const findMatchingUserId = (rawTLName: string, rawRMName?: string): string | null => {
        if (!rawTLName) return null;
        let normTL = cleanString(rawTLName).replace(/\s+/g, ' ').trim();
        if (!normTL || ['n/a', 'unassigned', '-', 'none', 'null'].includes(normTL.toLowerCase())) return null;

        let normRM = cleanString(rawRMName || '').replace(/\s+/g, ' ').trim();

        // Extract embedded RM if TL column has formats like "Sunil Kumar - Satish Lal" or "Sunil Kumar (Sazid)" or "Sunil Kumar / Sazid"
        const embeddedMatch = normTL.match(/^(.*?)\s*[-/()|]\s*(?:RM[:\s]*)?([a-zA-Z\s]+)\)?$/i);
        if (embeddedMatch) {
            const potentialTL = embeddedMatch[1].replace(/\s*\(.*?\)\s*/g, '').trim();
            const potentialRM = embeddedMatch[2].replace(/\s*\(.*?\)\s*/g, '').trim();
            if (potentialTL.length >= 3) {
                normTL = potentialTL;
                if (!normRM || ['n/a', 'unassigned', '-', 'none', 'null'].includes(normRM.toLowerCase())) {
                    normRM = potentialRM;
                }
            }
        }

        const lowerTL = normTL.toLowerCase();
        const cleanTL = lowerTL.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();
        const scTL = cleanTL.replace(/[^a-z0-9]/gi, '');

        const candidateUserIds = new Set<string>();

        const addCandidates = (map: Map<string, string[]>, key: string) => {
            const list = map.get(key);
            if (list) list.forEach(id => candidateUserIds.add(id));
        };

        addCandidates(teamLeaderEmailMap, lowerTL);
        addCandidates(teamLeaderMap, lowerTL);
        if (cleanTL) addCandidates(teamLeaderMap, cleanTL);
        if (scTL) addCandidates(superCleanMap, scTL);

        const tagMatches = normTL.match(/(?:KONTI|TL|EMP|ID)[\s\/\-_]*(\d+)/gi);
        if (tagMatches) {
            for (const tag of tagMatches) {
                const numOnly = tag.match(/\d+/)?.[0];
                if (numOnly) addCandidates(kontiIdMap, `konti/${numOnly}`);
            }
        }

        if (cleanTL.length >= 3) {
            const cleanTokens = cleanTL.split(/\s+/).filter((t: string) => t.length >= 2);
            for (const u of users) {
                const uClean = (u.fullName || '').toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();
                if (!uClean) continue;

                if (uClean === cleanTL) {
                    candidateUserIds.add(u.id);
                } else if (cleanTokens.length >= 2) {
                    const uTokens = uClean.split(/\s+/).filter((t: string) => t.length >= 2);
                    if (uTokens.length >= 2) {
                        const isSame = cleanTokens.every((ct: string) => uTokens.includes(ct)) && uTokens.every((ut: string) => cleanTokens.includes(ut));
                        if (isSame) candidateUserIds.add(u.id);
                    }
                }
            }
        }

        if (candidateUserIds.size === 0) return null;

        const candidates = Array.from(candidateUserIds);

        const hasRMInSheet = normRM && !['n/a', 'unassigned', '-', 'none', 'null'].includes(normRM.toLowerCase());

        if (hasRMInSheet) {
            const lowerRM = normRM.toLowerCase();
            const cleanRM = lowerRM.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();
            const scRM = cleanRM.replace(/[^a-z0-9]/gi, '');
            const rmTokens = cleanRM.split(/\s+/).filter((t: string) => t.length >= 3);

            const matchingRMCandidates = candidates.filter(uid => {
                const candidateUser = userByIdMap.get(uid);
                if (!candidateUser) return false;

                const candidateRmRef = (candidateUser.reporting_manager || '').toString().trim();
                const rmUser = candidateRmRef ? userByIdMap.get(candidateRmRef) : null;
                const rmNameLower = rmUser ? (rmUser.fullName || '').toLowerCase() : '';
                const rmClean = rmNameLower.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();
                const rmEmail = rmUser ? (rmUser.email || '').toLowerCase() : '';
                const rmSC = rmClean.replace(/[^a-z0-9]/gi, '');
                const directRmClean = candidateRmRef.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();
                const directRmSC = directRmClean.replace(/[^a-z0-9]/gi, '');

                // 1. Exact matches
                if (rmEmail && rmEmail === lowerRM) return true;
                if (rmClean && (rmClean === cleanRM || rmSC === scRM)) return true;
                if (directRmClean && (directRmClean === cleanRM || directRmSC === scRM)) return true;

                // 2. Token-level matching (e.g. "Sazid" in "Sazid Khan" or "Mohd Sazid")
                const candTokens = (rmClean || directRmClean).split(/\s+/).filter((t: string) => t.length >= 3);
                if (candTokens.length > 0 && rmTokens.length > 0) {
                    const hasSharedToken = rmTokens.some((t: string) => candTokens.includes(t));
                    if (hasSharedToken) return true;
                }

                return false;
            });

            if (matchingRMCandidates.length > 0) {
                return matchingRMCandidates[0];
            } else {
                return null;
            }
        }

        // No RM in sheet: match ONLY if single unique TL AND that TL has a valid registered RM
        if (candidates.length === 1) {
            const singleUser = userByIdMap.get(candidates[0]);
            if (singleUser && singleUser.reporting_manager) {
                return candidates[0];
            }
        }
        return null;
    };

    // Staff Filter Helper
    const isStaffSelected = (tlId: string | null, tlNameRaw: string, existingRiderTLId?: string | null, rmNameRaw?: string): boolean => {
        if (!staffFilter || staffFilter.syncAllStaff) return true;
        const selectedTLs = staffFilter.teamLeaderIds || [];
        const selectedRMs = staffFilter.reportingManagerIds || [];
        const selectedCityOps = staffFilter.cityOpsIds || [];

        if (selectedTLs.length === 0 && selectedRMs.length === 0 && selectedCityOps.length === 0) return true;

        const effectiveTLId = tlId || (existingRiderTLId && userByIdMap.has(existingRiderTLId) ? existingRiderTLId : null) || findMatchingUserId(tlNameRaw, rmNameRaw);

        if (effectiveTLId) {
            if (selectedTLs.includes(effectiveTLId)) return true;
            const tlUser = userByIdMap.get(effectiveTLId);
            if (tlUser) {
                if (tlUser.reporting_manager && selectedRMs.includes(tlUser.reporting_manager)) return true;
                if (tlUser.city_ops_id && selectedCityOps.includes(tlUser.city_ops_id)) return true;
            }
        }

        return false;
    };

    // ── 2. Pre-fetch ALL Riders into memory ──────────────────────────────────
    const riderTrievMap = new Map<string, any>();
    const riderMobileMap = new Map<string, any>();
    const allDbRiders: any[] = [];
    try {
        const { data: allRiders, error: fetchErr } = await fetchAllRidersPaginated('id, triev_id, mobile_number, rider_name, chassis_number, client_name, client_id, allotment_date, wallet_amount, team_leader_id, team_leader_name, remarks, status, inactivated_at');
        if (fetchErr) throw fetchErr;
        allRiders?.forEach(r => {
            allDbRiders.push(r);
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

    // Track detailed change arrays
    const addedList: any[] = [];
    const inactivatedList: any[] = [];
    const reactivatedList: any[] = [];
    const walletUpdatesList: any[] = [];
    const dataUpdatesList: any[] = [];

    const pendingInserts: any[] = [];
    const pendingUpdates: { id: string; payload: any; rowNum?: number; changedFields?: string[] }[] = [];
    const matchedSheetRiderIds = new Set<string>();

    // ── 3. PASS 1: Classify rows ─────────────────────────────────────────────
    for (let i = 0; i < fileData.length; i++) {
        const row = fileData[i];
        const rowNum = i + 2;
        let currentRiderName = '';

        try {
            const nr: Record<string, string> = {};
            Object.keys(row).forEach(k => nr[normalizeKey(k)] = row[k]);

            const getValue = (primaryKey?: string, fallbacks: string[] = []): string => {
                const keys = primaryKey ? [primaryKey, ...fallbacks] : fallbacks;
                for (const k of keys) {
                    if (!k) continue;
                    const normK = normalizeKey(k);
                    if (nr[normK] !== undefined && nr[normK] !== null && String(nr[normK]).trim() !== '') {
                        return String(nr[normK]).trim();
                    }
                }
                return '';
            };

            currentRiderName = getValue(columnMapping?.riderName, ['Rider Name', 'RiderName', 'Name', 'FullName', 'Full Name']);
            const trievIdRaw = getValue(columnMapping?.primaryKey, ['TriEVRiderID', 'TriEV Rider ID', 'TriEVRiderId', 'RiderId', 'Rider ID', 'Triev ID', 'TrievId', 'ID']);
            const trievId = normalizeTrievId(trievIdRaw);
            const mobileRaw = getValue(columnMapping?.mobileNumber, ['MobileNo', 'Mobile No', 'Mobile Number', 'Mobile', 'Phone', 'Contact']);
            const mobile = normalizeMobile(mobileRaw);
            const chassis = getValue(columnMapping?.chassisNumber, ['Chassis No', 'ChassisNo', 'Chassis Number', 'Chassis']);
            const teamLeaderName = getValue(columnMapping?.teamLeader, ['TL Name', 'TLName', 'Team Leader', 'TeamLeader', 'TL', 'Base']);
            const reportingManagerName = getValue(columnMapping?.reportingManager, ['Reporting Manager', 'ReportingManager', 'RM Name', 'RMName', 'RM', 'Reproting Manager', 'Reporting Mgr', 'Reporting Head', 'Manager', 'Reporting Manager Name', 'Reporting_Manager', 'RM_Name', 'Reporting', 'RM / Manager', 'TL RM', 'TL_RM']);
            const clientRaw = getValue(columnMapping?.clientName, ['quick commerce', 'Quick Commerce', 'Client Name', 'Client', 'Brand']);
            const clientId = getValue(columnMapping?.clientId, ['Client ID', 'ClientId']);
            const remarks = getValue(columnMapping?.remarks, ['days', 'Remarks', 'Remark', 'Note']);
            const dateRaw = getValue(columnMapping?.allotmentDate, ['Registered Date', 'Vehicle Issue Date', 'Allotment Date', 'Date', 'Joining Date']);
            const walletValRaw = getValue(columnMapping?.walletAmount, ['Balance', 'Wallet Amount', 'Wallet Balance', 'Wallet']);

            if (!trievId && !mobile) throw new Error('Missing Unique Identifier (TriEVRiderID/RiderId or MobileNo required)');
            if (!currentRiderName) throw new Error('Missing Rider Name');

            const existingRider = (trievId ? riderTrievMap.get(trievId) : null) ?? (mobile ? riderMobileMap.get(mobile) : null);
            let teamLeaderId: string | null = findMatchingUserId(teamLeaderName, reportingManagerName);
            let finalTLName = teamLeaderName || 'Unassigned';

            if (teamLeaderId) {
                finalTLName = userByIdMap.get(teamLeaderId)?.fullName || teamLeaderName;
            }

            // Strict Unregistered TL Guard: If TL/RM pair does not match registered users, SKIP and DETACH!
            if (!teamLeaderId) {
                if (existingRider && existingRider.team_leader_id) {
                    pendingUpdates.push({
                        id: existingRider.id,
                        payload: {
                            team_leader_id: null,
                            team_leader_name: `${teamLeaderName || 'Unregistered'} (${reportingManagerName || 'Unregistered RM'})`,
                            status: 'inactive',
                            inactivated_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        },
                        changedFields: ['team_leader_id (detached unregistered TL)', 'status (inactivated)']
                    });
                }
                summary.skipped = (summary.skipped || 0) + 1;
                summary.skippedDetails!.push({ 
                    row: rowNum, 
                    identifier: trievId || mobile || currentRiderName, 
                    reason: `Skipped: Team Leader (${teamLeaderName || 'Unassigned'}) under RM (${reportingManagerName || 'Unregistered'}) is NOT registered in system users`, 
                    data: row 
                });
                continue;
            }

            // Staff Filter Check: Skip if TL/RM/CityOps not in selected list
            if (!isStaffSelected(teamLeaderId, teamLeaderName, existingRider?.team_leader_id, reportingManagerName)) {
                summary.skipped = (summary.skipped || 0) + 1;
                summary.skippedDetails!.push({ 
                    row: rowNum, 
                    identifier: trievId || mobile || currentRiderName, 
                    reason: `Skipped: Team Leader (${finalTLName}) is excluded by Staff Filter`, 
                    data: row 
                });
                continue;
            }

            const clientName = isValidClient(clientRaw) ? clientRaw : 'Other';
            let allotmentDate = '';
            if (dateRaw) {
                const parsed = parseIndianDate(dateRaw);
                if (parsed) allotmentDate = parsed;
            }

            if (existingRider) {
                matchedSheetRiderIds.add(existingRider.id);

                const updatePayload: any = {};
                const changedFields: string[] = [];

                const addIfDiff = (dbProp: string, newVal: any, label: string, dbVal: any = existingRider[dbProp]) => {
                    const cleanNew = String(newVal || '').trim();
                    const cleanDb = String(dbVal || '').trim();
                    if (cleanNew && cleanNew !== cleanDb) {
                        updatePayload[dbProp] = cleanNew;
                        changedFields.push(label);
                    }
                };

                addIfDiff('rider_name', currentRiderName, 'Rider Name');
                addIfDiff('chassis_number', chassis, 'Chassis Number');
                addIfDiff('remarks', remarks, 'Remarks');
                addIfDiff('client_name', clientName, 'Client Name');
                if (clientId) addIfDiff('client_id', clientId, 'Client ID');

                // Auto Reactivation Logic
                if (existingRider.status === 'inactive') {
                    updatePayload.status = 'active';
                    updatePayload.inactivated_at = null;
                    summary.reactivated = (summary.reactivated || 0) + 1;
                    reactivatedList.push({
                        trievId: trievId || existingRider.triev_id || '',
                        riderName: currentRiderName || existingRider.rider_name || '',
                        mobileNumber: mobile || existingRider.mobile_number || '',
                        teamLeaderName: finalTLName
                    });
                }

                // Wallet balance sync
                if (walletValRaw !== '') {
                    const walletParsed = parseCurrency(walletValRaw);
                    const oldW = Number(existingRider.wallet_amount || 0);
                    if (!isNaN(walletParsed) && oldW !== walletParsed) {
                        updatePayload.wallet_amount = walletParsed;
                        walletUpdatesList.push({
                            trievId: trievId || existingRider.triev_id || '',
                            riderName: currentRiderName || existingRider.rider_name || '',
                            mobileNumber: mobile || existingRider.mobile_number || '',
                            teamLeaderName: finalTLName,
                            oldWallet: oldW,
                            newWallet: walletParsed,
                            diff: walletParsed - oldW
                        });
                    }
                }

                if (teamLeaderId !== existingRider.team_leader_id || finalTLName !== existingRider.team_leader_name) {
                    updatePayload.team_leader_id = teamLeaderId;
                    updatePayload.team_leader_name = finalTLName;
                    changedFields.push('Team Leader');
                }

                if (Object.keys(updatePayload).length > 0) {
                    updatePayload.updated_at = new Date().toISOString();
                    pendingUpdates.push({ id: existingRider.id, payload: updatePayload, rowNum });
                    dataUpdatesList.push({
                        trievId: trievId || existingRider.triev_id || '',
                        riderName: currentRiderName || existingRider.rider_name || '',
                        mobileNumber: mobile || existingRider.mobile_number || '',
                        teamLeaderName: finalTLName,
                        changes: changedFields
                    });
                } else {
                    summary.unchanged = (summary.unchanged || 0) + 1;
                    summary.skipped = (summary.skipped || 0) + 1;
                    summary.skippedDetails!.push({ row: rowNum, identifier: trievId || mobile, reason: 'Identical active rider already synced (no changes required)', data: row });
                }
            } else {
                // Brand new rider
                const initialWallet = walletValRaw !== '' ? parseCurrency(walletValRaw) : 0;
                const newRiderItem = {
                    rider_name: currentRiderName,
                    triev_id: trievId || null,
                    mobile_number: mobile || null,
                    chassis_number: chassis,
                    client_name: clientName,
                    client_id: clientId || null,
                    team_leader_id: teamLeaderId,
                    team_leader_name: finalTLName,
                    allotment_date: allotmentDate || new Date().toISOString(),
                    remarks,
                    wallet_amount: isNaN(initialWallet) ? 0 : initialWallet,
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    _rowNum: rowNum
                };
                pendingInserts.push(newRiderItem);
                addedList.push({
                    trievId: trievId || '',
                    riderName: currentRiderName,
                    mobileNumber: mobile || '',
                    teamLeaderName: finalTLName,
                    newWallet: isNaN(initialWallet) ? 0 : initialWallet
                });
            }
        } catch (err: any) {
            summary.failed++;
            summary.errors.push({ row: rowNum, identifier: currentRiderName || `Row ${rowNum}`, reason: err.message });
        }
    }

    // ── 4. Apply Updates in Parallel Chunks ─────────────────────────────────
    const updateChunks = chunkArray(pendingUpdates, 20);
    for (const chunk of updateChunks) {
        for (const { id, payload, rowNum } of chunk) {
            try {
                const { error } = await supabase.from('riders').update(payload).eq('id', id);
                if (error) throw error;
                summary.updated = (summary.updated || 0) + 1;
            } catch (err: any) {
                summary.failed++;
                summary.errors.push({ row: rowNum || 0, identifier: id, reason: err.message });
            }
        }
    }

    // ── 5. Bulk Insert New Riders ────────────────────────────────────────────
    if (pendingInserts.length > 0) {
        const insertBatches = chunkArray(pendingInserts, 200);
        for (const batch of insertBatches) {
            const cleanBatch = batch.map(({ _rowNum: _, ...rest }) => rest);
            try {
                const { error } = await supabase.from('riders').insert(cleanBatch);
                if (error) throw error;
                summary.success += cleanBatch.length;
            } catch (err: any) {
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

    // ── 6. Auto Active/Inactive Reconciliation Engine ────────────────────────
    if (strictMirror || fileData.length > 0) {
        try {
            const ridersToInactivate = allDbRiders.filter(r => {
                if (r.status !== 'active') return false; // Only active riders can become inactive

                // If the rider's TL is no longer registered in system users, auto-inactivate!
                const isRegisteredTL = r.team_leader_id ? userByIdMap.has(r.team_leader_id) : false;
                if (!isRegisteredTL) return true;

                if (!isStaffSelected(r.team_leader_id, r.team_leader_name || '')) return false; // Respect staff filter scope
                return !matchedSheetRiderIds.has(r.id);
            });

            if (ridersToInactivate.length > 0) {
                const nowIso = new Date().toISOString();
                const ids = ridersToInactivate.map(r => r.id);

                const { error: inactErr } = await supabase
                    .from('riders')
                    .update({ status: 'inactive', inactivated_at: nowIso, updated_at: nowIso })
                    .in('id', ids);

                if (!inactErr) {
                    summary.inactivated = ids.length;
                    ridersToInactivate.forEach(r => {
                        inactivatedList.push({
                            trievId: r.triev_id || '',
                            riderName: r.rider_name || '',
                            mobileNumber: r.mobile_number || '',
                            teamLeaderName: r.team_leader_name || ''
                        });
                    });
                } else {
                    console.error("Failed auto-inactivation of riders missing in live sheet:", inactErr);
                }
            }
        } catch (e) {
            console.error("Active/Inactive reconciliation failed:", e);
        }
    }

    summary.detailedChanges = {
        added: addedList,
        inactivated: inactivatedList,
        reactivated: reactivatedList,
        walletUpdates: walletUpdatesList,
        dataUpdates: dataUpdatesList
    };

    await logActivity({
        actionType: 'bulkImport',
        targetType: 'system',
        targetId: 'multiple',
        details: `Live Sheet Sync: ${summary.success} new, ${summary.updated} updated, ${summary.reactivated || 0} reactivated, ${summary.inactivated || 0} auto-inactivated, ${summary.skipped} skipped, ${summary.failed} failed. Total: ${summary.total}`,
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
    const { data: allRiders, error: fetchErr } = await fetchAllRidersPaginated('id, triev_id, mobile_number, rider_name, team_leader_id, wallet_amount, status');
    if (fetchErr) throw fetchErr;

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

            // Also silently prune old >35 days (5 weeks) wallet ledger data to save DB space
            const { data: pruneResult, error: pruneError } = await supabase.rpc('prune_old_wallet_ledger_data');
            if (pruneError) {
                console.warn('[Auto-Cleanup] prune_old_wallet_ledger_data failed:', pruneError.message);
            } else if (pruneResult?.success && pruneResult?.deleted_count > 0) {
                console.log(`[Auto-Cleanup] Automatically pruned ${pruneResult.deleted_count} old wallet rows (>35 days).`);
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
        const { data: allRiders, error: ridersErr } = await fetchAllRidersPaginated('id, triev_id, mobile_number');
        if (ridersErr) throw ridersErr;

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
        // Use normalizeKey for robust column matching
        const sheetTxnIds = fileData.map(r => {
            const nRow: any = {};
            Object.keys(r).forEach(k => nRow[normalizeKey(k)] = r[k]);
            return nRow[normalizeKey('Transaction ID')] || nRow[normalizeKey('transaction_id')] || nRow[normalizeKey('OrdertransactionId')] || '';
        }).filter(Boolean).map(String);

        const existingTxns = new Set<string>();
        if (sheetTxnIds.length > 0) {
            const txnChunks = chunkArray(sheetTxnIds, 100);
            for (const chunk of txnChunks) {
                const { data: txns } = await supabase
                    .from('wallet_ledger')
                    .select('metadata')
                    .in('metadata->>transaction_id', chunk);
                txns?.forEach((t: any) => existingTxns.add(String(t.metadata?.transaction_id)));
            }
        }

        // Track within-sheet duplicates (same TxnID appearing multiple times in one file)
        const seenInSheet = new Set<string>();

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

                // ── TYPE COLUMN FILTER: Only accept "Wallet Recharge" transactions ──
                // Skip "Onboarding and Security" and any other non-recharge types
                const typeValue = getValue(['Type', 'TYPE', 'Transaction Type', 'Txn Type']);
                if (typeValue && typeValue.toLowerCase() !== 'wallet recharge') {
                    summary.skipped = (summary.skipped || 0) + 1;
                    summary.skippedDetails?.push({
                        row: rowNum,
                        identifier: trievIdRaw || mobileRaw || `Row ${rowNum}`,
                        reason: `Skipped: TYPE="${typeValue}" (Only "Wallet Recharge" accepted)`,
                        data: row
                    });
                    continue;
                }

                if (!trievIdRaw && !mobileRaw) throw new Error("Row skipped: Missing Triev ID or Mobile Number");
                if (!amountRaw) throw new Error("Row skipped: Missing Amount");

                let amount = parseCurrency(amountRaw);
                if (amount < 0) amount = Math.abs(amount);

                // ✅ FIX: Validate amount > 0 — skip zero-value entries
                if (amount === 0 || isNaN(amount)) {
                    throw new Error(`Row skipped: Invalid or zero amount (raw: "${amountRaw}", parsed: ${amount})`);
                }

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

                const transactionId = getValue(['Transaction ID', 'transaction_id', 'OrdertransactionId', 'OrderTransactionId']);

                // ✅ FIX: Generate fallback dedup key for rows without Transaction ID
                // Uses riderId + amount + date as a deterministic fingerprint
                const dateRaw = getValue(['Date', 'Transaction Date', 'Collection Date', 'PaymentStamp', 'Payment Stamp']);
                let transactionDateStr = ((): string => {
                    const now = new Date();
                    const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
                    return `${istDateStr}T12:00:00.000+05:30`;
                })();
                if (dateRaw) {
                    const parsedDate = parseIndianDate(dateRaw);
                    if (parsedDate) {
                        transactionDateStr = parsedDate;
                    }
                }

                const dedupKey = transactionId || `FP:${riderId}|${amount}|${transactionDateStr.split('T')[0]}`;

                // Check DB duplicates (by Transaction ID)
                if (transactionId && existingTxns.has(transactionId)) {
                    if (summary.skipped === undefined) summary.skipped = 0;
                    summary.skipped++;
                    summary.skippedDetails?.push({ row: rowNum, identifier: transactionId, reason: "Duplicate Transaction ID (already in DB)", data: row });
                    continue;
                }

                // Check within-sheet duplicates (by Transaction ID or fingerprint)
                if (seenInSheet.has(dedupKey)) {
                    if (summary.skipped === undefined) summary.skipped = 0;
                    summary.skipped++;
                    summary.skippedDetails?.push({ row: rowNum, identifier: dedupKey, reason: "Duplicate entry (same rider+amount+date already in this sheet)", data: row });
                    continue;
                }
                seenInSheet.add(dedupKey);

                pendingTransactions.push({
                    riderId,
                    amount,
                    transactionId,
                    dedupKey,
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

        // ✅ FIX: For rows WITHOUT a Transaction ID, check DB for existing rider+amount+date fingerprint
        // This prevents re-import of the same transaction that has no TxnID
        const noTxnPending = pendingTransactions.filter(tx => !tx.transactionId);
        if (noTxnPending.length > 0) {
            for (const tx of noTxnPending) {
                try {
                    const dateOnly = tx.transactionDateStr.split('T')[0];
                    const { data: existing } = await supabase
                        .from('wallet_ledger')
                        .select('id')
                        .eq('rider_id', tx.riderId)
                        .eq('amount', tx.amount)
                        .gte('created_at', `${dateOnly}T00:00:00`)
                        .lte('created_at', `${dateOnly}T23:59:59`)
                        .eq('type', 'DAILY_COLLECTION')
                        .limit(1);
                    if (existing && existing.length > 0) {
                        // Already exists — remove from pending and mark as skipped
                        const idx = pendingTransactions.indexOf(tx);
                        if (idx > -1) pendingTransactions.splice(idx, 1);
                        if (summary.skipped === undefined) summary.skipped = 0;
                        summary.skipped++;
                        const rName = tx.row?.['Rider Name'] || tx.row?.['rider_name'] || 'Unknown';
                        summary.skippedDetails?.push({ row: tx.rowNum, identifier: `${rName} | ₹${tx.amount}`, reason: "Duplicate (same rider+amount+date already in DB, no TxnID)", data: tx.row });
                    }
                } catch { /* ignore lookup errors, let it try to insert */ }
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
                // ✅ Enhanced error: include rider name, Triev ID, mobile, and amount for debugging
                const riderName = tx.row?.['Rider Name'] || tx.row?.['rider_name'] || 'Unknown';
                const trievId = tx.row?.['Triev ID'] || tx.row?.['triev_id'] || '-';
                const mobile = tx.row?.['Mobile Number'] || tx.row?.['mobile_number'] || '-';
                summary.errors.push({
                    row: tx.rowNum,
                    identifier: `${riderName} (${trievId}) | Mob: ${mobile} | ₹${tx.amount}`,
                    reason: err.message || "Failed to add transaction",
                    data: tx.row
                });
            }
        }

    } catch (error: any) {
        console.error("Critical error in rent import:", error);
        summary.errors.push({ row: 0, identifier: 'FILE', reason: `Fatal Error: ${error.message}` });
    }

    await logImportHistory(adminId, adminName, 'rent_collection' as any, summary, fileData.length);

    // Silently prune old >35 days (5 weeks) wallet ledger data to save DB space
    if (summary.success > 0) {
        try {
            const { data: pruneResult, error: pruneError } = await supabase.rpc('prune_old_wallet_ledger_data');
            if (pruneError) {
                console.warn('[Rent-Cleanup] prune_old_wallet_ledger_data failed:', pruneError.message);
            } else if (pruneResult?.success && pruneResult?.deleted_count > 0) {
                console.log(`[Rent-Cleanup] Automatically pruned ${pruneResult.deleted_count} old wallet rows (>35 days).`);
            }
        } catch (e) {
            console.warn('[Rent-Cleanup] Failed silently:', e);
        }
    }

    return summary;
};
