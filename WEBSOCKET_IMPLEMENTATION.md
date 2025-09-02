# WebSocket Real-Time Notifications Implementation

## Overview

This document describes the real-time notification system implemented using WebSocket technology in the Repair Shop Management System. The system provides instant updates for work orders, repair tickets, notifications, and user presence.

## Architecture

### Backend Components

1. **WebSocket Service** (`services/websocketService.js`)
   - Manages Socket.IO server instance
   - Handles user connections and disconnections
   - Manages room-based communication
   - Emits real-time events

2. **Notification Integration** (`utils/notificationHelpers.js`)
   - Enhanced to emit WebSocket events when notifications are created
   - Maintains backward compatibility with existing notification system

3. **Route Integration** (`routes/workOrders.js`, etc.)
   - Added WebSocket event emission for work order updates
   - Real-time status change notifications
   - Assignment updates

4. **Admin Routes** (`routes/websocket.js`)
   - WebSocket connection monitoring
   - Debug endpoints for testing
   - Health check endpoints

### Frontend Components

1. **WebSocket Context** (`contexts/WebSocketContext.jsx`)
   - Manages Socket.IO client connection
   - Provides hooks for components
   - Handles reconnection logic
   - Event listeners for real-time updates

2. **Real-Time Components**
   - `RealTimeNotificationBadge.jsx` - Live notification counter
   - `WebSocketStatus.jsx` - Connection status indicator
   - `useRealTimeWorkOrder.js` - Hook for work order updates

## Features

### Real-Time Notifications
- **Instant Updates**: Notifications appear immediately without page refresh
- **Toast Messages**: User-friendly popup notifications
- **Badge Updates**: Live notification count updates
- **Connection Status**: Visual indicator of WebSocket connection

### Work Order Updates
- **Status Changes**: Real-time status updates
- **Assignment Updates**: Instant technician assignment notifications
- **General Updates**: Description and priority changes
- **Room-based Communication**: Users join work order-specific rooms

### User Presence
- **Online/Offline Status**: Track user connection status
- **Role-based Rooms**: Users join rooms based on their role
- **Admin Monitoring**: Admins can see all connected users

### Typing Indicators
- **Real-time Typing**: Show when users are typing in forms
- **Room-based**: Typing indicators are scoped to specific work orders

## API Endpoints

### WebSocket Admin Endpoints

```
GET /api/websocket/stats          # Get connection statistics (admin only)
GET /api/websocket/health         # WebSocket health check
GET /api/websocket/user/:id/rooms # Get user's rooms (debug)
POST /api/websocket/emit/:userId  # Emit test message to user (admin)
POST /api/websocket/emit/room/:roomName # Emit test message to room (admin)
POST /api/websocket/emit/role/:role # Emit test message to role (admin)
```

### WebSocket Events

#### Client to Server
- `join_room` - Join a specific room
- `leave_room` - Leave a specific room
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `user_presence` - Update user presence status

#### Server to Client
- `notification_received` - New notification received
- `notification_count_updated` - Notification count changed
- `work_order_updated` - Work order updated
- `work_order_assignment_update` - Work order assignment changed
- `repair_ticket_updated` - Repair ticket updated
- `user_online` - User came online
- `user_offline` - User went offline
- `user_typing_start` - User started typing
- `user_typing_stop` - User stopped typing
- `user_presence_update` - User presence changed

## Room System

### Room Types
1. **User Rooms**: `user_{userId}` - User-specific notifications
2. **Role Rooms**: `role_{role}` - Role-based notifications (admin, manager, technician)
3. **Work Order Rooms**: `work_order_{workOrderId}` - Work order specific updates
4. **Ticket Rooms**: `ticket_{ticketId}` - Repair ticket specific updates
5. **Admin Room**: `admin_room` - Admin-only notifications

### Room Management
- Users automatically join role-based rooms on connection
- Users join work order rooms when viewing work order details
- Room membership is tracked and cleaned up on disconnection

## Authentication

### JWT Token Validation
- WebSocket connections require valid JWT tokens
- Tokens are validated on connection
- Invalid tokens result in connection rejection
- Token expiration triggers automatic logout

### Authorization
- Role-based room access
- Admin-only endpoints for monitoring
- User-specific event filtering

## Error Handling

### Connection Errors
- Automatic reconnection attempts
- Exponential backoff strategy
- Connection status indicators
- Graceful degradation when WebSocket unavailable

### Event Errors
- Failed events don't break the application
- Error logging for debugging
- Fallback to traditional API calls

## Performance Considerations

### Connection Limits
- Rate limiting on WebSocket events
- Connection pooling for multiple users
- Memory management for connected users

### Scalability
- Room-based architecture for efficient message routing
- Event filtering to reduce unnecessary updates
- Connection cleanup on user disconnection

## Usage Examples

### Using WebSocket Context in Components

```jsx
import { useWebSocket } from '../contexts/WebSocketContext';

function MyComponent() {
  const { isConnected, joinRoom, leaveRoom, emit } = useWebSocket();
  
  useEffect(() => {
    if (isConnected) {
      joinRoom('work_order_123');
      
      return () => {
        leaveRoom('work_order_123');
      };
    }
  }, [isConnected, joinRoom, leaveRoom]);
  
  return (
    <div>
      Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );
}
```

### Using Real-Time Work Order Hook

```jsx
import { useRealTimeWorkOrder } from '../hooks/useRealTimeWorkOrder';

function WorkOrderDetail() {
  const { workOrder, isUpdating, isConnected } = useRealTimeWorkOrder(initialWorkOrder);
  
  return (
    <div>
      {isUpdating && <div>Updating...</div>}
      <div>Status: {workOrder?.status}</div>
      <div>Connection: {isConnected ? 'Live' : 'Offline'}</div>
    </div>
  );
}
```

### Real-Time Notification Badge

```jsx
import RealTimeNotificationBadge from '../components/RealTimeNotificationBadge';

function Header() {
  return (
    <header>
      <RealTimeNotificationBadge onClick={() => navigate('/notifications')} />
    </header>
  );
}
```

## Testing

### WebSocket Health Check
```bash
curl http://localhost:3001/api/websocket/health
```

### Connection Statistics (Admin Only)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/websocket/stats
```

### Test Message Emission
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "data": {"message": "Hello"}}' \
  http://localhost:3001/api/websocket/emit/1
```

## Monitoring

### Connection Monitoring
- Real-time connection count
- User presence tracking
- Room membership monitoring
- Event frequency tracking

### Performance Metrics
- Connection establishment time
- Event delivery latency
- Memory usage per connection
- Error rates

## Security Considerations

### Authentication
- JWT token validation on every connection
- Token refresh handling
- Secure token transmission

### Authorization
- Role-based access control
- Room access validation
- Event permission checking

### Data Protection
- Sensitive data filtering
- Event payload validation
- Rate limiting on events

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check JWT token validity
   - Verify CORS configuration
   - Check network connectivity

2. **Missing Updates**
   - Verify room membership
   - Check event listener registration
   - Validate event payload

3. **Performance Issues**
   - Monitor connection count
   - Check memory usage
   - Review event frequency

### Debug Tools
- WebSocket admin endpoints
- Browser developer tools
- Server logs
- Connection statistics

## Future Enhancements

### Planned Features
- **File Upload Progress**: Real-time upload status
- **Chat System**: Inter-user messaging
- **Screen Sharing**: Collaborative work sessions
- **Mobile Push Notifications**: Offline notification delivery
- **Analytics Dashboard**: Real-time system metrics

### Scalability Improvements
- **Redis Adapter**: Multi-server support
- **Load Balancing**: Horizontal scaling
- **Message Queuing**: High-volume event handling
- **CDN Integration**: Global distribution

## Conclusion

The WebSocket implementation provides a robust foundation for real-time communication in the Repair Shop Management System. The architecture supports scalability, security, and maintainability while delivering immediate user feedback and enhanced collaboration features.
