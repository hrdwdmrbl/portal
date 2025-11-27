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

  private reconnectionTimeout: number | undefined;
  private setupWsHandlers(rtcManager: RTCManager, retryCount = 0): void {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.uiManager.log("WebSocket connected");
      rtcManager.handleSignalingOpen();
      this.uiManager.setWebsocketLight("open");
    };

    this.ws.onmessage = async (evt) => {
      const msg = JSON.parse(evt.data) as SignalingMessage;
      this.uiManager.log("Received: " + msg.type);
      await rtcManager.handleSignalingMessage(msg);
    };

    this.ws.onclose = () => {
      this.uiManager.log("WebSocket closed");
      rtcManager.handleSignalingClose();
      this.uiManager.setWebsocketLight("closed");

      this.reconnectionTimeout = setTimeout(() => {
        this.setupWsHandlers(rtcManager, retryCount + 1);
      }, Math.min(1000 * Math.pow(2, retryCount), 10000));
    };

    this.ws.onerror = (event: Event) => {
      this.uiManager.log("WebSocket error");
      this.uiManager.setWebsocketLight("error");
    };
  }

  public close(): void {
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnection logic from triggering here if called manually
      this.ws.close();
      this.ws = null;
      this.uiManager.setWebsocketLight("closed");
      if (this.reconnectionTimeout) {
        clearTimeout(this.reconnectionTimeout);
        this.reconnectionTimeout = undefined;
      }
    }
  }
}
