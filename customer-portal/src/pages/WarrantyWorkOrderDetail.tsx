import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { formatDate, formatDateTime, getStatusColor, getStatusLabel } from '../lib/utils';
import { MainLayout } from '../components/layout/main-layout';
import { ArrowLeft, Shield, Calendar, User, Clock, Package, FileText, AlertCircle } from 'lucide-react';

interface WarrantyWorkOrderDetail {
  id: number;
  formatted_number: string;
  ticket_number?: string;
  description?: string;
  status: string;
  priority: string;
  labor_hours?: number;
  labor_rate?: number;
  troubleshooting_fee?: number;
  quote_subtotal_parts?: number;
  quote_total?: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  company_name?: string;
  technician_name?: string;
}

interface InventoryItem {
  id: number;
  item_name: string;
  description?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
}

interface Note {
  id: number;
  note_text: string;
  created_at: string;
  created_by_name?: string;
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

export default function WarrantyWorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState<WarrantyWorkOrderDetail | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchWorkOrderDetail();
  }, [id]);

  const fetchWorkOrderDetail = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await apiService.getItemDetail('warranty_work_order', id!);
      
      if (result.data.type !== 'warranty_work_order') {
        setError('Invalid item type');
        return;
      }

      setWorkOrder(result.data.item);
      setInventory(result.data.inventory || []);
      setNotes(result.data.notes || []);
      setMachine(result.data.machine || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load warranty work order details');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#ff8800', borderTopColor: 'transparent' }}></div>
          <p className="text-muted-foreground">Loading warranty work order details...</p>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border p-8 rounded-lg shadow-md text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <p className="text-foreground mb-4">{error || 'Warranty work order not found'}</p>
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
              <Shield className="w-8 h-8" style={{ color: '#ff8800' }} />
              <div>
                <h1 className="text-3xl font-bold text-foreground">{workOrder.formatted_number}</h1>
                <p className="text-sm text-muted-foreground">Warranty Work Order</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(workOrder.status)}`}>
              {getStatusLabel(workOrder.status)}
            </span>
          </div>
        </div>

        {/* Warranty Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            🛡️ This is a warranty repair - covered under your machine's warranty. No charges will apply.
          </p>
        </div>

        {/* Main Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Work Order Info Card */}
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <FileText className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Work Order Information</span>
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-foreground">{workOrder.description || 'N/A'}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Priority</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  workOrder.priority === 'high' ? 'bg-red-100 text-red-800' :
                  workOrder.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {workOrder.priority?.toUpperCase()}
                </span>
              </div>

              {workOrder.technician_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>Assigned Technician</span>
                  </p>
                  <p className="text-foreground font-medium">{workOrder.technician_name}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Created</span>
                </p>
                <p className="text-foreground">{formatDate(workOrder.created_at)}</p>
              </div>

              {workOrder.started_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Started</p>
                  <p className="text-foreground">{formatDate(workOrder.started_at)}</p>
                </div>
              )}

              {workOrder.completed_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Completed</p>
                  <p className="text-foreground">{formatDate(workOrder.completed_at)}</p>
                </div>
              )}

              {workOrder.labor_hours && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>Labor Hours</span>
                  </p>
                  <p className="text-foreground font-medium">{workOrder.labor_hours} hours</p>
                </div>
              )}

              {workOrder.ticket_number && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Original Ticket</p>
                  <p className="text-primary-link font-medium">{workOrder.ticket_number}</p>
                </div>
              )}
            </div>
          </div>

          {/* Machine Info */}
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
                    machine.warranty_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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

        {/* Parts & Materials */}
        {inventory.length > 0 && (
          <div className="bg-card border border-border rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <Package className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Parts & Materials Used</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">SKU</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item, index) => (
                    <tr key={item.id} className={index !== inventory.length - 1 ? 'border-b border-border' : ''}>
                      <td className="py-3 px-4">
                        <p className="text-foreground font-medium">{item.item_name}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">{item.sku || '-'}</td>
                      <td className="py-3 px-4 text-center text-foreground">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                💡 All parts and labor are covered under warranty - no charges apply
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <div className="bg-card border border-border rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <FileText className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Service Notes</span>
            </h2>

            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="border-l-4 pl-4 py-2" style={{ borderColor: '#ff8800' }}>
                  <p className="text-foreground mb-2">{note.note_text}</p>
                  <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                    {note.created_by_name && (
                      <span>By: {note.created_by_name}</span>
                    )}
                    <span>•</span>
                    <span>{formatDateTime(note.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-card border border-border rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Service Timeline</h2>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: '#ff8800' }}></div>
              <div className="flex-1">
                <p className="text-foreground font-medium">Warranty Work Order Created</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(workOrder.created_at)}</p>
              </div>
            </div>

            {workOrder.started_at && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: '#ff8800' }}></div>
                <div className="flex-1">
                  <p className="text-foreground font-medium">Work Started</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(workOrder.started_at)}</p>
                </div>
              </div>
            )}

            {workOrder.completed_at && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full mt-2 bg-green-500"></div>
                <div className="flex-1">
                  <p className="text-foreground font-medium">Work Completed</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(workOrder.completed_at)}</p>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full mt-2 bg-gray-400"></div>
              <div className="flex-1">
                <p className="text-foreground font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(workOrder.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
