import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Label } from '../components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  Building,
  Building2,
  Euro,
  Clock,
  Award,
  Shield,
  Activity,
  TrendingDown,
  MapPin,
  Printer,
  Calendar,
  User,
  Wrench,
  BarChart3,
  ShoppingCart,
  AlertCircle,
  Phone,
  Mail,
  Package,
  Settings,
  MessageSquare
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import apiService from '../services/api'
import { API_ROOT } from '../config/api'
import { useAuth } from '../contexts/auth-context'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { DeleteConfirmationDialog } from '../components/ui/delete-confirmation-dialog'
import { CompletedItemAlertDialog } from '../components/ui/completed-item-alert-dialog'
import { formatDate } from '../lib/dateTime'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'

interface RepairTicket {
  id: string
  ticket_number?: string
  formatted_number?: string
  year_created?: number
  customer_id: string
  customer_name: string
  customer_type?: 'private' | 'company'
  contact_person?: string
  company_name?: string
  vat_number?: string
  city?: string
  postal_code?: string
  street_address?: string
  phone1?: string
  phone2?: string
  fax?: string
  email?: string
  owner_id?: number
  owner_name?: string
  ownership_notes?: string
  assigned_at?: string
  machine_id: string
  manufacturer?: string
  bought_at?: string
  category_id?: string
  category_name?: string
  model_name?: string
  catalogue_number?: string
  serial_number?: string
  receipt_number?: string
  purchase_date?: string
  warranty_expiry_date?: string
  problem_description: string
  notes?: string
  additional_equipment?: string
  brought_by?: string
  submitted_by: string
  submitted_by_name?: string
  status: string
  converted_to_work_order_id?: string
  converted_work_order_formatted_number?: string
  converted_work_order_year_created?: number
  converted_by_technician_id?: string
  converted_by_technician_name?: string
  converted_at?: string
  created_at: string
  updated_at: string
  sales_opportunity?: boolean
  sales_notes?: string
  potential_value?: number
  sales_user_id?: string
  lead_quality?: string
}

export default function RepairTicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [repairTicket, setRepairTicket] = useState<RepairTicket | null>(null)
  
  // Convert to work order state
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [users, setUsers] = useState<any[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [convertedAlertOpen, setConvertedAlertOpen] = useState(false)

  useEffect(() => {
    if (id) {
      fetchRepairTicketDetails()
    }
  }, [id])

  const fetchRepairTicketDetails = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch repair ticket details
      const response = await apiService.getRepairTicket(id!) as any
      setRepairTicket(response.data)
    } catch (err) {
      setError('Failed to load repair ticket details.')
      console.error('Error fetching repair ticket details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConvertToWorkOrder = async () => {
    if (!repairTicket) return

    // Auto-assign if user is a technician
    if (user?.role === 'technician') {
      setIsConverting(true)
      try {
        const convertData = {
          technician_id: user.id,
          priority: repairTicket.priority || 'medium',
          estimated_hours: null,
          notes: `Converted from repair ticket ${repairTicket.formatted_number || repairTicket.ticket_number}`
        }

        const response = await apiService.convertRepairTicketToWorkOrder(repairTicket.id, convertData)
        
        toast.success('Repair ticket converted and assigned to you')
        
        // Navigate to the created work order if available
        if (response.data?.work_order?.id) {
          navigate(`/work-orders/${response.data.work_order.id}`)
        } else {
          await fetchRepairTicketDetails()
        }
      } catch (err: any) {
        console.error('Error converting ticket:', err)
        toast.error(err.response?.data?.message || 'Failed to convert ticket to work order')
      } finally {
        setIsConverting(false)
      }
    } else {
      // Show dialog for admin/manager to assign technician
      setConvertModalOpen(true)
      
      // Fetch users for technician selection
      try {
        const response = await apiService.getUsers()
        const usersData = response.data || response
        setUsers(Array.isArray(usersData) ? usersData : [])
      } catch (err) {
        console.error('Error fetching users:', err)
        toast.error('Failed to load users')
      }
    }
  }

  const handleConvertSubmit = async () => {
    if (!repairTicket) return

    setIsConverting(true)
    try {
      const convertData = {
        technician_id: selectedTechnician === 'unassigned' ? null : selectedTechnician || null,
        priority: repairTicket.priority || 'medium',
        estimated_hours: null,
        notes: `Converted from repair ticket ${repairTicket.formatted_number || repairTicket.ticket_number}`
      }

      const response = await apiService.convertRepairTicketToWorkOrder(repairTicket.id, convertData)
      
      toast.success('Repair ticket converted to work order successfully')
      setConvertModalOpen(false)
      setSelectedTechnician('')
      
      // Refresh repair ticket details
      await fetchRepairTicketDetails()
      
      // Navigate to the created work order if available
      if (response.data?.work_order?.id) {
        navigate(`/work-orders/${response.data.work_order.id}`)
      }
    } catch (err: any) {
      console.error('Error converting ticket:', err)
      toast.error(err.response?.data?.message || 'Failed to convert ticket to work order')
    } finally {
      setIsConverting(false)
    }
  }

  const handleDeleteTicket = () => {
    if (!repairTicket) return

    // Check if ticket is converted
    if (repairTicket.status === 'converted' || repairTicket.status === 'converted - warranty') {
      setConvertedAlertOpen(true)
      return
    }

    setDeleteDialogOpen(true)
  }

  const handlePrint = async () => {
    try {
            const response = await fetch(`${API_ROOT}/api/print/repair-ticket/${repairTicket.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

            
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error(`Failed to generate PDF: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF: ' + error.message)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`${API_ROOT}/api/print/repair-ticket/${repairTicket.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `repair-ticket-${repairTicket.formatted_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast.error('Failed to download PDF')
    }
  }

  const confirmDeleteTicket = async () => {
    if (!repairTicket) return

    try {
      await apiService.deleteRepairTicket(repairTicket.id)
      toast.success('Repair ticket deleted successfully')
      setDeleteDialogOpen(false)
      navigate('/repair-tickets') // Navigate back to list
    } catch (err: any) {
      console.error('Error deleting ticket:', err)
      toast.error(err.response?.data?.message || 'Failed to delete repair ticket')
    }
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { color: 'outline' as const, className: 'bg-green-50 text-green-700 border-green-200', label: 'Low' },
      medium: { color: 'outline' as const, className: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Medium' },
      high: { color: 'outline' as const, className: 'bg-red-50 text-red-700 border-red-200', label: 'High' }
    }
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
    
    return (
      <Badge variant={config.color} className={config.className}>
        {config.label}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      intake: Clock,
      converted: CheckCircle,
      'converted - warranty': Award,
      cancelled: XCircle,
    }
    
    const Icon = statusIcons[status] || Clock
    
    return (
      <Badge 
        variant={getStatusBadgeVariant(status)} 
        className={`flex items-center gap-1 ${getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : ''}`}
      >
        <Icon className="h-3 w-3" />
        {formatStatus(status)}
      </Badge>
    )
  }

  const getLeadQualityBadge = (quality?: string) => {
    if (!quality || quality === 'unknown') return null
    
    const qualityConfig = {
      cold: { color: 'outline' as const, label: 'Cold Lead' },
      warm: { color: 'default' as const, label: 'Warm Lead' },
      hot: { color: 'destructive' as const, label: 'Hot Lead' },
    }
    
    const config = qualityConfig[quality as keyof typeof qualityConfig]
    if (!config) return null
    
    return (
      <Badge variant={config.color}>
        {config.label}
      </Badge>
    )
  }


  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A'
    return `€${amount.toFixed(2)}`
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading repair ticket details...</span>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </MainLayout>
    )
  }

  if (!repairTicket) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Repair ticket not found.</AlertDescription>
        </Alert>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {repairTicket.formatted_number || `Ticket #${repairTicket.id}`}
              </h1>
              <div className="text-muted-foreground flex items-center gap-2">
                <span>{repairTicket.customer_name}</span>
                <span>•</span>
                {getStatusBadge(repairTicket.status)}
                {getPriorityBadge(repairTicket.priority)}
                {getLeadQualityBadge(repairTicket.lead_quality)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.role !== 'sales' && (
              <Button
                variant="outline"
                onClick={() => navigate(`/repair-tickets/${id}`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
            >
              <FileText className="h-4 w-4" />
            </Button>
            {repairTicket.status === 'intake' && user?.role !== 'sales' && (
              <Button variant="default" onClick={handleConvertToWorkOrder}>
                <Wrench className="mr-2 h-4 w-4" />
                Convert to Work Order
              </Button>
            )}
            {user?.role !== 'sales' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteTicket}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getStatusBadge(repairTicket.status)}</div>
              <p className="text-xs text-muted-foreground">Current status</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Priority</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getPriorityBadge(repairTicket.priority)}</div>
              <p className="text-xs text-muted-foreground">Priority level</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Created</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDate(repairTicket.created_at)}</div>
              <p className="text-xs text-muted-foreground">Date submitted</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted By</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{repairTicket.submitted_by_name || 'Unknown'}</div>
              <p className="text-xs text-muted-foreground">Staff member</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Ticket Details</TabsTrigger>
            <TabsTrigger value="customer">Customer Info</TabsTrigger>
            <TabsTrigger value="machine">Machine Info</TabsTrigger>
            <TabsTrigger value="conversion">Conversion</TabsTrigger>
          </TabsList>

          {/* Ticket Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Problem Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Problem Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Problem Description</p>
                    <p className="text-sm mt-1">{repairTicket.problem_description}</p>
                  </div>
                  {repairTicket.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p className="text-sm mt-1">{repairTicket.notes}</p>
                    </div>
                  )}
                  {repairTicket.additional_equipment && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Additional Equipment</p>
                      <p className="text-sm mt-1">{repairTicket.additional_equipment}</p>
                    </div>
                  )}
                  {repairTicket.brought_by && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Brought By</p>
                      <p className="text-sm mt-1">{repairTicket.brought_by}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ticket Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Ticket Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Ticket Number</p>
                      <p className="text-sm font-bold">{repairTicket.formatted_number || repairTicket.ticket_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Year Created</p>
                      <p className="text-sm">{repairTicket.year_created || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <div className="text-sm">{getStatusBadge(repairTicket.status)}</div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Priority</p>
                      <div className="text-sm">{getPriorityBadge(repairTicket.priority)}</div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Created</p>
                      <p className="text-sm">{formatDate(repairTicket.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                      <p className="text-sm">{formatDate(repairTicket.updated_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Customer Info Tab */}
          <TabsContent value="customer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {repairTicket.customer_type === 'company' ? (
                    <Building2 className="h-5 w-5" />
                  ) : (
                    <Building className="h-5 w-5" />
                  )}
                  Customer Information
                  {repairTicket.customer_type && (
                    <Badge 
                      variant={repairTicket.customer_type === 'company' ? 'default' : 'secondary'} 
                      className="text-xs"
                    >
                      {repairTicket.customer_type === 'company' ? 'Company' : 'Private'}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {repairTicket.customer_type === 'company' ? (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                        <p className="text-sm font-bold">{repairTicket.company_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Contact Person</p>
                        <p className="text-sm">{repairTicket.contact_person || 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                        <p className="text-sm font-bold">{repairTicket.customer_name}</p>
                      </div>
                      {repairTicket.company_name && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Company</p>
                          <p className="text-sm">{repairTicket.company_name}</p>
                        </div>
                      )}
                    </>
                  )}
                  {repairTicket.customer_type === 'company' && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">VAT Number</p>
                      <p className="text-sm">{repairTicket.vat_number || 'N/A'}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <p className="text-sm">{repairTicket.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <p className="text-sm">{repairTicket.phone1 || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone 2</p>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <p className="text-sm">{repairTicket.phone2 || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <p className="text-sm">
                        {repairTicket.street_address && repairTicket.city && repairTicket.postal_code
                          ? `${repairTicket.street_address}, ${repairTicket.postal_code} ${repairTicket.city}`
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fax</p>
                    <div className="flex items-center gap-1">
                      <Printer className="h-3 w-3" />
                      <p className="text-sm">{repairTicket.fax || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/customers/${repairTicket.customer_id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Customer Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Machine Info Tab */}
          <TabsContent value="machine" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Machine Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
                    <p className="text-sm font-bold">{repairTicket.manufacturer || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Model</p>
                    <p className="text-sm font-bold">{repairTicket.model_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
                    <p className="text-sm">{repairTicket.serial_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Catalogue Number</p>
                    <p className="text-sm">{repairTicket.catalogue_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Category</p>
                    <p className="text-sm">{repairTicket.category_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Purchase Date</p>
                    <p className="text-sm">{formatDate(repairTicket.purchase_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Warranty Expiry</p>
                    <p className="text-sm">{formatDate(repairTicket.warranty_expiry_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Receipt Number</p>
                    <p className="text-sm">{repairTicket.receipt_number || 'N/A'}</p>
                  </div>
                </div>
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/machines/${repairTicket.machine_id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Machine Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversion Tab */}
          <TabsContent value="conversion" className="space-y-4">
            <div className="grid gap-4">
              {/* Conversion Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Conversion Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Converted At</p>
                      <p className="text-sm">{formatDate(repairTicket.converted_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Converted By</p>
                      <p className="text-sm">{repairTicket.converted_by_technician_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Work Order ID</p>
                      <p className="text-sm">{repairTicket.converted_to_work_order_id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Work Order Number</p>
                      <p className="text-sm">{repairTicket.converted_work_order_formatted_number || 'N/A'}</p>
                    </div>
                  </div>
                  {repairTicket.converted_to_work_order_id && (
                    <div className="pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => navigate(`/work-orders/${repairTicket.converted_to_work_order_id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Work Order
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Convert to Work Order Modal */}
      <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Convert to Work Order</DialogTitle>
            <DialogDescription>
              Please select a technician to assign to this work order or leave unassigned.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="technician">Technician</Label>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger>
                  <SelectValue placeholder="Select technician (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No technician assigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvertSubmit} disabled={isConverting}>
              {isConverting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                'Convert to Work Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteTicket}
        title="Delete Repair Ticket"
        itemName={repairTicket?.formatted_number || repairTicket?.ticket_number || `#${repairTicket?.id}`}
        itemType="repair ticket"
      />

      {/* Converted Ticket Alert Dialog */}
      <CompletedItemAlertDialog
        open={convertedAlertOpen}
        onOpenChange={setConvertedAlertOpen}
        itemName={repairTicket?.formatted_number || repairTicket?.ticket_number || `#${repairTicket?.id}`}
        itemType="repair ticket"
        title="Cannot Delete Converted Repair Ticket"
        description="This repair ticket has been converted to a work order and cannot be deleted. Please contact your administrator if you need to remove this ticket."
      />
    </MainLayout>
  )
}
