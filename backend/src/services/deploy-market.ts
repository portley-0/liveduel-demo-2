import { ethers } from 'ethers';
import axios from 'axios';
import MarketFactoryArtifact from '../artifacts/MarketFactory.json';

const MARKET_FACTORY_ABI = MarketFactoryArtifact.abi;

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS || '';
const AVALANCHE_FUJI_RPC = process.env.AVALANCHE_FUJI_RPC || '';
const API_KEY = process.env.API_KEY || '';

const baseUrl = 'https://v3.football.api-sports.io';
const endpoint = '/fixtures';

const ALLOWED_LEAGUE_IDS = [2, 3, 39, 140, 78, 61, 135, 88, 71, 253, 130, 94, 98, 848];

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

  const provider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const factory = new ethers.Contract(
    MARKET_FACTORY_ADDRESS,
    MARKET_FACTORY_ABI,
    wallet
  );

  const tx = await factory.deployPredictionMarket(matchId, matchTimestamp);
  await tx.wait();
  
  const newMarketAddress = await factory.predictionMarkets(matchId);

  return newMarketAddress;
}
