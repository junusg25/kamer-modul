import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'primary.main',
  onClick,
  sx = {}
}) {
  return (
    <Card 
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        minHeight: '160px', // Ensure consistent height for all cards
        display: 'flex',
        flexDirection: 'column',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 3,
        } : {},
        ...sx
      }}
      onClick={onClick}
    >
      <CardContent sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box flex={1}>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color }}>
              {value}
            </Typography>
            <Typography 
              variant="h6" 
              color="text.secondary" 
              sx={{ 
                mt: 1,
                minHeight: '48px', // Ensure consistent height for titles (2 lines)
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box sx={{ color, opacity: 0.7, ml: 1 }}>
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
