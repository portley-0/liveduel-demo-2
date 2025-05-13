import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import type { BigNumberish } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();


async function main() {
  const privateKey = process.env.PRIVATE_KEY!;
  const provider = new ethers.providers.JsonRpcProvider(process.env.AVALANCHE_FUJI_RPC_URL);
  const signer = new ethers.Wallet(privateKey, provider);

  const factoryAddress          = process.env.MARKET_FACTORY_ADDRESS!;
  const roundConsumerAddress    = process.env.ROUND_CONSUMER_ADDRESS!;
  const tournamentId            = Number(process.env.TOURNAMENT_ID!);
  const season                  = Number(process.env.SEASON!);
  const teamIdsArray: BigNumberish[] = JSON.parse(process.env.TEAM_IDS!);

  console.log("→ Deploying TournamentMarket…");
  console.log("   Factory:", factoryAddress);
  console.log("   RoundConsumer:", roundConsumerAddress);
  console.log("   Tournament ID:", tournamentId);
  console.log("   Season:", season);
  console.log("   Teams:", teamIdsArray.join(", "));

  const factory = await ethers.getContractAt("MarketFactory", factoryAddress, signer);

  const currentOwner = await factory.owner();
  console.log("Factory owner:", currentOwner);
  console.log("Owner address:", signer.address);

  try {
    await factory.callStatic.deployTournament(
      tournamentId,
      teamIdsArray,
      season,
      { gasLimit: 12_000_000 }
    );
    console.log("✅ callStatic says it would succeed!");
  } catch (e: any) {
    console.error("❌ Revert reason:", e.reason || e.message);
  }

  const tx = await factory.connect(signer).deployTournament(
    tournamentId,
    teamIdsArray,
    season,
    { gasLimit: 10_000_000 }
  );
  const receipt = await tx.wait();
  console.log("  ✅ deployTournament tx:", receipt.transactionHash);

  const tournamentMarketAddress = await factory.tournamentMarkets(tournamentId);
  console.log("  ↳ TournamentMarket @", tournamentMarketAddress);

  const envPath   = path.resolve(__dirname, "../.env");
  let   envRaw    = fs.readFileSync(envPath, "utf8");
  const key       = `TOURNAMENT_MARKET_ADDRESS_${tournamentId}`;
  const regex     = new RegExp(`^${key}=.*`, "m");
  const line      = `${key}=${tournamentMarketAddress}`;
  envRaw = regex.test(envRaw)
    ? envRaw.replace(regex, line)
    : envRaw + "\n" + line;
  fs.writeFileSync(envPath, envRaw, "utf8");
  console.log(`  → Wrote ${key} to .env`);

  console.log("  ⏳ Waiting for RoundConsumer.RawRoundReady…");
  const roundConsumer = await ethers.getContractAt("RoundConsumer", roundConsumerAddress, signer);
  await new Promise<void>(resolve => {
    roundConsumer.once(
      roundConsumer.filters.RawRoundReady(tournamentId),
      (id) => {
        console.log("  ✅ RawRoundReady for tournament", id.toString());
        resolve();
      }
    );
  });

  console.log("🎉 All done.  Keeper will now enqueue fixtures.");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Script failed:", err);
    process.exit(1);
  });
