import type { Env } from "./types";
import { PortalManager } from "./PortalManager";

export { PortalManager };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair();

      const roomId = request.headers.get("CF-Connecting-IP") || "default-room";
      const roomDurableObjectId = env.PORTAL_ROOM.idFromName(roomId);
      const portalManager = env.PORTAL_ROOM.get(roomDurableObjectId);

      await portalManager.join(server, roomId);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
