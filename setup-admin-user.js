// Helper script showing the permissions object structure for admin user
// Copy this object and add it as a "permissions" field (type: map) in Firebase Console
// Navigate to: Firestore > users > HmaxFwhMHFgiZYmugyKrVSn0G223 > Add field

const permissionsObject = {
    "dashboardVisibility": true,
    "tabs": {
        "myRiders": true,
        "reports": true,
        "activityLog": true
    },
    "riderActions": {
        "add": true,
        "edit": true,
        "view": true,
        "statusChange": true,
        "delete": true
    },
    "walletAccessLevel": "full",
    "profileEditRights": true
};

// Instructions:
// 1. Go to Firebase Console > Firestore > users > HmaxFwhMHFgiZYmugyKrVSn0G223
// 2. Click "Add field"
// 3. Field name: permissions
// 4. Field type: map
// 5. Add each nested field manually following the structure above
