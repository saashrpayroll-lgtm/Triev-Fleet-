import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { supabase } from '@/config/supabase';
import { Toaster } from 'sonner';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';
import ForcePasswordChangeModal from '@/components/ForcePasswordChangeModal';
import ReloadPrompt from '@/components/ReloadPrompt';
import '@/index.css';

// ─── Eagerly loaded (critical path – must be instant) ────────────────────────
import LoginPage from '@/pages/auth/LoginPage';
import AdminLogin from '@/pages/admin/AdminLogin';
import LandingPage from '@/pages/LandingPage';

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
const RMPerformance = React.lazy(() => import('@/pages/admin/RMPerformance'));
const CityOpsPerformance = React.lazy(() => import('@/pages/admin/CityOpsPerformance'));
const TLAllotment = React.lazy(() => import('@/pages/admin/TLAllotment'));
const AdminNotificationsPage = React.lazy(() => import('@/pages/admin/AdminNotificationsPage'));
const AdminForms = React.lazy(() => import('@/pages/admin/AdminForms'));
const AdminLeads = React.lazy(() => import('@/pages/admin/AdminLeads'));
const AICallCenter = React.lazy(() => import('@/pages/admin/AICallCenter'));

// Reporting Manager Pages
const RMLayout = React.lazy(() => import('@/layouts/RMLayout'));
const RMDashboard = React.lazy(() => import('@/pages/rm/RMDashboard'));
const RMTLPerformance = React.lazy(() => import('@/pages/rm/RMTLPerformance'));
const RMForms = React.lazy(() => import('@/pages/rm/RMForms'));
const RMLeaderboard = React.lazy(() => import('@/pages/rm/RMLeaderboard'));
const RMRiderOverview = React.lazy(() => import('@/pages/rm/RMRiderOverview'));
const RMLeadOverview = React.lazy(() => import('@/pages/rm/RMLeadOverview'));
const RMReports = React.lazy(() => import('@/pages/rm/RMReports'));
const RMCollectionHistory = React.lazy(() => import('@/pages/rm/RMCollectionHistory'));
const RMProfile = React.lazy(() => import('@/pages/rm/RMProfile'));

// City Ops Pages
const CityOpsLayout = React.lazy(() => import('@/layouts/CityOpsLayout'));
const CityOpsDashboard = React.lazy(() => import('@/pages/cityops/CityOpsDashboard'));
// Named exports from CityOpsPages
const CityOpsRiderManagement = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsRiderManagement })));
const CityOpsLeads = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsLeads })));
const CityOpsDataManagement = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsDataManagement })));
const CityOpsWalletHistory = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsWalletHistory })));
const CityOpsRMPerformance = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsRMPerformance })));
const CityOpsTLPerformance = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsTLPerformance })));
const CityOpsTLAllotment = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsTLAllotment })));
const CityOpsLeaderboard = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsLeaderboard })));
const CityOpsReports = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsReports })));
const CityOpsActivityLog = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsActivityLog })));
const CityOpsAnalytics = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsAnalytics })));
const CityOpsForms = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsForms })));
const CityOpsStaffRoles = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsStaffRoles })));
const CityOpsNotifications = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsNotifications })));
const CityOpsProfile = React.lazy(() => import('@/pages/cityops/CityOpsPages').then(m => ({ default: m.CityOpsProfile })));

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
  allowedRoles?: ('admin' | 'teamLeader' | 'reportingManager' | 'cityOps')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userData, loading } = useSupabaseAuth();

  if (loading) return <LoadingScreen />;

  if (!user || !userData) {
    const lastRole = localStorage.getItem('user_role');
    if (lastRole === 'admin') {
      return <Navigate to="/admin-login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

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
        </div>
      </div>
    );
  }

  if (userData.status === 'pending_approval') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-sm mx-auto p-6">
          <div className="w-20 h-20 rounded-full bg-amber-500/15 border-4 border-amber-500/30 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⏳</span>
          </div>
          <h1 className="text-2xl font-black mb-3">Awaiting Approval</h1>
          <p className="text-muted-foreground text-sm mb-5">Your account is pending admin approval. You will be able to login once your administrator activates your account.</p>
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 text-left mb-5">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">What to do next?</p>
            <p className="text-xs text-muted-foreground">Contact your reporting manager or admin and share your registered mobile number so they can approve your account from the Staff &amp; Roles panel.</p>
          </div>
          <button onClick={() => { supabase.auth.signOut(); window.location.href = '/login'; }} className="px-5 py-2.5 border border-border rounded-xl hover:bg-accent text-sm font-semibold transition-all">
            Sign Out
          </button>
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
    const redirectPath = userData.role === 'admin' ? '/portal'
                       : userData.role === 'cityOps' ? '/city-ops'
                       : userData.role === 'reportingManager' ? '/rm-panel'
                       : '/team-leader';
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
          {/* /register is open — but new accounts start as 'pending_approval' and require admin activation */}
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
            <Route path="cityops-performance" element={<CityOpsPerformance />} />
            <Route path="rm-performance" element={<RMPerformance />} />
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
            <Route path="ai-calling" element={<AICallCenter />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          {/* Reporting Manager Panel Routes */}
          <Route
            path="/rm-panel"
            element={<ProtectedRoute allowedRoles={['reportingManager']}><RMLayout /></ProtectedRoute>}
          >
            <Route index element={<RMDashboard />} />
            <Route path="tl-performance" element={<RMTLPerformance />} />
            <Route path="leaderboard" element={<RMLeaderboard />} />
            <Route path="riders" element={<RMRiderOverview />} />
            <Route path="leads" element={<RMLeadOverview />} />
            <Route path="reports" element={<RMReports />} />
            <Route path="collections" element={<RMCollectionHistory />} />
            <Route path="profile" element={<RMProfile />} />
            <Route path="company-forms" element={<RMForms />} />
          </Route>

          {/* City Ops Panel Routes */}
          <Route
            path="/city-ops"
            element={<ProtectedRoute allowedRoles={['cityOps']}><CityOpsLayout /></ProtectedRoute>}
          >
            <Route index element={<CityOpsDashboard />} />
            <Route path="riders" element={<CityOpsRiderManagement />} />
            <Route path="leads" element={<CityOpsLeads />} />
            <Route path="leaderboard" element={<CityOpsLeaderboard />} />
            <Route path="data" element={<CityOpsDataManagement />} />
            <Route path="wallet-history" element={<CityOpsWalletHistory />} />
            <Route path="rm-performance" element={<CityOpsRMPerformance />} />
            <Route path="tl-performance" element={<CityOpsTLPerformance />} />
            <Route path="tl-allotment" element={<CityOpsTLAllotment />} />
            <Route path="reports" element={<CityOpsReports />} />
            <Route path="activity-log" element={<CityOpsActivityLog />} />
            <Route path="analytics" element={<CityOpsAnalytics />} />
            <Route path="forms" element={<CityOpsForms />} />
            <Route path="users" element={<CityOpsStaffRoles />} />
            <Route path="notifications" element={<CityOpsNotifications />} />
            <Route path="profile" element={<CityOpsProfile />} />
          </Route>

          {/* Root: Landing for guests, dashboard for logged-in users */}
          <Route
            path="/"
            element={
              !user
                ? <LandingPage />
                : userData?.role === 'admin'
                  ? <Navigate to="/portal" replace />
                  : userData?.role === 'cityOps'
                    ? <Navigate to="/city-ops" replace />
                    : userData?.role === 'reportingManager'
                      ? <Navigate to="/rm-panel" replace />
                      : <Navigate to="/team-leader" replace />
            }
          />

          {/* 404 & Unauthorized */}
          <Route
            path="/unauthorized"
            element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-2xl font-bold mb-4">Unauthorized Access</h1>
                  <p className="text-muted-foreground mb-6">You don't have permission to view this page.</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => window.history.back()} className="px-5 py-2.5 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-colors">Go Back</button>
                    <button onClick={() => { supabase.auth.signOut(); window.location.href = '/login'; }} className="px-4 py-2 border border-border rounded-lg hover:bg-accent">Sign Out</button>
                  </div>
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
              <ReloadPrompt />
              <Toaster position="top-right" richColors />
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </SupabaseAuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
