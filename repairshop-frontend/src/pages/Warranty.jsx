import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Button,
  Stack,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WarrantyRepairTickets from './WarrantyRepairTickets';
import WorkOrders from './WarrantyWorkOrders';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`warranty-tabpanel-${index}`}
      aria-labelledby={`warranty-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `warranty-tab-${index}`,
    'aria-controls': `warranty-tabpanel-${index}`,
  };
}

export default function Warranty() {
  const [tabValue, setTabValue] = useState(0);
  const { translate } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read tab parameter from URL and set the correct tab
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'warranty-work-orders') {
      setTabValue(1);
    } else if (tabParam === 'warranty-repair-tickets') {
      setTabValue(0);
    }
  }, [searchParams]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {translate('navigation.warranty')}
      </Typography>
      
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="warranty tabs"
              sx={{ flex: 1 }}
            >
              <Tab 
                label={translate('navigation.warrantyTickets')} 
                {...a11yProps(0)} 
              />
              <Tab 
                label={translate('navigation.warrantyWorkOrders')} 
                {...a11yProps(1)} 
              />
            </Tabs>
            
            {/* Action Buttons based on active tab */}
            <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
              {tabValue === 0 && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/create-ticket?type=warranty')}
                  size="small"
                >
                  {translate('actions.newWarrantyRepairTicket')}
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <WarrantyRepairTickets />
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <WorkOrders />
      </TabPanel>
    </Box>
  );
}
