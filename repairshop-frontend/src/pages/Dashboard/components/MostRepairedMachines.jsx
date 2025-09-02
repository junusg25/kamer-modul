import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip
} from '@mui/material';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

export default function MostRepairedMachines({ machines, isLoading }) {
  const { translate } = useLanguage();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress size={20} />
            <Typography>{translate('dashboard.loadingMostRepairedMachines')}</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Ensure machines is an array
  const machinesArray = Array.isArray(machines) ? machines : [];
  
  if (!machinesArray || machinesArray.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {translate('dashboard.noMachineDataAvailable')}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const handleMachineClick = (machineId) => {
    navigate(`/machines/detail/${machineId}`);
  };

  return (
    <Card>
      <CardContent>
        <List dense>
          {machinesArray.slice(0, 5).map((machine, index) => (
            <ListItem 
              key={index} 
              sx={{ 
                px: 0, 
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  borderRadius: 1
                }
              }}
              onClick={() => handleMachineClick(machine.id)}
            >
              <ListItemText
                primary={machine.name}
                secondary={`${machine.repair_count} ${translate('dashboard.repairs')}`}
                primaryTypographyProps={{
                  variant: 'body2',
                  fontWeight: 500
                }}
                secondaryTypographyProps={{
                  variant: 'caption',
                  color: 'text.secondary'
                }}
              />
              <ListItemSecondaryAction>
                <Chip 
                  label={machine.repair_count}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}
