import {
  PredictionMarketDeployed
} from "../generated/MarketFactory/MarketFactory"
import { PredictionMarket as PredictionMarketEntity } from "../generated/schema"
import { PredictionMarket } from "../generated/templates"

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
