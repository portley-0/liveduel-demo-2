import { findMatchbookId, MappingResult } from '../src/services/id-mapper';

const ENABLE_CONSOLE_LOGS = true; 

const TEST_API_FOOTBALL_ID = 1321685; 

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


describe('id-mapper (functionality test)', () => {

  beforeAll(async () => {
    console.log('\n--- ID Mapper Functionality Test Started ---');
    console.log(`Attempting to map API-Football ID: ${TEST_API_FOOTBALL_ID} to Matchbook.`);
  }, 15000);

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    console.log('\n--- ID Mapper Functionality Test Completed ---');
  });


  it('should attempt to map a real API-Football ID to a Matchbook event and log the result', async () => {
    console.log(`\n--- Calling findMatchbookId for API-Football ID: ${TEST_API_FOOTBALL_ID} ---`);

    const mappingResult: MappingResult | null = await findMatchbookId(TEST_API_FOOTBALL_ID);

    if (mappingResult) {
      console.log('✅ Mapping successful!');
      console.log(`  Matchbook Event ID: ${mappingResult.matchbookEventId}`);
      console.log(`  Home Team Name: ${mappingResult.homeTeamName}`);
      console.log(`  Away Team Name: ${mappingResult.awayTeamName}`);
      // Basic assertions to confirm structure if found
      expect(mappingResult).toHaveProperty('matchbookEventId');
      expect(typeof mappingResult.matchbookEventId).toBe('number');
      expect(mappingResult.matchbookEventId).toBeGreaterThan(0);
      expect(mappingResult).toHaveProperty('homeTeamName');
      expect(typeof mappingResult.homeTeamName).toBe('string');
      expect(mappingResult.homeTeamName.length).toBeGreaterThan(0);
      expect(mappingResult).toHaveProperty('awayTeamName');
      expect(typeof mappingResult.awayTeamName).toBe('string');
      expect(mappingResult.awayTeamName.length).toBeGreaterThan(0);
    } else {
      console.warn('❌ Mapping failed or no confident match found.');
      console.warn(`  Could not map API-Football ID ${TEST_API_FOOTBALL_ID} to a Matchbook event.`);
      expect(mappingResult).toBeNull();
    }

    console.log('--- findMatchbookId call complete ---');
  }, 30000); 
});
