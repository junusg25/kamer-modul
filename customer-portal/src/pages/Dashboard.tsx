import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, getTypeLabel, getTypeIcon } from '../lib/utils';
import { MainLayout } from '../components/layout/main-layout';

interface DashboardData {
  repair_tickets: any[];
  warranty_tickets: any[];
  work_orders: any[];
  warranty_work_orders: any[];
  quotes: any[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'tickets' | 'orders' | 'quotes'>('all');
  const currentUser = apiService.getCurrentUser();

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await apiService.getMyItems();
      setData(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    navigate('/');
  };

  const getAllItems = () => {
    if (!data) return [];
    
    return [
      ...data.repair_tickets,
      ...data.warranty_tickets,
      ...data.work_orders,
      ...data.warranty_work_orders,
      ...data.quotes,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const getFilteredItems = () => {
    if (!data) return [];

    switch (activeTab) {
      case 'tickets':
        return [...data.repair_tickets, ...data.warranty_tickets];
      case 'orders':
        return [...data.work_orders, ...data.warranty_work_orders];
      case 'quotes':
        return data.quotes;
      default:
        return getAllItems();
    }
  };

  const getStats = () => {
    if (!data) return { total: 0, active: 0, completed: 0, pending: 0 };

    const allItems = getAllItems();
    return {
      total: allItems.length,
      active: allItems.filter(item => 
        ['in_progress', 'sent', 'viewed'].includes(item.status)
      ).length,
      completed: allItems.filter(item => 
        ['completed', 'accepted'].includes(item.status)
      ).length,
      pending: allItems.filter(item => 
        ['intake', 'pending', 'draft'].includes(item.status)
      ).length,
    };
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="bg-card border border-border p-8 rounded-lg shadow-md text-center max-w-md">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-foreground mb-4">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="px-6 py-2 rounded-lg btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const stats = getStats();
  const filteredItems = getFilteredItems();

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {currentUser?.customer_name}!
          </h2>
          <p className="text-muted-foreground">Here's an overview of all your items and services</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-3xl font-bold" style={{ color: '#ff8800' }}>{stats.active}</p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 136, 0, 0.1)' }}>
                <span className="text-2xl">⚡</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-card border border-border rounded-lg shadow">
          <div className="border-b border-border">
            <div className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'all'
                    ? 'text-primary-link'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
                style={activeTab === 'all' ? { borderColor: '#ff8800' } : {}}
              >
                All Items ({getAllItems().length})
              </button>
              <button
                onClick={() => setActiveTab('tickets')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'tickets'
                    ? 'text-primary-link'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
                style={activeTab === 'tickets' ? { borderColor: '#ff8800' } : {}}
              >
                Tickets ({(data?.repair_tickets.length || 0) + (data?.warranty_tickets.length || 0)})
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'orders'
                    ? 'text-primary-link'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
                style={activeTab === 'orders' ? { borderColor: '#ff8800' } : {}}
              >
                Work Orders ({(data?.work_orders.length || 0) + (data?.warranty_work_orders.length || 0)})
              </button>
              <button
                onClick={() => setActiveTab('quotes')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'quotes'
                    ? 'text-primary-link'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
                style={activeTab === 'quotes' ? { borderColor: '#ff8800' } : {}}
              >
                Quotes ({data?.quotes.length || 0})
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="p-6">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-muted-foreground">No items found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="border border-border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    style={{ 
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#ff8800';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '';
                    }}
                    onClick={() => {
                      // Route to appropriate detail page based on type using ID
                      if (item.type === 'work_order') {
                        navigate(`/work-orders/${item.id}`);
                      } else if (item.type === 'warranty_work_order') {
                        navigate(`/warranty-work-orders/${item.id}`);
                      } else if (item.type === 'repair_ticket') {
                        navigate(`/repair-tickets/${item.id}`);
                      } else if (item.type === 'warranty_ticket') {
                        navigate(`/warranty-tickets/${item.id}`);
                      } else if (item.type === 'quote') {
                        navigate(`/quotes/${item.id}`);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <span className="text-3xl">{getTypeIcon(item.type)}</span>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-foreground">
                              {item.formatted_number}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                              {getStatusLabel(item.status)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{getTypeLabel(item.type)}</p>
                          {(item.problem_description || item.title) && (
                            <p className="text-sm text-foreground line-clamp-2">
                              {item.problem_description || item.title}
                            </p>
                          )}
                          {item.technician_name && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Technician: {item.technician_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm font-medium text-foreground">{formatDate(item.created_at)}</p>
                        {item.total_cost && item.type === 'work_order' && (
                          <p className="text-lg font-bold mt-2" style={{ color: '#ff8800' }}>
                            {formatCurrency(item.total_cost)}
                          </p>
                        )}
                        {item.total_amount && item.type === 'quote' && (
                          <p className="text-lg font-bold mt-2" style={{ color: '#ff8800' }}>
                            {formatCurrency(item.total_amount)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Conversion Info */}
                    {item.converted_to_work_order_id && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-primary-link">
                          ✓ Converted to Work Order
                        </p>
                      </div>
                    )}
                    {item.converted_to_warranty_work_order_id && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-primary-link">
                          ✓ Converted to Warranty Work Order
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 rounded-lg p-6 text-white" style={{ background: 'linear-gradient(to right, #ff8800, #e67700)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1">Need Help?</h3>
              <p className="text-white/90">Contact our support team for assistance</p>
            </div>
            <a
              href="tel:+38733123456"
              className="px-6 py-3 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Call Us
            </a>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

