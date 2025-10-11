import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './auth-context'
import { API_ROOT } from '../config/api'

interface WebSocketContextType {
  socket: Socket | null
  isConnected: boolean
  onlineUsers: Set<string>
  emitUserStatus: (status: 'online' | 'away' | 'offline') => void
  forceDisconnect: () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const { user, token, isAuthenticated } = useAuth()
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      // Clear any pending reconnect attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = undefined
      }
      
      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = undefined
      }
      
      // Disconnect if not authenticated
      if (socket) {
        
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
        setOnlineUsers(new Set())
      }
      return
    }

    // Connect to WebSocket
    const newSocket = io(API_ROOT, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      
      setIsConnected(true)
      
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      
      // Start heartbeat to keep user marked as online
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      heartbeatIntervalRef.current = setInterval(() => {
        newSocket.emit('heartbeat')
      }, 60000) // Send heartbeat every 60 seconds
    })

    newSocket.on('disconnect', () => {
      
      setIsConnected(false)
      
      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = undefined
      }
      
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = undefined
      }
      
      // Only attempt to reconnect if still authenticated
      if (isAuthenticated && token && user) {
        reconnectTimeoutRef.current = setTimeout(() => {
          // Double-check authentication state before reconnecting
          if (isAuthenticated && token && user) {
            newSocket.connect()
          }
        }, 3000)
      }
    })

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      setIsConnected(false)
    })

    // Listen for user status updates
    newSocket.on('user_online', (data: { userId: string, userName: string }) => {
      
      setOnlineUsers(prev => new Set([...prev, data.userId]))
    })

    newSocket.on('user_offline', (data: { userId: string, userName: string }) => {
      
      setOnlineUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(data.userId)
        return newSet
      })
    })

    // Listen for real-time user activity updates
    newSocket.on('user_activity_update', (data: { userId: string, status: string }) => {
      
      // This will be handled by the admin dashboard
    })

    setSocket(newSocket)

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      newSocket.disconnect()
    }
  }, [isAuthenticated, token, user])

  const emitUserStatus = (status: 'online' | 'away' | 'offline') => {
    if (socket && isConnected) {
      socket.emit('user_status_update', { status })
    }
  }

  const forceDisconnect = () => {
    if (socket) {
      
      socket.disconnect()
      setSocket(null)
      setIsConnected(false)
      setOnlineUsers(new Set())
    }
  }

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        emitUserStatus,
        forceDisconnect
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}
