// Script to create sample sales targets
const db = require('../db');

async function createSampleTargets() {
  try {
    console.log('Creating sample sales targets...');

    // Get all sales users
    const salesUsers = await db.query(
      'SELECT id, name FROM users WHERE role = $1 AND status = $2',
      ['sales', 'active']
    );

    if (salesUsers.rows.length === 0) {
      console.log('No sales users found. Creating targets for admin user...');
      
      // Create targets for admin user (ID 1) if no sales users exist
      const adminUser = await db.query('SELECT id, name FROM users WHERE id = $1', [1]);
      
      if (adminUser.rows.length > 0) {
        const userId = adminUser.rows[0].id;
        
        // Create monthly target
        await db.query(`
          INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          'monthly',
          50000.00,
          new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Start of current month
          new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), // End of current month
          'Sample monthly target for testing',
          1
        ]);

        // Create quarterly target
        const quarterStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3 + 3, 0);
        
        await db.query(`
          INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          'quarterly',
          150000.00,
          quarterStart,
          quarterEnd,
          'Sample quarterly target for testing',
          1
        ]);

        // Create yearly target
        await db.query(`
          INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          'yearly',
          600000.00,
          new Date(new Date().getFullYear(), 0, 1), // Start of current year
          new Date(new Date().getFullYear(), 11, 31), // End of current year
          'Sample yearly target for testing',
          1
        ]);

        console.log(`Created sample targets for admin user (ID: ${userId})`);
      }
    } else {
      // Create targets for each sales user
      for (const user of salesUsers.rows) {
        const userId = user.id;
        
        // Create monthly target
        await db.query(`
          INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          'monthly',
          50000.00,
          new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Start of current month
          new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), // End of current month
          `Monthly target for ${user.name}`,
          1
        ]);

        // Create quarterly target
        const quarterStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3 + 3, 0);
        
        await db.query(`
          INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          'quarterly',
          150000.00,
          quarterStart,
          quarterEnd,
          `Quarterly target for ${user.name}`,
          1
        ]);

        // Create yearly target
        await db.query(`
          INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          'yearly',
          600000.00,
          new Date(new Date().getFullYear(), 0, 1), // Start of current year
          new Date(new Date().getFullYear(), 11, 31), // End of current year
          `Yearly target for ${user.name}`,
          1
        ]);

        console.log(`Created sample targets for ${user.name} (ID: ${userId})`);
      }
    }

    console.log('Sample targets created successfully!');
    
    // Show created targets
    const targets = await db.query(`
      SELECT 
        st.*,
        u.name as user_name,
        cb.name as created_by_name
      FROM sales_targets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users cb ON st.created_by = cb.id
      ORDER BY st.created_at DESC
    `);

    console.log('\nCreated targets:');
    targets.rows.forEach(target => {
      console.log(`- ${target.user_name}: ${target.target_type} target of ${target.target_amount} KM (${target.target_period_start} to ${target.target_period_end})`);
    });

  } catch (error) {
    console.error('Error creating sample targets:', error);
  } finally {
    process.exit(0);
  }
}

createSampleTargets();
