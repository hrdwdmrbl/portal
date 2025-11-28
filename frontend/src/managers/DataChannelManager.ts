import { UIManager } from "./UIManager";
import { SoundManager } from "./SoundManager";

export class DataChannelManager {
  private dataChannel: RTCDataChannel | null = null;
  private uiManager: UIManager;
  private soundManager: SoundManager;

  constructor(uiManager: UIManager, soundManager: SoundManager) {
    this.uiManager = uiManager;
    this.soundManager = soundManager;
  }

  public setupChannel(dataChannel: RTCDataChannel): void {
    if (this.dataChannel) {
      this.dataChannel.close();
    }

    this.dataChannel = dataChannel;
    this.dataChannel.onopen = () => {
      this.uiManager.setDataChannelState("open");
    };
    this.dataChannel.onclose = () => {
      this.uiManager.setDataChannelState("closed");
    };
    this.dataChannel.onerror = (error: RTCErrorEvent) => {
      this.uiManager.log(error.error.message);
      this.uiManager.setDataChannelState("error");
    };
    this.dataChannel.onmessage = (event) => this.handleMessage(event);
  }

  public send(type: string, data: any): void {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(JSON.stringify({ type, data }));
    } else {
      console.warn("Data channel not ready");
    }
  }

  public sendMessage(text: string): void {
    this.send("message", window.btoa(text));
  }

  public sendSound(path: string): void {
    this.send("sound", path);
  }

  public sendMorse(start: boolean): void {
    this.send("morse", start);
  }

  public sendVideoState(enabled: boolean): void {
    this.send("videoState", { enabled });
  }

  private handleMessage(event: MessageEvent): void {
    const msg = JSON.parse(event.data);
    console.log("Data channel message:", msg);

    switch (msg.type) {
      case "videoState":
        this.uiManager.setRemoteVideoTrackEnabled(
          msg.enabled || msg.data.enabled,
        );
        break;
      case "message":
        const text = atob(msg.data);
        this.uiManager.addChatMessage(text);
        break;
      case "sound":
        this.soundManager.playSound(msg.data);
        if (msg.data.includes("ring")) {
          this.uiManager.triggerRingVisual();
        }
        break;
      case "morse":
        this.uiManager.triggerMorseVisual(!!msg.data);
        if (msg.data) {
          this.soundManager.startMorseBeep();
        } else {
          this.soundManager.stopMorseBeep();
        }
        break;
      default:
        console.log(`Unhandled message type: ${msg.type}`);
    }
  }

  public close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
  }

  public isOpen(): boolean {
    return this.dataChannel?.readyState === "open";
  }
}
