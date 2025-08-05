import { ethers } from "ethers";
 
const ICM_DEMO_ABI = [
    "function sendMessage(string memory message, address destinationAddress, uint32 destinationBlockchainID) external",
    "function lastReceivedMessage() external view returns (string memory)",
];
 
async function testICMDemo() {
    // Source chain (your L1) provider and contract
    const sourceProvider = new ethers.JsonRpcProvider("https://rpc-liveduel.cogitus.io/jqrUCybt4XforDsXXhOV/ext/bc/2MWwV2p26iaMu6GxJf2sCfwEVQCTSYA2rBBhAFGzHVdsxgVhxD/rpc");
    // Fuji (C-Chain) provider and contract
    const fujiProvider = new ethers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");
    
    const privateKey = "73bdb48500f1b2e45a407cdff563d8f59df7ce31fc84415f38d79888b5671a63";
    const sourceSigner = new ethers.Wallet(privateKey, sourceProvider);
    const fujiSigner = new ethers.Wallet(privateKey, fujiProvider);
 
    // Contract instances for both chains
    const sourceContract = new ethers.Contract(
        "0x3c98B8b5b992A5a6504240cA27bcC65AF5D07fE6", // Your source chain contract
        ICM_DEMO_ABI,
        sourceSigner
    );
 
    const fujiContract = new ethers.Contract(
        "0x972378a46a75a82abddf6b4849afb9b937e2cb3a", // Your Fuji contract
        ICM_DEMO_ABI,
        fujiSigner
    );
 
    try {
        // Send message from source chain
        const tx = await sourceContract.sendMessage(
            "Hello ICM!",
            "0x972378a46a75a82abddf6b4849afb9b937e2cb3a",
            43113
        );
        
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("Transaction confirmed!");
 
        // Read message from both chains
        const sourceMessage = await sourceContract.lastReceivedMessage();
        console.log("Source chain last message:", sourceMessage);
 
        const fujiMessage = await fujiContract.lastReceivedMessage();
        console.log("Fuji (destination) chain last message:", fujiMessage);
 
    } catch (error) {
        console.error("Error:", error);
    }
}
 
testICMDemo()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
 