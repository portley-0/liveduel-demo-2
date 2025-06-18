import { getMatchbookOdds, MarketOdds } from '../src/services/matchbook.api';

const ENABLE_CONSOLE_LOGS = true;
const TEST_MATCHBOOK_EVENT_ID = 29635503059800061n;
const TEST_HOME_TEAM_NAME = 'Monterrey';
const TEST_AWAY_TEAM_NAME = 'Inter';

const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
  if (ENABLE_CONSOLE_LOGS) {
    jest.requireActual('console').error(...args);
  }
});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args) => {
  if (ENABLE_CONSOLE_LOGS) {
    jest.requireActual('console').warn(...args);
  }
});
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
  if (ENABLE_CONSOLE_LOGS) {
    jest.requireActual('console').log(...args);
  }
});


describe('matchbook.api.ts (Direct Integration Test)', () => {

  jest.setTimeout(30000); 

  beforeAll(() => {
    console.log('\n--- Matchbook Odds Fetcher Direct Test ---');
    if (!process.env.MATCHBOOK_USERNAME || !process.env.MATCHBOOK_PASSWORD) {
        throw new Error("FATAL: MATCHBOOK_USERNAME and MATCHBOOK_PASSWORD must be set in your .env file.");
    }
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    console.log('\n--- Matchbook Odds Fetcher Test Completed ---');
  });

  it('should fetch and correctly parse the odds for a specific live Matchbook event', async () => {
    console.log(`\n--- Calling getMatchbookOdds for event: "${TEST_HOME_TEAM_NAME} vs ${TEST_AWAY_TEAM_NAME}" (ID: ${TEST_MATCHBOOK_EVENT_ID}) ---`);

    const oddsResult: MarketOdds | null = await getMatchbookOdds(
      TEST_MATCHBOOK_EVENT_ID.toString(),
      TEST_HOME_TEAM_NAME,
      TEST_AWAY_TEAM_NAME
    );

    if (!oddsResult) {
        throw new Error('Expected a valid MarketOdds object from the API, but received null. The event may have expired or an error occurred.');
    }

    console.log('✅ Odds fetch successful!');
    console.log(`  Home: ${oddsResult.home}`);
    console.log(`  Draw: ${oddsResult.draw}`);
    console.log(`  Away: ${oddsResult.away}`);
    
    expect(oddsResult).not.toBeNull();
    expect(oddsResult).toHaveProperty('home');
    expect(typeof oddsResult.home).toBe('number');
    expect(oddsResult.home).toBeGreaterThanOrEqual(1);

    expect(oddsResult).toHaveProperty('draw');
    expect(typeof oddsResult.draw).toBe('number');
    expect(oddsResult.draw).toBeGreaterThanOrEqual(1);

    expect(oddsResult).toHaveProperty('away');
    expect(typeof oddsResult.away).toBe('number');
    expect(oddsResult.away).toBeGreaterThanOrEqual(1);
  });
});
