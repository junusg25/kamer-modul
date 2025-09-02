import React from 'react'
import { Box, Card, CardContent, Typography, Button, Stack } from '@mui/material'
import { useLanguage } from '../contexts/LanguageContext'

export default function TranslationTest() {
  const { translate, currentLanguage, changeLanguage, isBosnian, isEnglish } = useLanguage()

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {translate('common.translationSystemTest')}
        </Typography>
        
        <Typography variant="body1" color="text.secondary" mb={3}>
          {translate('common.currentLanguage')}: {currentLanguage.toUpperCase()} {isBosnian ? '🇧🇦' : '🇺🇸'}
        </Typography>

        <Stack spacing={2} mb={3}>
          <Typography variant="h6">{translate('common.navigationExamples')}:</Typography>
          <Typography>Dashboard: {translate('navigation.dashboard')}</Typography>
          <Typography>Repair Tickets: {translate('navigation.repairTickets')}</Typography>
          <Typography>Work Orders: {translate('navigation.workOrders')}</Typography>
          <Typography>Customers: {translate('navigation.customers')}</Typography>
          
          <Typography variant="h6" sx={{ mt: 2 }}>{translate('common.authenticationExamples')}:</Typography>
          <Typography>Repair Shop: {translate('auth.repairShop')}</Typography>
          <Typography>Sign In: {translate('auth.signIn')}</Typography>
          <Typography>Email Address: {translate('auth.emailAddress')}</Typography>
          
          <Typography variant="h6" sx={{ mt: 2 }}>{translate('common.dashboardExamples')}:</Typography>
          <Typography>Business Dashboard: {translate('dashboard.businessDashboard')}</Typography>
          <Typography>Welcome Back: {translate('dashboard.welcomeBack', { name: 'John' })}</Typography>
          <Typography>Total Revenue: {translate('dashboard.totalRevenue')}</Typography>
          
          <Typography variant="h6" sx={{ mt: 2 }}>{translate('common.formExamples')}:</Typography>
          <Typography>Customer Name: {translate('forms.customerName')}</Typography>
          <Typography>Full Name: {translate('forms.fullName')}</Typography>
          <Typography>Email: {translate('forms.email')}</Typography>
          
          <Typography variant="h6" sx={{ mt: 2 }}>{translate('common.statusExamples')}:</Typography>
          <Typography>Under Warranty: {translate('status.underWarranty')}</Typography>
          <Typography>High Priority: {translate('status.high')}</Typography>
          <Typography>Completed: {translate('status.completed')}</Typography>
          
          <Typography variant="h6" sx={{ mt: 2 }}>{translate('common.actionExamples')}:</Typography>
          <Typography>Save: {translate('actions.save')}</Typography>
          <Typography>Delete: {translate('actions.delete')}</Typography>
          <Typography>Edit: {translate('actions.edit')}</Typography>
        </Stack>

        <Stack direction="row" spacing={2}>
          <Button 
            variant={isEnglish ? "contained" : "outlined"}
            onClick={() => changeLanguage('en')}
          >
            {translate('actions.switchToEnglish')} 🇺🇸
          </Button>
          <Button 
            variant={isBosnian ? "contained" : "outlined"}
            onClick={() => changeLanguage('bs')}
          >
            {translate('actions.switchToBosnian')} 🇧🇦
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
