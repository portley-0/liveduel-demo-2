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
import { BigInt } from "@graphprotocol/graph-ts"

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

  let teamIds: BigInt[] = []
  for (let i = 0; i < totalTeams; i++) {
    let teamIdResult = contract.try_teamIds(BigInt.fromI32(i))
    if (!teamIdResult.reverted) {
      teamIds.push(teamIdResult.value)
    }
  }

  let entity = new TournamentMarketEntity(marketAddress.toHexString())
  entity.tournamentId = tournamentId
  entity.totalTeams = totalTeams
  entity.isResolved = false
  entity.teamIds = teamIds
  entity.save()

  TournamentMarket.create(marketAddress)
}