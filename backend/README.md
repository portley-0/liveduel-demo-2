
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
* **`trade-calculator.ts`** - The "brain" of the operation. It uses an off-chain model of the LMSR to calculate the most efficient trade to align odds.
* **`trade-executor.ts`** - The "hands" of the operation. It safely submits the calculated trade transactions to the blockchain.

---
## Key Technologies & Strategies

The Rebalancer Bot leverages several advanced algorithms and strategies:

* **Cyclic Coordinate Descent:** The core optimization algorithm used to find the ideal trade amounts by iteratively refining each outcome.
* **Binary Search:** The efficient search algorithm used within the Coordinate Descent to find the optimal value for each individual outcome.
* **Token Set Ratio (Fuzzy String Matching):** The specific algorithm from the `fuzzball` library used to reliably map team names between different API sources.
* **Off-Chain LMSR Simulation:** Replicating the on-chain `pow(2,x)`-based LMSR price formula in TypeScript to predict trade outcomes instantly without gas costs.
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
│   │   ├── rebalancer.ts
│   │   ├── rebalancer.config.ts
│   │   ├── onchain-reader.ts
│   │   ├── matchbook.api.ts
│   │   ├── id-mapper.ts
│   │   ├── trade-calculator.ts
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
