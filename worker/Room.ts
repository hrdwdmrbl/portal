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

  private removeOldestClients(maxClients: number = 2): void {
    const clients = Object.entries(this.clients);
    if (clients.length > maxClients) {
      // Sort clients by joinedAt timestamp
      clients.sort(([, a], [, b]) => a.joinedAt - b.joinedAt);

      // Remove oldest clients until we reach maxClients
      const clientsToRemove = clients.slice(0, clients.length - maxClients);
      for (const [clientId, client] of clientsToRemove) {
        console.log(`Removing old client ${clientId} (${client.role})`);
        this.removeClient(clientId);
      }
    }
  }

  public addClient(clientId: string): "offerer" | "answerer" {
    // First check and remove old clients if needed
    this.removeOldestClients();

    // Determine role: if the last added client is NOT an offerer, then this one is offerer?
    // Logic from original:
    // const isFirstClient = this.clients[Object.keys(this.clients)[Object.keys(this.clients).length - 1]]?.role !== "offerer";
    // This logic seems a bit fragile.
    // If no clients, last client is undefined. undefined?.role !== "offerer" is true. So first client is "offerer".
    // If one client exists and is "offerer". last client is "offerer". !== "offerer" is false. So second is "answerer".
    // If one client exists and is "answerer". last client is "answerer". !== "offerer" is true. So second is "offerer".

    // Simplification: If there are no clients, or no 'offerer' in the list, be the offerer.
    // Otherwise be the answerer.

    const hasOfferer = Object.values(this.clients).some((c) => c.role === "offerer");
    const role: "offerer" | "answerer" = !hasOfferer ? "offerer" : "answerer";

    this.clients[clientId] = new Client({
      clientId: clientId,
      role: role,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });

    console.log(`Added ${clientId} as ${role} to room ${this.roomId}. ${Object.keys(this.clients).length} clients`);
    return role;
  }

  public getClientRole(clientId: string): "offerer" | "answerer" | undefined {
    return this.clients[clientId]?.role;
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

  public cleanupDisconnectedClients(activeClientIds: Set<string>): boolean {
    let changed = false;
    const now = Date.now();

    for (const [clientId, client] of Object.entries(this.clients)) {
      if (!activeClientIds.has(clientId)) {
        // Grace period of 15 seconds to allow for KV consistency
        if (now - client.joinedAt > 15000) {
          console.log(`Removing zombie client ${clientId} (missing presence)`);
          this.removeClient(clientId);
          changed = true;
        }
      }
    }
    return changed;
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
