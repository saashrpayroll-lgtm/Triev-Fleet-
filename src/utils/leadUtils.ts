import { Lead } from '@/types';

/**
 * Maps database dictionary (mixed case) to Application Lead Type (CamelCase)
 */
export const mapLeadFromDB = (data: any): Lead => {
    return {
        id: data.id,
        leadId: data.lead_id || data.leadId,
        riderName: data.rider_name || data.riderName || data.name || 'Unknown',
        mobileNumber: data.mobile_number || data.mobileNumber || data.phone || '',
        city: data.city || data.job_location || '',
        location: data.location || { lat: 0, lng: 0, accuracy: 0, timestamp: new Date().toISOString() },
        drivingLicense: data.driving_license || data.drivingLicense || 'No',
        evTypeInterested: data.ev_type_interested || data.evTypeInterested || 'High Speed',
        clientInterested: data.client_interested || data.clientInterested || 'Other',
        expectedAllotmentDate: data.expected_allotment_date || data.expectedAllotmentDate,
        currentEvUsing: data.current_ev_using || data.currentEvUsing || 'None',
        source: data.source || 'Field Sourcing',
        remarks: data.remarks || data.notes || '',
        status: data.status || 'New',
        category: data.category || data.lead_category || 'Genuine',
        createdBy: data.created_by || data.createdBy,
        createdByName: data.created_by_name || data.createdByName || 'Unknown',
        createdAt: data.created_at || data.createdAt || new Date().toISOString(),
        updatedAt: data.updated_at || data.updatedAt,
        deletedAt: data.deleted_at || data.deletedAt,
        score: data.score
    };
};

/**
 * Maps Application Model to Database Data (for Insert/Update)
 * Converts CamelCase to SnakeCase for Supabase
 */
export const mapLeadToDB = (lead: Partial<Lead> | any) => {
    const dbPayload: any = {};

    if (lead.leadId) dbPayload.lead_id = lead.leadId;
    if (lead.riderName) dbPayload.rider_name = lead.riderName;
    if (lead.mobileNumber) dbPayload.mobile_number = lead.mobileNumber;
    if (lead.city) dbPayload.city = lead.city;
    if (lead.location) dbPayload.location = lead.location;
    if (lead.drivingLicense) dbPayload.driving_license = lead.drivingLicense;
    if (lead.evTypeInterested) dbPayload.ev_type_interested = lead.evTypeInterested;
    if (lead.clientInterested) dbPayload.client_interested = lead.clientInterested;
    if (lead.expectedAllotmentDate) dbPayload.expected_allotment_date = lead.expectedAllotmentDate;
    if (lead.currentEvUsing) dbPayload.current_ev_using = lead.currentEvUsing;
    if (lead.source) dbPayload.source = lead.source;
    if (lead.remarks) dbPayload.remarks = lead.remarks;
    if (lead.status) dbPayload.status = lead.status;
    if (lead.category) dbPayload.category = lead.category;
    if (lead.createdBy) dbPayload.created_by = lead.createdBy;
    if (lead.createdByName) dbPayload.created_by_name = lead.createdByName;
    if (lead.createdAt) dbPayload.created_at = lead.createdAt;
    if (lead.updatedAt) dbPayload.updated_at = lead.updatedAt;
    if (typeof lead.score !== 'undefined') dbPayload.score = lead.score;

    return dbPayload;
};
