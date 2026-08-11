// User Types
export type UserRole = 'admin' | 'teamLeader' | 'reportingManager' | 'cityOps';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted' | 'pending_approval';
export type WalletAccessLevel = 'full' | 'readOnly' | 'none';

export interface UserPermissions {
    dashboard: {
        view: boolean;
        statsCards: {
            totalRiders: boolean;
            activeRiders: boolean;
            inactiveRiders: boolean;
            deletedRiders: boolean;
            teamLeaders: boolean; // Admin only usually
            revenue: boolean;
            // Leads
            totalLeads: boolean;
            newLeads: boolean;
            convertedLeads: boolean;
            notConvertedLeads: boolean;
            // Wallet
            walletPositive: boolean;
            walletNegative: boolean;
            walletZero: boolean;
            walletAverage: boolean;
            // Leaderboard
            leaderboard: boolean;
        };
        charts: {
            revenue: boolean;
            onboarding: boolean;
        };
        recentActivity: boolean;
    };
    // Sidebar & Pages Access
    modules: {
        leads: boolean;
        riders: boolean;
        users: boolean; // Admin only
        notifications: boolean;
        requests: boolean;
        dataManagement: boolean;
        activityLog: boolean;
        reports: boolean;
        profile: boolean;
    };
    // Detailed Action Permissions
    riders: {
        view: boolean;
        create: boolean;
        edit: boolean;
        delete: boolean; // Soft delete
        hardDelete: boolean; // Permanent
        statusChange: boolean;
        export: boolean;
        call: boolean; // Permission to click Call button
        whatsapp: boolean; // Permission to click WhatsApp button
        bulkActions: {
            statusChange: boolean;
            delete: boolean;
            sendReminders: boolean;
            assignTeamLeader: boolean; // Admin/TL with rights
            export: boolean;
        };
        fields: {
            viewSensitive: boolean; // Mobile/Bank info?
        };
        idCard: boolean; // Toggle for Rider ID Card feature
    };
    // Separate Lead Actions
    leads: {
        view: boolean;
        create: boolean;
        edit: boolean;
        delete: boolean;
        statusChange: boolean;
        export: boolean;
        bulkActions: { // Added bulkActions for Leads
            statusChange: boolean;
            delete: boolean;
            assign: boolean; // Assign to self or others
            export: boolean;
        };
    };
    users: { // Admin Panel User Management
        view: boolean;
        create: boolean;
        edit: boolean;
        delete: boolean;
        managePermissions: boolean;
        suspend: boolean;
    };
    wallet: {
        view: boolean;
        addFunds: boolean;
        deductFunds: boolean;
        viewHistory: boolean;
        bulkUpdate: boolean; // Data Management
    };
    notifications: {
        view: boolean;
        broadcast: boolean; // Send new
        delete: boolean;
    };
    requests: { // Request Management
        view: boolean;
        resolve: boolean;
        delete: boolean;
    };
    reports: {
        view: boolean;
        generate: boolean;
        export: boolean;
    };
    profile: {
        view: boolean;
        editPersonalDetails: boolean; // Name, Mobile, Email
        editBankDetails: boolean;
        changePassword: boolean; // Self
        idCard: boolean; // Employee Virtual ID Card on Profile page
    };
    system: {
        resetUserPassword: boolean; // Admin action for others
    };
    aiCalling?: {
        enabled: boolean;          // Master toggle (Admin controls per TL)
        manualCall: boolean;       // Can manually trigger calls
        autoCall: boolean;         // Can enable auto-call for their riders
        viewCallHistory: boolean;  // Can see call logs
        bulkCall: boolean;         // Can trigger bulk calls
    };
    // Reporting Manager Panel permissions (only relevant for RM role)
    rmPanel?: {
        dashboard: boolean;
        tlPerformance: boolean;
        leaderboard: boolean;
        riderOverview: boolean;
        leadOverview: boolean;
        reports: boolean;
        collectionHistory: boolean;
        export: boolean; // Can export data from any allowed page
    };
    // City Ops Panel permissions (controlled by Admin via Permission Manager)
    cityOpsPanel?: {
        view: boolean;
        dashboard: {
            view: boolean;
            statsCards: {
                totalRiders: false, activeRiders: false, inactiveRiders: false, deletedRiders: false,
                teamLeaders: false, revenue: false,
                totalLeads: false, newLeads: false, convertedLeads: false, notConvertedLeads: false,
                walletPositive: false, walletNegative: false, walletZero: false, walletAverage: false,
                leaderboard: false,
                zomatoVpi: false
            },
            charts: { revenue: false, onboarding: false, weeklyCollection: false },
            recentActivity: false
        };
        riderManagement: boolean;
        leadManagement: boolean;
        leaderboard: boolean;
        dataManagement: {
            bulkRiderImport: boolean;
            bulkWalletUpdate: boolean;
            rentCollectionImport: boolean;
            auditSync: boolean;
            importHistory: boolean;
            googleSheets: boolean;
        };
        walletLedger: boolean;
        reports: boolean;
        activityLog: boolean;
        notifications: boolean;
        analytics: boolean;
        walletBifurcation: boolean;
        companyForms: boolean;
        staffRoles: boolean; // City Ops can create RM/TL under themselves
        rmPerformance: boolean;
        tlPerformance: boolean;
        allotmentSystem: boolean;
        profile: boolean;
        export: boolean;
    };
}

export interface User {
    id: string;
    userId: string; // Auto-generated ID like TRIEV-001, TRIEV-002
    fullName: string;
    mobile: string;
    email: string;
    username: string;
    role: UserRole;
    reportingManager: string;
    jobLocation: string;
    status: UserStatus;
    suspendedUntil?: string | null;
    permissions: UserPermissions;
    createdAt: string;
    updatedAt: string;
    remarks?: string;
    position?: string;
    profilePicUrl?: string;
    monthlyTarget?: number; // Target collection amount
    awardedBadges?: string[]; // E.g., ['top_collector', 'zero_churn']
    force_password_change?: boolean; // Force user to change password on next login
    last_password_change?: string; // Timestamp of last password change
    cityOpsId?: string; // Links RM/TL to their City Ops head for hierarchy scoping
    currentLocation?: {
        lat: number;
        lng: number;
        timestamp: string;
    };
}

// Password Reset Request Types
export type PasswordResetStatus = 'pending' | 'approved' | 'rejected';

export interface PasswordResetRequest {
    id: string;
    userId: string;
    mobileNumber: string;
    status: PasswordResetStatus;
    requestedAt: string;
    processedAt?: string | null;
    processedBy?: string | null;
    createdAt: string;
}

// Rider Types
export type RiderStatus = 'active' | 'inactive' | 'deleted';
export type ClientName = 'Zomato' | 'Zepto' | 'Blinkit' | 'Uber' | 'Porter' | 'Rapido' | 'Swiggy' | 'FLK' | 'Other';

export interface Rider {
    id: string;
    trievId: string;
    riderName: string;
    mobileNumber: string;
    chassisNumber: string;
    clientName: ClientName;
    clientId?: string;
    walletAmount: number;
    allotmentDate: string;
    remarks: string;
    status: RiderStatus;
    teamLeaderId: string;
    teamLeaderName: string;
    comments?: string; // Optional comments/notes field
    createdAt: string;
    updatedAt: string;
    inactivatedAt?: string | null;
    lastStatusChangeAt?: string | null;
    deletedAt?: string | null;
    photoUrl?: string; // URL for the rider's ID photo
}

// Activity Log Types
export type ActionType =
    | 'riderAdded'
    | 'riderEdited'
    | 'statusChanged'
    | 'riderDeleted'
    | 'userCreated'
    | 'userEdited'
    | 'userDeleted' // Added
    | 'userRestored'
    | 'bulkUserDeleted'
    | 'requestCreated' // Added
    | 'permissionChanged'
    | 'walletUpdated'
    | 'reportGenerated'
    | 'bulkImport'
    | 'login'
    | 'logout'
    | 'call_rider'
    | 'whatsapp_rider'
    | 'sent_reminder'
    | 'payment_reminder'
    | 'leadCreated'
    | 'leadStatusChange'
    | 'sent_recovery_warning'
    | 'wallet_transaction';

export type TargetType = 'rider' | 'user' | 'report' | 'system' | 'lead' | 'request';

export interface ActivityLog {
    id: string;
    userId: string;
    userName: string;
    userRole: UserRole;
    actionType: ActionType;
    targetType: TargetType;
    targetId: string;
    details: string;
    metadata: Record<string, unknown>;
    timestamp: string;
    isDeleted: boolean;
}

// Notification Types
export type NotificationType =
    | 'system'
    | 'riderAlert'
    | 'walletAlert'
    | 'permissionChange'
    | 'issue'
    | 'feature'
    | 'wallet'
    | 'allotment'
    | 'recharge'
    | 'reminder'
    | 'leadAlert'
    | 'info'
    | 'warning';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    priority?: NotificationPriority; // New
    tags?: string[]; // New
    relatedEntity?: {
        type: 'rider' | 'user';
        id: string;
    };
    isRead: boolean;
    createdAt: string;
    readAt?: string | null;
}

// Report Types
export type ReportType =
    | 'riderList'
    | 'walletStatement'
    | 'statusSummary'
    | 'teamLeaderPerformance'
    | 'clientWise'
    | 'custom';

export interface Report {
    id: string;
    generatedBy: string;
    reportType: ReportType;
    parameters: Record<string, unknown>;
    fileUrl?: string;
    createdAt: string;
}

// Form Types (for creating/editing)
export interface RiderFormData {
    trievId: string;
    riderName: string;
    mobileNumber: string;
    chassisNumber: string;
    clientName: string;
    clientId?: string;
    walletAmount: number;
    teamLeaderId?: string;
    allotmentDate?: string;
    status: RiderStatus;
    comments?: string;
    remarks?: string;
}

export interface UserFormData {
    fullName: string;
    mobile: string;
    email: string;
    username: string;
    password: string;
    reportingManager: string;
    jobLocation: string;
    role: UserRole;
}

// Dashboard Stats
export interface DashboardStats {
    totalRiders: number;
    activeRiders: number;
    inactiveRiders: number;
    deletedRiders: number;
    totalPositiveWallet: number;
    totalNegativeWallet: number;
    netWalletBalance: number;
}

export interface AdminDashboardStats extends DashboardStats {
    totalTeamLeaders: number;
    activeTeamLeaders: number;
    suspendedTeamLeaders: number;
}

// Data Management Types
export type ImportStatus = 'success' | 'partial' | 'failed';
export type ImportType = 'rider' | 'wallet' | 'googleSheet';

export interface ImportHistory {
    id: string;
    adminId: string;
    adminName: string;
    importType: ImportType;
    fileName?: string;
    sheetName?: string;
    totalRows: number;
    successCount: number;
    failureCount: number;
    status: ImportStatus;
    errors: ImportError[];
    timestamp: string;
}

export interface ImportError {
    row: number;
    identifier: string; // e.g., name or mobile
    reason: string;
    data?: Record<string, unknown>;
}


export interface ImportSummary {
    total: number;
    success: number;
    failed: number;
    updated?: number; // Added for tracking updates
    skipped?: number; // Added for duplicate checks
    errors: ImportError[];
    skippedDetails?: ImportError[]; // Reusing ImportError type since structure is identical
    successfulDetails?: unknown[]; // Array to temporarily hold successful transaction info
}

// Request Management Types
export type RequestType =
    | 'password_reset'
    | 'rider_update'
    | 'wallet_issue'
    | 'permission_request'
    | 'data_correction'
    | 'other';

export type RequestStatus = 'pending' | 'in_progress' | 'waiting_for_info' | 'resolved' | 'rejected' | 'deleted' | 'purged';
export type RequestPriority = 'low' | 'medium' | 'high';

export interface RequestTimelineEvent {
    status: RequestStatus;
    remark: string;
    timestamp: string;
    updatedBy: string;
    role: 'admin' | 'user' | 'system';
}

export interface Request {
    id: string;
    ticketId?: number; // Auto-generated 5-digit ID
    type: RequestType;
    subject: string;
    description: string;
    priority: RequestPriority;

    // User who raised the request (Team Leader or User)
    userId?: string;
    userName?: string;
    email: string;
    userRole?: UserRole;

    // Target Entity (e.g. specific rider involved)
    relatedEntityId?: string;
    relatedEntityName?: string;
    relatedEntityType?: 'rider' | 'user';

    status: RequestStatus;
    createdAt: string;
    updatedAt?: string;

    // Resolution Details
    resolvedAt?: string;
    resolvedBy?: string; // Admin Email/Name
    adminResponse?: string; // Reply visible to user
    internalNotes?: string; // Admin internal remarks

    timeline?: RequestTimelineEvent[];

    attachments?: string[]; // URLs for screenshots (optional)
}

// Lead Management Types (Sourcing)
export type LeadStatus = 'New' | 'Convert' | 'Not Convert';
export type LeadCategory = 'Genuine' | 'Match' | 'Duplicate';
export type LicenseType = 'Permanent' | 'Learning' | 'No';
export type EVTypeInterest = 'High Speed' | 'Low Speed';
export type LeadSource = 'Online' | 'Walking' | 'Field Sourcing' | 'Calling' | 'Referral' | 'Other';

export interface Lead {
    id: string;
    leadId: number; // Auto-generated numeric ID
    riderName: string;
    mobileNumber: string;
    city: string;

    // Location Data (Mandatory & Auto-captured)
    location: {
        lat: number;
        lng: number;
        accuracy: number;
        timestamp: string;
        address?: string; // Optional reverse geocoded
    };

    // Evaluation
    drivingLicense: LicenseType;
    evTypeInterested: EVTypeInterest;
    clientInterested: ClientName | string; // Using string to allow broader options
    expectedAllotmentDate?: string;
    currentEvUsing: string; // Zypp, Yulu, etc.
    source: LeadSource;
    remarks?: string;

    // System/Auto-Assigned
    status: LeadStatus;
    category: LeadCategory;

    // Metadata
    createdBy: string; // User ID of Team Leader/Sourcer
    createdByName: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
    isPermanentlyDeleted?: boolean;
    score?: number; // AI Score (0-100)
}

// Reconciliation Types
export interface ReconciliationItem {
    rider_id: string;
    rider_name: string;
    triev_id: string;
    mobile_number: string;
    team_leader_id?: string;
    system_balance: number;
    snapshot_balance: number;
    snapshot_date: string;
    difference: number;
}

// AI Calling System Types
export interface AICallLog {
    id: string;
    riderId: string;
    riderName: string;
    mobileNumber: string;
    callScenario: 'negative_balance' | 'low_balance' | 'custom_reminder' | 'onboarding_followup';
    triggeredBy: string;       // User ID or 'auto_scheduler'
    triggeredByName: string;
    callId: string;            // ElevenLabs call ID
    status: 'queued' | 'initiated' | 'completed' | 'failed' | 'success';
    connectedStatus?: 'connected' | 'unanswered' | 'busy' | 'failed' | 'in_progress';
    walletAmountAtCall: number;
    duration?: number;         // Seconds
    transcript?: string;       // AI voice conversation transcript
    summary?: string;          // AI outcome summary
    recordingUrl?: string;     // ElevenLabs recording audio URL
    notes?: string;
    createdAt: string;
}

export interface GlobalCallingRules {
    maxCallsPerRiderDaily: number;
    autoRetryHours: number;
    enableLoopSystem: boolean;
    allowedTimeStart: string;
    allowedTimeEnd: string;
}

export interface AutoCallConfig {
    id: string;
    teamLeaderId: string;
    enabled: boolean;
    negativeBalanceThreshold: number;  // Default: 0
    lowBalanceThreshold: number;       // Default: 250
    maxCallsPerDay: number;            // Default: 20
    callTimeStart: string;             // "10:00"
    callTimeEnd: string;               // "18:00"
    lastRunAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

