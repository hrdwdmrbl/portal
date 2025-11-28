import { DurableObject } from "cloudflare:workers";
import { Room } from "./Room";
import { WebSocketHandler } from "./WebSocketHandler";
import type { ClientAttachment, Env } from "./types";
import type { SignalingMessage } from "../frontend/src/types";

export class PortalRoom extends DurableObject {
  private room: Room | undefined;
  private storedState?: string;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    void this.ctx.blockConcurrencyWhile(async () => {
      this.storedState = await this.ctx.storage.get<string>("roomState");

      // Rehydrate room from existing WebSocket attachments if available
      const attachment = this.ctx
        .getWebSockets()
        .map((socket) => socket.deserializeAttachment() as ClientAttachment)
        .find(({ roomId }) => {
          return roomId;
        });

      if (attachment && attachment.roomId) {
        this.room = new Room(attachment.roomId, this.storedState);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const roomId = request.headers.get("CF-Connecting-IP");

    const { 0: client, 1: server } = new WebSocketPair();

    this.room ||= new Room(roomId, this.storedState);

    // Rescue in case of de-sync between sockets and Room
    const activeClientIds = this.ctx
      .getWebSockets()
      .map((socket) => socket.deserializeAttachment() as ClientAttachment)
      .map(({ clientId }) => clientId);
    this.room.setClients(activeClientIds);

    // Accept the WebSocket natively to enable hibernation
    this.ctx.acceptWebSocket(server);

    // Initialize handler just for the setup phase (adding client, sending initial roles)
    const handler = new WebSocketHandler(this.room, server, {
      onSave: () => this.saveState(),
      onBroadcast: (msg, exclude) => this.broadcast(msg, exclude),
    });
    await this.saveState();

    // Persist the clientId to the socket attachment so we can recover it after hibernation
    const clientId = handler.getClientId();
    server.serializeAttachment({ clientId, roomId } as ClientAttachment);

    handler.handleConnection();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    const attachment = socket.deserializeAttachment() as ClientAttachment;
    const clientId = attachment && attachment.clientId;
    const roomId = attachment && attachment.roomId;
    if (!clientId || !roomId) {
      throw new Error("Socket missing attachment in webSocketError");
    }
    this.room ||= new Room(roomId, this.storedState);

    const handler = new WebSocketHandler(
      this.room,
      socket,
      {
        onSave: () => this.saveState(),
        onBroadcast: (msg, exclude) => this.broadcast(msg, exclude),
      },
      clientId, // Rehydrate handler with existing ID
    );

    // Convert ArrayBuffer to string if necessary
    const msgString =
      typeof message === "string" ? message : new TextDecoder().decode(message);
    await handler.onMessage(msgString);
  }

  webSocketClose(
    socket: WebSocket,
    // _code: number,
    // _reason: string,
    // _wasClean: boolean,
  ) {
    const attachment = socket.deserializeAttachment() as ClientAttachment;
    const clientId = attachment && attachment.clientId;
    const roomId = attachment && attachment.roomId;
    if (!clientId || !roomId) {
      throw new Error("Socket missing attachment in webSocketError");
    }
    this.room ||= new Room(roomId, this.storedState);

    this.room.removeClient(clientId);
    return this.saveState();
  }

  async webSocketError(socket: WebSocket, error: unknown) {
    console.error("WebSocket error:", error);

    const attachment = socket.deserializeAttachment() as ClientAttachment;
    const clientId = attachment && attachment.clientId;
    const roomId = attachment && attachment.roomId;
    if (!clientId || !roomId) {
      throw new Error("Socket missing clientId attachment in webSocketError");
    }
    this.room ||= new Room(roomId, this.storedState);

    this.room.removeClient(clientId);
    await this.saveState();

    socket.close();
  }

  private broadcast(msg: SignalingMessage, excludeClientId: string) {
    if (!this.room) {
      throw new Error("Room not joined in saveState");
    }

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as ClientAttachment;
      const id = attachment && attachment.clientId;

      if (id !== excludeClientId) {
        const client = this.room.getClient(id);
        const sender = this.room.getClient(excludeClientId);

        if (!client) continue;
        if (!sender) continue;

        if (sender.role === "offerer" && client.role === "answerer") {
          socket.send(JSON.stringify(msg));
        } else if (sender.role === "answerer" && client.role === "offerer") {
          socket.send(JSON.stringify(msg));
        }
      }
    }
  }

  private async saveState() {
    if (!this.room) {
      throw new Error("Room not joined in saveState");
    }

    await this.ctx.storage.put("roomState", this.room.toJSON());
  }
}
