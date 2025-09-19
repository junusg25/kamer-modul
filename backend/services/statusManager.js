const db = require('../db');
const { createNotification } = require('../utils/notificationHelpers');

class StatusManager {
  /**
   * Get all available statuses for rental machines
   */
  static getAvailableStatuses() {
    return [
      { value: 'available', label: 'Available', color: 'green', description: 'Ready for rental' },
      { value: 'rented', label: 'Rented', color: 'blue', description: 'Currently rented' },
      { value: 'reserved', label: 'Reserved', color: 'yellow', description: 'Reserved for future rental' },
      { value: 'cleaning', label: 'Cleaning', color: 'orange', description: 'Being cleaned after return' },
      { value: 'inspection', label: 'Inspection', color: 'purple', description: 'Under inspection' },
      { value: 'maintenance', label: 'Maintenance', color: 'indigo', description: 'Scheduled maintenance' },
      { value: 'repair', label: 'Repair', color: 'red', description: 'Being repaired' },
      { value: 'quarantine', label: 'Quarantine', color: 'gray', description: 'Quarantined (safety/quality issues)' },
      { value: 'retired', label: 'Retired', color: 'black', description: 'Retired from service' }
    ];
  }

  /**
   * Validate if a status transition is allowed
   */
  static async validateStatusTransition(machineId, newStatus, userId = null) {
    try {
      const result = await db.query(
        'SELECT validate_status_transition($1, $2, $3) as is_valid',
        [machineId, newStatus, userId]
      );
      return result.rows[0].is_valid;
    } catch (error) {
      console.error('Error validating status transition:', error);
      return false;
    }
  }

  /**
   * Get status transition rules
   */
  static async getTransitionRules() {
    try {
      const result = await db.query(`
        SELECT 
          from_status,
          to_status,
          requires_approval,
          auto_transition_after_hours,
          description
        FROM rental_status_transition_rules
        ORDER BY from_status, to_status
      `);
      return result.rows;
    } catch (error) {
      console.error('Error fetching transition rules:', error);
      return [];
    }
  }

  /**
   * Update machine status with validation and history tracking
   */
  static async updateMachineStatus(machineId, newStatus, userId, reason = null, notes = null) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Validate transition
      const isValid = await this.validateStatusTransition(machineId, newStatus, userId);
      if (!isValid) {
        throw new Error('Invalid status transition');
      }

      // Get current status
      const currentResult = await client.query(
        'SELECT rental_status FROM rental_machines WHERE id = $1',
        [machineId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Machine not found');
      }

      const currentStatus = currentResult.rows[0].rental_status;

      // Update machine status
      await client.query(
        'UPDATE rental_machines SET rental_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStatus, machineId]
      );

      // Add to status history (trigger will handle this, but we can add reason and notes)
      await client.query(`
        UPDATE rental_machine_status_history 
        SET reason = $1, notes = $2, changed_by = $3
        WHERE rental_machine_id = $4 
          AND new_status = $5 
          AND changed_at = (
            SELECT MAX(changed_at) 
            FROM rental_machine_status_history 
            WHERE rental_machine_id = $4
          )
      `, [reason, notes, userId, machineId, newStatus]);

      await client.query('COMMIT');

      // Send notifications if needed
      await this.handleStatusChangeNotifications(machineId, currentStatus, newStatus, userId);

      return { success: true, message: 'Status updated successfully' };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating machine status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle notifications for status changes
   */
  static async handleStatusChangeNotifications(machineId, oldStatus, newStatus, userId) {
    try {
      // Get machine details
      const machineResult = await db.query(`
        SELECT rm.*, mm.name as model_name, mm.manufacturer
        FROM rental_machines rm
        JOIN machine_models mm ON rm.model_id = mm.id
        WHERE rm.id = $1
      `, [machineId]);

      if (machineResult.rows.length === 0) return;

      const machine = machineResult.rows[0];
      const machineName = `${machine.manufacturer} ${machine.model_name} - ${machine.serial_number}`;

      // Define notification rules
      const notificationRules = {
        'cleaning': {
          title: 'Machine Returned for Cleaning',
          message: `${machineName} has been returned and is being cleaned`,
          type: 'info'
        },
        'inspection': {
          title: 'Machine Under Inspection',
          message: `${machineName} is being inspected after cleaning`,
          type: 'info'
        },
        'repair': {
          title: 'Machine Requires Repair',
          message: `${machineName} requires repair work`,
          type: 'warning'
        },
        'quarantine': {
          title: 'Machine Quarantined',
          message: `${machineName} has been quarantined due to safety/quality concerns`,
          type: 'error'
        },
        'retired': {
          title: 'Machine Retired',
          message: `${machineName} has been retired from service`,
          type: 'info'
        }
      };

      const rule = notificationRules[newStatus];
      if (rule) {
        // Send notification to all admin/manager users
        const usersResult = await db.query(`
          SELECT id FROM users WHERE role IN ('admin', 'manager')
        `);

        for (const user of usersResult.rows) {
          await createNotification(
            user.id,
            rule.title,
            rule.message,
            'rental',
            'rental_machine',
            machineId
          );
        }
      }

    } catch (error) {
      console.error('Error handling status change notifications:', error);
    }
  }

  /**
   * Get status history for a machine
   */
  static async getMachineStatusHistory(machineId, limit = 50) {
    try {
      const result = await db.query(`
        SELECT 
          h.*,
          u.name as changed_by_name,
          u.role as changed_by_role
        FROM rental_machine_status_history h
        LEFT JOIN users u ON h.changed_by = u.id
        WHERE h.rental_machine_id = $1
        ORDER BY h.changed_at DESC
        LIMIT $2
      `, [machineId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching status history:', error);
      return [];
    }
  }

  /**
   * Get machines that need automatic status transitions
   */
  static async getMachinesForAutoTransition() {
    try {
      const result = await db.query(`
        SELECT 
          rm.id,
          rm.rental_status,
          rm.updated_at,
          rstr.to_status,
          rstr.auto_transition_after_hours
        FROM rental_machines rm
        JOIN rental_status_transition_rules rstr ON rm.rental_status = rstr.from_status
        WHERE rstr.auto_transition_after_hours IS NOT NULL
          AND rm.updated_at <= (CURRENT_TIMESTAMP - INTERVAL '1 hour' * rstr.auto_transition_after_hours)
      `);
      return result.rows;
    } catch (error) {
      console.error('Error fetching machines for auto transition:', error);
      return [];
    }
  }

  /**
   * Process automatic status transitions
   */
  static async processAutoTransitions() {
    try {
      const machines = await this.getMachinesForAutoTransition();
      const results = [];

      for (const machine of machines) {
        try {
          await this.updateMachineStatus(
            machine.id,
            machine.to_status,
            null, // System user
            'Automatic transition based on time elapsed',
            `Auto-transitioned from ${machine.rental_status} after ${machine.auto_transition_after_hours} hours`
          );
          results.push({ machineId: machine.id, success: true });
        } catch (error) {
          console.error(`Error auto-transitioning machine ${machine.id}:`, error);
          results.push({ machineId: machine.id, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Error processing auto transitions:', error);
      return [];
    }
  }

  /**
   * Get status statistics
   */
  static async getStatusStatistics() {
    try {
      const result = await db.query(`
        SELECT 
          rental_status,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM rental_machines
        GROUP BY rental_status
        ORDER BY count DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Error fetching status statistics:', error);
      return [];
    }
  }
}

module.exports = StatusManager;
