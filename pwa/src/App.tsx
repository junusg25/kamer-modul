import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { MobileLayout } from './components/layout/MobileLayout'
import { AuthProvider } from './contexts/AuthContext'

// Pages
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { CustomersPage } from './pages/CustomersPage'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { MachinesPage } from './pages/MachinesPage'
import { MachineDetailPage } from './pages/MachineDetailPage'
import { RepairTicketsPage } from './pages/RepairTicketsPage'
import { RepairTicketDetailPage } from './pages/RepairTicketDetailPage'
import { CreateRepairTicketPage } from './pages/CreateRepairTicketPage'
import { WarrantyRepairTicketsPage } from './pages/WarrantyRepairTicketsPage'
import { WarrantyRepairTicketDetailPage } from './pages/WarrantyRepairTicketDetailPage'
import { CreateWarrantyRepairTicketPage } from './pages/CreateWarrantyRepairTicketPage'
import { WorkOrdersPage } from './pages/WorkOrdersPage'
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage'
import { WarrantyWorkOrdersPage } from './pages/WarrantyWorkOrdersPage'
import { WarrantyWorkOrderDetailPage } from './pages/WarrantyWorkOrderDetailPage'
import { CreateCustomerPage } from './pages/CreateCustomerPage'
import { CreateMachinePage } from './pages/CreateMachinePage'

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">
          {/* Offline Indicator */}
          {!isOnline && (
            <div className="bg-yellow-500 text-white text-center py-2 px-4 text-sm">
              📱 You're offline - some features may be limited
            </div>
          )}
          
          <MobileLayout>
            <Routes>
              {/* Authentication */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Home */}
              <Route path="/" element={<HomePage />} />
              
              {/* Customers */}
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/customers/new" element={<CreateCustomerPage />} />
              
              {/* Machines */}
              <Route path="/machines" element={<MachinesPage />} />
              <Route path="/machines/:id" element={<MachineDetailPage />} />
              <Route path="/machines/new" element={<CreateMachinePage />} />
              
              {/* Repair Tickets */}
              <Route path="/repair-tickets" element={<RepairTicketsPage />} />
              <Route path="/repair-tickets/:id" element={<RepairTicketDetailPage />} />
              <Route path="/repair-tickets/new" element={<CreateRepairTicketPage />} />
              
              {/* Warranty Repair Tickets */}
              <Route path="/warranty-repair-tickets" element={<WarrantyRepairTicketsPage />} />
              <Route path="/warranty-repair-tickets/:id" element={<WarrantyRepairTicketDetailPage />} />
              <Route path="/warranty-repair-tickets/new" element={<CreateWarrantyRepairTicketPage />} />
              
              {/* Work Orders */}
              <Route path="/work-orders" element={<WorkOrdersPage />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
              
              {/* Warranty Work Orders */}
              <Route path="/warranty-work-orders" element={<WarrantyWorkOrdersPage />} />
              <Route path="/warranty-work-orders/:id" element={<WarrantyWorkOrderDetailPage />} />
            </Routes>
          </MobileLayout>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App