import type { MaybePromise } from "@tooldeck/sdk-node";
import { TooldeckError } from "@tooldeck/shared";

export interface StateMachineTransitionPayload<
  TState extends string,
  TEvent extends string,
  TContext = undefined,
> {
  from: TState;
  to: TState;
  event: TEvent;
  context?: TContext;
}

export type StateMachineGuard<
  TState extends string,
  TEvent extends string,
  TContext = undefined,
> = (payload: StateMachineTransitionPayload<TState, TEvent, TContext>) => MaybePromise<boolean>;

export type StateMachineAction<
  TState extends string,
  TEvent extends string,
  TContext = undefined,
> = (payload: StateMachineTransitionPayload<TState, TEvent, TContext>) => MaybePromise<void>;

export type StateMachineTransitionHook<
  TState extends string,
  TEvent extends string,
  TContext = undefined,
> = (payload: StateMachineTransitionPayload<TState, TEvent, TContext>) => MaybePromise<void>;

export interface StateMachineTransitionDefinition<
  TState extends string,
  TEvent extends string,
  TContext = undefined,
> {
  target: TState;
  guard?: StateMachineGuard<TState, TEvent, TContext>;
  action?: StateMachineAction<TState, TEvent, TContext>;
  onTransition?: StateMachineTransitionHook<TState, TEvent, TContext>;
}

export type StateMachineTransition<
  TState extends string,
  TEvent extends string,
  TContext = undefined,
> = TState | StateMachineTransitionDefinition<TState, TEvent, TContext>;

export type StateMachineTransitionTable<
  TState extends string,
  TEvent extends string,
  TContext = undefined,
> = {
  readonly [State in TState]: Partial<
    Record<TEvent, StateMachineTransition<TState, TEvent, TContext>>
  >;
};

export interface StateMachineOptions<
  TState extends string,
  TEvent extends string,
  TContext = undefined,
> {
  initialState: TState;
  transitions: StateMachineTransitionTable<TState, TEvent, TContext>;
  invalidTransitionMessage: string;
  blockedTransitionMessage?: string;
  onTransition?: StateMachineTransitionHook<TState, TEvent, TContext>;
}

export class StateMachine<TState extends string, TEvent extends string, TContext = undefined> {
  private currentState: TState;
  private readonly transitions: StateMachineTransitionTable<TState, TEvent, TContext>;
  private readonly invalidTransitionMessage: string;
  private readonly blockedTransitionMessage: string;
  private readonly onTransition?: StateMachineTransitionHook<TState, TEvent, TContext>;

  constructor(options: StateMachineOptions<TState, TEvent, TContext>) {
    this.currentState = options.initialState;
    this.transitions = options.transitions;
    this.invalidTransitionMessage = options.invalidTransitionMessage;
    this.blockedTransitionMessage = options.blockedTransitionMessage ?? "State transition blocked";
    this.onTransition = options.onTransition;
  }

  get state(): TState {
    return this.currentState;
  }

  canDispatch(event: TEvent, context?: TContext): boolean {
    const definition = this.getTransitionDefinition(this.currentState, event);

    if (!definition) {
      return false;
    }

    const payload = this.createPayload(this.currentState, event, definition.target, context);
    const guardResult = definition.guard?.(payload);

    return this.expectSync(
      guardResult ?? true,
      "Async state machine guard requires canDispatchAsync",
    );
  }

  async canDispatchAsync(event: TEvent, context?: TContext): Promise<boolean> {
    const definition = this.getTransitionDefinition(this.currentState, event);

    if (!definition) {
      return false;
    }

    const payload = this.createPayload(this.currentState, event, definition.target, context);

    return (await definition.guard?.(payload)) ?? true;
  }

  dispatch(event: TEvent, context?: TContext): TState {
    const from = this.currentState;
    const definition = this.getTransitionDefinition(from, event);

    if (!definition) {
      throw new TooldeckError({
        code: "ERR_INVALID_ARGUMENT",
        message: `${this.invalidTransitionMessage}: ${from} -> ${event}`,
        details: {
          state: from,
          event,
        },
      });
    }

    const payload = this.createPayload(from, event, definition.target, context);
    const guardResult = definition.guard?.(payload);

    if (!this.expectSync(guardResult ?? true, "Async state machine guard requires dispatchAsync")) {
      throw new TooldeckError({
        code: "ERR_INVALID_ARGUMENT",
        message: `${this.blockedTransitionMessage}: ${from} -> ${event}`,
        details: {
          state: from,
          event,
        },
      });
    }

    this.currentState = definition.target;
    this.expectSync(
      definition.action?.(payload),
      "Async state machine action requires dispatchAsync",
    );
    this.expectSync(
      definition.onTransition?.(payload),
      "Async state machine transition hook requires dispatchAsync",
    );
    this.expectSync(
      this.onTransition?.(payload),
      "Async state machine transition hook requires dispatchAsync",
    );

    return this.currentState;
  }

  async dispatchAsync(event: TEvent, context?: TContext): Promise<TState> {
    const from = this.currentState;
    const definition = this.getTransitionDefinition(from, event);

    if (!definition) {
      throw new TooldeckError({
        code: "ERR_INVALID_ARGUMENT",
        message: `${this.invalidTransitionMessage}: ${from} -> ${event}`,
        details: {
          state: from,
          event,
        },
      });
    }

    const payload = this.createPayload(from, event, definition.target, context);

    if (definition.guard && !(await definition.guard(payload))) {
      throw new TooldeckError({
        code: "ERR_INVALID_ARGUMENT",
        message: `${this.blockedTransitionMessage}: ${from} -> ${event}`,
        details: {
          state: from,
          event,
        },
      });
    }

    this.currentState = definition.target;
    await definition.action?.(payload);
    await definition.onTransition?.(payload);
    await this.onTransition?.(payload);

    return this.currentState;
  }

  private getTransitionDefinition(
    state: TState,
    event: TEvent,
  ): StateMachineTransitionDefinition<TState, TEvent, TContext> | undefined {
    const transition = this.transitions[state][event];

    if (!transition) {
      return undefined;
    }

    if (typeof transition === "string") {
      return {
        target: transition as TState,
      };
    }

    return transition;
  }

  private createPayload(
    from: TState,
    event: TEvent,
    to: TState,
    context?: TContext,
  ): StateMachineTransitionPayload<TState, TEvent, TContext> {
    return {
      from,
      to,
      event,
      context,
    };
  }

  private expectSync<T>(value: MaybePromise<T>, message: string): T {
    if (isPromiseLike(value)) {
      throw new TooldeckError({
        code: "ERR_INVALID_ARGUMENT",
        message,
      });
    }

    return value;
  }
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return typeof value === "object" && value !== null && "then" in value;
}
