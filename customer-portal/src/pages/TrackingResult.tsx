import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, getTypeLabel, getTypeIcon } from '../lib/utils';
import { MainLayout } from '../components/layout/main-layout';
import { ThemeToggle } from '../components/theme-toggle';

export default function TrackingResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state;
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    setIsAuthenticated(!!token);
  }, []);

  if (!data) {
    const noDataContent = (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-card border border-border p-8 rounded-lg shadow-md text-center">
          <p className="text-muted-foreground mb-4">No tracking data available</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 rounded-lg btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    );

    if (isAuthenticated) {
      return <MainLayout>{noDataContent}</MainLayout>;
    }

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>←</span>
                <span>Back to Tracking</span>
              </button>
              <div className="flex items-center space-x-3">
                <span className="text-xl font-bold text-foreground">Kamer.ba</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
        {noDataContent}
      </div>
    );
  }

  const { type, item, related } = data;

  const content = (
    <>
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>←</span>
          <span>Back to Tracking</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-semibold text-foreground">Item Found!</h3>
              <p className="text-sm text-muted-foreground">
                We found your {getTypeLabel(type).toLowerCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Main Item Card */}
        <div className="bg-card border border-border rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <span className="text-4xl">{getTypeIcon(type)}</span>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {item.tracking_number || item.formatted_number}
                </h2>
                <p className="text-sm text-muted-foreground">{getTypeLabel(type)}</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
              {getStatusLabel(item.status)}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Customer Information</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Name</dt>
                  <dd className="text-sm font-medium text-foreground">{item.customer_name}</dd>
                </div>
                {item.customer_email && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Email</dt>
                    <dd className="text-sm font-medium text-foreground">{item.customer_email}</dd>
                  </div>
                )}
                {item.customer_phone && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Phone</dt>
                    <dd className="text-sm font-medium text-foreground">{item.customer_phone}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Item Details</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Created</dt>
                  <dd className="text-sm font-medium text-foreground">{formatDate(item.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Last Updated</dt>
                  <dd className="text-sm font-medium text-foreground">{formatDate(item.updated_at)}</dd>
                </div>
                {item.priority && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Priority</dt>
                    <dd className="text-sm font-medium text-foreground capitalize">{item.priority}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Description/Details */}
          {(item.problem_description || item.description || item.title) && (
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="font-semibold text-foreground mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">
                {item.problem_description || item.description || item.title}
              </p>
            </div>
          )}

          {/* Work Order Specific */}
          {(type === 'work_order' || type === 'warranty_work_order') && (
            <>
              {item.description && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="font-semibold text-foreground mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              )}
              {item.technician_name && (
                <div className="mt-4">
                  <h3 className="font-semibold text-foreground mb-2">Assigned Technician</h3>
                  <p className="text-sm text-muted-foreground">{item.technician_name}</p>
                </div>
              )}
              {type === 'work_order' && item.total_cost && (
                <div className="mt-4">
                  <h3 className="font-semibold text-foreground mb-2">Total Cost</h3>
                  <p className="text-lg font-bold" style={{ color: '#ff8800' }}>{formatCurrency(item.total_cost)}</p>
                </div>
              )}
              {item.completed_at && (
                <div className="mt-4">
                  <h3 className="font-semibold text-foreground mb-2">Completion Date</h3>
                  <p className="text-sm text-muted-foreground">{formatDate(item.completed_at)}</p>
                </div>
              )}
            </>
          )}

          {/* Quote Specific */}
          {type === 'quote' && (
            <>
              {item.total_amount && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="font-semibold text-foreground mb-2">Quote Amount</h3>
                  <p className="text-2xl font-bold" style={{ color: '#ff8800' }}>{formatCurrency(item.total_amount)}</p>
                </div>
              )}
              {item.valid_until && (
                <div className="mt-4">
                  <h3 className="font-semibold text-foreground mb-2">Valid Until</h3>
                  <p className="text-sm text-muted-foreground">{formatDate(item.valid_until)}</p>
                </div>
              )}
              {item.created_by_name && (
                <div className="mt-4">
                  <h3 className="font-semibold text-foreground mb-2">Created By</h3>
                  <p className="text-sm text-muted-foreground">{item.created_by_name}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Related Item */}
        {related && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center space-x-2">
              <span>🔗</span>
              <span>Related {getTypeLabel(related.type)}</span>
            </h3>
            <div 
              className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
              style={{ transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ff8800';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
              }}
              onClick={() => {
                // Reload page with the related tracking number
                const newTrackingNumber = related.tracking_number || related.formatted_number;
                navigate('/', { state: { autoTrack: newTrackingNumber } });
              }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-foreground">{related.tracking_number || related.formatted_number}</p>
                  <p className="text-sm text-muted-foreground">{getTypeLabel(related.type)}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(related.status)}`}>
                    {getStatusLabel(related.status)}
                  </span>
                  <span className="text-sm" style={{ color: '#ff8800' }}>→</span>
                </div>
              </div>
              
              {/* Related Item Details */}
              <div className="grid md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                {related.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm text-foreground">{related.description}</p>
                  </div>
                )}
                {related.problem_description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Problem Description</p>
                    <p className="text-sm text-foreground">{related.problem_description}</p>
                  </div>
                )}
                {related.technician_name && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Technician</p>
                    <p className="text-sm text-foreground">{related.technician_name}</p>
                  </div>
                )}
                {related.total_cost && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Cost</p>
                    <p className="text-sm font-bold" style={{ color: '#ff8800' }}>{formatCurrency(related.total_cost)}</p>
                  </div>
                )}
                {related.labor_hours && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Labor Hours</p>
                    <p className="text-sm text-foreground">{related.labor_hours} hours</p>
                  </div>
                )}
                {related.completed_at && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Completed</p>
                    <p className="text-sm text-foreground">{formatDate(related.completed_at)}</p>
                  </div>
                )}
              </div>
              
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <p className="text-xs text-primary-link">
                  💡 Click to view full details
                </p>
                <p className="text-xs text-muted-foreground">
                  You can track using either number
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-8 text-center">
          <div className="rounded-lg p-8 text-white" style={{ background: 'linear-gradient(to right, #ff8800, #e67700)' }}>
            <h3 className="text-2xl font-bold mb-3">Want More Features?</h3>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto">
              Register for a free account to view all your items in one place, get real-time notifications, and manage your repairs easily.
            </p>
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-3 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Create Free Account
            </button>
          </div>
        </div>
      </main>
    </>
  );

  // If user is authenticated, show with MainLayout
  if (isAuthenticated) {
    return <MainLayout>{content}</MainLayout>;
  }

  // If not authenticated, show standalone page
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>←</span>
              <span>Back to Tracking</span>
            </button>
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold text-foreground">Kamer.ba</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      {content}
    </div>
  );
}

