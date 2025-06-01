import '@nomiclabs/hardhat-ethers';
import { ethers } from "hardhat";
import { ContractReceipt, Event } from "ethers";
import dotenv from "dotenv";
import { ResultsConsumer } from "../typechain-types";
dotenv.config();

async function main() {
  const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS || "";

  const ResultsConsumer = await ethers.getContractFactory("ResultsConsumer");
  const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress) as ResultsConsumer;

  const matchId = 1374812;
  console.log(`Requesting match result for matchId: ${matchId}`);

  // Request match result
  const tx = await resultsConsumer.requestMatchResult(matchId, { gasLimit: 1_000_000 });
  const receipt: ContractReceipt = await tx.wait();

  console.log("Transaction successful with hash:", receipt.transactionHash);

  // Check for the RequestedResult event
  const requestedResultEvent = receipt.events?.filter((x: Event) => x.event === "RequestedResult");
  if (requestedResultEvent && requestedResultEvent.length > 0) {
    console.log(`RequestedResult event detected: Match ID: ${requestedResultEvent[0].args?.matchId}, Request ID: ${requestedResultEvent[0].args?.requestId}`);
  } else {
    console.log("No RequestedResult event detected.");
  }

  console.log("\nWaiting for the result...\n");

  const maxWaitTime = 10 * 60 * 1000; // 10 minutes
  const pollingInterval = 5000;       // 5 seconds
  const startTime = Date.now();
  const startBlock = await ethers.provider.getBlockNumber();

  let rawResponseHex = "";
  let resultReceived = false;

  while (Date.now() - startTime < maxWaitTime) {
    const latestBlock = await ethers.provider.getBlockNumber();
    const resultReceivedEvents = await resultsConsumer.queryFilter(
      resultsConsumer.filters.ResultReceived(matchId), // Filter for the specific matchId
      startBlock,
      latestBlock
    );

    if (resultReceivedEvents.length > 0) {
      resultReceived = true;
      const event = resultReceivedEvents[0];
      const outcome = event.args.outcome.toString();
      const homeId = event.args.homeId.toString();
      const awayId = event.args.awayId.toString();

      console.log("✅ ResultReceived event detected:");
      console.log(`  Match ID:         ${event.args.matchId.toString()}`);
      console.log(`  Outcome:          ${outcome} (0=home,1=draw,2=away)`);
      console.log(`  Home Team ID:     ${homeId}`);
      console.log(`  Away Team ID:     ${awayId}`);
      break;
    }

    const rawResponseEvents = await resultsConsumer.queryFilter(
      resultsConsumer.filters.RawResponseBytes(), // Ensure exact casing
      startBlock,
      latestBlock
    );

    for (const event of rawResponseEvents) {
      if (event.transactionHash === receipt.transactionHash) {
        rawResponseHex = event.args.rawResponse;
        console.log("✅ RawResponseBytes event detected:", rawResponseHex);
        break;
      }
    }

    const requestFailedEvents = await resultsConsumer.queryFilter(
      resultsConsumer.filters.RequestFailed(matchId), // Filter for the specific matchId
      startBlock,
      latestBlock
    );

    if (requestFailedEvents.length > 0) {
      console.error("🛑 RequestFailed event detected:");
      console.error(`  Match ID:         ${requestFailedEvents[0].args?.matchId.toString()}`);
      console.error(`  Request ID:       ${requestFailedEvents[0].args?.requestId}`);
      console.error(`  Error Msg:        ${requestFailedEvents[0].args?.errorMessage}`);
      return;
    }

    console.log(`No ResultReceived yet for Match ID ${matchId}, retrying in ${pollingInterval / 1000}s…`);
    await new Promise((r) => setTimeout(r, pollingInterval));
  }

  if (!resultReceived) {
    console.error("⏰ Timeout: Result not available within the maximum wait time.");
    return;
  }

  // --- Pull and Decode the raw blob from the RawResponseBytes event ---
  console.log("\nPulling and decoding raw response from RawResponseBytes event…\n");
  const rawBytes = ethers.utils.arrayify(rawResponseHex);

  const words: number[] = [];
  for (let i = 32; i < rawBytes.length; i += 4) { // Skip the first 32 bytes (length prefix)
    const v =
      (rawBytes[i] << 24) |
      (rawBytes[i + 1] << 16) |
      (rawBytes[i + 2] << 8) |
      (rawBytes[i + 3]);
    words.push(v >>> 0);
  }

  if (words.length === 3) {
    const decodedOutcome = words[0];
    const decodedHomeId = words[1];
    const decodedAwayId = words[2];

    console.log("\nDecoded Raw Response (uint32):");
    console.log(`  Outcome:         ${decodedOutcome} (0=home,1=draw,2=away)`);
    console.log(`  Home Team ID:    ${decodedHomeId}`);
    console.log(`  Away Team ID:    ${decodedAwayId}`);
  } else {
    console.warn("⚠️ Unexpected number of words in raw response:", words.length);
    console.log("Raw Bytes:", rawResponseHex);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });