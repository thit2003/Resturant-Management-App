import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from '@/app/context/AppContext'
import { Toaster } from 'sonner'

// Pages
import { Login } from '@/app/pages/Login'
import { StaffDashboard } from '@/app/pages/StaffDashboard'
import { ChefDashboard } from '@/app/pages/ChefDashboard'
import { CashierDashboard } from '@/app/pages/CashierDashboard'
import { ManagerDashboard } from '@/app/pages/ManagerDashboard'
import { DashboardLayout } from '@/app/components/layout/DashboardLayout'

const roleDefaultPath = (role) => {
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole === 'manager') return '/manager';
  if (normalizedRole === 'chef') return '/chef';
  if (normalizedRole === 'cashier') return '/cashier';
  return '/staff';
};

const RequireRole = ({ allowedRoles, children }) => {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  const normalizedRole = String(user.role || '').toLowerCase();
  if (!allowedRoles.includes(normalizedRole)) {
    return <Navigate to={roleDefaultPath(user.role)} replace />;
  }
  return children;
};

const LoginRoute = () => {
  const { user } = useApp();
  if (user) return <Navigate to={roleDefaultPath(user.role)} replace />;
  return <Login />;
};

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          
          <Route element={<DashboardLayout />}>
             <Route path="/staff/*" element={<RequireRole allowedRoles={['staff']}><StaffDashboard /></RequireRole>} />
             <Route path="/chef/*" element={<RequireRole allowedRoles={['chef']}><ChefDashboard /></RequireRole>} />
             <Route path="/cashier/*" element={<RequireRole allowedRoles={['cashier']}><CashierDashboard /></RequireRole>} />
             <Route path="/manager/*" element={<RequireRole allowedRoles={['manager']}><ManagerDashboard /></RequireRole>} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
