const db = require('./db');

async function checkSystemSettings() {
  try {
    const result = await db.query('SELECT * FROM system_settings ORDER BY setting_key');
    console.log('System Settings:');
    console.log('================');
    result.rows.forEach(row => {
      console.log(`${row.setting_key}: ${row.setting_value} (${row.description})`);
    });
    console.log(`\nTotal settings: ${result.rows.length}`);
  } catch (error) {
    console.error('Error checking system settings:', error);
  } finally {
    process.exit(0);
  }
}

checkSystemSettings();
