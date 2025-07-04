import { ethers } from 'ethers';
import axios from 'axios';
import { bootstrapInventory } from './portfolio-manager';
import MarketFactoryArtifact from '../artifacts/MarketFactory.json';
import { findMatchbookId } from './id-mapper';
import { getMatchbookOdds } from './matchbook.api';

const MARKET_FACTORY_ABI = MarketFactoryArtifact.abi;

const BOOTSTRAP_FUNDING_AMOUNT_USDC = 15000;

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS || '';
const AVALANCHE_FUJI_RPC = process.env.AVALANCHE_FUJI_RPC || '';
const API_KEY = process.env.API_KEY || '';

const baseUrl = 'https://v3.football.api-sports.io';
const endpoint = '/fixtures';

const ALLOWED_LEAGUE_IDS = [2, 3, 11, 13, 15, 34, 39, 130, 140, 71, 78, 61, 135, 239, 265, 848];

async function fetchGameData(gameId: number) {
  const response = await axios.get(`${baseUrl}${endpoint}?id=${gameId}`, {
    headers: {
      'x-apisports-key': API_KEY,
      'x-apisports-host': 'v3.football.api-sports.io', 
    },
  });

  if (response.status !== 200) {
    throw new Error(`Soccer API request failed with status ${response.status}`);
  }

  if (!response.data.response || response.data.response.length === 0) {
    throw new Error(`Game ${gameId} not found or no response from Football API`);
  }

  return response.data.response[0];
}

export async function deployMarket(matchId: number, matchTimestamp: number) {
  const fixtureData = await fetchGameData(matchId);

  const fixture = fixtureData.fixture;
  if (!fixture) {
    throw new Error('No fixture data was returned from API Football ');
  }

  const leagueId = fixtureData.league.id;
  if (!ALLOWED_LEAGUE_IDS.includes(leagueId)) {
    throw new Error(`League ID ${leagueId} is not allowed. Allowed league IDs are: ${ALLOWED_LEAGUE_IDS.join(', ')}`);
  }

  if (!["NS", "HT", "1H", "2H"].includes(fixture.status?.short)) {
    throw new Error(
      `Match ${matchId} is not in an allowed status (NS, HT, 1H, 2H). Current status is: ${fixture.status?.short}`    );
  }

  if (fixture.timestamp !== matchTimestamp) {
    throw new Error(
      `Passed matchTimestamp ${matchTimestamp} does not match fixture timestamp ${fixture.timestamp}`
    );
  }

  console.log(`PRE-DEPLOY CHECK: Validating market existence on Matchbook for matchId ${matchId}...`);

  const mappingResult = await findMatchbookId(matchId);
  if (!mappingResult) {
    throw new Error(`PRE-DEPLOY FAILED: Could not map matchId ${matchId} to a Matchbook event. Deployment aborted.`);
  }

  const { matchbookEventId, homeTeamName, awayTeamName } = mappingResult;
  const matchbookOdds = await getMatchbookOdds(matchbookEventId, homeTeamName, awayTeamName);

  if (!matchbookOdds) {
    throw new Error(`PRE-DEPLOY FAILED: Found Matchbook event ${matchbookEventId}, but no active odds are available. Deployment aborted.`);
  }

  console.log(`✅ PRE-DEPLOY CHECK PASSED: Matchbook market with active odds found for matchId ${matchId}.`);


  const provider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const factory = new ethers.Contract(
    MARKET_FACTORY_ADDRESS,
    MARKET_FACTORY_ABI,
    wallet
  );

  const tx = await factory.deployPredictionMarket(matchId, matchTimestamp);
  await tx.wait();

  try {
    console.log(`LIFECYCLE: Preparing to bootstrap inventory for new market...`);

    const conditionId = await factory.matchConditionIds(matchId);
    if (!conditionId || conditionId === ethers.ZeroHash) {
        throw new Error(`Could not retrieve a valid conditionId from the factory for matchId ${matchId}.`);
    }
    
    console.log(`Retrieved conditionId: ${conditionId}. Now calling bootstrapInventory...`);
    
    await bootstrapInventory(conditionId, BOOTSTRAP_FUNDING_AMOUNT_USDC);

    console.log(`✅✅✅ SUCCESS: Market ${matchId} is deployed and bot inventory is fully funded!`);

  } catch (bootstrapError) {
    console.error(`❌ LIFECYCLE ERROR: Market was deployed, but bootstrapping failed! Manual intervention may be required.`);
    console.error(bootstrapError);
  }

  
  const newMarketAddress = await factory.predictionMarkets(matchId);

  return newMarketAddress;
}
