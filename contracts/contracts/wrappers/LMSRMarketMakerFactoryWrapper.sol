// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ILMSRMarketMakerFactory.sol";
import "../interfaces/IConditionalTokens.sol";
import "../interfaces/IWhitelist.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LMSRMarketMakerFactoryWrapper {
    ILMSRMarketMakerFactory private lmsrFactory;
    IERC20 public usdc;

    constructor(address _lmsrFactory, address _usdc) {
        require(_lmsrFactory != address(0), "Invalid LMSRFactory address");
        require(_usdc != address(0), "Invalid USDC address");
        lmsrFactory = ILMSRMarketMakerFactory(_lmsrFactory);
        usdc = IERC20(_usdc);
    }

    function createLMSRMarketMaker(
        address conditionalTokensAddr,   
        address collateralTokenAddr,     
        bytes32[] memory conditionIds,  
        uint fee,                        
        address whitelistAddr,           
        uint initialFunding             
    ) external returns (address) {
        require(collateralTokenAddr == address(usdc), "Collateral mismatch");

        bool success = usdc.transferFrom(msg.sender, address(this), initialFunding);
        require(success, "USDC transfer failed");

        usdc.approve(address(lmsrFactory), initialFunding);

        return lmsrFactory.createLMSRMarketMaker(
            IConditionalTokens(conditionalTokensAddr),
            IERC20(collateralTokenAddr),
            conditionIds,
            uint64(fee),
            IWhitelist(whitelistAddr),
            initialFunding
        );
    }
}
