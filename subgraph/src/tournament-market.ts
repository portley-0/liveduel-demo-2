import {
  SharesPurchased as SharesPurchasedEvent,
  SharesSold as SharesSoldEvent,
  OddsUpdated as OddsUpdatedEvent,
  MarketResolved as MarketResolvedEvent,
  PayoutRedeemed as PayoutRedeemedEvent,
  FixtureAdded as FixtureAddedEvent,
  MatchResultRecorded as MatchResultRecordedEvent,
} from "../generated/templates/TournamentMarket/TournamentMarket";

import {
  TournamentMarket as TournamentMarketEntity,
  TournamentSharesPurchased,
  TournamentSharesSold,
  TournamentOddsUpdated,
  TournamentMarketResolved,
  TournamentPayoutRedeemed,
  TournamentFixture,
  PlatformStats 
} from "../generated/schema";

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

export function handleTournamentSharesPurchased(event: SharesPurchasedEvent): void {
  incrementTxCount(); 

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let entity = new TournamentSharesPurchased(id);

  entity.market = event.address;
  entity.buyer = event.params.buyer;
  entity.outcome = event.params.outcome;
  entity.shares = event.params.shares;
  entity.cost = event.params.cost;
  entity.timestamp = event.block.timestamp;

  entity.save();
}

export function handleTournamentSharesSold(event: SharesSoldEvent): void {
  incrementTxCount(); 

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let entity = new TournamentSharesSold(id);

  entity.market = event.address;
  entity.seller = event.params.seller;
  entity.outcome = event.params.outcome;
  entity.shares = event.params.shares;
  entity.actualGain = event.params.actualGain;
  entity.timestamp = event.block.timestamp;

  entity.save();
}

export function handleTournamentOddsUpdated(event: OddsUpdatedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let entity = new TournamentOddsUpdated(id);

  entity.market = event.address;
  entity.prices = event.params.marginalPrices;
  entity.timestamp = event.block.timestamp;

  entity.save();
}

export function handleTournamentMarketResolved(event: MarketResolvedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let entity = new TournamentMarketResolved(id);

  entity.market = event.address;
  entity.tournamentId = event.params.tournamentId;
  entity.outcome = event.params.outcome;
  entity.timestamp = event.block.timestamp;

  entity.save();

  let market = TournamentMarketEntity.load(event.address.toHex());
  if (market) {
    market.isResolved = true;
    market.resolvedOutcome = event.params.outcome;
    market.save();
  }
}

export function handleTournamentPayoutRedeemed(event: PayoutRedeemedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let entity = new TournamentPayoutRedeemed(id);

  entity.market = event.address;
  entity.tournamentId = event.params.tournamentId;
  entity.redeemer = event.params.redeemer;
  entity.outcome = event.params.outcome;
  entity.amount = event.params.amount;
  entity.timestamp = event.block.timestamp;

  entity.save();
}

export function handleFixtureAdded(event: FixtureAddedEvent): void {
  let id = event.params.tournamentId.toString() + "-" + event.params.matchId.toString();
  let entity = new TournamentFixture(id);

  entity.tournamentId = event.params.tournamentId;
  entity.matchId = event.params.matchId;
  entity.market = event.address.toHex();
  entity.isRoundFinal = event.params.isRoundFinal;
  entity.isTournamentFinal = event.params.isTournamentFinal;
  entity.resolved = false;

  entity.save();
}

export function handleMatchResultRecorded(event: MatchResultRecordedEvent): void {
  let id = event.params.tournamentId.toString() + "-" + event.params.matchId.toString();
  let entity = TournamentFixture.load(id);

  if (entity) {
    entity.resolved = true;
    entity.save();
  }
}