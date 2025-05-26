# Frontend Module

## Overview

The Frontend Module provides the user interface for the decentralized soccer prediction market platform. I took inspiration from screenshots I took of the LiveDuel AIBC Sigma Pitch on Web3TV. **[here](https://youtu.be/M5qxUcS5GDY?si=SzcTPrTGiPngCBdq)**

## Technologies & Libraries

- **Vite & React:** For rapid development and building a modular UI.
- **TailwindCSS & Daisy UI:** For styling and responsive design.
- **RainbowKit, wagmi, viem, ethers:** For blockchain integration, wallet connectivity, and interacting with smart contracts.
- **Recharts & React Icons:** For data visualization and UI icons.
- **Socket.io Client:** To maintain a WebSocket connection with the backend for real-time match data updates.


### Global State Management & Real-Time Data
- **MatchContext & WalletProvider:**  
  These components form the backbone of our state management.
  - **MatchContext:** Holds and manages a record of match data objects (defined in `matchdata.ts`), which are updated in real time via WebSocket connection from the backend server.
  - **WalletProvider:** Wraps the application to provide access to RainbowKit wallet

### Main Sections
The frontend is divided into 5 primary areas:

- **Matches:**  
  Displays a high level match view of available soccer matches. Provides a menu to filter by soccer league, options for sorting by betting volume, Date ascending and descending, and live only. The high level match view displays the team names, logos, scoreboard, minutes elapsed, and the odds graph along with the current decimal odds for each outcome. 

- **Futures:**
  Currently displays a high level view of available tournament winner markets. 

- **Match:**
  When a user clicks on a match on the Matches page, a detailed match page is expanded. This provides a bigger view of the scoreboard, time elapsed, and odds graph etc, while also providing more detailed information such as match events, lineups, statistics, and league standings. It also provides a betting interface where the user can select an outcome token to bet on, and the amount of outcome tokens they want to purchase. It will display the total cost of the purchase, the LMSR net cost, plus the fee. 

- **Tournament:**
  Similarly when a user clicks on a tournament winner market on the Futures page, they are brought to a similar expanded details page where they can place bets on the tournament winner.

- **Predictions:**  
  Displays the prediction history for the connected wallet, and provides a redeem button for collecting winnings.



## Directory Structure

```
frontend/
├── public/
├── src/
│   ├── abis/
│   │   ├── ConditionalTokens.json
│   │   ├── PredictionMarket.json
│   │   ├── LiquidityPool.json
│   │   ├── MarketFactory.json
│   │   └── MockUSDC.json
│   ├── components/
│   │   ├── Betting.tsx
│   │   ├── FilterMenu.tsx
│   │   ├── MatchCard.tsx
│   │   ├── MatchInfo.tsx
│   │   ├── MatchList.tsx
│   │   └── Titlebar.tsx
│   ├── context/
│   │   ├── MatchContext.tsx
│   │   └── WalletProvider.tsx
│   ├── hooks/
│   │   ├── useMarketFactory.ts
│   │   └── useNetCost.ts
│   ├── pages/
│   │   ├── BuyDuel.tsx
│   │   ├── Markets.tsx
│   │   ├── Match.tsx
│   │   ├── Predictions.tsx
│   │   └── Staking.tsx
│   ├── styles/
│   │   └── globals.css
│   ├── types/
│   │   └── MatchData.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── package.json
├── vite.config.js
├── tailwind.config.ts
├── postcss.config.cjs
├── README.md
├── index.html
└── tsconfig.json
```



## Setup & Development

### Install Dependencies
```bash
pnpm install
```
### Run the dev server

```bash
pnpm run dev
```
---

## License
This project is licensed under the [MIT License](LICENSE).