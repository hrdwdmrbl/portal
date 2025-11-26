import { ClientType } from "./types";

export class Client implements ClientType {
  public clientId: string;
  public role: "offerer" | "answerer";
  public joinedAt: number;
  public lastSeen: number;

  constructor(client: ClientType) {
    this.clientId = client.clientId;
    this.role = client.role;
    this.joinedAt = client.joinedAt;
    this.lastSeen = client.lastSeen;
  }
}
