import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { formatDate, formatDateTime, getStatusColor, getStatusLabel } from '../lib/utils';
import { MainLayout } from '../components/layout/main-layout';
import { ArrowLeft, Ticket, Calendar, User, Package, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface RepairTicketDetail {
  id: number;
  formatted_number: string;
  ticket_number?: string;
  problem_description: string;
  notes?: string;
  additional_equipment?: string;
  brought_by?: string;
  status: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  company_name?: string;
  submitted_by_name?: string;
  converted_to_work_order_id?: number;
  converted_work_order_formatted_number?: string;
  converted_at?: string;
}

interface Machine {
  id: number;
  serial_number: string;
  model_name: string;
  manufacturer: string;
  catalogue_number?: string;
  warranty_expiry_date?: string;
  warranty_active: boolean;
}

export default function RepairTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<RepairTicketDetail | null>(null);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchTicketDetail();
  }, [id]);

  const fetchTicketDetail = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await apiService.getItemDetail('repair_ticket', id!);
      
      if (result.data.type !== 'repair_ticket') {
        setError('Invalid item type');
        return;
      }

      setTicket(result.data.item);
      setMachine(result.data.machine || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load repair ticket details');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#ff8800', borderTopColor: 'transparent' }}></div>
          <p className="text-muted-foreground">Loading repair ticket details...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border p-8 rounded-lg shadow-md text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <p className="text-foreground mb-4">{error || 'Repair ticket not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 rounded-lg btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <Ticket className="w-8 h-8" style={{ color: '#ff8800' }} />
              <div>
                <h1 className="text-3xl font-bold text-foreground">{ticket.formatted_number}</h1>
                <p className="text-sm text-muted-foreground">Repair Ticket</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(ticket.status)}`}>
              {getStatusLabel(ticket.status)}
            </span>
          </div>
        </div>

        {/* Conversion Notice */}
        {ticket.converted_to_work_order_id && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-foreground">Converted to Work Order</h3>
                <p className="text-sm text-muted-foreground">
                  This ticket has been converted to work order{' '}
                  <button
                    onClick={() => navigate(`/work-orders/${ticket.converted_to_work_order_id}`)}
                    className="text-primary-link font-medium hover:underline"
                  >
                    {ticket.converted_work_order_formatted_number}
                  </button>
                  {ticket.converted_at && ` on ${formatDate(ticket.converted_at)}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Ticket Info Card */}
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <FileText className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Ticket Information</span>
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Problem Description</p>
                <p className="text-foreground">{ticket.problem_description}</p>
              </div>

              {ticket.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Additional Notes</p>
                  <p className="text-foreground">{ticket.notes}</p>
                </div>
              )}

              {ticket.additional_equipment && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Additional Equipment</p>
                  <p className="text-foreground">{ticket.additional_equipment}</p>
                </div>
              )}

              {ticket.brought_by && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Brought By</p>
                  <p className="text-foreground">{ticket.brought_by}</p>
                </div>
              )}

              {ticket.priority && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Priority</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    ticket.priority === 'high' ? 'bg-red-100 text-red-800' :
                    ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {ticket.priority.toUpperCase()}
                  </span>
                </div>
              )}

              {ticket.submitted_by_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>Submitted By</span>
                  </p>
                  <p className="text-foreground font-medium">{ticket.submitted_by_name}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Submitted On</span>
                </p>
                <p className="text-foreground">{formatDate(ticket.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Machine Info Card */}
          {machine && (
            <div className="bg-card border border-border rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
                <Package className="w-5 h-5" style={{ color: '#ff8800' }} />
                <span>Machine Information</span>
              </h2>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Model</p>
                  <p className="text-foreground font-medium">{machine.model_name}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Manufacturer</p>
                  <p className="text-foreground">{machine.manufacturer}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Serial Number</p>
                  <p className="text-foreground font-mono">{machine.serial_number}</p>
                </div>

                {machine.catalogue_number && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Catalogue Number</p>
                    <p className="text-foreground">{machine.catalogue_number}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Warranty Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    machine.warranty_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {machine.warranty_active ? 'Active' : 'Expired'}
                  </span>
                </div>

                {machine.warranty_expiry_date && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Warranty Expires</p>
                    <p className="text-foreground">{formatDate(machine.warranty_expiry_date)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-card border border-border rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Ticket Timeline</h2>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: '#ff8800' }}></div>
              <div className="flex-1">
                <p className="text-foreground font-medium">Ticket Submitted</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(ticket.created_at)}</p>
                {ticket.submitted_by_name && (
                  <p className="text-xs text-muted-foreground mt-1">By: {ticket.submitted_by_name}</p>
                )}
              </div>
            </div>

            {ticket.converted_to_work_order_id && ticket.converted_at && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full mt-2 bg-green-500"></div>
                <div className="flex-1">
                  <p className="text-foreground font-medium">Converted to Work Order</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(ticket.converted_at)}</p>
                  <button
                    onClick={() => navigate(`/work-orders/${ticket.converted_to_work_order_id}`)}
                    className="text-xs text-primary-link mt-1 hover:underline"
                  >
                    View Work Order {ticket.converted_work_order_formatted_number} →
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full mt-2 bg-gray-400"></div>
              <div className="flex-1">
                <p className="text-foreground font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(ticket.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

