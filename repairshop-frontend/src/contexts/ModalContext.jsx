import React, { createContext, useContext, useState } from 'react'

const ModalContext = createContext()

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

export const ModalProvider = ({ children }) => {
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false)
  const [newWorkOrderModalOpen, setNewWorkOrderModalOpen] = useState(false)
  const [newWarrantyWorkOrderModalOpen, setNewWarrantyWorkOrderModalOpen] = useState(false)

  const value = {
    newTicketModalOpen,
    setNewTicketModalOpen,
    newWorkOrderModalOpen,
    setNewWorkOrderModalOpen,
    newWarrantyWorkOrderModalOpen,
    setNewWarrantyWorkOrderModalOpen,
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  )
}
