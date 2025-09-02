import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  Box,
  Button,
  Grid,
} from '@mui/material'
import {
  Add as AddIcon,
  ConfirmationNumber as TicketIcon,
  Build as WorkOrderIcon,
  Computer as MachineIcon,
  People as CustomerIcon,
  Inventory as InventoryIcon,
  Group as UsersIcon,
} from '@mui/icons-material'

export default function QuickActions() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { translate } = useLanguage()
  const isAdmin = user?.role === 'admin'

  const actions = [
    { label: translate('actions.newTicket'), icon: <TicketIcon />, onClick: () => navigate('/tickets'), color: 'primary' },
    { label: translate('actions.newWorkOrder'), icon: <WorkOrderIcon />, onClick: () => navigate('/work-orders'), color: 'secondary' },
    { label: translate('actions.addMachine'), icon: <MachineIcon />, onClick: () => navigate('/machines'), color: 'success' },
    { label: translate('actions.addCustomer'), icon: <CustomerIcon />, onClick: () => navigate('/customers'), color: 'info' },
    { label: translate('actions.addInventory'), icon: <InventoryIcon />, onClick: () => navigate('/inventory'), color: 'warning' },
  ]

  if (isAdmin) {
    actions.push({ label: translate('actions.manageUsers'), icon: <UsersIcon />, onClick: () => navigate('/users'), color: 'error' })
  }

  return (
    <Grid container spacing={2}>
      {actions.map((action) => (
        <Grid item xs={12} sm={6} key={action.label}>
          <Button
            variant="outlined"
            startIcon={action.icon}
            onClick={action.onClick}
            color={action.color}
            fullWidth
            sx={{ 
              justifyContent: 'flex-start',
              py: 1.5,
              textTransform: 'none',
              fontWeight: 500,
            }}
          >
            {action.label}
          </Button>
        </Grid>
      ))}
    </Grid>
  )
}


