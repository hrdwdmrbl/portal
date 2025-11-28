import { OfferOrAnswerData } from "../frontend/src/types";
import type { PortalRoom } from "./PortalRoom";

export interface Env {
  PORTAL_ROOM: DurableObjectNamespace<PortalRoom>;
}

export interface ClientType {
  clientId: string;
  role: "offerer" | "answerer";
}

export interface RoomState {
  roomId: string;
  clients: Record<string, ClientType>;
  offer?: OfferOrAnswerData;
  answer?: OfferOrAnswerData;
}

export interface ClientAttachment {
  clientId: string;
  roomId: string;
}
