import { ethers } from 'hardhat';
import dotenv from 'dotenv';
dotenv.config();

const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS;

async function main() {
  if (!MARKET_FACTORY_ADDRESS) {
    throw new Error('Missing required environment variable: MARKET_FACTORY_ADDRESS');
  }

  const newBotAddress = '0xFE8Fe150A6F4903B0E8F0C5294bF34fEedAD3024'
  if (!newBotAddress || !ethers.utils.isAddress(newBotAddress)) {
    throw new Error('Invalid or missing bot address. Please provide a valid Ethereum address as a command-line argument.');
  }

  console.log('--- Hardhat: MarketFactory Bot Setter ---');
  console.log(`Target MarketFactory: ${MARKET_FACTORY_ADDRESS}`);
  console.log(`New Designated Bot Address: ${newBotAddress}\n`);

  const [ownerSigner] = await ethers.getSigners();
  console.log(`Using owner account (from hardhat.config.ts): ${ownerSigner.address}\n`);

  const marketFactoryContract = await ethers.getContractAt(
    'MarketFactory', 
    MARKET_FACTORY_ADDRESS,
    ownerSigner
  );

  const currentBotAddress = await marketFactoryContract.botAddress();
  console.log(`Current designated bot address on contract: ${currentBotAddress}`);

  if (currentBotAddress.toLowerCase() === newBotAddress.toLowerCase()) {
    console.log('\nNew address is the same as the current address. No action needed.');
    console.log('✅ Script finished.');
    return;
  }

  console.log(`\nSubmitting transaction to set bot address...`);
  const tx = await marketFactoryContract.setBotAddress(newBotAddress);

  console.log(`Transaction sent! Hash: ${tx.hash}`);
  console.log('Waiting for transaction to be confirmed...');
  
  const receipt = await tx.wait();
  
  if (receipt.status !== 1) {
    console.error('Transaction failed! Please check the transaction on a block explorer.');
    throw new Error('Transaction execution failed');
  }

  console.log(`Transaction confirmed in block: ${receipt.blockNumber}\n`);

  const updatedBotAddress = await marketFactoryContract.botAddress();
  console.log(`✅ Successfully updated bot address on contract to: ${updatedBotAddress}`);
}

main().catch((error) => {
  console.error('\n❌ An error occurred:');
  console.error(error);
  process.exit(1);
});