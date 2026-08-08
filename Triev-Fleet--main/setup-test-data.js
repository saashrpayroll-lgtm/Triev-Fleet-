// Script to create Team Leader user and sample riders in Firebase
// This shows the data structure - you'll need to add this manually in Firebase Console

// ============================================
// STEP 1: Create Team Leader User in Firebase Authentication
// ============================================
// Go to: Firebase Console > Authentication > Users > Add user
// Email: teamleader@trievrider.com
// Password: TL@123456
// Copy the generated UID (you'll need it below)

// ============================================
// STEP 2: Add Team Leader User Document to Firestore
// ============================================
// Collection: users
// Document ID: [USE THE UID FROM STEP 1]

const teamLeaderUserDocument = {
    id: "REPLACE_WITH_UID_FROM_STEP_1", // e.g., "abc123xyz456"
    fullName: "Rajesh Kumar",
    email: "teamleader@trievrider.com",
    username: "rajesh.kumar",
    mobile: "+919876543210",
    role: "teamLeader",
    reportingManager: "Admin User",
    jobLocation: "Mumbai Office",
    status: "active",
    suspendUntil: null,
    permissions: {
        dashboardVisibility: true,
        tabs: {
            myRiders: true,
            reports: true,
            activityLog: true
        },
        riderActions: {
            add: true,
            edit: true,
            view: true,
            statusChange: true,
            delete: true
        },
        walletAccessLevel: "full",
        profileEditRights: true
    },
    createdAt: "TIMESTAMP_NOW", // Use Firebase Timestamp.now()
    updatedAt: "TIMESTAMP_NOW"
};

// ============================================
// STEP 3: Add Sample Riders to Firestore
// ============================================
// Collection: riders
// Create multiple documents (one for each rider)

const sampleRiders = [
    {
        trievId: "TR001234",
        riderName: "Amit Sharma",
        mobileNumber: "+919876543211",
        chassisNumber: "MH12AB1234",
        clientName: "Zomato",
        clientId: "ZOM123456",
        walletAmount: 1500,
        status: "active",
        teamLeaderId: "REPLACE_WITH_TL_UID", // Same as Team Leader UID
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    },
    {
        trievId: "TR001235",
        riderName: "Priya Patel",
        mobileNumber: "+919876543212",
        chassisNumber: "MH12CD5678",
        clientName: "Swiggy",
        clientId: "SWG789012",
        walletAmount: -800,
        status: "active",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    },
    {
        trievId: "TR001236",
        riderName: "Vikram Singh",
        mobileNumber: "+919876543213",
        chassisNumber: "DL10EF9012",
        clientName: "Zepto",
        clientId: "ZEP345678",
        walletAmount: 2300,
        status: "active",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    },
    {
        trievId: "TR001237",
        riderName: "Neha Verma",
        mobileNumber: "+919876543214",
        chassisNumber: "KA05GH3456",
        clientName: "Blinkit",
        clientId: "BLK901234",
        walletAmount: 0,
        status: "inactive",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    },
    {
        trievId: "TR001238",
        riderName: "Suresh Reddy",
        mobileNumber: "+919876543215",
        chassisNumber: "TN09IJ7890",
        clientName: "Shadowfax",
        clientId: "SHD567890",
        walletAmount: -1200,
        status: "active",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    },
    {
        trievId: "TR001239",
        riderName: "Kavita Joshi",
        mobileNumber: "+919876543216",
        chassisNumber: "GJ01KL2345",
        clientName: "Porter",
        clientId: "POR123456",
        walletAmount: 900,
        status: "active",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    },
    {
        trievId: "TR001240",
        riderName: "Rahul Gupta",
        mobileNumber: "+919876543217",
        chassisNumber: "UP16MN6789",
        clientName: "Rapido",
        clientId: "RAP789012",
        walletAmount: -300,
        status: "inactive",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    },
    {
        trievId: "TR001241",
        riderName: "Anjali Desai",
        mobileNumber: "+919876543218",
        chassisNumber: "RJ14OP1234",
        clientName: "Uber",
        clientId: "UBR345678",
        walletAmount: 1800,
        status: "active",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    },
    {
        trievId: "TR001242",
        riderName: "Manoj Kumar",
        mobileNumber: "+919876543219",
        chassisNumber: "HR26QR5678",
        clientName: "Ola",
        clientId: "OLA901234",
        walletAmount: 450,
        status: "deleted",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: "TIMESTAMP_NOW"
    },
    {
        trievId: "TR001243",
        riderName: "Pooja Agarwal",
        mobileNumber: "+919876543220",
        chassisNumber: "WB22ST9012",
        clientName: "FLK",
        clientId: "FLK567890",
        walletAmount: -600,
        status: "active",
        teamLeaderId: "REPLACE_WITH_TL_UID",
        teamLeaderName: "Rajesh Kumar",
        createdAt: "TIMESTAMP_NOW",
        updatedAt: "TIMESTAMP_NOW",
        deletedAt: null
    }
];

// ============================================
// QUICK SUMMARY
// ============================================
// After adding this data, you will have:
// - 1 Admin User (already exists)
// - 1 Team Leader User
// - 10 Sample Riders:
//   * 6 Active riders
//   * 2 Inactive riders  
//   * 1 Deleted rider
//   * 1 Freelance rider
//
// Wallet Distribution:
// - 5 Positive wallets (Total: ~₹6,950)
// - 4 Negative wallets (Total: ~₹-2,900)
// - 1 Zero wallet
//
// This will make your dashboards look great with real statistics!

console.log("Team Leader User:", teamLeaderUserDocument);
console.log("Sample Riders:", sampleRiders);
