import {
    SharesPurchased as SharesPurchasedEvent,
    SharesSold as SharesSoldEvent,
    OddsUpdated as OddsUpdatedEvent,
    MarketResolved as MarketResolvedEvent,
    PayoutRedeemed as PayoutRedeemedEvent
  } from "../generated/templates/TournamentMarket/TournamentMarket"
  
  import {
    TournamentMarket as TournamentMarketEntity,
    TournamentSharesPurchased,
    TournamentSharesSold,
    TournamentOddsUpdated,
    TournamentMarketResolved,
    TournamentPayoutRedeemed
  } from "../generated/schema"
  
  export function handleTournamentSharesPurchased(event: SharesPurchasedEvent): void {
    let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
    let entity = new TournamentSharesPurchased(id)
  
    entity.market = event.address
    entity.buyer = event.params.buyer
    entity.outcome = event.params.outcome
    entity.shares = event.params.shares
    entity.cost = event.params.cost
    entity.timestamp = event.block.timestamp
  
    entity.save()
  }
  
  export function handleTournamentSharesSold(event: SharesSoldEvent): void {
    let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
    let entity = new TournamentSharesSold(id)
  
    entity.market = event.address
    entity.seller = event.params.seller
    entity.outcome = event.params.outcome
    entity.shares = event.params.shares
    entity.actualGain = event.params.actualGain
    entity.timestamp = event.block.timestamp
  
    entity.save()
  }
  
  export function handleTournamentOddsUpdated(event: OddsUpdatedEvent): void {
    let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
    let entity = new TournamentOddsUpdated(id)
  
    entity.market = event.address
    entity.prices = event.params.marginalPrices
    entity.timestamp = event.block.timestamp
  
    entity.save()
  }
  
  export function handleTournamentMarketResolved(event: MarketResolvedEvent): void {
    let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
    let entity = new TournamentMarketResolved(id)
  
    entity.market = event.address
    entity.tournamentId = event.params.tournamentId
    entity.outcome = event.params.outcome
    entity.timestamp = event.block.timestamp
  
    entity.save()
  
    let market = TournamentMarketEntity.load(event.address.toHex())
    if (market) {
      market.isResolved = true
      market.resolvedOutcome = event.params.outcome
      market.save()
    }
  }
  
  export function handleTournamentPayoutRedeemed(event: PayoutRedeemedEvent): void {
    let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
    let entity = new TournamentPayoutRedeemed(id)
  
    entity.market = event.address
    entity.tournamentId = event.params.tournamentId
    entity.redeemer = event.params.redeemer
    entity.outcome = event.params.outcome
    entity.amount = event.params.amount
    entity.timestamp = event.block.timestamp
  
    entity.save()
  }
  