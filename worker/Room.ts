import type { OfferOrAnswerData } from "../frontend/src/types";
import { Client } from "./Client";
import type { RoomState } from "./types";

export class Room {
  public clients: Record<string, Client>;
  public offer?: OfferOrAnswerData;
  public answer?: OfferOrAnswerData;
  public roomId: string;

  constructor(roomId: string, existingRoom?: string) {
    let state: RoomState;

    if (typeof existingRoom === "string") {
      try {
        state = JSON.parse(existingRoom) as RoomState;
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
    this.offer = state.offer;
    this.answer = state.answer;
  }

  public addClient(clientId: string): Client {
    const hasOfferer = Object.values(this.clients).some(
      (c) => c.role === "offerer",
    );
    const role: "offerer" | "answerer" = !hasOfferer ? "offerer" : "answerer";

    const client = new Client({
      clientId: clientId,
      role: role,
    });
    this.clients[clientId] = client;
    return client;
  }

  public getClient(clientId: string): Client {
    return this.clients[clientId];
  }

  public setClients(clientIds: string[]): void {
    Object.keys(this.clients).forEach((clientId) => {
      if (!clientIds.includes(clientId)) {
        this.removeClient(clientId);
      }
    });
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
