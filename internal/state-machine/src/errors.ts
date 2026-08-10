import { Data } from "effect";

export class InvalidStateTransition<
  TState extends string = string,
  TEvent extends string = string,
> extends Data.TaggedError("InvalidStateTransition")<{
  readonly state: TState;
  readonly event: TEvent;
}> {
  override get message(): string {
    return `Invalid state transition: ${this.state} -> ${this.event}`;
  }
}

export class BlockedStateTransition<
  TState extends string = string,
  TEvent extends string = string,
> extends Data.TaggedError("BlockedStateTransition")<{
  readonly state: TState;
  readonly event: TEvent;
}> {
  override get message(): string {
    return `Blocked state transition: ${this.state} -> ${this.event}`;
  }
}

export type StateTransitionError<TState extends string = string, TEvent extends string = string> =
  | InvalidStateTransition<TState, TEvent>
  | BlockedStateTransition<TState, TEvent>;
