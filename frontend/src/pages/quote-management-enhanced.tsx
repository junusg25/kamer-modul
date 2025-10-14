import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Input } from '../components/ui/input'
import { SmartSearch } from '../components/ui/smart-search'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Progress } from '../components/ui/progress'
import { DatePicker } from '../components/ui/date-picker'
import { 
  Plus, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Calendar, 
  DollarSign, 
  Building2, 
  User, 
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Copy,
  Printer,
  Package,
  Wrench,
  ShoppingCart,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Filter,
  BarChart3,
  FileStack,
  Zap,
  MoreHorizontal
} from 'lucide-react'
import { useAuth } from '../contexts/auth-context'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'
import { Pagination } from '../components/ui/pagination'
import apiService from '../services/api'
import { formatCurrency } from '@/lib/currency'
import { formatDate, isOverdue } from '@/lib/dateTime'

// ============================================
// INTERFACES
// ============================================

interface Quote {
  id: number
  quote_number?: string
  formatted_number?: string
  year_created?: number
  customer_id?: number
  customer_name: string
  company_name?: string
  email?: string
  phone?: string
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'
  total_amount: number
  subtotal?: number
  discount_amount?: number
  discount_percentage?: number
  tax_amount?: number
  tax_rate?: number
  valid_until: string
  created_by_name: string
  created_at: string
  updated_at: string
  notes?: string
  terms_conditions?: string
  payment_terms?: string
  delivery_terms?: string
  quote_type?: string
  template_id?: number
  title?: string
  description?: string
  sent_at?: string
  viewed_at?: string
  accepted_at?: string
}

interface QuoteItem {
  id: number
  quote_id: number
  item_type: 'machine' | 'part' | 'service' | 'custom'
  item_reference_id?: number
  item_name: string
  description?: string
  quantity: number
  unit_price: number
  total_price: number
  category?: string
  position?: number
}

interface QuoteTemplate {
  id: number
  template_name: string
  template_type: string
  description?: string
  default_valid_days: number
  default_terms_conditions?: string
  default_payment_terms?: string
  default_delivery_terms?: string
  default_discount_percentage?: number
  is_active: boolean
  created_by_name?: string
  items_count?: number
  created_at: string
}

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  company_name?: string
  vat_number?: string
  city?: string
  postal_code?: string
  street_address?: string
}

interface CatalogMachine {
  id: number
  name: string
  manufacturer: string
  catalogue_number?: string
  description?: string
  warranty_months: number
  category_name?: string
  available_serials: number
  avg_sale_price?: number
}

interface CatalogPart {
  id: number
  name: string
  description?: string
  category?: string
  quantity: number
  unit_price: number
  sku?: string
  supplier?: string
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

interface CatalogService {
  id: string
  name: string
  description: string
  category: string
  default_price: number
}

interface QuoteFormData {
  customer_id?: number
  customer_name: string
  customer_email?: string
  customer_phone?: string
  title: string
  description?: string
  valid_until: string
  notes?: string
  terms_conditions?: string
  payment_terms?: string
  delivery_terms?: string
  discount_percentage: number
  tax_rate: number
  quote_type: string
  template_id?: number
}

interface QuoteStats {
  total_quotes: number
  total_value: number
  acceptance_rate: number
  draft_quotes: number
  sent_quotes: number
  accepted_quotes: number
  expired_quotes: number
  avg_quote_value: number
}

// ============================================
// CONSTANTS
// ============================================

const QUOTE_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300', icon: FileText },
  { value: 'sent', label: 'Sent', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', icon: Clock },
  { value: 'viewed', label: 'Viewed', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', icon: Eye },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  { value: 'declined', label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: X },
  { value: 'expired', label: 'Expired', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300', icon: AlertCircle }
]

const TEMPLATE_TYPES = [
  { value: 'machine_sale', label: 'Machine Sale', icon: Wrench, color: 'text-blue-600' },
  { value: 'parts_package', label: 'Parts Package', icon: Package, color: 'text-green-600' },
  { value: 'service', label: 'Service & Maintenance', icon: ShoppingCart, color: 'text-purple-600' },
  { value: 'custom', label: 'Custom Quote', icon: FileStack, color: 'text-gray-600' }
]

// Define columns for Quotes table
const QUOTE_COLUMNS = defineColumns([
  { key: 'quote_number', label: 'Quote #' },
  { key: 'customer', label: 'Customer' },
  { key: 'type', label: 'Type' },
  { key: 'total_amount', label: 'Total Amount' },
  { key: 'status', label: 'Status' },
  { key: 'valid_until', label: 'Valid Until' },
  { key: 'created_by', label: 'Created By' },
  { key: 'created_at', label: 'Created' },
])

// ============================================
// MAIN COMPONENT
// ============================================

export default function QuoteManagementEnhanced() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // State
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [templates, setTemplates] = useState<QuoteTemplate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [quoteStats, setQuoteStats] = useState<QuoteStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [activeTab, setActiveTab] = useState('quotes')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(25)
  
  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [selectedQuoteItems, setSelectedQuoteItems] = useState<QuoteItem[]>([])
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null)
  
  // Create Quote Wizard State
  const [wizardStep, setWizardStep] = useState(0)
  const [formData, setFormData] = useState<QuoteFormData>({
    customer_name: '',
    title: '',
    valid_until: '',
    discount_percentage: 0,
    tax_rate: 0,
    quote_type: 'custom'
  })
  const [quoteItems, setQuoteItems] = useState<Partial<QuoteItem>[]>([])
  
  // Catalog Browser State
  const [catalogTab, setCatalogTab] = useState<'machines' | 'parts' | 'services'>('machines')
  const [catalogMachines, setCatalogMachines] = useState<CatalogMachine[]>([])
  const [catalogParts, setCatalogParts] = useState<CatalogPart[]>([])
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  
  // Column visibility
  const quotesColumnVisibility = useColumnVisibility('quotes_enhanced', getDefaultColumnKeys(QUOTE_COLUMNS))

  // ============================================
  // DATA FETCHING
  // ============================================

  useEffect(() => {
    fetchAllData()
  }, [])

  useEffect(() => {
    fetchQuotes()
  }, [currentPage])

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        fetchQuotes(),
        fetchTemplates(),
        fetchCustomers(),
        fetchQuoteStats()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchQuotes = async () => {
    try {
      const response = await apiService.getQuotes({ 
        page: currentPage,
        limit: pageSize 
      })
      setQuotes(response.data || [])
      
      // Update pagination state
      if (response.pagination) {
        setTotalPages(response.pagination.pages || 1)
        setTotalCount(response.pagination.total || 0)
      }
    } catch (error) {
      console.error('Error fetching quotes:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await apiService.getQuoteTemplates({ is_active: true })
      setTemplates(response.data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await apiService.getCustomers({ limit: 1000 })
      setCustomers(response.data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchQuoteStats = async () => {
    try {
      const response = await apiService.getQuoteStats()
      const stats = response.data
      setQuoteStats(stats)
    } catch (error) {
      console.error('Error fetching quote stats:', error)
    }
  }

  // Update stats whenever quotes change
  useEffect(() => {
    if (quotes.length > 0 && quoteStats) {
      const draftCount = quotes.filter(q => q.status === 'draft').length
      const sentCount = quotes.filter(q => q.status === 'sent').length
      const acceptedCount = quotes.filter(q => q.status === 'accepted').length
      const expiredCount = quotes.filter(q => q.status === 'expired').length
      const avgValue = quotes.length > 0 
        ? quotes.reduce((sum, q) => sum + q.total_amount, 0) / quotes.length 
        : 0
      
      setQuoteStats({
        ...quoteStats,
        draft_quotes: draftCount,
        sent_quotes: sentCount,
        accepted_quotes: acceptedCount,
        expired_quotes: expiredCount,
        avg_quote_value: avgValue
      })
    }
  }, [quotes])

  const fetchCatalogMachines = async () => {
    try {
      const response = await apiService.getQuoteCatalogMachines({ search: catalogSearch })
      setCatalogMachines(response.data || [])
    } catch (error) {
      console.error('Error fetching catalog machines:', error)
    }
  }

  const fetchCatalogParts = async () => {
    try {
      const response = await apiService.getQuoteCatalogParts({ 
        search: catalogSearch,
        in_stock_only: true 
      })
      setCatalogParts(response.data || [])
    } catch (error) {
      console.error('Error fetching catalog parts:', error)
    }
  }

  const fetchCatalogServices = async () => {
    try {
      const response = await apiService.getQuoteCatalogServices()
      setCatalogServices(response.data || [])
    } catch (error) {
      console.error('Error fetching catalog services:', error)
    }
  }

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreateQuote = () => {
    resetWizard()
    setIsCreateDialogOpen(true)
  }

  const handleCreateFromTemplate = async (template: QuoteTemplate) => {
    try {
      // Load template details
      const response = await apiService.getQuoteTemplate(template.id.toString())
      const templateData = response.data
      
      // Pre-fill form with template data
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + (templateData.default_valid_days || 30))
      
      setFormData({
        customer_name: '',
        title: templateData.template_name,
        valid_until: validUntil.toISOString().split('T')[0],
        notes: '',
        terms_conditions: templateData.default_terms_conditions || '',
        payment_terms: templateData.default_payment_terms || '',
        delivery_terms: templateData.default_delivery_terms || '',
        discount_percentage: templateData.default_discount_percentage || 0,
        tax_rate: 0,
        quote_type: templateData.template_type,
        template_id: template.id
      })
      
      // Pre-fill items from template
      if (templateData.items && templateData.items.length > 0) {
        setQuoteItems(templateData.items.map((item: any) => ({
          item_type: item.item_type,
          item_reference_id: item.item_reference_id,
          item_name: item.item_name,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          category: item.category
        })))
      }
      
      setIsCreateDialogOpen(true)
    } catch (error) {
      console.error('Error loading template:', error)
    }
  }

  const handleViewQuote = async (quote: Quote) => {
    setSelectedQuote(quote)
    try {
      const response = await apiService.getQuoteItems(quote.id.toString())
      setSelectedQuoteItems(response.data || [])
    } catch (error) {
      console.error('Error fetching quote items:', error)
    }
    setIsViewDialogOpen(true)
  }

  const handleDuplicateQuote = async (quote: Quote) => {
    try {
      await apiService.duplicateQuote(quote.id.toString())
      await fetchQuotes()
    } catch (error) {
      console.error('Error duplicating quote:', error)
    }
  }

  const handleDeleteQuote = async (quoteId: number) => {
    if (window.confirm('Are you sure you want to delete this quote?')) {
      try {
        await apiService.deleteQuote(quoteId.toString())
        await fetchQuotes()
      } catch (error) {
        console.error('Error deleting quote:', error)
      }
    }
  }

  const handleDownloadPDF = async (quoteId: number) => {
    try {
      await apiService.downloadQuotePDF(quoteId.toString())
    } catch (error) {
      console.error('Error downloading PDF:', error)
    }
  }

  const handleStatusChange = async (quoteId: number, newStatus: string) => {
    try {
      await apiService.updateQuoteStatus(quoteId.toString(), newStatus)
      await fetchQuotes()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleEditQuote = async (quote: Quote) => {
    // Load quote data into form
    setFormData({
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      customer_email: quote.email || '',
      customer_phone: quote.phone || '',
      title: quote.title || '',
      description: quote.description || '',
      valid_until: quote.valid_until,
      notes: quote.notes || '',
      terms_conditions: quote.terms_conditions || '',
      payment_terms: quote.payment_terms || '',
      delivery_terms: quote.delivery_terms || '',
      discount_percentage: quote.discount_percentage || 0,
      tax_rate: quote.tax_rate || 0,
      quote_type: quote.quote_type || 'custom',
      template_id: quote.template_id
    })
    
    // Load quote items
    try {
      const response = await apiService.getQuoteItems(quote.id.toString())
      const items = (response.data || []).map(item => {
        const quantity = Number(item.quantity)
        const unitPrice = Number(item.unit_price)
        return {
          item_type: item.item_type,
          item_reference_id: item.item_reference_id,
          item_name: item.item_name,
          description: item.description || '',
          quantity: isNaN(quantity) ? 1 : quantity,
          unit_price: isNaN(unitPrice) ? 0 : unitPrice,
          total_price: (isNaN(quantity) ? 1 : quantity) * (isNaN(unitPrice) ? 0 : unitPrice),
          category: item.category || ''
        }
      })
      setQuoteItems(items)
    } catch (error) {
      console.error('Error fetching quote items:', error)
      setQuoteItems([])
    }
    
    setEditingQuoteId(quote.id)
    setWizardStep(0)
    setIsCreateDialogOpen(true)
  }

  const handleUpdateQuote = async () => {
    if (!editingQuoteId) return

    setIsLoading(true)
    try {
      const { subtotal, discount_amount, tax_amount, total_amount } = calculateQuoteTotal()

      const quoteData = {
        customer_id: formData.customer_id || null,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        title: formData.title,
        description: formData.description || null,
        subtotal: Number(subtotal),
        discount_percentage: Number(formData.discount_percentage),
        discount_amount: Number(discount_amount),
        tax_rate: Number(formData.tax_rate),
        tax_amount: Number(tax_amount),
        total_amount: Number(total_amount),
        valid_until: formData.valid_until,
        notes: formData.notes || null,
        terms_conditions: formData.terms_conditions || null,
        payment_terms: formData.payment_terms || null,
        delivery_terms: formData.delivery_terms || null,
        quote_type: formData.quote_type,
        template_id: formData.template_id || null,
        items: quoteItems.map(item => ({
          item_type: item.item_type,
          item_reference_id: item.item_reference_id || null,
          item_name: item.item_name,
          description: item.description || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          category: item.category || null
        }))
      }

      await apiService.updateQuote(editingQuoteId.toString(), quoteData)
      await fetchQuotes()
      resetWizard()
      setIsCreateDialogOpen(false)
      setEditingQuoteId(null)
    } catch (error) {
      console.error('Error updating quote:', error)
      alert('Failed to update quote. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Wizard Navigation
  const handleNext = () => {
    if (wizardStep < 3) {
      setWizardStep(wizardStep + 1)
    }
  }

  const handlePrevious = () => {
    if (wizardStep > 0) {
      setWizardStep(wizardStep - 1)
    }
  }

  const handleSubmitQuote = async () => {
    // If editing, use the update handler instead
    if (editingQuoteId) {
      await handleUpdateQuote()
      return
    }

    try {
      setIsLoading(true)
      
      // Calculate totals
      const subtotal = quoteItems.reduce((sum, item) => 
        sum + ((item.quantity || 0) * (item.unit_price || 0)), 0
      )
      const discountAmount = (subtotal * (formData.discount_percentage || 0)) / 100
      const subtotalAfterDiscount = subtotal - discountAmount
      const taxAmount = (subtotalAfterDiscount * (formData.tax_rate || 0)) / 100
      const totalAmount = subtotalAfterDiscount + taxAmount
      
      const quoteData = {
        ...formData,
        subtotal,
        discount_percentage: Number(formData.discount_percentage) || 0,
        discount_amount: discountAmount,
        tax_rate: Number(formData.tax_rate) || 0,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        items: quoteItems.map((item, index) => ({
          ...item,
          position: index,
          total_price: (item.quantity || 0) * (item.unit_price || 0)
        }))
      }
      
      await apiService.createQuote(quoteData)
      await fetchQuotes()
      setIsCreateDialogOpen(false)
      resetWizard()
    } catch (error) {
      console.error('Error creating quote:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetWizard = () => {
    setWizardStep(0)
    setFormData({
      customer_name: '',
      title: '',
      valid_until: '',
      discount_percentage: 0,
      tax_rate: 0,
      quote_type: 'custom'
    })
    setQuoteItems([])
    setEditingQuoteId(null)
  }

  // Catalog Handlers
  const handleOpenCatalog = () => {
    setCatalogTab('machines')
    fetchCatalogMachines()
    setIsCatalogDialogOpen(true)
  }

  const handleAddFromCatalog = (item: CatalogMachine | CatalogPart | CatalogService, type: 'machine' | 'part' | 'service') => {
    const newItem: Partial<QuoteItem> = {
      item_type: type,
      item_reference_id: typeof item.id === 'number' ? item.id : undefined,
      item_name: item.name,
      description: item.description || '',
      quantity: 1,
      unit_price: 0,
      category: ''
    }
    
    if (type === 'machine') {
      const machine = item as CatalogMachine
      newItem.unit_price = machine.avg_sale_price || 0
      newItem.category = machine.category_name || 'Machines'
      newItem.description = `${machine.manufacturer} - ${machine.name}${machine.catalogue_number ? ` (${machine.catalogue_number})` : ''}`
    } else if (type === 'part') {
      const part = item as CatalogPart
      newItem.unit_price = part.unit_price
      newItem.category = part.category || 'Parts'
      newItem.description = part.description || ''
    } else if (type === 'service') {
      const service = item as CatalogService
      newItem.unit_price = service.default_price
      newItem.category = service.category
      newItem.description = service.description
    }
    
    setQuoteItems([...quoteItems, newItem])
  }

  const handleRemoveItem = (index: number) => {
    setQuoteItems(quoteItems.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updated = [...quoteItems]
    updated[index] = { ...updated[index], [field]: value }
    
    // Recalculate total_price if quantity or unit_price changes
    if (field === 'quantity' || field === 'unit_price') {
      const item = updated[index]
      const quantity = field === 'quantity' ? Number(value) : Number(item.quantity || 0)
      const unitPrice = field === 'unit_price' ? Number(value) : Number(item.unit_price || 0)
      updated[index].total_price = quantity * unitPrice
    }
    
    setQuoteItems(updated)
  }

  // ============================================
  // FILTERING
  // ============================================

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = (quote.formatted_number?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) || false) ||
                         (quote.quote_number?.toString().toLowerCase().includes(appliedSearchTerm.toLowerCase()) || false) ||
                         quote.customer_name.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
                         (quote.company_name?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) || false)
    const matchesStatus = filterStatus === 'all' || quote.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const getStatusBadge = (status: string) => {
    const statusObj = QUOTE_STATUSES.find(s => s.value === status)
    if (!statusObj) return null
    const Icon = statusObj.icon
    return (
      <Badge className={statusObj.color}>
        <Icon className="h-3 w-3 mr-1" />
        {statusObj.label}
      </Badge>
    )
  }

  const getTemplateIcon = (type: string) => {
    const template = TEMPLATE_TYPES.find(t => t.value === type)
    return template ? template.icon : FileText
  }

  const getTemplateColor = (type: string) => {
    const template = TEMPLATE_TYPES.find(t => t.value === type)
    return template ? template.color : 'text-gray-600'
  }

  const calculateQuoteTotal = () => {
    const subtotal = quoteItems.reduce((sum, item) => 
      sum + ((item.quantity || 0) * (item.unit_price || 0)), 0
    )
    const discountAmount = (subtotal * (formData.discount_percentage || 0)) / 100
    const subtotalAfterDiscount = subtotal - discountAmount
    const taxAmount = (subtotalAfterDiscount * (formData.tax_rate || 0)) / 100
    const totalAmount = subtotalAfterDiscount + taxAmount
    
    return {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount
    }
  }

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0: // Customer
        return !!formData.customer_name
      case 1: // Items
        return quoteItems.length > 0 && quoteItems.every(item => 
          item.item_name && 
          (item.quantity !== undefined && item.quantity !== null && item.quantity > 0) && 
          (item.unit_price !== undefined && item.unit_price !== null && item.unit_price >= 0)
        )
      case 2: // Details
        return !!formData.title && !!formData.valid_until
      case 3: // Review
        return true
      default:
        return false
    }
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  const renderWizardStep = () => {
    switch (wizardStep) {
      case 0:
        return renderCustomerStep()
      case 1:
        return renderItemsStep()
      case 2:
        return renderDetailsStep()
      case 3:
        return renderReviewStep()
      default:
        return null
    }
  }

  const renderCustomerStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select Customer *</Label>
        <Select 
          value={formData.customer_id?.toString() || ''} 
          onValueChange={(value) => {
            const customer = customers.find(c => c.id === value)
            if (customer) {
              setFormData({
                ...formData,
                customer_id: parseInt(value),
                customer_name: customer.name,
                customer_email: customer.email,
                customer_phone: customer.phone
              })
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a customer" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{customer.name}</span>
                  {customer.company_name && (
                    <span className="text-muted-foreground text-xs">({customer.company_name})</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formData.customer_id && (
        <Card className="bg-blue-50 dark:bg-blue-950">
          <CardContent className="pt-4">
            <div className="space-y-2 text-sm">
              <div className="font-medium">{formData.customer_name}</div>
              {formData.customer_email && <div>Email: {formData.customer_email}</div>}
              {formData.customer_phone && <div>Phone: {formData.customer_phone}</div>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Customer not in the list? Add them from the Customers page first.</span>
      </div>
    </div>
  )

  const renderItemsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Quote Items *</Label>
        <Button size="sm" onClick={handleOpenCatalog}>
          <Plus className="h-4 w-4 mr-2" />
          Add from Catalog
        </Button>
      </div>

      {quoteItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">No items added yet</p>
            <Button size="sm" onClick={handleOpenCatalog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Items from Catalog
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Unit Price</TableHead>
                  <TableHead className="w-32">Total</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quoteItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.item_name}</div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category || 'Custom'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-20"
                        min="1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-28"
                        min="0"
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950">
        <CardContent className="pt-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Subtotal:</span>
            <span className="text-lg font-bold">{formatCurrency(calculateQuoteTotal().subtotal)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderDetailsStep = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Quote Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., High Pressure Cleaner Package"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valid_until">Valid Until *</Label>
          <DatePicker
            value={formData.valid_until}
            onChange={(value) => setFormData({ ...formData, valid_until: value })}
            placeholder="Select date"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this quote"
          rows={2}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="discount">Discount (%)</Label>
          <Input
            id="discount"
            type="number"
            value={formData.discount_percentage}
            onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
            min="0"
            max="100"
            step="0.1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax">Tax Rate (%)</Label>
          <Input
            id="tax"
            type="number"
            value={formData.tax_rate}
            onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
            min="0"
            max="100"
            step="0.1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment_terms">Payment Terms</Label>
        <Textarea
          id="payment_terms"
          value={formData.payment_terms || ''}
          onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
          placeholder="e.g., 50% deposit, 50% on delivery"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="delivery_terms">Delivery Terms</Label>
        <Textarea
          id="delivery_terms"
          value={formData.delivery_terms || ''}
          onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
          placeholder="e.g., Delivery within 2-4 weeks"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any additional notes for the customer"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="terms">Terms & Conditions</Label>
        <Textarea
          id="terms"
          value={formData.terms_conditions || ''}
          onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
          placeholder="Standard terms and conditions"
          rows={4}
        />
      </div>
    </div>
  )

  const renderReviewStep = () => {
    const totals = calculateQuoteTotal()
    const selectedCustomer = customers.find(c => c.id === formData.customer_id?.toString())
    
    return (
      <div className="space-y-6">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formData.customer_name}</span>
              </div>
              {formData.customer_email && (
                <div className="text-sm text-muted-foreground">Email: {formData.customer_email}</div>
              )}
              {formData.customer_phone && (
                <div className="text-sm text-muted-foreground">Phone: {formData.customer_phone}</div>
              )}
              {selectedCustomer?.company_name && (
                <div className="text-sm text-muted-foreground">Company: {selectedCustomer.company_name}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quote Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quote Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Title:</span>
              <span className="font-medium">{formData.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valid Until:</span>
              <span className="font-medium">{formatDate(formData.valid_until)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <Badge variant="outline">{formData.quote_type}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Items Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Items ({quoteItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quoteItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.item_name}</div>
                        {item.category && (
                          <Badge variant="outline" className="mt-1">{item.category}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price || 0)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="bg-blue-50 dark:bg-blue-950">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            {formData.discount_percentage > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount ({Number(formData.discount_percentage).toFixed(2)}%):</span>
                <span className="font-medium">-{formatCurrency(totals.discountAmount)}</span>
              </div>
            )}
            {formData.tax_rate > 0 && (
              <div className="flex justify-between text-sm">
                <span>Tax ({Number(formData.tax_rate).toFixed(2)}%):</span>
                <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-3">
              <span>Total Amount:</span>
              <span className="text-blue-600">{formatCurrency(totals.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <>
      <MainLayout>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quote Management</h1>
            <p className="text-muted-foreground">
              Create and manage sales quotes for machines, parts, and services
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchAllData}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleCreateQuote}>
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {quoteStats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{quoteStats.total_quotes || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {quoteStats.draft_quotes || 0} drafts, {quoteStats.sent_quotes || 0} sent
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(quoteStats.total_value || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg: {formatCurrency(quoteStats.avg_quote_value || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(quoteStats.acceptance_rate || 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {quoteStats.accepted_quotes || 0} accepted
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Templates</CardTitle>
                <FileStack className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{templates.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active templates
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="quotes">
              <FileText className="h-4 w-4 mr-2" />
              Quotes ({filteredQuotes.length})
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileStack className="h-4 w-4 mr-2" />
              Templates ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Quotes Tab */}
          <TabsContent value="quotes" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <SmartSearch
                      placeholder="Search quotes..."
                      value={appliedSearchTerm}
                      onSearch={(term) => {
                        setAppliedSearchTerm(term)
                        setCurrentPage(1) // Reset to first page when searching
                      }}
                      onClear={() => {
                        setAppliedSearchTerm('')
                        setCurrentPage(1)
                      }}
                      debounceMs={300}
                      className="w-full"
                      disabled={isLoading}
                    />
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

            {/* Quotes Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Quotes</CardTitle>
                    <CardDescription>
                      Manage your sales quotes and track their status
                    </CardDescription>
                  </div>
                  <ColumnVisibilityDropdown
                    columns={QUOTE_COLUMNS}
                    visibleColumns={quotesColumnVisibility.visibleColumns}
                    onToggleColumn={quotesColumnVisibility.toggleColumn}
                    onShowAll={quotesColumnVisibility.showAllColumns}
                    onHideAll={quotesColumnVisibility.hideAllColumns}
                    onReset={quotesColumnVisibility.resetColumns}
                    isSyncing={quotesColumnVisibility.isSyncing}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {quotesColumnVisibility.isColumnVisible('quote_number') && <TableHead>Quote #</TableHead>}
                      {quotesColumnVisibility.isColumnVisible('customer') && <TableHead>Customer</TableHead>}
                      {quotesColumnVisibility.isColumnVisible('type') && <TableHead>Type</TableHead>}
                      {quotesColumnVisibility.isColumnVisible('total_amount') && <TableHead>Amount</TableHead>}
                      {quotesColumnVisibility.isColumnVisible('status') && <TableHead>Status</TableHead>}
                      {quotesColumnVisibility.isColumnVisible('valid_until') && <TableHead>Valid Until</TableHead>}
                      {quotesColumnVisibility.isColumnVisible('created_by') && <TableHead>Created By</TableHead>}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.length > 0 ? (
                      filteredQuotes.map((quote) => (
                        <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewQuote(quote)}>
                          {quotesColumnVisibility.isColumnVisible('quote_number') && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{quote.formatted_number || quote.quote_number || `Q-${quote.id}`}</span>
                              </div>
                            </TableCell>
                          )}
                          {quotesColumnVisibility.isColumnVisible('customer') && (
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {quote.customer_name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{quote.customer_name}</div>
                                  {quote.company_name && (
                                    <div className="text-sm text-muted-foreground">{quote.company_name}</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          )}
                          {quotesColumnVisibility.isColumnVisible('type') && (
                            <TableCell>
                              {(() => {
                                const Icon = getTemplateIcon(quote.quote_type || 'custom')
                                return (
                                  <div className="flex items-center gap-2">
                                    <Icon className={`h-4 w-4 ${getTemplateColor(quote.quote_type || 'custom')}`} />
                                    <span className="text-sm">{quote.quote_type || 'custom'}</span>
                                  </div>
                                )
                              })()}
                            </TableCell>
                          )}
                          {quotesColumnVisibility.isColumnVisible('total_amount') && (
                            <TableCell className="font-medium">
                              {formatCurrency(quote.total_amount)}
                            </TableCell>
                          )}
                          {quotesColumnVisibility.isColumnVisible('status') && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Select 
                                value={quote.status} 
                                onValueChange={(value) => handleStatusChange(quote.id, value)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {QUOTE_STATUSES.map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                      {status.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          {quotesColumnVisibility.isColumnVisible('valid_until') && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className={isOverdue(quote.valid_until) ? 'text-red-600' : ''}>
                                  {formatDate(quote.valid_until)}
                                </span>
                                {isOverdue(quote.valid_until) && (
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                            </TableCell>
                          )}
                          {quotesColumnVisibility.isColumnVisible('created_by') && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{quote.created_by_name}</span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditQuote(quote)
                                }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Quote
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownloadPDF(quote.id)
                                }}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleDuplicateQuote(quote)
                                }}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteQuote(quote.id)
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                            <div className="text-sm text-muted-foreground">No quotes found</div>
                            <Button variant="outline" size="sm" onClick={handleCreateQuote}>
                              <Plus className="h-4 w-4 mr-2" />
                              Create First Quote
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  itemName="quotes"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Quote Templates</CardTitle>
                    <CardDescription>
                      Use templates to quickly create quotes for common scenarios
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setIsTemplateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => {
                    const Icon = getTemplateIcon(template.template_type)
                    return (
                      <Card key={template.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-blue-50 dark:bg-blue-950`}>
                                <Icon className={`h-5 w-5 ${getTemplateColor(template.template_type)}`} />
                              </div>
                              <div>
                                <CardTitle className="text-base">{template.template_name}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {template.items_count || 0} items
                                </CardDescription>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            {template.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={() => handleCreateFromTemplate(template)}
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              Use Template
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {/* TODO: Edit template */}}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Quote Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {QUOTE_STATUSES.map((status) => {
                      const count = quotes.filter(q => q.status === status.value).length
                      const percentage = quotes.length > 0 ? (count / quotes.length) * 100 : 0
                      const Icon = status.icon
                      
                      return (
                        <div key={status.value} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{status.label}</span>
                            </div>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quote Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {TEMPLATE_TYPES.map((type) => {
                      const count = quotes.filter(q => q.quote_type === type.value).length
                      const totalValue = quotes
                        .filter(q => q.quote_type === type.value)
                        .reduce((sum, q) => sum + q.total_amount, 0)
                      const Icon = type.icon
                      
                      return (
                        <div key={type.value} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon className={`h-5 w-5 ${type.color}`} />
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-sm text-muted-foreground">{count} quotes</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{formatCurrency(totalValue)}</div>
                            <div className="text-xs text-muted-foreground">Total value</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </MainLayout>

      {/* Create Quote Wizard Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) {
            resetWizard()
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingQuoteId ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
              <DialogDescription>
                Step {wizardStep + 1} of 4: {['Customer', 'Items', 'Details', 'Review'][wizardStep]}
              </DialogDescription>
            </DialogHeader>

            {/* Progress Indicator */}
            <div className="flex items-center justify-between mb-6">
              {['Customer', 'Items', 'Details', 'Review'].map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    index === wizardStep 
                      ? 'border-blue-600 bg-blue-600 text-white' 
                      : index < wizardStep 
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 text-gray-400'
                  }`}>
                    {index < wizardStep ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={`ml-2 text-sm ${index === wizardStep ? 'font-medium' : 'text-muted-foreground'}`}>
                    {step}
                  </span>
                  {index < 3 && (
                    <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>

            {/* Wizard Content */}
            <div className="flex-1 min-h-[500px] overflow-y-auto">
              {renderWizardStep()}
            </div>

            {/* Wizard Navigation */}
            <div className="flex items-center justify-between pt-6 border-t mt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={wizardStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              <div className="text-sm text-muted-foreground">
                Step {wizardStep + 1} of 4
              </div>

              {wizardStep < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid(wizardStep)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitQuote}
                  disabled={isLoading}
                >
                  {isLoading 
                    ? (editingQuoteId ? 'Updating...' : 'Creating...') 
                    : (editingQuoteId ? 'Update Quote' : 'Create Quote')
                  }
                  <CheckCircle className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Catalog Browser Dialog */}
        <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add Items from Catalog</DialogTitle>
              <DialogDescription>
                Browse and add machines, parts, or services to your quote
              </DialogDescription>
            </DialogHeader>

            <Tabs value={catalogTab} onValueChange={(value: any) => {
              setCatalogTab(value)
              if (value === 'machines') fetchCatalogMachines()
              else if (value === 'parts') fetchCatalogParts()
              else if (value === 'services') fetchCatalogServices()
            }}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="machines">
                  <Wrench className="h-4 w-4 mr-2" />
                  Machines
                </TabsTrigger>
                <TabsTrigger value="parts">
                  <Package className="h-4 w-4 mr-2" />
                  Parts
                </TabsTrigger>
                <TabsTrigger value="services">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Services
                </TabsTrigger>
              </TabsList>

              {/* Search */}
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search catalog..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Machines Catalog */}
              <TabsContent value="machines" className="max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                  {catalogMachines.map((machine) => (
                    <Card key={machine.id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{machine.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {machine.manufacturer} {machine.catalogue_number && `• ${machine.catalogue_number}`}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {machine.category_name && (
                                <Badge variant="outline" className="text-xs">{machine.category_name}</Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {machine.available_serials} available
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            {machine.avg_sale_price && (
                              <div className="text-sm font-medium mb-2">
                                Avg: {formatCurrency(machine.avg_sale_price)}
                              </div>
                            )}
                            <Button 
                              size="sm"
                              onClick={() => {
                                handleAddFromCatalog(machine, 'machine')
                                setIsCatalogDialogOpen(false)
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Parts Catalog */}
              <TabsContent value="parts" className="max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                  {catalogParts.map((part) => (
                    <Card key={part.id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{part.name}</div>
                            {part.description && (
                              <div className="text-sm text-muted-foreground">{part.description}</div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {part.category && (
                                <Badge variant="outline" className="text-xs">{part.category}</Badge>
                              )}
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${
                                  part.stock_status === 'in_stock' ? 'bg-green-100 text-green-800' :
                                  part.stock_status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}
                              >
                                {part.quantity} in stock
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium mb-2">
                              {formatCurrency(part.unit_price)}
                            </div>
                            <Button 
                              size="sm"
                              onClick={() => {
                                handleAddFromCatalog(part, 'part')
                                setIsCatalogDialogOpen(false)
                              }}
                              disabled={part.stock_status === 'out_of_stock'}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Services Catalog */}
              <TabsContent value="services" className="max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                  {catalogServices.map((service) => (
                    <Card key={service.id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{service.name}</div>
                            <div className="text-sm text-muted-foreground">{service.description}</div>
                            <Badge variant="outline" className="text-xs mt-2">{service.category}</Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium mb-2">
                              {formatCurrency(service.default_price)}
                            </div>
                            <Button 
                              size="sm"
                              onClick={() => {
                                handleAddFromCatalog(service, 'service')
                                setIsCatalogDialogOpen(false)
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* View Quote Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Quote #{selectedQuote?.formatted_number || selectedQuote?.quote_number || selectedQuote?.id}
              </DialogTitle>
              <DialogDescription>
                View and manage quote details
              </DialogDescription>
            </DialogHeader>

            {selectedQuote && (
              <div className="space-y-6">
                {/* Status and Actions Bar */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-4">
                    {getStatusBadge(selectedQuote.status)}
                    {isOverdue(selectedQuote.valid_until) && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Expired
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setIsViewDialogOpen(false)
                        handleEditQuote(selectedQuote)
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(selectedQuote.id)}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicateQuote(selectedQuote)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </Button>
                  </div>
                </div>

                {/* Customer & Quote Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Customer Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedQuote.customer_name}</span>
                      </div>
                      {selectedQuote.company_name && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedQuote.company_name}</span>
                        </div>
                      )}
                      {selectedQuote.email && (
                        <div className="text-sm text-muted-foreground">Email: {selectedQuote.email}</div>
                      )}
                      {selectedQuote.phone && (
                        <div className="text-sm text-muted-foreground">Phone: {selectedQuote.phone}</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Quote Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quote #:</span>
                        <span className="font-medium">{selectedQuote.formatted_number || selectedQuote.quote_number || `Q-${selectedQuote.id}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span>{formatDate(selectedQuote.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid Until:</span>
                        <span className={isOverdue(selectedQuote.valid_until) ? 'text-red-600' : ''}>
                          {formatDate(selectedQuote.valid_until)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created By:</span>
                        <span>{selectedQuote.created_by_name}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quote Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quote Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedQuoteItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.item_name}</div>
                                {item.description && (
                                  <div className="text-sm text-muted-foreground">{item.description}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.category && <Badge variant="outline">{item.category}</Badge>}
                            </TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.total_price)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Totals */}
                <Card className="bg-blue-50 dark:bg-blue-950">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">{formatCurrency(selectedQuote.subtotal || 0)}</span>
                    </div>
                    {selectedQuote.discount_amount && selectedQuote.discount_amount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({Number(selectedQuote.discount_percentage || 0).toFixed(2)}%):</span>
                        <span className="font-medium">-{formatCurrency(selectedQuote.discount_amount)}</span>
                      </div>
                    )}
                    {selectedQuote.tax_amount && selectedQuote.tax_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({Number(selectedQuote.tax_rate || 0).toFixed(2)}%):</span>
                        <span className="font-medium">{formatCurrency(selectedQuote.tax_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold border-t pt-3">
                      <span>Total Amount:</span>
                      <span className="text-blue-600">{formatCurrency(selectedQuote.total_amount)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes and Terms */}
                {selectedQuote.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{selectedQuote.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedQuote.terms_conditions && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Terms & Conditions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{selectedQuote.terms_conditions}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
    </>
  )
}

