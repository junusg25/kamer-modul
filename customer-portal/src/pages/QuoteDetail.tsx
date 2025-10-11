import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { formatDate, formatCurrency, getStatusColor, getStatusLabel } from '../lib/utils';
import { MainLayout } from '../components/layout/main-layout';
import { ArrowLeft, FileText, Calendar, User, DollarSign, Package, AlertCircle } from 'lucide-react';

interface QuoteDetail {
  id: number;
  formatted_number: string;
  quote_number?: string;
  title?: string;
  description?: string;
  status: string;
  subtotal?: number;
  discount_percentage?: number;
  discount_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
  total_amount: number;
  valid_until: string;
  notes?: string;
  terms_conditions?: string;
  payment_terms?: string;
  delivery_terms?: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  viewed_at?: string;
  accepted_at?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  company_name?: string;
  created_by_name?: string;
}

interface QuoteItem {
  id: number;
  item_type: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
}

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchQuoteDetail();
  }, [id]);

  const fetchQuoteDetail = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await apiService.getItemDetail('quote', id!);
      
      if (result.data.type !== 'quote') {
        setError('Invalid item type');
        return;
      }

      setQuote(result.data.item);
      setItems(result.data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load quote details');
    } finally {
      setIsLoading(false);
    }
  };

  const isExpired = () => {
    if (!quote?.valid_until) return false;
    return new Date(quote.valid_until) < new Date();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#ff8800', borderTopColor: 'transparent' }}></div>
          <p className="text-muted-foreground">Loading quote details...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border p-8 rounded-lg shadow-md text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <p className="text-foreground mb-4">{error || 'Quote not found'}</p>
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
              <FileText className="w-8 h-8" style={{ color: '#ff8800' }} />
              <div>
                <h1 className="text-3xl font-bold text-foreground">{quote.formatted_number}</h1>
                <p className="text-sm text-muted-foreground">Quotation</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(quote.status)}`}>
                {getStatusLabel(quote.status)}
              </span>
              {isExpired() && (
                <p className="text-xs text-destructive mt-1">Expired</p>
              )}
            </div>
          </div>

          {quote.title && (
            <h2 className="text-xl text-foreground mt-4">{quote.title}</h2>
          )}
          {quote.description && (
            <p className="text-muted-foreground mt-2">{quote.description}</p>
          )}
        </div>

        {/* Validity Notice */}
        {isExpired() && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-destructive">
              ⚠️ This quote expired on {formatDate(quote.valid_until)}. Please contact us for a new quote.
            </p>
          </div>
        )}

        {/* Quote Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Quote Details</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Created</span>
                </p>
                <p className="text-foreground">{formatDate(quote.created_at)}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Valid Until</p>
                <p className="text-foreground font-medium">{formatDate(quote.valid_until)}</p>
              </div>

              {quote.created_by_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>Created By</span>
                  </p>
                  <p className="text-foreground">{quote.created_by_name}</p>
                </div>
              )}

              {quote.sent_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Sent On</p>
                  <p className="text-foreground">{formatDate(quote.sent_at)}</p>
                </div>
              )}

              {quote.accepted_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Accepted On</p>
                  <p className="text-foreground text-green-600 font-medium">{formatDate(quote.accepted_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Cost Summary */}
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <DollarSign className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Summary</span>
            </h2>

            <div className="space-y-3">
              {quote.subtotal && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(quote.subtotal)}
                  </span>
                </div>
              )}

              {quote.discount_amount && quote.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="text-sm">Discount ({quote.discount_percentage?.toFixed(2)}%)</span>
                  <span className="text-sm font-medium">
                    -{formatCurrency(quote.discount_amount)}
                  </span>
                </div>
              )}

              {quote.tax_amount && quote.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tax ({quote.tax_rate?.toFixed(2)}%)</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(quote.tax_amount)}
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-foreground">Total Amount</span>
                  <span className="text-2xl font-bold" style={{ color: '#ff8800' }}>
                    {formatCurrency(quote.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Items */}
        {items.length > 0 && (
          <div className="bg-card border border-border rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <Package className="w-5 h-5" style={{ color: '#ff8800' }} />
              <span>Items</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Qty</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Unit Price</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={index !== items.length - 1 ? 'border-b border-border' : ''}>
                      <td className="py-3 px-4">
                        <p className="text-foreground font-medium">{item.item_name}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.category && (
                          <span className="inline-block px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                            {item.category}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-foreground">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-foreground">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-4 text-right font-medium text-foreground">
                        {formatCurrency(item.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Terms & Conditions */}
        {(quote.payment_terms || quote.delivery_terms || quote.terms_conditions || quote.notes) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {quote.payment_terms && (
              <div className="bg-card border border-border rounded-lg shadow p-6">
                <h3 className="font-semibold text-foreground mb-3">Payment Terms</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.payment_terms}</p>
              </div>
            )}

            {quote.delivery_terms && (
              <div className="bg-card border border-border rounded-lg shadow p-6">
                <h3 className="font-semibold text-foreground mb-3">Delivery Terms</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.delivery_terms}</p>
              </div>
            )}

            {quote.terms_conditions && (
              <div className="bg-card border border-border rounded-lg shadow p-6 md:col-span-2">
                <h3 className="font-semibold text-foreground mb-3">Terms & Conditions</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.terms_conditions}</p>
              </div>
            )}

            {quote.notes && (
              <div className="bg-card border border-border rounded-lg shadow p-6 md:col-span-2">
                <h3 className="font-semibold text-foreground mb-3">Additional Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {quote.status === 'sent' && !isExpired() && (
          <div className="bg-card border border-border rounded-lg shadow p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">Interested in this quote?</h3>
              <p className="text-muted-foreground mb-6">
                Contact us to accept this quote or discuss any modifications
              </p>
              <div className="flex justify-center space-x-4">
                <a
                  href="tel:+38733123456"
                  className="px-6 py-3 rounded-lg btn-primary"
                >
                  Call Us
                </a>
                <a
                  href={`mailto:info@kamer.ba?subject=Quote ${quote.formatted_number}`}
                  className="px-6 py-3 bg-card border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
                >
                  Send Email
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

