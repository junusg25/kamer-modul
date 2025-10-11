import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { MainLayout } from '../components/layout/main-layout';
import { ThemeToggle } from '../components/theme-toggle';

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    setIsAuthenticated(!!token);
  }, []);

  // Check if we should auto-track (when clicking on related item)
  useEffect(() => {
    const state = location.state as any;
    if (state?.autoTrack) {
      setTrackingNumber(state.autoTrack);
      // Get email from previous tracking or prompt user
      const lastEmail = sessionStorage.getItem('last_tracking_email');
      if (lastEmail) {
        setEmail(lastEmail);
        // Auto-submit if we have both tracking number and email
        setTimeout(() => {
          document.getElementById('track-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }, 100);
      }
    }
  }, [location.state]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      
      // Store email in session for auto-tracking related items
      sessionStorage.setItem('last_tracking_email', trimmedEmail);
      
      const result = await apiService.trackItem({
        tracking_number: trackingNumber.trim().toUpperCase(),
        email: trimmedEmail,
      });

      // Navigate to tracking results page with data
      navigate('/track-result', { state: result.data });
    } catch (err: any) {
      setError(err.message || 'Failed to track item. Please check your tracking number and email.');
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <>
      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Track Your Repair Status
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Enter your tracking number and email to check the status of your repair, warranty claim, or quote.
          </p>
        </div>

        {/* Tracking Form */}
        <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl shadow-xl p-8 mb-12">
          <form id="track-form" onSubmit={handleTrack} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="tracking_number" className="block text-sm font-medium text-foreground mb-2">
                Tracking Number *
              </label>
              <input
                id="tracking_number"
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g., TK-12/25, WO-8/25, QT-15/25"
                className="w-full px-4 py-3 bg-background border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-foreground"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Find this on your receipt or confirmation email
              </p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 bg-background border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-foreground"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-6 rounded-lg font-medium focus:ring-4 focus:ring-ring transition-all btn-primary"
            >
              {isLoading ? 'Tracking...' : 'Track Item'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-center text-sm text-muted-foreground">
              Have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-primary-link font-medium"
              >
                Sign in to your dashboard
              </button>
            </p>
          </div>
        </div>

        {/* Tracking Number Examples */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
            What can you track?
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card rounded-lg p-6 border border-border hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">🎫</div>
              <h4 className="font-semibold text-foreground mb-2">Repair Tickets</h4>
              <p className="text-sm text-muted-foreground mb-2">Format: TK-XX/YY</p>
              <p className="text-xs text-muted-foreground">Track your repair submissions and see when they're converted to work orders</p>
            </div>

            <div className="bg-card rounded-lg p-6 border border-border hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">🔧</div>
              <h4 className="font-semibold text-foreground mb-2">Work Orders</h4>
              <p className="text-sm text-muted-foreground mb-2">Format: WO-XX/YY</p>
              <p className="text-xs text-muted-foreground">Monitor the progress of your machine repairs in real-time</p>
            </div>

            <div className="bg-card rounded-lg p-6 border border-border hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">📄</div>
              <h4 className="font-semibold text-foreground mb-2">Quotes</h4>
              <p className="text-sm text-muted-foreground mb-2">Format: QT-XX/YY</p>
              <p className="text-xs text-muted-foreground">View your quotes and accept offers directly</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Kamer BA. All rights reserved.
          </p>
        </div>
      </footer>
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
            <div>
              <h1 className="text-2xl font-bold text-foreground">Kamer.ba</h1>
              <p className="text-sm text-muted-foreground">Customer Portal</p>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-sm font-medium text-primary-link transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors btn-primary"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </header>
      {content}
    </div>
  );
}

