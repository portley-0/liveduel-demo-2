import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {

    const [deployer] = await ethers.getSigners();
    console.log("Deploying ConditionalTokensApprovalAdapter with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());
  
    const AdapterFactory = await ethers.getContractFactory("ConditionalTokensApprovalAdapter");
    
    const adapter = await AdapterFactory.deploy();
    await adapter.deployed();
  
    console.log("ConditionalTokensApprovalAdapter deployed to:", adapter.address);

    const envPath = path.resolve(__dirname, "../.env");
    let envContent = fs.readFileSync(envPath, "utf8");
    
    function setEnvVar(key: string, value: string) {
        const regex = new RegExp(`^${key}=.*`, "m");
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    }
    
    setEnvVar("ADAPTER_ADDRESS", adapter.address);

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("\nAdapter addresse added to .env!");

  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  