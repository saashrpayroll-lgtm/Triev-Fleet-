import { Lead } from '@/types';

/**
 * Maps database dictionary (mixed case) to Application Lead Type (CamelCase)
 */
export const mapLeadFromDB = (data: any): Lead => {
    return {
        id: data.id,
        leadId: data.leadId || data.lead_id,
        // Map 'name' (New Schema) -> riderName
        riderName: data.name || data.riderName || data.rider_name || 'Unknown Rider',
        // Map 'phone' (New Schema) -> mobileNumber
        mobileNumber: data.phone || data.mobileNumber || data.mobile_number || '',

        city: data.city || data.job_location || data.location_city, // Fallback chain

        // JSONB Location
        location: data.location || { lat: 0, lng: 0, accuracy: 0, timestamp: new Date().toISOString() },

        drivingLicense: data.drivingLicense || data.driving_license || 'No',
        evTypeInterested: data.evTypeInterested || data.ev_type || data.ev_type_interest || 'High Speed',
        // Restored to fix Typscript Error:
        clientInterested: data.clientInterested || data.client || data.client_name || 'Other',

        expectedAllotmentDate: data.expectedAllotmentDate || data.expected_allotment_date,
        currentEvUsing: data.currentEvUsing || data.current_ev || data.current_ev_using || 'None',
        source: data.source || 'Field Sourcing',

        // Map 'notes' (New Schema) -> remarks
        remarks: data.notes || data.remarks || '',

        status: data.status,
        category: data.leadCategory || data.lead_category || data.category || 'Genuine',

        createdBy: data.created_by || data.createdBy,
        createdByName: data.createdByName || data.created_by_name || 'Unknown',
        createdAt: data.createdAt || data.created_at || new Date().toISOString(), // Fallback for display
        updatedAt: data.updatedAt || data.updated_at,
        deletedAt: data.deletedAt || data.deleted_at,
        score: data.score
    };
};

/**
 * Maps Application Model to Database Data (for Insert/Update)
 * Converts CamelCase to SnakeCase for Supabase
 */
export const mapLeadToDB = (lead: Partial<Lead> | any) => {
    const dbPayload: any = {};

    // --- ID ---
    // ERROR: "Could not find 'lead_id' column"
    // if (lead.leadId) dbPayload.lead_id = lead.leadId;

    // --- DIAGNOSTIC FIX ---
    // Confirmed via schema probe that columns are 'rider_name' and 'mobile_number'

    if (lead.riderName) dbPayload.rider_name = lead.riderName;
    if (lead.mobileNumber) dbPayload.mobile_number = lead.mobileNumber;

    if (lead.source) dbPayload.source = lead.source;
    if (lead.status) dbPayload.status = lead.status;

    // Metadata
    if (lead.createdBy) dbPayload.created_by = lead.createdBy;

    // --- DATA PRESERVATION REWRITE ---
    const extraDetails = [];

    // DIAGNOSTIC RESTORATION
    // Since we are guessing 'name' and 'phone', we DON'T put them in remarks yet.
    // We want to see if the columns exist.

    // --- VERIFIED SCHEMA MAPPING ---
    // All columns below have been confirmed via probe.

    if (lead.drivingLicense) dbPayload.driving_license = lead.drivingLicense;
    if (lead.clientInterested) dbPayload.client_interested = lead.clientInterested;
    if (lead.evTypeInterested) dbPayload.ev_type_interested = lead.evTypeInterested;
    if (lead.currentEvUsing) dbPayload.current_ev_using = lead.currentEvUsing;
    if (lead.expectedAllotmentDate) dbPayload.expected_allotment_date = lead.expectedAllotmentDate;
    if (lead.location) dbPayload.location = lead.location; // JSONB
    if (lead.category) dbPayload.category = lead.category;
    if (lead.createdByName) dbPayload.created_by_name = lead.createdByName;

    // 8. Lead ID (if exists and needed, usually auto-gen)
    if (lead.leadId) {
        // We generally don't insert lead_id manually unless syncing
        // dbPayload.lead_id = lead.leadId; 
        extraDetails.push(`Lead ID: ${lead.leadId}`);
    }

    // Combine into Notes (Pivot from Remarks)
    // DIAGNOSTIC FIX 2: Schema has 'remarks' column, NOT 'notes'.
    // And 'city' column exists.

    if (lead.city) dbPayload.city = lead.city;
    if (lead.remarks) dbPayload.remarks = lead.remarks;

    // We no longer need to stuff everything into 'notes' or 'remarks' if columns exist.
    // But let's keep the extra details logic just in case other columns are missing, 
    // but put them into 'remarks' instead of 'notes'.

    const combinedRemarks = [
        // lead.remarks, // specific remarks are already in dbPayload.remarks
        ...extraDetails // Extra details that didn't map to a column
    ].filter(Boolean).join(' | ');

    if (combinedRemarks && combinedRemarks.length > 0) {
        // Append to existing remarks or set it
        dbPayload.remarks = dbPayload.remarks
            ? `${dbPayload.remarks} | ${combinedRemarks}`
            : combinedRemarks;
    }

    // delete dbPayload.notes; // Ensure we don't send 'notes'

    // --- Timestamps ---
    // User reported 'updated_at' is missing.
    // Commenting out explicit timestamp assignment to let DB handle defaults or ignore.
    // if (lead.createdAt) dbPayload.created_at = lead.createdAt;
    // if (lead.updatedAt) dbPayload.updated_at = lead.updatedAt;
    // if (lead.deletedAt) dbPayload.deleted_at = lead.deletedAt;

    if (typeof lead.score !== 'undefined') dbPayload.score = lead.score;

    return dbPayload;
};
