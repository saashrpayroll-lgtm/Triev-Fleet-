# Triev Rider Pro

A comprehensive dual-panel rider and team management application with role-based access control for Team Leaders and Administrators.

## Features

### Team Leader Panel
- **Dashboard**: Summary cards showing rider statistics and wallet overview
- **My Riders**: Complete rider management with advanced filtering, search, and bulk actions
- **Reports**: Generate and export various reports
- **Activity Log**: Track all actions performed
- **Profile**: Manage profile settings

### Admin Panel
- **Dashboard**: High-level overview of all users and riders
- **Rider Management**: View and manage all riders across all team leaders
- **User Management**: Create and manage team leaders with granular permissions
- **Data Management**: Bulk import/export riders and wallet updates
- **Reports**: System-wide reporting
- **Activity Log**: Global activity tracking

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with Shadcn-inspired design system
- **Backend**: Firebase (Authentication, Firestore, Cloud Messaging)
- **State Management**: React Context API
- **Routing**: React Router DOM v6
- **Form Handling**: React Hook Form + Zod validation
- **Data Tables**: TanStack Table
- **Charts**: Recharts
- **Export**: xlsx, papaparse, jsPDF

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Firebase project (already configured)

### Installation

1. **Install Dependencies**
```bash
npm install
```

2. **Environment Configuration**
The `.env` file is already configured with Firebase credentials.

3. **Deploy Firestore Security Rules**
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (select Firestore)
firebase init

# Deploy security rules
firebase deploy --only firestore:rules
```

4. **Initialize Database**
You need to create at least one admin user in Firestore:

- Go to Firebase Console → Firestore Database
- Create a document in the `users` collection with the following structure:

```json
{
  "fullName": "Admin User",
  "mobile": "+919876543210",
  "email": "admin@trievrider.com",
  "username": "admin",
  "role": "admin",
  "reportingManager": "Self",
  "jobLocation": "Head Office",
  "status": "active",
  "permissions": {
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
  },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

- Then create a Firebase Authentication user with the same email
- The document ID should match the Firebase Auth UID

5. **Run Development Server**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Default Login
- Email: `admin@trievrider.com` (or whatever you configured)
- Password: Set during Firebase Auth user creation

## Project Structure

```
src/
├── config/
│   └── firebase.ts          # Firebase configuration
├── contexts/
│   └── AuthContext.tsx      # Authentication context
├── layouts/
│   ├── AdminLayout.tsx      # Admin panel layout
│   └── TeamLeaderLayout.tsx # Team leader layout
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── ForgotPassword.tsx
│   ├── admin/               # Admin pages
│   └── teamleader/          # Team leader pages
├── types/
│   └── index.ts             # TypeScript definitions
├── App.tsx                  # Main app with routing
├── main.tsx                 # Entry point
└── index.css                # Global styles
```

## Development Roadmap

- [x] Phase 1: Project setup and authentication
- [ ] Phase 2: Team Leader dashboard and rider management
- [ ] Phase 3: Admin panel features
- [ ] Phase 4: Advanced features (notifications, reports, bulk operations)
- [ ] Phase 5: UI/UX polish and dark mode
- [ ] Phase 6: Testing and deployment

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Firebase Collections

- **users**: Team leaders and admins
- **riders**: Rider information
- **activityLogs**: Audit trail of all actions
- **notifications**: User notifications
- **reports**: Generated reports

## Security

- Role-based access control (RBAC) implemented at Firestore level
- Row-level security ensuring users only access their data
- Permission-based action control
- Suspended/inactive user handling

## Contributing

This is a private project. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved © 2026 Triev Rider Pro
