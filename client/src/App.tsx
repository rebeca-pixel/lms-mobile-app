import { Switch, Route, useLocation } from "wouter";
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Login from '@/pages/Login';
import { Layout } from '@/components/layout/Layout';
import EmployeeDashboard from '@/pages/employee/Dashboard';
import ApplyLeave from '@/pages/employee/ApplyLeave';
import ApplyCompOff from '@/pages/employee/ApplyCompOff';
import ApproveCompOff from '@/pages/admin/ApproveCompOff';
import LeaveHistory from '@/pages/employee/History';
import Profile from '@/pages/employee/Profile';
import Permission from '@/pages/employee/Permission';
import AdminDashboard from '@/pages/admin/Dashboard';
import ViewLeaves from '@/pages/admin/ViewLeaves';
import ViewPermissions from '@/pages/admin/ViewPermissions';
import Charts from '@/pages/admin/Charts';
import Employees from '@/pages/admin/Employees';
import ApprovedLeaves from '@/pages/admin/ApprovedLeaves';
import ApprovedPermissions from '@/pages/admin/ApprovedPermissions';
import Reports from '@/pages/Reports';
import IndividualReport from '@/pages/admin/IndividualReport';
import ResetPassword from '@/pages/ResetPassword';
import ManageBalances from '@/pages/admin/ManageBalances';
import AttendanceLeaveReport from '@/pages/admin/AttendanceLeaveReport';
import AttendanceSettings from '@/pages/admin/AttendanceSettings';

function ProtectedRoute({ component: Component, role }: { component: any, role?: 'Admin' | 'Employee' | 'HR' }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return null;

  if (!user) {
    // Redirect logic should probably be in useEffect to avoid state update during render
    // But for this mock, returning null and letting the parent re-render or the user click login is fine
    // However, we can use a redirect effect here
    if (window.location.pathname !== '/') {
      setTimeout(() => setLocation('/'), 0);
    }
    return null;
  }

  // Role check logic
  // Admin can access everything (in this simple mock, or we restrict them from employee pages?)
  // For now:
  // - Admin role requires user.role === 'Admin'
  // - HR role requires user.role === 'HR'
  // - Employee role allows 'Employee', 'HR' (since HR is also an employee), and 'Admin' (optional, but Admin usually has separate dash)

  if (role) {
    if (role === 'Admin' && user.role !== 'Admin' && user.role !== 'HR') {
      return (
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-lg text-center max-w-md">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                ✕
              </div>
              <h3 className="text-xl font-bold text-slate-900">Unauthorized Access</h3>
              <p className="text-sm text-slate-600 mt-2">
                This page is reserved for Admin and HR roles only. You do not have permission to manage leave balances.
              </p>
            </div>
          </div>
        </Layout>
      );
    }
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Employee Routes - Accessible by Employee and HR */}
      <Route path="/employee/dashboard">
        <ProtectedRoute component={EmployeeDashboard} role="Employee" />
      </Route>
      <Route path="/employee/apply-leave">
        <ProtectedRoute component={ApplyLeave} role="Employee" />
      </Route>
      <Route path="/employee/history">
        <ProtectedRoute component={LeaveHistory} role="Employee" />
      </Route>
      <Route path="/employee/profile">
        <ProtectedRoute component={Profile} role="Employee" />
      </Route>
      <Route path="/employee/permission">
        <ProtectedRoute component={Permission} role="Employee" />
      </Route>
      <Route path="/employee/apply-comp-off">
        <ProtectedRoute component={ApplyCompOff} role="Employee" />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin/dashboard">
        <ProtectedRoute component={AdminDashboard} role="Admin" />
      </Route>
      <Route path="/admin/view-leaves">
        {/* HR needs access to View Leaves */}
        <ProtectedRoute component={ViewLeaves} role="Admin" />
      </Route>
      <Route path="/admin/view-permissions">
        <ProtectedRoute component={ViewPermissions} role="Admin" />
      </Route>
      <Route path="/admin/approve-comp-off">
        <ProtectedRoute component={ApproveCompOff} role="Admin" />
      </Route>
      <Route path="/admin/departments">
        <ProtectedRoute component={Employees} role="Admin" />
      </Route>
      <Route path="/admin/employees">
        <ProtectedRoute component={Employees} role="Admin" />
      </Route>
      <Route path="/admin/charts">
        <ProtectedRoute component={Charts} role="Admin" />
      </Route>
      <Route path="/admin/approved-leaves">
        <ProtectedRoute component={ApprovedLeaves} role="Admin" />
      </Route>
      <Route path="/admin/approved-permissions">
        <ProtectedRoute component={ApprovedPermissions} role="Admin" />
      </Route>
      <Route path="/admin/manage-balances">
        <ProtectedRoute component={ManageBalances} role="Admin" />
      </Route>

      {/* Reports - Accessible by Admin and HR */}
      <Route path="/reports">
        <ProtectedRoute component={Reports} role="Admin" />
      </Route>
      <Route path="/admin/attendance-report">
        <ProtectedRoute component={AttendanceLeaveReport} role="Admin" />
      </Route>
      <Route path="/admin/attendance-leave-report">
        <ProtectedRoute component={AttendanceLeaveReport} role="Admin" />
      </Route>
      <Route path="/attendance-report">
        <ProtectedRoute component={AttendanceLeaveReport} role="Admin" />
      </Route>
      <Route path="/admin/attendance-settings">
        <ProtectedRoute component={AttendanceSettings} role="Admin" />
      </Route>
      <Route path="/attendance-settings">
        <ProtectedRoute component={AttendanceSettings} role="Admin" />
      </Route>
      <Route path="/admin/individual-report/:id">
        <ProtectedRoute component={IndividualReport} role="Employee" />
      </Route>

      <Route>
        <div className="text-white p-8 text-center">404 - Page Not Found</div>
      </Route>
    </Switch>
  );
}

import React, { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from '@/components/ui/toaster';
import { initPushNotifications, startRealtimePushListener } from '@/lib/pushNotifications';

function NotificationBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    initPushNotifications();
  }, []);

  useEffect(() => {
    if (user) {
      const cleanup = startRealtimePushListener(user);
      return cleanup;
    }
  }, [user]);

  return null;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationBootstrap />
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
