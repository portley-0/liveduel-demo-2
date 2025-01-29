// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IGnosisLMSRMarketMakerFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILMSRMarketMaker.sol";

contract LMSRMarketMakerFactoryWrapper {

    IGnosisLMSRMarketMakerFactory private lmsrFactory;
    IERC20 public usdc;

    address public conditionalTokens;
    address public gnosisWhitelist;

    uint64 public defaultFee;
    uint256 public initialFunding;

    constructor(
        address _lmsrFactory,
        address _usdc,
        address _conditionalTokens, 
        address _gnosisWhitelist,
        uint64 _defaultFee,
        uint256 _initialFunding
    ) {
        require(_lmsrFactory != address(0), "Invalid LMSRFactory address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_conditionalTokens != address(0), "Invalid ConditionalTokens");
        require(_gnosisWhitelist != address(0), "Invalid Whitelist");

        lmsrFactory = IGnosisLMSRMarketMakerFactory(_lmsrFactory);
        usdc = IERC20(_usdc);
        conditionalTokens = _conditionalTokens;
        gnosisWhitelist = _gnosisWhitelist;
        defaultFee = _defaultFee;
        initialFunding = _initialFunding;
    }

    function createLMSRMarketMaker(     
        bytes32[] memory conditionIds         
    ) external returns (address) {

        bool success = usdc.transferFrom(msg.sender, address(this), initialFunding);
        require(success, "USDC transfer failed");

        usdc.approve(address(lmsrFactory), initialFunding);

        address marketMaker = lmsrFactory.createLMSRMarketMaker(
            conditionalTokens,    
            address(usdc),
            conditionIds,
            defaultFee,     
            gnosisWhitelist,
            initialFunding
        );

        ILMSRMarketMaker(marketMaker).transferOwnership(msg.sender);

        return marketMaker;

    }
}
