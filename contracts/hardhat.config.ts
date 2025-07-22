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
            runs: 1,
          },
          metadata: {
            bytecodeHash: "none",
          },
          evmVersion: "istanbul",
          viaIR: true,
        },
      },
      {
        version: "0.8.25",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          metadata: {
            bytecodeHash: "none",
          },
          evmVersion: "istanbul",
          viaIR: true,
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
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
  },
  networks: {
    avalancheFuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY ?? ""],
      gas: "auto",
      gasPrice: 5_000_000_000,
    },
    liveduelSubnet: {
      url:
        "https://rpc-liveduel.cogitus.io/jqrUCybt4XforDsXXhOV/ext/bc/2MWwV2p26iaMu6GxJf2sCfwEVQCTSYA2rBBhAFGzHVdsxgVhxD/rpc",
      chainId: 43113,
      accounts: [process.env.PRIVATE_KEY ?? ""],
      gas: "auto",
      gasPrice: 5_000_000_000,
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
