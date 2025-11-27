import type { PortalManager } from "./PortalManager";

export interface Env {
  PORTAL_ROOM: DurableObjectNamespace<PortalManager>;
}

export interface ClientType {
  clientId: string;
  role: "offerer" | "answerer";
  joinedAt: number;
  lastSeen: number;
}

export interface RoomState {
  roomId: string;
  clients: Record<string, ClientType>;
  offer: any | null;
  answer: any | null;
}
