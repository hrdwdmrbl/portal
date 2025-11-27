import { Room } from "./Room";
import { generateClientId } from "./utils/nameGenerator";
import { Storage } from "./storage/types";
import type { AnswerMessage, OfferMessage, RoleAssignmentMessage, SignalingMessage } from "../frontend/src/types";

export class WebSocketHandler {
  private storage: Storage;
  private socket: WebSocket;
  private roomId: string;
  private clientId: string;
  private pollInterval: number | null = null;

  constructor(storage: Storage, socket: WebSocket, roomId: string) {
    this.storage = storage;
    this.socket = socket;
    this.roomId = roomId;
    this.clientId = generateClientId();
  }

  public async handleConnection(): Promise<void> {
    this.socket.accept();

    // Get or create room
    const roomState = await this.storage.get<string>(this.roomId);
    const room = new Room(this.roomId, roomState);
    const client = room.addClient(this.clientId);
    await this.storage.put(this.roomId, room.toJSON());

    // Send role assignment
    this.send({
      type: "role",
      data: { role: client.role, clientId: this.clientId, roomId: this.roomId },
    } satisfies RoleAssignmentMessage);

    // If answerer, send existing offer
    if (client.role === "answerer" && room.offer) {
      this.send({
        type: "offer",
        data: room.offer,
      } satisfies OfferMessage);
    }

    this.pollInterval = setInterval(() => this.pollRoomState(), 2000);

    this.socket.addEventListener("message", (evt) => this.onMessage(evt));
    this.socket.addEventListener("close", () => this.onClose());
    this.socket.addEventListener("error", (error: ErrorEvent) => this.onError(error));
  }

  private async pollRoomState(): Promise<void> {
    const currentRoomState = await this.storage.get<string>(this.roomId);
    const currentRoom = new Room(this.roomId, currentRoomState);

    currentRoom.updatePresence(this.clientId);

    currentRoom.cleanupDisconnectedClients();

    const client = currentRoom.getClient(this.clientId);

    // Only process if room state has changed
    if (currentRoom.toJSON() !== currentRoomState) {
      await this.storage.put(this.roomId, currentRoom.toJSON());

      // Re-Send offers and answerers
      if (client.role === "answerer" && currentRoom.offer) {
        this.send({
          type: "offer",
          data: currentRoom.offer,
        } satisfies OfferMessage);
      } else if (client.role === "offerer" && currentRoom.answer) {
        this.send({
          type: "answer",
          data: currentRoom.answer,
        } satisfies AnswerMessage);
      }
    }
  }

  private async onMessage(evt: MessageEvent): Promise<void> {
    const msg = JSON.parse(evt.data as string) as SignalingMessage;
    console.log(`Received: ${msg.type}`);

    // Get latest room state
    const roomState = await this.storage.get<string>(this.roomId);
    const room = new Room(this.roomId, roomState);
    const client = room.getClient(this.clientId);

    if (msg.type === "offer" && client.role === "offerer") {
      room.addOffer(msg.data);
      await this.storage.put(this.roomId, room.toJSON());
    }

    if (msg.type === "answer" && client.role === "answerer") {
      room.addAnswer(msg.data);
      await this.storage.put(this.roomId, room.toJSON());
    }
  }

  private async onClose(): Promise<void> {
    if (this.pollInterval) clearInterval(this.pollInterval);

    // Get latest room state and remove client
    const roomState = await this.storage.get<string>(this.roomId);
    const room = new Room(this.roomId, roomState);
    room.removeClient(this.clientId);
    await this.storage.put(this.roomId, room.toJSON());
  }

  private async onError(error: ErrorEvent): Promise<void> {
    console.error("Error occurred", error);
  }

  private send(msg: SignalingMessage): void {
    this.socket.send(JSON.stringify(msg));
  }
}
