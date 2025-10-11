import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/theme-context';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TrackingResult from './pages/TrackingResult';
import WorkOrderDetail from './pages/WorkOrderDetail';
import RepairTicketDetail from './pages/RepairTicketDetail';
import QuoteDetail from './pages/QuoteDetail';
import WarrantyTicketDetail from './pages/WarrantyTicketDetail';
import WarrantyWorkOrderDetail from './pages/WarrantyWorkOrderDetail';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';

function App() {
  return (
    <ThemeProvider>
      <Router basename="/portal">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/track-result" element={<TrackingResult />} />
          <Route path="/machines" element={<Machines />} />
          <Route path="/machines/:id" element={<MachineDetail />} />
          <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
          <Route path="/warranty-work-orders/:id" element={<WarrantyWorkOrderDetail />} />
          <Route path="/repair-tickets/:id" element={<RepairTicketDetail />} />
          <Route path="/warranty-tickets/:id" element={<WarrantyTicketDetail />} />
          <Route path="/quotes/:id" element={<QuoteDetail />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
