import {
  SharesPurchased as SharesPurchasedEvent,
  SharesSold as SharesSoldEvent,
  TradeExecuted as TradeExecutedEvent,
  OddsUpdated as OddsUpdatedEvent,
  MarketResolved as MarketResolvedEvent,
  PayoutRedeemed as PayoutRedeemedEvent
} from "../generated/templates/PredictionMarket/PredictionMarket"

import {
  SharesPurchased,
  SharesSold,
  TradeExecuted,
  OddsUpdated,
  MarketResolved,
  PayoutRedeemed,
  PredictionMarket,
  PlatformStats 
} from "../generated/schema"

import { BigInt } from "@graphprotocol/graph-ts";

function incrementTxCount(): void {
  const STATS_ID = "platform-stats";
  let stats = PlatformStats.load(STATS_ID);
  if (!stats) {
    stats = new PlatformStats(STATS_ID);
    stats.totalTxs = BigInt.fromI32(0);
  }
  stats.totalTxs = stats.totalTxs.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleTradeExecuted(event: TradeExecutedEvent): void {
  incrementTxCount(); 

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new TradeExecuted(id)

  entity.market = event.address
  entity.user = event.params.user
  entity.tradeAmounts = event.params.tradeAmounts
  entity.netCostOrGain = event.params.netCostOrGain
  entity.timestamp = event.block.timestamp

  entity.save()
}

export function handleSharesPurchased(event: SharesPurchasedEvent): void {
  incrementTxCount(); 

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
  incrementTxCount(); 

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