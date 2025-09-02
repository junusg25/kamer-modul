import React from 'react'
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material'
import { Refresh, BugReport, Home } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} />
    }

    return this.props.children
  }
}

const ErrorFallback = ({ error, errorInfo }) => {
  const navigate = useNavigate()

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      p={3}
      textAlign="center"
    >
      <Alert 
        severity="error" 
        sx={{ 
          maxWidth: 600, 
          width: '100%',
          mb: 3,
          '& .MuiAlert-icon': { fontSize: 48 }
        }}
      >
        <AlertTitle sx={{ fontSize: '1.5rem', mb: 1 }}>
          <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
          Something went wrong
        </AlertTitle>
        <Typography variant="body1" sx={{ mb: 2 }}>
          An unexpected error occurred. Please try refreshing the page.
        </Typography>
        
        {process.env.NODE_ENV === 'development' && error && (
          <Box sx={{ mt: 2, textAlign: 'left' }}>
            <Typography variant="h6" gutterBottom>
              Error Details:
            </Typography>
            <Typography variant="body2" component="pre" sx={{ 
              backgroundColor: 'grey.100', 
              p: 2, 
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.75rem'
            }}>
              {error.toString()}
            </Typography>
            {errorInfo && (
              <Typography variant="body2" component="pre" sx={{ 
                backgroundColor: 'grey.100', 
                p: 2, 
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.75rem',
                mt: 1
              }}>
                {errorInfo.componentStack}
              </Typography>
            )}
          </Box>
        )}
      </Alert>

      <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          size="large"
        >
          Refresh Page
        </Button>
        <Button
          variant="outlined"
          startIcon={<Home />}
          onClick={handleGoHome}
          size="large"
        >
          Go to Dashboard
        </Button>
      </Box>
    </Box>
  )
}

export default ErrorBoundary
