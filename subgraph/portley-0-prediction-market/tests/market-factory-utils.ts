import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  OwnershipTransferred,
  PlatformProfitAdded,
  PredictionMarketDeployed,
  PredictionMarketResolved
} from "../generated/MarketFactory/MarketFactory"

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createPlatformProfitAddedEvent(
  amount: BigInt
): PlatformProfitAdded {
  let platformProfitAddedEvent = changetype<PlatformProfitAdded>(newMockEvent())

  platformProfitAddedEvent.parameters = new Array()

  platformProfitAddedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return platformProfitAddedEvent
}

export function createPredictionMarketDeployedEvent(
  matchId: BigInt,
  marketAddress: Address,
  matchTimestamp: BigInt
): PredictionMarketDeployed {
  let predictionMarketDeployedEvent =
    changetype<PredictionMarketDeployed>(newMockEvent())

  predictionMarketDeployedEvent.parameters = new Array()

  predictionMarketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "matchId",
      ethereum.Value.fromUnsignedBigInt(matchId)
    )
  )
  predictionMarketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "marketAddress",
      ethereum.Value.fromAddress(marketAddress)
    )
  )
  predictionMarketDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "matchTimestamp",
      ethereum.Value.fromUnsignedBigInt(matchTimestamp)
    )
  )

  return predictionMarketDeployedEvent
}

export function createPredictionMarketResolvedEvent(
  matchId: BigInt,
  outcome: i32
): PredictionMarketResolved {
  let predictionMarketResolvedEvent =
    changetype<PredictionMarketResolved>(newMockEvent())

  predictionMarketResolvedEvent.parameters = new Array()

  predictionMarketResolvedEvent.parameters.push(
    new ethereum.EventParam(
      "matchId",
      ethereum.Value.fromUnsignedBigInt(matchId)
    )
  )
  predictionMarketResolvedEvent.parameters.push(
    new ethereum.EventParam(
      "outcome",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(outcome))
    )
  )

  return predictionMarketResolvedEvent
}
