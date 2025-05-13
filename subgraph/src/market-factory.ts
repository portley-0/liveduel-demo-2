import {
  PredictionMarketDeployed,
  TournamentDeployed
} from "../generated/MarketFactory/MarketFactory"

import {
  PredictionMarket as PredictionMarketEntity,
  TournamentMarket as TournamentMarketEntity
} from "../generated/schema"

import {
  PredictionMarket,
  TournamentMarket
} from "../generated/templates"

import { TournamentMarket as TournamentMarketContract } from "../generated/MarketFactory/TournamentMarket"

export function handlePredictionMarketDeployed(event: PredictionMarketDeployed): void {
  let matchId = event.params.matchId
  let marketAddress = event.params.marketAddress
  let matchTimestamp = event.params.matchTimestamp

  let entity = new PredictionMarketEntity(marketAddress.toHexString())
  entity.matchId = matchId
  entity.matchTimestamp = matchTimestamp
  entity.isResolved = false
  entity.save()

  PredictionMarket.create(marketAddress)
}

export function handleTournamentDeployed(event: TournamentDeployed): void {
  let tournamentId = event.params.tournamentId
  let marketAddress = event.params.marketAddress

  let contract = TournamentMarketContract.bind(marketAddress)
  let totalTeamsResult = contract.try_getTotalTeams()
  let totalTeams = totalTeamsResult.reverted ? 0 : totalTeamsResult.value.toI32()

  let entity = new TournamentMarketEntity(marketAddress.toHexString())
  entity.tournamentId = tournamentId
  entity.totalTeams = totalTeams
  entity.isResolved = false
  entity.save()

  TournamentMarket.create(marketAddress)
}
