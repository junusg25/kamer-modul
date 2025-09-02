import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import toast from 'react-hot-toast';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const { user, logout } = useAuth();
  const { translate } = useLanguage();
  
  // Use refs to prevent infinite loops
  const socketRef = useRef(null);
  const isConnectingRef = useRef(false);
  const userRef = useRef(user);

  // Update user ref when user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Initialize socket connection
  const connectSocket = useCallback(() => {
    // Prevent multiple connection attempts
    if (isConnectingRef.current) {
      console.log('Connection already in progress, skipping...');
      return null;
    }

    if (!userRef.current) {
      console.log('No user, skipping WebSocket connection');
      return null;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token, skipping WebSocket connection');
      return null;
    }

    // Prevent multiple connections
    if (socketRef.current && socketRef.current.connected) {
      console.log('Socket already connected, skipping...');
      return socketRef.current;
    }

    isConnectingRef.current = true;
    console.log('Attempting to connect to WebSocket server...');

    // Get backend URL from environment or default to localhost:3000
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    
    const newSocket = io(backendUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: true
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
      isConnectingRef.current = false;
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      isConnectingRef.current = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, don't auto-reconnect
        console.log('Server disconnected us, not attempting to reconnect');
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
      
      // Don't logout on connection errors, just retry
      console.log('Connection error, will retry automatically');
      
      // Show a subtle toast only if it's a persistent error
      if (error.message.includes('ECONNREFUSED')) {
        console.log('Server not available, WebSocket will retry in background');
      }
    });

    // Notification events
    newSocket.on('notification_received', (data) => {
      console.log('Notification received in WebSocketContext:', data);
      
      // Don't show toast here - let NotificationBell handle it with proper translation
      // This prevents duplicate toast messages
    });

    // Work order events
    newSocket.on('work_order_updated', (data) => {
      console.log('Work order updated:', data);
      
      // Don't show toast here - let NotificationBell handle work order notifications
      // This prevents duplicate toast messages when work order notifications are created
    });

    newSocket.on('work_order_assignment_update', (data) => {
      console.log('Work order assignment update:', data);
      
      // Don't show toast here - let NotificationBell handle assignment notifications
      // This prevents duplicate toast messages when assignment notifications are created
    });

    // Repair ticket events
    newSocket.on('repair_ticket_updated', (data) => {
      console.log('Repair ticket updated:', data);
      
        // Show toast notification for repair ticket updates with translation
        let message;
        const params = { number: data.ticket.ticket_number };

        switch (data.action) {
          case 'created':
            message = translate('notifications.ticketCreatedMessage', params);
            break;
          case 'status_changed':
            message = translate('notifications.ticketStatusChangedMessage', {
              ...params,
              status: data.ticket.status
            });
            break;
          case 'updated':
          default:
            message = translate('notifications.ticketUpdatedMessage', params);
            break;
        }
      
      toast.success(message, {
        duration: 4000,
        position: 'top-right'
      });
    });

    // Handle machine updates
    newSocket.on('machine_updated', (data) => {
      console.log('Machine updated:', data);
      
      let message;
      const params = { name: data.machine.name };

      switch (data.action) {
        case 'created':
          message = translate('notifications.machineCreatedMessage', params);
          break;
        case 'updated':
          message = translate('notifications.machineUpdatedMessage', params);
          break;
        case 'deleted':
          message = translate('notifications.machineDeletedMessage', params);
          break;
        default:
          message = translate('notifications.machineUpdatedMessage', params);
          break;
      }
      
      toast.success(message, {
        duration: 4000,
        position: 'top-right'
      });
    });

    // Handle assigned machine updates
    newSocket.on('assigned_machine_updated', (data) => {
      console.log('Assigned machine updated:', data);
      
      let message;
      const params = { 
        machine: data.assignedMachine.machine_name,
        customer: data.assignedMachine.customer_name 
      };

      switch (data.action) {
        case 'created':
          message = translate('notifications.assignedMachineCreatedMessage', params);
          break;
        case 'updated':
          message = translate('notifications.assignedMachineUpdatedMessage', params);
          break;
        case 'deleted':
          message = translate('notifications.assignedMachineDeletedMessage', params);
          break;
        default:
          message = translate('notifications.assignedMachineUpdatedMessage', params);
          break;
      }
      
      toast.success(message, {
        duration: 4000,
        position: 'top-right'
      });
    });

    // Handle customer updates
    newSocket.on('customer_updated', (data) => {
      console.log('Customer updated:', data);
      
      let message;
      const params = { name: data.customer.name || data.customer.company_name };

      switch (data.action) {
        case 'created':
          message = translate('notifications.customerCreatedMessage', params);
          break;
        case 'updated':
          message = translate('notifications.customerUpdatedMessage', params);
          break;
        case 'deleted':
          message = translate('notifications.customerDeletedMessage', params);
          break;
        default:
          message = translate('notifications.customerUpdatedMessage', params);
          break;
      }
      
      toast.success(message, {
        duration: 4000,
        position: 'top-right'
      });
    });

    // Handle user updates
    newSocket.on('user_updated', (data) => {
      console.log('User updated:', data);
      
      let message;
      const params = { name: data.user.name };

      switch (data.action) {
        case 'created':
          message = translate('notifications.userCreatedMessage', params);
          break;
        case 'updated':
          message = translate('notifications.userUpdatedMessage', params);
          break;
        case 'deleted':
          message = translate('notifications.userDeletedMessage', params);
          break;
        default:
          message = translate('notifications.userUpdatedMessage', params);
          break;
      }
      
      toast.success(message, {
        duration: 4000,
        position: 'top-right'
      });
    });

    // User presence events
    newSocket.on('user_online', (data) => {
      console.log('User online:', data);
      setConnectedUsers(prev => {
        const existing = prev.find(u => u.userId === data.userId);
        if (!existing) {
          return [...prev, { userId: data.userId, userName: data.userName, online: true }];
        }
        return prev.map(u => u.userId === data.userId ? { ...u, online: true } : u);
      });
    });

    newSocket.on('user_offline', (data) => {
      console.log('User offline:', data);
      setConnectedUsers(prev => 
        prev.map(u => u.userId === data.userId ? { ...u, online: false } : u)
      );
    });

    // Typing indicators
    newSocket.on('user_typing_start', (data) => {
      console.log('User typing start:', data);
      // Handle typing indicators in chat components
    });

    newSocket.on('user_typing_stop', (data) => {
      console.log('User typing stop:', data);
      // Handle typing indicators in chat components
    });

    // User presence updates
    newSocket.on('user_presence_update', (data) => {
      console.log('User presence update:', data);
      // Handle user presence updates in work order components
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return newSocket;
  }, []); // Empty dependency array to prevent recreation

  // Disconnect socket
  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('Disconnecting WebSocket...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectedUsers([]);
      isConnectingRef.current = false;
    }
  }, []);

  // Join room
  const joinRoom = useCallback((roomName) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join_room', roomName);
      console.log(`Joined room: ${roomName}`);
    }
  }, [isConnected]);

  // Leave room
  const leaveRoom = useCallback((roomName) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave_room', roomName);
      console.log(`Left room: ${roomName}`);
    }
  }, [isConnected]);

  // Send typing indicator
  const sendTypingStart = useCallback((roomName, message = '') => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing_start', { roomName, message });
    }
  }, [isConnected]);

  const sendTypingStop = useCallback((roomName) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing_stop', { roomName });
    }
  }, [isConnected]);

  // Send user presence update
  const sendUserPresence = useCallback((status, workOrderId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('user_presence', { status, workOrderId });
    }
  }, [isConnected]);

  // Emit custom event
  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  }, [isConnected]);

  // Listen to custom events
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      
      // Return cleanup function
      return () => {
        socketRef.current?.off(event, callback);
      };
    }
  }, []);

  // Remove event listener
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  // Connect when user changes
  useEffect(() => {
    if (user) {
      console.log('User authenticated, connecting WebSocket...');
      const newSocket = connectSocket();
      
      return () => {
        if (newSocket) {
          console.log('Cleaning up WebSocket connection...');
          newSocket.disconnect();
        }
      };
    } else {
      console.log('No user, disconnecting WebSocket...');
      disconnectSocket();
    }
  }, [user?.id]); // Only depend on user ID, not the entire user object

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  const value = {
    socket,
    isConnected,
    connectedUsers,
    connectSocket,
    disconnectSocket,
    joinRoom,
    leaveRoom,
    sendTypingStart,
    sendTypingStop,
    sendUserPresence,
    emit,
    on,
    off
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
