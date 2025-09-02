import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { Wifi, WifiOff, SignalCellular4Bar, SignalCellular0Bar } from '@mui/icons-material';
import { useWebSocket } from '../contexts/WebSocketContext';

export default function WebSocketStatus() {
  const { isConnected, connectedUsers } = useWebSocket();

  const getStatusColor = () => {
    if (isConnected) {
      return 'success';
    }
    return 'error';
  };

  const getStatusIcon = () => {
    if (isConnected) {
      return <Wifi fontSize="small" />;
    }
    return <WifiOff fontSize="small" />;
  };

  const getStatusText = () => {
    if (isConnected) {
      return 'Connected';
    }
    return 'Disconnected';
  };

  const getConnectionQuality = () => {
    if (isConnected) {
      return <SignalCellular4Bar fontSize="small" />;
    }
    return <SignalCellular0Bar fontSize="small" />;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip 
        title={
          <Box>
            <Typography variant="body2">
              WebSocket Status: {getStatusText()}
            </Typography>
            <Typography variant="body2">
              Connected Users: {connectedUsers.length}
            </Typography>
            <Typography variant="body2">
              Real-time updates: {isConnected ? 'Active' : 'Inactive'}
            </Typography>
          </Box>
        }
        arrow
      >
        <Chip
          icon={getStatusIcon()}
          label={getStatusText()}
          color={getStatusColor()}
          size="small"
          variant="outlined"
          sx={{
            fontSize: '0.75rem',
            height: 24,
            '& .MuiChip-icon': {
              fontSize: '1rem'
            }
          }}
        />
      </Tooltip>
      
      <Tooltip title="Connection Quality">
        <Box sx={{ color: isConnected ? 'success.main' : 'error.main' }}>
          {getConnectionQuality()}
        </Box>
      </Tooltip>
      
      {isConnected && (
        <Tooltip title={`${connectedUsers.length} users online`}>
          <Chip
            label={`${connectedUsers.length} online`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{
              fontSize: '0.75rem',
              height: 24
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}
