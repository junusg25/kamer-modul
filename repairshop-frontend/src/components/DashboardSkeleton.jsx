import React from 'react'
import { Box, Card, CardContent, Skeleton, Grid } from '@mui/material'

export const DashboardSkeleton = () => {
  return (
    <Box>
      {/* Header with title and controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Skeleton variant="text" width={300} height={40} />
        <Box display="flex" gap={2}>
          <Skeleton variant="rectangular" width={120} height={40} />
          <Skeleton variant="rectangular" width={120} height={40} />
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        {[1, 2, 3, 4].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Skeleton variant="text" width="60%" height={20} />
                    <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
                    <Skeleton variant="text" width="80%" height={16} sx={{ mt: 1 }} />
                  </Box>
                  <Skeleton variant="circular" width={48} height={48} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} mb={4}>
        {/* Main Chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={300} />
            </CardContent>
          </Card>
        </Grid>

        {/* Side Panel */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={150} height={24} sx={{ mb: 2 }} />
              {[1, 2, 3, 4].map((item) => (
                <Box key={item} display="flex" alignItems="center" gap={2} mb={2}>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Box flex={1}>
                    <Skeleton variant="text" width="70%" height={16} />
                    <Skeleton variant="text" width="50%" height={14} />
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={180} height={24} sx={{ mb: 2 }} />
              {[1, 2, 3, 4, 5].map((item) => (
                <Box key={item} display="flex" alignItems="center" gap={2} mb={2}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Box flex={1}>
                    <Skeleton variant="text" width="80%" height={16} />
                    <Skeleton variant="text" width="60%" height={14} />
                  </Box>
                  <Skeleton variant="text" width={60} height={16} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={150} height={24} sx={{ mb: 2 }} />
              {[1, 2, 3, 4, 5].map((item) => (
                <Box key={item} display="flex" alignItems="center" gap={2} mb={2}>
                  <Skeleton variant="rectangular" width={40} height={40} sx={{ borderRadius: 1 }} />
                  <Box flex={1}>
                    <Skeleton variant="text" width="75%" height={16} />
                    <Skeleton variant="text" width="55%" height={14} />
                  </Box>
                  <Skeleton variant="text" width={50} height={16} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export const StatCardSkeleton = () => (
  <Card>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1}>
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="80%" height={16} sx={{ mt: 1 }} />
        </Box>
        <Skeleton variant="circular" width={48} height={48} />
      </Box>
    </CardContent>
  </Card>
)

export const ChartSkeleton = ({ height = 300 }) => (
  <Card>
    <CardContent>
      <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" width="100%" height={height} />
    </CardContent>
  </Card>
)

export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <Card>
    <CardContent>
      <Skeleton variant="text" width={150} height={24} sx={{ mb: 2 }} />
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} display="flex" gap={2} mb={1}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width="100%" height={20} />
          ))}
        </Box>
      ))}
    </CardContent>
  </Card>
)
