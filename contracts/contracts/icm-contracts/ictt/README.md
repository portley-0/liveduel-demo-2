# Avalanche Interchain Token Transfer (ICTT)

## Overview

Avalanche Interchain Token Transfer (ICTT) is an application that allows users to transfer tokens between L1s. The implementation is a set of smart contracts that are deployed across multiple L1s, and leverages [ICM](https://github.com/ava-labs/icm-contracts) for cross-chain communication.

Each token transferrer instance consists of one "home" contract and at least one but possibly many "remote" contracts. Each home contract instance manages one asset to be transferred out to `TokenRemote` instances. The home contract lives on the L1 where the asset to be transferred exists. A transfer consists of locking the asset as collateral on the home L1 and minting a representation of the asset on the remote L1. The remote contracts, each of which has a single specified home contract, live on other L1s that want to import the asset transferred by their specified home. The token transferrers are designed to be permissionless: anyone can register compatible `TokenRemote` instances to allow for transferring tokens from the `TokenHome` instance to that new `TokenRemote` instance. The home contract keeps track of token balances transferred to each `TokenRemote` instance, and handles returning the original tokens back to the user when assets are transferred back to the `TokenHome` instance. `TokenRemote` instances are registered with their home contract via an ICM message upon creation.

Home contract instances specify the asset to be transferred as either an ERC20 token or the native token, and they allow for transferring the token to any registered `TokenRemote` instances. The token representation on the remote chain can also either be an ERC20 or native token, allowing users to have any combination of ERC20 and native tokens between home and remote chains:

- `ERC20` -> `ERC20`
- `ERC20` -> `Native`
- `Native` -> `ERC20`
- `Native` -> `Native`

The remote tokens are designed to have compatibility with the token transferrer on the home chain by default, and they allow custom logic to be implemented in addition. For example, developers can inherit and extend the `ERC20TokenRemote` contract to add additional functionality, such as a custom minting, burning, or transfer logic.

The token transferrer also supports "multi-hop" transfers, where tokens can be transferred between remote chains. To illustrate, consider two remotes _R<sub>a</sub>_ and _R<sub>b</sub>_ that are both connected to the same home _H_. A multi-hop transfer from _R<sub>a</sub>_ to _R<sub>b</sub>_ first gets routed from _R<sub>a</sub>_ to _H_, where remote balances are updated, and then _H_ automatically routes the transfer on to _R<sub>b</sub>_.

In addition to supporting basic token transfers, the token transferrer contracts offer a `sendAndCall` interface for transferring tokens and using them in a smart contract interaction all within a single ICM message. If the call to the recipient smart contract fails, the transferred tokens are sent to a fallback recipient address on the destination chain of the transfer. The `sendAndCall` interface enables the direct use of transferred tokens in dApps on other chains, such as performing swaps, using the tokens to pay for fees when invoking services, etc.

## Upgradability

The token transferrer contracts implement both upgradeable and non-upgradeable versions. The non-upgradeable versions are extensions of their respective upgradeable token transferrer contract, and has a `constructor` that calls the `initialize` function of the upgradeable version. The upgradeable contracts are ERC7201 compliant, and use namespace storage to store the state of the contract.

## `ITokenTransferrer`

Interface that defines the events token transfer contract implementations must emit. Also defines the message types and formats of messages between all implementations.

## `IERC20TokenTransferrer` and `INativeTokenTransferrer`

Interfaces that define the external functions for interacting with token transfer contract implementations of each type. ERC20 and native token transferrer interfaces vary from each other in that the native token transferrer functions are `payable` and do not take an explicit amount parameter (it is implied by `msg.value`), while the ERC20 token transferrer functions are not `payable` and require the explicit amount parameter. Otherwise, they include the same functions.

## `TokenHome`

An abstract implementation of `ITokenTransferrer` for a token transfer contract on the "home" chain with the asset to be transferred. Each `TokenHome` instance supports transferring exactly one token type (ERC20 or native) on its chain to arbitrarily many "remote" instances on other chains. It handles locking tokens to be sent to `TokenRemote` instances, as well as receiving token transfer messages to either redeem tokens it holds as collateral (i.e. unlock), or route them to other `TokenRemote` instances (i.e. "multi-hop"). In the case of a multi-hop transfer, the `TokenHome` already has the collateral locked from when the tokens were originally transferred to the first `TokenRemote` instance, so it simply updates the accounting of the transferred balances to each respective `TokenRemote` instance. Remote contracts must first be registered with a `TokenHome` instance before the home contract will allow for sending tokens to them. This is to prevent tokens from being transferred to invalid remote addresses. Anyone is able to deploy and register remote contracts, which may have been modified from this repository. It is the responsibility of the users of the home contract to independently evaluate each remote for its security and correctness.

## `ERC20TokenHome`

A concrete implementation of `TokenHome` and `IERC20TokenTransferrer` that handles the locking and releasing of an ERC20 token.

## `NativeTokenHome`

A concrete implementation of `TokenHome` and `INativeTokenTransferrer` that handles the locking and release of the native EVM asset.

## `TokenRemote`

An abstract implementation of `ITokenTransferrer` for a token transfer contract on a "remote" chain that receives transferred assets from a specific `TokenHome` instance. Each `TokenRemote` instance has a single `TokenHome` instance that it receives token transfers from to mint tokens. It also handles sending messages (and correspondingly burning tokens) to route tokens back to other chains (either its `TokenHome`, or other `TokenRemote` instances). Once deployed, a `TokenRemote` instance must be registered with its specified `TokenHome` contract. This is done by calling `registerWithHome` on the remote contract, which will send an ICM message to the home contract with the information to register.

All messages sent by `TokenRemote` instances are sent to the specified `TokenHome` contract, whether they are to redeem the collateral from the `TokenHome` instance or route the tokens to another `TokenRemote` instance. Routing tokens from one `TokenRemote` instance to another is referred to as a "multi-hop", where the tokens are first sent back to their `TokenHome` contract to update its accounting, and then automatically routed on to their intended destination `TokenRemote` instance.

TokenRemote contracts allow for scaling token amounts, which should be used when the remote asset has a higher or lower denomination than the home asset, such as allowing for a ERC20 home asset with a denomination of 6 to be used as the native EVM asset on a remote chain (with a denomination of 18).

## `ERC20TokenRemote`

A concrete implementation of `TokenRemote`, `IERC20TokenTransferrer`, and `IERC20` that handles the minting and burning of an ERC20 asset. Note that the `ERC20TokenRemote` contract is an ERC20 implementation itself, which is why it takes the `tokenName`, `tokenSymbol`, and `tokenDecimals` in its constructor. All of the ERC20 interface implementations are inherited from the standard OpenZeppelin ERC20 implementation, and can be overriden in other implementations if desired.

## `NativeTokenRemote`

A concrete implementation of `TokenRemote`, `INativeTokenTransferrer`, and `IWrappedNativeToken` that handles the minting and burning of the native EVM asset on its chain using the native minter precompile. Deployments of this contract must be given the permission to mint native coins in the chain's configuration. Note that the `NativeTokenRemote` is also an implementation of `IWrappedNativeToken` itself, which is why the `nativeAssetSymbol` must be provided in its constructor. `NativeTokenRemote` instances always have a denomination of 18, which is the denomination of the native asset of EVM chains.

The [native minter precompile](https://build.avax.network/docs/virtual-machines/custom-precompiles#minting-native-coins) must be configured to allow the contract address of the `NativeTokenRemote` instance to call `mintNativeCoin`. The correctness of a native token transferrer implemented using `NativeTokenRemote` relies on no other accounts being allowed to call `mintNativeCoin`, which could result in the token transferrer becoming undercollateralized. Example initialization steps for a `NativeTokenRemote` instance are shown below.

Since the native minter precompile does not provide an interface for burning the native EVM asset, the "burn" functionality is implemented by transferring the native coins to an unowned address. The contract also provides a `reportBurnedTxFees` interface in order to burn the collateral in the `TokenHome` instance that should be made unredeemable to account for native tokens burnt on the chain with the `NativeTokenRemote` instance to pay for transaction fees.

To account for the need to bootstrap the chain using a transferred asset as its native token, the `NativeTokenRemote` takes the `initialReserveImbalance` in its constructor. Once registered with its `TokenHome`, the `TokenHome` will require the `initialReserveImbalance` to be accounted for before sending token amounts to be minted on the given remote chain. The following example demonstrates the intended initialization flow:

1. Create a new blockchain with 100 native tokens allocated in its genesis block, and set the pre-derived `NativeTokenRemote` contract address (based on the deployer nonce) to have the permission to mint native tokens using the native minter precompile. Note that the deployer account will need to be funded in order to deploy the `NativeTokenRemote` contract, and an account used to relay messages into this chain must also be funded to relay the first messages.
2. Deploy the `NativeTokenRemote` contract to the pre-derived address set in the blockchain configuration of step 1. The `initialReserveImbalance` should be 100, matching the number of tokens allocated in the genesis block that were not initially backed by collateral in the `TokenHome` instance.
3. Call the `registerWithHome` function on the `NativeTokenRemote` instance to send an ICM message registering this remote with its `TokenHome`. This message should be relayed and delivered to the `TokenHome` instance.
4. Once registered on the `TokenHome` contract, add 100 tokens as collateral for the new `NativeTokenRemote` instance by calling the `addCollateral` function on the `TokenHome` contract. A `CollateralAdded` event will be emitted by the `TokenHome` contract with a `remaining` amount of 0 once the `NativeTokenRemote` is fully collateralized.
5. Now that the `NativeTokenRemote` contract is fully collateralized, tokens can be moved normally in both directions across the token transfer contracts by calling their `send` functions.

The `totalNativeAssetSupply` implementation of `NativeTokenRemote` takes into account:

- the initial reserve imbalance
- the number of native tokens that it has minted
- the number of native tokens that have been burned to pay for transaction fees
- the number of native tokens "burned" to be transferred to other chains, which are sent to a pre-defined `BURNED_FOR_TRANSFER_ADDRESS`.

Note that the value returned by `totalNativeAssetSupply` is an upper bound on the circulating supply of the native asset on the chain using the `NativeTokenRemote` instance since tokens could be burned in other ways that it does not account for.

## ICM Message Fees

Fees can be optionally added to ICM messages in order to incentivize relayers to deliver them, as documented [here](https://github.com/ava-labs/icm-contracts/tree/main/contracts/teleporter#fees). The token transfer contracts in this repository allow for specifying any ERC20 token and amount to be used as the ICM message fee for single-hop transfers in either direction between `TokenHome` and `TokenRemote` instances. Fee amounts must be pre-approved to be spent by the token transfer contract before initiating a transfer.

Multi-hop transfers between two `TokenRemote` instances involve two ICM messages: the first from the initiating `TokenRemote` instance to its home, and the second from its home to the destination `TokenRemote` instance. In the multi-hop case, the first message fee can be paid in any ERC20 token and amount (similar to the single-hop case), but the second message fee must be paid in-kind of the asset being transferred and is deducted from the amount being transferred. This restriction on the secondary message fee is necessary because the transaction on the intermediate chain routing the funds to the destination `TokenRemote` instance is not sent by the wallet performing the transfer. Because of this, it can not directly spend an arbitrary ERC20 token from that wallet. Using the asset being transferred for the optional secondary fee allows users to perform an incentivized multi-hop transfer without needing to make any interaction with the home themselves. If there is a need for the second message from the home to the destination `TokenRemote` instance to pay a fee in another asset, it is recommended to perform two single-hop transfers, which allows for specifying an arbitrary ERC20 token to be used for the fee of each.
