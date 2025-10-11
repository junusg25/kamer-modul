import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/auth-context'
import apiService from '../services/api'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { DatePicker } from '../components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'
import { Plus, Edit, Trash2, Target, Users, MoreHorizontal } from 'lucide-react'
import { formatCurrency } from '../lib/currency'
import { format } from 'date-fns'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'

interface SalesTarget {
  id: number
  user_id: number
  user_name: string
  user_email: string
  target_type: 'monthly' | 'quarterly' | 'yearly'
  target_amount: number
  target_period_start: string
  target_period_end: string
  description?: string
  created_by: number
  created_by_name: string
  created_at: string
  updated_at: string
  is_active: boolean
}

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface TargetFormData {
  user_id: number
  target_type: 'monthly' | 'quarterly' | 'yearly'
  target_amount: number
  target_period_start: string
  target_period_end: string
  description: string
}

const TARGET_TYPES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' }
]

// Define columns for Sales Targets table
const SALES_TARGET_COLUMNS = defineColumns([
  { key: 'user', label: 'Sales Person' },
  { key: 'type', label: 'Type' },
  { key: 'amount', label: 'Target Amount' },
  { key: 'period', label: 'Period' },
  { key: 'description', label: 'Description' },
  { key: 'created_by', label: 'Created By' },
])

export default function SalesTargets() {
  const { user, hasPermission } = useAuth()
  const canWrite = hasPermission('sales_targets:write')
  const [targets, setTargets] = useState<SalesTarget[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selectedTargetType, setSelectedTargetType] = useState<'monthly' | 'quarterly' | 'yearly' | 'all'>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<SalesTarget | null>(null)
  const [formData, setFormData] = useState<TargetFormData>({
    user_id: 0,
    target_type: 'monthly',
    target_amount: 0,
    target_period_start: '',
    target_period_end: '',
    description: ''
  })

  // Column visibility hook
  const {
    visibleColumns,
    toggleColumn,
    isColumnVisible,
    resetColumns,
    showAllColumns,
    hideAllColumns,
    isSyncing
  } = useColumnVisibility('sales_targets', getDefaultColumnKeys(SALES_TARGET_COLUMNS))

  useEffect(() => {
    loadTargets()
    loadUsers()
  }, [])

  useEffect(() => {
    loadTargets()
  }, [selectedTargetType])

  const loadTargets = async () => {
    try {
      setLoading(true)
      const params: any = { is_active: true }
      if (selectedTargetType !== 'all') {
        params.target_type = selectedTargetType
      }
      const response = await apiService.getSalesTargets(params)
      setTargets(response.data.targets || [])
    } catch (error) {
      console.error('Error loading targets:', error)
      setTargets([])
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      setUsersLoading(true)
      const response = await apiService.request('/users/sales')
      setUsers(response.data || [])
    } catch (error) {
      console.error('Error loading users:', error)
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  const handleCreateTarget = () => {
    setEditingTarget(null)
    setFormData({
      user_id: 0,
      target_type: 'monthly',
      target_amount: 0,
      target_period_start: '',
      target_period_end: '',
      description: ''
    })
    setIsDialogOpen(true)
  }

  const handleEditTarget = (target: SalesTarget) => {
    setEditingTarget(target)
    setFormData({
      user_id: target.user_id,
      target_type: target.target_type,
      target_amount: target.target_amount,
      target_period_start: target.target_period_start,
      target_period_end: target.target_period_end,
      description: target.description || ''
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingTarget) {
        // Update existing target
        await apiService.updateSalesTarget(editingTarget.id.toString(), formData)
        toast.success('Target updated successfully', {
          description: `Updated ${formData.target_type} target for ${users.find(u => u.id === formData.user_id)?.name}`
        })
      } else {
        // Create new target
        await apiService.createSalesTarget(formData)
        toast.success('Target created successfully', {
          description: `Created ${formData.target_type} target for ${users.find(u => u.id === formData.user_id)?.name}`
        })
      }
      
      setIsDialogOpen(false)
      loadTargets()
    } catch (error) {
      console.error('Error saving target:', error)
      toast.error('Failed to save target', {
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    }
  }

  const handleDeleteTarget = async (targetId: number) => {
    const target = targets.find(t => t.id === targetId)
    if (window.confirm('Are you sure you want to deactivate this target?')) {
      try {
        await apiService.deleteSalesTarget(targetId.toString())
        toast.success('Target deleted successfully', {
          description: target ? `Deleted ${target.target_type} target for ${target.user_name}` : 'Target has been removed'
        })
        loadTargets()
      } catch (error) {
        console.error('Error deleting target:', error)
        toast.error('Failed to delete target', {
          description: error instanceof Error ? error.message : 'An error occurred'
        })
      }
    }
  }

  const getTargetTypeColor = (type: string) => {
    switch (type) {
      case 'monthly': return 'bg-blue-100 text-blue-800'
      case 'quarterly': return 'bg-green-100 text-green-800'
      case 'yearly': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const calculatePeriodDates = (type: 'monthly' | 'quarterly' | 'yearly') => {
    const now = new Date()
    let start: Date
    let end: Date

    switch (type) {
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        break
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3)
        start = new Date(now.getFullYear(), quarter * 3, 1)
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0)
        break
      case 'yearly':
        start = new Date(now.getFullYear(), 0, 1)
        end = new Date(now.getFullYear(), 11, 31)
        break
    }

    setFormData(prev => ({
      ...prev,
      target_period_start: start.toISOString().split('T')[0],
      target_period_end: end.toISOString().split('T')[0]
    }))
  }

  return (
    <MainLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Targets</h1>
          <p className="text-muted-foreground">
            Manage sales targets for your team members
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="target-type-filter">Filter by type:</Label>
            <Select value={selectedTargetType} onValueChange={(value: 'monthly' | 'quarterly' | 'yearly' | 'all') => setSelectedTargetType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TARGET_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canWrite && (
            <Button onClick={handleCreateTarget} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Target
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Targets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{targets?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active {selectedTargetType === 'all' ? 'targets' : `${selectedTargetType} targets`} across all sales users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usersLoading ? '...' : (users?.length || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Active sales team members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Target Value</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(targets?.reduce((sum, target) => sum + target.target_amount, 0) || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Combined target amount
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Targets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedTargetType === 'all' ? 'Current Targets' : `${TARGET_TYPES.find(t => t.value === selectedTargetType)?.label} Targets`}
              </CardTitle>
              <CardDescription>
                {selectedTargetType === 'all' 
                  ? 'View and manage all active sales targets' 
                  : `View and manage all active ${selectedTargetType} sales targets`
                }
              </CardDescription>
            </div>
            {/* Column Visibility */}
            <ColumnVisibilityDropdown
              columns={SALES_TARGET_COLUMNS}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onShowAll={showAllColumns}
              onHideAll={hideAllColumns}
              onReset={resetColumns}
              isSyncing={isSyncing}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading targets...</div>
          ) : !targets || targets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No targets found. Create your first target to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isColumnVisible('user') && <TableHead>User</TableHead>}
                  {isColumnVisible('type') && <TableHead>Type</TableHead>}
                  {isColumnVisible('amount') && <TableHead>Target Amount</TableHead>}
                  {isColumnVisible('period') && <TableHead>Period</TableHead>}
                  {isColumnVisible('created_by') && <TableHead>Created By</TableHead>}
                  {canWrite && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets?.map((target) => (
                  <TableRow key={target.id}>
                    {isColumnVisible('user') && (
                      <TableCell>
                        <div>
                          <div className="font-medium">{target.user_name}</div>
                          <div className="text-sm text-muted-foreground">{target.user_email}</div>
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('type') && (
                      <TableCell>
                        <Badge className={getTargetTypeColor(target.target_type)}>
                          {target.target_type}
                        </Badge>
                      </TableCell>
                    )}
                    {isColumnVisible('amount') && (
                      <TableCell className="font-medium">
                        {formatCurrency(target.target_amount)}
                      </TableCell>
                    )}
                    {isColumnVisible('period') && (
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(target.target_period_start), 'MMM dd, yyyy')}</div>
                          <div className="text-muted-foreground">to {format(new Date(target.target_period_end), 'MMM dd, yyyy')}</div>
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('created_by') && (
                      <TableCell>
                        <div className="text-sm">
                          <div>{target.created_by_name}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(target.created_at), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {canWrite && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditTarget(target)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Target
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteTarget(target.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Target Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTarget ? 'Edit Target' : 'Create New Target'}
            </DialogTitle>
            <DialogDescription>
              {editingTarget 
                ? 'Update the target details below.'
                : 'Set a new sales target for a team member.'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user_id">Sales User</Label>
              <Select 
                value={formData.user_id.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a sales user" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.email})
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_type">Target Type</Label>
              <Select 
                value={formData.target_type} 
                onValueChange={(value: 'monthly' | 'quarterly' | 'yearly') => {
                  setFormData(prev => ({ ...prev, target_type: value }))
                  calculatePeriodDates(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target type" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_amount">Target Amount (KM)</Label>
              <Input
                id="target_amount"
                type="number"
                step="0.01"
                value={formData.target_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, target_amount: parseFloat(e.target.value) || 0 }))}
                placeholder="Enter target amount"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_period_start">Start Date</Label>
                <DatePicker
                  value={formData.target_period_start}
                  onChange={(value) => setFormData(prev => ({ ...prev, target_period_start: value }))}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_period_end">End Date</Label>
                <DatePicker
                  value={formData.target_period_end}
                  onChange={(value) => setFormData(prev => ({ ...prev, target_period_end: value }))}
                  placeholder="Select end date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTarget ? 'Update Target' : 'Create Target'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  )
}
