# Subgraph Module

## 📜 Overview
The **Subgraph Module** indexes key events from the **PredictionMarket** and **MarketFactory** contracts, enabling efficient data retrieval for the frontend and backend.

This subgraph is deployed on **The Graph's Hosted Service**.

## 🛠 Dependencies
- **The Graph Protocol** – Used for indexing and querying contract events.
- **Graph CLI** – For building and deploying the subgraph.
- **Solidity Contracts** – Prediction System contracts on Avalanche Fuji.

## 📂 Directory Structure
```
├── subgraph
│   ├──abis/
│   ├── build/
│   ├── generated/
│   ├── src/
│   │   ├── prediction-market.ts   # Handles PredictionMarket events
│   │   ├── market-factory.ts     # Handles MarketFactory events
│   ├── package.json       # Dependencies and scripts
│   ├── schema.graphql     # GraphQL schema defining entities
│   ├── subgraph.yaml      # Subgraph manifest configuration
│   ├── tsconfig.json      # TypeScript configuration
```

## 🔑 Indexed Events
The subgraph tracks the following **PredictionMarket** contract events:
- `SharesPurchased(buyer, outcome, shares, actualCost)`
- `SharesSold(seller, outcome, shares, actualGain)`
- `OddsUpdated(matchId, home, draw, away)`
- `PayoutRedeemed(address indexed redeemer, uint8 indexed outcome, uint256 amount)`
- `MarketResolved(uint256 indexed matchId, uint8 indexed outcome)`

It tracks the following **MarketFactory** contract events: 
- `PredictionMarketResolved(uint256 matchId, uint8 outcome)`
- `PredictionMarketDeployed(uint256 matchId, address marketAddress, uint256 matchTimestamp)`

## 🚀 Setup & Deployment

### 1️⃣ Install Dependencies
```bash
yarn install
```

### 2️⃣ Generate & Build the Subgraph
```bash
yarn codegen
yarn build
```

### 3️⃣ Deploy to The Graph's Hosted Service
```bash
yarn deploy
```

## 📄 License
This project is licensed under the [MIT License](LICENSE).
