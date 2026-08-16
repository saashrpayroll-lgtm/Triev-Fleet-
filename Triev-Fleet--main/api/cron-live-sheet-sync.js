import { createClient } from '@supabase/supabase-js';

// ─── UTILITY HELPERS ──────────────────────────────────────────────────────────

const cleanString = (val) => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/[\uFEFF\u00A0\r\n]/g, ' ').trim();
};

const normalizeKey = (key) => {
    return cleanString(key).toLowerCase().replace(/[^a-z0-9]/g, '');
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

const parseIndianDate = (dateStr) => {
    if (!dateStr) return null;
    const clean = String(dateStr).trim();
    if (!clean) return null;

    const pad = (n) => String(n).padStart(2, '0');

    // 1. Check Excel serial number (e.g. 45367)
    if (!isNaN(Number(clean)) && Number(clean) > 20000 && Number(clean) < 80000) {
        const days = Number(clean);
        const msSince1900 = (days - (days > 59 ? 25569 : 25568)) * 86400 * 1000;
        const d = new Date(msSince1900);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
    }

    // 2. YYYY-MM-DD or YYYY-DD-MM (e.g. 2026-16-03 or 2026-03-16)
    const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymdMatch) {
        const y = parseInt(ymdMatch[1], 10);
        let m = parseInt(ymdMatch[2], 10);
        let d = parseInt(ymdMatch[3], 10);

        // If month > 12 and day <= 12, it's YYYY-DD-MM -> auto-swap!
        if (m > 12 && d <= 12) {
            const temp = m;
            m = d;
            d = temp;
        }

        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${pad(m)}-${pad(d)}`;
        }
    }

    // 3. DD/MM/YYYY or MM/DD/YYYY (e.g. 16/03/2026 or 03/16/2026)
    const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (dmyMatch) {
        let d = parseInt(dmyMatch[1], 10);
        let m = parseInt(dmyMatch[2], 10);
        const y = dmyMatch[3].length === 2 ? 2000 + parseInt(dmyMatch[3], 10) : parseInt(dmyMatch[3], 10);

        // If month > 12 and day <= 12, it was MM/DD/YYYY -> auto-swap!
        if (m > 12 && d <= 12) {
            const temp = m;
            m = d;
            d = temp;
        }

        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${pad(m)}-${pad(d)}`;
        }
    }

    // 4. Standard parse fallback
    const timestamp = Date.parse(clean);
    if (!isNaN(timestamp)) {
        const dt = new Date(timestamp);
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }

    return null;
};

const CLIENT_NAMES = ['Zomato', 'Swiggy', 'Blinkit', 'Zepto', 'BigBasket', 'Uber', 'Porter', 'Other'];
const isValidClient = (client) => {
    if (!client) return false;
    return CLIENT_NAMES.some(c => c.toLowerCase() === String(client).trim().toLowerCase());
};

// Robust CSV Parser
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

const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

// Helper: Fetch all rows paginated from Supabase
const fetchAllPaginated = async (supabase, table, columns = '*') => {
    const CHUNK_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(table)
            .select(columns)
            .range(from, from + CHUNK_SIZE - 1);

        if (error) throw error;
        if (data && data.length > 0) {
            allData = allData.concat(data);
            if (data.length < CHUNK_SIZE) {
                hasMore = false;
            } else {
                from += CHUNK_SIZE;
            }
        } else {
            hasMore = false;
        }
    }
    return allData;
};

// ─── MAIN SERVERLESS CRON HANDLER ──────────────────────────────────────────

export default async function handler(req, res) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        if (res) return res.status(500).json({ error: 'Missing Supabase environment variables' });
        throw new Error('Missing Supabase environment variables');
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
            if (res) return res.status(200).json({ status: 'ignored', reason: 'No config found in system_settings' });
            return { status: 'ignored', reason: 'No config found' };
        }

        const config = configData.value;
        if (!config.enabled || !config.sheetId) {
            if (res) return res.status(200).json({ status: 'disabled', reason: 'Auto sync disabled or sheetId missing' });
            return { status: 'disabled', reason: 'Auto sync disabled' };
        }

        // 2. Check Lock State in Database (Concurrency Guard)
        const { data: statusData } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'last_sheet_sync_status')
            .maybeSingle();

        const currentStatus = statusData?.value || {};
        if (currentStatus.lockedUntil && new Date(currentStatus.lockedUntil) > new Date()) {
            if (res) return res.status(200).json({ status: 'skipped', reason: 'Sync currently in progress by another worker' });
            return { status: 'skipped' };
        }

        // 3. Set Lock for 45 seconds
        const lockUntil = new Date(Date.now() + 45 * 1000).toISOString();
        await supabase.from('system_settings').upsert({
            key: 'last_sheet_sync_status',
            value: { ...currentStatus, status: 'syncing', lockedUntil: lockUntil },
            updated_at: new Date().toISOString()
        });

        // 4. Download Google Sheet CSV Data
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
        csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`);

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
                // Try next endpoint fallback
            }
        }

        if (!csvText) {
            throw new Error("Unable to download Google Sheet CSV. Ensure Google Sheet is set to 'Anyone with the link can view'.");
        }

        const rawRows = parseCSV(csvText);
        if (!rawRows || rawRows.length < 2) {
            throw new Error("Sheet returned empty or invalid data (0 rows). Sync aborted to protect existing data.");
        }

        const headers = rawRows[0].map(h => cleanString(h));
        const dataRows = rawRows.slice(1);
        const fileData = dataRows.map(row => {
            const obj = {};
            headers.forEach((h, idx) => {
                if (h) obj[h] = row[idx] !== undefined ? cleanString(row[idx]) : '';
            });
            return obj;
        });

        // 5. Pre-fetch Users to Resolve TLs and RMs
        const users = await fetchAllPaginated(supabase, 'users', 'id, full_name, email, role, reporting_manager, city_ops_id');
        const userByIdMap = new Map();
        const teamLeaderMap = new Map();
        const teamLeaderEmailMap = new Map();
        const superCleanMap = new Map();
        const kontiIdMap = new Map();

        const addToMap = (map, key, id) => {
            if (!key || !id) return;
            const list = map.get(key) || [];
            if (!list.includes(id)) list.push(id);
            map.set(key, list);
        };

        users.forEach(u => {
            userByIdMap.set(u.id, u);
            const nameRaw = (u.full_name || '').replace(/[\uFEFF\u00A0\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
            const email = (u.email || '').trim().toLowerCase();
            const uid = u.id;

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
                    tagMatches.forEach(tag => {
                        const numOnly = tag.match(/\d+/)?.[0];
                        if (numOnly) {
                            addToMap(kontiIdMap, numOnly, uid);
                            addToMap(kontiIdMap, `konti/${numOnly}`, uid);
                        }
                    });
                }
            }
        });

        const findMatchingUserId = (rawTLName, rawRMName) => {
            if (!rawTLName) return null;
            const normTL = rawTLName.replace(/[\uFEFF\u00A0\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!normTL || ['n/a', 'unassigned', '-', 'none', 'null'].includes(normTL.toLowerCase())) return null;

            const lowerTL = normTL.toLowerCase();
            const cleanTL = lowerTL.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();
            const scTL = cleanTL.replace(/[^a-z0-9]/gi, '');

            const candidateUserIds = new Set();
            const addCandidates = (map, key) => {
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

            if (candidateUserIds.size === 0) return null;
            const candidates = Array.from(candidateUserIds);

            if (rawRMName && rawRMName.trim() !== '' && !['n/a', 'unassigned', '-', 'none', 'null'].includes(rawRMName.trim().toLowerCase())) {
                const normRM = rawRMName.replace(/[\uFEFF\u00A0\r\n]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                const cleanRM = normRM.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();

                const matchingRMCandidates = candidates.filter(uid => {
                    const candidateUser = userByIdMap.get(uid);
                    if (!candidateUser) return false;
                    const candidateRmRef = (candidateUser.reporting_manager || '').toString().trim();
                    const rmUser = candidateRmRef ? userByIdMap.get(candidateRmRef) : null;
                    const rmNameLower = rmUser ? (rmUser.full_name || '').toLowerCase() : '';
                    const rmClean = rmNameLower.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();
                    const rmEmail = rmUser ? (rmUser.email || '').toLowerCase() : '';

                    if (rmEmail && rmEmail === normRM) return true;
                    if (rmNameLower && (rmNameLower === normRM || rmClean === cleanRM)) return true;
                    if (candidateRmRef.toLowerCase() === normRM || candidateRmRef.toLowerCase() === cleanRM) return true;
                    return false;
                });

                if (matchingRMCandidates.length > 0) return matchingRMCandidates[0];
            }

            return candidates[0];
        };

        const isStaffSelected = (tlId, tlNameRaw, existingRiderTLId, rmNameRaw) => {
            const staffFilter = config.staffFilter;
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

        // 6. Pre-fetch All DB Riders for Fast Deduplication
        const allDbRiders = await fetchAllPaginated(supabase, 'riders', 'id, triev_id, mobile_number, rider_name, chassis_number, client_name, client_id, allotment_date, wallet_amount, team_leader_id, team_leader_name, remarks, status, inactivated_at');
        const riderTrievMap = new Map();
        const riderMobileMap = new Map();

        allDbRiders.forEach(r => {
            const tid = normalizeTrievId(String(r.triev_id || ''));
            const mob = normalizeMobile(String(r.mobile_number || ''));
            if (tid) riderTrievMap.set(tid, r);
            if (mob) riderMobileMap.set(mob, r);
        });

        // 7. Parse & Classify Sheet Rows
        const columnMapping = config.columnMapping || {};
        const summary = {
            total: fileData.length,
            success: 0,
            failed: 0,
            updated: 0,
            skipped: 0,
            inactivated: 0,
            reactivated: 0,
            errors: []
        };

        const matchedSheetRiderIds = new Set();
        const pendingInserts = [];
        const pendingUpdates = [];

        for (let i = 0; i < fileData.length; i++) {
            const row = fileData[i];
            const rowNum = i + 2;

            try {
                const nr = {};
                Object.keys(row).forEach(k => nr[normalizeKey(k)] = row[k]);

                const getValue = (primaryKey, fallbacks = []) => {
                    const keys = primaryKey ? [primaryKey, ...fallbacks] : fallbacks;
                    for (const k of keys) {
                        if (!k) continue;
                        const normK = normalizeKey(k);
                        if (nr[normK] !== undefined && nr[normK] !== null && String(nr[normK]).trim() !== '') {
                            return String(nr[normK]).trim();
                        }
                        const matchingKey = Object.keys(nr).find(rk => rk && (rk.includes(normK) || normK.includes(rk)));
                        if (matchingKey && nr[matchingKey] !== undefined && nr[matchingKey] !== null && String(nr[matchingKey]).trim() !== '') {
                            return String(nr[matchingKey]).trim();
                        }
                    }
                    return '';
                };

                const currentRiderName = getValue(columnMapping.riderName, ['Rider Name', 'RiderName', 'Name', 'FullName', 'Full Name']);
                const trievIdRaw = getValue(columnMapping.primaryKey, ['TriEVRiderID', 'TriEV Rider ID', 'TriEVRiderId', 'RiderId', 'Rider ID', 'Triev ID', 'TrievId', 'ID']);
                const trievId = normalizeTrievId(trievIdRaw);
                const mobileRaw = getValue(columnMapping.mobileNumber, ['MobileNo', 'Mobile No', 'Mobile Number', 'Mobile', 'Phone', 'Contact']);
                const mobile = normalizeMobile(mobileRaw);
                const chassis = getValue(columnMapping.chassisNumber, ['Chassis No', 'ChassisNo', 'Chassis Number', 'Chassis']);
                const teamLeaderName = getValue(columnMapping.teamLeader, ['TL Name', 'TLName', 'Team Leader', 'TeamLeader', 'TL', 'Base']);
                const reportingManagerName = getValue(columnMapping.reportingManager, ['Reporting Manager', 'ReportingManager', 'RM Name', 'RMName', 'RM', 'Manager']);
                const clientRaw = getValue(columnMapping.clientName, ['quick commerce', 'Quick Commerce', 'Client Name', 'Client', 'Brand']);
                const clientId = getValue(columnMapping.clientId, ['Client ID', 'ClientId']);
                const remarks = getValue(columnMapping.remarks, ['days', 'Remarks', 'Remark', 'Note']);
                const dateRaw = getValue(columnMapping.allotmentDate, ['Registered Date', 'Vehicle Issue Date', 'Allotment Date', 'Date', 'Joining Date']);
                const walletValRaw = getValue(columnMapping.walletAmount, ['Balance', 'Wallet Amount', 'Wallet Balance', 'Wallet']);

                if (!trievId && !mobile) throw new Error('Missing Unique Identifier (TriEVRiderID or MobileNo)');
                if (!currentRiderName) throw new Error('Missing Rider Name');

                const existingRider = (trievId ? riderTrievMap.get(trievId) : null)
                    ?? (mobile ? riderMobileMap.get(mobile) : null);

                let teamLeaderId = findMatchingUserId(teamLeaderName, reportingManagerName);
                let finalTLName = teamLeaderName || 'Unassigned';

                if (teamLeaderId) {
                    finalTLName = userByIdMap.get(teamLeaderId)?.full_name || teamLeaderName;
                } else if (existingRider && existingRider.team_leader_id && userByIdMap.has(existingRider.team_leader_id)) {
                    teamLeaderId = existingRider.team_leader_id;
                    finalTLName = existingRider.team_leader_name || userByIdMap.get(teamLeaderId)?.full_name || 'Unassigned';
                }

                // Skip if TL is not registered
                if (!teamLeaderId) {
                    summary.skipped++;
                    continue;
                }

                // Check Staff Filter
                if (!isStaffSelected(teamLeaderId, teamLeaderName, existingRider?.team_leader_id, reportingManagerName)) {
                    summary.skipped++;
                    continue;
                }

                const clientName = isValidClient(clientRaw) ? clientRaw : 'Other';
                let allotmentDate = dateRaw ? parseIndianDate(dateRaw) : null;
                const walletAmount = parseCurrency(walletValRaw);

                if (existingRider) {
                    matchedSheetRiderIds.add(existingRider.id);
                    const updatePayload = {};

                    if (trievIdRaw && cleanString(existingRider.triev_id) !== trievIdRaw) updatePayload.triev_id = trievIdRaw;
                    if (currentRiderName && cleanString(existingRider.rider_name) !== currentRiderName) updatePayload.rider_name = currentRiderName;
                    if (mobile && cleanString(existingRider.mobile_number) !== mobile) updatePayload.mobile_number = mobile;
                    if (chassis && cleanString(existingRider.chassis_number) !== chassis) updatePayload.chassis_number = chassis;
                    if (clientName && cleanString(existingRider.client_name) !== clientName) updatePayload.client_name = clientName;
                    if (clientId && cleanString(existingRider.client_id) !== clientId) updatePayload.client_id = clientId;
                    if (allotmentDate && cleanString(existingRider.allotment_date) !== allotmentDate) updatePayload.allotment_date = allotmentDate;
                    if (remarks && cleanString(existingRider.remarks) !== remarks) updatePayload.remarks = remarks;

                    if (teamLeaderId && existingRider.team_leader_id !== teamLeaderId) {
                        updatePayload.team_leader_id = teamLeaderId;
                        updatePayload.team_leader_name = finalTLName;
                    }

                    if (walletValRaw !== '' && existingRider.wallet_amount !== walletAmount) {
                        updatePayload.wallet_amount = walletAmount;
                    }

                    // Reactivation check
                    if (existingRider.status === 'inactive') {
                        updatePayload.status = 'active';
                        updatePayload.inactivated_at = null;
                        summary.reactivated++;
                    }

                    if (Object.keys(updatePayload).length > 0) {
                        updatePayload.updated_at = new Date().toISOString();
                        pendingUpdates.push({ id: existingRider.id, payload: updatePayload });
                    } else {
                        summary.success++;
                    }
                } else {
                    const newRiderPayload = {
                        triev_id: trievIdRaw || '',
                        rider_name: currentRiderName,
                        mobile_number: mobile || '',
                        chassis_number: chassis || '',
                        client_name: clientName,
                        client_id: clientId || '',
                        wallet_amount: walletAmount || 0,
                        allotment_date: allotmentDate || new Date().toISOString().split('T')[0],
                        remarks: remarks || '',
                        team_leader_id: teamLeaderId,
                        team_leader_name: finalTLName,
                        status: 'active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    pendingInserts.push(newRiderPayload);
                }
            } catch (err) {
                summary.failed++;
                if (summary.errors.length < 20) {
                    summary.errors.push(`Row ${rowNum}: ${err.message}`);
                }
            }
        }

        // 8. Execute Batch Inserts
        if (pendingInserts.length > 0) {
            const insertBatches = chunkArray(pendingInserts, 100);
            for (const batch of insertBatches) {
                const { error: insErr } = await supabase.from('riders').insert(batch);
                if (insErr) {
                    console.error("Batch insert error:", insErr);
                    summary.failed += batch.length;
                    if (summary.errors.length < 20) summary.errors.push(`Batch Insert: ${insErr.message}`);
                } else {
                    summary.success += batch.length;
                }
            }
        }

        // 9. Execute Batch Updates
        if (pendingUpdates.length > 0) {
            const updateBatches = chunkArray(pendingUpdates, 50);
            for (const batch of updateBatches) {
                await Promise.all(batch.map(async ({ id, payload }) => {
                    const { error: updErr } = await supabase.from('riders').update(payload).eq('id', id);
                    if (updErr) {
                        summary.failed++;
                        if (summary.errors.length < 20) summary.errors.push(`Update Rider ${id}: ${updErr.message}`);
                    } else {
                        summary.updated++;
                        summary.success++;
                    }
                }));
            }
        }

        // 10. Strict Mirroring: Inactivate Missing Riders
        if (config.strictMirror) {
            const nowIso = new Date().toISOString();
            const ridersToInactivate = allDbRiders.filter(r => 
                r.status === 'active' && !matchedSheetRiderIds.has(r.id)
            );

            if (ridersToInactivate.length > 0) {
                const inactBatches = chunkArray(ridersToInactivate.map(r => r.id), 100);
                for (const ids of inactBatches) {
                    await supabase
                        .from('riders')
                        .update({ status: 'inactive', inactivated_at: nowIso, updated_at: nowIso })
                        .in('id', ids);
                }
                summary.inactivated += ridersToInactivate.length;
            }
        }

        // 11. Write to import_history table
        const nowIso = new Date().toISOString();
        await supabase.from('import_history').insert({
            admin_id: 'system-cron-service',
            admin_name: 'Background System Cron Engine',
            import_type: 'googleSheet',
            total_rows: summary.total,
            success_count: summary.success,
            failure_count: summary.failed,
            skipped_count: summary.skipped,
            updated_count: summary.updated,
            status: summary.failed === 0 ? 'success' : (summary.success === 0 ? 'failed' : 'partial'),
            errors: summary.errors,
            created_at: nowIso
        });

        // 12. Release Lock & Save Final Sync Status
        const finalStatus = {
            lastSyncTime: nowIso,
            status: 'active',
            syncError: null,
            scannedCount: summary.total,
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
