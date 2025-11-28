import { Room } from "./Room";
import { generateClientId } from "./utils/nameGenerator";
import type {
  OfferMessage,
  OfferOrAnswerData,
  RoleAssignmentMessage,
  SignalingMessage,
} from "../frontend/src/types";
import type { Client } from "./Client";

export interface WebSocketHandlerCallbacks {
  onSave: () => Promise<void>;
  onBroadcast: (
    signalingMessage: SignalingMessage,
    excludeClientId: string,
  ) => void;
}

export class WebSocketHandler {
  private socket: WebSocket;
  private room: Room;
  private callbacks: WebSocketHandlerCallbacks;
  private clientId: string;
  private client: Client;

  constructor(
    room: Room,
    socket: WebSocket,
    callbacks: WebSocketHandlerCallbacks,
    existingClientId?: string,
  ) {
    this.room = room;
    this.socket = socket;
    this.callbacks = callbacks;
    if (existingClientId) {
      this.clientId = existingClientId;
    } else {
      this.clientId = generateClientId();
    }
    this.client = this.room.addClient(this.clientId);
  }

  /**
   * Initializes the client logic (adds to room if needed, sends initial roles/offers).
   * Does NOT accept the socket or bind event listeners (handled by DO native API).
   */
  public handleConnection(): void {
    // Send role assignment
    this.send({
      type: "role",
      data: {
        role: this.client.role,
        clientId: this.clientId,
        roomId: this.room.roomId,
      },
    } satisfies RoleAssignmentMessage);

    // If answerer, send existing offer if it exists
    if (this.client.role === "answerer" && this.room.offer) {
      this.send({
        type: "offer",
        data: this.room.offer,
      } satisfies OfferMessage);
    }
  }

  public async onMessage(messageString: string): Promise<void> {
    const message = JSON.parse(messageString) as SignalingMessage;

    if (message.type === "offer" && this.client.role === "offerer") {
      await this.addOffer(message.data);
      this.callbacks.onBroadcast(message, this.clientId);
    }

    if (message.type === "answer" && this.client.role === "answerer") {
      await this.addAnswer(message.data);
      this.callbacks.onBroadcast(message, this.clientId);
    }
  }

  private addAnswer(answer: OfferOrAnswerData): Promise<void> {
    this.room.addAnswer(answer);
    return this.callbacks.onSave();
  }

  private addOffer(offer: OfferOrAnswerData): Promise<void> {
    this.room.addOffer(offer);
    return this.callbacks.onSave();
  }

  public send(msg: SignalingMessage): void {
    this.socket.send(JSON.stringify(msg));
  }

  public getClientId(): string {
    return this.clientId;
  }
}
