import React, { useState, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { useFeedback } from '../contexts/feedback-context'
import { useAuth } from '../contexts/auth-context'
import { formatDate, formatDateTime } from '../lib/dateTime'
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  ThumbsDown, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle,
  Eye,
  Edit,
  Trash2,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react'

export default function AdminFeedback() {
  const { feedbackItems, isLoading, error, refreshFeedback, updateFeedbackStatus } = useFeedback()
  const { user } = useAuth()
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const feedbackTypes = [
    { value: 'bug', label: 'Bug Report', icon: Bug, color: 'bg-red-100 text-red-800' },
    { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'bg-blue-100 text-blue-800' },
    { value: 'improvement', label: 'Improvement', icon: ThumbsDown, color: 'bg-green-100 text-green-800' },
    { value: 'complaint', label: 'Complaint', icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800' },
    { value: 'other', label: 'Other', icon: MessageSquare, color: 'bg-gray-100 text-gray-800' }
  ]

  const statusOptions = [
    { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-800' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-800' },
    { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' }
  ]

  const priorityOptions = [
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' }
  ]

  const filteredFeedback = feedbackItems.filter(feedback => {
    const matchesStatus = statusFilter === 'all' || feedback.status === statusFilter
    const matchesType = typeFilter === 'all' || feedback.type === typeFilter
    const matchesPriority = priorityFilter === 'all' || feedback.priority === priorityFilter
    const matchesSearch = searchTerm === '' || 
      feedback.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.page_url.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesType && matchesPriority && matchesSearch
  })

  const handleStatusUpdate = async (feedbackId: number, newStatus: string) => {
    try {
      await updateFeedbackStatus(feedbackId, newStatus, adminNotes)
      setAdminNotes('')
      setSelectedFeedback(null)
    } catch (error) {
      console.error('Error updating feedback:', error)
      alert('Failed to update feedback status')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />
      case 'in_progress': return <RefreshCw className="h-4 w-4" />
      case 'resolved': return <CheckCircle className="h-4 w-4" />
      case 'closed': return <XCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getTypeIcon = (type: string) => {
    const typeInfo = feedbackTypes.find(t => t.value === type)
    return typeInfo ? <typeInfo.icon className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />
  }

  if (user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can view feedback.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Feedback</h1>
            <p className="text-muted-foreground">Manage user feedback, bug reports, and feature requests</p>
          </div>
          <Button onClick={refreshFeedback} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{feedbackItems.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {feedbackItems.filter(f => f.status === 'open').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bug Reports</CardTitle>
              <Bug className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {feedbackItems.filter(f => f.type === 'bug').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgent Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {feedbackItems.filter(f => f.priority === 'urgent').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {feedbackTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {priorityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search feedback..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-red-600">
                  <p>Error loading feedback: {error}</p>
                  <Button onClick={refreshFeedback} className="mt-4">
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filteredFeedback.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4" />
                  <p>No feedback found matching your filters.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredFeedback.map((feedback) => {
              const typeInfo = feedbackTypes.find(t => t.value === feedback.type)
              const statusInfo = statusOptions.find(s => s.value === feedback.status)
              const priorityInfo = priorityOptions.find(p => p.value === feedback.priority)
              
              return (
                <Card key={feedback.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(feedback.type)}
                          <CardTitle className="text-lg">
                            {typeInfo?.label || feedback.type}
                          </CardTitle>
                          <Badge className={typeInfo?.color}>
                            {typeInfo?.label}
                          </Badge>
                          <Badge className={statusInfo?.color}>
                            {getStatusIcon(feedback.status)}
                            <span className="ml-1">{statusInfo?.label}</span>
                          </Badge>
                          <Badge className={priorityInfo?.color}>
                            {priorityInfo?.label}
                          </Badge>
                        </div>
                        <CardDescription>
                          From <strong>{feedback.user.name}</strong> ({feedback.user.role}) • 
                          {formatDateTime(feedback.created_at)}
                        </CardDescription>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                {getTypeIcon(feedback.type)}
                                {typeInfo?.label || feedback.type}
                              </DialogTitle>
                              <DialogDescription>
                                Feedback from {feedback.user.name} • {formatDateTime(feedback.created_at)}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                <Badge className={typeInfo?.color}>
                                  {typeInfo?.label}
                                </Badge>
                                <Badge className={statusInfo?.color}>
                                  {statusInfo?.label}
                                </Badge>
                                <Badge className={priorityInfo?.color}>
                                  {priorityInfo?.label}
                                </Badge>
                              </div>
                              
                              <div>
                                <h4 className="font-medium mb-2">Message:</h4>
                                <p className="text-sm bg-muted p-3 rounded-md">
                                  {feedback.message}
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <strong>Page:</strong> {feedback.page_url}
                                </div>
                                <div>
                                  <strong>Updated:</strong> {formatDateTime(feedback.updated_at)}
                                </div>
                              </div>
                              
                              {feedback.admin_notes && (
                                <div>
                                  <h4 className="font-medium mb-2">Admin Notes:</h4>
                                  <p className="text-sm bg-blue-50 p-3 rounded-md">
                                    {feedback.admin_notes}
                                  </p>
                                </div>
                              )}
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Admin Notes:</label>
                                <Textarea
                                  placeholder="Add notes about this feedback..."
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  className="min-h-[100px]"
                                />
                              </div>
                              
                              <div className="flex gap-2">
                                {statusOptions.map(option => (
                                  <Button
                                    key={option.value}
                                    variant={feedback.status === option.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                      setSelectedFeedback(feedback)
                                      handleStatusUpdate(feedback.id, option.value)
                                    }}
                                  >
                                    {getStatusIcon(option.value)}
                                    <span className="ml-1">{option.label}</span>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {feedback.message}
                    </p>
                    {feedback.admin_notes && (
                      <div className="mt-3 p-2 bg-blue-50 rounded-md">
                        <p className="text-xs font-medium text-blue-800 mb-1">Admin Notes:</p>
                        <p className="text-xs text-blue-700">{feedback.admin_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </MainLayout>
  )
}
