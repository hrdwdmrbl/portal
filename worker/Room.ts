import type { OfferOrAnswerData } from "../frontend/src/types";
import { Client } from "./Client";
import type { RoomState } from "./types";

export class Room {
  public clients: Record<string, Client>;
  public offer: OfferOrAnswerData | null;
  public answer: OfferOrAnswerData | null;
  public roomId: string;

  constructor(existingRoom: string | undefined = undefined, roomId: string) {
    let state: RoomState;

    if (typeof existingRoom === "string") {
      try {
        state = JSON.parse(existingRoom);
      } catch (error: unknown) {
        console.error("Error parsing room state:", error);
        state = { roomId, clients: {}, offer: null, answer: null };
      }
    } else {
      state = { roomId, clients: {}, offer: null, answer: null };
    }

    const clients = state.clients || {};
    Object.keys(clients).forEach((clientId) => {
      clients[clientId] = new Client(clients[clientId]);
    });

    this.clients = clients;
    this.roomId = state.roomId;
    this.offer = state.offer || null;
    this.answer = state.answer || null;
  }

  public addClient(clientId: string): Client {
    this.cleanupDisconnectedClients();

    const hasOfferer = Object.values(this.clients).some((c) => c.role === "offerer");
    const role: "offerer" | "answerer" = !hasOfferer ? "offerer" : "answerer";

    const client = new Client({
      clientId: clientId,
      role: role,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
    this.clients[clientId] = client;
    return client;
  }

  public getClient(clientId: string): Client {
    return this.clients[clientId];
  }

  public removeClient(clientId: string): void {
    const client = this.clients[clientId];
    if (!client) return;

    if (client.role === "offerer") {
      this.offer = null;
      this.answer = null;
    }
    if (client.role === "answerer") {
      this.answer = null;
    }

    delete this.clients[clientId];
  }

  public cleanupDisconnectedClients(): void {
    const activeClientIds = this.getActiveClientIds();
    for (const [clientId] of Object.entries(this.clients)) {
      if (!activeClientIds.has(clientId)) {
        this.removeClient(clientId);
      }
    }
  }

  private getActiveClientIds(): Set<string> {
    const now = Date.now();
    const activeClientIds = new Set<string>();

    for (const client of Object.values(this.clients)) {
      const lastSeen = client.lastSeen;
      if (lastSeen && now - lastSeen < 15000) {
        activeClientIds.add(client.clientId);
      }
    }
    return activeClientIds;
  }

  public updatePresence(clientId: string): void {
    if (this.clients[clientId]) {
      this.clients[clientId].lastSeen = Date.now();
    }
  }

  public addOffer(offer: OfferOrAnswerData): void {
    this.offer = offer;
    this.answer = null;
  }

  public addAnswer(answer: OfferOrAnswerData): void {
    this.answer = answer;
  }

  public toJSON(): string {
    return JSON.stringify(this.asJson());
  }

  public asJson(): RoomState {
    return {
      roomId: this.roomId,
      clients: this.clients,
      offer: this.offer,
      answer: this.answer,
    };
  }
}
