import {
  SharesPurchased as SharesPurchasedEvent,
  SharesSold as SharesSoldEvent,
  OddsUpdated as OddsUpdatedEvent,
  MarketResolved as MarketResolvedEvent,
  PayoutRedeemed as PayoutRedeemedEvent
} from "../generated/templates/PredictionMarket/PredictionMarket"

import {
  SharesPurchased,
  SharesSold,
  OddsUpdated,
  MarketResolved,
  PayoutRedeemed,
  PredictionMarket
} from "../generated/schema"

export function handleSharesPurchased(event: SharesPurchasedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new SharesPurchased(id)

  entity.market = event.address
  entity.buyer = event.params.buyer
  entity.outcome = event.params.outcome    
  entity.shares = event.params.shares
  entity.actualCost = event.params.actualCost
  entity.timestamp = event.block.timestamp

  entity.save()
}

export function handleSharesSold(event: SharesSoldEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new SharesSold(id)

  entity.market = event.address
  entity.seller = event.params.seller
  entity.outcome = event.params.outcome
  entity.shares = event.params.shares
  entity.actualGain = event.params.actualGain
  entity.timestamp = event.block.timestamp

  entity.save()
}

export function handleOddsUpdated(event: OddsUpdatedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new OddsUpdated(id)

  entity.market = event.address
  entity.matchId = event.params.matchId
  entity.home = event.params.home
  entity.draw = event.params.draw
  entity.away = event.params.away
  entity.timestamp = event.block.timestamp

  entity.save()
}

export function handleMarketResolved(event: MarketResolvedEvent): void {
  let marketId = event.address.toHex()
  let pm = PredictionMarket.load(marketId)

  if (pm) {
    pm.isResolved = true
    pm.resolvedOutcome = event.params.outcome
    pm.save()
  }
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new MarketResolved(id)
  entity.market = event.address
  entity.matchId = event.params.matchId
  entity.outcome = event.params.outcome
  entity.timestamp = event.block.timestamp

  entity.save()
}

export function handlePayoutRedeemed(event: PayoutRedeemedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new PayoutRedeemed(id)

  entity.market = event.address
  entity.redeemer = event.params.redeemer
  entity.outcome = event.params.outcome
  entity.amount = event.params.amount
  entity.timestamp = event.block.timestamp

  entity.save()
}
