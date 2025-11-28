import { RTCManager } from "./RTCManager";
import { DataChannelManager } from "./DataChannelManager";
import { MediaManager } from "./MediaManager";
import { SoundManager } from "./SoundManager";
import { BubbleManager } from "./BubbleManager";
import { Role } from "../types";

export class UIManager {
  // Containers
  private localVideo: HTMLVideoElement;
  private videoContainer: HTMLElement;
  private messagesContainer: HTMLElement;
  private remoteVideo: HTMLVideoElement;
  private statusContainer: HTMLElement;

  private bubbleManager: BubbleManager;

  // Chat
  private messageInput: HTMLInputElement;
  private sendButton: HTMLElement;

  // UI controls
  private toggleLocalVideoButton: HTMLElement;
  private videoToggle: HTMLElement;
  private audioToggle: HTMLElement;
  private fullscreenToggle: HTMLElement;
  private morseButton: HTMLElement;
  private ringButton: HTMLElement;

  // Status lights
  private localLight: HTMLElement;
  private localStatus: HTMLElement;

  private websocketLight: HTMLElement;
  private websocketStatus: HTMLElement;

  private peerConnectionLight: HTMLElement;
  private peerConnectionStatus: HTMLElement;
  private peerConnectionBlinkInterval?: number;
  private peerConnectionBlinkClass: "connecting" | "disconnected" | null = null;
  private peerConnectionBlinkVisible = false;

  private remoteVideoLight: HTMLElement;
  private remoteVideoStatus: HTMLElement;

  private dataChannelLight: HTMLElement;

  // Managers
  private rtcManager!: RTCManager;
  private dataChannelManager!: DataChannelManager;
  private mediaManager!: MediaManager;
  private soundManager!: SoundManager;

  constructor() {
    // Container elements
    this.localVideo = this.getElement("localVideo") as HTMLVideoElement;
    this.remoteVideo = this.getElement("remoteVideo") as HTMLVideoElement;
    this.videoContainer = document.querySelector("body") as HTMLElement;
    this.messagesContainer = this.getElement("messages");
    this.statusContainer = this.getElement("status");

    this.bubbleManager = new BubbleManager(this.messagesContainer);

    // Chat
    this.messageInput = this.getElement("messageInput") as HTMLInputElement;
    this.sendButton = this.getElement("sendButton");

    // UI controls
    this.morseButton = this.getElement("morseButton");
    this.ringButton = this.getElement("ringButton");
    this.fullscreenToggle = this.getElement("fullscreenToggle");
    this.videoToggle = this.getElement("videoToggle");
    this.audioToggle = this.getElement("audioToggle");
    this.toggleLocalVideoButton = this.getElement("toggleLocalVideo");

    // Status lights
    this.localLight = this.getElement("localLight");
    this.localStatus = this.getElement("localStatus");

    this.websocketLight = this.getElement("websocketLight");
    this.websocketStatus = this.getElement("websocketStatus");

    this.peerConnectionLight = this.getElement("peerConnectionLight");
    this.peerConnectionStatus = this.getElement("peerConnectionStatus");

    this.remoteVideoLight = this.getElement("videoLight");
    this.remoteVideoStatus = this.getElement("videoStatus");

    this.dataChannelLight = this.getElement("dataChannelLight");

    this.setupEventListeners();
  }

  private getElement(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Element with id '${id}' not found`);
    }
    return el;
  }

  public initialize(
    rtcManager: RTCManager,
    dataChannelManager: DataChannelManager,
    mediaManager: MediaManager,
    soundManager: SoundManager,
  ): void {
    this.rtcManager = rtcManager;
    this.dataChannelManager = dataChannelManager;
    this.mediaManager = mediaManager;
    this.soundManager = soundManager;
  }

  private setupEventListeners(): void {
    // Message Input
    this.messageInput.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.messageInput.focus();
    });
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.triggerSend();
    });

    // Send Button
    this.sendButton.addEventListener("click", () => this.triggerSend());
    this.sendButton.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.triggerSend();
      },
      { passive: false },
    );

    // Ring Button
    this.ringButton.addEventListener("click", () => this.handleRing());
    this.ringButton.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.handleRing();
      },
      { passive: false },
    );

    // Morse Button
    const startMorse = (e: Event) => {
      e.preventDefault();
      this.morseButton.classList.add("pressed");
      this.handleMorseStart();
    };
    const stopMorse = (e: Event) => {
      e.preventDefault();
      this.morseButton.classList.remove("pressed");
      this.handleMorseStop();
    };

    this.morseButton.addEventListener("mousedown", startMorse);
    this.morseButton.addEventListener("mouseup", stopMorse);
    this.morseButton.addEventListener("touchstart", startMorse, {
      passive: false,
    });
    this.morseButton.addEventListener("touchend", stopMorse, {
      passive: false,
    });
    this.morseButton.addEventListener("touchcancel", stopMorse, {
      passive: false,
    });

    // Window mouseup to catch lost clicks
    window.addEventListener("mouseup", (e) => {
      if (this.morseButton.classList.contains("pressed")) {
        stopMorse(e);
      }
    });
    window.addEventListener("touchend", (e) => {
      if (this.morseButton.classList.contains("pressed")) {
        stopMorse(e);
      }
    });

    // Fullscreen
    this.fullscreenToggle.addEventListener(
      "click",
      () => void this.toggleFullscreen(),
    );
    this.fullscreenToggle.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        void this.toggleFullscreen();
      },
      { passive: false },
    );
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        this.fullscreenToggle.classList.remove("active");
      }
    });

    // Media Toggles
    this.videoToggle.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleVideoToggle();
    });
    this.videoToggle.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.handleVideoToggle();
      },
      { passive: false },
    );

    this.audioToggle.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleAudioToggle();
    });
    this.audioToggle.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.handleAudioToggle();
      },
      { passive: false },
    );

    // Local Video Visibility
    this.toggleLocalVideoButton.addEventListener("click", (e) =>
      this.toggleLocalVideoVisibility(e),
    );
    this.toggleLocalVideoButton.addEventListener(
      "touchstart",
      (e) => this.toggleLocalVideoVisibility(e),
      {
        passive: false,
      },
    );
  }

  private triggerSend(): void {
    this.assertInitialized();

    const message = this.messageInput.value.trim();
    if (message) {
      if (this.dataChannelManager.isOpen()) {
        this.dataChannelManager.sendMessage(message);
        this.messageInput.value = "";
      } else {
        this.log("Data channel not ready");
      }
    }
  }

  private handleRing(): void {
    this.assertInitialized();

    if (this.dataChannelManager.isOpen()) {
      this.dataChannelManager.sendSound("audios/ring.mp3");
      this.log("Ring sent");
    } else {
      this.log("Data channel not ready");
    }
  }

  public triggerMorseVisual(active: boolean): void {
    if (active) {
      this.morseButton.classList.add("glowing");
    } else {
      this.morseButton.classList.remove("glowing");
    }
  }

  public triggerRingVisual(): void {
    this.ringButton.classList.add("shaking");
    setTimeout(() => {
      this.ringButton.classList.remove("shaking");
    }, 500); // Shake for 500ms
  }

  private handleMorseStart(): void {
    this.assertInitialized();

    if (this.dataChannelManager.isOpen()) {
      this.dataChannelManager.sendMorse(true);
      this.soundManager.startMorseBeep();
    }
  }

  private handleMorseStop(): void {
    this.assertInitialized();

    if (this.dataChannelManager.isOpen()) {
      this.dataChannelManager.sendMorse(false);
      this.soundManager.stopMorseBeep();
    } else {
      this.soundManager.stopMorseBeep();
    }
  }

  private handleVideoToggle(): void {
    this.assertInitialized();

    const enabled = this.mediaManager.toggleVideo();
    this.updateLocalMediaState(
      this.mediaManager.isVideoEnabled(),
      this.mediaManager.isAudioEnabled(),
    );
    this.log(`Video ${enabled ? "enabled" : "disabled"}`);

    this.rtcManager.updateTrack("video", enabled);

    if (this.dataChannelManager.isOpen()) {
      this.dataChannelManager.sendVideoState(enabled);
    }
    void this.soundManager.playSwitch();
  }

  private handleAudioToggle(): void {
    this.assertInitialized();

    const enabled = this.mediaManager.toggleAudio();
    this.updateLocalMediaState(
      this.mediaManager.isVideoEnabled(),
      this.mediaManager.isAudioEnabled(),
    );
    this.log(`Audio ${enabled ? "enabled" : "disabled"}`);

    this.rtcManager.updateTrack("audio", enabled);
    void this.soundManager.playSwitch();
  }

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      this.fullscreenToggle.classList.remove("active");
    } else {
      await this.videoContainer.requestFullscreen();
      this.fullscreenToggle.classList.add("active");
    }
  }

  private toggleLocalVideoVisibility(e: Event): void {
    e.preventDefault();
    const isVisible = this.localVideo.classList.toggle("visible");
    this.toggleLocalVideoButton.classList.toggle("visible", isVisible);
  }

  public log(msg: string): void {
    console.log(msg);
  }

  public addChatMessage(msg: string): void {
    this.assertInitialized();

    this.bubbleManager.addBubble(msg);
    void this.soundManager.playMessage();
  }

  public setLocalStatus(
    type: "video" | "audio",
    status: "error",
    message: string,
  ): void;
  public setLocalStatus(type: "video" | "audio", status: "active"): void;
  public setLocalStatus(type: "video" | "audio", status: "connecting"): void;
  public setLocalStatus(
    type: "video" | "audio",
    status: "active" | "error" | "connecting",
    message?: string,
  ) {
    if (status === "error") {
      this.setMediaError(type, message!);
    } else if (status === "active") {
      this.localStatus.textContent = "";
      this.localLight.classList.remove("active", "connecting", "disconnected");
      this.localLight.classList.add("active");
    }
  }

  public setMediaError(type: "video" | "audio", message: string): void {
    if (type === "video") {
      this.videoToggle.classList.add("disabled");
      this.videoToggle.setAttribute("title", message);
    } else if (type === "audio") {
      this.audioToggle.classList.add("disabled");
      this.audioToggle.setAttribute("title", message);
    } else {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid media type: ${type}`);
    }

    // Update local status to reflect error
    this.localLight.classList.remove("active", "connecting");
    this.localLight.classList.add("disconnected");
    this.localStatus.textContent = `${type} error: ${message}`;
  }

  public setDataChannelState(state: "open" | "closed" | "error"): void {
    this.dataChannelLight.classList.remove(
      "active",
      "disconnected",
      "connecting",
    );

    if (state === "open") {
      this.dataChannelLight.classList.add("active");
    } else if (state === "closed") {
      this.dataChannelLight.classList.add("disconnected");
    } else if (state === "error") {
      this.dataChannelLight.classList.add("error");
    } else {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid data channel state: ${state}`);
    }
  }

  public setWebsocketLight(status: "open" | "closed" | "error"): void {
    this.websocketLight.classList.remove(
      "active",
      "disconnected",
      "connecting",
    );
    if (status === "open") {
      this.websocketLight.classList.add("active");
    } else if (status === "closed") {
      this.websocketLight.classList.add("disconnected");
    } else if (status === "error") {
      this.websocketLight.classList.add("error");
    } else {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid websocket status: ${status}`);
    }
  }

  public setWebsocketStatus(message: string): void {
    this.websocketStatus.textContent = message;
  }

  public setPeerConnecting(
    isConnecting: boolean,
    isReconnecting?: boolean,
  ): void {
    if (!isConnecting) {
      this.stopPeerConnectionBlink();
      if (
        isReconnecting ||
        !this.peerConnectionLight.classList.contains("active")
      ) {
        this.peerConnectionLight.classList.remove("active");
        this.peerConnectionLight.classList.add("disconnected");
      }
      this.peerConnectionStatus.textContent = isReconnecting
        ? "Reconnecting..."
        : "";
      return;
    }

    this.peerConnectionLight.classList.remove(
      "active",
      "disconnected",
      "connecting",
    );
    const blinkClass: "connecting" | "disconnected" = isReconnecting
      ? "disconnected"
      : "connecting";
    this.startPeerConnectionBlink(blinkClass);
    this.peerConnectionStatus.textContent = isReconnecting
      ? "Reconnecting..."
      : "";
  }

  public setPeerConnectionState(state: RTCPeerConnectionState): void {
    this.assertInitialized();
    this.stopPeerConnectionBlink();

    this.peerConnectionLight.classList.remove(
      "active",
      "disconnected",
      "connecting",
    );

    if (state === "connected") {
      this.peerConnectionLight.classList.add("active");
      this.peerConnectionStatus.textContent = "";
      this.statusContainer.classList.add("hidden");

      // Hide local video on connection if it was visible
      if (this.localVideo.classList.contains("visible")) {
        this.localVideo.classList.remove("visible");
        this.toggleLocalVideoButton.classList.remove("visible");
      }
      void this.soundManager.playConnect();
    } else if (state === "connecting" || state === "new") {
      this.peerConnectionLight.classList.add("connecting");
      this.peerConnectionStatus.textContent = "Connecting...";
      this.statusContainer.classList.remove("hidden");
    } else if (state === "disconnected" || state === "failed") {
      // Disconnected/Failed
      this.peerConnectionLight.classList.add("disconnected");
      this.peerConnectionStatus.textContent =
        state.charAt(0).toUpperCase() + state.slice(1);
      this.statusContainer.classList.remove("hidden");
    }
  }

  public setPeerConnectionStep(
    role: Role,
    status?: "offered" | "answered" | "listening" | "offering" | "answering",
  ): void {
    // TODO: Make the peerConnectionLight blink

    if (role === "offerer") {
      this.peerConnectionStatus.textContent = `Offering...${status}`;
    } else if (role === "answerer") {
      this.peerConnectionStatus.textContent = `Answering...${status}`;
    } else {
      throw new Error(`Invalid role: ${role}`);
    }
  }

  public setRemoteVideoOpacity(opacity: "0" | "1"): void {
    this.remoteVideo.style.opacity = opacity;
  }

  public setLocalVideoSrc(stream: MediaStream): void {
    this.localVideo.srcObject = stream;
  }

  public setRemoteVideoSrc(stream: MediaStream): void {
    this.remoteVideo.srcObject = stream;
  }

  public updateLocalMediaState(
    videoEnabled: boolean,
    audioEnabled: boolean,
  ): void {
    // this.localVideo.style.opacity = videoEnabled ? "1" : "0";

    this.localLight.classList.remove("active", "disconnected", "connecting");
    this.localLight.classList.add("active");

    if (videoEnabled && audioEnabled) {
      this.localStatus.textContent = "";
    } else if (!videoEnabled && !audioEnabled) {
      this.localStatus.textContent = "Media disabled";
    } else {
      this.localStatus.textContent = videoEnabled
        ? "Audio disabled"
        : "Video disabled";
    }

    // Update button states
    this.videoToggle.classList.toggle("off", !videoEnabled);
    this.audioToggle.classList.toggle("off", !audioEnabled);
  }

  public addRemoteTrack(track: MediaStreamTrack): void {
    this.remoteVideo.srcObject ||= new MediaStream();
    const stream = this.remoteVideo.srcObject as MediaStream;

    // Remove any existing tracks of the same kind to prevent "Video paused" issues
    // where monitoring checks the old (ended) track instead of the new one
    stream.getTracks().forEach((t) => {
      if (t.kind === track.kind) {
        stream.removeTrack(t);
      }
    });

    track.addEventListener("ended", () => {
      this.setRemoteVideoTrackEnabled(false);
    });
    track.addEventListener("mute", () => {
      this.setRemoteVideoOpacity("0");
    });
    track.addEventListener("unmute", () => {
      this.setRemoteVideoOpacity("1");
    });

    stream.addTrack(track);
  }

  public getRemoteVideoElement(): HTMLVideoElement {
    return this.remoteVideo;
  }

  public setRemoteVideoTrackEnabled(enabled: boolean): void {
    this.setRemoteVideoStatus(enabled ? "connected" : "disconnected");

    const stream = this.remoteVideo.srcObject as MediaStream;
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.enabled = enabled;
      }
    }
  }

  private setRemoteVideoStatus(status: "connected" | "disconnected"): void {
    this.remoteVideoStatus.textContent = status;

    this.remoteVideoLight.classList.remove(
      "active",
      "disconnected",
      "connecting",
    );
    if (status === "connected") {
      this.remoteVideoLight.classList.add("active");
    } else {
      this.remoteVideoLight.classList.add("disconnected");
    }
  }

  private startPeerConnectionBlink(
    targetClass: "connecting" | "disconnected",
  ): void {
    this.stopPeerConnectionBlink();
    this.peerConnectionBlinkClass = targetClass;
    this.peerConnectionBlinkVisible = true;
    this.peerConnectionLight.classList.add(targetClass);
    this.peerConnectionBlinkInterval = window.setInterval(() => {
      this.peerConnectionBlinkVisible = !this.peerConnectionBlinkVisible;
      this.peerConnectionLight.classList.toggle(
        targetClass,
        this.peerConnectionBlinkVisible,
      );
    }, 400);
  }

  private stopPeerConnectionBlink(): void {
    if (this.peerConnectionBlinkInterval !== undefined) {
      window.clearInterval(this.peerConnectionBlinkInterval);
      this.peerConnectionBlinkInterval = undefined;
    }

    if (this.peerConnectionBlinkClass) {
      this.peerConnectionLight.classList.remove(this.peerConnectionBlinkClass);
    }

    this.peerConnectionBlinkClass = null;
    this.peerConnectionBlinkVisible = false;
  }

  private assertInitialized(): void {
    if (
      !this.rtcManager ||
      !this.dataChannelManager ||
      !this.mediaManager ||
      !this.soundManager
    ) {
      throw new Error("UIManager not initialized");
    }
  }
}
