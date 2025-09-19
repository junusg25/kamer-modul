const db = require('../db');
const logger = require('./logger');

/**
 * Updates reserved rentals to active status when their start date arrives
 * This function should be called daily via a cron job or scheduler
 */
async function updateReservedRentalsToActive() {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Find reserved rentals that should become active today
    const reservedRentalsQuery = `
      SELECT 
        mr.id as rental_id,
        mr.rental_machine_id,
        mr.rental_start_date,
        mr.customer_id,
        c.name as customer_name,
        rm.serial_number,
        mm.name as model_name,
        mm.manufacturer
      FROM machine_rentals mr
      JOIN rental_machines rm ON mr.rental_machine_id = rm.id
      JOIN machine_models mm ON rm.model_id = mm.id
      JOIN customers c ON mr.customer_id = c.id
      WHERE mr.rental_status = 'reserved'
        AND mr.rental_start_date <= $1
    `;
    
    const reservedRentals = await client.query(reservedRentalsQuery, [today]);
    
    if (reservedRentals.rows.length === 0) {
      logger.info('No reserved rentals to activate today');
      await client.query('COMMIT');
      return { updated: 0, rentals: [] };
    }
    
    const updatedRentals = [];
    
    // Update each reserved rental to active
    for (const rental of reservedRentals.rows) {
      // Update rental status to active
      await client.query(
        'UPDATE machine_rentals SET rental_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['active', rental.rental_id]
      );
      
      // Update rental machine status to rented
      await client.query(
        'UPDATE rental_machines SET rental_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['rented', rental.rental_machine_id]
      );
      
      // Create notification for the activation
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [
        rental.customer_id, // You might want to get the actual user ID instead
        'Rental Activated',
        `Rental for ${rental.manufacturer} ${rental.model_name} (${rental.serial_number}) has been activated and is now active.`,
        'rental',
        'machine_rental',
        rental.rental_id
      ]);
      
      updatedRentals.push({
        rental_id: rental.rental_id,
        customer_name: rental.customer_name,
        machine: `${rental.manufacturer} ${rental.model_name} (${rental.serial_number})`,
        start_date: rental.rental_start_date
      });
      
      logger.info(`Activated reserved rental ${rental.rental_id} for customer ${rental.customer_name}`);
    }
    
    await client.query('COMMIT');
    
    logger.info(`Successfully activated ${updatedRentals.length} reserved rentals`);
    
    return {
      updated: updatedRentals.length,
      rentals: updatedRentals
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating reserved rentals to active:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Updates overdue rentals status
 * This function should also be called daily
 */
async function updateOverdueRentals() {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Find active rentals that are overdue
    const overdueRentalsQuery = `
      SELECT 
        mr.id as rental_id,
        mr.rental_machine_id,
        mr.rental_end_date,
        mr.planned_return_date,
        mr.customer_id,
        c.name as customer_name,
        rm.serial_number,
        mm.name as model_name,
        mm.manufacturer
      FROM machine_rentals mr
      JOIN rental_machines rm ON mr.rental_machine_id = rm.id
      JOIN machine_models mm ON rm.model_id = mm.id
      JOIN customers c ON mr.customer_id = c.id
      WHERE mr.rental_status = 'active'
        AND (
          (mr.rental_end_date IS NOT NULL AND mr.rental_end_date < $1) OR
          (mr.rental_end_date IS NULL AND mr.planned_return_date IS NOT NULL AND mr.planned_return_date < $1)
        )
    `;
    
    const overdueRentals = await client.query(overdueRentalsQuery, [today]);
    
    if (overdueRentals.rows.length === 0) {
      logger.info('No overdue rentals found');
      await client.query('COMMIT');
      return { updated: 0, rentals: [] };
    }
    
    const updatedRentals = [];
    
    // Update each overdue rental
    for (const rental of overdueRentals.rows) {
      // Update rental status to overdue
      await client.query(
        'UPDATE machine_rentals SET rental_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['overdue', rental.rental_id]
      );
      
      // Create notification for the overdue status
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [
        rental.customer_id, // You might want to get the actual user ID instead
        'Rental Overdue',
        `Rental for ${rental.manufacturer} ${rental.model_name} (${rental.serial_number}) is now overdue. Please return the machine.`,
        'rental',
        'machine_rental',
        rental.rental_id
      ]);
      
      updatedRentals.push({
        rental_id: rental.rental_id,
        customer_name: rental.customer_name,
        machine: `${rental.manufacturer} ${rental.model_name} (${rental.serial_number})`,
        due_date: rental.rental_end_date || rental.planned_return_date
      });
      
      logger.info(`Marked rental ${rental.rental_id} as overdue for customer ${rental.customer_name}`);
    }
    
    await client.query('COMMIT');
    
    logger.info(`Successfully marked ${updatedRentals.length} rentals as overdue`);
    
    return {
      updated: updatedRentals.length,
      rentals: updatedRentals
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating overdue rentals:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  updateReservedRentalsToActive,
  updateOverdueRentals
};
