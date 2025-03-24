# Frontend Module

## Overview

The Frontend Module provides the user interface for the decentralized soccer prediction market platform. I took inspiration from screenshots I took of the Liveduel AIBC Sigma Pitch on Web3TV. 

## Technologies & Libraries

- **Vite & React:** For rapid development and building a modular UI.
- **TailwindCSS & Daisy UI:** For styling and responsive design.
- **RainbowKit, wagmi, viem, ethers:** For blockchain integration, wallet connectivity, and interacting with smart contracts.
- **Recharts & React Icons:** For data visualization and UI icons.
- **Socket.io Client:** To maintain a WebSocket connection with the backend for real-time match data updates.


### Global State Management & Real-Time Data
- **MatchContext & WalletProvider:**  
  These components form the backbone of our state management.
  - **MatchContext:** Holds and manages a list of match data objects (defined in `matchdata.ts`), which are updated in real time via WebSocket connection from the backend server.
  - **WalletProvider:** Wraps the application to provide access to Rainbowkit wallet

### Main Sections
The frontend is divided into four primary section:

- **Markets:**  
  Displays the match view of soccer matches. 

- **Predictions:**  
  Aggregates and displays user predictions and historical performance data, allowing users to track their activity and insights.

- **Buy $Duel:**  
  Provides an interface for users to purchase the $Duel token. This section integrates wallet connectivity via RainbowKit and web3 libraries to facilitate secure transactions.

- **Staking:**  
  Allows users to stake tokens, participate in liquidity pools, and earn rewards. This section updates in real time to reflect staking changes and outcomes.

### Additional Components
While the application consists of several components, here are a few key ones:
- **MatchList & MatchCard:**  
  Render lists of matches and individual match details, respectively.
- **Betting:**  
  Facilitates the betting process by allowing users to place wagers on live matches.
- **FilterMenu & MatchInfo:**  
  Provide filtering options and detailed views for selected matches.
- **TitleBar:**  
  Serves as the header/navigation component, enhancing the overall user experience.

## Technologies & Libraries

- **Vite & React:** For rapid development and building a modular UI.
- **TailwindCSS & Daisy UI:** For styling and responsive design.
- **RainbowKit, wagmi, viem, ethers:** For blockchain integration, wallet connectivity, and interacting with smart contracts.
- **Recharts & React Icons:** For data visualization and UI icons.
- **Socket.io Client:** To maintain a WebSocket connection with the backend for real-time match data updates.

## Directory Structure

A high-level overview of the project structure:

├── src/ │ ├── components/ │ │ ├── MatchContext.tsx # Global state for match data, receiving WS updates │ │ ├── MatchProvider.tsx # Provider for MatchContext │ │ ├── MatchList.tsx # Renders the list of matches │ │ ├── MatchCard.tsx # Displays individual match details │ │ ├── FilterMenu.tsx # Provides filtering options for matches │ │ ├── MatchInfo.tsx # Detailed view for selected match │ │ ├── TitleBar.tsx # Header and navigation bar │ │ ├── Betting.tsx # Handles betting interactions │ │ ├── BuyDuel.tsx # Interface to buy $Duel tokens │ │ ├── Markets.tsx # Displays prediction market data │ │ ├── Staking.tsx # Handles staking functionalities │ │ ├── Predictions.tsx # Displays user prediction data and history │ ├── types/ │ │ ├── matchdata.ts # Type definitions for match data objects │ ├── utils/ │ ├── ... # Additional utility functions and hooks

perl
Copy

## Setup & Development

### 1️⃣ Install Dependencies
Use your package manager to install all necessary dependencies:

```bash
pnpm install
2️⃣ Start the Development Server
Run the development server with:

bash
Copy
pnpm run dev
3️⃣ Build for Production
Generate an optimized production build using:

bash
Copy
pnpm run build
4️⃣ Preview the Production Build
Preview the production build locally with:

bash
Copy
pnpm run preview
Additional Documentation
Each component and section of the frontend is documented with inline comments. For more details on individual components or utility functions, refer to the source code within the respective directories.

License
This project is licensed under the MIT License.

yaml
Copy

---

If you need any further assistance or another method for creating a downloadable file, p