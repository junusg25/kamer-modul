import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { formatDate, formatCurrency, getStatusColor, getStatusLabel } from '../lib/utils';
import { MainLayout } from '../components/layout/main-layout';
import { ThemeToggle } from '../components/theme-toggle';
import { Package, Wrench, Shield, Calendar, AlertCircle } from 'lucide-react';

interface Machine {
  id: number;
  serial_number: string;
  model_name: string;
  manufacturer: string;
  catalogue_number?: string;
  category_name?: string;
  purchase_date?: string;
  warranty_expiry_date?: string;
  warranty_active: boolean;
  sale_price?: number;
  machine_condition?: string;
  work_order_count: number;
  warranty_work_order_count: number;
  latest_work_order?: string;
  latest_work_order_status?: string;
}

export default function Machines() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = apiService.getCurrentUser();

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await apiService.getMyMachines();
      setMachines(result.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load machines');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    navigate('/login');
  };

  const getConditionBadge = (condition?: string) => {
    if (!condition) return null;
    
    const colors: Record<string, string> = {
      'new': 'bg-green-100 text-green-800',
      'used': 'bg-blue-100 text-blue-800',
      'refurbished': 'bg-purple-100 text-purple-800',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[condition] || 'bg-gray-100 text-gray-800'}`}>
        {condition.charAt(0).toUpperCase() + condition.slice(1)}
      </span>
    );
  };

  const getWarrantyBadge = (warrantyActive: boolean, warrantyExpiry?: string) => {
    if (warrantyActive) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          ✓ Under Warranty
        </span>
      );
    }

    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
        Warranty Expired
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your machines...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border p-8 rounded-lg shadow-md text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-foreground mb-4">{error}</p>
          <button
            onClick={fetchMachines}
            className="px-6 py-2 rounded-lg btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center space-x-3">
                <Package className="w-8 h-8" style={{ color: '#ff8800' }} />
                <span>My Machines</span>
              </h2>
              <p className="text-muted-foreground">View and manage your machines and their service history</p>
            </div>
            <button
              onClick={fetchMachines}
              className="px-4 py-2 text-sm font-medium rounded-lg btn-primary"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Machines</p>
                <p className="text-3xl font-bold text-foreground">{machines.length}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6" style={{ color: '#ff8800' }} />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Under Warranty</p>
                <p className="text-3xl font-bold text-green-600">
                  {machines.filter(m => m.warranty_active).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Services</p>
                <p className="text-3xl font-bold" style={{ color: '#ff8800' }}>
                  {machines.reduce((sum, m) => sum + m.work_order_count + m.warranty_work_order_count, 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 136, 0, 0.1)' }}>
                <Wrench className="h-6 w-6" style={{ color: '#ff8800' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Machines List */}
        {machines.length === 0 ? (
          <div className="bg-card border border-border rounded-lg shadow p-12 text-center">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Machines Found</h3>
            <p className="text-muted-foreground">
              You don't have any machines registered yet.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Your Machines</h3>
              <div className="space-y-4">
                {machines.map((machine) => (
                  <div
                    key={machine.id}
                    className="border border-border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    style={{ transition: 'all 0.2s ease' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#ff8800';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '';
                    }}
                    onClick={() => navigate(`/machines/${machine.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="h-6 w-6" style={{ color: '#ff8800' }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-semibold text-foreground text-lg">
                              {machine.model_name}
                            </h4>
                            {machine.machine_condition && getConditionBadge(machine.machine_condition)}
                            {getWarrantyBadge(machine.warranty_active, machine.warranty_expiry_date)}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Manufacturer:</span>{' '}
                              <span className="text-foreground font-medium">{machine.manufacturer}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Serial Number:</span>{' '}
                              <span className="text-foreground font-mono">{machine.serial_number}</span>
                            </div>
                            {machine.category_name && (
                              <div>
                                <span className="text-muted-foreground">Category:</span>{' '}
                                <span className="text-foreground">{machine.category_name}</span>
                              </div>
                            )}
                            {machine.purchase_date && (
                              <div>
                                <span className="text-muted-foreground">Purchased:</span>{' '}
                                <span className="text-foreground">{formatDate(machine.purchase_date)}</span>
                              </div>
                            )}
                          </div>

                          {/* Service Summary */}
                          <div className="mt-3 pt-3 border-t border-border flex items-center space-x-4 text-xs">
                            <div className="flex items-center space-x-1">
                              <Wrench className="w-4 h-4 text-blue-600" />
                              <span className="text-muted-foreground">
                                {machine.work_order_count} Service{machine.work_order_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Shield className="w-4 h-4 text-green-600" />
                              <span className="text-muted-foreground">
                                {machine.warranty_work_order_count} Warranty Service{machine.warranty_work_order_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {machine.latest_work_order && (
                              <div className="flex items-center space-x-1">
                                <span className="text-muted-foreground">Latest:</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(machine.latest_work_order_status || '')}`}>
                                  {getStatusLabel(machine.latest_work_order_status || '')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Price/Warranty */}
                      <div className="text-right ml-4">
                        {machine.sale_price && (
                          <div className="mb-2">
                            <p className="text-xs text-muted-foreground">Purchase Price</p>
                            <p className="text-lg font-bold" style={{ color: '#ff8800' }}>
                              {formatCurrency(machine.sale_price)}
                            </p>
                          </div>
                        )}
                        {machine.warranty_expiry_date && (
                          <div>
                            <p className="text-xs text-muted-foreground">Warranty Until</p>
                            <p className="text-sm font-medium text-foreground">
                              {formatDate(machine.warranty_expiry_date)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        {machines.length > 0 && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Service History & Costs
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Click on any machine to view its complete service history, maintenance costs, and detailed information.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

