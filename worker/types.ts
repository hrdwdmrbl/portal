export interface Env {
  PORTAL_KV: KVNamespace;
  USE_IN_MEMORY_STORAGE?: string; // "true" or "false"
}

export interface ClientType {
  clientId: string;
  role: "offerer" | "answerer";
  joinedAt: number;
  lastSeen: number;
}

export interface RoomState {
  clients: Record<string, ClientType>;
  offer: any | null;
  answer: any | null;
}
