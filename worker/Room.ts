import { OfferOrAnswerData } from "../frontend/src/types";
import { Client } from "./Client";
import type { RoomState, ClientType } from "./types";

export class Room {
  public clients: Record<string, ClientType>;
  public offer: OfferOrAnswerData | null;
  public answer: OfferOrAnswerData | null;
  public roomId: string;

  constructor(roomId: string, existingRoom: RoomState | string | null = null) {
    this.roomId = roomId;
    let state: RoomState;

    if (typeof existingRoom === "string") {
      try {
        state = JSON.parse(existingRoom);
      } catch (error: unknown) {
        console.error("Error parsing room state:", error);
        console.log(existingRoom);

        state = { clients: {}, offer: null, answer: null };
      }
    } else {
      state = existingRoom || { clients: {}, offer: null, answer: null };
    }

    const clients = state.clients || {};
    Object.keys(clients).forEach((clientId) => {
      clients[clientId] = new Client(clients[clientId]);
    });

    this.clients = clients;
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

    console.log(`Added ${clientId} as ${role} to room ${this.roomId}. ${Object.keys(this.clients).length} clients`);
    return client;
  }

  public getClient(clientId: string): Client {
    return this.clients[clientId];
  }

  public removeClient(clientId: string): void {
    const client = this.clients[clientId];
    if (!client) return;

    // If offerer disconnects, clear offer and answer
    if (client.role === "offerer") {
      this.offer = null;
      this.answer = null;
    }
    // If answerer disconnects, only clear answer
    if (client.role === "answerer") {
      this.answer = null;
    }

    delete this.clients[clientId];
    console.log(`Removed client ${clientId}, remaining clients: ${Object.keys(this.clients).length}`);
  }

  /**
   * Clean up zombie clients that are in Room but not active
   */
  public cleanupDisconnectedClients(): void {
    const activeClientIds = this.getActiveClientIds();
    const now = Date.now();
    for (const [clientId, client] of Object.entries(this.clients)) {
      if (!activeClientIds.has(clientId)) {
        // Grace period of 15 seconds to allow for KV consistency
        if (now - client.lastSeen > 15000) {
          console.log(`Removing zombie client ${clientId} (missing presence)`);
          this.removeClient(clientId);
        }
      }
    }
  }

  private getActiveClientIds(): Set<string> {
    const now = Date.now();
    const activeClientIds = new Set<string>();

    for (const client of Object.values(this.clients)) {
      // Check liveness based on metadata timestamp
      // If lastSeen is older than 15 seconds, consider it dead even if key exists
      const lastSeen = client.lastSeen;
      if (lastSeen && now - lastSeen < 15000) {
        activeClientIds.add(client.clientId);
      }
    }

    return activeClientIds;
  }

  public updatePresence(clientId: string): void {
    this.clients[clientId].lastSeen = Date.now();
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
      clients: this.clients,
      offer: this.offer,
      answer: this.answer,
    };
  }
}
