import type { Env } from "./types";
import { PortalRoom } from "./PortalRoom";

export { PortalRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === "/ws" &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      const roomId = request.headers.get("CF-Connecting-IP");
      if (!roomId) {
        return new Response("No room ID", { status: 400 });
      }

      const portalRoom = env.PORTAL_ROOM.getByName(roomId);

      // Forward the WebSocket upgrade request to the Durable Object
      return await portalRoom.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
