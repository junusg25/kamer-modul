import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar,
  Printer,
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
import { apiService } from '@/services/api'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import { CompletedItemAlertDialog } from '@/components/ui/completed-item-alert-dialog'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'
import { formatDate } from '@/lib/dateTime'

interface WarrantyRepairTicket {
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
  priority?: string
  converted_to_warranty_work_order_id?: string
  converted_work_order_formatted_number?: string
  converted_work_order_year_created?: number
  converted_by_technician_id?: string
  converted_by_technician_name?: string
  converted_at?: string
  created_at: string
  updated_at: string
  sales_opportunity?: boolean
  sales_notes?: string
  potential_value?: number | string
  sales_user_id?: string
  lead_quality?: string
}

export default function WarrantyRepairTicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [warrantyRepairTicket, setWarrantyRepairTicket] = useState<WarrantyRepairTicket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Convert to work order state
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [users, setUsers] = useState<any[]>([])
  const [isConverting, setIsConverting] = useState(false)

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [convertedAlertOpen, setConvertedAlertOpen] = useState(false)

  useEffect(() => {
    if (id) {
      fetchWarrantyRepairTicketDetails()
      fetchUsers()
    }
  }, [id])

  const fetchWarrantyRepairTicketDetails = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch warranty repair ticket details
      const response = await apiService.getWarrantyRepairTicket(id!) as any
      setWarrantyRepairTicket(response.data)
    } catch (err) {
      setError('Failed to load warranty repair ticket details.')
      console.error('Error fetching warranty repair ticket details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await apiService.getUsers()
      setUsers(response.data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const handleConvertToWorkOrder = () => {
    setConvertModalOpen(true)
  }

  const handleConvertSubmit = async () => {
    if (!warrantyRepairTicket || !selectedTechnician) return

    try {
      setIsConverting(true)
      await apiService.convertWarrantyRepairTicketToWorkOrder(warrantyRepairTicket.id, {
        technician_id: selectedTechnician,
        priority: warrantyRepairTicket.priority || 'medium'
      })
      
      toast.success('Warranty repair ticket converted to work order successfully')
      setConvertModalOpen(false)
      setSelectedTechnician('')
      fetchWarrantyRepairTicketDetails()
    } catch (err: any) {
      console.error('Error converting ticket:', err)
      toast.error(err.response?.data?.message || 'Failed to convert warranty repair ticket')
    } finally {
      setIsConverting(false)
    }
  }

  const handleDeleteTicket = () => {
    if (warrantyRepairTicket?.status === 'converted' || warrantyRepairTicket?.status === 'converted - warranty') {
      setConvertedAlertOpen(true)
    } else {
      setDeleteDialogOpen(true)
    }
  }

  const handlePrint = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/warranty-ticket/${warrantyRepairTicket.id}`, {
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
      window.open(url, '_blank')
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF')
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/warranty-ticket/${warrantyRepairTicket.id}`, {
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
      link.download = `warranty-ticket-${warrantyRepairTicket.formatted_number}.pdf`
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
    if (!warrantyRepairTicket) return

    try {
      await apiService.deleteWarrantyRepairTicket(warrantyRepairTicket.id)
      toast.success('Warranty repair ticket deleted successfully')
      setDeleteDialogOpen(false)
      navigate('/warranty-repair-tickets')
    } catch (err: any) {
      console.error('Error deleting ticket:', err)
      toast.error(err.response?.data?.message || 'Failed to delete warranty repair ticket')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      intake: Clock,
      converted: CheckCircle,
      'converted - warranty': CheckCircle,
      cancelled: AlertCircle,
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

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Medium</Badge>
    
    const priorityConfig = {
      low: { color: 'bg-green-50 text-green-700 border-green-200', label: 'Low' },
      medium: { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Medium' },
      high: { color: 'bg-red-50 text-red-700 border-red-200', label: 'High' },
    }
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
    
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
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


  const formatCurrency = (amount?: number | string) => {
    if (!amount) return 'N/A'
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(numAmount)) return 'N/A'
    return `€${numAmount.toFixed(2)}`
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading warranty repair ticket details...</span>
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

  if (!warrantyRepairTicket) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Warranty repair ticket not found.</AlertDescription>
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
                {warrantyRepairTicket.formatted_number || `Warranty Ticket #${warrantyRepairTicket.id}`}
              </h1>
              <div className="text-muted-foreground flex items-center gap-2">
                <span>{warrantyRepairTicket.customer_name}</span>
                <span>•</span>
                {getStatusBadge(warrantyRepairTicket.status)}
                {getLeadQualityBadge(warrantyRepairTicket.lead_quality)}
                <Badge variant="outline" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Warranty
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => console.log('Edit Warranty Repair Ticket')}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
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
            <Button 
              onClick={handleConvertToWorkOrder}
              disabled={warrantyRepairTicket.status === 'converted' || warrantyRepairTicket.status === 'cancelled'}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Convert to Work Order
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteTicket}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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
              <div className="text-2xl font-bold">{getStatusBadge(warrantyRepairTicket.status)}</div>
              <p className="text-xs text-muted-foreground">Current status</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Priority</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getPriorityBadge(warrantyRepairTicket.priority)}</div>
              <p className="text-xs text-muted-foreground">Ticket priority</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Created</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDate(warrantyRepairTicket.created_at)}</div>
              <p className="text-xs text-muted-foreground">Date submitted</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted By</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warrantyRepairTicket.submitted_by_name || 'Unknown'}</div>
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
                    <p className="text-sm mt-1">{warrantyRepairTicket.problem_description}</p>
                  </div>
                  {warrantyRepairTicket.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p className="text-sm mt-1">{warrantyRepairTicket.notes}</p>
                    </div>
                  )}
                  {warrantyRepairTicket.additional_equipment && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Additional Equipment</p>
                      <p className="text-sm mt-1">{warrantyRepairTicket.additional_equipment}</p>
                    </div>
                  )}
                  {warrantyRepairTicket.brought_by && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Brought By</p>
                      <p className="text-sm mt-1">{warrantyRepairTicket.brought_by}</p>
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
                      <p className="text-sm font-bold">{warrantyRepairTicket.formatted_number || warrantyRepairTicket.ticket_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Year Created</p>
                      <p className="text-sm">{warrantyRepairTicket.year_created || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <div className="text-sm">{getStatusBadge(warrantyRepairTicket.status)}</div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Priority</p>
                      <div className="text-sm">{getPriorityBadge(warrantyRepairTicket.priority)}</div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Created</p>
                      <p className="text-sm">{formatDate(warrantyRepairTicket.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                      <p className="text-sm">{formatDate(warrantyRepairTicket.updated_at)}</p>
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
                  {warrantyRepairTicket.customer_type === 'company' ? (
                    <Building2 className="h-5 w-5" />
                  ) : (
                    <Building className="h-5 w-5" />
                  )}
                  Customer Information
                  {warrantyRepairTicket.customer_type && (
                    <Badge 
                      variant={warrantyRepairTicket.customer_type === 'company' ? 'default' : 'secondary'} 
                      className="text-xs"
                    >
                      {warrantyRepairTicket.customer_type === 'company' ? 'Company' : 'Private'}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {warrantyRepairTicket.customer_type === 'company' ? (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                        <p className="text-sm font-bold">{warrantyRepairTicket.company_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Contact Person</p>
                        <p className="text-sm">{warrantyRepairTicket.contact_person || 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                        <p className="text-sm font-bold">{warrantyRepairTicket.customer_name}</p>
                      </div>
                      {warrantyRepairTicket.company_name && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Company</p>
                          <p className="text-sm">{warrantyRepairTicket.company_name}</p>
                        </div>
                      )}
                    </>
                  )}
                  {warrantyRepairTicket.customer_type === 'company' && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">VAT Number</p>
                      <p className="text-sm">{warrantyRepairTicket.vat_number || 'N/A'}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <p className="text-sm">{warrantyRepairTicket.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <p className="text-sm">{warrantyRepairTicket.phone1 || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone 2</p>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <p className="text-sm">{warrantyRepairTicket.phone2 || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <p className="text-sm">
                        {warrantyRepairTicket.street_address && warrantyRepairTicket.city && warrantyRepairTicket.postal_code
                          ? `${warrantyRepairTicket.street_address}, ${warrantyRepairTicket.postal_code} ${warrantyRepairTicket.city}`
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fax</p>
                    <div className="flex items-center gap-1">
                      <Printer className="h-3 w-3" />
                      <p className="text-sm">{warrantyRepairTicket.fax || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/customers/${warrantyRepairTicket.customer_id}`)}
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
                    <p className="text-sm font-bold">{warrantyRepairTicket.manufacturer || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Model</p>
                    <p className="text-sm font-bold">{warrantyRepairTicket.model_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
                    <p className="text-sm">{warrantyRepairTicket.serial_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Catalogue Number</p>
                    <p className="text-sm">{warrantyRepairTicket.catalogue_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Category</p>
                    <p className="text-sm">{warrantyRepairTicket.category_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Purchase Date</p>
                    <p className="text-sm">{formatDate(warrantyRepairTicket.purchase_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Warranty Expiry</p>
                    <p className="text-sm">{formatDate(warrantyRepairTicket.warranty_expiry_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Receipt Number</p>
                    <p className="text-sm">{warrantyRepairTicket.receipt_number || 'N/A'}</p>
                  </div>
                </div>
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/machines/${warrantyRepairTicket.machine_id}`)}
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
                      <p className="text-sm">{formatDate(warrantyRepairTicket.converted_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Converted By</p>
                      <p className="text-sm">{warrantyRepairTicket.converted_by_technician_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Warranty Work Order ID</p>
                      <p className="text-sm">{warrantyRepairTicket.converted_to_warranty_work_order_id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Work Order Number</p>
                      <p className="text-sm">{warrantyRepairTicket.converted_work_order_formatted_number || 'N/A'}</p>
                    </div>
                  </div>
                  {warrantyRepairTicket.converted_to_warranty_work_order_id && (
                    <div className="pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => navigate(`/warranty-work-orders/${warrantyRepairTicket.converted_to_warranty_work_order_id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Warranty Work Order
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>

        {/* Convert to Work Order Modal */}
        <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convert to Warranty Work Order</DialogTitle>
              <DialogDescription>
                Convert warranty repair ticket {warrantyRepairTicket?.formatted_number} to a warranty work order.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="technician">Assign Technician</Label>
                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
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
              <Button 
                onClick={handleConvertSubmit} 
                disabled={!selectedTechnician || isConverting}
              >
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
          title="Delete Warranty Repair Ticket"
          description={`Are you sure you want to delete warranty repair ticket ${warrantyRepairTicket?.formatted_number}? This action cannot be undone.`}
        />

        {/* Converted Ticket Alert Dialog */}
        <CompletedItemAlertDialog
          open={convertedAlertOpen}
          onOpenChange={setConvertedAlertOpen}
          title="Cannot Delete Converted Ticket"
          description={`Warranty repair ticket ${warrantyRepairTicket?.formatted_number} has been converted to a work order and cannot be deleted.`}
        />
      </div>
    </MainLayout>
  )
}
