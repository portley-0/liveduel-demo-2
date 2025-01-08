require("chai").should();
require('mocha-steps');

const HDWalletProvider = require("@truffle/hdwallet-provider");

require("dotenv").config(); 

const config = {
    networks: {
        mainnet: {
            host: "localhost",
            port: 8545,
            network_id: "1",
        },
        ropsten: {
            host: "localhost",
            port: 8545,
            network_id: "3",
        },
        kovan: {
            host: "localhost",
            port: 8545,
            network_id: "42",
        },
        rinkeby: {
            host: "localhost",
            port: 8545,
            network_id: "4",
        },
        goerli: {
            host: "localhost",
            port: 8545,
            network_id: "5",
        },
        develop: {
            host: "localhost",
            port: 8545,
            network_id: "*",
	    },
        avalancheFuji: { // Avalanche Fuji Testnet configuration
            provider: () => new HDWalletProvider(
                process.env.PRIVATE_KEY, 
                "https://api.avax-test.network/ext/bc/C/rpc" 
            ),
            network_id: "43113",    
            gas: 3000000, 
            gasPrice: 225000000000, 
        },
    },
    mocha: {
        enableTimeouts: false,
        grep: process.env.TEST_GREP,
        reporter: "eth-gas-reporter",
        reporterOptions: {
            currency: "USD",
            excludeContracts: ["Migrations"]
        }
    },
    compilers: {
        solc: {
            version: "0.5.10",
            settings: {
                optimizer: {
                    enabled: true
                }
            }
        }
    }
}

const _ = require('lodash')

try {
    _.merge(config, require('./truffle-local'))
}
catch(e) {
    if(e.code === 'MODULE_NOT_FOUND') {
        // eslint-disable-next-line no-console
        console.log('No local truffle config found. Using all defaults...')
    } else {
        // eslint-disable-next-line no-console
        console.warn('Tried processing local config but got error:', e)
    }
}

module.exports = config




=====================================================================================
Deploying contracts with deployer address: 0xFE8Fe150A6F4903B0E8F0C5294bF34fEedAD3024
=====================================================================================

Attaching to deployed Whitelist...
Attached to Whitelist at: 0x503B6Bf0a1e34723AB39d9cD08bA453713a2510d

Deploying MockUSDC...
MockUSDC deployed to: 0x42eDcb19eE6f53423D2817061448Ca99ED2A5dD7

Deploying DuelToken...
DuelToken deployed to: 0x0D5449cf68e8C82D83841c3De3d54Fdc148b1A28

Deploying ConditionalTokensWrapper...
ConditionalTokensWrapper deployed to: 0x3bE80cED4B2a5b63Bb2F4DDaB2db360F71Cf2E79

Deploying LMSRMarketMakerFactoryWrapper...
LMSRMarketMakerFactoryWrapper deployed to: 0x400Dec387C739c05a3fF3E7E42d9ca6F4Fa115Bb

Deploying LiquidityPool...
LiquidityPool deployed to: 0xdE8039BF9dDFd63B0Ba46d97Ddc4230Ab5a7251E

Deploying WhitelistWrapper...
WhitelistWrapper deployed to: 0x53680F94cee359b1e3BF1CBFaad899d6CBAb0413

Transferring Whitelist ownership to WhitelistWrapper...
Transaction hash: 0xffe705ea3e89491c8405b446d218582ad17d8627655106dea98523552c896233
Whitelist ownership transferred to WhitelistWrapper.

Deploying MarketFactory...
MarketFactory deployed to: 0xD77ac57e24b2368a2D1A115970e5Cbd0B2a91e74

Transferring WhitelistWrapper ownership to MarketFactory...
Transaction hash: 0x419f05bf1e23579e3698220893b1fdfcdcf8794d7574b73c2eecae19f28cf8a6
WhitelistWrapper ownership transferred to MarketFactory at 0xD77ac57e24b2368a2D1A115970e5Cbd0B2a91e74

Adding initial liquidity...
Minting MockUSDC...
Transaction hash: 0x5f91478cae13b0f2deb1f96fa8478390e87feaa0c78910d263fda228e7d7181c
MockUSDC minted to deployer.
Minting DuelToken...
Transaction hash: 0xc78b432d8aee676b6b997327225cf09dfd2833979b3531c6477df43a472e91b5
DuelToken minted to deployer.
Approving LiquidityPool to spend MockUSDC...
MockUSDC approved for LiquidityPool.
Approving LiquidityPool to spend DuelToken...
DuelToken approved for LiquidityPool.
Transferring DuelToken ownership to LiquidityPool...
Transaction hash: 0x417c3798b99f206171a073d8dc46ccfe17699a943a6f2e48b4cfb6e881d8e2a6
DuelToken ownership transferred to LiquidityPool.
Adding liquidity...
Transaction hash: 0x88fb90bba7c1a7f5434861a4e75151bec22f1d38f918b47518fa2ca845ef9a24
Initial liquidity added successfully!

Transferring LiquidityPool ownership to MarketFactory...
Transaction hash: 0xda81682cbce07c8789fb8931d9bcf1bbe9825ad9fabd9256873dbcd2d2f341a2
LiquidityPool ownership transferred to MarketFactory at 0xD77ac57e24b2368a2D1A115970e5Cbd0B2a91e74

Initializing MarketFactory...
Transaction hash: 0x6ca2a9469127d6676709846b4025bd482bbd36d16f75e2131dbd503b5b8c1ee1
MarketFactory initialized successfully.