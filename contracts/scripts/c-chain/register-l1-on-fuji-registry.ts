import { ethers } from "hardhat";
import dotenv from "dotenv";
import bs58 from "bs58";
dotenv.config();
 
async function main() {
  const [signer] = await ethers.getSigners();
 
  const fujiRegistryAddress = process.env.C_CHAIN_TELEPORTER_REGISTRY_ADDRESS!;
  const l1RegistryAddress = process.env.L1_TELEPORTER_REGISTRY_ADDRESS!;
  const l1BlockchainIDStr = process.env.L1_BLOCKCHAIN_ID!;
 
  console.log("Signer address:", await signer.getAddress());
  
  // Create contract ABI
  const abi = [
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "blockchainID",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "registryAddress",
          "type": "address"
        }
      ],
      "name": "registerBlockchainID",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];
 
  // Create contract instance
  const registry = new ethers.Contract(fujiRegistryAddress, abi, signer);
 
  // Decode base58 BlockchainID
  const decoded = bs58.decode(l1BlockchainIDStr);
  const blockchainIDBytes = decoded.slice(decoded.length - 32);
  const blockchainIDHex = ethers.hexlify(blockchainIDBytes);
 
  console.log("Parameters:");
  console.log("- BlockchainID:", blockchainIDHex);
  console.log("- L1 Registry:", l1RegistryAddress);
 
  // Create the encoded function data
  const iface = new ethers.Interface(abi);
  const encodedData = iface.encodeFunctionData("registerBlockchainID", [
    blockchainIDHex,
    l1RegistryAddress
  ]);
 
  console.log("\nEncoded transaction data:", encodedData);
 
  try {
    // Send transaction using raw transaction data
    const tx = await signer.sendTransaction({
      to: fujiRegistryAddress,
      data: encodedData,
      gasLimit: 500000
    });
 
    console.log("\n📝 Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("\nTransaction receipt:");
    if (receipt) {
      console.log("- Status:", receipt.status === 1 ? "Success" : "Failed");
      console.log("- Gas used:", receipt.gasUsed.toString());
      console.log("- Block number:", receipt.blockNumber);
    } else {
      console.log("- Receipt is null");
    }
 
  } catch (error: any) {
    console.error("\nTransaction failed:");
    console.error("- Error message:", error.message);
    
    if (error.transaction) {
      console.error("\nTransaction details:");
      console.error("- To:", error.transaction.to);
      console.error("- From:", error.transaction.from);
      console.error("- Data:", error.transaction.data);
    }
    
    if (error.receipt) {
      console.error("\nTransaction receipt:");
      console.error("- Status:", error.receipt.status);
      console.error("- Gas used:", error.receipt.gasUsed.toString());
    }
    
    throw error;
  }
}
 
main().catch((err) => {
  console.error("\n❌ Script failed:", err);
  process.exit(1);
});
 
 