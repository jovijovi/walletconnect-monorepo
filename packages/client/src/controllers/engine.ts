import {
  formatJsonRpcRequest,
  isJsonRpcRequest,
  isJsonRpcResponse,
  JsonRpcRequest,
  JsonRpcResponse,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, toMiliseconds } from "@walletconnect/time";
import {
  EngineTypes,
  IEngine,
  RelayerTypes,
  EnginePrivate,
  SessionTypes,
} from "@walletconnect/types";
import {
  calcExpiry,
  formatUri,
  generateRandomBytes32,
  parseUri,
  ERROR,
} from "@walletconnect/utils";
import { RELAYER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "../constants";

export default class Engine extends IEngine {
  private proposalResolve?: (value?: void | PromiseLike<void> | undefined) => void;
  private proposalReject?: (reason?: any) => void;

  constructor(
    history: IEngine["history"],
    protocol: IEngine["protocol"],
    version: IEngine["version"],
    relayer: IEngine["relayer"],
    crypto: IEngine["crypto"],
    session: IEngine["session"],
    pairing: IEngine["pairing"],
    proposal: IEngine["proposal"],
    metadata: IEngine["metadata"],
  ) {
    super(history, protocol, version, relayer, crypto, session, pairing, proposal, metadata);
    this.registerRelayerEvents();
    this.registerExpirerEvents();
  }

  // ---------- Public ------------------------------------------------ //

  public createSession: IEngine["createSession"] = async params => {
    // TODO(ilja) validate params

    const { pairingTopic, methods, events, chains, relays } = params;
    let topic = pairingTopic;
    let uri: string | undefined = undefined;
    let active = true;

    if (topic) {
      const pairing = await this.pairing.get(topic);
      active = pairing.active;
    }

    if (!topic || !active) {
      const { newTopic, newUri } = await this.createPairing();
      topic = newTopic;
      uri = newUri;
    }

    const publicKey = await this.crypto.generateKeyPair();
    const proposal = {
      methods: methods ?? [],
      events: events ?? [],
      chains: chains ?? [],
      relays: relays ?? [{ protocol: RELAYER_DEFAULT_PROTOCOL }],
      proposer: {
        publicKey,
        metadata: this.metadata,
      },
    };

    await this.proposal.set(publicKey, proposal);
    await this.sendRequest(topic, "wc_sessionPropose", proposal);

    const timeout = toMiliseconds(FIVE_MINUTES);
    const context = this.proposal.name;

    const approval = new Promise<void>(async (resolve, reject) => {
      setTimeout(() => {
        reject(ERROR.SETTLE_TIMEOUT.format({ context, timeout }));
      }, timeout);

      // store resolve / reject alongside topic / id

      this.proposalResolve = resolve;
      this.proposalReject = reject;
    });

    return { uri, approval };
  };

  public pair: IEngine["pair"] = async params => {
    // TODO(ilja) validate pairing Uri
    const { topic, symKey, relay } = parseUri(params.uri);
    this.crypto.setPairingKey(symKey, topic);
    // TODO(ilja) this.pairing.set(topic, params)
    // TODO(ilja) this.expirer ?
    this.relayer.subscribe(topic, { relay });
  };

  public approve: IEngine["approve"] = async () => {
    // TODO
    return {} as SessionTypes.Struct;
  };

  public reject: IEngine["reject"] = async () => {
    // TODO
  };

  public updateAccounts: IEngine["updateAccounts"] = async () => {
    // TODO
  };

  public updateMethods: IEngine["updateMethods"] = async () => {
    // TODO
  };

  public updateEvents: IEngine["updateEvents"] = async () => {
    // TODO
  };

  public updateExpiry: IEngine["updateExpiry"] = async () => {
    // TODO
  };

  public request: IEngine["request"] = async () => {
    // TODO
  };

  public respond: IEngine["respond"] = async () => {
    // TODO
  };

  public ping: IEngine["ping"] = async () => {
    // TODO
  };

  public emit: IEngine["emit"] = async () => {
    // TODO
  };

  public disconnect: IEngine["disconnect"] = async () => {
    // TODO
  };

  // ---------- Private ----------------------------------------------- //

  private async createPairing() {
    const symKey = generateRandomBytes32();
    const topic = await this.crypto.setPairingKey(symKey);
    const expiry = calcExpiry(FIVE_MINUTES);
    const relay = { protocol: RELAYER_DEFAULT_PROTOCOL };
    const pairing = { topic, expiry, relay, active: true };
    const uri = formatUri({ protocol: this.protocol, version: this.version, topic, symKey, relay });
    await this.pairing.set(topic, pairing);
    await this.relayer.subscribe(topic);
    // TODO(ilja) this.expirer ?

    return { newTopic: topic, newUri: uri };
  }

  private sendRequest: EnginePrivate["sendRequest"] = async (topic, method, params) => {
    // TODO(ilja) validate method

    const request = formatJsonRpcRequest(method, params);
    const message = await this.crypto.encode(topic, request);
    await this.relayer.publish(topic, message);

    if (method === "wc_sessionRequest") {
      await this.history.set(topic, request);
    }
  };

  private sendResponse: EnginePrivate["sendResponse"] = async () => {
    // TODO(ilja) encode payload
    // TODO(ilja) publish request to relay
    // TODO(ilja) this.history.resolve()
  };

  // ---------- Relay Events ------------------------------------------- //

  private registerRelayerEvents() {
    this.relayer.on(RELAYER_EVENTS.message, async (event: RelayerTypes.MessageEvent) => {
      const { topic, message } = event;
      const payload = await this.crypto.decode(topic, message);
      if (isJsonRpcRequest(payload)) {
        this.onRelayEventRequest({ topic, payload });
      } else if (isJsonRpcResponse(payload)) {
        this.onRelayEventResponse({ topic, payload });
      }
    });
  }

  private onRelayEventRequest(event: EngineTypes.EventCallback<JsonRpcRequest>) {
    const { topic, payload } = event;
    if (this.pairing.topics.includes(topic)) {
      // onSessionProposeRequest
      // onPairingDeleteRequest
      // onPairingPingRequest
    } else if (this.session.topics.includes(topic)) {
      // onSessionSettleRequest
      // onSessionUpdateAccountsRequest
      // onSessionUpdateMethodsRequest
      // onSessionUpdateEventsRequest
      // onSessionUpdateExpiryRequest
      // onSessionDeleteRequest
      // onSessionPingRequest
      // onSessionRequest
      // onSessionEventRequest
    }
  }

  private onRelayEventResponse(event: EngineTypes.EventCallback<JsonRpcResponse>) {
    const { topic, payload } = event;
    if (this.pairing.topics.includes(topic)) {
      // onSessionProposeResponse
      // onPairingDeleteResponse
      // onPairingPingResponse
    } else if (this.session.topics.includes(topic)) {
      // onSessionSettleResponse
      // onSessionUpdateAccountsResponse
      // onSessionUpdateMethodsResponse
      // onSessionUpdateEventsResponse
      // onSessionUpdateExpiryResponse
      // onSessionDeleteResponse
      // onSessionPingResponse
      // onSessionRequestResponse
      // onSessionEventResponse
    }
  }

  // ---------- Relay Events Handlers ---------------------------------- //

  private async onSessionProposeResponse() {
    // TODO(ilja) call this.proposalResolve or this.proposalReject
  }

  // ---------- Expirer Events ----------------------------------------- //

  private registerExpirerEvents() {
    // TODO
  }
}
