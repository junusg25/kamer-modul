import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import apiService from '@/services/api'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'


export function TicketsChart() {
  const { isAuthenticated } = useAuth()
  const [ticketData, setTicketData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchTicketData()
    } else {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const fetchTicketData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiService.getDashboardStats() as any
      const stats = response.data.work_orders
      
      // Create ticket overview data
      const realTicketData = [
        { 
          type: 'Repair Tickets', 
          total: stats.repair_tickets_intake || 0, 
          converted: stats.repair_tickets_converted || 0 
        },
        { 
          type: 'Warranty Tickets', 
          total: stats.warranty_repair_tickets_intake || 0, 
          converted: stats.warranty_repair_tickets_converted || 0 
        }
      ].filter(item => item.total > 0 || item.converted > 0)
      
      setTicketData(realTicketData)
    } catch (err) {
      console.error('Error fetching ticket data:', err)
      setError('Failed to load ticket data')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Overview</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (error || ticketData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Overview</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {error || 'No ticket data available'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ticketData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" fill="#3b82f6" name="Total Tickets" />
            <Bar dataKey="converted" fill="#10b981" name="Converted" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function RevenueChart() {
  const { isAuthenticated } = useAuth()
  const [partsData, setPartsData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchPartsData()
    } else {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const fetchPartsData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiService.getDashboardStats() as any
      const parts = response.data.most_used_parts || []
      
      // Transform parts data for the chart
      const realPartsData = parts.map((part: any) => ({
        part: part.part_name || 'Unknown Part',
        used: part.total_used || 0,
        workOrders: part.work_orders_count || 0
      }))
      
      setPartsData(realPartsData)
    } catch (err) {
      console.error('Error fetching parts data:', err)
      setError('Failed to load parts data')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Most Used Parts</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (error || partsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Most Used Parts</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {error || 'No parts data available'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Used Parts</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={partsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="part" />
            <YAxis />
            <Tooltip formatter={(value, name) => [value, name === 'used' ? 'Quantity Used' : 'Work Orders']} />
            <Area 
              type="monotone" 
              dataKey="used" 
              stroke="#8b5cf6" 
              fill="#8b5cf6" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function StatusChart() {
  const { isAuthenticated } = useAuth()
  const [statusData, setStatusData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatusData()
    } else {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const fetchStatusData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiService.getDashboardStats() as any
      const stats = response.data.work_orders
      
      // Create status data from real work order statistics
      const realStatusData = [
        { 
          name: 'Completed', 
          value: stats.completed_orders || 0, 
          color: '#10b981' 
        },
        { 
          name: 'In Progress', 
          value: stats.active_orders || 0, 
          color: '#3b82f6' 
        },
        { 
          name: 'Pending', 
          value: stats.pending_orders || 0, 
          color: '#f59e0b' 
        },
        { 
          name: 'Warranty Completed', 
          value: stats.warranty_completed_orders || 0, 
          color: '#8b5cf6' 
        },
        { 
          name: 'Warranty In Progress', 
          value: stats.warranty_active_orders || 0, 
          color: '#06b6d4' 
        },
        { 
          name: 'Warranty Pending', 
          value: stats.warranty_pending_orders || 0, 
          color: '#f97316' 
        }
      ].filter(item => item.value > 0) // Only show categories with data
      
      setStatusData(realStatusData)
    } catch (err) {
      console.error('Error fetching status data:', err)
      setError('Failed to load status data')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Status Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (error || statusData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Status Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {error || 'No status data available'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Order Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function CategoryChart() {
  const { isAuthenticated } = useAuth()
  const [categoryData, setCategoryData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchCategoryData()
    } else {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const fetchCategoryData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiService.getDashboardStats() as any
      const machines = response.data.most_repaired_machines || []
      
      // Transform machine data for the chart
      const realCategoryData = machines.map((machine: any, index: number) => ({
        category: machine.name || `Machine ${index + 1}`,
        count: machine.repair_count || 0,
        percentage: 0 // Will be calculated if needed
      }))
      
      setCategoryData(realCategoryData)
    } catch (err) {
      console.error('Error fetching category data:', err)
      setError('Failed to load category data')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Most Repaired Machines</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (error || categoryData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Most Repaired Machines</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {error || 'No machine data available'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Repaired Machines</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#06b6d4" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
