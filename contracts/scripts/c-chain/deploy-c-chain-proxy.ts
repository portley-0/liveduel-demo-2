
require("@nomiclabs/hardhat-ethers");
const { ethers, network } = require("hardhat");
const { SecretsManager, createGist } = require("@chainlink/functions-toolkit");
require("@chainlink/env-enc").config();
const fs = require("fs");
const path = require("path");

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl     = process.env.CCHAIN_RPC_URL;
  const router     = process.env.FUNCTIONS_ROUTER_ADDRESS;
  let   donId      = process.env.DON_ID;
  const subId      = Number(process.env.FUNCTIONS_SUBSCRIPTION_ID);
  const l1Factory  = process.env.MARKET_FACTORY_ON_L1;

  if (!privateKey || !rpcUrl || !router || !donId || !subId || !l1Factory) {
    throw new Error("Missing one of PRIVATE_KEY, CCHAIN_RPC_URL, FUNCTIONS_ROUTER_ADDRESS, DON_ID, FUNCTIONS_SUBSCRIPTION_ID, MARKET_FACTORY_ON_L1 in .env");
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(privateKey, provider);
  console.log("Deploying with", await signer.getAddress(), "on network", network.name);

  // Prepare encrypted secrets
  const sourcePath = path.resolve(__dirname, "../result-request.js");
  const roundPath  = path.resolve(__dirname, "../round-request.js");
  const resultSrc  = fs.readFileSync(sourcePath, "utf8");
  const roundSrc   = fs.readFileSync(roundPath, "utf8");

  const secretsManager = new SecretsManager({ signer, functionsRouterAddress: router, donId });
  await secretsManager.initialize();
  const encrypted = await secretsManager.encryptSecrets({ apiKey: process.env.API_KEY });
  const gistUrl   = await createGist(process.env.GITHUB_API_TOKEN, JSON.stringify(encrypted));
  const secrets   = await secretsManager.encryptSecretsUrls([gistUrl]);

  // Deploy ResultsConsumer
  donId = ethers.utils.formatBytes32String(donId);
  const RCFactory = await ethers.getContractFactory("ResultsConsumer", signer);
  const resultsConsumer = await RCFactory.deploy(
    router,
    donId,
    resultSrc,
    secrets,
    subId
  );
  await resultsConsumer.deployed();
  console.log("ResultsConsumer deployed to", resultsConsumer.address);
  updateEnv("RESULTS_CONSUMER_ADDRESS", resultsConsumer.address);

  // Deploy RoundConsumer
  const RDCFactory = await ethers.getContractFactory("RoundConsumer", signer);
  const roundConsumer = await RDCFactory.deploy(
    router,
    donId,
    roundSrc,
    secrets,
    subId,
    { gasLimit: 8_000_000 }
  );
  await roundConsumer.deployed();
  console.log("RoundConsumer deployed to", roundConsumer.address);
  updateEnv("ROUND_CONSUMER_ADDRESS", roundConsumer.address);

  // Deploy ChainlinkProxy
  const ProxyFactory = await ethers.getContractFactory("ChainlinkProxy", signer);
  const proxy = await ProxyFactory.deploy(
    /* teleporter */ process.env.TELEPORTER_ADDRESS,
    /* l1BlockchainID */ process.env.L1_BLOCKCHAIN_ID,
    resultsConsumer.address,
    roundConsumer.address
  );
  await proxy.deployed();
  console.log("ChainlinkProxy deployed to", proxy.address);
  updateEnv("CHAINLINK_PROXY_ADDRESS", proxy.address);

  // Set L1 MarketFactory address in proxy
  const tx = await proxy.connect(signer).setMarketFactoryAddress(l1Factory);
  await tx.wait();
  console.log("MarketFactoryOnL1 set to", l1Factory);

  // Transfer ownership of consumers to proxy (two-step)
  console.log("Transferring ResultsConsumer ownership to proxy...");
  await resultsConsumer.connect(signer).transferOwnership(proxy.address);
  console.log("Transferring RoundConsumer ownership to proxy...");
  await roundConsumer.connect(signer).transferOwnership(proxy.address);

  // Accept ownership in proxy
  console.log("Accepting pending ownerships in proxy...");
  const acceptTx = await proxy.connect(signer).acceptConsumerOwnerships();
  await acceptTx.wait();

  console.log("✅ Deployment complete.");
}


function updateEnv(key: string, value: string): void {
    const envPath: string = path.resolve(__dirname, "../.env");
    let content: string   = fs.readFileSync(envPath, "utf8");
    const re: RegExp      = new RegExp(`^${key}=.*`, "m");
    if (re.test(content)) {
        content = content.replace(re, `${key}=${value}`);
    } else {
        content += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, content, "utf8");
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
