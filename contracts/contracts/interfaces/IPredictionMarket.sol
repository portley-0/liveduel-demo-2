// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPredictionMarket
 * @notice A comprehensive interface for the PredictionMarket contract.
 */
interface IPredictionMarket {
    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event SharesPurchased(
        address indexed buyer,
        uint8 indexed outcome,
        uint256 shares,
        int actualCost
    );
    event MarketResolved(
        uint256 indexed matchId,
        uint8 indexed outcome
    );
    event PayoutRedeemed(
        address indexed redeemer,
        uint8 indexed outcome,
        uint256 amount
    );
    event OddsUpdated(
        uint256 indexed matchId,
        uint256 home,
        uint256 draw,
        uint256 away
    );

    // From OpenZeppelin Ownable
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    // ------------------------------------------------------------------------
    // Public State Variable Getters
    // ------------------------------------------------------------------------
    function matchId() external view returns (uint256);
    function liquidityPool() external view returns (address);
    function conditionId() external view returns (bytes32);
    function questionId() external view returns (bytes32);
    function usdc() external view returns (address);
    function conditionalTokens() external view returns (address);
    function marketMaker() external view returns (address);
    function initialized() external view returns (bool);
    function isResolved() external view returns (bool);
    function resolvedOutcome() external view returns (uint8);

    /// @dev The bettors array is public, but Solidity only provides an indexed getter:
    ///      bettors(uint256) -> (address). There's no built-in function returning the entire array at once.
    function bettors(uint256 index) external view returns (address);

    /// @dev Public mapping isBettor(address) -> bool
    function isBettor(address user) external view returns (bool);

    /// @dev A public constant also generates a getter.
    function FEE_BPS() external pure returns (uint256);

    // ------------------------------------------------------------------------
    // External Functions
    // ------------------------------------------------------------------------

    /**
     * @notice Initializes the market: sets condition/question IDs, the market maker,
     *         and calls `approveMarketMakerViaAdapterExternal()`.
     *         Must be called by the contract owner, only once.
     */
    function initializeMarket(bytes32 _questionId, bytes32 _conditionId, address _marketMaker) external;

    /**
     * @notice Buys outcome tokens (i.e., places a bet on a certain outcome).
     * @param outcome Which outcome (0=home,1=draw,2=away).
     * @param amount  Number of shares to buy.
     */
    function buyShares(uint8 outcome, uint256 amount) external;

    /**
     * @notice Returns the net cost of a hypothetical buy for a single outcome.
     */
    function getNetCost(uint8 outcome, uint256 amount) external view returns (int);

    /**
     * @notice Resolves the market by reporting the winning outcome to the conditional tokens contract.
     *         Must be called by the contract owner.
     */
    function resolveMarket(uint8 result) external;

    /**
     * @notice Allows users to redeem their winning shares after the market is resolved.
     */
    function redeemPayouts() external;

    // ------------------------------------------------------------------------
    // Ownable (OpenZeppelin) Functions
    // ------------------------------------------------------------------------
    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function renounceOwnership() external;

    // ------------------------------------------------------------------------
    // ERC1155Receiver / ERC165 Functions (from ERC1155Holder)
    // ------------------------------------------------------------------------
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
