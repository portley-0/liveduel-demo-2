## State Transitions

The following state transition diagram illustrates the relationship between validator and delegator state. `Validator` is abbreviated as `V`, `Delegator` is abbreviated as `D`, and function names are shortened to improve readability. `Delegator.Completed` is omitted to show equivalance between the validator's initial state and the state after a delegation completes.

```mermaid
stateDiagram-v2
    % Happy path
    [*] --> V.PendingAdded : initVdrReg
    V.PendingAdded --> V.Active : completeVdrReg
    V.PendingAdded --> V.Completed : completeVdrReg (expiry passed)
    V.Active --> V.Active,D.PendingAdded : initDelReg
    V.Active,D.PendingAdded --> V.Active,D.Active : completeDelReg
    V.Active,D.Active --> V.Active,D.PendingRemoved : initEndDel
    V.Active,D.PendingRemoved --> V.Active : completeEndDel
    V.Active --> V.PendingRemoved : initEndVdr
    V.PendingRemoved --> V.Completed : completeEndVdr

    % Validator/Delegator state changes do not affect the Delegator/Validator state
    V.Active,D.PendingRemoved --> V.PendingRemoved,D.PendingRemoved : initEndVdr
    V.Active,D.PendingAdded --> V.PendingRemoved,D.PendingAdded : initEndVdr
    V.Active,D.Active --> V.PendingRemoved,D.Active: initEndVdr

    % When the Validator is in PendingRemoved or Completed, in general Delegator actions
    % may be completed, but not initiated.
    V.PendingRemoved,D.PendingAdded --> V.Completed,D.PendingAdded : completeEndVdr
    V.PendingRemoved,D.PendingRemoved --> V.Completed,D.PendingRemoved : completeEndVdr
    V.PendingRemoved,D.PendingRemoved --> V.PendingRemoved : completeEndDel
    V.PendingRemoved,D.Active --> V.Completed,D.Active : completeEndVdr
    % This is a no-op
    V.PendingRemoved,D.PendingAdded --> V.PendingRemoved,D.Active : completeDelReg
    V.Completed,D.PendingRemoved --> V.Completed : completeEndDel
    V.Completed,D.Active --> V.Completed : initEndDel
    V.Completed,D.PendingAdded --> V.Completed : completeDelReg
```
