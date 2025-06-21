
# Backend Module

## Overview

The **Backend Module** handles match data aggregation and caching, websocket communication, and API related interactions. It now includes a **Managed Market Maker** service to ensure competitive and liquid prediction markets.

Below is an overview of the key components:

---
## Key Features

### Core Files

* **`server.ts`** - Initializes the Express server and sets up API routes.
* **`socket.ts`** - Handles WebSocket connections for real-time updates.
* **`cache.ts`** - Manages match data caching, including storing, updating, and retrieving matches.

### Services

* **`polling-aggregator.ts`** - Periodically fetches football match data and prediction market information, updates the cache, and cleans up old data.
* **`football-service.ts`** - Interfaces with the football API to fetch match fixtures, tournament data, statistics, events, lineups, and standings.
* **`subgraph-service.ts`** - Fetches on-chain prediction market events using the deployed Graph Protocol subgraph.
* **`get-predictions.ts`** - Aggregates user prediction data from purchase and sales events.
* **`deploy-market.ts`** - Handles deploying new prediction markets on the blockchain.

### Managed Market Maker / Rebalancer Bot

This is a new service designed to manage the liquidity and pricing of all active prediction markets. It ensures that on-chain odds accurately reflect real-world betting markets, providing a superior user experience.

* **`rebalancer.ts`** - The main orchestrator service that runs a continuous loop to monitor and rebalance markets.
* **`onchain-reader.ts`** - A dedicated module for all read-only interactions with the smart contracts, fetching market state and odds.
* **`matchbook.api.ts`** - A client for the Matchbook API, responsible for fetching external market odds.
* **`id-mapper.ts`** - A crucial service that maps internal `api-football` match IDs to the corresponding `Matchbook` event IDs using fuzzy matching.
* **`fixed-192x64-math.ts`** - A critical library that precisely replicates the Solidity smart contract's fixed-point arithmetic using BigInt, ensuring the accuracy of the off-chain model.
* **`trade-calculator.ts`** - The "brain" of the operation. It uses an off-chain model of the LMSR to calculate the most efficient trade to align odds.
* **`trade-executor.ts`** - The "hands" of the operation. It safely submits the calculated trade transactions to the blockchain.
* **`portfolio-manager.ts`** - This module handles the bots outcome token inventory so that it can handle selling outcomes aswell as buying.

---
## Key Technologies & Strategies

The Rebalancer Bot leverages several advanced algorithms and strategies:

* **High-Precision Fixed-Point Math:** The core of the rebalancer's accuracy. A TypeScript library using BigInt that faithfully re-implements the Fixed192x64Math from the smart contracts. This avoids floating-point errors and ensures the off-chain calculations match the on-chain reality.

* **Direct Analytical Calculation**: The rebalancer avoids the complexities and potential pitfalls of iterative optimization. Instead of searching for a trade, it uses a direct analytical formula derived from the core mathematical properties of the Logarithmic Market Maker Scoring Rule (LMSR). The calculator determines the required change in the AMM's token inventory `(Δq)` by using a formula proportional to the logarithm of the ratio between the target and current probabilities `(Δq ∝ -b * log(p_target / p_current))`. The user's optimal trade is then calculated as the inverse of this change. This method is highly robust and computationally efficient, correctly handling market dynamics across all levels of liquidity.
* **Token Set Ratio (Fuzzy String Matching):** The specific algorithm from the `fuzzball` library used to reliably map team names between different API sources.
* **Off-Chain LMSR Simulation:** Replicating the on-chain `pow(2,x)`-based LMSR price formula in TypeScript to predict trade outcomes instantly.
* **Zero-Cost Rebalancing Strategy:** The overall financial goal of structuring trades to have a net cost of zero, using the proceeds from selling overpriced outcomes to fund the purchase of underpriced ones.
* **In-Memory Caching:** Using `Map` and `Set` objects to cache API results and mapping decisions, drastically reducing redundant network calls.
* **ethers.js:** The library used for all on-chain interactions, including reading market states and executing transactions.
* **Axios:** The library used to handle all HTTP requests to external APIs like Matchbook.

---
## Directory Structure
```
backend/
├── src/
│   ├── artifacts/
│   │   ├── MarketFactory.json
│   │   ├── ConditionalTokens.json
│   │   └── LMSRMarketMaker.json
│   ├── services/
│   │   ├── football-service.ts
│   │   ├── subgraph-service.ts
│   │   ├── polling-aggregator.ts
│   │   ├── get-predictions.ts
│   │   ├── deploy-market.ts
│   │   ├── portfolio-manager.ts
│   │   ├── rebalancer.ts
│   │   ├── rebalancer.config.ts
│   │   ├── onchain-reader.ts
│   │   ├── matchbook.api.ts
│   │   ├── id-mapper.ts
│   │   ├── trade-calculator.ts
│   │   ├── fixed-192x64-math.ts
│   │   └── trade-executor.ts
│   ├── cache.ts
│   ├── server.ts
│   └── socket.ts
├── tests/
│   ├── onchain-reader.test.ts
│   ├── id-mapper.test.ts
│   ├── trade-calculator.test.ts
│   └── trade-executor.test.ts
└── .env
```

## Setup Instructions

### Install Dependencies
```bash
pnpm install
```

### Set Up Environment Variables
Create a `.env` file in the `backend/` directory with the following variables:
```
API_KEY=
SUBGRAPH_URL=
PRIVATE_KEY=
AVALANCHE_FUJI_RPC=
MARKET_FACTORY_ADDRESS=
FAUCET_ADDRESS=
USDC_FAUCET_ADDRESS=
MATCHBOOK_USERNAME=
MATCHBOOK_PASSWORD=
```

### Start the Server
```bash
pnpm run start
```

This will start the backend server, which fetches match data, updates the cache, runs the rebalancer service, and communicates with the frontend in real-time.

---
## License
This project is licensed under the [MIT License](LICENSE).
