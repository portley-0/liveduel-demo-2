# Subgraph Module - LiveDuel Demo 2

## 📜 Overview
The **Subgraph Module** indexes key events from the **LiveDuel PredictionMarket** contract, enabling efficient data retrieval for the frontend and backend.

This subgraph is deployed on **The Graph's Hosted Service**.

## 🛠 Dependencies
- **The Graph Protocol** – Used for indexing and querying contract events.
- **Graph CLI** – For building and deploying the subgraph.
- **Solidity Contracts** – LiveDuel smart contracts on Avalanche Fuji.

## 📂 Directory Structure
```
├── subgraph
│   ├── schema.graphql     # GraphQL schema defining entities
│   ├── subgraph.yaml      # Subgraph manifest configuration
│   ├── src/
│   │   ├── PredictionMarket.ts   # Handles PredictionMarket events
│   ├── generated/
│   ├── package.json       # Dependencies and scripts
│   ├── tsconfig.json      # TypeScript configuration
```

## 🔑 Indexed Events
The subgraph tracks the following **PredictionMarket** contract events:
- `SharesPurchased(buyer, outcome, shares, actualCost)`
- `SharesSold(seller, outcome, shares, actualGain)`
- `OddsUpdated(matchId, home, draw, away)`

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
