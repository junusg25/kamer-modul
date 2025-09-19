import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/theme-context'
import { AuthProvider } from './contexts/auth-context'
import { NotificationsProvider } from './contexts/notifications-context'
import { WebSocketProvider } from './contexts/websocket-context'
import { FeedbackProvider } from './contexts/feedback-context'
import { ProtectedRoute } from './components/protected-route'
import { PermissionProtectedRoute } from './components/permission-protected-route'
import { RoleProtectedRoute } from './components/role-protected-route'
import Login from './pages/login'
import Customers from './pages/customers'
import CustomerDetail from './pages/customer-detail'
import AddCustomer from './pages/add-customer'
import AddMachineModel from './pages/add-machine-model'
import MachineModelDetail from './pages/machine-model-detail'
import MachineDetail from './pages/machine-detail'
import Machines from './pages/machines'
import Inventory from './pages/inventory'
import InventoryDetail from './pages/inventory-detail'
import AddInventoryItem from './pages/add-inventory-item'
import RepairTicketDetail from './pages/repair-ticket-detail'
import WorkOrderDetail from './pages/work-order-detail'
import WarrantyRepairTicketDetail from './pages/warranty-repair-ticket-detail'
import WarrantyWorkOrderDetail from './pages/warranty-work-order-detail'
import WarrantyRepairTickets from './pages/warranty-repair-tickets'
import WarrantyWorkOrders from './pages/warranty-work-orders'
import CreateRepairTicket from './pages/create-repair-ticket'
import CreateWarrantyRepairTicket from './pages/create-warranty-repair-ticket'
import RepairTickets from './pages/repair-tickets'
import WorkOrders from './pages/work-orders'
import PipelineLeads from './pages/pipeline-leads'
import QuoteManagement from './pages/quote-management'
import SalesReports from './pages/sales-reports'
import DashboardRouter from './pages/dashboard-router'
import DashboardOverview from './pages/dashboard-overview'
import DashboardMyWork from './pages/dashboard-my-work'
import DashboardAdmin from './pages/dashboard-admin'
import AdminFeedback from './pages/admin-feedback'
import Settings from './pages/settings'
import Notifications from './pages/notifications'
import RentalMachines from './pages/rental-machines'
import MachineRentals from './pages/machine-rentals'
import RentalDetail from './pages/rental-detail'
import RentalAnalytics from './pages/rental-analytics'
import DynamicPricing from './pages/dynamic-pricing'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <NotificationsProvider>
            <FeedbackProvider>
              <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <DashboardRouter />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/overview" element={
                <ProtectedRoute>
                  <DashboardOverview />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/my-work" element={
                <ProtectedRoute>
                  <DashboardMyWork />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/admin" element={
                <RoleProtectedRoute allowedRoles={['admin', 'manager']}>
                  <DashboardAdmin />
                </RoleProtectedRoute>
              } />
              <Route path="/admin-feedback" element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminFeedback />
                </RoleProtectedRoute>
              } />
              <Route path="/customers" element={
                <PermissionProtectedRoute requiredPermissions={['customers:read']}>
                  <Customers />
                </PermissionProtectedRoute>
              } />
              <Route path="/customers/:id" element={
                <PermissionProtectedRoute requiredPermissions={['customers:read']}>
                  <CustomerDetail />
                </PermissionProtectedRoute>
              } />
              <Route path="/add-customer" element={
                <PermissionProtectedRoute requiredPermissions={['customers:write']}>
                  <AddCustomer />
                </PermissionProtectedRoute>
              } />
              <Route path="/add-machine-model" element={
                <ProtectedRoute>
                  <AddMachineModel />
                </ProtectedRoute>
              } />
                  <Route path="/machines" element={
                    <ProtectedRoute>
                      <Machines />
                    </ProtectedRoute>
                  } />
                  <Route path="/machines/model/:modelId" element={
                    <ProtectedRoute>
                      <MachineModelDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="/machines/:id" element={
                    <ProtectedRoute>
                      <MachineDetail />
                    </ProtectedRoute>
                  } />
              <Route path="/inventory" element={
                <PermissionProtectedRoute requiredPermissions={['inventory:read']}>
                  <Inventory />
                </PermissionProtectedRoute>
              } />
              <Route path="/inventory/:id" element={
                <PermissionProtectedRoute requiredPermissions={['inventory:read']}>
                  <InventoryDetail />
                </PermissionProtectedRoute>
              } />
              <Route path="/add-inventory-item" element={
                <PermissionProtectedRoute requiredPermissions={['inventory:write']}>
                  <AddInventoryItem />
                </PermissionProtectedRoute>
              } />
              <Route path="/repair-tickets" element={
                <PermissionProtectedRoute requiredPermissions={['repair_tickets:read']}>
                  <RepairTickets />
                </PermissionProtectedRoute>
              } />
              <Route path="/repair-tickets/:id" element={
                <PermissionProtectedRoute requiredPermissions={['repair_tickets:read']}>
                  <RepairTicketDetail />
                </PermissionProtectedRoute>
              } />
              <Route path="/create-repair-ticket" element={
                <PermissionProtectedRoute requiredPermissions={['repair_tickets:write']}>
                  <CreateRepairTicket />
                </PermissionProtectedRoute>
              } />
              <Route path="/create-warranty-repair-ticket" element={
                <PermissionProtectedRoute requiredPermissions={['repair_tickets:write']}>
                  <CreateWarrantyRepairTicket />
                </PermissionProtectedRoute>
              } />
              <Route path="/work-orders" element={
                <PermissionProtectedRoute requiredPermissions={['work_orders:read']}>
                  <WorkOrders />
                </PermissionProtectedRoute>
              } />
              <Route path="/work-orders/:id" element={
                <PermissionProtectedRoute requiredPermissions={['work_orders:read']}>
                  <WorkOrderDetail />
                </PermissionProtectedRoute>
              } />
              <Route path="/pipeline-leads" element={
                <PermissionProtectedRoute requiredPermissions={['pipeline:read']}>
                  <PipelineLeads />
                </PermissionProtectedRoute>
              } />
              <Route path="/quote-management" element={
                <PermissionProtectedRoute requiredPermissions={['quotes:read']}>
                  <QuoteManagement />
                </PermissionProtectedRoute>
              } />
              <Route path="/sales-reports" element={
                <PermissionProtectedRoute requiredPermissions={['sales_reports:read']}>
                  <SalesReports />
                </PermissionProtectedRoute>
              } />
              <Route path="/warranty-repair-tickets" element={
                <PermissionProtectedRoute requiredPermissions={['repair_tickets:read']}>
                  <WarrantyRepairTickets />
                </PermissionProtectedRoute>
              } />
              <Route path="/warranty-repair-tickets/:id" element={
                <PermissionProtectedRoute requiredPermissions={['repair_tickets:read']}>
                  <WarrantyRepairTicketDetail />
                </PermissionProtectedRoute>
              } />
              <Route path="/warranty-work-orders" element={
                <PermissionProtectedRoute requiredPermissions={['work_orders:read']}>
                  <WarrantyWorkOrders />
                </PermissionProtectedRoute>
              } />
              <Route path="/warranty-work-orders/:id" element={
                <PermissionProtectedRoute requiredPermissions={['work_orders:read']}>
                  <WarrantyWorkOrderDetail />
                </PermissionProtectedRoute>
              } />
              <Route path="/rental-machines" element={
                <ProtectedRoute>
                  <RentalMachines />
                </ProtectedRoute>
              } />
              <Route path="/machine-rentals" element={
                <ProtectedRoute>
                  <MachineRentals />
                </ProtectedRoute>
              } />
              <Route path="/machine-rentals/:id" element={
                <ProtectedRoute>
                  <RentalDetail />
                </ProtectedRoute>
              } />
              <Route path="/rental-analytics" element={
                <ProtectedRoute>
                  <RentalAnalytics />
                </ProtectedRoute>
              } />
              <Route path="/dynamic-pricing" element={
                <ProtectedRoute>
                  <DynamicPricing />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <PermissionProtectedRoute requiredPermissions={['settings:read']}>
                  <Settings />
                </PermissionProtectedRoute>
              } />
              <Route path="/admin-only-test" element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <div className="p-6">
                    <h1 className="text-2xl font-bold">Admin Only Page</h1>
                    <p className="text-muted-foreground">This page is only accessible to admin users.</p>
                  </div>
                </RoleProtectedRoute>
              } />
            </Routes>
            </Router>
            </FeedbackProvider>
          </NotificationsProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App