import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { formatDate, formatDateTime, formatCurrency, getStatusColor, getStatusLabel } from '../lib/utils';
import { MainLayout } from '../components/layout/main-layout';
import { ThemeToggle } from '../components/theme-toggle';
import { ArrowLeft, Package, Wrench, Shield, Calendar, DollarSign, FileText, AlertCircle, TrendingUp } from 'lucide-react';

interface MachineDetail {
  id: number;
  serial_number: string;
  model_name: string;
  manufacturer: string;
  catalogue_number?: string;
  model_description?: string;
  category_name?: string;
  purchase_date?: string;
  sale_date?: string;
  sale_price?: number;
  warranty_expiry_date?: string;
  warranty_active: boolean;
  warranty_months?: number;
  machine_condition?: string;
  receipt_number?: string;
  customer_name: string;
  sold_by_name?: string;
  added_by_name?: string;
}

interface WorkOrder {
  id: number;
  formatted_number: string;
  description?: string;
  status: string;
  priority: string;
  total_cost?: number;
  labor_hours?: number;
  labor_rate?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  technician_name?: string;
}

interface WarrantyWorkOrder {
  id: number;
  formatted_number: string;
  description?: string;
  status: string;
  priority: string;
  labor_hours?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  technician_name?: string;
}

interface Stats {
  total_work_orders: number;
  total_warranty_work_orders: number;
  total_maintenance_cost: number;
  total_cost: number;
}

export default function MachineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [warrantyWorkOrders, setWarrantyWorkOrders] = useState<WarrantyWorkOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchMachineDetail();
  }, [id]);

  const fetchMachineDetail = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await apiService.getMachineDetail(id!);
      setMachine(result.data.machine);
      setWorkOrders(result.data.work_orders || []);
      setWarrantyWorkOrders(result.data.warranty_work_orders || []);
      setStats(result.data.stats);
    } catch (err: any) {
      setError(err.message || 'Failed to load machine details');
    } finally {
      setIsLoading(false);
    }
  };

  const getConditionBadge = (condition?: string) => {
    if (!condition) return null;
    
    const colors: Record<string, string> = {
      'new': 'bg-green-100 text-green-800',
      'used': 'bg-blue-100 text-blue-800',
      'refurbished': 'bg-purple-100 text-purple-800',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[condition] || 'bg-gray-100 text-gray-800'}`}>
        {condition.charAt(0).toUpperCase() + condition.slice(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#ff8800', borderTopColor: 'transparent' }}></div>
          <p className="text-muted-foreground">Loading machine details...</p>
        </div>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border p-8 rounded-lg shadow-md text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <p className="text-foreground mb-4">{error || 'Machine not found'}</p>
          <button
            onClick={() => navigate('/machines')}
            className="px-6 py-2 rounded-lg btn-primary"
          >
            Back to Machines
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
            onClick={() => navigate('/machines')}
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Machines</span>
          </button>
        </div>
        {/* Machine Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="w-8 h-8" style={{ color: '#ff8800' }} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{machine.model_name}</h1>
                <p className="text-sm text-muted-foreground">{machine.manufacturer}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {machine.machine_condition && getConditionBadge(machine.machine_condition)}
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                machine.warranty_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {machine.warranty_active ? '✓ Under Warranty' : 'Warranty Expired'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Purchase Price</p>
            <p className="text-2xl font-bold" style={{ color: '#ff8800' }}>
              {machine.sale_price ? formatCurrency(machine.sale_price) : 'N/A'}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Wrench className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Maintenance Cost</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats?.total_maintenance_cost || 0)}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Cost</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats?.total_cost || 0)}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Services</p>
            <p className="text-2xl font-bold text-foreground">
              {(stats?.total_work_orders || 0) + (stats?.total_warranty_work_orders || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.total_work_orders || 0} paid, {stats?.total_warranty_work_orders || 0} warranty
            </p>
          </div>
        </div>

        {/* Machine Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Machine Details Card */}
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <Package className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Machine Information</span>
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
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
              </div>

              {machine.category_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Category</p>
                  <p className="text-foreground">{machine.category_name}</p>
                </div>
              )}

              {machine.model_description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground text-sm">{machine.model_description}</p>
                </div>
              )}

              {machine.receipt_number && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Receipt Number</p>
                  <p className="text-foreground">{machine.receipt_number}</p>
                </div>
              )}
            </div>
          </div>

          {/* Purchase & Warranty Info Card */}
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <Calendar className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Purchase & Warranty</span>
            </h2>

            <div className="space-y-3">
              {machine.purchase_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Purchase Date</p>
                  <p className="text-foreground">{formatDate(machine.purchase_date)}</p>
                </div>
              )}

              {machine.sale_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Sale Date</p>
                  <p className="text-foreground">{formatDate(machine.sale_date)}</p>
                </div>
              )}

              {machine.sale_price && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Purchase Price</p>
                  <p className="text-lg font-bold" style={{ color: '#ff8800' }}>
                    {formatCurrency(machine.sale_price)}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Warranty Status</p>
                <div className="flex items-center space-x-2 mb-2">
                  <Shield className={`w-5 h-5 ${machine.warranty_active ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${machine.warranty_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {machine.warranty_active ? 'Active' : 'Expired'}
                  </span>
                </div>
                {machine.warranty_expiry_date && (
                  <p className="text-sm text-muted-foreground">
                    {machine.warranty_active ? 'Valid until' : 'Expired on'}: {formatDate(machine.warranty_expiry_date)}
                  </p>
                )}
                {machine.warranty_months && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {machine.warranty_months} months warranty period
                  </p>
                )}
              </div>

              {machine.sold_by_name && (
                <div className="pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">Sold By</p>
                  <p className="text-foreground">{machine.sold_by_name}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Service History */}
        <div className="bg-card border border-border rounded-lg shadow mb-8">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <Wrench className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Service History</span>
            </h2>

            {workOrders.length === 0 && warrantyWorkOrders.length === 0 ? (
              <div className="text-center py-8">
                <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No service history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Regular Work Orders */}
                {workOrders.map((wo) => (
                  <div
                    key={`wo-${wo.id}`}
                    className="border border-border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    style={{ transition: 'all 0.2s ease' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#ff8800';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '';
                    }}
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Wrench className="w-4 h-4 text-blue-600" />
                          <h4 className="font-semibold text-foreground">{wo.formatted_number}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                            {getStatusLabel(wo.status)}
                          </span>
                        </div>
                        {wo.description && (
                          <p className="text-sm text-muted-foreground mb-2">{wo.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(wo.created_at)}</span>
                          </div>
                          {wo.technician_name && (
                            <div>
                              <span>Technician: {wo.technician_name}</span>
                            </div>
                          )}
                          {wo.labor_hours && (
                            <div>
                              <span>{wo.labor_hours}h labor</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {wo.total_cost && (
                        <div className="text-right ml-4">
                          <p className="text-xs text-muted-foreground">Total Cost</p>
                          <p className="text-lg font-bold" style={{ color: '#ff8800' }}>
                            {formatCurrency(wo.total_cost)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Warranty Work Orders */}
                {warrantyWorkOrders.map((wwo) => (
                  <div
                    key={`wwo-${wwo.id}`}
                    className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/10 hover:shadow-md transition-all cursor-pointer"
                    style={{ transition: 'all 0.2s ease' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#ff8800';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '';
                    }}
                    onClick={() => navigate(`/warranty-work-orders/${wwo.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Shield className="w-4 h-4 text-green-600" />
                          <h4 className="font-semibold text-foreground">{wwo.formatted_number}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wwo.status)}`}>
                            {getStatusLabel(wwo.status)}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Warranty Service
                          </span>
                        </div>
                        {wwo.description && (
                          <p className="text-sm text-muted-foreground mb-2">{wwo.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(wwo.created_at)}</span>
                          </div>
                          {wwo.technician_name && (
                            <div>
                              <span>Technician: {wwo.technician_name}</span>
                            </div>
                          )}
                          {wwo.labor_hours && (
                            <div>
                              <span>{wwo.labor_hours}h labor</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-medium text-green-600">FREE</p>
                        <p className="text-xs text-muted-foreground">Under Warranty</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
