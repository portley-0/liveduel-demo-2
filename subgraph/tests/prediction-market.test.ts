import { test, assert, clearStore, newMockEvent } from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { handleSharesPurchased } from "../src/prediction-market"
import { SharesPurchased as SharesPurchasedEvent } from "../generated/templates/PredictionMarket/PredictionMarket"

function createSharesPurchasedEvent(
	buyer: string,
	outcome: i32,
	shares: BigInt,
	actualCost: BigInt
): SharesPurchasedEvent {
	let mock = newMockEvent()
	let event = changetype<SharesPurchasedEvent>(mock)
	event.parameters = [
		new ethereum.EventParam("buyer", ethereum.Value.fromAddress(Address.fromString(buyer))),
		new ethereum.EventParam("outcome", ethereum.Value.fromI32(outcome)),
		new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares)),
		new ethereum.EventParam("actualCost", ethereum.Value.fromSignedBigInt(actualCost))
	]
	return event
}

test("handleSharesPurchased creates a SharesPurchased entity", () => {
	let event = createSharesPurchasedEvent(
		"0x0000000000000000000000000000000000001234",
		1,
		BigInt.fromI32(1000),
		BigInt.fromI32(500)
	)
	handleSharesPurchased(event)
	let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
	assert.fieldEquals("SharesPurchased", id, "buyer", "0x0000000000000000000000000000000000001234")
	assert.fieldEquals("SharesPurchased", id, "outcome", "1")
	assert.fieldEquals("SharesPurchased", id, "shares", "1000")
	assert.fieldEquals("SharesPurchased", id, "actualCost", "500")
	clearStore()
})
