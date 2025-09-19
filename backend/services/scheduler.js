const cron = require('node-cron');
const { updateReservedRentalsToActive, updateOverdueRentals } = require('../utils/rentalStatusUpdater');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting rental status scheduler...');

    // Run daily at 8:00 AM to update reserved rentals to active
    const reservedToActiveJob = cron.schedule('0 8 * * *', async () => {
      try {
        logger.info('Running daily rental status update: Reserved to Active');
        const result = await updateReservedRentalsToActive();
        logger.info(`Reserved to Active update completed: ${result.updated} rentals updated`);
      } catch (error) {
        logger.error('Error in reserved to active update job:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Belgrade' // Adjust timezone as needed
    });

    // Run daily at 8:30 AM to update overdue rentals
    const overdueJob = cron.schedule('30 8 * * *', async () => {
      try {
        logger.info('Running daily rental status update: Overdue Check');
        const result = await updateOverdueRentals();
        logger.info(`Overdue update completed: ${result.updated} rentals updated`);
      } catch (error) {
        logger.error('Error in overdue update job:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Belgrade' // Adjust timezone as needed
    });

    // Store job references
    this.jobs.push(reservedToActiveJob, overdueJob);

    // Start all jobs
    this.jobs.forEach(job => job.start());
    this.isRunning = true;

    logger.info('Rental status scheduler started successfully');
    logger.info('Jobs scheduled:');
    logger.info('- Reserved to Active: Daily at 8:00 AM');
    logger.info('- Overdue Check: Daily at 8:30 AM');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Scheduler is not running');
      return;
    }

    logger.info('Stopping rental status scheduler...');
    
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;

    logger.info('Rental status scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.length,
      jobs: this.jobs.map((job, index) => ({
        index,
        running: job.running
      }))
    };
  }

  /**
   * Manually trigger reserved to active update (for testing)
   */
  async triggerReservedToActiveUpdate() {
    try {
      logger.info('Manually triggering reserved to active update...');
      const result = await updateReservedRentalsToActive();
      logger.info(`Manual update completed: ${result.updated} rentals updated`);
      return result;
    } catch (error) {
      logger.error('Error in manual reserved to active update:', error);
      throw error;
    }
  }

  /**
   * Manually trigger overdue update (for testing)
   */
  async triggerOverdueUpdate() {
    try {
      logger.info('Manually triggering overdue update...');
      const result = await updateOverdueRentals();
      logger.info(`Manual update completed: ${result.updated} rentals updated`);
      return result;
    } catch (error) {
      logger.error('Error in manual overdue update:', error);
      throw error;
    }
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;
