# Backend Module

## Overview
The **Backend Module** handles match data aggregation and caching, websocket communication, and API related interactions. Below is an overview of the key components:

### Core Files
- **`server.ts`** - Initializes the Express server and sets up API routes.
- **`socket.ts`** - Handles WebSocket connections for real-time updates.
- **`cache.ts`** - Manages match data caching, including storing, updating, and retrieving matches.

### Services
- **`polling-aggregator.ts`** - Periodically fetches football match data and prediction market information, updates the cache, and cleans up old data.
- **`football-service.ts`** - Interfaces with the football API to fetch match fixtures, statistics, events, lineups, and standings.
- **`subgraph-service.ts`** - Fetches on chain prediction market events using the deployed Graph Protocol subgraph.
- **`get-predictions.ts`** - Aggregates user prediction data from purchase and sales events.
- **`deploy-market.ts`** - Handles deploying new prediction markets on the blockchain.

### Artifacts
- **`MarketFactory.json`** - ABI for the smart contract factory used to deploy new prediction markets.

## 🛠 Dependencies
- **Express.js** - Backend framework for handling HTTP requests.
- **Socket.io** - WebSocket communication for real-time updates.
- **GraphQL** - Queries blockchain data from The Graph.
- **Axios** - HTTP client for fetching external API data.

## 📂 Directory Structure
```
backend/
├── src/
│   ├── artifacts/
│   │   ├── MarketFactory.json  # Smart contract ABI
│   ├── services/
│   │   ├── football-service.ts   # Fetches football match data
│   │   ├── subgraph-service.ts   # Fetches odds updates and market data
│   │   ├── polling-aggregator.ts # Aggregates data and updates the cache
│   │   ├── get-predictions.ts    # Aggregates user prediction data
│   │   ├── deploy-market.ts      # Deploys new prediction markets
│   ├── cache.ts                # Match data caching
│   ├── server.ts               # Express API server
│   ├── socket.ts               # WebSocket handling
```

## 🚀 Setup Instructions

### 1️⃣ Install Dependencies
```bash
pnpm install
```

### 2️⃣ Set Up Environment Variables
Create a `.env` file in the `backend/` directory with the following variables:
```
API_KEY=<your-api-key>
SUBGRAPH_URL=<your-subgraph-url>
PRIVATE_KEY=<your-private-key>
AVALANCHE_FUJI_RPC_URL=<your-rpc-url>
MARKET_FACTORY_ADDRESS=<your-market-factory-contract-address>
```

### 3️⃣ Start the Server
```bash
pnpm run start
```

This will start the backend server, which fetches match data, updates the cache, and communicates with the frontend in real-time.

---
## 📄 License
This project is licensed under the [MIT License](LICENSE).

