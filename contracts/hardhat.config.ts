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
          viaIR: true
        },
      },
      {
        version: "0.5.1", 
        settings: {
          optimizer: {
            enabled: true,
          },
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
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY ?? ""],
      gas: "auto", 
      gasPrice: 5000000000, // 
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
