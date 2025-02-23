import {
  OwnershipTransferred as OwnershipTransferredEvent,
  PlatformProfitAdded as PlatformProfitAddedEvent,
  PredictionMarketDeployed as PredictionMarketDeployedEvent,
  PredictionMarketResolved as PredictionMarketResolvedEvent
} from "../generated/MarketFactory/MarketFactory"
import {
  OwnershipTransferred,
  PlatformProfitAdded,
  PredictionMarketDeployed,
  PredictionMarketResolved
} from "../generated/schema"

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlatformProfitAdded(
  event: PlatformProfitAddedEvent
): void {
  let entity = new PlatformProfitAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePredictionMarketDeployed(
  event: PredictionMarketDeployedEvent
): void {
  let entity = new PredictionMarketDeployed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.matchId = event.params.matchId
  entity.marketAddress = event.params.marketAddress
  entity.matchTimestamp = event.params.matchTimestamp

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePredictionMarketResolved(
  event: PredictionMarketResolvedEvent
): void {
  let entity = new PredictionMarketResolved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.matchId = event.params.matchId
  entity.outcome = event.params.outcome

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
