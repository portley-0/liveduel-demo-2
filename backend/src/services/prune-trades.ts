import 'dotenv/config';
import { Pool } from 'pg';

const SCHEMA = 'sgd1';
const TABLE = 'trade_executed';
const INTERVAL_DAYS = 10;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function pruneOldTrades() {
  console.log(
    `Pruning "${SCHEMA}.${TABLE}" records older than NOW() - INTERVAL '${INTERVAL_DAYS} days'`
  );

  try {
    // Delete anything older than 10 days
    const deleteQuery = `
      DELETE FROM ${SCHEMA}."${TABLE}"
      WHERE "timestamp" < NOW() - INTERVAL '${INTERVAL_DAYS} days';
    `;
    const { rowCount } = await pool.query(deleteQuery);
    console.log(`✅ Deleted ${rowCount} old trade records.`);

    console.log('Vacuuming the table to reclaim space...');
    await pool.query(`VACUUM ${SCHEMA}."${TABLE}";`);
    console.log('✅ Vacuum complete.');
  } catch (err) {
    console.error('❌ Error during pruneOldTrades execution:', err);
  }
}

// Allow running as a standalone script:
if (require.main === module) {
  pruneOldTrades()
    .catch(() => {})
    .finally(() => pool.end());
}
