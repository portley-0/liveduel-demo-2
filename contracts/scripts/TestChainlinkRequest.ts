import '@nomiclabs/hardhat-ethers';
import { ethers } from "hardhat";
import { ContractReceipt, Event } from "ethers";

async function main() {
 
  const resultsConsumerAddress = "0x7006287ed8E35818f122232EF40017D3f78c9199";

  const ResultsConsumer = await ethers.getContractFactory("ResultsConsumer");
  const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress);

  const matchId = 1208844;
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

  await new Promise((resolve) => setTimeout(resolve, 30000)); 

  const provider = ethers.getDefaultProvider(); 
  const latestBlock = await provider.getBlockNumber();
  const startBlock = Math.max(latestBlock - 2048, 0);

  const fetchEvents = async (filter: any) => {
    const events: Event[] = [];
    const chunkSize = 1000; 

    for (let i = 0; i <= Math.floor((latestBlock - startBlock) / chunkSize); i++) {
      const fromBlock = startBlock + i * chunkSize;
      const toBlock = Math.min(fromBlock + chunkSize - 1, latestBlock);
      const chunkEvents = await resultsConsumer.queryFilter(filter, fromBlock, toBlock);
      events.push(...chunkEvents);
    }

    return events;
  };

  const resultReceivedEvents = await fetchEvents(resultsConsumer.filters.ResultReceived());
  if (resultReceivedEvents.length > 0) {
    resultReceivedEvents.forEach((event) => {
      const matchId = event.args?.matchId;
      const result = event.args?.result;
      
      console.log("ResultReceived event detected:");
      console.log(`  Match ID: ${matchId}`);
      console.log(`  Result: ${result}`);
    });
  } else {
    console.log("No ResultReceived event detected.");
  }

  console.log("\n"); 

  const requestFailedEvents = await fetchEvents(resultsConsumer.filters.RequestFailed());
  if (requestFailedEvents.length > 0) {
    requestFailedEvents.forEach((event) => {
      const matchId = event.args?.matchId;
      const requestId = event.args?.requestId;
      const errorMessage = event.args?.errorMessage;
      
      console.log("RequestFailed event detected:");
      console.log(`  Match ID: ${matchId}`);
      console.log(`  Request ID: ${requestId}`);
      console.log(`  Error Message: ${errorMessage}`);
    });
  } else {
    console.log("No RequestFailed event detected.");
  }

  const result = await resultsConsumer.returnResult(matchId);
  console.log(` \n Result: ${result}` );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
