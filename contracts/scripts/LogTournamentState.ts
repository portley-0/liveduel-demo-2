import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.AVALANCHE_FUJI_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const tournamentId = Number(process.env.TOURNAMENT_ID!);
  const factoryAddress = process.env.MARKET_FACTORY_ADDRESS!;
  const tournamentMarketAddress = process.env[`TOURNAMENT_MARKET_ADDRESS_${tournamentId}`]!;

  const factory = await ethers.getContractAt("MarketFactory", factoryAddress, signer);
  const tournament = await ethers.getContractAt("TournamentMarket", tournamentMarketAddress, signer);

  const fixtureCount = await tournament.getFixtureCount();
  console.log(`📦 TournamentMarket @ ${tournamentMarketAddress}\n`);
  console.log(`🎯 Fixture Count: ${fixtureCount.toString()}\n`);
  const totalTeams = await tournament.getTotalTeams();
  console.log(`🏆 Total Teams: ${totalTeams.toString()}\n`);

  for (let i = 0; i < fixtureCount.toNumber(); i++) {
    const fixture = await tournament.getFixture(i);
    console.log(`Fixture ${i}:`);
    console.log(`  Match ID:           ${fixture.matchId.toString()}`);
    console.log(`  Resolved:           ${fixture.fixtureResolved}`);
    console.log(`  Winner Index:       ${fixture.winnerIndex}`);
    console.log(`  Is Round Final:     ${fixture.isRoundFinal}`);
    console.log(`  Is Tournament Final:${fixture.isTournamentFinal}`);
    console.log("");
  }

  const tournamentFixtures: number[] = [];
  for (let i = 0; i < 100; i++) { 
    try {
      const fixtureId = await factory.tournamentFixturesToResolve(i);
      tournamentFixtures.push(fixtureId.toNumber());
    } catch {
      break;
    }
  }

  console.log("🏗️  MarketFactory Tournament Fixtures To Resolve:");
  for (let i = 0; i < tournamentFixtures.length; i++) {
    const fixtureId = tournamentFixtures[i];
    const ts = await factory.fixtureTs(fixtureId);
    console.log(`  [${i}] Fixture ID: ${fixtureId} → Timestamp: ${ts.toString()}`);
  }

  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
