import 'dotenv/config'; 
import { Pool } from 'pg';

export async function pruneOldTrades() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  });

  const client = await pool.connect();
  console.log('Connected to PostgreSQL for pruning...');

  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const cutoffTimestamp = Math.floor(weekAgo.getTime() / 1000); 

    console.log(`Pruning "TradeExecuted" records older than ${weekAgo.toISOString()}`);

    const schemaName = 'sgd1'; 

    const deleteQuery = `DELETE FROM ${schemaName}."trade_executed" WHERE timestamp < $1;`;
    const res = await client.query(deleteQuery, [cutoffTimestamp]);
    console.log(`✅ Successfully deleted ${res.rowCount} old trade records.`);

    console.log('Vacuuming the table to reclaim space...');
    await client.query(`VACUUM ${schemaName}."trade_executed";`);
    console.log('✅ Vacuum complete.');

  } catch (err) {
    console.error('❌ Error during pruneOldTrades execution:', err);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}