import React from 'react'
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import AuthProvider from './contexts/AuthContext.jsx'
import { ModalProvider } from './contexts/ModalContext.jsx'
import LanguageProvider from './contexts/LanguageContext.jsx'
import { createAppTheme } from './theme/index.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard/index.jsx'
import WorkOrders from './pages/WorkOrders.jsx'
import WorkOrderDetail from './pages/WorkOrderDetail.jsx'
import WarrantyWorkOrders from './pages/WarrantyWorkOrders.jsx'
import WarrantyWorkOrderDetail from './pages/WarrantyWorkOrderDetail.jsx'
import RepairTickets from './pages/RepairTickets.jsx'
import RepairTicketDetail from './pages/RepairTicketDetail.jsx'
import CreateRepairTicket from './pages/CreateRepairTicket.jsx'
import WarrantyRepairTickets from './pages/WarrantyRepairTickets.jsx'
import WarrantyTicketDetail from './pages/WarrantyTicketDetail.jsx'
import CreateWarrantyRepairTicket from './pages/CreateWarrantyRepairTicket.jsx'
import Warranty from './pages/Warranty.jsx'
import NonWarranty from './pages/NonWarranty.jsx'
import CreateCustomer from './pages/CreateCustomer.jsx'
import CreateInventoryItem from './pages/CreateInventoryItem.jsx'
import CreateMachine from './pages/CreateMachine.jsx'
import EditMachine from './pages/EditMachine.jsx'
import CreateUser from './pages/CreateUser.jsx'

import Customers from './pages/Customers.jsx'
import CustomerDetail from './pages/CustomerDetail.jsx'
import Inventory from './pages/Inventory.jsx'
import InventoryDetail from './pages/InventoryDetail.jsx'
import Users from './pages/Users.jsx'
import Search from './pages/Search.jsx'
import Notifications from './pages/Notifications.jsx'

import Machines from './pages/Machines.jsx'
import MachineDetail from './pages/MachineDetail.jsx'
import MachineModelDetail from './pages/MachineModelDetail.jsx'
import AssignMachine from './pages/AssignMachine.jsx'
import Login from './pages/Login.jsx'
import TranslationTest from './components/TranslationTest.jsx'

// Create ticket router component
const CreateTicketRouter = () => {
  const [searchParams] = useSearchParams();
  const ticketType = searchParams.get('type');
  
  if (ticketType === 'warranty') {
    return <CreateWarrantyRepairTicket />;
  } else {
    return <CreateRepairTicket />;
  }
};



import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { WebSocketProvider } from './contexts/WebSocketContext.jsx'

const queryClient = new QueryClient({
  defaultOptions: { 
    queries: { 
      retry: 2, 
      refetchOnWindowFocus: false, 
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
      refetchOnMount: false,
      refetchOnReconnect: true,
      networkMode: 'online'
    },
    mutations: {
      retry: 1,
      networkMode: 'online'
    }
  }
})



export default function App() {
  const [mode, setMode] = React.useState(() => {
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  })

  const theme = React.useMemo(() => createAppTheme(mode), [mode])

  const toggleColorMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light'
    setMode(newMode)
    localStorage.setItem('theme', newMode)
  }

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <ModalProvider>
              <Toaster 
                position="top-right" 
                toastOptions={{
                  style: {
                    background: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                  },
                }}
              />
              <WebSocketProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout onThemeToggle={toggleColorMode} mode={mode} />}>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/warranty" element={<Warranty />} />
                      <Route path="/non-warranty" element={<NonWarranty />} />
                      <Route path="/repair-tickets/:id" element={<RepairTicketDetail />} />
                      <Route path="/create-repair-ticket" element={<CreateRepairTicket />} />
                      <Route path="/warranty-repair-tickets/:id" element={<WarrantyTicketDetail />} />
                      <Route path="/create-warranty-repair-ticket" element={<CreateWarrantyRepairTicket />} />
                      <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
                      <Route path="/warranty-work-orders/:id" element={<WarrantyWorkOrderDetail />} />
                      <Route path="/machines" element={<Machines />} />
                      <Route path="/machines/model/:modelId" element={<MachineModelDetail />} />
                      <Route path="/assign-machine/:modelId" element={<AssignMachine />} />
                      <Route path="/machines/detail/:id" element={<MachineDetail />} />
                      <Route path="/create-machine" element={<CreateMachine />} />
                      <Route path="/edit-machine/:modelId" element={<EditMachine />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/customers/:id" element={<CustomerDetail />} />
                      <Route path="/create-customer" element={<CreateCustomer />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/inventory/:id" element={<InventoryDetail />} />
                      <Route path="/create-inventory-item" element={<CreateInventoryItem />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/create-user" element={<CreateUser />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/create-ticket" element={<CreateTicketRouter />} />
                      <Route path="/translation-test" element={<TranslationTest />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </WebSocketProvider>
            </ModalProvider>
          </AuthProvider>
        </LanguageProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
    </ErrorBoundary>
  )
}


