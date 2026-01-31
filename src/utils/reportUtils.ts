import { Rider, User, Request } from '@/types';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

// Data Mappers (DB snake_case -> App camelCase)
export const mapRiderFromDB = (data: any): Rider => ({
    id: data.id,
    trievId: data.triev_id || data.rider_id || '-', // Fallback for legacy
    riderName: data.rider_name,
    mobileNumber: data.mobile_number,
    chassisNumber: data.chassis_number,
    clientName: data.client_name,
    clientId: data.client_id,
    walletAmount: data.wallet_amount || 0,
    allotmentDate: data.allotment_date,
    remarks: data.remarks,
    status: data.status,
    teamLeaderId: data.team_leader_id,
    teamLeaderName: data.team_leader_name,
    comments: data.comments,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    deletedAt: data.deleted_at
});

export const mapUserFromDB = (data: any): User => ({
    id: data.id,
    userId: data.user_id,
    fullName: data.full_name,
    mobile: data.mobile,
    email: data.email,
    username: data.username,
    role: data.role,
    reportingManager: data.reporting_manager,
    jobLocation: data.job_location,
    status: data.status,
    suspendedUntil: data.suspended_until,
    permissions: data.permissions || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    remarks: data.remarks,
    profilePicUrl: data.profile_pic_url,
    currentLocation: data.current_location
});

export const mapRequestFromDB = (data: any): Request => ({
    id: data.id,
    ticketId: data.ticket_id,
    type: data.type,
    subject: data.subject,
    description: data.description,
    priority: data.priority,
    userId: data.user_id,
    userName: data.user_name,
    email: data.email,
    userRole: data.user_role,
    relatedEntityId: data.related_entity_id,
    relatedEntityName: data.related_entity_name,
    relatedEntityType: data.related_entity_type,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    resolvedAt: data.resolved_at,
    resolvedBy: data.resolved_by,
    adminResponse: data.admin_response,
    internalNotes: data.internal_notes,
    timeline: data.timeline,
    attachments: data.attachments
});

// Create a loose interface for ActivityLog if not imported, or use 'any' for now to avoid circular deps if types are in another file that imports this.
// Ideally types should be in @/types. Assuming ActivityLog is not yet strictly typed in @/types/index.ts based on previous context, using any or defining here.
export interface ActivityLogEntry {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
    performedBy?: string;
    timestamp: any;
    [key: string]: any;
}

/**
 * Transform raw Rider object for safe report display
 */
export const transformRiderData = (rider: Rider) => ({
    'Triev ID': rider.trievId || '-',
    'Name': rider.riderName || 'N/A',
    'Mobile': rider.mobileNumber || '-',
    'Status': rider.status ? rider.status.charAt(0).toUpperCase() + rider.status.slice(1) : 'Unknown',
    'Client': rider.clientName || 'Unassigned',
    'Wallet Balance': `₹${(rider.walletAmount || 0).toFixed(2)}`,
    'Date Added': rider.allotmentDate ? new Date(rider.allotmentDate).toLocaleDateString('en-IN') : '-'
});

/**
 * Report utility functions for data aggregation and analysis
 */

export interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    parameters: string[];
}

export interface WalletSummary {
    totalPositive: number;
    totalNegative: number;
    totalZero: number;
    positiveCount: number;
    negativeCount: number;
    zeroCount: number;
    averageWallet: number;
}

export interface ClientDistribution {
    clientName: string;
    riderCount: number;
    totalWallet: number;
    averageWallet: number;
}

export interface TeamLeaderPerformance {
    teamLeaderId: string;
    teamLeaderName: string;
    totalRiders: number;
    activeRiders: number;
    inactiveRiders: number;
    deletedRiders: number;
    totalWallet: number;
    averageWallet: number;
}

/**
 * Pre-configured report templates
 */
export const REPORT_TEMPLATES: ReportTemplate[] = [
    {
        id: 'active_riders',
        name: 'Active Riders Report',
        description: 'List of all currently active riders',
        parameters: ['dateRange', 'client'],
    },
    {
        id: 'wallet_summary',
        name: 'Wallet Summary Report',
        description: 'Financial overview with positive/negative wallet analysis',
        parameters: ['dateRange'],
    },
    {
        id: 'client_distribution',
        name: 'Client-wise Distribution',
        description: 'Riders grouped by client with statistics',
        parameters: ['status'],
    },
    {
        id: 'inactive_riders',
        name: 'Inactive Riders Report',
        description: 'List of inactive riders requiring attention',
        parameters: ['dateRange'],
    },
    {
        id: 'negative_wallet',
        name: 'Negative Wallet Report',
        description: 'Riders with negative wallet balances',
        parameters: ['threshold'],
    },
    {
        id: 'team_leader_performance',
        name: 'Team Leader Performance',
        description: 'Performance metrics for all team leaders',
        parameters: ['dateRange'],
    },
    {
        id: 'request_history',
        name: 'Request History',
        description: 'Log of password resets and user requests',
        parameters: ['status', 'dateRange'],
    },
    {
        id: 'activity_log_report',
        name: 'Activity Audit Log',
        description: 'Detailed system activity and security audit trail',
        parameters: ['dateRange', 'actionType'],
    },
    {
        id: 'system_health',
        name: 'System Health & Stats',
        description: 'Overview of system counts and status distribution',
        parameters: [],
    }
];

/**
 * Generate rider list report with filters
 */
export const generateRiderListReport = (
    riders: Rider[],
    filters?: {
        status?: string;
        client?: string;
        startDate?: Date;
        endDate?: Date;
    }
): Rider[] => {
    let filteredRiders = [...riders];

    if (filters?.status) {
        filteredRiders = filteredRiders.filter(r => r.status === filters.status);
    }

    if (filters?.client) {
        filteredRiders = filteredRiders.filter(r => r.clientName === filters.client);
    }

    if (filters?.startDate && filters?.endDate) {
        filteredRiders = filteredRiders.filter(r => {
            if (!r.allotmentDate) return false;
            if (!r.allotmentDate) return false;
            const riderDate = new Date(r.allotmentDate);
            if (!filters.startDate || !filters.endDate) return false;
            return isWithinInterval(riderDate, {
                start: startOfDay(filters.startDate),
                end: endOfDay(filters.endDate),
            });
        });
    }

    return filteredRiders;
};

/**
 * Generate wallet summary statistics
 */
export const generateWalletSummaryReport = (riders: Rider[]): WalletSummary => {
    const summary = riders.reduce(
        (acc, rider) => {
            const wallet = rider.walletAmount;

            if (wallet > 0) {
                acc.totalPositive += wallet;
                acc.positiveCount += 1;
            } else if (wallet < 0) {
                acc.totalNegative += Math.abs(wallet);
                acc.negativeCount += 1;
            } else {
                acc.zeroCount += 1;
            }

            return acc;
        },
        {
            totalPositive: 0,
            totalNegative: 0,
            totalZero: 0,
            positiveCount: 0,
            negativeCount: 0,
            zeroCount: 0,
            averageWallet: 0,
        }
    );

    const totalWallet = summary.totalPositive - summary.totalNegative;
    summary.averageWallet = riders.length > 0 ? totalWallet / riders.length : 0;

    return summary;
};

/**
 * Generate client-wise distribution report
 */
export const generateClientDistributionReport = (riders: Rider[]): ClientDistribution[] => {
    const clientMap = new Map<string, Rider[]>();

    riders.forEach(rider => {
        const clientRiders = clientMap.get(rider.clientName) || [];
        clientRiders.push(rider);
        clientMap.set(rider.clientName, clientRiders);
    });

    const distribution: ClientDistribution[] = [];

    clientMap.forEach((clientRiders, clientName) => {
        const totalWallet = clientRiders.reduce((sum, r) => sum + r.walletAmount, 0);
        const averageWallet = clientRiders.length > 0 ? totalWallet / clientRiders.length : 0;

        distribution.push({
            clientName,
            riderCount: clientRiders.length,
            totalWallet,
            averageWallet,
        });
    });

    return distribution.sort((a, b) => b.riderCount - a.riderCount);
};

/**
 * Calculate date range statistics
 */
export const calculateDateRangeStats = (
    riders: Rider[],
    startDate: Date,
    endDate: Date
): {
    ridersInRange: Rider[];
    totalAdded: number;
    walletChange: number;
} => {
    const ridersInRange = riders.filter(r => {
        if (!r.allotmentDate) return false;
        const riderDate = new Date(r.allotmentDate);
        return isWithinInterval(riderDate, {
            start: startOfDay(startDate),
            end: endOfDay(endDate),
        });
    });

    const totalWallet = ridersInRange.reduce((sum, r) => sum + r.walletAmount, 0);

    return {
        ridersInRange,
        totalAdded: ridersInRange.length,
        walletChange: totalWallet,
    };
};

/**
 * Generate Team Leader performance report (Admin only)
 */
export const generateTeamLeaderPerformanceReport = (
    riders: Rider[],
    teamLeaders: User[]
): Omit<TeamLeaderPerformance, 'teamLeaderId'>[] => {
    const performanceMap = new Map<string, TeamLeaderPerformance>();

    // Initialize with all team leaders
    teamLeaders.forEach(tl => {
        performanceMap.set(tl.id, {
            teamLeaderId: tl.id,
            teamLeaderName: tl.fullName,
            totalRiders: 0,
            activeRiders: 0,
            inactiveRiders: 0,
            deletedRiders: 0,
            totalWallet: 0,
            averageWallet: 0,
        });
    });

    // Aggregate rider data
    riders.forEach(rider => {
        const performance = performanceMap.get(rider.teamLeaderId);
        if (!performance) return;

        performance.totalRiders += 1;
        performance.totalWallet += rider.walletAmount;

        if (rider.status === 'active') performance.activeRiders += 1;
        else if (rider.status === 'inactive') performance.inactiveRiders += 1;
        else if (rider.status === 'deleted') performance.deletedRiders += 1;
    });

    // Calculate averages
    performanceMap.forEach(performance => {
        if (performance.totalRiders > 0) {
            performance.averageWallet = performance.totalWallet / performance.totalRiders;
        }
    });

    return Array.from(performanceMap.values())
        .map(({ teamLeaderId, ...rest }) => rest)
        .sort((a, b) => b.totalRiders - a.totalRiders);
};

/**
 * Get riders with negative wallet balance
 */
export const getNegativeWalletRiders = (riders: Rider[], threshold: number = 0): Rider[] => {
    return riders
        .filter(r => r.walletAmount < threshold)
        .sort((a, b) => a.walletAmount - b.walletAmount);
};

/**
 * Get inactive riders for a date range
 */
export const getInactiveRiders = (riders: Rider[], daysSince: number = 30): Rider[] => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSince);

    return riders.filter(r => {
        if (r.status !== 'inactive') return false;
        if (!r.updatedAt) return false;

        const lastUpdate = new Date(r.updatedAt);
        return lastUpdate < cutoffDate;
    });
};

/**
 * Generate request history report
 */
export const generateRequestReport = (
    requests: Request[],
    filters?: { status?: string; startDate?: Date; endDate?: Date }
): any[] => {
    let filtered = requests;

    if (filters?.status && filters.status !== 'all') {
        filtered = filtered.filter(r => r.status === filters.status);
    }

    if (filters?.startDate && filters?.endDate) {
        filtered = filtered.filter(r => {
            const date = new Date(r.createdAt);
            return isWithinInterval(date, {
                start: startOfDay(filters.startDate!),
                end: endOfDay(filters.endDate!)
            });
        });
    }

    return filtered.map(r => ({
        'Type': r.type === 'password_reset' ? 'Password Reset' : r.type,
        'Email': r.email,
        'User ID': r.userId || 'N/A',
        'Status': r.status.charAt(0).toUpperCase() + r.status.slice(1),
        'Date': new Date(r.createdAt).toLocaleString(),
        'Resolved By': r.resolvedBy || '-',
        'Resolved At': r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : '-'
    }));
};

/**
 * Generate activity log report
 */
export const generateActivityReport = (
    logs: ActivityLogEntry[],
    filters?: { startDate?: Date; endDate?: Date; actionType?: string }
): any[] => {
    let filtered = logs;

    if (filters?.startDate && filters?.endDate) {
        filtered = filtered.filter(l => {
            const date = new Date(l.timestamp);
            return isWithinInterval(date, {
                start: startOfDay(filters.startDate!),
                end: endOfDay(filters.endDate!)
            });
        });
    }

    // Optional action type filter logic could go here

    return filtered.map(l => ({
        'Action': l.action,
        'Entity': l.entityType,
        'Details': l.details,
        'Performed By': l.performedBy || 'System',
        'Date': new Date(l.timestamp).toLocaleString(),
        'IP': l.metadata?.ip || '-'
    }));
};

/**
 * Generate System Health Report
 */
export const generateSystemHealthReport = (riders: Rider[], users: User[], requests: Request[]): any[] => {
    const activeRiders = riders.filter(r => r.status === 'active').length;
    const inactiveRiders = riders.filter(r => r.status === 'inactive').length;
    const totalWallet = riders.reduce((sum, r) => sum + r.walletAmount, 0);
    const pendingRequests = requests.filter(r => r.status === 'pending').length;

    return [
        { Metric: 'Total Users', Value: users.length, Status: 'Info' },
        { Metric: 'Total Riders', Value: riders.length, Status: 'Info' },
        { Metric: 'Active Riders', Value: activeRiders, Status: 'Good' },
        { Metric: 'Inactive Riders', Value: inactiveRiders, Status: 'Warning' },
        { Metric: 'Total Wallet Float', Value: `₹${totalWallet.toLocaleString()}`, Status: totalWallet > 0 ? 'Good' : 'Alert' },
        { Metric: 'Pending Requests', Value: pendingRequests, Status: pendingRequests > 0 ? 'Warning' : 'Good' }
    ];
};

/**
 * Format report data for export
 */
export const formatReportForExport = (reportType: string, data: any[]): any[] => {
    switch (reportType) {
        case 'wallet_summary':
            return data.map(item => ({
                'Category': item.category,
                'Count': item.count,
                'Total Amount': `₹${item.total.toLocaleString('en-IN')}`,
                'Average': `₹${item.average.toFixed(2)}`,
            }));

        case 'client_distribution':
            return data.map(item => ({
                'Client Name': item.clientName,
                'Rider Count': item.riderCount,
                'Total Wallet': `₹${item.totalWallet.toLocaleString('en-IN')}`,
                'Average Wallet': `₹${item.averageWallet.toFixed(2)}`,
            }));

        case 'team_leader_performance':
            return data.map(item => ({
                'Team Leader': item.teamLeaderName,
                'Total Riders': item.totalRiders,
                'Active': item.activeRiders,
                'Inactive': item.inactiveRiders,
                'Deleted': item.deletedRiders,
                'Total Wallet': `₹${item.totalWallet.toLocaleString('en-IN')}`,
                'Average Wallet': `₹${item.averageWallet.toFixed(2)}`,
            }));

        // Use raw data for these as they are already formatted in generators or are flat
        case 'request_history':
        case 'activity_log_report':
        case 'system_health':
            return data;

        default:
            return data;
    }
};
