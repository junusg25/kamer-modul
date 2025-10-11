import React, { useState, useCallback, useRef, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target, 
  Phone, 
  Mail, 
  RefreshCw,
  Star,
  Building2,
  Calendar,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  GripVertical,
  Plus,
  Filter,
  Search,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { useAuth } from '../contexts/auth-context'
import { formatCurrency } from '../lib/currency'
import { formatDate, isOverdue } from '../lib/dateTime'

interface Lead {
  id: number
  customer_name: string
  company_name?: string
  email?: string
  phone?: string
  potential_value: number
  lead_quality: 'high' | 'medium' | 'low'
  sales_stage: string
  assigned_to_name?: string
  next_follow_up?: string
  sales_notes?: string
  created_at: string
  source?: string
}

interface PipelineStats {
  totalLeads: number
  totalValue: number
  conversionRate: number
  overdueFollowUps: number
}

const PIPELINE_STAGES = [
  { id: 'new', name: 'New Leads', color: '#3b82f6', description: 'Fresh leads that need initial contact' },
  { id: 'contacted', name: 'Contacted', color: '#f59e0b', description: 'Leads that have been initially contacted' },
  { id: 'qualified', name: 'Qualified', color: '#8b5cf6', description: 'Leads that meet qualification criteria' },
  { id: 'proposal', name: 'Proposal', color: '#6366f1', description: 'Proposals sent to qualified leads' },
  { id: 'negotiation', name: 'Negotiation', color: '#ef4444', description: 'Active negotiations in progress' },
  { id: 'won', name: 'Won', color: '#10b981', description: 'Successfully closed deals' },
  { id: 'lost', name: 'Lost', color: '#6b7280', description: 'Lost opportunities' }
]

export default function SalesPipeline() {
  const { user } = useAuth()
  const [filterBy, setFilterBy] = useState('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadDetailOpen, setLeadDetailOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [pipelineData, setPipelineData] = useState<Record<string, Lead[]>>({})

  // Mock data - replace with actual API calls
  const pipelineStats: PipelineStats = {
    totalLeads: 24,
    totalValue: 125000,
    conversionRate: 32.5,
    overdueFollowUps: 3
  }

  // Initialize pipeline data
  useEffect(() => {
    const initialPipelineData: Record<string, Lead[]> = {
    new: [
      {
        id: 1,
        customer_name: 'ABC Construction',
        company_name: 'ABC Construction Ltd',
        email: 'contact@abcconstruction.com',
        phone: '+387 33 123 456',
        potential_value: 15000,
        lead_quality: 'high',
        sales_stage: 'new',
        assigned_to_name: 'John Smith',
        next_follow_up: '2025-01-15',
        sales_notes: 'Interested in 3 high-pressure cleaners',
        created_at: '2025-01-10',
        source: 'Website'
      },
      {
        id: 2,
        customer_name: 'XYZ Services',
        email: 'info@xyzservices.com',
        phone: '+387 33 789 012',
        potential_value: 8500,
        lead_quality: 'medium',
        sales_stage: 'new',
        assigned_to_name: 'Sarah Johnson',
        next_follow_up: '2025-01-12',
        created_at: '2025-01-09',
        source: 'Referral'
      }
    ],
    contacted: [
      {
        id: 3,
        customer_name: 'City Maintenance',
        company_name: 'City Maintenance Co',
        email: 'orders@citymaintenance.com',
        phone: '+387 33 456 789',
        potential_value: 22000,
        lead_quality: 'high',
        sales_stage: 'contacted',
        assigned_to_name: 'Mike Wilson',
        next_follow_up: '2025-01-18',
        sales_notes: 'Follow up on equipment demo',
        created_at: '2025-01-08',
        source: 'Trade Show'
      }
    ],
    qualified: [
      {
        id: 4,
        customer_name: 'Tech Solutions',
        company_name: 'Tech Solutions Inc',
        email: 'procurement@techsolutions.com',
        phone: '+387 33 321 654',
        potential_value: 12000,
        lead_quality: 'high',
        sales_stage: 'qualified',
        assigned_to_name: 'John Smith',
        next_follow_up: '2025-01-20',
        sales_notes: 'Budget approved, ready for proposal',
        created_at: '2025-01-07',
        source: 'Website'
      }
    ],
    proposal: [
      {
        id: 5,
        customer_name: 'Clean Pro',
        email: 'sales@cleanpro.com',
        phone: '+387 33 654 321',
        potential_value: 9500,
        lead_quality: 'medium',
        sales_stage: 'proposal',
        assigned_to_name: 'Sarah Johnson',
        next_follow_up: '2025-01-22',
        sales_notes: 'Proposal sent, waiting for response',
        created_at: '2025-01-06',
        source: 'Cold Call'
      }
    ],
    negotiation: [
      {
        id: 6,
        customer_name: 'Industrial Cleaners',
        company_name: 'Industrial Cleaners Ltd',
        email: 'purchasing@industrialcleaners.com',
        phone: '+387 33 987 654',
        potential_value: 18000,
        lead_quality: 'high',
        sales_stage: 'negotiation',
        assigned_to_name: 'Mike Wilson',
        next_follow_up: '2025-01-25',
        sales_notes: 'Negotiating price and terms',
        created_at: '2025-01-05',
        source: 'Referral'
      }
    ],
    won: [
      {
        id: 7,
        customer_name: 'Maintenance Plus',
        company_name: 'Maintenance Plus Co',
        email: 'orders@maintenanceplus.com',
        phone: '+387 33 147 258',
        potential_value: 13500,
        lead_quality: 'high',
        sales_stage: 'won',
        assigned_to_name: 'John Smith',
        sales_notes: 'Deal closed successfully',
        created_at: '2025-01-04',
        source: 'Website'
      }
    ],
    lost: [
      {
        id: 8,
        customer_name: 'Quick Clean',
        email: 'info@quickclean.com',
        phone: '+387 33 369 258',
        potential_value: 7500,
        lead_quality: 'low',
        sales_stage: 'lost',
        assigned_to_name: 'Sarah Johnson',
        sales_notes: 'Budget constraints, not proceeding',
        created_at: '2025-01-03',
        source: 'Cold Call'
      }
    ]
  }
  
  setPipelineData(initialPipelineData)
  }, [])

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  // formatCurrency is now imported from lib/currency

  // Date formatting functions are now imported from lib/dateTime

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead)
    setLeadDetailOpen(true)
  }

  const handleRefresh = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', lead.id.toString())
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverStage(null)
  }

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault()
    setDragOverStage(null)
    
    if (draggedLead && draggedLead.sales_stage !== targetStage) {
      // Here you would make API call to update lead stage
      
      
      // Update local state
      setPipelineData(prev => {
        const newData = { ...prev }
        
        // Remove from old stage
        newData[draggedLead.sales_stage] = newData[draggedLead.sales_stage].filter(
          lead => lead.id !== draggedLead.id
        )
        
        // Add to new stage
        const updatedLead = { ...draggedLead, sales_stage: targetStage }
        newData[targetStage] = [...(newData[targetStage] || []), updatedLead]
        
        return newData
      })
    }
    
    setDraggedLead(null)
  }

  const handleDragEnd = () => {
    setDraggedLead(null)
    setDragOverStage(null)
  }

  // Alternative: Click-to-move functionality
  const moveLeadToStage = (leadId: number, newStage: string) => {
    setPipelineData(prev => {
      const newData = { ...prev }
      let leadToMove: Lead | null = null
      
      // Find and remove the lead from current stage
      Object.keys(newData).forEach(stage => {
        const leadIndex = newData[stage].findIndex(lead => lead.id === leadId)
        if (leadIndex !== -1) {
          leadToMove = newData[stage][leadIndex]
          newData[stage] = newData[stage].filter(lead => lead.id !== leadId)
        }
      })
      
      // Add to new stage
      if (leadToMove) {
        const updatedLead = { ...leadToMove, sales_stage: newStage }
        newData[newStage] = [...(newData[newStage] || []), updatedLead]
      }
      
      return newData
    })
  }

  const getNextStage = (currentStage: string) => {
    const stageIndex = PIPELINE_STAGES.findIndex(stage => stage.id === currentStage)
    return stageIndex < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIndex + 1] : null
  }

  const getPrevStage = (currentStage: string) => {
    const stageIndex = PIPELINE_STAGES.findIndex(stage => stage.id === currentStage)
    return stageIndex > 0 ? PIPELINE_STAGES[stageIndex - 1] : null
  }

  const LeadCard = ({ lead }: { lead: Lead }) => (
    <Card 
      className={`mb-3 cursor-pointer hover:shadow-md transition-all duration-200 ${
        draggedLead?.id === lead.id ? 'opacity-50 scale-95' : ''
      }`}
      draggable
      onDragStart={(e) => handleDragStart(e, lead)}
      onDragEnd={handleDragEnd}
      onClick={() => handleLeadClick(lead)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarFallback className="text-xs">
                {lead.customer_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium truncate" title={lead.customer_name}>
                {lead.customer_name}
              </p>
              {lead.company_name && (
                <p className="text-xs text-muted-foreground truncate" title={lead.company_name}>
                  {lead.company_name}
                </p>
              )}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              // Handle menu actions
            }}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <Badge className={`text-xs ${getQualityColor(lead.lead_quality)}`}>
            {lead.lead_quality}
          </Badge>
          <span className="text-sm font-medium text-primary">
            {formatCurrency(lead.potential_value)}
          </span>
        </div>

        {lead.next_follow_up && (
          <div className="flex items-center space-x-1 mb-2">
            <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className={`text-xs truncate ${isOverdue(lead.next_follow_up) ? 'text-red-600' : 'text-muted-foreground'}`}>
              {formatDate(lead.next_follow_up)}
            </span>
            {isOverdue(lead.next_follow_up) && (
              <Badge variant="destructive" className="text-xs h-4 flex-shrink-0">
                Overdue
              </Badge>
            )}
          </div>
        )}

        {lead.assigned_to_name && (
          <div className="flex items-center space-x-1">
            <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate" title={lead.assigned_to_name}>
              {lead.assigned_to_name}
            </span>
          </div>
        )}

        {/* Action buttons for moving between stages */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center space-x-1">
            {getPrevStage(lead.sales_stage) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  moveLeadToStage(lead.id, getPrevStage(lead.sales_stage)!.id)
                }}
                title={`Move to ${getPrevStage(lead.sales_stage)!.name}`}
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                {getPrevStage(lead.sales_stage)!.name}
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {getNextStage(lead.sales_stage) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  moveLeadToStage(lead.id, getNextStage(lead.sales_stage)!.id)
                }}
                title={`Move to ${getNextStage(lead.sales_stage)!.name}`}
              >
                {getNextStage(lead.sales_stage)!.name}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const PipelineColumn = ({ stage, leads }: { stage: typeof PIPELINE_STAGES[0], leads: Lead[] }) => (
    <Card 
      className={`h-full transition-all duration-200 ${
        dragOverStage === stage.id ? 'ring-2 ring-primary ring-opacity-50 bg-primary/5' : ''
      }`}
      onDragOver={(e) => handleDragOver(e, stage.id)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, stage.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {leads.length}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {formatCurrency(leads.reduce((sum, lead) => sum + lead.potential_value, 0))}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 min-h-[400px]">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
          {leads.length === 0 && (
            <div className={`text-center py-8 text-muted-foreground transition-all duration-200 ${
              dragOverStage === stage.id ? 'border-2 border-dashed border-primary/30 rounded-lg' : ''
            }`}>
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {dragOverStage === stage.id ? 'Drop lead here' : 'No leads in this stage'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
            <p className="text-muted-foreground">
              Manage your sales leads through the pipeline stages
            </p>
            <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center space-x-1">
                <GripVertical className="h-4 w-4" />
                <span>Drag & drop to move leads</span>
              </span>
              <span className="flex items-center space-x-1">
                <ChevronRight className="h-4 w-4" />
                <span>Or use arrow buttons</span>
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Salespeople</SelectItem>
                <SelectItem value="1">John Smith</SelectItem>
                <SelectItem value="2">Sarah Johnson</SelectItem>
                <SelectItem value="3">Mike Wilson</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Pipeline Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineStats.totalLeads}</div>
              <p className="text-xs text-muted-foreground">
                Across all stages
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(pipelineStats.totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                Total potential value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineStats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">
                Lead to sale conversion
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Follow-ups</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{pipelineStats.overdueFollowUps}</div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Board */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {PIPELINE_STAGES.map((stage) => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              leads={pipelineData[stage.id] || []}
            />
          ))}
        </div>

        {/* Lead Detail Dialog */}
        <Dialog open={leadDetailOpen} onOpenChange={setLeadDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Lead Details</DialogTitle>
              <DialogDescription>
                View and manage lead information
              </DialogDescription>
            </DialogHeader>
            {selectedLead && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Customer Name</Label>
                    <Input
                      id="customer_name"
                      value={selectedLead.customer_name}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      value={selectedLead.company_name || ''}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={selectedLead.email || ''}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={selectedLead.phone || ''}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="potential_value">Potential Value</Label>
                    <Input
                      id="potential_value"
                      value={formatCurrency(selectedLead.potential_value)}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead_quality">Lead Quality</Label>
                    <div className="flex items-center space-x-2">
                      <Badge className={getQualityColor(selectedLead.lead_quality)}>
                        {selectedLead.lead_quality}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_to">Assigned To</Label>
                    <Input
                      id="assigned_to"
                      value={selectedLead.assigned_to_name || ''}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Input
                      id="source"
                      value={selectedLead.source || ''}
                      readOnly
                    />
                  </div>
                </div>
                {selectedLead.next_follow_up && (
                  <div className="space-y-2">
                    <Label htmlFor="next_follow_up">Next Follow-up</Label>
                    <Input
                      id="next_follow_up"
                      value={formatDate(selectedLead.next_follow_up)}
                      readOnly
                    />
                  </div>
                )}
                {selectedLead.sales_notes && (
                  <div className="space-y-2">
                    <Label htmlFor="sales_notes">Sales Notes</Label>
                    <Textarea
                      id="sales_notes"
                      value={selectedLead.sales_notes}
                      readOnly
                      rows={3}
                    />
                  </div>
                )}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setLeadDetailOpen(false)}>
                    Close
                  </Button>
                  <Button>
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
