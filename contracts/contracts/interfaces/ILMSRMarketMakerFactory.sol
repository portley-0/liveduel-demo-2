// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILMSRMarketMakerFactory
 * @notice Interface for the LMSRMarketMakerFactory contract
 */
interface ILMSRMarketMakerFactory {
    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------

    /// Emitted when ownership of the factory changes (during cloneConstructor).
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// Emitted upon creation of a new LMSRMarketMaker clone.
    event LMSRMarketMakerCreation(
        address indexed creator,
        address lmsrMarketMaker,
        address pmSystem,
        address collateralToken,
        bytes32[] conditionIds,
        uint64 fee,
        uint funding
    );

    /// Emitted inside cloneConstructor after initial data set.
    event AMMCreated(uint initialFunding);

    // ------------------------------------------------------------------------
    // Public Variables (via getters)
    // ------------------------------------------------------------------------

    /// A single “master” instance used as the implementation for clones.
    function implementationMaster() external view returns (address);

    // ------------------------------------------------------------------------
    // Functions
    // ------------------------------------------------------------------------

    /**
     * @notice Called by a newly cloned contract immediately after deployment
     *         to initialize storage variables.
     * @dev    This is part of the ConstructedCloneFactory pattern.
     * @param  consData Encoded constructor parameters:
     *          (ConditionalTokens pmSystem, IERC20 collateralToken, bytes32[] conditionIds, uint64 fee, Whitelist whitelist)
     */
    function cloneConstructor(bytes calldata consData) external;

    /**
     * @notice Deploys a new clone of the LMSRMarketMaker master,
     *         transfers funding to it, and resumes trading.
     * @param  pmSystem        The ConditionalTokens contract address
     * @param  collateralToken The collateral ERC20 token address
     * @param  conditionIds    The array of condition IDs
     * @param  fee             The fee in parts-per-1e18 (must be < 1e18)
     * @param  whitelist       Optional whitelist contract address
     * @param  funding         The amount of collateral to fund the AMM with
     * @return lmsrMarketMaker The newly created market maker’s address
     */
    function createLMSRMarketMaker(
        address pmSystem,
        address collateralToken,
        bytes32[] calldata conditionIds,
        uint64 fee,
        address whitelist,
        uint funding
    ) external returns (address lmsrMarketMaker);
}
