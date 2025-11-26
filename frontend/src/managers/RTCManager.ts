import { OfferOrAnswerData, Role, SignalingMessage } from "../types";
import { PeerCoordinationManager } from "./PeerCoordinationManager";
import { MediaManager } from "./MediaManager";
import { DataChannelManager } from "./DataChannelManager";
import { UIManager } from "./UIManager";

export class RTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private role: Role = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private reconnectionTimeout: number | undefined;

  constructor(
    private peerCoordinationManager: PeerCoordinationManager,
    private mediaManager: MediaManager,
    private dataChannelManager: DataChannelManager,
    private uiManager: UIManager
  ) {}

  private async reconnect(): Promise<void> {
    if (this.reconnectionTimeout) {
      // Already attempting to reconnect
      return;
    }

    this.reconnectAttempts++;
    this.uiManager.log("Attempting to reconnect...");
    await this.cleanup(false);
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    await new Promise((resolve) => {
      this.reconnectionTimeout = setTimeout(resolve, delay);
      this.reconnectionTimeout = undefined;
    });
    return this.start(true);
  }

  public async start(isReconnect = false): Promise<void> {
    if (this.isConnecting || this.reconnectionTimeout) {
      this.uiManager.log("Already attempting to reconnect...");
      return;
    }

    this.setConnecting(true, isReconnect);

    try {
      if (this.peerConnection) {
        this.tearDownPeerConnection(this.peerConnection);
      }
      const peerConnection = new RTCPeerConnection({});
      this.peerConnection = peerConnection;

      this.initializePeerConnection(peerConnection);

      this.peerCoordinationManager.connect(this);
    } catch (error: unknown) {
      this.setConnecting(false);
      this.uiManager.log("Connection error: " + (error instanceof Error ? error.message : String(error)));
      this.reconnect();
      throw error;
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
      const state = peerConnection.connectionState;
      this.uiManager.log(`Connection state: ${state}`);
      // this.uiManager.setPeerConnectionStatus(state);

      if (state === "connected") {
        this.setConnecting(false);
        this.reconnectAttempts = 0;
        this.peerCoordinationManager.close(); // Close WS on successful P2P
      } else if (state === "failed" || state === "disconnected") {
        this.reconnect();
      }
    };

    peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      this.uiManager.log(`ICE candidate: ${event.candidate?.candidate}`);
    };
    peerConnection.oniceconnectionstatechange = (event: Event) => {
      this.uiManager.log(`ICE connection state: ${event}`);
    };
    peerConnection.onicegatheringstatechange = (event: Event) => {
      this.uiManager.log(`ICE gathering state: ${event}`);
    };
    peerConnection.onicecandidateerror = (event: RTCPeerConnectionIceErrorEvent) => {
      this.uiManager.log(`ICE candidate error: ${event.errorCode} ${event.errorText}`);
    };
    peerConnection.onnegotiationneeded = (event: Event) => {
      this.uiManager.log(`Negotiation needed: ${event}`);
    };
    peerConnection.onsignalingstatechange = (event: Event) => {
      this.uiManager.log(`Signaling state: ${event}`);
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
      this.mediaManager.startVideoMonitoring(remoteVideo, (status, opacity) => {
        this.uiManager.setRemoteVideoStatus(status);
        this.uiManager.setRemoteVideoOpacity(opacity);
      });

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

  public async handleSignalingMessage(signalingMessage: SignalingMessage): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }

    if (signalingMessage.type === "role") {
      this.role = signalingMessage.data.role;
      const clientId = signalingMessage.data.clientId || "unknown";
      this.uiManager.log(`I am the ${this.role} (${clientId})`);

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
    this.uiManager.setPeerConnectionStatus(this.role, "listening");

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannelManager.setupChannel(event.channel);
    };
  }

  // Handle the offer (connection information) from the offerer
  private async handleOffer(data: OfferOrAnswerData): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }
    this.uiManager.setPeerConnectionStatus(this.role, "answering");

    await this.peerConnection.setRemoteDescription({ type: "offer", sdp: data.sdp });
    for (const candidate of data.ice) {
      await this.peerConnection.addIceCandidate(candidate);
    }

    const answer = await this.peerConnection.createAnswer();
    if (!answer.sdp) {
      throw new Error("Answer SDP not created");
    }
    await this.peerConnection.setLocalDescription(answer);

    const iceCandidates: RTCIceCandidate[] = [];
    this.peerConnection.onicecandidate = (evt) => {
      if (evt.candidate) iceCandidates.push(evt.candidate);
    };

    await this.waitForIceGathering();

    this.peerCoordinationManager.send({
      type: "answer",
      data: {
        sdp: answer.sdp,
        ice: iceCandidates,
      },
    });
    this.uiManager.setPeerConnectionStatus(this.role, "answered");
  }

  // We create a channel for the answerer
  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }
    this.uiManager.setPeerConnectionStatus(this.role, "offering");

    const channel = this.peerConnection.createDataChannel("messages");
    this.dataChannelManager.setupChannel(channel);

    const offer: RTCSessionDescriptionInit = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    const iceCandidates: RTCIceCandidate[] = [];
    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        iceCandidates.push(event.candidate);
      }
    };

    await this.waitForIceGathering();

    this.sendOffer(offer, iceCandidates);

    // Resend offer logic
    const offerResendInterval = setInterval(async () => {
      if (this.peerConnection?.currentRemoteDescription === null) {
        this.uiManager.log("No answer received, resending offer...");
        this.sendOffer(offer, iceCandidates);
      } else {
        clearInterval(offerResendInterval);
      }
    }, 5000);
  }

  private sendOffer(offer: RTCSessionDescriptionInit, iceCandidates: RTCIceCandidate[]): void {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    } else if (!offer.sdp) {
      throw new Error("Offer SDP not created");
    }

    this.peerCoordinationManager.send({
      type: "offer",
      data: {
        sdp: offer.sdp,
        ice: iceCandidates,
      },
    });
    this.uiManager.setPeerConnectionStatus(this.role, "offered");
  }

  private async handleAnswer(data: OfferOrAnswerData): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not created");
    }

    await this.peerConnection.setRemoteDescription({ type: "answer", sdp: data.sdp });
    for (const candidate of data.ice) {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.peerConnection || this.peerConnection.iceGatheringState === "complete") {
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

  public async cleanup(full = true): Promise<void> {
    if (this.reconnectionTimeout) clearTimeout(this.reconnectionTimeout);

    if (full) {
      this.peerCoordinationManager.close();
    }

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

  public handleSignalingClose(): void {
    // We don't care if the signaller
    if (!this.peerConnection || (this.peerConnection.connectionState !== "connected" && !this.isConnecting)) {
      this.reconnect();
    }
  }
}
