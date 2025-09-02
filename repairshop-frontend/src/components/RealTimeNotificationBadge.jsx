import React, { useState, useEffect } from 'react';
import { Badge, IconButton, Tooltip, Box } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';

export default function RealTimeNotificationBadge({ onClick }) {
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const { isConnected } = useWebSocket();
  const { user } = useAuth();

  // Listen for real-time notification updates
  useEffect(() => {
    if (!isConnected) return;

    const handleNotificationReceived = (data) => {
      console.log('Real-time notification received:', data);
      setNotificationCount(prev => prev + 1);
      setHasNewNotifications(true);
      
      // Reset new notification indicator after 5 seconds
      setTimeout(() => {
        setHasNewNotifications(false);
      }, 5000);
    };

    const handleNotificationCountUpdate = (data) => {
      console.log('Notification count updated:', data);
      // You can implement logic to fetch updated count from API
      // For now, we'll just increment the local count
      setNotificationCount(prev => prev + 1);
    };

    // Add event listeners
    const socket = window.socket; // Access socket from global scope or context
    if (socket) {
      socket.on('notification_received', handleNotificationReceived);
      socket.on('notification_count_updated', handleNotificationCountUpdate);
      
      return () => {
        socket.off('notification_received', handleNotificationReceived);
        socket.off('notification_count_updated', handleNotificationCountUpdate);
      };
    }
  }, [isConnected]);

  // Fetch initial notification count
  useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const response = await fetch('/api/notifications/count', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setNotificationCount(data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    };

    if (user) {
      fetchNotificationCount();
    }
  }, [user]);

  return (
    <Box sx={{ position: 'relative' }}>
      <Tooltip title={isConnected ? 'Real-time notifications active' : 'Notifications (offline)'}>
        <IconButton
          color="inherit"
          onClick={onClick}
          sx={{
            position: 'relative',
            '&::after': hasNewNotifications ? {
              content: '""',
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#ff4444',
              animation: 'pulse 2s infinite'
            } : {}
          }}
        >
          <NotificationsIcon />
          <Badge
            badgeContent={notificationCount}
            color="error"
            sx={{
              '& .MuiBadge-badge': {
                backgroundColor: hasNewNotifications ? '#ff4444' : '#f44336',
                animation: hasNewNotifications ? 'pulse 2s infinite' : 'none'
              }
            }}
          />
        </IconButton>
      </Tooltip>
      
      {/* Connection status indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: isConnected ? '#4caf50' : '#f44336',
          border: '1px solid white'
        }}
      />
      
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </Box>
  );
}
