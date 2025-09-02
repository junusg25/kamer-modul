import { useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useParams } from 'react-router-dom';

export const useRealTimeWorkOrder = (initialWorkOrder = null) => {
  const [workOrder, setWorkOrder] = useState(initialWorkOrder);
  const [isUpdating, setIsUpdating] = useState(false);
  const { socket, isConnected, joinRoom, leaveRoom } = useWebSocket();
  const { id } = useParams();

  useEffect(() => {
    if (!isConnected || !id) return;

    const roomName = `work_order_${id}`;
    
    // Join the work order room
    joinRoom(roomName);

    // Listen for work order updates
    const handleWorkOrderUpdate = (data) => {
      console.log('Real-time work order update received:', data);
      
      if (data.workOrderId === parseInt(id)) {
        setIsUpdating(true);
        
        // Update the work order state
        setWorkOrder(prevWorkOrder => ({
          ...prevWorkOrder,
          ...data.workOrder,
          lastUpdated: data.timestamp
        }));
        
        // Reset updating flag after a short delay
        setTimeout(() => {
          setIsUpdating(false);
        }, 2000);
      }
    };

    const handleWorkOrderAssignment = (data) => {
      console.log('Real-time work order assignment received:', data);
      
      if (data.workOrderId === parseInt(id)) {
        setWorkOrder(prevWorkOrder => ({
          ...prevWorkOrder,
          ...data.workOrder,
          lastUpdated: data.timestamp
        }));
      }
    };

    // Add event listeners
    if (socket) {
      socket.on('work_order_updated', handleWorkOrderUpdate);
      socket.on('work_order_assignment_update', handleWorkOrderAssignment);
      
      return () => {
        socket.off('work_order_updated', handleWorkOrderUpdate);
        socket.off('work_order_assignment_update', handleWorkOrderAssignment);
        leaveRoom(roomName);
      };
    }
  }, [isConnected, id, socket, joinRoom, leaveRoom]);

  // Send user presence updates
  const sendPresenceUpdate = (status) => {
    if (isConnected && id) {
      // This would be implemented in the WebSocket context
      // For now, we'll just log it
      console.log('Sending presence update:', { status, workOrderId: id });
    }
  };

  // Send typing indicator
  const sendTypingIndicator = (isTyping) => {
    if (isConnected && id) {
      const roomName = `work_order_${id}`;
      if (isTyping) {
        // sendTypingStart(roomName);
        console.log('Sending typing start');
      } else {
        // sendTypingStop(roomName);
        console.log('Sending typing stop');
      }
    }
  };

  return {
    workOrder,
    setWorkOrder,
    isUpdating,
    isConnected,
    sendPresenceUpdate,
    sendTypingIndicator
  };
};
