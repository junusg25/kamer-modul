import React from 'react';
import { useNavigate } from 'react-router-dom';
import TicketCreationWizard from '../components/forms/TicketCreationWizard';

const CreateRepairTicket = () => {
  const navigate = useNavigate();

  const handleSuccess = (ticket) => {
    navigate(`/repair-tickets/${ticket.id}`);
  };

  return (
    <TicketCreationWizard 
      ticketType="repair" 
      onSuccess={handleSuccess}
    />
  );
};

export default CreateRepairTicket;
