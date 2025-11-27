import { Room } from "./Room";
import { generateClientId } from "./utils/nameGenerator";
import type { OfferMessage, OfferOrAnswerData, RoleAssignmentMessage, SignalingMessage } from "../frontend/src/types";
import type { Client } from "./Client";

export interface WebSocketHandlerCallbacks {
  onSave: () => Promise<void>;
  onBroadcast: (signalingMessage: SignalingMessage, excludeClientId: string) => void;
  onClose: (clientId: string) => boolean;
}

export class WebSocketHandler {
  private socket: WebSocket;
  private room: Room;
  private callbacks: WebSocketHandlerCallbacks;
  private client: Client;

  constructor(room: Room, socket: WebSocket, callbacks: WebSocketHandlerCallbacks) {
    this.room = room;
    this.socket = socket;
    this.callbacks = callbacks;
  }

  public async handleConnection(): Promise<void> {
    this.socket.accept();

    this.socket.addEventListener("message", (messageEvent: MessageEvent) => this.onMessage(messageEvent));
    this.socket.addEventListener("close", () => this.onClose());
    this.socket.addEventListener("error", (error: ErrorEvent) => this.onError(error));

    this.client = await this.addClient();

    // Send role assignment
    this.send({
      type: "role",
      data: { role: this.client.role, clientId: this.client.clientId, roomId: this.room.roomId },
    } satisfies RoleAssignmentMessage);

    // If answerer, send existing offer if it exists
    // else the client will wait for the offerer to send an offer
    if (this.client.role === "answerer" && this.room.offer) {
      this.send({
        type: "offer",
        data: this.room.offer,
      } satisfies OfferMessage);
    }
  }

  private async onMessage(messageEvent: MessageEvent): Promise<void> {
    const message = JSON.parse(messageEvent.data as string) as SignalingMessage;

    const client = this.room.getClient(this.client.clientId);
    if (!client) {
      throw new Error(`Client ${this.client.clientId} not found`);
    }

    if (message.type === "offer" && client.role === "offerer") {
      await this.addOffer(message.data);
      this.callbacks.onBroadcast(message, this.client.clientId);
    }

    if (message.type === "answer" && client.role === "answerer") {
      await this.addAnswer(message.data);
      this.callbacks.onBroadcast(message, this.client.clientId);
    }
  }

  private onError(error: ErrorEvent): void {
    console.error("Error occurred", error);
    this.onClose();
  }

  private async onClose(): Promise<boolean> {
    await this.removeClient();
    return this.callbacks.onClose(this.client.clientId);
  }

  private async removeClient(): Promise<void> {
    this.room.removeClient(this.client.clientId);
    return this.callbacks.onSave();
  }
  private async addClient(): Promise<Client> {
    this.client = this.room.addClient(generateClientId());
    await this.callbacks.onSave();
    return this.client;
  }
  private async addAnswer(answer: OfferOrAnswerData): Promise<void> {
    this.room.addAnswer(answer);
    return this.callbacks.onSave();
  }
  private async addOffer(offer: OfferOrAnswerData): Promise<void> {
    this.room.addOffer(offer);
    return this.callbacks.onSave();
  }

  public send(msg: SignalingMessage): void {
    this.socket.send(JSON.stringify(msg));
  }

  public getClientId(): string {
    return this.client.clientId;
  }
}
