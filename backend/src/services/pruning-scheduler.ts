import cron from 'node-cron';
import { pruneOldTrades } from './prune-trades'; 

export function startPruningScheduler() {
  const cronExpression = '0 3 * * *';

  console.log('✅ Pruning scheduler started. Task will run daily at 3:00 AM.');

  cron.schedule(cronExpression, () => {
    console.log('🚀 Running scheduled job: Pruning old TradeExecuted entities...');
    
    pruneOldTrades().catch((error: unknown) => {
      console.error('❌ Error during scheduled pruning:', error);
    });
  }, {
    timezone: "UTC" 
  });
}