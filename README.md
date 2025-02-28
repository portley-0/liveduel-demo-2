# Liveduel Demo 2

## ⚽ Overview
This demo project is a decentralized soccer prediction market platform built on the **Avalanche Fuji Testnet**. This monorepo contains all core components needed to operate the system, including smart contracts, a web frontend, a backend server, and a subgraph.

## 🛠 Technologies
- **Solidity** – Smart contract development
- **Chainlink Functions** – Oracle for match results
- **Chainlink Automation** – Automated match resolution
- **Gnosis Conditional Tokens Framework (CTF)** – Market-based reward distribution
- **Logarithmic Market Scoring Rule (LMSR)** – Dynamic odds calculation
- **The Graph Protocol** – Event indexing and querying
- **Next.js** + **RainbowKit** – Frontend with WalletConnect integration
- **Express.js** + **WebSockets** – Backend for real-time odds updates

---

## 🌍 Deployment
- **Contracts**: Deployed on **Avalanche Fuji Testnet**
- **Frontend**: Hosted on **Vercel**
- **Backend**: Hosted on **AWS EC2**
- **Subgraph**: Deployed using **The Graph's Hosted Service**
- **Live Demo**: [https://liveduel-demo-2.app/](https://liveduel-demo-2.app/)

---

## 📂 Directory Structure
```
├── contracts   # Solidity smart contracts 
├── frontend    # Next.js app with WalletConnect and live odds
├── backend     # Express.js server aggregating odds from The Graph & API Football
└── subgraph    # The Graph Protocol subgraph for event indexing
```
Each module has its own **README.md** with setup and deployment instructions.

---

## 📝 Documentation
For module-specific setup instructions, refer to:
- [Contracts README](./contracts/README.md)
- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)
- [Subgraph README](./subgraph/README.md)

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

