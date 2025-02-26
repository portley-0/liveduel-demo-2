# LiveDuel Monorepo

## 🏀 Overview
This LiveDuel demo is a decentralized sports prediction platform using blockchain technology. This monorepo contains four key modules:

- **Contracts**: Solidity smart contracts for LMSR prediction market contract factory system, deployed on Avalanche Fuji Testnet.
- **Frontend**: A Next.js web app with WalletConnect and real-time match odds.
- **Backend**: An Express.js server that aggregates odds from The Graph and API Football.
- **Subgraph**: A Graph Protocol subgraph that indexes PredictionMarket events.

---

## 🗂 Directory Structure
```
├── contracts
├── frontend
├── backend
└── subgraph
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Environment Variables
Each module requires environment variables. Refer to each module's README for specific `.env` file instructions.

### 3. Running Each Module
```bash
# Contracts (Hardhat)
npx hardhat test

# Frontend (Next.js)
pnpm run dev

# Backend (Express.js)
pnpm run dev

# Subgraph (Graph CLI)
yarn codegen
yarn build
yarn deploy
```

---

## 🌍 Deployment
- **Contracts**: Deployed on Avalanche Fuji Testnet
- **Frontend**: Hosted on Vercel
- **Backend**: Hosted on AWS EC2
- **Subgraph**: Deployed using The Graph's Hosted Service

---

## 🛠 Technologies
- **Solidity** for Smart Contracts
- **Chainlink Automation** for Market Resolution
- **ERC1155 Tokens** for Outcome Shares
- **The Graph Protocol** for Event Indexing
- **Next.js** with RainbowKit for WalletConnect
- **Express.js** with WebSockets for Real-Time Odds

---

## 📄 Documentation
- [Contracts README](#contracts)
- [Frontend README](#frontend)
- [Backend README](#backend)
- [Subgraph README](#subgraph)

---

## 📝 License
This project is licensed under the [MIT License](LICENSE).

---

# Contracts README

## 📜 Overview
The Contracts module contains Solidity smart contracts for creating prediction markets, managing liquidity, and resolving outcomes using Chainlink Automation.

## 🛠 Requirements
- Node.js
- Hardhat
- Avalanche Fuji Testnet RPC

## 🧩 Environment Variables
Create a `.env` file with the following variables:
```env
PRIVATE_KEY=
ALCHEMY_API_KEY=
CHAINLINK_AUTOMATION_ID=
LINK_TOKEN_ADDRESS=
```

## 💾 Installation
```bash
cd contracts
pnpm install
```

## 🚀 Deployment
```bash
npx hardhat run scripts/deploy.js --network avalancheFuji
```

## ✅ Testing
```bash
npx hardhat test
```

---

# Frontend README

## 🌐 Overview
The Frontend module is a Next.js web app that allows users to connect wallets using RainbowKit and place predictions using $mUSDC tokens.

## 🧩 Environment Variables
Create a `.env.local` file with the following variables:
```env
NEXT_PUBLIC_CHAIN_ID=43113
NEXT_PUBLIC_GRAPH_URL=
NEXT_PUBLIC_API_URL=
```

## 💾 Installation
```bash
cd frontend
npm install
```

## 🚀 Development
```bash
npm run dev
```

## 🧩 Wallet Integration
- Connect wallet using WalletConnect (RainbowKit)
- Buy $Duel tokens using MetaMask

---

# Backend README

## 🏀 Overview
The Backend module is an Express.js server that fetches real-time match data from API Football and aggregates odds from The Graph.

## 🧩 Environment Variables
Create a `.env` file with the following variables:
```env
PORT=4000
GRAPH_API_URL=
API_FOOTBALL_KEY=
```

## 💾 Installation
```bash
cd backend
npm install
```

## 🚀 Development
```bash
npm run dev
```

## 🧩 Real-Time Odds
- Uses WebSockets to stream live odds updates to the frontend

---

# Subgraph README

## 🌍 Overview
The Subgraph module indexes PredictionMarket events from the Avalanche Fuji Testnet using The Graph Protocol.

## 🧩 Environment Variables
Create a `.env` file with the following variables:
```env
GRAPH_ACCESS_TOKEN=
```

## 💾 Installation
```bash
cd subgraph
yarn install
```

## 🚀 Deployment
```bash
yarn codegen
yarn build
yarn deploy
```

## ✅ Events Indexed
- `SharesPurchased`
- `SharesSold`
- `OddsUpdated`
- `PredictionMarketResolved`

---

## 🤝 Contributing
1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

---

## 💡 Support
For any issues, please open an [issue on GitHub](https://github.com/portley-0/liveduel-demo-2/issues).

