import type { UIManager } from "./UIManager";

export class MediaManager {
  private localStream: MediaStream | null = null;
  private videoEnabled: boolean = true;
  private audioEnabled: boolean = true;
  private videoCheckInterval: number | undefined;

  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
  }

  public async start(): Promise<{ stream: MediaStream; videoEnabled: boolean; audioEnabled: boolean }> {
    if (this.localStream) {
      return { stream: this.localStream, videoEnabled: this.videoEnabled, audioEnabled: this.audioEnabled };
    }

    this.uiManager.log("Requesting local media...");
    this.uiManager.setLocalStatus("video", "connecting");
    this.uiManager.setLocalStatus("audio", "connecting");

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    this.uiManager.setLocalVideoSrc(this.localStream);

    this.videoEnabled = this.localStream.getVideoTracks()[0].enabled;
    this.audioEnabled = this.localStream.getAudioTracks()[0].enabled;

    if (this.videoEnabled) {
      this.uiManager.setLocalStatus("video", "active");
    } else {
      this.uiManager.setLocalStatus("video", "error", "Permission denied");
    }
    if (this.audioEnabled) {
      this.uiManager.setLocalStatus("audio", "active");
    } else {
      this.uiManager.setLocalStatus("audio", "error", "Permission denied");
    }

    this.uiManager.log(
      `Local media acquired: ${this.localStream
        .getTracks()
        .map((t: MediaStreamTrack) => t.kind)
        .join(", ")}`
    );

    return { stream: this.localStream, videoEnabled: this.videoEnabled, audioEnabled: this.audioEnabled };
  }

  public toggleVideo(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      this.videoEnabled = !this.videoEnabled;
      videoTrack.enabled = this.videoEnabled;
      return this.videoEnabled;
    }
    return false;
  }

  public toggleAudio(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      this.audioEnabled = !this.audioEnabled;
      audioTrack.enabled = this.audioEnabled;
      return this.audioEnabled;
    }
    return false;
  }

  public getStream(): MediaStream | null {
    return this.localStream;
  }

  public isVideoEnabled(): boolean {
    return this.videoEnabled;
  }

  public isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  public startVideoMonitoring(
    remoteVideo: HTMLVideoElement,
    onStatusChange: (status: "connected" | "disconnected" | "reconnecting", opacity: "0" | "1") => void
  ): void {
    this.stopVideoMonitoring();

    this.videoCheckInterval = setInterval(() => {
      const stream = remoteVideo.srcObject as MediaStream;
      const videoTrack = stream?.getVideoTracks()[0];

      if (!stream || !videoTrack || !videoTrack.enabled) {
        onStatusChange("disconnected", "0");
      } else if (videoTrack.readyState === "ended") {
        onStatusChange("reconnecting", "0");
      } else if (videoTrack.enabled) {
        onStatusChange("connected", "1");
      }
    }, 1000);
  }

  public stopVideoMonitoring(): void {
    if (this.videoCheckInterval) {
      clearInterval(this.videoCheckInterval);
      this.videoCheckInterval = undefined;
    }
  }

  public cleanup(): void {
    this.stopVideoMonitoring();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }
}
