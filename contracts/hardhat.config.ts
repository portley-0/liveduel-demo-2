import "hardhat-contract-sizer";
import { HardhatUserConfig } from "hardhat/config";
require("@chainlink/env-enc").config();
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
require("hardhat-gas-reporter");

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000, 
          },
          evmVersion: "istanbul",
        },
      },
      {
        version: "0.5.1", 
        settings: {
          optimizer: {
            enabled: true,
          },
          evmVersion: "istanbul",
        },
      },
    ],
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  networks: {
    avalancheFuji: {
      url: "https://rpc.ankr.com/avalanche_fuji",
      accounts: [process.env.PRIVATE_KEY ?? ""],
      gas: "auto", 
      gasPrice: 18000000000, // 
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
