import { UIManager } from "./managers/UIManager";
import { SoundManager } from "./managers/SoundManager";
import { MediaManager } from "./managers/MediaManager";
import { RTCManager } from "./managers/RTCManager";
import { DataChannelManager } from "./managers/DataChannelManager";
import { PeerCoordinationManager } from "./managers/PeerCoordinationManager";

export class App {
  private uiManager: UIManager;
  private soundManager: SoundManager;
  private mediaManager: MediaManager;
  private dataChannelManager: DataChannelManager;
  private peerCoordinationManager: PeerCoordinationManager;
  private rtcManager: RTCManager;

  constructor() {
    this.uiManager = new UIManager();
    this.soundManager = new SoundManager();
    this.mediaManager = new MediaManager(this.uiManager);

    this.peerCoordinationManager = new PeerCoordinationManager(this.uiManager);

    this.dataChannelManager = new DataChannelManager(
      this.uiManager,
      this.soundManager,
    );

    this.rtcManager = new RTCManager(
      this.peerCoordinationManager,
      this.mediaManager,
      this.dataChannelManager,
      this.uiManager,
    );

    this.uiManager.initialize(
      this.rtcManager,
      this.dataChannelManager,
      this.mediaManager,
      this.soundManager,
    );
  }

  public async init(): Promise<void> {
    window.addEventListener("beforeunload", () => void this.cleanup());

    await this.mediaManager.start();
    await this.rtcManager.start();
  }

  private async cleanup(): Promise<void> {
    this.rtcManager.cleanup();
    this.mediaManager.cleanup();
    await this.soundManager.cleanup();
  }
}
