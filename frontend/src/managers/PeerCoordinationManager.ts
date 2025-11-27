import { SignalingMessage } from "../types";
import type { RTCManager } from "./RTCManager";
import { UIManager } from "./UIManager";

// Helps the clients exchange their RTC connection information.
// Helps to triangulate between clients when they're first setting up their peer-to-peer connection.
export class PeerCoordinationManager {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
  }

  public connect(rtcManager: RTCManager): void {
    if (this.ws) {
      // Already connected, already listening to events for the rtcManager
      return;
    }

    this.setupWsHandlers(rtcManager);
  }

  public send(msg: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn("WebSocket is not open, cannot send message");
    }
  }

  private setupWsHandlers(rtcManager: RTCManager): void {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.uiManager.log("WebSocket connected");
      rtcManager.handleSignalingOpen();
      this.uiManager.setWebsocketStatus("open");
    };

    this.ws.onmessage = async (evt) => {
      const msg = JSON.parse(evt.data) as SignalingMessage;
      this.uiManager.log("Received: " + msg.type);
      await rtcManager.handleSignalingMessage(msg);
    };

    this.ws.onclose = () => {
      this.uiManager.log("WebSocket closed");
      rtcManager.handleSignalingClose();
      this.uiManager.setWebsocketStatus("closed");
    };

    this.ws.onerror = (event: Event) => {
      this.uiManager.log("WebSocket error");
      this.uiManager.setWebsocketStatus("error");
    };
  }

  public close(): void {
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnection logic from triggering here if called manually
      this.ws.close();
      this.ws = null;
      this.uiManager.setWebsocketStatus("closed");
    }
  }
}
