import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import LoginPage from '@/pages/auth/LoginPage';
import AdminLogin from '@/pages/admin/AdminLogin';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import RegisterPage from '@/pages/auth/RegisterPage';
import { supabase } from '@/config/supabase';

// Team Leader Pages
import TeamLeaderLayout from '@/layouts/TeamLeaderLayout';
import TLDashboard from '@/pages/teamleader/Dashboard';
import MyRiders from '@/pages/teamleader/MyRiders';
import TLActivityLog from '@/pages/teamleader/ActivityLog';
import TLReports from '@/pages/teamleader/Reports';
import TLProfile from '@/pages/teamleader/Profile';
import TLRequests from '@/pages/teamleader/Requests';

import AdminLeads from '@/pages/admin/AdminLeads';
import UserLeads from '@/pages/teamleader/UserLeads';

// Admin Pages
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import Analytics from '@/pages/admin/Analytics';
import RiderManagement from '@/pages/admin/RiderManagement';
import UserManagement from '@/pages/admin/users';
import DataManagement from '@/pages/admin/DataManagement';
import AdminActivityLog from '@/pages/admin/ActivityLog';
import AdminReports from '@/pages/admin/Reports';
import AdminProfile from '@/pages/admin/Profile';
import NotificationManagement from '@/pages/admin/NotificationManagement';

import RequestManagement from '@/pages/admin/RequestManagement';
import LeaderboardPage from '@/pages/admin/LeaderboardPage';

import '@/index.css';
import FloatingChatWidget from '@/components/chat/FloatingChatWidget';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';

// Helper component for loading state
const LoadingScreen = () => {
  const [showSlowLoading, setShowSlowLoading] = React.useState(false);
  const [showReset, setShowReset] = React.useState(false);

  React.useEffect(() => {
    const timer1 = setTimeout(() => setShowSlowLoading(true), 3000); // 3s
    const timer2 = setTimeout(() => setShowReset(true), 8000); // 8s

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleReset = async () => {
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
      <div className="text-lg font-medium">Loading Application...</div>

      {showSlowLoading && (
        <p className="text-muted-foreground text-sm mt-2 animate-in fade-in">
          Connecting to secure services...
        </p>
      )}

      {showReset && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
          <p className="text-amber-600 dark:text-amber-500 text-sm mb-3">
            Taking longer than expected?
          </p>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm font-medium border border-border shadow-sm"
          >
            Reset & Reload
          </button>
        </div>
      )}
    </div>
  );
};

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'teamLeader')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userData, loading } = useSupabaseAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !userData) {
    return <Navigate to="/login" replace />;
  }

  // Handle Guest/Uninitialized Profile
  if ((userData.role as string) === 'guest') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          Your account is authenticated, but no user profile was found in our database.
          Please contact your administrator to create your profile.
        </p>
        <div className="p-4 bg-muted/50 rounded-lg text-left text-xs font-mono mb-6 w-full max-w-md overflow-auto">
          <p>User ID: {user.id}</p>
          <p>Email: {user.email}</p>
          <p>Status: {userData.status}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(userData.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check if user is suspended
  if (userData.status === 'suspended') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Account Suspended</h1>
          <p className="text-muted-foreground">
            Your account has been temporarily suspended. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (userData.status === 'inactive') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Account Inactive</h1>
          <p className="text-muted-foreground mb-4">
            Your account is currently inactive. Please contact your administrator.
          </p>
          {/* Emergency Recovery for Admin (Supabase version) */}
          {userData.username === 'saunvir1130' && ( // Assuming username field exists in Supabase users
            <button
              onClick={async () => {
                if (user) {
                  await supabase.from('users').update({ status: 'active' }).eq('id', user.id);
                  window.location.reload();
                }
              }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90"
            >
              Emergency Reactivate (Admin Only)
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Public Route Component (redirects to dashboard if already logged in)
interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { user, userData, loading } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (user && userData) {
    // Redirect to appropriate dashboard based on role
    const redirectPath = userData.role === 'admin' ? '/admin' : '/team-leader';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};



function AppRoutes() {
  const { userData, user, refreshUserData } = useSupabaseAuth();

  return (
    <>
      {userData?.force_password_change && user && (
        <ForcePasswordChangeModal
          userId={user.id}
          onPasswordChanged={refreshUserData}
        />
      )}
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/admin-login"
          element={
            <PublicRoute>
              <AdminLogin />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Team Leader Routes */}
        <Route
          path="/team-leader"
          element={
            <ProtectedRoute allowedRoles={['teamLeader']}>
              <TeamLeaderLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<TLDashboard />} />
          <Route path="leads" element={<UserLeads />} />
          <Route path="riders" element={<MyRiders />} />
          <Route path="activity-log" element={<TLActivityLog />} />
          <Route path="reports" element={<TLReports />} />
          <Route path="profile" element={<TLProfile />} />
          <Route path="requests" element={<TLRequests />} />
        </Route>

        {/* Admin Portal Routes */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="riders" element={<RiderManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="notifications" element={<NotificationManagement />} />
          <Route path="requests" element={<RequestManagement />} />
          <Route path="data" element={<DataManagement />} />
          <Route path="activity-log" element={<AdminActivityLog />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>

        {/* Default Route */}
        <Route
          path="/"
          element={
            userData?.role === 'admin' ? (
              <Navigate to="/portal" replace />
            ) : (
              <Navigate to="/team-leader" replace />
            )
          }
        />

        {/* 404 & Unauthorized */}
        <Route
          path="/unauthorized"
          element={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
                <p className="text-muted-foreground mb-6">
                  You don't have permission to access this page.
                </p>
                {/* Debug Info for User */}
                <div className="bg-muted p-4 rounded-lg text-left text-xs font-mono mb-6 inline-block max-w-sm">
                  <p className="font-bold mb-2">Diagnostic Info:</p>
                  <p>Your Role: <span className="text-primary">{userData?.role || 'None'}</span></p>
                  {/* <p>Required Role: {allowedRoles?.join(' or ') || 'None'}</p> */}
                  <p>User ID: {user?.id}</p>
                </div>
                <br />
                <button
                  onClick={() => window.history.back()}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 mr-2"
                >
                  Go Back
                </button>
                <button
                  onClick={() => { supabase.auth.signOut(); window.location.href = '/login'; }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-accent"
                >
                  Sign Out
                </button>
              </div>
            </div>
          }
        />
        <Route
          path="*"
          element={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">404 - Page Not Found</h1>
                <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
              </div>
            </div>
          }
        />
      </Routes>
    </>
  );
}

import { Toaster } from 'sonner';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';
import ComponentErrorBoundary from '@/components/ComponentErrorBoundary';

function App() {
  console.log('App component rendering (Supabase)');
  return (
    <GlobalErrorBoundary>
      <SupabaseAuthProvider>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
              <ComponentErrorBoundary name="ChatWidget">
                <FloatingChatWidget />
              </ComponentErrorBoundary>
              <Toaster position="top-right" richColors />
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </SupabaseAuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
