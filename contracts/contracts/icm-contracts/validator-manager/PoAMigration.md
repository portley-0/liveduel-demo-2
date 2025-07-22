# Migrating from PoA to PoS

The Validator Manager contracts support migrating from a Proof-of-Authority security mechanism to Proof-of-Stake after the initial deployment. The contracts implement a "hard migration" from PoA to PoS at the point of migration, at which time existing PoA validators lose any special privileges.

## Migration Guide

Migrating from PoA to PoS consists of the following steps:

### 1. Deploy `PoAManager`.
The `PoAManager` is deployed as a standalone contract, separate from the `ValidatorManager`. During deployment, the address of the `ValidatorManager` is provided as a constructor argument to the `PoAManager`, which then delegates relevant calls to the underlying `ValidatorManager`.

- The **owner of the `PoAManager`** manages the validator set by invoking:
    - `initiateValidatorRegistration`
    - `initiateValidatorRemoval`
    - `initiateValidatorWeightUpdate`
    - `transferUnderlyingValidatorManagerOwnership`

- The following functions are **permissionless** and may be called by anyone:
    - `completeValidatorRegistration`
    - `completeValidatorRemoval`
    - `completeValidatorWeightUpdate`

After the `PoAManager` is deployed, the desired PoA validators may be registered. See [below](#selecting-weights) for details on how to select the PoA validator weights.

### 2. Deploy `StakingManager`.

The `StakingManager` is deployed as a standlone contract, separate from `ValidatorManager`. The `ValidatorManager` is provided as a constructor argument to the `StakingManager`, however they will not be able to interact until step 3 below is completed.

The `StakingManager` constructor also takes as an argument the `weightToValueFactor` used to convert between the value of the staked asset and the corresponding validator weight. See [below](#selecting-weights) for details on how to select this factor.

### 3. Transfer ownership of `ValidatorManager` to the `StakingManager`'s address.

Ownership of the underlying `ValidatorManager` can be transferred from the `PoAManager` to the `StakingManager` by calling `transferValidatorManagerOwnership` on the `PoAManager` from the `PoAManager`'s owner. Once this is done, the `StakingManager` may update the L1's validator set via the `ValidatorManager`.

### 4. Remove PoA validators in stages.

Once ownership is transferred, PoA validators may be removed by *anyone* as long as churn limits are not violated, which are in place to mitigate against catastrophic consensus failure.

#### Permissionless Removal of PoA Validators

Existing PoA validators can be removed by anybody, whereas PoS validators can only be removed by the validator owner. This is done in order to enable a sharp, step transition from PoS to PoA in which PoA validators are expected to be removed quickly, so long as churn limits aren't violated.

To better understand this design choice, consider an alternative implementation in which only the former PoA `admin` is able to remove PoA validators. If the PoA validator becomes inactive but remains in the validator set, then their validator weight would persist, potentially causing stability issues on the L1. The L1 would require action on the part of the `admin`, who contrary to a PoS validator, does not have any staked value in bond.

On the flip side, the current approach allows a fast-acting bad actor with sufficient access to the staking asset to register themselves as a validator then remove each of the PoA validators in turn. This can be mitigated by controlling the supply of the staking asset around migration time, tuned to the selected `weightToValueFactor` (see [below](#selecting-weights)).

## Selecting Weights

When migrating from PoA to PoS, the ratio between the total weight of the PoA validator set and the the total *available* weight that is stakeable by PoS validators (i.e. the supply of the staking asset) is critical. The higher this ratio, the slower the effective transition to a fully PoS model will be. This is due to churn limits, which have a ceiling of 20% validator weight change within a given configurable churn period. For example, if an L1 consists of 5 PoA validators each with weight 100, at most `5 * 100 * 20% = 100` of validator weight may be changed in a single period. That may correspond to the removal of a single PoA validator, or the addition of 100 weight's worth of PoS validators, but not both.

> Note: Since PoA validators may be removed by [anyone](#permissionless-removal-of-poa-validators), in practice only the weight of the smallest PoA validator is relevant to the PoA to PoS weight ratio. Following the same math as above, in order to remove the final PoA validator, the total weight of the PoS validators must be at least 4x the PoA validator's weight.

To implement the desired PoA to PoS transition dynamics, this ratio should be tuned against the PoA validator set's weight **ahead of migration**. This should be done by carefully selecting the PoA validator's initial weights, and the `weightToValueFactor` such that the equivalent weight of the total supply of the staked asset is in the desired ratio to the PoA validator set's weight. The PoA validator weights may also be changed ahead of migration, though the rate of weight change is limited by churn restrictions. After migration, PoA validator weights may not be changed.

Extending our above example of 5 PoA validators each with weight 100, suppose the total supply of the staking asset at migration time is `1000`, and `weightToValueFactor=10`. Then, the maximum PoS weight available is `1000/10 = 100`, yielding a PoA to PoS weight ratio of 5 to 1.