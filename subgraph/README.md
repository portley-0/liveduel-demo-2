# Subgraph Module

## Overview
The **Subgraph Module** indexes key events from the **PredictionMarket**, **TournamentMarket** and **MarketFactory** contracts, enabling efficient data retrieval for the frontend and backend.

This subgraph is deployed to a self-hosted **Graph Node** running on **AWS EC2** via Docker Compose.

## Dependencies
- **The Graph Protocol** – Used for indexing and querying contract events.
- **Graph CLI** – For building and deploying the subgraph.
- **Solidity Contracts** – Prediction System contracts on Avalanche Fuji.

## Directory Structure
```
├── subgraph
│   ├── abis/
│   ├── build/
│   ├── generated/
│   ├── src/
│   │   ├── prediction-market.ts   # Handles PredictionMarket events
│   │   ├── market-factory.ts     # Handles MarketFactory events
│   │   ├── tournament-market.ts     # Handles TournamentMarket events
│   ├── tests/
│   │   ├── prediction-market.test.ts   # Testing
│   ├── docker-compose.yml # Docker setup for Graph Node, Postgres, IPFS 
│   ├── package.json       # Dependencies and scripts
│   ├── schema.graphql     # GraphQL schema defining entities
│   ├── subgraph.yaml      # Subgraph manifest configuration
│   ├── tsconfig.json      # TypeScript configuration
```

## Indexed Events
The subgraph tracks the following **PredictionMarket** contract events:
- `SharesPurchased(buyer, outcome, shares, actualCost)`
- `SharesSold(seller, outcome, shares, actualGain)`
- `OddsUpdated(matchId, home, draw, away)`
- `PayoutRedeemed(redeemer, outcome, amount)`
- `MarketResolved(matchId, outcome)`

The subgraph tracks the following **TournamentMarket** contract events:
- `SharesPurchased(tournamentId, outcome, shares, cost)`
- `SharesSold(tournamentId, seller, outcome, shares, actualGain)`
- `OddsUpdated(tournamentId, marginalPrices)`
- `PayoutRedeemed(tournamentId, redeemer, outcome, amount)`
- `MarketResolved(tournamentId, outcome)`
- `FixtureAdded(tournamentId, matchId, isRoundFinal, isTournamentFinal)`
- `MatchResultRecorded(tournamentId, matchId, apiOutcome, winnerIndex)`
    

It tracks the following **MarketFactory** contract event: 
- `PredictionMarketDeployed(uint256 matchId, address marketAddress, uint256 matchTimestamp)`
- `TournamentMarketDeployed(uint256 tournamentId, address marketAddress)`

## Setup & Deployment

### Install Dependencies
```bash
yarn install
```

### Generate & Build the Subgraph
```bash
yarn codegen
yarn build
```

> Note: (Make sure you have Docker & Docker Compose installed. On AWS EC2, see docker-compose.yml.)

### Run the Graph Node
```bash
yarn docker:up
```

### Deploy to Your Self-Hosted Graph Node
```bash
yarn deploy:docker
```

You can then query the subgraph at:
```bash
http://<EC2-PUBLIC-IP>:8000/subgraphs/name/liveduel-demo-2
```

## Testing the Subgraph
This project uses **[Matchstick](https://github.com/LimeChain/matchstick)** for unit testing subgraph mappings.  
- To run tests:
  ```bash
  yarn test
  ```

## License
This project is licensed under the [MIT License](LICENSE).
