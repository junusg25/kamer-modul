import React from 'react';
import { useNavigate } from 'react-router-dom';
import TicketCreationWizard from '../components/forms/TicketCreationWizard';

const CreateWarrantyRepairTicket = () => {
  const navigate = useNavigate();

  const handleSuccess = (ticket) => {
    navigate(`/warranty-repair-tickets/${ticket.id}`);
  };

  return (
    <TicketCreationWizard 
      ticketType="warranty" 
      onSuccess={handleSuccess}
    />
  );
};

export default CreateWarrantyRepairTicket;
