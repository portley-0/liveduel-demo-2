import { SharesPurchased, SharesSold, OddsUpdated } from "../generated/templates/PredictionMarket/PredictionMarket"
import { SharesPurchased as SharesPurchasedEntity, SharesSold as SharesSoldEntity, OddsUpdated as OddsUpdatedEntity } from "../generated/schema"

export function handleSharesPurchased(event: SharesPurchased): void {
  let entity = new SharesPurchasedEntity(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  entity.market = event.address
  entity.buyer = event.params.buyer
  entity.outcome = event.params.outcome
  entity.shares = event.params.shares
  entity.actualCost = event.params.actualCost
  entity.timestamp = event.block.timestamp
  entity.save()
}

export function handleSharesSold(event: SharesSold): void {
  let entity = new SharesSoldEntity(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  entity.market = event.address
  entity.seller = event.params.seller
  entity.outcome = event.params.outcome
  entity.shares = event.params.shares
  entity.actualGain = event.params.actualGain
  entity.timestamp = event.block.timestamp
  entity.save()
}

export function handleOddsUpdated(event: OddsUpdated): void {
  let entity = new OddsUpdatedEntity(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  entity.market = event.address
  entity.matchId = event.params.matchId
  entity.home = event.params.home.toBigDecimal()
  entity.draw = event.params.draw.toBigDecimal()
  entity.away = event.params.away.toBigDecimal()
  entity.timestamp = event.block.timestamp
  entity.save()
}
