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
import RepairTickets from './RepairTickets';
import WorkOrders from './WorkOrders';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`non-warranty-tabpanel-${index}`}
      aria-labelledby={`non-warranty-tab-${index}`}
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
    id: `non-warranty-tab-${index}`,
    'aria-controls': `non-warranty-tabpanel-${index}`,
  };
}

export default function NonWarranty() {
  const [tabValue, setTabValue] = useState(0);
  const { translate } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'work-orders') {
      setTabValue(1);
    } else if (tabParam === 'repair-tickets') {
      setTabValue(0);
    }
  }, [searchParams]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {translate('navigation.nonWarranty')}
      </Typography>
      
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="non-warranty tabs"
              sx={{ flex: 1 }}
            >
              <Tab 
                label={translate('navigation.repairTickets')} 
                {...a11yProps(0)} 
              />
              <Tab 
                label={translate('navigation.workOrders')} 
                {...a11yProps(1)} 
              />
            </Tabs>
            
            {/* Action Buttons based on active tab */}
            <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
              {tabValue === 0 && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/create-ticket?type=non-warranty')}
                  size="small"
                >
                  {translate('actions.newRepairTicket')}
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <RepairTickets />
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <WorkOrders />
      </TabPanel>
    </Box>
  );
}
