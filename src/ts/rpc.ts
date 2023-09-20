// Hey Emacs, this is -*- coding: utf-8 -*-

import { v4 as uuidv4 } from 'uuid';

// /b/; RPC ("Loosely JSON-RPC 2.0")
// /b/{

export const RPC_TIMEOUT_MILLISECONDS = 30 * 1000; // 30 sec

// -32000 to -32099 Server error Reserved for
// implementation-defined server-errors.

export enum RpcCodes {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

export enum RpcMessages {
  PARSE_ERROR = 'Parse error',
  INVALID_REQUEST = 'Invalid Request',
  METHOD_NOT_FOUND = 'Method not found',
  INVALID_PARAMS = 'Invalid params',
  INTERNAL_ERROR = 'Internal error',
}

export type RpcReqHead = {
  method: string;
  id: string;
};

export type RpcResResultHead = {
  type: 'ok' | 'err';
};

export type RpcResHead = {
  id: string;
  result: RpcResResultHead;
};

type IsAny<T> = 0 extends 1 & T ? true : false;
type HasUndefined<T> = undefined extends T ? true : false;

/* eslint-disable @typescript-eslint/indent */

export type RpcReq<Params> = {
  method: string;
  id: string;
} & (IsAny<Params> extends true
  ? { params: Params }
  : HasUndefined<Params> extends true
  ? { params?: Params }
  : { params: Params });

// export type RpcReq = {
//   method: string;
//   id: string;
// };

// export type RpcReqWithParams<Params> = {
//   method: string;
//   id: string;
//   params: Params;
// };

export type RpcResOkResult<Data> = {
  type: 'ok';
} & (IsAny<Data> extends true
  ? { data: Data }
  : HasUndefined<Data> extends true
  ? { data?: Data }
  : { data: Data });

export type RpcResErrResult<Data> = {
  type: 'err';
  code: number;
  message: string;
} & (IsAny<Data> extends true
  ? { data: Data }
  : HasUndefined<Data> extends true
  ? { data?: Data }
  : { data: Data });

/* eslint-disable @typescript-eslint/indent */

export type RpcResResult<DataOk, DataErr> =
  | RpcResOkResult<DataOk>
  | RpcResErrResult<DataErr>;

export interface RpcResOk<Data> {
  id: string;
  result: RpcResOkResult<Data>;
}

export interface RpcResErr<Data = undefined> {
  id: string;
  result: RpcResErrResult<Data>;
}

export interface RpcRes<DataOk, DataErr = undefined> {
  id: string;
  result: RpcResResult<DataOk, DataErr>;
}

// /b/}

export type ExtractParams<Req> = Req extends RpcReq<infer Params>
  ? Params
  : never;

export type ExtractOkData<Res> = Res extends RpcResOk<infer Data>
  ? Data
  : never;

export type ExtractErrData<Res> = Res extends RpcResErr<infer Data>
  ? Data
  : never;

export type MessageEncode<MessageType> = (message: MessageType) => Uint8Array;

export type MessageDecode<MessageType> = (data: Uint8Array) => MessageType;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OnError = (reason: any) => void;

export type Listener = (data: Uint8Array) => void;
export type Unsubscribe = (onError: OnError) => void;
export type Subscribe = (listener: Listener, onError: OnError) => Unsubscribe;

export type Publish = (data: Uint8Array, onError: OnError) => void;

export type PubSub = {
  subscribe: Subscribe;
  publish: Publish;
};

const throwReason: OnError = (reason) => {
  throw reason;
};

export class RpcCallTimeout extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    // 'Error' breaks prototype chain here
    super(message, options);
    // this.name = 'RpcCallTimeout';
    // Have to turn on --keep-names in esbuild to make new.target.name work.
    // Need to test in SWC
    this.name = new.target.name;
    // restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RpcHandlerError extends Error {
  constructor(
    public code = RpcCodes.INTERNAL_ERROR,
    public message = RpcMessages.INTERNAL_ERROR,
    public data?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RpcCallError extends Error {
  constructor(
    message: string,
    public result: RpcResResult<unknown, unknown>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type HandlerConverters = readonly [
  /* eslint-disable @typescript-eslint/no-explicit-any */
  decodeReq: (data: Uint8Array) => RpcReq<any>,
  encodeResOk: (res: RpcResOk<any>) => Uint8Array,
  encodeResErr: (res: RpcResErr<any>) => Uint8Array,
  /* eslint-enable @typescript-eslint/no-explicit-any */
];

export type RpcReqMethodHandler = [
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (params: any) => Promise<Record<string, any>>,
  converters: HandlerConverters,
];

export type RpcReqHandlers = (data: Uint8Array) => void;

type ReqMethod = string;

export const makeRpcReqHandlers = (
  rpcReqMethods: Record<ReqMethod, RpcReqMethodHandler>,
  decodeReqHead: (data: Uint8Array) => RpcReqHead,
  publish: Publish,
  onError?: OnError,
): RpcReqHandlers => {
  return (reqData: Uint8Array): void => {
    const reqHead = decodeReqHead(reqData);

    console.log('repose ******************', reqHead);

    if (rpcReqMethods[reqHead.method]) {
      const [handler, converters] = rpcReqMethods[reqHead.method];
      const [decodeReq, encodeResOk, encodeResErr] = converters;
      const req = decodeReq(reqData);
      const { params } = req;

      console.log('repose if ******************', params);

      handler(params)
        .then((dataOk) => {
          const resOk: RpcResOk<unknown> = {
            id: req.id,
            result: {
              type: 'ok',
              data: dataOk,
            },
          };

          const resOkData = encodeResOk(resOk);

          console.log('repose publish ******************', resOk);
          publish(resOkData, onError ?? throwReason);
        })
        .catch((reason) => {
          let resErr: RpcResErr<unknown>;

          if (reason instanceof RpcHandlerError) {
            const {
              code = RpcCodes.INTERNAL_ERROR,
              message = RpcMessages.INTERNAL_ERROR,
              data,
            } = reason;

            resErr = {
              id: req.id,
              result: {
                type: 'err',
                code,
                message,
                data,
              },
            };
          } else if (reason instanceof Error) {
            const { message = RpcMessages.INTERNAL_ERROR } = reason;

            resErr = {
              id: req.id,
              result: {
                type: 'err',
                code: RpcCodes.INTERNAL_ERROR,
                message,
                data: undefined,
              },
            };
          } else {
            resErr = {
              id: req.id,
              result: {
                type: 'err',
                code: RpcCodes.INTERNAL_ERROR,
                message: RpcMessages.INTERNAL_ERROR,
                data: undefined,
              },
            };
          }

          const resErrData = encodeResErr(resErr);
          publish(resErrData, onError ?? throwReason);
        });
    }
  };
};

export type CallConverters<
  Params extends object | undefined,
  DataOk extends object | undefined,
  DataErr extends object | undefined,
> = readonly [
  encodeReq: MessageEncode<RpcReq<Params>>,
  decodeResHead: MessageDecode<RpcResHead>,
  decodeResOk: MessageDecode<RpcResOk<DataOk>>,
  decodeResErr: MessageDecode<RpcResErr<DataErr>>,
];

export const makeRpcCall = <
  Params extends object | undefined,
  DataOk extends object | undefined,
  DataErr extends object | undefined = undefined,
>(
  method: string,
  converters: CallConverters<Params, DataOk, DataErr>,
  pubSub: PubSub,
  onError?: OnError,
): ((params: Params) => Promise<DataOk>) => {
  const [encodeReq, decodeResHead, decodeResOk, decodeResErr] = converters;
  const { subscribe, publish } = pubSub;

  return async (params: Params): Promise<DataOk> => {
    const req = {
      method,
      id: uuidv4(),
      params,
    } as RpcReq<Params>;

    console.log('call ******************', params);

    return new Promise<DataOk>((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout>;

      let unsubscribe: Unsubscribe;

      const listener = (resData: Uint8Array): void => {
        const resHead = decodeResHead(resData);

        console.log('call listener ******************', resHead);

        if (resHead.id === req.id) {
          clearTimeout(timeout);
          unsubscribe(onError ?? throwReason);

          if (resHead.result.type === 'ok') {
            const { result } = decodeResOk(resData);
            resolve(result.data as DataOk);
          } else {
            const { result } = decodeResErr(resData);

            const reason = new RpcCallError(
              `${method} RCP call returned error: ${result.message}`,
              result as RpcResResult<unknown, unknown>,
            );

            reject(reason);
          }
        }
      };

      unsubscribe = subscribe(listener, onError ?? throwReason);

      timeout = setTimeout(() => {
        const cause = new RpcCallTimeout(
          `${method} Redis Pub/Sub RCP call timeout`,
        );

        // this._subscriber.unsubscribe(resChannel).catch(log.report);
        unsubscribe(onError ?? throwReason);
        reject(cause);
      }, RPC_TIMEOUT_MILLISECONDS);

      publish(encodeReq(req), onError ?? throwReason);

      // this._publisher
      //   .publish(reqChannel, Buffer.from(encodeReq(req)))
      //   .catch(reject);
    });
  };
};
