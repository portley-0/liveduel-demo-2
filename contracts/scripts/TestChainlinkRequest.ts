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

  const matchId = 1300251;
  console.log(`Requesting match result for matchId: ${matchId}`);

  // Request match result
  const tx = await resultsConsumer.requestMatchResult(matchId);
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
  const pollingInterval = 5000; // 5 seconds
  const startTime = Date.now();

  const fetchEvents = async (filter: any, fromBlock: number, toBlock: number) => {
    const events: Event[] = [];
    const chunkSize = 1000;

    for (let i = 0; i <= Math.floor((toBlock - fromBlock) / chunkSize); i++) {
      const chunkFromBlock = fromBlock + i * chunkSize;
      const chunkToBlock = Math.min(chunkFromBlock + chunkSize - 1, toBlock);

      const chunkEvents = await resultsConsumer.queryFilter(filter, chunkFromBlock, chunkToBlock);
      events.push(...chunkEvents);
    }

    return events;
  };

  const initialBlock = await ethers.provider.getBlockNumber();
  const startBlock = Math.max(initialBlock - 2048, 0);

  while (Date.now() - startTime < maxWaitTime) {
    const latestBlock = await ethers.provider.getBlockNumber();

    const resultReceivedEvents = await fetchEvents(
      resultsConsumer.filters.ResultReceived(),
      startBlock,
      latestBlock
    );

    for (const event of resultReceivedEvents) {
      if (event.args?.matchId.toString() === matchId.toString()) {
        console.log("ResultReceived event detected for desired matchId:");
        console.log(`  Match ID: ${event.args?.matchId}`);
        console.log(`  Result (from event): ${event.args?.result}`);

        const isResolved = await resultsConsumer.matchResolved(matchId);
        if (isResolved) {
          console.log(`Match ID ${matchId} is resolved. Fetching result...`);

          try {
            const result = await resultsConsumer.returnResult(matchId);
            console.log(`Result for Match ID ${matchId}: ${result}`);
          } catch (error) {
            if (error instanceof Error) {
              console.error("Error fetching result:", error.message);
            } else {
              console.error("Unexpected error:", error);
            }
          }
        } else {
          console.log(`Match ID ${matchId} is not yet resolved in the mapping.`);
        }

        return;
      }
    }

    const requestFailedEvents = await fetchEvents(
      resultsConsumer.filters.RequestFailed(),
      startBlock,
      latestBlock
    );

    if (requestFailedEvents.length > 0) {
      requestFailedEvents.forEach((event) => {
        if (event.args?.matchId.toString() === matchId.toString()) {
          console.log("RequestFailed event detected for desired matchId:");
          console.log(`  Match ID: ${event.args?.matchId}`);
          console.log(`  Request ID: ${event.args?.requestId}`);
          console.log(`  Error Message: ${event.args?.errorMessage}`);
        }
      });
      console.error("Request for the match result failed. Exiting...");
      return;
    }

    console.log(`No result yet for Match ID ${matchId}, retrying after ${pollingInterval / 1000} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, pollingInterval));
  }

  console.error("Timeout: Result not available within the maximum wait time.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });
