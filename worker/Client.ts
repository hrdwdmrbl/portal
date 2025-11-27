import { ClientType } from "./types";

export class Client implements ClientType {
  public clientId: string;
  public role: "offerer" | "answerer";

  constructor(client: ClientType) {
    this.clientId = client.clientId;
    this.role = client.role;
  }
}
