import { Env } from "./types";
import { WebSocketHandler } from "./WebSocketHandler";
import { KVStorage } from "./storage/KVStorage";
import { MemoryStorage } from "./storage/MemoryStorage";
import { Storage } from "./storage/types";

// Singleton memory storage instance for local development
let memoryStorage: MemoryStorage | null = null;

function getStorage(env: Env): Storage {
  // Check if we should use memory storage:
  // 1. Explicitly requested via env var
  // 2. PORTAL_KV is missing (local dev without binding)
  const useMemory = env.USE_IN_MEMORY_STORAGE === "true" || !env.PORTAL_KV;

  if (useMemory) {
    if (!memoryStorage) {
      console.log("Initializing in-memory storage");
      memoryStorage = new MemoryStorage();
    }
    return memoryStorage;
  }

  return new KVStorage(env.PORTAL_KV);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const storage = getStorage(env);

    // Only handle WebSocket upgrades at /ws
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      return handleWebSocket(request, env, storage);
    } else if (url.pathname === "/reset") {
      await handleReset(request, env, storage);
      return new Response("OK", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleWebSocket(request: Request, env: Env, storage: Storage): Promise<Response> {
  const { 0: client, 1: server } = new WebSocketPair();

  const roomId = request.headers.get("CF-Connecting-IP") || "default-room"; // Fallback if header missing
  console.log("New connection from", roomId);
  const handler = new WebSocketHandler(storage, server, roomId);

  // We don't await this, it runs in the background for the socket duration
  handler.handleConnection();

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

async function handleReset(request: Request, env: Env, storage: Storage): Promise<void> {
  const roomId = request.headers.get("CF-Connecting-IP") || "default-room";
  await storage.delete(roomId);
}
