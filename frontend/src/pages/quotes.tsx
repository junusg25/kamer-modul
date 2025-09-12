import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Loader2
} from 'lucide-react'
import { apiService } from '@/services/api'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'

interface Quote {
  id: string
  quote_number?: string
  formatted_number?: string
  customer_name?: string
  customer_id?: string
  status?: string
  total_amount?: number
  valid_until?: string
  created_by_name?: string
  created_at: string
  updated_at: string
}

const getStatusBadge = (status?: string) => {
  if (!status) return <Badge variant="outline">Unknown</Badge>
  
  return (
    <Badge 
      variant={getStatusBadgeVariant(status)} 
      className={getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : undefined}
    >
      {formatStatus(status)}
    </Badge>
  )
}

const getValidityStatus = (validUntil?: string) => {
  if (!validUntil) {
    return <Badge variant="outline">No Expiry</Badge>
  }
  
  const expiry = new Date(validUntil)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysUntilExpiry < 0) {
    return <Badge variant="destructive">Expired</Badge>
  } else if (daysUntilExpiry <= 7) {
    return <Badge variant="outline" className="border-orange-300 text-orange-700">Expires Soon</Badge>
  } else {
    return <Badge variant="outline" className="border-green-300 text-green-700">Valid</Badge>
  }
}

export default function Quotes() {
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchQuotes()
  }, [])

  const fetchQuotes = async () => {
    try {
      setIsLoading(true)
      const response = await apiService.getQuotes()
      // Backend returns { data: [...], pagination: {...} }
      const quotesData = response.data || []
      setQuotes(quotesData)
    } catch (err) {
      setError('Failed to load quotes')
      console.error('Error fetching quotes:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewQuote = (quoteId: string) => {
    navigate(`/quotes/${quoteId}`)
  }

  const filteredQuotes = quotes.filter(quote =>
    (quote.formatted_number && quote.formatted_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (quote.customer_name && quote.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (quote.created_by_name && quote.created_by_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const draftQuotes = quotes.filter(q => q.status === 'draft')
  const sentQuotes = quotes.filter(q => q.status === 'sent')
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted')
  const expiredQuotes = quotes.filter(q => {
    if (!q.valid_until) return false
    return new Date(q.valid_until) < new Date() && q.status !== 'accepted'
  })

  const totalValue = quotes
    .filter(q => q.status === 'accepted')
    .reduce((sum, q) => sum + (q.total_amount || 0), 0)

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading quotes...</span>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchQuotes}>Try Again</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
            <p className="text-muted-foreground">
              Create and manage customer quotes and estimates
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Quote
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <FileText className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{draftQuotes.length}</div>
              <p className="text-xs text-muted-foreground">In preparation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sentQuotes.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accepted</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{acceptedQuotes.length}</div>
              <p className="text-xs text-muted-foreground">Converted to orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{totalValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Accepted quotes</p>
            </CardContent>
          </Card>
        </div>

        {/* Quotes Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search quotes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
                <Button variant="outline">Filter</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote, index) => (
                  <TableRow key={`quote-${quote.id}-${index}`}>
                    <TableCell className="font-medium">
                      {quote.formatted_number || quote.quote_number || `#${quote.id}`}
                    </TableCell>
                    <TableCell>{quote.customer_name || 'N/A'}</TableCell>
                    <TableCell>{getStatusBadge(quote.status)}</TableCell>
                    <TableCell className="font-medium">
                      {quote.total_amount 
                        ? `€${quote.total_amount.toFixed(2)}`
                        : 'N/A'
                      }
                    </TableCell>
                    <TableCell>{getValidityStatus(quote.valid_until)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quote.created_by_name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleViewQuote(quote.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Quote
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Quote
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" />
                            Send to Customer
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark as Accepted
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject Quote
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}