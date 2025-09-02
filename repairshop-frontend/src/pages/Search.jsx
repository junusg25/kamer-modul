import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import {
  Box,
  Typography,
  TextField,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function useDebounced(value, delay = 300) {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

export default function Search() {
  const { user } = useAuth()
  const { translate } = useLanguage()
  const isAdmin = user?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const debounced = useDebounced(q, 300)

  const workOrders = useQuery({
    queryKey: ['search-wo', debounced, user?.id, isAdmin],
    enabled: !!debounced,
    queryFn: async () => (await api.get('/workOrders', { params: { limit: 10, search: debounced, ...(isAdmin ? {} : (user?.id ? { technician_id: user.id } : {})) } })).data,
  })
  const customers = useQuery({
    queryKey: ['search-cust', debounced],
    enabled: !!debounced,
    queryFn: async () => (await api.get('/customers', { params: { search: debounced } })).data,
  })
  const inventory = useQuery({
    queryKey: ['search-inv', debounced],
    enabled: !!debounced,
    queryFn: async () => (await api.get('/inventory', { params: { limit: 10, search: debounced } })).data,
  })
  const users = useQuery({
    queryKey: ['search-users', debounced],
    enabled: !!debounced && isAdmin,
    queryFn: async () => (await api.get('/users')).data, // returns {status:'success', data: [...]}
  })
  const filteredUsers = React.useMemo(() => {
    const list = users.data?.data || []
    if (!debounced) return list
    const ql = debounced.toLowerCase()
    return list.filter(u => (u.name?.toLowerCase().includes(ql) || u.email?.toLowerCase().includes(ql)))
  }, [users.data, debounced])

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label={translate('common.query')}
          value={q}
          onChange={e => setParams({ q: e.target.value })}
          placeholder={translate('common.searchEverything')}
          variant="outlined"
        />
      </Box>

      {q === '' ? (
        <Typography variant="body2" color="text.secondary">
          {translate('common.typeToSearch')}{isAdmin ? ` ${translate('common.andUsers')}` : ''}
        </Typography>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  {translate('common.workOrders')}
                </Typography>
                {workOrders.isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : workOrders.error ? (
                  <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
                    {workOrders.error.message}
                  </Alert>
                ) : (
                  <List dense>
                    {(workOrders.data?.data || []).map(wo => (
                      <ListItem key={wo.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Link to={`/work-orders?highlightId=${wo.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                              #{wo.id} – {wo.customer_name} • {wo.machine_name}
                            </Link>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} lg={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  {translate('common.customers')}
                </Typography>
                {customers.isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : customers.error ? (
                  <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
                    {customers.error.message}
                  </Alert>
                ) : (
                  <List dense>
                    {(customers.data || []).map(c => (
                      <ListItem key={c.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {c.name}
                            </Typography>
                          }
                          secondary={c.email || ''}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} lg={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  {translate('common.inventory')}
                </Typography>
                {inventory.isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : inventory.error ? (
                  <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
                    {inventory.error.message}
                  </Alert>
                ) : (
                  <List dense>
                    {(inventory.data?.data || []).map(i => (
                      <ListItem key={i.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {i.name}
                            </Typography>
                          }
                          secondary={i.description || ''}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {isAdmin && (
            <Grid item xs={12} lg={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {translate('common.users')}
                  </Typography>
                  {users.isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                      <CircularProgress size={20} />
                    </Box>
                  ) : users.error ? (
                    <Alert severity="error" sx={{ fontSize: '0.875rem' }}>
                      {users.error.message}
                    </Alert>
                  ) : (
                    <List dense>
                      {filteredUsers.map(u => (
                        <ListItem key={u.id} sx={{ px: 0 }}>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {u.name}
                              </Typography>
                            }
                            secondary={u.email}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  )
}


