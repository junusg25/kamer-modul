const db = require('../db');

class RentalAnalyticsService {
  /**
   * Get comprehensive rental analytics overview
   */
  static async getRentalOverview(dateRange = '30d') {
    try {
      const dateFilter = this.getDateFilter(dateRange);
      
      const [
        fleetStats,
        revenueStats,
        utilizationStats,
        customerStats,
        statusStats,
        overdueStats
      ] = await Promise.all([
        this.getFleetStatistics(),
        this.getRevenueStatistics(dateFilter),
        this.getUtilizationStatistics(dateFilter),
        this.getCustomerStatistics(dateFilter),
        this.getStatusStatistics(),
        this.getOverdueStatistics()
      ]);

      return {
        fleet: fleetStats,
        revenue: revenueStats,
        utilization: utilizationStats,
        customers: customerStats,
        status: statusStats,
        overdue: overdueStats,
        dateRange,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching rental overview:', error);
      throw error;
    }
  }

  /**
   * Get fleet statistics
   */
  static async getFleetStatistics() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_machines,
          COUNT(CASE WHEN rental_status = 'available' THEN 1 END) as available_machines,
          COUNT(CASE WHEN rental_status = 'rented' THEN 1 END) as rented_machines,
          COUNT(CASE WHEN rental_status = 'reserved' THEN 1 END) as reserved_machines,
          COUNT(CASE WHEN rental_status = 'cleaning' THEN 1 END) as cleaning_machines,
          COUNT(CASE WHEN rental_status = 'inspection' THEN 1 END) as inspection_machines,
          COUNT(CASE WHEN rental_status = 'maintenance' THEN 1 END) as maintenance_machines,
          COUNT(CASE WHEN rental_status = 'repair' THEN 1 END) as repair_machines,
          COUNT(CASE WHEN rental_status = 'quarantine' THEN 1 END) as quarantine_machines,
          COUNT(CASE WHEN rental_status = 'retired' THEN 1 END) as retired_machines,
          ROUND(
            COUNT(CASE WHEN rental_status IN ('rented', 'reserved') THEN 1 END) * 100.0 / COUNT(*), 
            2
          ) as utilization_percentage
        FROM rental_machines
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching fleet statistics:', error);
      return {};
    }
  }

  /**
   * Get revenue statistics
   */
  static async getRevenueStatistics(dateFilter) {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_rentals,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as average_rental_value,
          COALESCE(SUM(CASE WHEN rental_status = 'active' THEN total_amount ELSE 0 END), 0) as active_revenue,
          COALESCE(SUM(CASE WHEN rental_status = 'returned' THEN total_amount ELSE 0 END), 0) as completed_revenue,
          COALESCE(SUM(CASE WHEN rental_status = 'overdue' THEN total_amount ELSE 0 END), 0) as overdue_revenue
        FROM machine_rentals
        WHERE created_at >= $1
      `, [dateFilter.startDate]);

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching revenue statistics:', error);
      return {};
    }
  }

  /**
   * Get utilization statistics
   */
  static async getUtilizationStatistics(dateFilter) {
    try {
      const result = await db.query(`
        WITH daily_utilization AS (
          SELECT 
            DATE(rental_start_date) as rental_date,
            COUNT(*) as daily_rentals,
            COUNT(DISTINCT rental_machine_id) as unique_machines_rented
          FROM machine_rentals
          WHERE rental_start_date >= $1
            AND rental_start_date <= $2
          GROUP BY DATE(rental_start_date)
        )
        SELECT 
          COALESCE(AVG(daily_rentals), 0) as average_daily_rentals,
          COALESCE(MAX(daily_rentals), 0) as peak_daily_rentals,
          COALESCE(AVG(unique_machines_rented), 0) as average_daily_utilization,
          COALESCE(MAX(unique_machines_rented), 0) as peak_daily_utilization
        FROM daily_utilization
      `, [dateFilter.startDate, dateFilter.endDate]);

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching utilization statistics:', error);
      return {};
    }
  }

  /**
   * Get customer statistics
   */
  static async getCustomerStatistics(dateFilter) {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(DISTINCT customer_id) as unique_customers,
          COUNT(*) as total_rentals,
          COALESCE(AVG(rental_count), 0) as average_rentals_per_customer,
          COALESCE(MAX(rental_count), 0) as max_rentals_per_customer
        FROM (
          SELECT 
            customer_id,
            COUNT(*) as rental_count
          FROM machine_rentals
          WHERE created_at >= $1
          GROUP BY customer_id
        ) customer_rentals
      `, [dateFilter.startDate]);

      // Get top customers
      const topCustomers = await db.query(`
        SELECT 
          c.id,
          c.name,
          c.company_name,
          COUNT(mr.id) as rental_count,
          COALESCE(SUM(mr.total_amount), 0) as total_spent
        FROM customers c
        JOIN machine_rentals mr ON c.id = mr.customer_id
        WHERE mr.created_at >= $1
        GROUP BY c.id, c.name, c.company_name
        ORDER BY total_spent DESC
        LIMIT 5
      `, [dateFilter.startDate]);

      return {
        ...result.rows[0],
        top_customers: topCustomers.rows
      };
    } catch (error) {
      console.error('Error fetching customer statistics:', error);
      return {};
    }
  }

  /**
   * Get status distribution statistics
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

  /**
   * Get overdue rental statistics
   */
  static async getOverdueStatistics() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as overdue_count,
          COALESCE(SUM(total_amount), 0) as overdue_value,
          COALESCE(AVG(EXTRACT(DAYS FROM CURRENT_DATE - planned_return_date)), 0) as average_days_overdue,
          COALESCE(MAX(EXTRACT(DAYS FROM CURRENT_DATE - planned_return_date)), 0) as max_days_overdue
        FROM machine_rentals
        WHERE rental_status = 'active'
          AND planned_return_date < CURRENT_DATE
      `);

      // Get overdue rental details
      const overdueDetails = await db.query(`
        SELECT 
          mr.id,
          mr.planned_return_date,
          EXTRACT(DAYS FROM CURRENT_DATE - mr.planned_return_date) as days_overdue,
          mr.total_amount,
          c.name as customer_name,
          c.company_name,
          rm.serial_number,
          mm.name as machine_name,
          mm.manufacturer
        FROM machine_rentals mr
        JOIN customers c ON mr.customer_id = c.id
        JOIN rental_machines rm ON mr.rental_machine_id = rm.id
        JOIN machine_models mm ON rm.model_id = mm.id
        WHERE mr.rental_status = 'active'
          AND mr.planned_return_date < CURRENT_DATE
        ORDER BY days_overdue DESC
        LIMIT 10
      `);

      return {
        ...result.rows[0],
        overdue_rentals: overdueDetails.rows
      };
    } catch (error) {
      console.error('Error fetching overdue statistics:', error);
      return {};
    }
  }

  /**
   * Get rental trends over time
   */
  static async getRentalTrends(dateRange = '30d', groupBy = 'day') {
    try {
      const dateFilter = this.getDateFilter(dateRange);
      const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';

      const result = await db.query(`
        SELECT 
          TO_CHAR(created_at, $3) as period,
          COUNT(*) as rental_count,
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(DISTINCT customer_id) as unique_customers,
          COUNT(DISTINCT rental_machine_id) as unique_machines
        FROM machine_rentals
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY TO_CHAR(created_at, $3)
        ORDER BY period
      `, [dateFilter.startDate, dateFilter.endDate, dateFormat]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching rental trends:', error);
      return [];
    }
  }

  /**
   * Get machine performance analytics
   */
  static async getMachinePerformance(dateRange = '30d') {
    try {
      const dateFilter = this.getDateFilter(dateRange);

      const result = await db.query(`
        SELECT 
          rm.id,
          rm.serial_number,
          mm.name as machine_name,
          mm.manufacturer,
          rm.rental_status,
          COUNT(mr.id) as total_rentals,
          COALESCE(SUM(mr.total_amount), 0) as total_revenue,
          COALESCE(AVG(mr.total_amount), 0) as average_rental_value,
          COALESCE(SUM(EXTRACT(DAYS FROM mr.rental_end_date - mr.rental_start_date)), 0) as total_rental_days,
          ROUND(
            COALESCE(SUM(EXTRACT(DAYS FROM mr.rental_end_date - mr.rental_start_date)), 0) * 100.0 / 
            EXTRACT(DAYS FROM $2 - $1), 
            2
          ) as utilization_percentage
        FROM rental_machines rm
        JOIN machine_models mm ON rm.model_id = mm.id
        LEFT JOIN machine_rentals mr ON rm.id = mr.rental_machine_id 
          AND mr.created_at >= $1 AND mr.created_at <= $2
        GROUP BY rm.id, rm.serial_number, mm.name, mm.manufacturer, rm.rental_status
        ORDER BY total_revenue DESC
        LIMIT 20
      `, [dateFilter.startDate, dateFilter.endDate]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching machine performance:', error);
      return [];
    }
  }

  /**
   * Get rental duration analytics
   */
  static async getRentalDurationAnalytics(dateRange = '30d') {
    try {
      const dateFilter = this.getDateFilter(dateRange);

      const result = await db.query(`
        SELECT 
          CASE 
            WHEN EXTRACT(DAYS FROM rental_end_date - rental_start_date) <= 1 THEN '1 day'
            WHEN EXTRACT(DAYS FROM rental_end_date - rental_start_date) <= 7 THEN '2-7 days'
            WHEN EXTRACT(DAYS FROM rental_end_date - rental_start_date) <= 30 THEN '1-4 weeks'
            WHEN EXTRACT(DAYS FROM rental_end_date - rental_start_date) <= 90 THEN '1-3 months'
            ELSE '3+ months'
          END as duration_category,
          COUNT(*) as rental_count,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as average_revenue
        FROM machine_rentals
        WHERE created_at >= $1 
          AND rental_end_date IS NOT NULL
        GROUP BY 
          CASE 
            WHEN EXTRACT(DAYS FROM rental_end_date - rental_start_date) <= 1 THEN '1 day'
            WHEN EXTRACT(DAYS FROM rental_end_date - rental_start_date) <= 7 THEN '2-7 days'
            WHEN EXTRACT(DAYS FROM rental_end_date - rental_start_date) <= 30 THEN '1-4 weeks'
            WHEN EXTRACT(DAYS FROM rental_end_date - rental_start_date) <= 90 THEN '1-3 months'
            ELSE '3+ months'
          END
        ORDER BY rental_count DESC
      `, [dateFilter.startDate]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching rental duration analytics:', error);
      return [];
    }
  }

  /**
   * Get billing period analytics
   */
  static async getBillingPeriodAnalytics(dateRange = '30d') {
    try {
      const dateFilter = this.getDateFilter(dateRange);

      const result = await db.query(`
        SELECT 
          billing_period,
          COUNT(*) as rental_count,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(AVG(total_amount), 0) as average_revenue,
          COALESCE(AVG(price_per_day), 0) as average_daily_rate,
          COALESCE(AVG(price_per_week), 0) as average_weekly_rate,
          COALESCE(AVG(price_per_month), 0) as average_monthly_rate
        FROM machine_rentals
        WHERE created_at >= $1
        GROUP BY billing_period
        ORDER BY total_revenue DESC
      `, [dateFilter.startDate]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching billing period analytics:', error);
      return [];
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

  /**
   * Get real-time dashboard data
   */
  static async getRealTimeDashboard() {
    try {
      const [
        currentRentals,
        todayStats,
        alerts
      ] = await Promise.all([
        this.getCurrentRentals(),
        this.getTodayStats(),
        this.getAlerts()
      ]);

      return {
        current_rentals: currentRentals,
        today_stats: todayStats,
        alerts: alerts,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real-time dashboard:', error);
      throw error;
    }
  }

  /**
   * Get current active rentals
   */
  static async getCurrentRentals() {
    try {
      const result = await db.query(`
        SELECT 
          mr.id,
          mr.rental_start_date,
          mr.planned_return_date,
          mr.total_amount,
          c.name as customer_name,
          c.company_name,
          rm.serial_number,
          mm.name as machine_name,
          mm.manufacturer,
          CASE 
            WHEN mr.planned_return_date < CURRENT_DATE THEN 'overdue'
            WHEN mr.planned_return_date <= CURRENT_DATE + INTERVAL '2 days' THEN 'ending_soon'
            ELSE 'active'
          END as status
        FROM machine_rentals mr
        JOIN customers c ON mr.customer_id = c.id
        JOIN rental_machines rm ON mr.rental_machine_id = rm.id
        JOIN machine_models mm ON rm.model_id = mm.id
        WHERE mr.rental_status = 'active'
        ORDER BY mr.planned_return_date ASC
        LIMIT 10
      `);

      return result.rows;
    } catch (error) {
      console.error('Error fetching current rentals:', error);
      return [];
    }
  }

  /**
   * Get today's statistics
   */
  static async getTodayStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(CASE WHEN DATE(rental_start_date) = CURRENT_DATE THEN 1 END) as rentals_starting_today,
          COUNT(CASE WHEN DATE(planned_return_date) = CURRENT_DATE THEN 1 END) as rentals_ending_today,
          COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as new_rentals_today,
          COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN total_amount ELSE 0 END), 0) as revenue_today
        FROM machine_rentals
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching today stats:', error);
      return {};
    }
  }

  /**
   * Get system alerts
   */
  static async getAlerts() {
    try {
      const alerts = [];

      // Overdue rentals
      const overdueResult = await db.query(`
        SELECT COUNT(*) as count
        FROM machine_rentals
        WHERE rental_status = 'active' AND planned_return_date < CURRENT_DATE
      `);
      
      if (overdueResult.rows[0].count > 0) {
        alerts.push({
          type: 'warning',
          title: 'Overdue Rentals',
          message: `${overdueResult.rows[0].count} rental(s) are overdue`,
          count: overdueResult.rows[0].count
        });
      }

      // Machines in quarantine
      const quarantineResult = await db.query(`
        SELECT COUNT(*) as count
        FROM rental_machines
        WHERE rental_status = 'quarantine'
      `);
      
      if (quarantineResult.rows[0].count > 0) {
        alerts.push({
          type: 'error',
          title: 'Machines in Quarantine',
          message: `${quarantineResult.rows[0].count} machine(s) are quarantined`,
          count: quarantineResult.rows[0].count
        });
      }

      // Low availability
      const availabilityResult = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN rental_status = 'available' THEN 1 END) as available
        FROM rental_machines
      `);
      
      const availability = availabilityResult.rows[0];
      const availabilityPercentage = (availability.available / availability.total) * 100;
      
      if (availabilityPercentage < 20) {
        alerts.push({
          type: 'info',
          title: 'Low Fleet Availability',
          message: `Only ${availabilityPercentage.toFixed(1)}% of fleet is available`,
          count: availability.available
        });
      }

      return alerts;
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return [];
    }
  }
}

module.exports = RentalAnalyticsService;
