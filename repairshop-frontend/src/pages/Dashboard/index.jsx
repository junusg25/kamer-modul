import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminDashboard from './AdminDashboard';
import TechnicianDashboard from './TechnicianDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  
  // Determine user role and render appropriate dashboard
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isTechnician = user?.role === 'technician';

  if (isAdmin || isManager) {
    return <AdminDashboard />;
  }

  if (isTechnician) {
    return <TechnicianDashboard />;
  }

  // Fallback for unknown roles
  return <TechnicianDashboard />;
}
