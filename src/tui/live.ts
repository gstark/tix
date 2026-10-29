import { ConvexClient } from "convex/browser";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { getFunctionName } from "convex/server";
import { useMemo, useSyncExternalStore } from "react";
import { toTixError } from "../client.ts";
import type { Config } from "../config.ts";

type Query = FunctionReference<"query">;
type Mutation = FunctionReference<"mutation">;
type Args<F extends Query | Mutation> = Omit<FunctionArgs<F>, "token">;

export type Snapshot<T> = { data: T | undefined; error: string | null };

type Store<T> = { subscribe: (listener: () => void) => () => void; get: () => Snapshot<T> };

/**
 * A websocket connection to Convex. Each query is a live subscription: Convex
 * pushes a new result when any task changes, so the board shows agent work as
 * it happens.
 */
export class Live {
  private client: ConvexClient;
  private url: string;
  private token: string;

  constructor(config: Config) {
    this.url = config.convexUrl;
    this.token = config.token;
    this.client = new ConvexClient(config.convexUrl, { logger: false });
  }

  private withToken<F extends Query | Mutation>(args: Args<F>): FunctionArgs<F> {
    // The args type of every tix function is its own fields and the token.
    return { ...args, token: this.token } as FunctionArgs<F>;
  }

  /** A store for one query. It subscribes when React first listens. */
  store<Q extends Query>(query: Q, args: Args<Q>): Store<FunctionReturnType<Q>> {
    let snapshot: Snapshot<FunctionReturnType<Q>> = { data: undefined, error: null };
    return {
      get: () => snapshot,
      subscribe: (listener) => {
        const unsubscribe = this.client.onUpdate(
          query,
          this.withToken<Q>(args),
          (data) => {
            snapshot = { data, error: null };
            listener();
          },
          (error) => {
            const tix = toTixError(error, this.url);
            snapshot = { data: snapshot.data, error: tix instanceof Error ? tix.message : String(tix) };
            listener();
          },
        );
        return () => unsubscribe();
      },
    };
  }

  connection(): Store<boolean> {
    const get = () => this.client.connectionState().isWebSocketConnected;
    let snapshot: Snapshot<boolean> = { data: get(), error: null };
    return {
      get: () => snapshot,
      subscribe: (listener) =>
        this.client.subscribeToConnectionState((state) => {
          snapshot = { data: state.isWebSocketConnected, error: null };
          listener();
        }),
    };
  }

  async mutate<M extends Mutation>(mutation: M, args: Args<M>): Promise<FunctionReturnType<M>> {
    try {
      return await this.client.mutation(mutation, this.withToken<M>(args));
    } catch (error) {
      throw toTixError(error, this.url);
    }
  }

  close(): Promise<void> {
    return this.client.close();
  }
}

/** Reads a live query. `args` null skips the query. */
export function useLive<Q extends Query>(live: Live, query: Q, args: Args<Q> | null): Snapshot<FunctionReturnType<Q>> {
  // Each read of `api.x.y` gives a new proxy, so the key uses the function name and the args.
  const key = args === null ? null : `${getFunctionName(query)} ${JSON.stringify(args)}`;
  const store = useMemo(() => (args === null ? null : live.store(query, args)), [live, key]);
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.get ?? emptySnapshot);
}

export function useConnected(live: Live): boolean {
  const store = useMemo(() => live.connection(), [live]);
  return useSyncExternalStore(store.subscribe, store.get).data === true;
}

const EMPTY: Snapshot<never> = { data: undefined, error: null };
const emptySnapshot = () => EMPTY;
const noSubscribe = () => () => {};
