import { DurableObject } from "cloudflare:workers";
import { WebSocketHandler } from "./WebSocketHandler";
import { Room } from "./Room";
import type { Env } from "./types";
import type { SignalingMessage } from "../frontend/src/types";

/**
 * Manages multiple rooms and multiple websocket connections
 */
export class PortalManager extends DurableObject {
  private handlers: Map<string, WebSocketHandler>;
  private roomState: string | undefined;
  private room: Room | undefined;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.handlers = new Map();

    this.ctx.blockConcurrencyWhile(async () => {
      this.roomState = await this.ctx.storage.get<string>("roomState");
    });
  }

  async join(socket: WebSocket, roomId: string): Promise<void> {
    this.room ||= new Room(this.roomState, roomId);

    const webSocketHandler = new WebSocketHandler(this.room, socket, {
      onSave: () => this.saveState(),
      onBroadcast: (msg, excludeClientId) => this.broadcast(msg, excludeClientId),
      onClose: (clientId) => this.handlers.delete(clientId),
    });

    await webSocketHandler.handleConnection();
    this.handlers.set(webSocketHandler.getClientId(), webSocketHandler);
  }

  private broadcast(signalingMessage: SignalingMessage, excludeClientId: string) {
    for (const [clientId, handler] of this.handlers) {
      if (clientId === excludeClientId) continue;

      const client = this.room.getClient(clientId);
      if (!client) continue;

      handler.send(signalingMessage);
    }
  }

  private saveState(): Promise<void> {
    return this.ctx.storage.put("roomState", this.room.toJSON());
  }
}
