import '@nomiclabs/hardhat-ethers';
import { ethers } from "hardhat";
import { ContractReceipt } from "ethers";
import dotenv from "dotenv";
import { RoundConsumer, MarketFactory } from "../typechain-types";
dotenv.config();

async function main() {
  const roundConsumerAddress = process.env.ROUND_CONSUMER_ADDRESS!;
  const marketFactoryAddress = process.env.MARKET_FACTORY_ADDRESS!;

  const RoundConsumerFactory = await ethers.getContractFactory("RoundConsumer");
  const roundConsumer = RoundConsumerFactory
    .attach(roundConsumerAddress) as RoundConsumer;

  const MarketFactoryFactory = await ethers.getContractFactory("MarketFactory");
  const marketFactory = MarketFactoryFactory
    .attach(marketFactoryAddress) as MarketFactory;

  const tournamentId = 2;
  const season       = 2024;

  console.log(`Requesting next round for Tournament ${tournamentId}, Season ${season}`);
  const tx = await roundConsumer.requestNextRound(tournamentId, season, { gasLimit: 1_000_000 });
  const receipt: ContractReceipt = await tx.wait();
  console.log("→ on-chain tx:", receipt.transactionHash);

  // Log RequestedRound
  const reqEvt = receipt.events?.find(e => e.event === "RequestedRound");
  if (reqEvt) {
    console.log(
      `RequestedRound: tournament=${reqEvt.args!.tournamentId}, requestId=${reqEvt.args!.requestId}`
    );
  } else {
    console.warn("❌ No RequestedRound event");
  }

  console.log("\nWaiting for RawRoundReady event…\n");
  const startBlock = (await ethers.provider.getBlockNumber()) - 1;
  const maxWait    = 10 * 60 * 1000; // 10 min
  const pollInterval = 5_000;       // 5s
  const t0 = Date.now();

  while (Date.now() - t0 < maxWait) {
    const latestBlock = await ethers.provider.getBlockNumber();
    const rawEvents = await roundConsumer.queryFilter(
      roundConsumer.filters.RawRoundReady(tournamentId),
      startBlock,
      latestBlock
    );
    if (rawEvents.length > 0) {
      console.log("✅ RawRoundReady detected!");
      break;
    }
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, pollInterval));
  }

  // Check pendingRounds queue
  try {
    const first = await marketFactory.pendingRounds(0);
    console.log("pendingRounds[0] on-chain:", first.toString());
  } catch {
    console.log("pendingRounds is empty");
  }

  // Simulate checkUpkeep & performUpkeep
  {
    const [needsUpkeep, performData] = await marketFactory.callStatic.checkUpkeep("0x");
    console.log(`\ncheckUpkeep → needsUpkeep=${needsUpkeep}, performData=${performData}`);
    if (needsUpkeep) {
      await marketFactory.callStatic.performUpkeep(performData);
      console.log("✅ performUpkeep simulation succeeded");
    } else {
      console.log("❌ checkUpkeep returned false — keeper will not run");
    }
  }

  // Pull & decode the raw blob
  const rawHex   = await roundConsumer.rawRoundData(tournamentId);
  const rawBytes = ethers.utils.arrayify(rawHex);

  const words: number[] = [];
  for (let i = 0; i < rawBytes.length; i += 4) {
    const v =
      (rawBytes[i]   << 24) |
      (rawBytes[i+1] << 16) |
      (rawBytes[i+2] <<  8) |
      (rawBytes[i+3]);
    words.push(v >>> 0);
  }

  // words = [ isTourEnd, lastIdx, ...ids, ...timestamps ]
  const isTourEnd  = words[0] === 1;
  const lastIdx    = words[1];

  // number of fixtures = (totalWords - 2) / 2
  const totalWords = words.length;
  const N = (totalWords - 2) / 2;

  const fixtureIds        = words.slice(2, 2 + N);
  const fixtureTimestamps = words.slice(2 + N, 2 + 2 * N);

  console.log("\nDecoded Results:");
  console.log(`• Tournament End?           ${isTourEnd}`);
  console.log(`• This Round's final-index: ${lastIdx}`);
  console.log(`• Fixture IDs:             [ ${fixtureIds.join(", ")} ]`);
  console.log(`• Kickoff timestamps:       [ ${fixtureTimestamps.join(", ")} ]`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
