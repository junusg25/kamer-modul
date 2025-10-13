import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '../components/ui/card'
import { 
  Button 
} from '../components/ui/button'
import { 
  Badge 
} from '../components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '../components/ui/dialog'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '../components/ui/dropdown-menu'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select'
import { 
  Input 
} from '../components/ui/input'
import { SmartSearch } from '../components/ui/smart-search'
import { 
  Label 
} from '../components/ui/label'
import { 
  Textarea 
} from '../components/ui/textarea'
import { 
  DatePicker 
} from '../components/ui/date-picker'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/tabs'
import { 
  MoreHorizontal, 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Calendar, 
  Phone, 
  Mail, 
  Building, 
  DollarSign,
  Filter,
  RefreshCw,
  Eye,
  Users,
  TrendingUp,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { apiService } from '../services/api'
import { useAuth } from '../contexts/auth-context'
import { DeleteConfirmationDialog } from '../components/ui/delete-confirmation-dialog'
import { Pagination } from '../components/ui/pagination'
import { MainLayout } from '../components/layout/main-layout'
import { formatCurrency } from '../lib/currency'
import { formatDate, formatDateTime, isOverdue } from '../lib/dateTime'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'

// Types
interface Lead {
  id: number
  customer_name: string
  company_name?: string
  email?: string
  phone?: string
  potential_value: number
  lead_quality: 'high' | 'medium' | 'low'
  sales_stage: string
  assigned_to?: number
  assigned_to_name?: string
  created_by_name?: string
  next_follow_up?: string
  sales_notes?: string
  created_at: string
  source?: string
  pipeline_position?: number
}

interface FollowUp {
  id: number
  lead_id: number
  follow_up_date: string
  follow_up_type: string
  notes: string
  created_by_name: string
  created_at: string
  completed: boolean
}

interface LeadFormData {
  customer_name: string
  company_name: string
  email: string
  phone: string
  potential_value: string
  lead_quality: 'high' | 'medium' | 'low'
  sales_stage: string
  assigned_to: string
  next_follow_up: string
  sales_notes: string
  source: string
}

// Constants
const SALES_STAGES = [
  { value: 'new', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' }
]

const PIPELINE_STAGES = [
  { id: 'new', name: 'New', color: '#3b82f6', description: 'Fresh leads that need initial contact' },
  { id: 'contacted', name: 'Contacted', color: '#8b5cf6', description: 'Initial contact has been made' },
  { id: 'qualified', name: 'Qualified', color: '#f59e0b', description: 'Leads that meet qualification criteria' },
  { id: 'proposal', name: 'Proposal', color: '#ef4444', description: 'Proposal has been sent' },
  { id: 'negotiation', name: 'Negotiation', color: '#ec4899', description: 'Active negotiations in progress' },
  { id: 'won', name: 'Won', color: '#10b981', description: 'Successfully closed deals' },
  { id: 'lost', name: 'Lost', color: '#6b7280', description: 'Lost opportunities' }
]

const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Cold Call',
  'Trade Show',
  'Social Media',
  'Email Campaign',
  'Advertisement',
  'Other'
]

// Define columns for Leads table
const LEAD_COLUMNS = defineColumns([
  { key: 'customer', label: 'Customer' },
  { key: 'company', label: 'Company' },
  { key: 'contact', label: 'Contact' },
  { key: 'value', label: 'Potential Value' },
  { key: 'quality', label: 'Quality' },
  { key: 'stage', label: 'Stage' },
  { key: 'assigned_to', label: 'Assigned To' },
  { key: 'next_follow_up', label: 'Next Follow-up' },
])

// Define columns for Follow-ups table
const FOLLOWUP_COLUMNS = defineColumns([
  { key: 'lead', label: 'Lead' },
  { key: 'date', label: 'Follow-up Date' },
  { key: 'type', label: 'Type' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_by', label: 'Created By' },
  { key: 'status', label: 'Status' },
])

export default function PipelineLeads() {
  const { user: currentUser, hasPermission } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // State
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    stage: '',
    quality: '',
    source: '',
    assigned_to: '',
    created_by: ''
  })
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(25)

  // Column visibility hooks
  const leadsColumnVisibility = useColumnVisibility('leads', getDefaultColumnKeys(LEAD_COLUMNS))
  const followupsColumnVisibility = useColumnVisibility('followups', getDefaultColumnKeys(FOLLOWUP_COLUMNS))

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false)
  const [isEditFollowUpDialogOpen, setIsEditFollowUpDialogOpen] = useState(false)
  const [isViewLeadDialogOpen, setIsViewLeadDialogOpen] = useState(false)
  const [isViewFollowUpDialogOpen, setIsViewFollowUpDialogOpen] = useState(false)

  // Form states
  const [formData, setFormData] = useState<LeadFormData>({
    customer_name: '',
    company_name: '',
    email: '',
    phone: '',
    potential_value: '',
    lead_quality: 'medium',
    sales_stage: 'new',
    assigned_to: '',
    next_follow_up: '',
    sales_notes: '',
    source: ''
  })

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null)
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null)
  const [followUpToDelete, setFollowUpToDelete] = useState<FollowUp | null>(null)
  const [followUpFormData, setFollowUpFormData] = useState({
    follow_up_date: '',
    follow_up_type: '',
    notes: ''
  })

  // Queries
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['leads', appliedSearchTerm, filters, currentPage],
    queryFn: async () => {
      const response = await apiService.getLeads({
        search: appliedSearchTerm || undefined,
        stage: filters.stage || undefined,
        quality: filters.quality || undefined,
        source: filters.source || undefined,
        assigned_to: filters.assigned_to || undefined,
        created_by: filters.created_by || undefined,
        page: currentPage,
        limit: pageSize
      })
      
      // Update pagination state
      if (response.pagination) {
        setTotalPages(response.pagination.pages || 1)
        setTotalCount(response.pagination.total || 0)
      }
      
      return response
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiService.getUsers({ limit: 100 }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const { data: followUpsData, isLoading: followUpsLoading } = useQuery({
    queryKey: ['all-follow-ups'],
    queryFn: () => apiService.getAllFollowUps(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const leads = leadsData?.data || []
  const users = usersData?.data || []
  const followUps = followUpsData?.data || []

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: (leadData: any) => apiService.createLead(leadData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setIsCreateDialogOpen(false)
      resetForm()
    },
  })

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, leadData }: { id: string; leadData: any }) => 
      apiService.updateLead(id, leadData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setIsEditDialogOpen(false)
      resetForm()
    },
  })

  const deleteLeadMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setIsDeleteDialogOpen(false)
      setLeadToDelete(null)
    },
  })


  const addFollowUpMutation = useMutation({
    mutationFn: ({ leadId, followUpData }: { leadId: string; followUpData: any }) => 
      apiService.addLeadFollowUp(leadId, followUpData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] })
      setIsFollowUpDialogOpen(false)
      setFollowUpFormData({ follow_up_date: '', follow_up_type: '', notes: '' })
    },
  })

  const updateFollowUpMutation = useMutation({
    mutationFn: ({ leadId, followUpId, followUpData }: { leadId: string; followUpId: string; followUpData: any }) => 
      apiService.updateLeadFollowUp(leadId, followUpId, followUpData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] })
      setIsEditFollowUpDialogOpen(false)
      setSelectedFollowUp(null)
      setFollowUpFormData({ follow_up_date: '', follow_up_type: '', notes: '' })
    },
  })

  const deleteFollowUpMutation = useMutation({
    mutationFn: ({ leadId, followUpId }: { leadId: string; followUpId: string }) => 
      apiService.deleteFollowUp(leadId, followUpId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] })
      setFollowUpToDelete(null)
    },
  })

  // Helper functions
  const resetForm = () => {
    setFormData({
      customer_name: '',
      company_name: '',
      email: '',
      phone: '',
      potential_value: '',
      lead_quality: 'medium',
      sales_stage: 'new',
      assigned_to: currentUser?.id?.toString() || '',
      next_follow_up: '',
      sales_notes: '',
      source: ''
    })
    setSelectedLead(null)
  }


  // Event handlers
  const handleCreateLead = () => {
    if (!hasPermission('pipeline:write')) {
      // Show access denied or redirect
      return
    }
    resetForm()
    setIsCreateDialogOpen(true)
  }

  const handleEditLead = (lead: Lead) => {
    if (!hasPermission('pipeline:write')) {
      return
    }
    setFormData({
      customer_name: lead.customer_name,
      company_name: lead.company_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      potential_value: lead.potential_value.toString(),
      lead_quality: lead.lead_quality,
      sales_stage: lead.sales_stage,
      assigned_to: lead.assigned_to?.toString() || '',
      next_follow_up: lead.next_follow_up || '',
      sales_notes: lead.sales_notes || '',
      source: lead.source || ''
    })
    setSelectedLead(lead)
    setIsEditDialogOpen(true)
  }

  const handleSaveLead = () => {
    const leadData = {
      ...formData,
      potential_value: parseFloat(formData.potential_value) || 0,
      assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
      next_follow_up: formData.next_follow_up || null,
    }

    if (selectedLead) {
      updateLeadMutation.mutate({ id: selectedLead.id.toString(), leadData })
    } else {
      createLeadMutation.mutate(leadData)
    }
  }

  const handleDeleteLead = (lead: Lead) => {
    if (!hasPermission('pipeline:delete')) {
      return
    }
    setLeadToDelete(lead)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteLead = () => {
    if (leadToDelete) {
      deleteLeadMutation.mutate(leadToDelete.id.toString())
    }
  }


  const clearAllFilters = () => {
    setAppliedSearchTerm('')
    setFilters({
      stage: '',
      quality: '',
      source: '',
      assigned_to: '',
      created_by: ''
    })
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (appliedSearchTerm) count++
    if (filters.stage) count++
    if (filters.quality) count++
    if (filters.source) count++
    if (filters.assigned_to) count++
    if (filters.created_by) count++
    return count
  }

  // Follow-up helper functions
  const getLeadFollowUps = (leadId: number) => {
    return followUps.filter(followUp => followUp.lead_id === leadId)
  }

  const handleAddFollowUp = (lead: Lead) => {
    if (!hasPermission('pipeline:write')) {
      return
    }
    setSelectedLead(lead)
    setFollowUpFormData({ follow_up_date: '', follow_up_type: '', notes: '' })
    setIsFollowUpDialogOpen(true)
  }

  const handleEditFollowUp = (followUp: FollowUp) => {
    setSelectedFollowUp(followUp)
    setFollowUpFormData({
      follow_up_date: followUp.follow_up_date,
      follow_up_type: followUp.follow_up_type,
      notes: followUp.notes
    })
    setIsEditFollowUpDialogOpen(true)
  }

  const handleDeleteFollowUp = (followUp: FollowUp) => {
    setFollowUpToDelete(followUp)
  }

  const handleSaveFollowUp = () => {
    if (selectedLead) {
      addFollowUpMutation.mutate({ 
        leadId: selectedLead.id.toString(), 
        followUpData: followUpFormData 
      })
    }
  }

  const handleSaveEditFollowUp = () => {
    if (selectedFollowUp && selectedLead) {
      updateFollowUpMutation.mutate({ 
        leadId: selectedLead.id.toString(), 
        followUpId: selectedFollowUp.id.toString(), 
        followUpData: followUpFormData 
      })
    }
  }

  const confirmDeleteFollowUp = () => {
    if (followUpToDelete && selectedLead) {
      deleteFollowUpMutation.mutate({ 
        leadId: selectedLead.id.toString(), 
        followUpId: followUpToDelete.id.toString() 
      })
    }
  }

  const handleAssignUser = (lead: Lead) => {
    if (!hasPermission('pipeline:write')) {
      return
    }
    setSelectedLead(lead)
    setIsAssignDialogOpen(true)
  }

  const handleSaveUserAssignment = (userId: string) => {
    if (selectedLead) {
      const leadData = {
        ...selectedLead,
        assigned_to: userId ? parseInt(userId) : null
      }
      updateLeadMutation.mutate({ 
        id: selectedLead.id.toString(), 
        leadData 
      })
    }
    setIsAssignDialogOpen(false)
    setSelectedLead(null)
  }

  const handleCloseAssignDialog = () => {
    setIsAssignDialogOpen(false)
    setSelectedLead(null)
  }

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead)
    setIsViewLeadDialogOpen(true)
  }

  const handleViewFollowUp = (followUp: FollowUp) => {
    setSelectedFollowUp(followUp)
    setIsViewFollowUpDialogOpen(true)
  }

  const handleCloseViewLeadDialog = () => {
    setIsViewLeadDialogOpen(false)
    setSelectedLead(null)
  }

  const handleCloseViewFollowUpDialog = () => {
    setIsViewFollowUpDialogOpen(false)
    setSelectedFollowUp(null)
  }

  // Calculate stage statistics
  const getStageStats = () => {
    const stats: Record<string, { count: number; value: number }> = {}
    
    PIPELINE_STAGES.forEach(stage => {
      const stageLeads = leads.filter(lead => lead.sales_stage === stage.id)
      stats[stage.id] = {
        count: stageLeads.length,
        value: stageLeads.reduce((sum, lead) => {
          const value = lead.potential_value;
          // Handle both number and string values
          const numValue = typeof value === 'string' ? parseFloat(value) : value;
          if (typeof numValue === 'number' && !isNaN(numValue)) {
            return sum + numValue;
          }
          return sum;
        }, 0)
      }
    })
    
    return stats
  }

  const stageStats = getStageStats()

  return (
    <MainLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline & Leads</h1>
          <p className="text-muted-foreground">
            Manage your sales pipeline and leads in one unified view
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => refetchLeads()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {hasPermission('pipeline:write') && (
            <Button onClick={handleCreateLead}>
              <Plus className="mr-2 h-4 w-4" />
              Create Lead
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads.length}</div>
            <p className="text-xs text-muted-foreground">
              Across all stages
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leadsLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
              ) : (
                (() => {
                  if (!leads || leads.length === 0) {
                    return formatCurrency(0);
                  }
                  const total = leads.reduce((sum, lead) => {
                    const value = lead.potential_value;
                    // Handle both number and string values
                    const numValue = typeof value === 'string' ? parseFloat(value) : value;
                    if (typeof numValue === 'number' && !isNaN(numValue)) {
                      return sum + numValue;
                    }
                    return sum;
                  }, 0);
                  return formatCurrency(total);
                })()
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Pipeline value
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leads.length > 0 ? Math.round((leads.filter(l => l.sales_stage === 'won').length / leads.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Won vs total leads
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Follow-ups</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leads.filter(lead => lead.next_follow_up && new Date(lead.next_follow_up) < new Date()).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Stages Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stages</CardTitle>
          <CardDescription>
            Overview of leads in each pipeline stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.id} className="text-center">
                <div 
                  className="w-4 h-4 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: stage.color }}
                />
                <div className="text-sm font-medium">{stage.name}</div>
                <div className="text-xs text-muted-foreground">
                  {stageStats[stage.id]?.count || 0} leads
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(stageStats[stage.id]?.value || 0)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

            {/* Tabs for Leads and Follow-ups with Search and Filter */}
            <Tabs defaultValue="leads" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="leads" className="flex items-center gap-2">
                    Leads
                    <Badge variant="secondary" className="ml-1">
                      {leads.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="follow-ups" className="flex items-center gap-2">
                    Follow-ups
                    <Badge variant="secondary" className="ml-1">
                      {followUps.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center space-x-4">
                  {/* Search */}
                  <SmartSearch
                    placeholder="Search leads..."
                    onSearch={(term) => {
                      setAppliedSearchTerm(term)
                      setCurrentPage(1) // Reset to first page when searching
                    }}
                    onClear={() => {
                      setAppliedSearchTerm('')
                      setCurrentPage(1)
                    }}
                    debounceMs={300}
                    className="w-80"
                    disabled={leadsLoading}
                  />

                  {/* Filter Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter
                        {getActiveFiltersCount() > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {getActiveFiltersCount()}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      {/* Stage Filter */}
                      <div className="p-2">
                        <Label className="text-xs font-medium text-muted-foreground">Stage</Label>
                        <Select
                          value={filters.stage}
                          onValueChange={(value) => {
                            setFilters(prev => ({ ...prev, stage: value === 'clear' ? '' : value }))
                            setCurrentPage(1) // Reset to first page when filter changes
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="All stages" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clear">Clear Stage</SelectItem>
                            {SALES_STAGES.map((stage) => (
                              <SelectItem key={stage.value} value={stage.value}>
                                {stage.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quality Filter */}
                      <div className="p-2">
                        <Label className="text-xs font-medium text-muted-foreground">Quality</Label>
                        <Select
                          value={filters.quality}
                          onValueChange={(value) => {
                            setFilters(prev => ({ ...prev, quality: value === 'clear' ? '' : value }))
                            setCurrentPage(1) // Reset to first page when filter changes
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="All quality" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clear">Clear Quality</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Source Filter */}
                      <div className="p-2">
                        <Label className="text-xs font-medium text-muted-foreground">Source</Label>
                        <Select
                          value={filters.source}
                          onValueChange={(value) => {
                            setFilters(prev => ({ ...prev, source: value === 'clear' ? '' : value }))
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="All sources" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clear">Clear Source</SelectItem>
                            {LEAD_SOURCES.map((source) => (
                              <SelectItem key={source} value={source}>
                                {source}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Assigned To Filter */}
                      <div className="p-2">
                        <Label className="text-xs font-medium text-muted-foreground">Assigned To</Label>
                        <Select
                          value={filters.assigned_to}
                          onValueChange={(value) => {
                            setFilters(prev => ({ ...prev, assigned_to: value === 'clear' ? '' : value }))
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="All users" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clear">Clear Assignment</SelectItem>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Created By Filter */}
                      <div className="p-2">
                        <Label className="text-xs font-medium text-muted-foreground">Created By</Label>
                        <Select
                          value={filters.created_by}
                          onValueChange={(value) => {
                            setFilters(prev => ({ ...prev, created_by: value === 'clear' ? '' : value }))
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="All creators" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clear">Clear Creator</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={clearAllFilters}
                        className="text-center"
                      >
                        Clear Filters
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Column Visibility for Leads */}
                  <ColumnVisibilityDropdown
                    columns={LEAD_COLUMNS}
                    visibleColumns={leadsColumnVisibility.visibleColumns}
                    onToggleColumn={leadsColumnVisibility.toggleColumn}
                    onShowAll={leadsColumnVisibility.showAllColumns}
                    onHideAll={leadsColumnVisibility.hideAllColumns}
                    onReset={leadsColumnVisibility.resetColumns}
                    isSyncing={leadsColumnVisibility.isSyncing}
                  />
                </div>
              </div>
        
        <TabsContent value="leads" className="space-y-4">
          {/* Leads Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {leadsColumnVisibility.isColumnVisible('customer') && <TableHead>Customer</TableHead>}
                    {leadsColumnVisibility.isColumnVisible('company') && <TableHead>Company</TableHead>}
                    {leadsColumnVisibility.isColumnVisible('value') && <TableHead>Value</TableHead>}
                    {leadsColumnVisibility.isColumnVisible('quality') && <TableHead>Quality</TableHead>}
                    {leadsColumnVisibility.isColumnVisible('stage') && <TableHead>Stage</TableHead>}
                    {leadsColumnVisibility.isColumnVisible('assigned_to') && <TableHead>Assigned To</TableHead>}
                    {leadsColumnVisibility.isColumnVisible('next_follow_up') && <TableHead>Next Follow-up</TableHead>}
                    <TableHead className="w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                          Loading leads...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No leads found
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow 
                        key={lead.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewLead(lead)}
                      >
                        {leadsColumnVisibility.isColumnVisible('customer') && (
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div>
                                <div className="font-medium">{lead.customer_name}</div>
                                {lead.email && (
                                  <div className="text-sm text-muted-foreground">{lead.email}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        )}
                        {leadsColumnVisibility.isColumnVisible('company') && (
                          <TableCell>{lead.company_name || '-'}</TableCell>
                        )}
                        {leadsColumnVisibility.isColumnVisible('value') && (
                          <TableCell className="font-medium">
                            {formatCurrency(
                              (() => {
                                const value = lead.potential_value;
                                const numValue = typeof value === 'string' ? parseFloat(value) : value;
                                return typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0;
                              })()
                            )}
                          </TableCell>
                        )}
                        {leadsColumnVisibility.isColumnVisible('quality') && (
                          <TableCell>
                            <Badge className={getQualityColor(lead.lead_quality)}>
                              {lead.lead_quality}
                            </Badge>
                          </TableCell>
                        )}
                        {leadsColumnVisibility.isColumnVisible('stage') && (
                          <TableCell>
                            <Badge className={getStageColor(lead.sales_stage)}>
                              {SALES_STAGES.find(s => s.value === lead.sales_stage)?.label || lead.sales_stage}
                            </Badge>
                          </TableCell>
                        )}
                        {leadsColumnVisibility.isColumnVisible('assigned_to') && (
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{lead.assigned_to_name || 'Unassigned'}</span>
                            </div>
                          </TableCell>
                        )}
                        {leadsColumnVisibility.isColumnVisible('next_follow_up') && (
                          <TableCell>
                            {lead.next_follow_up ? formatDate(lead.next_follow_up) : '-'}
                          </TableCell>
                        )}
                      <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {hasPermission('pipeline:write') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditLead(lead)
                                }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {hasPermission('pipeline:write') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleAssignUser(lead)
                                }}>
                                  <User className="mr-2 h-4 w-4" />
                                  Assign User
                                </DropdownMenuItem>
                              )}
                              {hasPermission('pipeline:write') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddFollowUp(lead)
                                }}>
                                  <Calendar className="mr-2 h-4 w-4" />
                                  Add Follow-up
                                </DropdownMenuItem>
                              )}
                              {hasPermission('pipeline:write') && <DropdownMenuSeparator />}
                              {hasPermission('pipeline:delete') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteLead(lead)
                                }}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
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
                itemName="leads"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="follow-ups" className="space-y-4">
          {/* Follow-ups Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Follow-ups</CardTitle>
                {/* Column Visibility for Follow-ups */}
                <ColumnVisibilityDropdown
                  columns={FOLLOWUP_COLUMNS}
                  visibleColumns={followupsColumnVisibility.visibleColumns}
                  onToggleColumn={followupsColumnVisibility.toggleColumn}
                  onShowAll={followupsColumnVisibility.showAllColumns}
                  onHideAll={followupsColumnVisibility.hideAllColumns}
                  onReset={followupsColumnVisibility.resetColumns}
                  isSyncing={followupsColumnVisibility.isSyncing}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {followupsColumnVisibility.isColumnVisible('lead') && <TableHead>Lead</TableHead>}
                    {followupsColumnVisibility.isColumnVisible('date') && <TableHead>Follow-up Date</TableHead>}
                    {followupsColumnVisibility.isColumnVisible('type') && <TableHead>Type</TableHead>}
                    {followupsColumnVisibility.isColumnVisible('notes') && <TableHead>Notes</TableHead>}
                    {followupsColumnVisibility.isColumnVisible('created_by') && <TableHead>Created By</TableHead>}
                    {followupsColumnVisibility.isColumnVisible('status') && <TableHead>Status</TableHead>}
                    <TableHead className="w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followUpsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                          Loading follow-ups...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : followUps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No follow-ups found
                      </TableCell>
                    </TableRow>
                  ) : (
                    followUps.map((followUp) => (
                      <TableRow 
                        key={followUp.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewFollowUp(followUp)}
                      >
                        {followupsColumnVisibility.isColumnVisible('lead') && (
                          <TableCell>
                            <div className="font-medium">
                              {leads.find(l => l.id === followUp.lead_id)?.customer_name || 'Unknown Lead'}
                            </div>
                          </TableCell>
                        )}
                        {followupsColumnVisibility.isColumnVisible('date') && (
                          <TableCell>{formatDate(followUp.follow_up_date)}</TableCell>
                        )}
                        {followupsColumnVisibility.isColumnVisible('type') && (
                          <TableCell>{followUp.follow_up_type || '-'}</TableCell>
                        )}
                        {followupsColumnVisibility.isColumnVisible('notes') && (
                          <TableCell className="max-w-[200px] truncate">{followUp.notes}</TableCell>
                        )}
                        {followupsColumnVisibility.isColumnVisible('created_by') && (
                          <TableCell>{followUp.created_by_name}</TableCell>
                        )}
                        {followupsColumnVisibility.isColumnVisible('status') && (
                          <TableCell>
                            <Badge variant={followUp.completed ? "default" : "secondary"}>
                              {followUp.completed ? "Completed" : "Pending"}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                handleEditFollowUp(followUp)
                              }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteFollowUp(followUp)
                              }}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Lead Dialog */}
      <LeadDialog
        isOpen={isCreateDialogOpen || isEditDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false)
          setIsEditDialogOpen(false)
          resetForm()
        }}
        onSave={handleSaveLead}
        formData={formData}
        setFormData={setFormData}
        users={users}
        isEdit={!!selectedLead}
        isLoading={createLeadMutation.isPending || updateLeadMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDeleteLead}
        title="Delete Lead"
        description={`Are you sure you want to delete lead "${leadToDelete?.customer_name}"? This action cannot be undone.`}
        itemName={leadToDelete?.customer_name}
        itemType="lead"
        isLoading={deleteLeadMutation.isPending}
      />

      {/* Follow-up Dialogs */}
      <FollowUpDialog
        isOpen={isFollowUpDialogOpen}
        onClose={() => {
          setIsFollowUpDialogOpen(false)
          setFollowUpFormData({ follow_up_date: '', follow_up_type: '', notes: '' })
        }}
        onSave={handleSaveFollowUp}
        formData={followUpFormData}
        setFormData={setFollowUpFormData}
        isLoading={addFollowUpMutation.isPending}
        title="Add Follow-up"
      />

      <FollowUpDialog
        isOpen={isEditFollowUpDialogOpen}
        onClose={() => {
          setIsEditFollowUpDialogOpen(false)
          setSelectedFollowUp(null)
          setFollowUpFormData({ follow_up_date: '', follow_up_type: '', notes: '' })
        }}
        onSave={handleSaveEditFollowUp}
        formData={followUpFormData}
        setFormData={setFollowUpFormData}
        isLoading={updateFollowUpMutation.isPending}
        title="Edit Follow-up"
      />

      {/* Delete Follow-up Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!followUpToDelete}
        onOpenChange={() => setFollowUpToDelete(null)}
        onConfirm={confirmDeleteFollowUp}
        title="Delete Follow-up"
        description={`Are you sure you want to delete this follow-up? This action cannot be undone.`}
        itemName="follow-up"
        itemType="follow-up"
        isLoading={deleteFollowUpMutation.isPending}
      />

      {/* Assign User Dialog */}
      <AssignUserDialog
        isOpen={isAssignDialogOpen}
        onClose={handleCloseAssignDialog}
        onSave={handleSaveUserAssignment}
        users={users}
        isLoading={updateLeadMutation.isPending}
      />

      {/* View Lead Dialog */}
      <ViewLeadDialog
        isOpen={isViewLeadDialogOpen}
        onClose={handleCloseViewLeadDialog}
        lead={selectedLead}
        users={users}
      />

      {/* View Follow-up Dialog */}
      <ViewFollowUpDialog
        isOpen={isViewFollowUpDialogOpen}
        onClose={handleCloseViewFollowUpDialog}
        followUp={selectedFollowUp}
        leads={leads}
      />
      </div>
    </MainLayout>
  )
}

// Follow-up Dialog Component
function FollowUpDialog({
  isOpen,
  onClose,
  onSave,
  formData,
  setFormData,
  isLoading,
  title
}: {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  formData: { follow_up_date: string; follow_up_type: string; notes: string }
  setFormData: (data: { follow_up_date: string; follow_up_type: string; notes: string }) => void
  isLoading: boolean
  title: string
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {title === 'Add Follow-up' ? 'Add a new follow-up for this lead.' : 'Update the follow-up information.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="follow_up_date">Follow-up Date *</Label>
            <DatePicker
              value={formData.follow_up_date}
              onChange={(value) => setFormData({ ...formData, follow_up_date: value })}
              placeholder="Select follow-up date"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="follow_up_type">Follow-up Type</Label>
            <Select
              value={formData.follow_up_type}
              onValueChange={(value) => setFormData({ ...formData, follow_up_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="demo">Demo</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Enter follow-up notes"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Assign User Dialog Component
function AssignUserDialog({
  isOpen,
  onClose,
  onSave,
  users,
  isLoading
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (userId: string) => void
  users: any[]
  isLoading: boolean
}) {
  const [selectedUserId, setSelectedUserId] = useState('')

  const handleSave = () => {
    onSave(selectedUserId)
    setSelectedUserId('')
  }

  const handleClose = () => {
    onClose()
    setSelectedUserId('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Assign User</DialogTitle>
          <DialogDescription>
            Select a user to assign this lead to.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assigned_user">Assign To</Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassign</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Assign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Lead Dialog Component
function LeadDialog({
  isOpen,
  onClose,
  onSave,
  formData,
  setFormData,
  users,
  isEdit,
  isLoading
}: {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  formData: LeadFormData
  setFormData: (data: LeadFormData) => void
  users: any[]
  isEdit: boolean
  isLoading: boolean
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the lead information below.' : 'Fill in the details to create a new lead.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Enter company name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="potential_value">Potential Value</Label>
            <Input
              id="potential_value"
              type="number"
              value={formData.potential_value}
              onChange={(e) => setFormData({ ...formData, potential_value: e.target.value })}
              placeholder="Enter potential value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead_quality">Lead Quality</Label>
            <Select
              value={formData.lead_quality}
              onValueChange={(value) => setFormData({ ...formData, lead_quality: value as 'high' | 'medium' | 'low' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales_stage">Sales Stage</Label>
            <Select
              value={formData.sales_stage}
              onValueChange={(value) => setFormData({ ...formData, sales_stage: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALES_STAGES.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={formData.source}
              onValueChange={(value) => setFormData({ ...formData, source: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign To</Label>
            <Select
              value={formData.assigned_to}
              onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="next_follow_up">Next Follow-up</Label>
            <DatePicker
              value={formData.next_follow_up}
              onChange={(value) => setFormData({ ...formData, next_follow_up: value })}
              placeholder="Select next follow-up date"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="sales_notes">Sales Notes</Label>
          <Textarea
            id="sales_notes"
            value={formData.sales_notes}
            onChange={(e) => setFormData({ ...formData, sales_notes: e.target.value })}
            placeholder="Enter sales notes"
            rows={3}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : (isEdit ? 'Update Lead' : 'Create Lead')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Helper functions (moved outside main component) - formatCurrency is now imported from lib/currency

// Date formatting functions are now imported from lib/dateTime

const getQualityColor = (quality: string) => {
  switch (quality) {
    case 'high': return 'bg-green-100 text-green-800 hover:bg-green-200'
    case 'medium': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    case 'low': return 'bg-red-100 text-red-800 hover:bg-red-200'
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
  }
}

const getStageColor = (stage: string) => {
  switch (stage) {
    case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'contacted': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    case 'qualified': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case 'proposal': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
    case 'negotiation': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'won': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'lost': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
}

// View Lead Dialog Component
function ViewLeadDialog({
  isOpen,
  onClose,
  lead,
  users
}: {
  isOpen: boolean
  onClose: () => void
  lead: Lead | null
  users: any[]
}) {
  if (!lead) return null

  const assignedUser = users.find(u => u.id === lead.assigned_to)
  const createdByUser = users.find(u => u.name === lead.created_by_name)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lead Details</DialogTitle>
          <DialogDescription>
            View detailed information about this lead including customer details, lead information, and sales notes.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Customer Name</Label>
                <p className="text-sm">{lead.customer_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Company</Label>
                <p className="text-sm">{lead.company_name || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                <p className="text-sm">{lead.email || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                <p className="text-sm">{lead.phone || '-'}</p>
              </div>
            </div>
          </div>

          {/* Lead Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Lead Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Potential Value</Label>
                <p className="text-sm font-medium">{formatCurrency(lead.potential_value || 0)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Lead Quality</Label>
                <Badge className={getQualityColor(lead.lead_quality)}>
                  {lead.lead_quality}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Sales Stage</Label>
                <Badge className={getStageColor(lead.sales_stage)}>
                  {SALES_STAGES.find(s => s.value === lead.sales_stage)?.label || lead.sales_stage}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Source</Label>
                <p className="text-sm">{lead.source || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Assigned To</Label>
                <p className="text-sm">{assignedUser?.name || 'Unassigned'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created By</Label>
                <p className="text-sm">{createdByUser?.name || lead.created_by_name || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Next Follow-up</Label>
                <p className="text-sm">{lead.next_follow_up ? formatDate(lead.next_follow_up) : '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created Date</Label>
                <p className="text-sm">{formatDate(lead.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Sales Notes */}
          {lead.sales_notes && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Sales Notes</Label>
              <p className="text-sm bg-muted p-3 rounded-md">{lead.sales_notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// View Follow-up Dialog Component
function ViewFollowUpDialog({
  isOpen,
  onClose,
  followUp,
  leads
}: {
  isOpen: boolean
  onClose: () => void
  followUp: FollowUp | null
  leads: Lead[]
}) {
  if (!followUp) return null

  const lead = leads.find(l => l.id === followUp.lead_id)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Follow-up Details</DialogTitle>
          <DialogDescription>
            View detailed information about this follow-up including lead information, follow-up details, and notes.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Lead Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Lead Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Customer Name</Label>
                <p className="text-sm font-medium">{lead?.customer_name || 'Unknown Lead'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Company</Label>
                <p className="text-sm">{lead?.company_name || '-'}</p>
              </div>
            </div>
          </div>

          {/* Follow-up Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Follow-up Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Follow-up Date</Label>
                <p className="text-sm">{formatDate(followUp.follow_up_date)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                <p className="text-sm">{followUp.follow_up_type || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                <Badge variant={followUp.completed ? "default" : "secondary"}>
                  {followUp.completed ? 'Completed' : 'Pending'}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created By</Label>
                <p className="text-sm">{followUp.created_by_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created Date</Label>
                <p className="text-sm">{formatDate(followUp.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {followUp.notes && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
              <p className="text-sm bg-muted p-3 rounded-md">{followUp.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
