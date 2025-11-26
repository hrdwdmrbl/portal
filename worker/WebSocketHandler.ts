import { Room } from "./Room";
import { generateClientId } from "./utils/nameGenerator";
import { Storage } from "./storage/types";
import type { AnswerMessage, OfferMessage, Role, RoleAssignmentMessage, SignalingMessage } from "../frontend/src/types";

export class WebSocketHandler {
  private storage: Storage;
  private socket: WebSocket;
  private roomId: string;
  private clientId: string;
  private pollInterval: number | null = null;
  private lastRoomState: string | null = null;
  private role: Role | null = null;

  constructor(storage: Storage, socket: WebSocket, roomId: string) {
    this.storage = storage;
    this.socket = socket;
    this.roomId = roomId;
    this.clientId = generateClientId();
  }

  public async handleConnection(): Promise<void> {
    this.socket.accept();

    // Establish presence immediately
    await this.updatePresence();

    // Get or create room
    const roomState = await this.storage.get<string>(this.roomId);
    const room = new Room(this.roomId, roomState);
    this.role = room.addClient(this.clientId);
    await this.storage.put(this.roomId, room.toJSON());

    // Send role assignment
    this.send({
      type: "role",
      data: { role: this.role, clientId: this.clientId },
    } satisfies RoleAssignmentMessage);

    // If answerer, send existing offer
    if (this.role === "answerer" && room.offer) {
      this.send({
        type: "offer",
        data: room.offer,
      } satisfies OfferMessage);
    }

    // Set up polling interval
    // Note: setInterval in Cloudflare Workers might be tricky if the worker sleeps,
    // but for WebSocket connections the worker stays alive usually.
    // However, DOs are preferred for state. KV + Polling is what was implemented.
    // I will keep the implementation but strictify it.

    // Using explicit unknown cast for setInterval return type difference in DOM vs Node
    this.pollInterval = setInterval(() => this.pollRoomState(), 2000) as unknown as number;

    this.socket.addEventListener("message", (evt) => this.onMessage(evt));
    this.socket.addEventListener("close", () => this.onClose());
    this.socket.addEventListener("error", () => this.onError());
  }

  private async pollRoomState(): Promise<void> {
    const currentRoomState = await this.storage.get<string>(this.roomId);
    const currentRoom = new Room(this.roomId, currentRoomState);

    const now = Date.now();
    const activeClientIds = new Set<string>();

    for (const client of Object.values(currentRoom.clients)) {
      // Check liveness based on metadata timestamp
      // If lastSeen is older than 15 seconds, consider it dead even if key exists
      const lastSeen = client.lastSeen;
      if (now - lastSeen < 15000) {
        activeClientIds.add(client.clientId);
      }
    }

    // Clean up zombie clients that are in Room but not active
    if (currentRoom.cleanupDisconnectedClients(activeClientIds)) {
      console.log("Cleanup performed, updating room state");
      await this.storage.put(this.roomId, currentRoom.toJSON());
    }

    // 3. Process State Changes
    // Only process if room state has changed (or if we just updated it)
    if (currentRoom.toJSON() !== this.lastRoomState) {
      // Re-instantiate room from latest state (in case cleanup modified it)
      // actually we already have currentRoom up to date if we cleaned up,
      // but if we didn't cleanup, we need to ensure currentRoom reflects currentRoomState
      // The logic above: if cleanup happened, currentRoom matches newState.
      // If not, currentRoom matches currentRoomState.
      // So currentRoom is valid.

      // Send offer to answerer
      if (
        this.role === "answerer" &&
        currentRoom.offer &&
        (!this.lastRoomState || !new Room(this.roomId, this.lastRoomState).offer)
      ) {
        this.send({
          type: "offer",
          data: currentRoom.offer,
        } satisfies OfferMessage);
      }

      // Send answer to offerer
      if (
        this.role === "offerer" &&
        currentRoom.answer &&
        (!this.lastRoomState || !new Room(this.roomId, this.lastRoomState).answer)
      ) {
        this.send({
          type: "answer",
          data: currentRoom.answer,
        } satisfies AnswerMessage);
      }

      this.lastRoomState = currentRoomState;
    }
  }

  private async onMessage(evt: MessageEvent): Promise<void> {
    const msg = JSON.parse(evt.data as string) as SignalingMessage;
    console.log(`Received: ${msg.type}`);

    // Get latest room state
    const roomState = await this.storage.get<string>(this.roomId);
    const room = new Room(this.roomId, roomState);

    if (msg.type === "offer" && this.role === "offerer") {
      room.addOffer(msg.data);
      await this.storage.put(this.roomId, room.toJSON());
    }

    if (msg.type === "answer" && this.role === "answerer") {
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

  private async onError(): Promise<void> {
    if (this.pollInterval) clearInterval(this.pollInterval);

    // Get latest room state and remove client
    const roomState = await this.storage.get<string>(this.roomId);
    const room = new Room(this.roomId, roomState);
    room.removeClient(this.clientId);
    await this.storage.put(this.roomId, room.toJSON());
  }

  private send(msg: SignalingMessage): void {
    this.socket.send(JSON.stringify(msg));
  }
}
