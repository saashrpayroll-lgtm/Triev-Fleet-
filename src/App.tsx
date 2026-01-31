import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import LoginPage from '@/pages/auth/LoginPage';
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

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'teamLeader')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userData, loading } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !userData) {
    return <Navigate to="/login" replace />;
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
  const { userData } = useSupabaseAuth();

  return (
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

      {/* Admin Routes */}
      <Route
        path="/admin"
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
            <Navigate to="/admin" replace />
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
              <p className="text-muted-foreground">
                You don't have permission to access this page.
              </p>
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
  );
}

import { Toaster } from 'sonner';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';

function App() {
  console.log('App component rendering (Supabase)');
  return (
    <GlobalErrorBoundary>
      <SupabaseAuthProvider>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
              <FloatingChatWidget />
              <Toaster position="top-right" richColors />
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </SupabaseAuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
