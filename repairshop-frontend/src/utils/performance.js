import React from 'react'

// Performance monitoring utility
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoads: {},
      apiCalls: {},
      renderTimes: {},
      errors: []
    }
    this.startTime = performance.now()
  }

  // Track page load performance
  trackPageLoad(pageName) {
    const loadTime = performance.now() - this.startTime
    this.metrics.pageLoads[pageName] = {
      loadTime,
      timestamp: new Date().toISOString()
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Page Load: ${pageName} - ${loadTime.toFixed(2)}ms`)
    }
  }

  // Track API call performance
  trackApiCall(endpoint, duration, status) {
    if (!this.metrics.apiCalls[endpoint]) {
      this.metrics.apiCalls[endpoint] = []
    }
    
    this.metrics.apiCalls[endpoint].push({
      duration,
      status,
      timestamp: new Date().toISOString()
    })

    // Keep only last 100 calls per endpoint
    if (this.metrics.apiCalls[endpoint].length > 100) {
      this.metrics.apiCalls[endpoint] = this.metrics.apiCalls[endpoint].slice(-100)
    }

    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`🐌 Slow API Call: ${endpoint} - ${duration.toFixed(2)}ms`)
    }
  }

  // Track component render performance
  trackRenderTime(componentName, renderTime) {
    if (!this.metrics.renderTimes[componentName]) {
      this.metrics.renderTimes[componentName] = []
    }
    
    this.metrics.renderTimes[componentName].push({
      renderTime,
      timestamp: new Date().toISOString()
    })

    // Keep only last 50 renders per component
    if (this.metrics.renderTimes[componentName].length > 50) {
      this.metrics.renderTimes[componentName] = this.metrics.renderTimes[componentName].slice(-50)
    }

    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(`🐌 Slow Render: ${componentName} - ${renderTime.toFixed(2)}ms`)
    }
  }

  // Track errors
  trackError(error, context) {
    this.metrics.errors.push({
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    })

    // Keep only last 50 errors
    if (this.metrics.errors.length > 50) {
      this.metrics.errors = this.metrics.errors.slice(-50)
    }
  }

  // Get performance summary
  getSummary() {
    const summary = {
      totalPageLoads: Object.keys(this.metrics.pageLoads).length,
      averagePageLoadTime: 0,
      totalApiCalls: 0,
      averageApiCallTime: 0,
      slowestApiCalls: [],
      totalErrors: this.metrics.errors.length,
      uptime: performance.now() - this.startTime
    }

    // Calculate average page load time
    const pageLoadTimes = Object.values(this.metrics.pageLoads).map(p => p.loadTime)
    if (pageLoadTimes.length > 0) {
      summary.averagePageLoadTime = pageLoadTimes.reduce((a, b) => a + b, 0) / pageLoadTimes.length
    }

    // Calculate API call statistics
    const allApiCalls = Object.values(this.metrics.apiCalls).flat()
    summary.totalApiCalls = allApiCalls.length
    
    if (allApiCalls.length > 0) {
      const apiCallTimes = allApiCalls.map(call => call.duration)
      summary.averageApiCallTime = apiCallTimes.reduce((a, b) => a + b, 0) / apiCallTimes.length
      
      // Find slowest API calls
      summary.slowestApiCalls = Object.entries(this.metrics.apiCalls)
        .map(([endpoint, calls]) => ({
          endpoint,
          averageTime: calls.reduce((sum, call) => sum + call.duration, 0) / calls.length,
          totalCalls: calls.length
        }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 5)
    }

    return summary
  }

  // Export metrics for debugging
  exportMetrics() {
    return {
      ...this.metrics,
      summary: this.getSummary()
    }
  }

  // Clear old metrics
  clearOldMetrics() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    // Clear old API calls
    Object.keys(this.metrics.apiCalls).forEach(endpoint => {
      this.metrics.apiCalls[endpoint] = this.metrics.apiCalls[endpoint].filter(
        call => call.timestamp > oneHourAgo
      )
    })

    // Clear old render times
    Object.keys(this.metrics.renderTimes).forEach(component => {
      this.metrics.renderTimes[component] = this.metrics.renderTimes[component].filter(
        render => render.timestamp > oneHourAgo
      )
    })

    // Clear old errors
    this.metrics.errors = this.metrics.errors.filter(
      error => error.timestamp > oneHourAgo
    )
  }
}

// Create global instance
const performanceMonitor = new PerformanceMonitor()

// Auto-clear old metrics every hour
setInterval(() => {
  performanceMonitor.clearOldMetrics()
}, 60 * 60 * 1000)

// Export utilities
export const trackPageLoad = (pageName) => performanceMonitor.trackPageLoad(pageName)
export const trackApiCall = (endpoint, duration, status) => performanceMonitor.trackApiCall(endpoint, duration, status)
export const trackRenderTime = (componentName, renderTime) => performanceMonitor.trackRenderTime(componentName, renderTime)
export const trackError = (error, context) => performanceMonitor.trackError(error, context)
export const getPerformanceSummary = () => performanceMonitor.getSummary()
export const exportMetrics = () => performanceMonitor.exportMetrics()

// React hook for tracking render performance
export const useRenderTracker = (componentName) => {
  const renderStart = React.useRef(performance.now())
  
  React.useEffect(() => {
    const renderTime = performance.now() - renderStart.current
    trackRenderTime(componentName, renderTime)
    renderStart.current = performance.now()
  })
}

// API interceptor for tracking API calls
export const createApiInterceptor = (api) => {
  api.interceptors.request.use(config => {
    config.metadata = { startTime: performance.now() }
    return config
  })

  api.interceptors.response.use(
    response => {
      const duration = performance.now() - response.config.metadata.startTime
      trackApiCall(response.config.url, duration, response.status)
      return response
    },
    error => {
      if (error.config?.metadata) {
        const duration = performance.now() - error.config.metadata.startTime
        trackApiCall(error.config.url, duration, error.response?.status || 'error')
      }
      return Promise.reject(error)
    }
  )

  return api
}

export default performanceMonitor
