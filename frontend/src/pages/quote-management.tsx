import React, { useState, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { formatCurrency } from '../lib/currency'
import { formatDate, isOverdue } from '../lib/dateTime'
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Send, 
  Calendar, 
  DollarSign, 
  Building2, 
  User, 
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  MoreVertical,
  Copy,
  Printer,
  Mail,
  Phone
} from 'lucide-react'
import { useAuth } from '../contexts/auth-context'

interface Quote {
  id: number
  quote_number?: string
  customer_id: number
  customer_name: string
  company_name?: string
  email?: string
  phone?: string
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'
  total_amount: number
  valid_until: string
  created_by_name: string
  created_at: string
  updated_at: string
  notes?: string
  terms_conditions?: string
  lead_id?: number
}

interface QuoteItem {
  id: number
  quote_id: number
  item_name: string
  description?: string
  quantity: number
  unit_price: number
  total_price: number
  category?: string
}

interface QuoteFormData {
  customer_name: string
  title: string
  valid_until: string
  notes: string
  terms_conditions: string
  lead_id: string
  items: Array<{
    description: string
    quantity: number
    unit_price: number
  }>
}

interface QuoteItemFormData {
  item_name: string
  description: string
  quantity: string
  unit_price: string
  category: string
}

const QUOTE_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' },
  { value: 'sent', label: 'Sent', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'viewed', label: 'Viewed', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'declined', label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  { value: 'expired', label: 'Expired', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' }
]

const ITEM_CATEGORIES = [
  'High Pressure Cleaners',
  'Vacuum Cleaners',
  'Floor Care Equipment',
  'Parts & Accessories',
  'Maintenance Services',
  'Installation Services',
  'Training Services',
  'Other'
]

export default function QuoteManagement() {
  const { user, hasPermission } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('quotes')

  // Form state
  const [formData, setFormData] = useState<QuoteFormData>({
    customer_name: '',
    title: '',
    valid_until: '',
    notes: '',
    terms_conditions: '',
    lead_id: '',
    items: [{
      description: '',
      quantity: 1,
      unit_price: 0
    }]
  })

  // Quote item form state
  const [itemFormData, setItemFormData] = useState<QuoteItemFormData>({
    item_name: '',
    description: '',
    quantity: '1',
    unit_price: '',
    category: ''
  })

  // Fetch quotes with filters
  const { data: quotesData, isLoading: quotesLoading, refetch: refetchQuotes } = useQuery({
    queryKey: ['quotes', searchTerm, filterStatus],
    queryFn: () => apiService.getQuotes({
      search: searchTerm || undefined,
      status: filterStatus === 'all' ? undefined : filterStatus,
      limit: 50
    }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const quotes = quotesData?.data || []

  // Fetch quote items for selected quote
  const { data: quoteItemsData, isLoading: quoteItemsLoading } = useQuery({
    queryKey: ['quote-items', selectedQuote?.id],
    queryFn: () => selectedQuote ? apiService.getQuoteItems(selectedQuote.id.toString()) : Promise.resolve([]),
    enabled: !!selectedQuote,
    staleTime: 1 * 60 * 1000, // 1 minute
  })

  const quoteItems = quoteItemsData?.data || []

  // Combined loading state
  const isLoading = quotesLoading || quoteItemsLoading

  const getStatusColor = (status: string) => {
    const statusObj = QUOTE_STATUSES.find(s => s.value === status)
    return statusObj?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // formatCurrency is now imported from lib/currency

  // Date formatting functions are now imported from lib/dateTime
  
  const isExpired = (dateString: string) => {
    return isOverdue(dateString)
  }

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = (quote.quote_number?.toString().toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                         quote.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (quote.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    const matchesStatus = filterStatus === 'all' || quote.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const getQuoteItems = (quoteId: number) => {
    return quoteItems.filter(item => item.quote_id === quoteId)
  }

  const calculateSubtotal = (quoteId: number) => {
    const items = getQuoteItems(quoteId)
    return items.reduce((sum, item) => sum + item.total_price, 0)
  }

  const handleCreateQuote = () => {
    if (!hasPermission('quotes:write')) {
      return
    }
    // Reset form and open dialog
    setFormData({
      customer_name: '',
      title: '',
      valid_until: '',
      notes: '',
      terms_conditions: '',
      lead_id: '',
      items: [{
        description: '',
        quantity: 1,
        unit_price: 0
      }]
    })
    setIsCreateDialogOpen(true)
  }

  const handleEditQuote = (quote: Quote) => {
    setFormData({
      customer_name: quote.customer_name,
      title: quote.title || '',
      valid_until: quote.valid_until,
      notes: quote.notes || '',
      terms_conditions: quote.terms_conditions || '',
      lead_id: quote.lead_id?.toString() || '',
      items: getQuoteItems(quote.id) || [{
        description: '',
        quantity: 1,
        unit_price: 0
      }]
    })
    setSelectedQuote(quote)
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      customer_name: '',
      title: '',
      valid_until: '',
      notes: '',
      terms_conditions: '',
      lead_id: '',
      items: [{
        description: '',
        quantity: 1,
        unit_price: 0
      }]
    })
  }

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote)
    setIsViewDialogOpen(true)
  }

  const createQuoteMutation = useMutation({
    mutationFn: (quoteData: any) => apiService.createQuote(quoteData),
    onSuccess: () => {
      refetchQuotes()
      setIsCreateDialogOpen(false)
      setIsEditDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      console.error('Error creating quote:', error)
    }
  })

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => apiService.updateQuote(id, data),
    onSuccess: () => {
      refetchQuotes()
      setIsCreateDialogOpen(false)
      setIsEditDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      console.error('Error updating quote:', error)
    }
  })

  const handleSaveQuote = () => {
    if (isEditDialogOpen) {
      updateQuoteMutation.mutate({
        id: selectedQuote?.id.toString() || '',
        data: formData
      })
    } else {
      createQuoteMutation.mutate(formData)
    }
  }

  const deleteQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => apiService.deleteQuote(quoteId),
    onSuccess: () => {
      refetchQuotes()
    },
    onError: (error) => {
      console.error('Error deleting quote:', error)
    }
  })

  const handleDeleteQuote = (quoteId: number) => {
    if (window.confirm('Are you sure you want to delete this quote?')) {
      deleteQuoteMutation.mutate(quoteId.toString())
    }
  }

  const handleAddItem = (quote: Quote) => {
    setSelectedQuote(quote)
    setItemFormData({
      item_name: '',
      description: '',
      quantity: '1',
      unit_price: '',
      category: ''
    })
    setIsAddItemDialogOpen(true)
  }

  const addQuoteItemMutation = useMutation({
    mutationFn: ({ quoteId, itemData }: { quoteId: string, itemData: any }) => 
      apiService.addQuoteItem(quoteId, itemData),
    onSuccess: () => {
      // Refetch quote items for the selected quote
      if (selectedQuote) {
        refetchQuotes()
      }
      setIsAddItemDialogOpen(false)
      setItemFormData({
        item_name: '',
        description: '',
        quantity: '',
        unit_price: '',
        category: ''
      })
    },
    onError: (error) => {
      console.error('Error adding quote item:', error)
    }
  })

  const handleSaveItem = () => {
    if (selectedQuote) {
      addQuoteItemMutation.mutate({
        quoteId: selectedQuote.id.toString(),
        itemData: itemFormData
      })
    }
  }

  const handleStatusChange = async (quoteId: number, newStatus: string) => {
    try {
      await apiService.updateQuoteStatus(quoteId.toString(), newStatus)
      // Refetch quotes to get updated data
      refetchQuotes()
    } catch (error) {
      console.error('Error updating quote status:', error)
    }
  }

  const handleSendQuote = (quote: Quote) => {
    // Here you would make API call to send quote
    console.log('Sending quote:', quote.id)
    handleStatusChange(quote.id, 'sent')
  }

  const handleDuplicateQuote = (quote: Quote) => {
    // Here you would make API call to duplicate quote
    console.log('Duplicating quote:', quote.id)
    // Create a new quote with similar data
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quote Management</h1>
            <p className="text-muted-foreground">
              Create, manage, and track sales quotes
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => refetchQuotes()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {hasPermission('quotes:write') && (
              <Button size="sm" onClick={handleCreateQuote}>
                <Plus className="h-4 w-4 mr-2" />
                Create Quote
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search quotes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {QUOTE_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="quotes">Quotes ({filteredQuotes.length})</TabsTrigger>
            <TabsTrigger value="items">Quote Items ({quoteItems.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4">
            {/* Quotes Table */}
            <Card>
              <CardHeader>
                <CardTitle>Quotes</CardTitle>
                <CardDescription>
                  Manage your sales quotes and track their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.length > 0 ? (
                      filteredQuotes.map((quote) => (
                        <TableRow key={quote.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{quote.quote_number || `Q-${quote.id}`}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {quote.customer_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{quote.customer_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {quote.company_name}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(quote.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(quote.status)}>
                              {QUOTE_STATUSES.find(s => s.value === quote.status)?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className={isExpired(quote.valid_until) ? 'text-red-600' : ''}>
                                {formatDate(quote.valid_until)}
                              </span>
                              {isExpired(quote.valid_until) && (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{quote.created_by_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewQuote(quote)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditQuote(quote)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {quote.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSendQuote(quote)}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDuplicateQuote(quote)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteQuote(quote.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="text-sm text-muted-foreground mb-2">No quotes data available</div>
                            <div className="text-xs text-muted-foreground">
                              Quotes will appear here once they are created in the system
                            </div>
                            {hasPermission('quotes:write') && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleCreateQuote}
                                className="mt-4"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Quote
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            {/* Quote Items Table */}
            <Card>
              <CardHeader>
                <CardTitle>Quote Items</CardTitle>
                <CardDescription>
                  Manage items across all quotes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quoteItems.length > 0 ? (
                      quoteItems.map((item) => {
                        const quote = quotes.find(q => q.id === item.quote_id)
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{quote?.quote_number || `Q-${quote?.id}`}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.item_name}</div>
                                {item.description && (
                                  <div className="text-sm text-muted-foreground">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.category}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(item.total_price)}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="text-sm text-muted-foreground mb-2">No quote items data available</div>
                            <div className="text-xs text-muted-foreground">
                              Quote items will appear here once quotes are created with items
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Quote Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Quote</DialogTitle>
              <DialogDescription>
                Create a new sales quote for a customer
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Quote Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter quote title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until">Valid Until *</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Quote Items *</Label>
                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-3">
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...formData.items]
                          newItems[index].description = e.target.value
                          setFormData({ ...formData, items: newItems })
                        }}
                      />
                      <Input
                        type="number"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...formData.items]
                          newItems[index].quantity = parseFloat(e.target.value) || 0
                          setFormData({ ...formData, items: newItems })
                        }}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Unit price"
                        value={item.unit_price}
                        onChange={(e) => {
                          const newItems = [...formData.items]
                          newItems[index].unit_price = parseFloat(e.target.value) || 0
                          setFormData({ ...formData, items: newItems })
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        items: [...formData.items, { description: '', quantity: 1, unit_price: 0 }]
                      })
                    }}
                  >
                    Add Item
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Enter any additional notes"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms_conditions">Terms & Conditions</Label>
                <Textarea
                  id="terms_conditions"
                  value={formData.terms_conditions}
                  onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                  placeholder="Enter terms and conditions"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveQuote}
                  disabled={createQuoteMutation.isPending}
                >
                  {createQuoteMutation.isPending ? 'Creating...' : 'Create Quote'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Quote Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Quote</DialogTitle>
              <DialogDescription>
                Update quote information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_customer_name">Customer Name *</Label>
                <Input
                  id="edit_customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_title">Quote Title *</Label>
                <Input
                  id="edit_title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter quote title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_valid_until">Valid Until *</Label>
                <Input
                  id="edit_valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Quote Items *</Label>
                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-3">
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...formData.items]
                          newItems[index].description = e.target.value
                          setFormData({ ...formData, items: newItems })
                        }}
                      />
                      <Input
                        type="number"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...formData.items]
                          newItems[index].quantity = parseFloat(e.target.value) || 0
                          setFormData({ ...formData, items: newItems })
                        }}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Unit price"
                        value={item.unit_price}
                        onChange={(e) => {
                          const newItems = [...formData.items]
                          newItems[index].unit_price = parseFloat(e.target.value) || 0
                          setFormData({ ...formData, items: newItems })
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        items: [...formData.items, { description: '', quantity: 1, unit_price: 0 }]
                      })
                    }}
                  >
                    Add Item
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_notes">Notes</Label>
                <Textarea
                  id="edit_notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Enter any additional notes"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_terms_conditions">Terms & Conditions</Label>
                <Textarea
                  id="edit_terms_conditions"
                  value={formData.terms_conditions}
                  onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                  placeholder="Enter terms and conditions"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveQuote}
                  disabled={updateQuoteMutation.isPending}
                >
                  {updateQuoteMutation.isPending ? 'Updating...' : 'Update Quote'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Quote Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Quote Details - {selectedQuote?.quote_number || `Q-${selectedQuote?.id}`}</DialogTitle>
              <DialogDescription>
                View and manage quote information
              </DialogDescription>
            </DialogHeader>
            {selectedQuote && (
              <div className="space-y-6">
                {/* Quote Header */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Customer Information</Label>
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium">{selectedQuote.customer_name}</div>
                      {selectedQuote.company_name && (
                        <div className="text-sm text-muted-foreground">{selectedQuote.company_name}</div>
                      )}
                      {selectedQuote.email && (
                        <div className="text-sm text-muted-foreground">{selectedQuote.email}</div>
                      )}
                      {selectedQuote.phone && (
                        <div className="text-sm text-muted-foreground">{selectedQuote.phone}</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Quote Information</Label>
                    <div className="p-4 border rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span>Quote Number:</span>
                        <span className="font-medium">{selectedQuote.quote_number || `Q-${selectedQuote.id}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge className={getStatusColor(selectedQuote.status)}>
                          {QUOTE_STATUSES.find(s => s.value === selectedQuote.status)?.label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Valid Until:</span>
                        <span className={isExpired(selectedQuote.valid_until) ? 'text-red-600' : ''}>
                          {formatDate(selectedQuote.valid_until)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Amount:</span>
                        <span className="font-medium">{formatCurrency(selectedQuote.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Quote Items</Label>
                    <Button size="sm" onClick={() => handleAddItem(selectedQuote)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getQuoteItems(selectedQuote.id).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.item_name}</div>
                              {item.description && (
                                <div className="text-sm text-muted-foreground">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(item.total_price)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Quote Notes */}
                {selectedQuote.notes && (
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <div className="p-4 border rounded-lg">
                      {selectedQuote.notes}
                    </div>
                  </div>
                )}

                {/* Terms & Conditions */}
                {selectedQuote.terms_conditions && (
                  <div className="space-y-2">
                    <Label>Terms & Conditions</Label>
                    <div className="p-4 border rounded-lg">
                      {selectedQuote.terms_conditions}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                    Close
                  </Button>
                  <Button variant="outline">
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  {selectedQuote.status === 'draft' && (
                    <Button onClick={() => handleSendQuote(selectedQuote)}>
                      <Send className="h-4 w-4 mr-2" />
                      Send Quote
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Item Dialog */}
        <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Quote Item</DialogTitle>
              <DialogDescription>
                Add a new item to {selectedQuote?.quote_number || `Q-${selectedQuote?.id}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item_name">Item Name *</Label>
                <Input
                  id="item_name"
                  value={itemFormData.item_name}
                  onChange={(e) => setItemFormData({ ...itemFormData, item_name: e.target.value })}
                  placeholder="Enter item name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item_description">Description</Label>
                <Textarea
                  id="item_description"
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  placeholder="Enter item description"
                  rows={2}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={itemFormData.quantity}
                    onChange={(e) => setItemFormData({ ...itemFormData, quantity: e.target.value })}
                    placeholder="Enter quantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Unit Price *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    value={itemFormData.unit_price}
                    onChange={(e) => setItemFormData({ ...itemFormData, unit_price: e.target.value })}
                    placeholder="Enter unit price"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={itemFormData.category} onValueChange={(value) => setItemFormData({ ...itemFormData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveItem}
                  disabled={addQuoteItemMutation.isPending}
                >
                  {addQuoteItemMutation.isPending ? 'Adding...' : 'Add Item'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
