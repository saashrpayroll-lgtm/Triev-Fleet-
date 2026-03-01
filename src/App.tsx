import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { supabase } from '@/config/supabase';
import { Toaster } from 'sonner';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';
import '@/index.css';

// ─── Eagerly loaded (critical path – must be instant) ────────────────────────
import LoginPage from '@/pages/auth/LoginPage';
import AdminLogin from '@/pages/admin/AdminLogin';

// ─── Lazily loaded (only downloaded when the route is actually visited) ────────
const ForgotPassword = React.lazy(() => import('@/pages/auth/ForgotPassword'));
const RegisterPage = React.lazy(() => import('@/pages/auth/RegisterPage'));

// Team Leader Pages
const TeamLeaderLayout = React.lazy(() => import('@/layouts/TeamLeaderLayout'));
const TLDashboard = React.lazy(() => import('@/pages/teamleader/Dashboard'));
const MyRiders = React.lazy(() => import('@/pages/teamleader/MyRiders'));
const TLActivityLog = React.lazy(() => import('@/pages/teamleader/ActivityLog'));
const TLReports = React.lazy(() => import('@/pages/teamleader/Reports'));
const TLProfile = React.lazy(() => import('@/pages/teamleader/Profile'));
const TLRequests = React.lazy(() => import('@/pages/teamleader/Requests'));
const CollectionHistory = React.lazy(() => import('@/pages/teamleader/CollectionHistory'));
const TLPersonalPerformance = React.lazy(() => import('@/pages/teamleader/Performance'));
const TLNotificationsPage = React.lazy(() => import('@/pages/teamleader/TLNotificationsPage'));
const UserLeads = React.lazy(() => import('@/pages/teamleader/UserLeads'));
const TLForms = React.lazy(() => import('@/pages/teamleader/TLForms'));

// Admin Pages
const AdminLayout = React.lazy(() => import('@/layouts/AdminLayout'));
const AdminDashboard = React.lazy(() => import('@/pages/admin/AdminDashboard'));
const Analytics = React.lazy(() => import('@/pages/admin/Analytics'));
const RiderManagement = React.lazy(() => import('@/pages/admin/RiderManagement'));
const UserManagement = React.lazy(() => import('@/pages/admin/users'));
const DataManagement = React.lazy(() => import('@/pages/admin/DataManagement'));
const AdminActivityLog = React.lazy(() => import('@/pages/admin/ActivityLog'));
const AdminReports = React.lazy(() => import('@/pages/admin/Reports'));
const AdminProfile = React.lazy(() => import('@/pages/admin/Profile'));
const NotificationManagement = React.lazy(() => import('@/pages/admin/NotificationManagement'));
const AdminChat = React.lazy(() => import('@/pages/admin/AdminChat'));
const WalletHistory = React.lazy(() => import('@/pages/admin/WalletHistory'));
const RequestManagement = React.lazy(() => import('@/pages/admin/RequestManagement'));
const LeaderboardPage = React.lazy(() => import('@/pages/admin/LeaderboardPage'));
const TLPerformance = React.lazy(() => import('@/pages/admin/TLPerformance'));
const TLAllotment = React.lazy(() => import('@/pages/admin/TLAllotment'));
const AdminNotificationsPage = React.lazy(() => import('@/pages/admin/AdminNotificationsPage'));
const AdminForms = React.lazy(() => import('@/pages/admin/AdminForms'));
const AdminLeads = React.lazy(() => import('@/pages/admin/AdminLeads'));

// ─── Loading fallback used by Suspense boundaries ─────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="text-xs text-muted-foreground font-medium">Loading...</span>
    </div>
  </div>
);

// ─── Full-screen loading shown while auth state resolves ─────────────────────
const LoadingScreen = () => {
  const [showSlowLoading, setShowSlowLoading] = React.useState(false);
  const [showReset, setShowReset] = React.useState(false);

  React.useEffect(() => {
    const timer1 = setTimeout(() => setShowSlowLoading(true), 3000);
    const timer2 = setTimeout(() => setShowReset(true), 8000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const handleReset = async () => {
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
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
            Reset &amp; Reload
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Protected Route ──────────────────────────────────────────────────────────
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'teamLeader')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userData, loading } = useSupabaseAuth();

  if (loading) return <LoadingScreen />;

  if (!user || !userData) return <Navigate to="/login" replace />;

  if ((userData.role as string) === 'guest') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          Your account is authenticated, but no user profile was found. Please contact your administrator.
        </p>
        <div className="p-4 bg-muted/50 rounded-lg text-left text-xs font-mono mb-6 w-full max-w-md overflow-auto">
          <p>User ID: {user.id}</p>
          <p>Email: {user.email}</p>
          <p>Status: {userData.status}</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Sign Out
        </button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(userData.role)) return <Navigate to="/unauthorized" replace />;

  if (userData.status === 'suspended') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Account Suspended</h1>
          <p className="text-muted-foreground">Your account has been temporarily suspended. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  if (userData.status === 'inactive') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Account Inactive</h1>
          <p className="text-muted-foreground mb-4">Your account is currently inactive. Please contact your administrator.</p>
          {userData.username === 'saunvir1130' && (
            <button
              onClick={async () => {
                if (user) { await supabase.from('users').update({ status: 'active' }).eq('id', user.id); window.location.reload(); }
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

// ─── Public Route (redirects away if already logged in) ──────────────────────
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userData, loading } = useSupabaseAuth();

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Loading...</div>
    </div>
  );

  if (user && userData) {
    const redirectPath = userData.role === 'admin' ? '/portal' : '/team-leader';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

// ─── Presence tracker (non-rendering) ────────────────────────────────────────
import { usePresence } from '@/hooks/usePresence';

function PresenceTracker() {
  const { user, userData } = useSupabaseAuth();
  usePresence(user?.id, user?.email, userData?.role);
  return null;
}

// ─── App Routes ───────────────────────────────────────────────────────────────
function AppRoutes() {
  const { userData, user, refreshUserData } = useSupabaseAuth();

  return (
    <>
      <PresenceTracker />
      {userData?.force_password_change && user && (
        <ForcePasswordChangeModal userId={user.id} onPasswordChanged={refreshUserData} />
      )}

      {/* Suspense boundary wraps ALL lazy routes */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes — login pages are eagerly loaded (no lazy) */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/admin-login" element={<PublicRoute><AdminLogin /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* Team Leader Routes */}
          <Route
            path="/team-leader"
            element={<ProtectedRoute allowedRoles={['teamLeader']}><TeamLeaderLayout /></ProtectedRoute>}
          >
            <Route index element={<TLDashboard />} />
            <Route path="leads" element={<UserLeads />} />
            <Route path="riders" element={<MyRiders />} />
            <Route path="activity-log" element={<TLActivityLog />} />
            <Route path="reports" element={<TLReports />} />
            <Route path="profile" element={
              userData?.permissions?.modules?.profile ? <TLProfile /> : <Navigate to="/team-leader" replace />
            } />
            <Route path="requests" element={<TLRequests />} />
            <Route path="wallet-history" element={<WalletHistory />} />
            <Route path="collections" element={<CollectionHistory />} />
            <Route path="performance" element={<TLPersonalPerformance />} />
            <Route path="notifications" element={<TLNotificationsPage />} />
            <Route path="forms" element={<TLForms />} />
          </Route>

          {/* Admin Portal Routes */}
          <Route
            path="/portal"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="riders" element={<RiderManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="tl-performance" element={<TLPerformance />} />
            <Route path="tl-allotment" element={<TLAllotment />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="broadcast" element={<NotificationManagement />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="forms" element={<AdminForms />} />
            <Route path="chat" element={<AdminChat />} />
            <Route path="requests" element={<RequestManagement />} />
            <Route path="data" element={<DataManagement />} />
            <Route path="wallet-history" element={<WalletHistory />} />
            <Route path="activity-log" element={<AdminActivityLog />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          {/* Default root redirect */}
          <Route
            path="/"
            element={
              userData?.role === 'admin'
                ? <Navigate to="/portal" replace />
                : <Navigate to="/team-leader" replace />
            }
          />

          {/* 404 & Unauthorized */}
          <Route
            path="/unauthorized"
            element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
                  <p className="text-muted-foreground mb-6">You don't have permission to access this page.</p>
                  <div className="bg-muted p-4 rounded-lg text-left text-xs font-mono mb-6 inline-block max-w-sm">
                    <p className="font-bold mb-2">Diagnostic Info:</p>
                    <p>Your Role: <span className="text-primary">{userData?.role || 'None'}</span></p>
                    <p>User ID: {user?.id}</p>
                  </div>
                  <br />
                  <button onClick={() => window.history.back()} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 mr-2">Go Back</button>
                  <button onClick={() => { supabase.auth.signOut(); window.location.href = '/login'; }} className="px-4 py-2 border border-border rounded-lg hover:bg-accent">Sign Out</button>
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
      </Suspense>
    </>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <GlobalErrorBoundary>
      <SupabaseAuthProvider>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
              <Toaster position="top-right" richColors />
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </SupabaseAuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
