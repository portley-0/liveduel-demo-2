# Contracts Module

## 📜 Overview

The **Contracts Module** provides the core smart contracts for the decentralized prediction market. It includes:

- **MarketFactory**: Manages the deployment and resolution of **PredictionMarket** contracts.
- **PredictionMarket**: Represents an individual market for a match, handling bets and payouts.
- **LiquidityPool**: Manages staking and liquidity used for market making and rewards.
- **DuelToken**: The ecosystem token used for staking and rewards.
- **MockUSDC**: A mock stablecoin used for testing.
- **ResultsConsumer**: Uses **Chainlink Functions** to fetch match results.
- **Gnosis Contracts**: Adapted from Gnosis Conditional Tokens and Market Makers for Solidity 0.8.20.

Gnosis source repositories (Solidity 0.5.1):

- **[Conditional Tokens](https://github.com/gnosis/conditional-tokens-contracts)** – Framework for creating conditional token markets.
- **[Market Makers](https://github.com/gnosis/conditional-tokens-market-makers)** – Provides market makers built with Gnosis CTF, including **LMSRMarketMaker**, used in this project.

## 🛠 Dependencies

This module relies on:

- **Gnosis Conditional Tokens Framework** (Adapted to Solidity 0.8.20)
- **Chainlink Functions & Automation**
- **OpenZeppelin Contracts** (Ownable, ERC20, ERC1155Holder)
- **Hardhat** (Testing & Deployment)

## 📂 Directory Structure

```
├── contracts
│   ├── gnosis/
│   │   ├── ConditionalTokens.sol
│   │   ├── ConstructedCloneFactory.sol
│   │   ├── CTHelpers.sol
│   │   ├── Fixed192x64Math.sol
│   │   ├── LMSRMarketMaker.sol
│   │   ├── LMSRMarketMakerFactory.sol
│   │   ├── MarketMaker.sol
│   │   ├── Whitelist.sol
│   ├── interfaces/
│   │   ├── ILiquidityPool.sol
│   │   ├── IResultsConsumer.sol
│   ├── MarketFactory.sol
│   ├── PredictionMarket.sol
│   ├── LiquidityPool.sol
│   ├── DuelToken.sol
│   ├── MockUSDC.sol
│   ├── ResultsConsumer.sol
├── scripts
│   ├── DeployGnosisCTF.ts
│   ├── DeployPredictionSystem.ts
│   ├── DeployResultsConsumer.ts
│   ├── TestChainlinkRequest.ts
├── tests
│   ├── sanitycheck.test.ts
│   ├── staking.test.ts
│   ├── factory.test.ts
│   ├── trading.test.ts
│   ├── resolution.test.ts
│   ├── redemption.test.ts
├── .env
├── .env-enc
├── API-request.js
├── hardhat.config.ts
├── package.json
├── README.md
├── tsconfig.json
```

## 🚀 Setup & Deployment

### 1️⃣ Install Dependencies

```bash
pnpm install
```

### 2️⃣ Compile Contracts

```bash
npx hardhat compile
npx hardhat typechain
```

### 3️⃣ Set Up Environment Variables

Before deploying the contracts, the **.env-enc** file must be set using the following commands:

```bash
npx @chainlink/env-enc set-pw  # Set a password for encryption
npx @chainlink/env-enc set     # Encrypt and store environment variables
```

Required environment variables:

- **API\_KEY** (API-Football API key)
- **PRIVATE\_KEY** (Testnet Avax Wallet)
- **AVALANCHE\_FUJI\_RPC\_URL** (https://api.avax-test.network/ext/bc/C/rpc)
- **GITHUB\_API\_TOKEN** (Must be generated with read and write Gists permission)
- **FUJI\_SNOWTRACE\_API\_KEY** (Can be left blank)

### 4️⃣ Deploy Contracts

> Note: Chainlink SubscriptionID must be provided to DeployResultsConsumer.ts

```bash
pnpm run deploy:gnosis
pnpm run deploy:resultsconsumer
pnpm run deploy:system
```

### 4️⃣ Run Tests

> Note: factory.test.ts requires setting specific variables. See test file.

```bash
pnpm run test:chainlink
pnpm run test:sanity
pnpm run test:staking
pnpm run test:factory
pnpm run test:trading
pnpm run test:resolution
pnpm run test:redemption
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

