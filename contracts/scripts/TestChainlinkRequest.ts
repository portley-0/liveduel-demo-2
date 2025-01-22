import '@nomiclabs/hardhat-ethers';
import { ethers } from "hardhat";
import { ContractReceipt, Event } from "ethers";

async function main() {
  const resultsConsumerAddress = "0x798DB79459CD33fF7B09a8e7D0B5EA85b89bEdD1";
  const ResultsConsumer = await ethers.getContractFactory("ResultsConsumer");
  const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress);

  const matchId = 1337216;
  console.log(`Requesting match result for matchId: ${matchId}`);

  const tx = await resultsConsumer.requestMatchResult(matchId);
  const receipt: ContractReceipt = await tx.wait();
  console.log("Transaction successful with hash:", receipt.transactionHash);

  const requestedResultEvent = receipt.events?.filter((x: Event) => x.event === "RequestedResult");
  if (requestedResultEvent && requestedResultEvent.length > 0) {
    console.log(`RequestedResult event detected: Match ID: ${requestedResultEvent[0].args?.matchId}, Request ID: ${requestedResultEvent[0].args?.requestId}`);
  } else {
    console.log("No RequestedResult event detected.");
  }

  console.log("\nWaiting for the result...\n");

  const maxWaitTime = 10 * 60 * 1000; // 10 minutes
  const pollingInterval = 5000; // 5 seconds
  const maxBlockRange = 2048; // Maximum blocks per query
  const startTime = Date.now();

  const provider = ethers.getDefaultProvider();
  const latestBlock = await provider.getBlockNumber();
  const startBlock = Math.max(latestBlock - 2048, 0); // Adjust this if needed

  let resultDetected = false;
  while (Date.now() - startTime < maxWaitTime) {
    for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += maxBlockRange) {
      const toBlock = Math.min(fromBlock + maxBlockRange - 1, latestBlock);

      const resultReceivedEvents = await resultsConsumer.queryFilter(resultsConsumer.filters.ResultReceived(), fromBlock, toBlock);
      if (resultReceivedEvents.length > 0) {
        resultDetected = true;
        resultReceivedEvents.forEach((event) => {
          console.log("ResultReceived event detected:");
          console.log(`  Match ID: ${event.args?.matchId}`);
          console.log(`  Result: ${event.args?.result}`);
        });
        break;
      }

      const requestFailedEvents = await resultsConsumer.queryFilter(resultsConsumer.filters.RequestFailed(), fromBlock, toBlock);
      if (requestFailedEvents.length > 0) {
        resultDetected = true;
        requestFailedEvents.forEach((event) => {
          console.log("RequestFailed event detected:");
          console.log(`  Match ID: ${event.args?.matchId}`);
          console.log(`  Request ID: ${event.args?.requestId}`);
          console.log(`  Error Message: ${event.args?.errorMessage}`);
        });
        break;
      }
    }

    if (resultDetected) break;

    console.log(`No result yet, retrying after ${pollingInterval / 1000} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, pollingInterval));
  }

  if (!resultDetected) {
    console.error("Timeout: Result not available within the maximum wait time.");
  } else {
    try {
      const result = await resultsConsumer.returnResult(matchId);
      console.log(`\nResult: ${result}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error fetching result:", error.message);
      } else {
        console.error("Unexpected error:", error);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    if (error instanceof Error) {
      console.error("Script error:", error.message);
    } else {
      console.error("Unexpected script error:", error);
    }
    process.exit(1);
  });
