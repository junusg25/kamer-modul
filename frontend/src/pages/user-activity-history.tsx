import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { DatePicker } from '../components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { 
  ArrowLeft,
  Download,
  Filter,
  RefreshCw,
  Search,
  Calendar,
  User,
  Activity,
  FileText,
  Edit,
  Trash2,
  Plus,
  Settings,
  ShoppingCart,
  Package,
  Wrench,
  Users,
  ChevronRight
} from 'lucide-react'
import { formatDateTime } from '../lib/dateTime'
import apiService from '../services/api'
import { toast } from 'sonner'

interface ActionLog {
  id: number
  user_id: number
  user_name: string
  user_role: string
  action_type: string
  entity_type: string
  entity_id: number | null
  entity_name: string | null
  action_details: any
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface UserInfo {
  id: number
  name: string
  email: string
  role: string
  status: string
}

interface Statistics {
  total_actions: string
  entity_types_count: string
  creates: string
  updates: string
  deletes: string
  today_actions: string
  week_actions: string
  month_actions: string
  first_action: string | null
  last_action: string | null
}

interface EntityBreakdown {
  entity_type: string
  count: string
  creates: string
  updates: string
  deletes: string
}

export default function UserActivityHistory() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [breakdown, setBreakdown] = useState<EntityBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    action_type: '',
    entity_type: '',
    start_date: '',
    end_date: ''
  })

  useEffect(() => {
    if (userId) {
      fetchActionLogs()
    }
  }, [userId, page, filters])

  const fetchActionLogs = async () => {
    try {
      setLoading(true)
      const response = await apiService.getUserActionLogs(userId!, {
        ...filters,
        page,
        limit: 50
      })

      setLogs(response.data.logs)
      setUserInfo(response.data.user)
      setStatistics(response.data.statistics)
      setBreakdown(response.data.breakdown)
      setTotalPages(response.pagination.pages)
    } catch (error: any) {
      console.error('Error fetching action logs:', error)
      toast.error(t('pages.admin.failed_to_load_action_logs'))
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }))
    setPage(1) // Reset to first page when filter changes
  }

  const handleClearFilters = () => {
    setFilters({
      action_type: '',
      entity_type: '',
      start_date: '',
      end_date: ''
    })
    setPage(1)
  }

  const handleExport = () => {
    // Export to CSV
    const headers = [t('pages.admin.date_time'), t('pages.admin.action'), t('pages.admin.entity_type'), t('pages.admin.entity'), t('pages.admin.details'), t('pages.admin.ip_address')]
    const csvData = logs.map(log => [
      formatDateTime(log.created_at),
      getActionLabel(log.action_type),
      getEntityLabel(log.entity_type),
      log.entity_name || '-',
      JSON.stringify(log.action_details),
      log.ip_address || '-'
    ])
    
    const csv = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user-${userId}-activity-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success(t('pages.admin.activity_log_exported_successfully'))
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return <Plus className="h-4 w-4 text-green-600" />
      case 'update':
      case 'edit':
        return <Edit className="h-4 w-4 text-blue-600" />
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-600" />
      case 'convert':
        return <ChevronRight className="h-4 w-4 text-purple-600" />
      case 'assign':
        return <User className="h-4 w-4 text-indigo-600" />
      case 'sell':
        return <ShoppingCart className="h-4 w-4 text-emerald-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getActionLabel = (actionType: string) => {
    return t(`pages.admin.${actionType}`)
  }

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'customer':
        return <Users className="h-4 w-4" />
      case 'work_order':
      case 'warranty_work_order':
        return <Wrench className="h-4 w-4" />
      case 'machine':
        return <Settings className="h-4 w-4" />
      case 'inventory':
        return <Package className="h-4 w-4" />
      case 'repair_ticket':
      case 'warranty_repair_ticket':
        return <FileText className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getEntityLabel = (entityType: string) => {
    return t(`pages.admin.${entityType}`)
  }

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return 'bg-green-100 text-green-800'
      case 'update':
      case 'edit':
        return 'bg-blue-100 text-blue-800'
      case 'delete':
        return 'bg-red-100 text-red-800'
      case 'convert':
        return 'bg-purple-100 text-purple-800'
      case 'assign':
        return 'bg-indigo-100 text-indigo-800'
      case 'sell':
        return 'bg-emerald-100 text-emerald-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== '').length
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/admin')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
{t('pages.admin.back_to_admin_dashboard')}
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{t('pages.admin.user_activity_history')}</h1>
              {userInfo && (
                <p className="text-muted-foreground">
                  {userInfo.name} ({userInfo.email}) • {userInfo.role}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchActionLogs}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
{t('pages.admin.refresh')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
{t('pages.admin.export_csv')}
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('pages.admin.total_actions')}</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.total_actions}</div>
                <p className="text-xs text-muted-foreground">
{statistics.today_actions} {t('pages.admin.today')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('pages.admin.creates')}</CardTitle>
                <Plus className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{statistics.creates}</div>
                <p className="text-xs text-muted-foreground">
{t('pages.admin.new_items_created')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('pages.admin.updates')}</CardTitle>
                <Edit className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{statistics.updates}</div>
                <p className="text-xs text-muted-foreground">
{t('pages.admin.items_modified')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('pages.admin.deletes')}</CardTitle>
                <Trash2 className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{statistics.deletes}</div>
                <p className="text-xs text-muted-foreground">
{t('pages.admin.items_removed')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Entity Breakdown */}
        {breakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.admin.activity_breakdown_by_entity')}</CardTitle>
              <CardDescription>
{t('pages.admin.distribution_of_actions')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {breakdown.map((item) => (
                  <div key={item.entity_type} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getEntityIcon(item.entity_type)}
                        <span className="font-medium">{getEntityLabel(item.entity_type)}</span>
                      </div>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>{t('pages.admin.creates')}:</span>
                        <span className="text-green-600">{item.creates}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('pages.admin.updates')}:</span>
                        <span className="text-blue-600">{item.updates}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('pages.admin.deletes')}:</span>
                        <span className="text-red-600">{item.deletes}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
{t('pages.admin.filters')}
                </CardTitle>
                <CardDescription>
{t('pages.admin.filter_activity_logs')}
                </CardDescription>
              </div>
              {getActiveFiltersCount() > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                >
{t('pages.admin.clear_filters')} ({getActiveFiltersCount()})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Action Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pages.admin.action_type')}</label>
                <Select
                  value={filters.action_type || 'all'}
                  onValueChange={(value) => handleFilterChange('action_type', value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.admin.all_actions')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('pages.admin.all_actions')}</SelectItem>
                    <SelectItem value="create">{t('pages.admin.create')}</SelectItem>
                    <SelectItem value="update">{t('pages.admin.update')}</SelectItem>
                    <SelectItem value="delete">{t('pages.admin.delete')}</SelectItem>
                    <SelectItem value="convert">{t('pages.admin.convert')}</SelectItem>
                    <SelectItem value="assign">{t('pages.admin.assign')}</SelectItem>
                    <SelectItem value="sell">{t('pages.admin.sell')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Entity Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pages.admin.entity_type')}</label>
                <Select
                  value={filters.entity_type || 'all'}
                  onValueChange={(value) => handleFilterChange('entity_type', value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.admin.all_entities')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('pages.admin.all_entities')}</SelectItem>
                    <SelectItem value="customer">{t('pages.admin.customer')}</SelectItem>
                    <SelectItem value="machine">{t('pages.admin.machine')}</SelectItem>
                    <SelectItem value="work_order">{t('pages.admin.work_order')}</SelectItem>
                    <SelectItem value="warranty_work_order">{t('pages.admin.warranty_work_order')}</SelectItem>
                    <SelectItem value="repair_ticket">{t('pages.admin.repair_ticket')}</SelectItem>
                    <SelectItem value="warranty_repair_ticket">{t('pages.admin.warranty_repair_ticket')}</SelectItem>
                    <SelectItem value="inventory">{t('pages.admin.inventory')}</SelectItem>
                    <SelectItem value="lead">{t('pages.admin.lead')}</SelectItem>
                    <SelectItem value="quote">{t('pages.admin.quote')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pages.admin.start_date')}</label>
                <DatePicker
                  value={filters.start_date}
                  onChange={(value) => handleFilterChange('start_date', value)}
                  placeholder={t('pages.admin.select_start_date')}
                />
              </div>

              {/* End Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pages.admin.end_date')}</label>
                <DatePicker
                  value={filters.end_date}
                  onChange={(value) => handleFilterChange('end_date', value)}
                  placeholder={t('pages.admin.select_end_date')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.admin.activity_timeline')}</CardTitle>
            <CardDescription>
{t('pages.admin.detailed_log_user_actions')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{t('pages.admin.loading_activity_logs')}</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
{t('pages.admin.no_activity_logs_found')}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('pages.admin.date_time')}</TableHead>
                      <TableHead>{t('pages.admin.action')}</TableHead>
                      <TableHead>{t('pages.admin.entity')}</TableHead>
                      <TableHead>{t('pages.admin.details')}</TableHead>
                      <TableHead>{t('pages.admin.ip_address')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getActionIcon(log.action_type)}
                            <Badge className={getActionColor(log.action_type)}>
                              {getActionLabel(log.action_type)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getEntityIcon(log.entity_type)}
                            <div>
                              <div className="font-medium">{getEntityLabel(log.entity_type)}</div>
                              {log.entity_name && (
                                <div className="text-sm text-muted-foreground">{log.entity_name}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.action_details && (
                            <div className="text-sm">
                              {log.action_details.updated_fields && (
                                <div className="text-muted-foreground">
{t('pages.admin.updated')}: {log.action_details.updated_fields.join(', ')}
                                </div>
                              )}
                              {log.action_details.status_change && (
                                <div className="text-muted-foreground">
{t('pages.admin.status')}: {log.action_details.status_change.from} → {log.action_details.status_change.to}
                                </div>
                              )}
                              {log.action_details.converted_to && (
                                <div className="text-muted-foreground">
{t('pages.admin.converted_to')} {log.action_details.converted_to}
                                </div>
                              )}
                              {log.action_details.sale_price && (
                                <div className="text-muted-foreground">
{t('pages.admin.sale_price')}: ${log.action_details.sale_price}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.ip_address || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
{t('pages.admin.page')} {page} {t('pages.admin.of')} {totalPages}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        disabled={page === 1}
                      >
{t('pages.admin.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={page === totalPages}
                      >
{t('pages.admin.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
