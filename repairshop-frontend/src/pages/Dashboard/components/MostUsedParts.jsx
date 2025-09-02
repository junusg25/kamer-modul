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

export default function MostUsedParts({ parts, isLoading }) {
  const { translate } = useLanguage();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress size={20} />
            <Typography>{translate('dashboard.loadingMostUsedParts')}</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Ensure parts is an array
  const partsArray = Array.isArray(parts) ? parts : [];
  
  if (!partsArray || partsArray.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {translate('dashboard.noPartsDataAvailable')}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const handlePartClick = (partId) => {
    navigate(`/inventory/detail/${partId}`);
  };

  return (
    <Card>
      <CardContent>
        <List dense>
          {partsArray.slice(0, 5).map((part, index) => (
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
              onClick={() => handlePartClick(part.id)}
            >
              <ListItemText
                primary={part.part_name || part.name}
                secondary={`${part.total_used || part.total_quantity_used} ${translate('dashboard.used')}`}
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
                  label={part.total_used || part.total_quantity_used}
                  size="small"
                  color="secondary"
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
