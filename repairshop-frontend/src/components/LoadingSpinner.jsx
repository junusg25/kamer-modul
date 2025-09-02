import React from 'react'
import { Box, CircularProgress, Typography, Fade } from '@mui/material'
import { useLanguage } from '../contexts/LanguageContext'

export const LoadingSpinner = ({ 
  message, 
  size = 40, 
  fullScreen = false,
  overlay = false,
  color = 'primary'
}) => {
  const { translate } = useLanguage()
  const defaultMessage = translate('common.loading')
  const displayMessage = message || defaultMessage
  const content = (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
      sx={{
        ...(fullScreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)'
        }),
        ...(overlay && {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(2px)'
        })
      }}
    >
      <CircularProgress size={size} color={color} />
      {displayMessage && (
        <Typography variant="body2" color="textSecondary">
          {displayMessage}
        </Typography>
      )}
    </Box>
  )

  return overlay ? (
    <Fade in={true} timeout={300}>
      {content}
    </Fade>
  ) : content
}

export const LoadingOverlay = ({ children, loading, message }) => {
  return (
    <Box position="relative">
      {children}
      {loading && <LoadingSpinner message={message} overlay />}
    </Box>
  )
}

export const SkeletonLoader = ({ rows = 3, columns = 4 }) => {
  return (
    <Box>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box
          key={rowIndex}
          display="flex"
          gap={2}
          mb={2}
          sx={{
            '& > *': {
              flex: 1,
              height: 20,
              backgroundColor: 'grey.200',
              borderRadius: 1,
              animation: 'pulse 1.5s ease-in-out infinite'
            }
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Box key={colIndex} />
          ))}
        </Box>
      ))}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </Box>
  )
}
