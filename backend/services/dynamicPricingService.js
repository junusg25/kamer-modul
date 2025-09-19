const db = require('../db');

class DynamicPricingService {
  /**
   * Calculate dynamic pricing for a rental
   */
  static async calculatePricing(rentalMachineId, startDate, endDate, customerId = null) {
    try {
      const result = await db.query(
        'SELECT * FROM calculate_dynamic_pricing($1, $2, $3, $4)',
        [rentalMachineId, startDate, endDate, customerId]
      );

      if (result.rows.length === 0) {
        throw new Error('No pricing calculated');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error calculating dynamic pricing:', error);
      throw error;
    }
  }

  /**
   * Get all base pricing
   */
  static async getAllBasePricing() {
    try {
      const result = await db.query(`
        SELECT 
          mp.*,
          rm.serial_number,
          mm.name as machine_name,
          mm.manufacturer
        FROM machine_pricing mp
        JOIN rental_machines rm ON mp.rental_machine_id = rm.id
        JOIN machine_models mm ON rm.model_id = mm.id
        WHERE mp.is_active = TRUE
        ORDER BY mm.manufacturer, mm.name, rm.serial_number
      `);

      return result.rows;
    } catch (error) {
      console.error('Error fetching all base pricing:', error);
      return [];
    }
  }

  /**
   * Get base pricing for a machine
   */
  static async getBasePricing(rentalMachineId) {
    try {
      const result = await db.query(`
        SELECT 
          mp.*,
          rm.serial_number,
          mm.name as machine_name,
          mm.manufacturer
        FROM machine_pricing mp
        JOIN rental_machines rm ON mp.rental_machine_id = rm.id
        JOIN machine_models mm ON rm.model_id = mm.id
        WHERE mp.rental_machine_id = $1 AND mp.is_active = TRUE
      `, [rentalMachineId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching base pricing:', error);
      return null;
    }
  }

  /**
   * Set base pricing for a machine
   */
  static async setBasePricing(rentalMachineId, pricingData, userId) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Get current pricing for history
      const currentPricing = await client.query(
        'SELECT * FROM machine_pricing WHERE rental_machine_id = $1',
        [rentalMachineId]
      );

      // Insert or update pricing
      if (currentPricing.rows.length > 0) {
        await client.query(`
          UPDATE machine_pricing SET
            base_price_daily = $1,
            base_price_weekly = $2,
            base_price_monthly = $3,
            minimum_rental_days = $4,
            maximum_rental_days = $5,
            currency = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE rental_machine_id = $7
        `, [
          pricingData.base_price_daily,
          pricingData.base_price_weekly,
          pricingData.base_price_monthly,
          pricingData.minimum_rental_days,
          pricingData.maximum_rental_days,
          pricingData.currency || 'KM',
          rentalMachineId
        ]);
      } else {
        await client.query(`
          INSERT INTO machine_pricing (
            rental_machine_id, base_price_daily, base_price_weekly, base_price_monthly,
            minimum_rental_days, maximum_rental_days, currency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          rentalMachineId,
          pricingData.base_price_daily,
          pricingData.base_price_weekly,
          pricingData.base_price_monthly,
          pricingData.minimum_rental_days,
          pricingData.maximum_rental_days,
          pricingData.currency || 'EUR'
        ]);
      }

      // Record pricing history
      if (currentPricing.rows.length > 0) {
        const oldPricing = currentPricing.rows[0];
        await client.query(`
          INSERT INTO pricing_history (
            rental_machine_id, old_price_daily, new_price_daily,
            old_price_weekly, new_price_weekly, old_price_monthly, new_price_monthly,
            change_reason, changed_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          rentalMachineId,
          oldPricing.base_price_daily,
          pricingData.base_price_daily,
          oldPricing.base_price_weekly,
          pricingData.base_price_weekly,
          oldPricing.base_price_monthly,
          pricingData.base_price_monthly,
          'Manual price update',
          userId
        ]);
      }

      await client.query('COMMIT');
      return { success: true, message: 'Pricing updated successfully' };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error setting base pricing:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all pricing rules
   */
  static async getPricingRules() {
    try {
      const result = await db.query(`
        SELECT 
          pr.*,
          u.name as created_by_name
        FROM pricing_rules pr
        LEFT JOIN users u ON pr.created_by = u.id
        ORDER BY pr.priority DESC, pr.id ASC
      `);

      return result.rows;
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
      return [];
    }
  }

  /**
   * Create or update a pricing rule
   */
  static async savePricingRule(ruleData, userId) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      if (ruleData.id) {
        // Update existing rule
        await client.query(`
          UPDATE pricing_rules SET
            name = $1,
            description = $2,
            rule_type = $3,
            is_active = $4,
            priority = $5,
            conditions = $6,
            adjustments = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $8
        `, [
          ruleData.name,
          ruleData.description,
          ruleData.rule_type,
          ruleData.is_active,
          ruleData.priority,
          JSON.stringify(ruleData.conditions),
          JSON.stringify(ruleData.adjustments),
          ruleData.id
        ]);
      } else {
        // Create new rule
        await client.query(`
          INSERT INTO pricing_rules (
            name, description, rule_type, is_active, priority,
            conditions, adjustments, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          ruleData.name,
          ruleData.description,
          ruleData.rule_type,
          ruleData.is_active,
          ruleData.priority,
          JSON.stringify(ruleData.conditions),
          JSON.stringify(ruleData.adjustments),
          userId
        ]);
      }

      await client.query('COMMIT');
      return { success: true, message: 'Pricing rule saved successfully' };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving pricing rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a pricing rule
   */
  static async deletePricingRule(ruleId) {
    try {
      await db.query('DELETE FROM pricing_rules WHERE id = $1', [ruleId]);
      return { success: true, message: 'Pricing rule deleted successfully' };
    } catch (error) {
      console.error('Error deleting pricing rule:', error);
      throw error;
    }
  }

  /**
   * Get customer pricing tiers
   */
  static async getCustomerTiers() {
    try {
      const result = await db.query(`
        SELECT * FROM customer_pricing_tiers
        ORDER BY minimum_rentals ASC, minimum_total_spent ASC
      `);

      return result.rows;
    } catch (error) {
      console.error('Error fetching customer tiers:', error);
      return [];
    }
  }

  /**
   * Create a new customer pricing tier
   */
  static async createCustomerTier(tierData) {
    try {
      const result = await db.query(`
        INSERT INTO customer_pricing_tiers (
          name, description, discount_percentage, minimum_rentals, 
          minimum_total_spent, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        tierData.name,
        tierData.description,
        tierData.discount_percentage,
        tierData.minimum_rentals,
        tierData.minimum_total_spent,
        tierData.is_active !== undefined ? tierData.is_active : true
      ]);

      return { success: true, message: 'Customer tier created successfully', tier: result.rows[0] };
    } catch (error) {
      console.error('Error creating customer tier:', error);
      throw error;
    }
  }

  /**
   * Update a customer pricing tier
   */
  static async updateCustomerTier(tierId, tierData) {
    try {
      const result = await db.query(`
        UPDATE customer_pricing_tiers SET
          name = $1,
          description = $2,
          discount_percentage = $3,
          minimum_rentals = $4,
          minimum_total_spent = $5,
          is_active = $6
        WHERE id = $7
        RETURNING *
      `, [
        tierData.name,
        tierData.description,
        tierData.discount_percentage,
        tierData.minimum_rentals,
        tierData.minimum_total_spent,
        tierData.is_active !== undefined ? tierData.is_active : true,
        tierId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Customer tier not found');
      }

      return { success: true, message: 'Customer tier updated successfully', tier: result.rows[0] };
    } catch (error) {
      console.error('Error updating customer tier:', error);
      throw error;
    }
  }

  /**
   * Delete a customer pricing tier
   */
  static async deleteCustomerTier(tierId) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if tier is being used by any customers
      const usageCheck = await client.query(`
        SELECT COUNT(*) as usage_count
        FROM customer_tier_assignments
        WHERE tier_id = $1 AND is_active = TRUE
      `, [tierId]);

      if (parseInt(usageCheck.rows[0].usage_count) > 0) {
        await client.query('ROLLBACK');
        throw new Error('Cannot delete tier that is currently assigned to customers');
      }

      // Delete the tier
      await client.query('DELETE FROM customer_pricing_tiers WHERE id = $1', [tierId]);

      await client.query('COMMIT');
      return { success: true, message: 'Customer tier deleted successfully' };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting customer tier:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Assign customer to pricing tier
   */
  static async assignCustomerTier(customerId, tierId, userId, expiresAt = null) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Deactivate existing tier assignments
      await client.query(`
        UPDATE customer_tier_assignments 
        SET is_active = FALSE 
        WHERE customer_id = $1
      `, [customerId]);

      // Create new assignment
      await client.query(`
        INSERT INTO customer_tier_assignments (
          customer_id, tier_id, assigned_by, expires_at
        ) VALUES ($1, $2, $3, $4)
      `, [customerId, tierId, userId, expiresAt]);

      await client.query('COMMIT');
      return { success: true, message: 'Customer tier assigned successfully' };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error assigning customer tier:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get customer's current tier
   */
  static async getCustomerTier(customerId) {
    try {
      const result = await db.query(`
        SELECT 
          cta.*,
          cpt.name as tier_name,
          cpt.discount_percentage,
          cpt.description as tier_description
        FROM customer_tier_assignments cta
        JOIN customer_pricing_tiers cpt ON cta.tier_id = cpt.id
        WHERE cta.customer_id = $1 
          AND cta.is_active = TRUE
          AND (cta.expires_at IS NULL OR cta.expires_at > CURRENT_TIMESTAMP)
        ORDER BY cta.assigned_at DESC
        LIMIT 1
      `, [customerId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching customer tier:', error);
      return null;
    }
  }

  /**
   * Update demand tracking
   */
  static async updateDemandTracking(rentalMachineId, date, demandData) {
    try {
      await db.query(`
        INSERT INTO demand_tracking (
          rental_machine_id, date, demand_level, utilization_percentage,
          booking_requests, completed_rentals, cancelled_rentals, average_rental_duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (rental_machine_id, date) 
        DO UPDATE SET
          demand_level = EXCLUDED.demand_level,
          utilization_percentage = EXCLUDED.utilization_percentage,
          booking_requests = EXCLUDED.booking_requests,
          completed_rentals = EXCLUDED.completed_rentals,
          cancelled_rentals = EXCLUDED.cancelled_rentals,
          average_rental_duration = EXCLUDED.average_rental_duration
      `, [
        rentalMachineId,
        date,
        demandData.demand_level,
        demandData.utilization_percentage,
        demandData.booking_requests || 0,
        demandData.completed_rentals || 0,
        demandData.cancelled_rentals || 0,
        demandData.average_rental_duration
      ]);

      return { success: true, message: 'Demand tracking updated successfully' };
    } catch (error) {
      console.error('Error updating demand tracking:', error);
      throw error;
    }
  }

  /**
   * Get demand analytics
   */
  static async getDemandAnalytics(dateRange = '30d') {
    try {
      const dateFilter = this.getDateFilter(dateRange);

      const result = await db.query(`
        SELECT 
          dt.date,
          dt.demand_level,
          COUNT(*) as machine_count,
          AVG(dt.utilization_percentage) as avg_utilization,
          SUM(dt.booking_requests) as total_booking_requests,
          SUM(dt.completed_rentals) as total_completed_rentals,
          SUM(dt.cancelled_rentals) as total_cancelled_rentals,
          AVG(dt.average_rental_duration) as avg_rental_duration
        FROM demand_tracking dt
        WHERE dt.date >= $1 AND dt.date <= $2
        GROUP BY dt.date, dt.demand_level
        ORDER BY dt.date DESC, dt.demand_level
      `, [dateFilter.startDate, dateFilter.endDate]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching demand analytics:', error);
      return [];
    }
  }

  /**
   * Get pricing history for a machine
   */
  static async getPricingHistory(rentalMachineId, limit = 50) {
    try {
      const result = await db.query(`
        SELECT 
          ph.*,
          u.name as changed_by_name
        FROM pricing_history ph
        LEFT JOIN users u ON ph.changed_by = u.id
        WHERE ph.rental_machine_id = $1
        ORDER BY ph.changed_at DESC
        LIMIT $2
      `, [rentalMachineId, limit]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching pricing history:', error);
      return [];
    }
  }

  /**
   * Get pricing simulation for multiple scenarios
   */
  static async getPricingSimulation(rentalMachineId, scenarios) {
    try {
      const results = [];

      for (const scenario of scenarios) {
        const pricing = await this.calculatePricing(
          rentalMachineId,
          scenario.start_date,
          scenario.end_date,
          scenario.customer_id
        );

        results.push({
          scenario: scenario.name || `Scenario ${scenarios.indexOf(scenario) + 1}`,
          start_date: scenario.start_date,
          end_date: scenario.end_date,
          customer_id: scenario.customer_id,
          pricing: pricing
        });
      }

      return results;
    } catch (error) {
      console.error('Error running pricing simulation:', error);
      throw error;
    }
  }

  /**
   * Auto-assign customer tiers based on rental history
   */
  static async autoAssignCustomerTiers() {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Get customer rental statistics
      const customerStats = await client.query(`
        SELECT 
          c.id as customer_id,
          COUNT(mr.id) as rental_count,
          COALESCE(SUM(mr.total_amount), 0) as total_spent
        FROM customers c
        LEFT JOIN machine_rentals mr ON c.id = mr.customer_id
        GROUP BY c.id
      `);

      // Get pricing tiers
      const tiers = await client.query(`
        SELECT * FROM customer_pricing_tiers
        WHERE is_active = TRUE
        ORDER BY minimum_rentals DESC, minimum_total_spent DESC
      `);

      let assignedCount = 0;

      for (const customer of customerStats.rows) {
        // Find appropriate tier
        const appropriateTier = tiers.rows.find(tier => 
          customer.rental_count >= tier.minimum_rentals && 
          customer.total_spent >= tier.minimum_total_spent
        );

        if (appropriateTier) {
          // Deactivate existing assignments
          await client.query(`
            UPDATE customer_tier_assignments 
            SET is_active = FALSE 
            WHERE customer_id = $1
          `, [customer.customer_id]);

          // Check if already assigned to this tier
          const existingAssignment = await client.query(`
            SELECT id FROM customer_tier_assignments
            WHERE customer_id = $1 AND tier_id = $2
          `, [customer.customer_id, appropriateTier.id]);

          if (existingAssignment.rows.length === 0) {
            // Create new assignment
            await client.query(`
              INSERT INTO customer_tier_assignments (customer_id, tier_id)
              VALUES ($1, $2)
            `, [customer.customer_id, appropriateTier.id]);
            assignedCount++;
          } else {
            // Reactivate existing assignment
            await client.query(`
              UPDATE customer_tier_assignments 
              SET is_active = TRUE 
              WHERE customer_id = $1 AND tier_id = $2
            `, [customer.customer_id, appropriateTier.id]);
          }
        }
      }

      await client.query('COMMIT');
      return { 
        success: true, 
        message: `Auto-assigned ${assignedCount} customers to appropriate tiers`,
        assigned_count: assignedCount
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error auto-assigning customer tiers:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get date filter based on range
   */
  static getDateFilter(dateRange) {
    const endDate = new Date();
    const startDate = new Date();

    switch (dateRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }
}

module.exports = DynamicPricingService;
