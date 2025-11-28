import { OfferOrAnswerData, Role, SignalingMessage } from "../types";
import { PeerCoordinationManager } from "./PeerCoordinationManager";
import { MediaManager } from "./MediaManager";
import { DataChannelManager } from "./DataChannelManager";
import { UIManager } from "./UIManager";

export class RTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private role: Role = null;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private isConnecting = false;
  private reconnectionTimeout: number | undefined;

  constructor(
    private peerCoordinationManager: PeerCoordinationManager,
    private mediaManager: MediaManager,
    private dataChannelManager: DataChannelManager,
    private uiManager: UIManager,
  ) {}

  private async reconnect(): Promise<void> {
    if (this.isReconnecting || this.isConnecting) {
      this.uiManager.log("Already attempting to reconnect...");
      return;
    }
    this.isReconnecting = true;

    this.reconnectAttempts++;
    this.uiManager.log("Attempting to reconnect...");
    this.uiManager.setPeerConnecting(false, true);

    this.cleanup();
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.uiManager.log("Reconnecting in " + delay + "ms...");
    await new Promise((resolve) => {
      this.reconnectionTimeout = setTimeout(resolve, delay);
      this.reconnectionTimeout = undefined;
    });
    this.isReconnecting = false;
    this.start(true);
  }

  public start(isReconnect = false): void {
    if (this.isConnecting) {
      this.uiManager.log("Already attempting to connect...");
      return;
    }

    this.setConnecting(true, isReconnect);

    try {
      const peerConnection = new RTCPeerConnection({});
      this.peerConnection = peerConnection;

      this.initializePeerConnection(peerConnection);

      this.peerCoordinationManager.connect(this);
    } catch (error: unknown) {
      this.uiManager.log(
        "Connection error: " +
          (error instanceof Error ? error.message : String(error)),
      );
      this.setConnecting(false);
      void this.reconnect();
    }
  }

  private initializePeerConnection(peerConnection: RTCPeerConnection): void {
    const localStream = this.mediaManager.getStream();
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    peerConnection.ontrack = (evt) => {
      this.uiManager.log(`Received remote ${evt.track.kind} track`);
      this.uiManager.addRemoteTrack(evt.track);
      this.setupRemoteTrackMonitoring(evt.track);
    };

    peerConnection.onconnectionstatechange = () => {
      // "closed" | "connected" | "connecting" | "disconnected" | "failed" | "new"
      const state = peerConnection.connectionState;
      this.uiManager.log(`Connection state: ${state}`);
      this.uiManager.setPeerConnectionState(state);

      if (state === "connected") {
        this.setConnecting(false);
        this.reconnectAttempts = 0;
        this.peerCoordinationManager.close();
      } else if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        this.setConnecting(false);
        void this.reconnect();
      }
    };

    peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      this.uiManager.log(`ICE candidate: ${event.candidate?.candidate}`);
    };
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      this.uiManager.log(`ICE connection state: ${iceState}`);
    };
    peerConnection.onicegatheringstatechange = (event: Event) => {
      this.uiManager.log(`ICE gathering state: ${event.type}`);
    };
    peerConnection.onicecandidateerror = (
      event: RTCPeerConnectionIceErrorEvent,
    ) => {
      this.uiManager.log(
        `ICE candidate error: ${event.errorCode} ${event.errorText}`,
      );
    };
    peerConnection.onnegotiationneeded = (event: Event) => {
      this.uiManager.log(`Negotiation needed: ${event.type}`);
    };
    peerConnection.onsignalingstatechange = (event: Event) => {
      this.uiManager.log(`Signaling state: ${event.type}`);
    };
  }

  private tearDownPeerConnection(peerConnection: RTCPeerConnection): void {
    peerConnection.ontrack = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.onicecandidate = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onicegatheringstatechange = null;
    peerConnection.onicecandidateerror = null;
    peerConnection.onnegotiationneeded = null;
    peerConnection.onsignalingstatechange = null;
    peerConnection.close();
  }

  private setConnecting(isConnecting: boolean, isReconnect?: boolean): void {
    this.isConnecting = isConnecting;
    this.uiManager.setPeerConnecting(isConnecting, isReconnect);
  }

  private setupRemoteTrackMonitoring(track: MediaStreamTrack): void {
    if (track.kind === "video") {
      const remoteVideo = this.uiManager.getRemoteVideoElement();
      this.mediaManager.startVideoMonitoring(
        remoteVideo,
        (status: "connected" | "disconnected") => {
          this.uiManager.setRemoteVideoTrackEnabled(status === "connected");
        },
      );

      track.onended = () => {
        this.uiManager.log(`Remote ${track.kind} track ended`);
      };

      track.onmute = () => {
        this.uiManager.setRemoteVideoOpacity("0");
      };

      track.onunmute = () => {
        if (track.enabled) {
          this.uiManager.setRemoteVideoOpacity("1");
        }
      };
    }
  }

  public async handleSignalingMessage(
    signalingMessage: SignalingMessage,
  ): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }

    if (signalingMessage.type === "role") {
      this.role = signalingMessage.data.role;
      const clientId = signalingMessage.data.clientId;
      const roomId = signalingMessage.data.roomId;
      this.uiManager.log(`I am the ${this.role} (${clientId})`);
      this.uiManager.setWebsocketStatus(roomId);

      if (this.role === "offerer") {
        await this.createAndSendOffer();
      } else {
        this.listenForChannel();
      }
    } else if (this.role === "answerer" && signalingMessage.type === "offer") {
      await this.handleOffer(signalingMessage.data);
    } else if (this.role === "offerer" && signalingMessage.type === "answer") {
      await this.handleAnswer(signalingMessage.data);
    }
  }

  // We wait to be given a channel by the offerer
  private listenForChannel(): void {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }
    this.uiManager.setPeerConnectionStep(this.role, "listening");

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannelManager.setupChannel(event.channel);
    };
  }

  // Handle the offer (connection information) from the offerer
  private async handleOffer(data: OfferOrAnswerData): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }
    this.uiManager.setPeerConnectionStep(this.role, "answering");

    await this.peerConnection.setRemoteDescription({
      type: "offer",
      sdp: data.sdp,
    });
    for (const candidate of data.ice) {
      await this.peerConnection.addIceCandidate(candidate);
    }

    const answer = await this.peerConnection.createAnswer();
    const iceCandidates = await this.setLocalDescription(answer);

    this.peerCoordinationManager.send({
      type: "answer",
      data: {
        sdp: answer.sdp!,
        ice: iceCandidates,
      },
    });
    this.uiManager.setPeerConnectionStep(this.role, "answered");
  }

  // We create a channel for the answerer
  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }
    this.uiManager.setPeerConnectionStep(this.role, "offering");

    const channel = this.peerConnection.createDataChannel("messages");
    this.dataChannelManager.setupChannel(channel);

    const offer = await this.peerConnection.createOffer();
    const iceCandidates = await this.setLocalDescription(offer);
    this.sendOffer(offer, iceCandidates);

    // Resend offer logic
    const offerResendInterval = setInterval(() => {
      if (this.peerConnection?.currentRemoteDescription === null) {
        this.uiManager.log("No answer received, resending offer...");
        this.sendOffer(offer, iceCandidates);
      } else {
        clearInterval(offerResendInterval);
      }
    }, 5000);
  }

  private sendOffer(
    offer: RTCSessionDescriptionInit,
    iceCandidates: RTCIceCandidate[],
  ): void {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }

    this.peerCoordinationManager.send({
      type: "offer",
      data: {
        sdp: offer.sdp!,
        ice: iceCandidates,
      },
    });
    this.uiManager.setPeerConnectionStep(this.role, "offered");
  }

  private async handleAnswer(data: OfferOrAnswerData): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }

    await this.peerConnection.setRemoteDescription({
      type: "answer",
      sdp: data.sdp,
    });
    for (const candidate of data.ice) {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  public cleanup(): void {
    if (this.peerConnection) {
      this.tearDownPeerConnection(this.peerConnection);
      this.peerConnection = null;
    }

    this.role = null;
  }

  public updateTrack(kind: "video" | "audio", enabled: boolean): void {
    if (!this.peerConnection) return;
    const senders = this.peerConnection.getSenders();
    const sender = senders.find((s) => s.track?.kind === kind);
    if (sender && sender.track) {
      sender.track.enabled = enabled;
    }
  }

  public handleSignalingOpen(): void {
    this.reconnectAttempts = 0;
  }

  private async setLocalDescription(
    description: RTCSessionDescriptionInit,
  ): Promise<RTCIceCandidate[]> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }

    await this.peerConnection.setLocalDescription(description);

    const iceCandidates: RTCIceCandidate[] = [];
    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        iceCandidates.push(event.candidate);
      }
    };

    await this.waitForIceGathering();

    return iceCandidates;
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (
        !this.peerConnection ||
        this.peerConnection.iceGatheringState === "complete"
      ) {
        resolve();
      } else {
        this.peerConnection.onicegatheringstatechange = () => {
          if (this.peerConnection?.iceGatheringState === "complete") {
            resolve();
          }
        };
      }
    });
  }
}
