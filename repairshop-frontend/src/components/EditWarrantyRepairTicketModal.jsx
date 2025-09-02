import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

const EditWarrantyRepairTicketModal = ({ open, ticket, onClose, onSuccess }) => {
  const { translate } = useLanguage();
  const [formData, setFormData] = useState({
    problem_description: '',
    notes: '',
    additional_equipment: '',
    brought_by: ''
  });

  const [errors, setErrors] = useState({});

  // Update form data when ticket changes
  useEffect(() => {
    if (ticket) {
      setFormData({
        problem_description: ticket.problem_description || '',
        notes: ticket.notes || '',
        additional_equipment: ticket.additional_equipment || '',
        brought_by: ticket.brought_by || ''
      });
    }
  }, [ticket]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.put(`/warrantyRepairTickets/${ticket.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      if (error.response?.data?.message) {
        setErrors({ general: error.response.data.message });
      }
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!formData.problem_description) newErrors.problem_description = translate('errors.problemDescriptionRequired');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{translate('actions.editWarrantyRepairTicket')} #{ticket.ticket_number}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {errors.general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.general}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* Problem Description */}
            <Grid item xs={12}>
              <TextField
                label={`${translate('forms.problemDescription')} *`}
                multiline
                rows={4}
                value={formData.problem_description}
                onChange={(e) => handleChange('problem_description', e.target.value)}
                error={!!errors.problem_description}
                helperText={errors.problem_description}
                fullWidth
              />
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                label={translate('forms.notes')}
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                fullWidth
              />
            </Grid>

            {/* Additional Equipment */}
            <Grid item xs={12} md={6}>
              <TextField
                label={translate('forms.additionalEquipment')}
                value={formData.additional_equipment}
                onChange={(e) => handleChange('additional_equipment', e.target.value)}
                fullWidth
              />
            </Grid>

            {/* Brought By */}
            <Grid item xs={12} md={6}>
              <TextField
                label={translate('forms.broughtBy')}
                value={formData.brought_by}
                onChange={(e) => handleChange('brought_by', e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={updateMutation.isLoading}>
            {translate('actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={updateMutation.isLoading}
            startIcon={updateMutation.isLoading ? <CircularProgress size={20} /> : null}
          >
            {updateMutation.isLoading ? translate('actions.updating') : translate('actions.updateTicket')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EditWarrantyRepairTicketModal;
