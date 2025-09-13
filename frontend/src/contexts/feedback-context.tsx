import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth-context'
import { useWebSocket } from './websocket-context'
import { useNotifications } from './notifications-context'

interface FeedbackItem {
  id: number
  message: string
  type: 'bug' | 'feature' | 'improvement' | 'complaint' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  page_url: string
  user_agent: string
  created_at: string
  updated_at: string
  user: {
    id: number
    name: string
    role: string
  }
  admin_notes?: string
  resolved_at?: string
}

interface FeedbackContextType {
  feedbackItems: FeedbackItem[]
  isLoading: boolean
  error: string | null
  unreadFeedbackCount: number
  refreshFeedback: () => Promise<void>
  submitFeedback: (data: {
    message: string
    type: string
    priority: string
    page_url: string
    user_agent: string
    timestamp: string
  }) => Promise<void>
  updateFeedbackStatus: (id: number, status: string, adminNotes?: string) => Promise<void>
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined)

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0)
  const { user, isAuthenticated } = useAuth()
  const { socket, isConnected } = useWebSocket()
  const { addNotification } = useNotifications()

  const refreshFeedback = useCallback(async () => {
    if (!isAuthenticated) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('http://localhost:3000/api/feedback', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch feedback')
      }
      
      const data = await response.json()
      setFeedbackItems(data.data || [])
      
      // Calculate unread feedback count (open and in_progress status)
      const unreadCount = (data.data || []).filter((item: FeedbackItem) => 
        item.status === 'open' || item.status === 'in_progress'
      ).length
      setUnreadFeedbackCount(unreadCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching feedback:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const submitFeedback = async (data: {
    message: string
    type: string
    priority: string
    page_url: string
    user_agent: string
    timestamp: string
  }) => {
    try {
      const response = await fetch('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }
      
      // Refresh the feedback list if user is admin
      if (user?.role === 'admin') {
        await refreshFeedback()
      }
    } catch (err) {
      console.error('Error submitting feedback:', err)
      throw err
    }
  }

  const updateFeedbackStatus = async (id: number, status: string, adminNotes?: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/feedback/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, admin_notes: adminNotes })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update feedback')
      }
      
      // Refresh the feedback list
      await refreshFeedback()
    } catch (err) {
      console.error('Error updating feedback:', err)
      throw err
    }
  }

  // Auto-refresh feedback for admins
  useEffect(() => {
    if (user?.role === 'admin') {
      refreshFeedback()
      
      // Refresh every 30 seconds
      const interval = setInterval(refreshFeedback, 30000)
      return () => clearInterval(interval)
    }
  }, [user?.role, refreshFeedback])

  // Listen for real-time feedback notifications
  useEffect(() => {
    if (!socket || !isConnected || user?.role !== 'admin') return

    console.log('🔔 Setting up feedback notification listener for admin')

    const handleFeedbackSubmitted = (data: any) => {
      console.log('🔔 Received feedback notification:', data)
      
      // Refresh the feedback list to show the new feedback
      refreshFeedback()
      
      // Add to notifications system (notification bell)
      const typeLabels = {
        bug: 'Bug Report',
        feature: 'Feature Request', 
        improvement: 'Improvement',
        complaint: 'Complaint',
        other: 'Other'
      }
      
      const priorityLabels = {
        urgent: 'Urgent',
        high: 'High',
        medium: 'Medium', 
        low: 'Low'
      }
      
      console.log('🔔 Adding to notification bell:', {
        type: data.type,
        priority: data.priority,
        user: data.user.name,
        page: data.page_url
      })
      
      // Add to notifications system (this will show in the notification bell)
      addNotification({
        id: Date.now(), // Temporary ID for local notification
        title: `New ${typeLabels[data.type as keyof typeof typeLabels] || 'Feedback'} - ${priorityLabels[data.priority as keyof typeof priorityLabels] || data.priority} Priority`,
        message: `${data.user.name} submitted feedback from ${data.page_url}: "${data.message}"`,
        type: 'info',
        is_read: false,
        related_entity_type: 'feedback',
        related_entity_id: data.id,
        created_at: new Date().toISOString()
      })
      
      console.log('🔔 Notification added to bell')
    }

    socket.on('feedback_submitted', handleFeedbackSubmitted)

    return () => {
      console.log('🔔 Cleaning up feedback notification listener')
      socket.off('feedback_submitted', handleFeedbackSubmitted)
    }
  }, [socket, isConnected, user?.role, refreshFeedback])

  return (
    <FeedbackContext.Provider
      value={{
        feedbackItems,
        isLoading,
        error,
        unreadFeedbackCount,
        refreshFeedback,
        submitFeedback,
        updateFeedbackStatus
      }}
    >
      {children}
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (context === undefined) {
    throw new Error('useFeedback must be used within a FeedbackProvider')
  }
  return context
}
