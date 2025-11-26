"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // frontend/src/managers/UIManager.ts
  var UIManager;
  var init_UIManager = __esm({
    "frontend/src/managers/UIManager.ts"() {
      "use strict";
      UIManager = class {
        morseButton;
        ringButton;
        messageInput;
        sendButton;
        fullscreenToggle;
        videoToggle;
        audioToggle;
        toggleLocalVideoButton;
        remoteLight;
        localLight;
        videoStatus;
        remoteVideo;
        localVideo;
        messagesContainer;
        statusContainer;
        videoContainer;
        constructor() {
          this.morseButton = this.getElement("morseButton");
          this.ringButton = this.getElement("ringButton");
          this.messageInput = this.getElement("messageInput");
          this.sendButton = this.getElement("sendButton");
          this.fullscreenToggle = this.getElement("fullscreenToggle");
          this.videoToggle = this.getElement("videoToggle");
          this.audioToggle = this.getElement("audioToggle");
          this.toggleLocalVideoButton = this.getElement("toggleLocalVideo");
          this.remoteLight = this.getElement("remoteLight");
          this.localLight = this.getElement("localLight");
          this.videoStatus = this.getElement("videoStatus");
          this.remoteVideo = this.getElement("remoteVideo");
          this.localVideo = this.getElement("localVideo");
          this.messagesContainer = this.getElement("messages");
          this.statusContainer = this.getElement("status");
          this.videoContainer = document.querySelector("body");
          this.setupEventListeners();
        }
        getElement(id) {
          const el = document.getElementById(id);
          if (!el) {
            throw new Error(`Element with id '${id}' not found`);
          }
          return el;
        }
        // Event callbacks to be set by the App
        onSend = null;
        onRing = null;
        onMorseStart = null;
        onMorseStop = null;
        onVideoToggle = null;
        onAudioToggle = null;
        setupEventListeners() {
          this.messageInput.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.messageInput.focus();
          });
          this.messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.triggerSend();
          });
          this.sendButton.addEventListener("click", () => this.triggerSend());
          this.sendButton.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.triggerSend();
          }, { passive: false });
          this.ringButton.addEventListener("click", () => this.onRing?.());
          this.ringButton.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.onRing?.();
          }, { passive: false });
          const startMorse = (e) => {
            e.preventDefault();
            this.morseButton.classList.add("pressed");
            this.onMorseStart?.();
          };
          const stopMorse = (e) => {
            e.preventDefault();
            this.morseButton.classList.remove("pressed");
            this.onMorseStop?.();
          };
          this.morseButton.addEventListener("mousedown", startMorse);
          this.morseButton.addEventListener("mouseup", stopMorse);
          this.morseButton.addEventListener("touchstart", startMorse, { passive: false });
          this.morseButton.addEventListener("touchend", stopMorse, { passive: false });
          this.morseButton.addEventListener("touchcancel", stopMorse, { passive: false });
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
          this.fullscreenToggle.addEventListener("click", () => this.toggleFullscreen());
          this.fullscreenToggle.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.toggleFullscreen();
          }, { passive: false });
          document.addEventListener("fullscreenchange", () => {
            if (!document.fullscreenElement) {
              this.fullscreenToggle.classList.remove("active");
            }
          });
          this.videoToggle.addEventListener("click", (e) => {
            e.preventDefault();
            this.onVideoToggle?.();
          });
          this.videoToggle.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.onVideoToggle?.();
          }, { passive: false });
          this.audioToggle.addEventListener("click", (e) => {
            e.preventDefault();
            this.onAudioToggle?.();
          });
          this.audioToggle.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.onAudioToggle?.();
          }, { passive: false });
          this.toggleLocalVideoButton.addEventListener("click", (e) => this.toggleLocalVideoVisibility(e));
          this.toggleLocalVideoButton.addEventListener("touchstart", (e) => this.toggleLocalVideoVisibility(e), { passive: false });
        }
        triggerSend() {
          const message = this.messageInput.value.trim();
          if (message) {
            this.onSend?.(message);
            this.messageInput.value = "";
          }
        }
        async toggleFullscreen() {
          if (!document.fullscreenElement) {
            try {
              await this.videoContainer.requestFullscreen();
              this.fullscreenToggle.classList.add("active");
            } catch (err) {
              console.error(err);
            }
          } else {
            try {
              await document.exitFullscreen();
              this.fullscreenToggle.classList.remove("active");
            } catch (err) {
              console.error(err);
            }
          }
        }
        toggleLocalVideoVisibility(e) {
          e.preventDefault();
          const isVisible = this.localVideo.classList.toggle("visible");
          this.toggleLocalVideoButton.classList.toggle("visible", isVisible);
        }
        log(msg, type = "system") {
          if (type === "system") {
            console.log(msg);
            return;
          }
          const messageEl = document.createElement("div");
          messageEl.className = `message ${type}`;
          if (type === "message") {
            messageEl.classList.add("received");
          }
          const contentEl = document.createElement("div");
          contentEl.className = "message-content";
          contentEl.textContent = msg;
          const timeEl = document.createElement("span");
          timeEl.className = "message-time";
          timeEl.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString();
          messageEl.appendChild(contentEl);
          messageEl.appendChild(timeEl);
          if (type === "self") {
            messageEl.addEventListener("animationend", (e) => {
              if (e.animationName === "fadeOut") {
                messageEl.remove();
              }
            });
          } else {
            const dismiss = () => {
              if (!messageEl.classList.contains("closing")) {
                messageEl.classList.add("closing");
                messageEl.addEventListener("animationend", (e) => {
                  if (e.animationName === "fadeOut") {
                    messageEl.remove();
                  }
                });
              }
            };
            messageEl.addEventListener("click", dismiss);
            messageEl.addEventListener("touchstart", (e) => {
              e.preventDefault();
              dismiss();
            });
          }
          this.messagesContainer.appendChild(messageEl);
          messageEl.scrollIntoView({ behavior: "smooth" });
        }
        setConnectionState(state, isReconnecting) {
          if (state === "connected") {
            this.remoteLight.classList.add("active");
            this.remoteLight.classList.remove("disconnected");
            this.videoStatus.textContent = "";
            this.statusContainer.style.display = "none";
            if (this.localVideo.classList.contains("visible")) {
              this.localVideo.classList.remove("visible");
              this.toggleLocalVideoButton.classList.remove("visible");
            }
          } else {
            this.statusContainer.style.display = "";
            this.remoteLight.classList.remove("active");
            this.remoteLight.classList.add("disconnected");
            this.videoStatus.textContent = "Disconnected";
          }
        }
        setVideoStatus(status) {
          this.videoStatus.textContent = status;
        }
        setRemoteVideoOpacity(opacity) {
          this.remoteVideo.style.opacity = opacity;
        }
        setLocalVideoSrc(stream) {
          this.localVideo.srcObject = stream;
        }
        setRemoteVideoSrc(stream) {
          this.remoteVideo.srcObject = stream;
        }
        updateLocalMediaState(videoEnabled, audioEnabled) {
          this.localVideo.style.opacity = videoEnabled ? "1" : "0";
          this.localLight.classList.add("active");
          this.videoToggle.classList.toggle("disabled", !videoEnabled);
          this.audioToggle.classList.toggle("disabled", !audioEnabled);
        }
        setMediaError(type, msg) {
          if (type === "video") {
            this.videoToggle.classList.add("disabled");
            this.videoToggle.setAttribute("title", msg);
          } else {
            this.audioToggle.classList.add("disabled");
            this.audioToggle.setAttribute("title", msg);
          }
        }
        setRemoteLightActive(active) {
          if (active) {
            this.remoteLight.classList.add("active");
          } else {
            this.remoteLight.classList.remove("active");
          }
        }
        addRemoteTrack(track) {
          if (!this.remoteVideo.srcObject) {
            this.remoteVideo.srcObject = new MediaStream();
          }
          this.remoteVideo.srcObject.addTrack(track);
        }
        getRemoteVideoElement() {
          return this.remoteVideo;
        }
        setRemoteVideoTrackEnabled(enabled) {
          const stream = this.remoteVideo.srcObject;
          if (stream) {
            const track = stream.getVideoTracks()[0];
            if (track) {
              track.enabled = enabled;
            }
          }
        }
      };
    }
  });

  // frontend/src/managers/SoundManager.ts
  var SoundManager;
  var init_SoundManager = __esm({
    "frontend/src/managers/SoundManager.ts"() {
      "use strict";
      SoundManager = class {
        audioContext = null;
        oscillator = null;
        errorSound;
        connectSound;
        messageSound;
        switchSound;
        ringSound;
        constructor() {
          this.errorSound = new Audio("audios/error.mp3");
          this.connectSound = new Audio("audios/join.mp3");
          this.messageSound = new Audio("audios/message.mp3");
          this.switchSound = new Audio("audios/switch.mp3");
          this.ringSound = new Audio("audios/ring.mp3");
        }
        async playError() {
          await this.errorSound.play();
        }
        async playConnect() {
          await this.connectSound.play();
        }
        async playMessage() {
          await this.messageSound.play();
        }
        async playSwitch() {
          await this.switchSound.play();
        }
        async playRing() {
          await this.ringSound.play();
        }
        async playSound(path) {
          const audio = new Audio(path);
          await audio.play();
        }
        startMorseBeep() {
          if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          }
          if (!this.oscillator) {
            this.oscillator = this.audioContext.createOscillator();
            this.oscillator.type = "sine";
            this.oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            this.oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            this.oscillator.start();
          }
        }
        stopMorseBeep() {
          if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
          }
        }
        async cleanup() {
          this.stopMorseBeep();
          if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
          }
        }
      };
    }
  });

  // frontend/src/managers/MediaManager.ts
  var MediaManager;
  var init_MediaManager = __esm({
    "frontend/src/managers/MediaManager.ts"() {
      "use strict";
      MediaManager = class {
        localStream = null;
        videoEnabled = true;
        audioEnabled = true;
        videoCheckInterval;
        constructor() {
        }
        async getLocalMedia() {
          if (this.localStream) {
            return { stream: this.localStream, videoEnabled: this.videoEnabled, audioEnabled: this.audioEnabled };
          }
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true
            });
            this.videoEnabled = true;
            this.audioEnabled = true;
          } catch (err) {
            console.log("Could not get video permission, trying audio only...");
            try {
              this.localStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
              });
              this.videoEnabled = false;
              this.audioEnabled = true;
            } catch (audioErr) {
              console.log("Could not get audio permission either, continuing without media...");
              this.localStream = new MediaStream();
              this.videoEnabled = false;
              this.audioEnabled = false;
            }
          }
          return { stream: this.localStream, videoEnabled: this.videoEnabled, audioEnabled: this.audioEnabled };
        }
        toggleVideo() {
          if (!this.localStream) return false;
          const videoTrack = this.localStream.getVideoTracks()[0];
          if (videoTrack) {
            this.videoEnabled = !this.videoEnabled;
            videoTrack.enabled = this.videoEnabled;
            return this.videoEnabled;
          }
          return false;
        }
        toggleAudio() {
          if (!this.localStream) return false;
          const audioTrack = this.localStream.getAudioTracks()[0];
          if (audioTrack) {
            this.audioEnabled = !this.audioEnabled;
            audioTrack.enabled = this.audioEnabled;
            return this.audioEnabled;
          }
          return false;
        }
        getStream() {
          return this.localStream;
        }
        isVideoEnabled() {
          return this.videoEnabled;
        }
        isAudioEnabled() {
          return this.audioEnabled;
        }
        startVideoMonitoring(remoteVideo, onStatusChange) {
          this.stopVideoMonitoring();
          this.videoCheckInterval = setInterval(() => {
            const stream = remoteVideo.srcObject;
            const videoTrack = stream?.getVideoTracks()[0];
            if (!stream) {
              onStatusChange("Disconnected", "0");
            } else if (!videoTrack) {
              onStatusChange("No video available", "0");
            } else if (!videoTrack.enabled || videoTrack.readyState === "ended") {
              onStatusChange("Video paused", "0");
            } else {
              onStatusChange("", "1");
            }
          }, 1e3);
        }
        stopVideoMonitoring() {
          if (this.videoCheckInterval) {
            clearInterval(this.videoCheckInterval);
            this.videoCheckInterval = void 0;
          }
        }
        cleanup() {
          this.stopVideoMonitoring();
          if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
          }
        }
      };
    }
  });

  // frontend/src/managers/ConnectionManager.ts
  var ConnectionManager;
  var init_ConnectionManager = __esm({
    "frontend/src/managers/ConnectionManager.ts"() {
      "use strict";
      ConnectionManager = class {
        ws = null;
        pc = null;
        role = null;
        reconnectAttempts = 0;
        isReconnecting = false;
        reconnectionTimeout;
        wsUrl;
        // Dependencies
        localStream;
        dataChannelManager;
        // Callbacks
        onTrack = null;
        onConnectionStateChange = null;
        onLog = null;
        constructor(localStream, dataChannelManager) {
          this.localStream = localStream;
          this.dataChannelManager = dataChannelManager;
          this.wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
        }
        async start(isReconnect = false) {
          if (this.isReconnecting) {
            this.log("Already attempting to reconnect...");
            return;
          }
          this.isReconnecting = true;
          try {
            if (isReconnect) {
              this.log("Attempting to reconnect...");
              await this.cleanup();
              const delay = Math.min(1e3 * Math.pow(2, this.reconnectAttempts), 1e4);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
            this.pc = new RTCPeerConnection({});
            this.localStream.getTracks().forEach((track) => {
              if (this.pc) this.pc.addTrack(track, this.localStream);
            });
            this.pc.ontrack = (evt) => {
              this.log(`Received remote ${evt.track.kind} track`);
              this.onTrack?.(evt.track);
            };
            this.pc.onconnectionstatechange = () => {
              if (!this.pc) return;
              const state = this.pc.connectionState;
              this.log(`Connection state: ${state}`);
              this.onConnectionStateChange?.(state);
              if (state === "connected") {
                this.isReconnecting = false;
                this.reconnectAttempts = 0;
                this.ws?.close();
              } else if (state === "failed" || state === "disconnected") {
                if (!this.isReconnecting) {
                  this.start(true);
                }
              }
            };
            this.ws = new WebSocket(this.wsUrl);
            this.setupWsHandlers();
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
          } catch (err) {
            this.isReconnecting = false;
            this.log("Connection error: " + (err instanceof Error ? err.message : String(err)));
            this.reconnectAttempts++;
            const delay = Math.min(1e3 * Math.pow(2, this.reconnectAttempts), 1e4);
            this.reconnectionTimeout = setTimeout(() => this.start(true), delay);
            throw err;
          }
        }
        setupWsHandlers() {
          if (!this.ws) return;
          this.ws.onopen = () => {
            this.log("WebSocket connected");
            this.reconnectAttempts = 0;
          };
          this.ws.onmessage = async (evt) => {
            const msg = JSON.parse(evt.data);
            this.log("Received: " + msg.type);
            try {
              if (msg.type === "role") {
                this.role = msg.data.role;
                this.log(`I am the ${this.role}`);
                if (this.role === "offerer") {
                  if (this.pc) {
                    const channel = this.pc.createDataChannel("messages");
                    this.dataChannelManager.setupChannel(channel);
                  }
                  await this.createAndSendOffer();
                } else {
                  if (this.pc) {
                    this.pc.ondatachannel = (event) => {
                      this.dataChannelManager.setupChannel(event.channel);
                    };
                  }
                }
              } else if (msg.type === "offer" && this.role === "answerer") {
                await this.handleOffer(msg.data);
              } else if (msg.type === "answer" && this.role === "offerer") {
                await this.handleAnswer(msg.data);
              }
            } catch (err) {
              this.log("Error handling message: " + (err instanceof Error ? err.message : String(err)));
            }
          };
          this.ws.onclose = () => {
            this.log("WebSocket closed");
            if (!this.pc || this.pc.connectionState !== "connected" && !this.isReconnecting) {
              this.reconnectAttempts++;
              const delay = Math.min(1e3 * Math.pow(2, this.reconnectAttempts), 1e4);
              this.log(`Reconnecting in ${delay / 1e3} seconds...`);
              this.reconnectionTimeout = setTimeout(() => this.start(true), delay);
            }
          };
          this.ws.onerror = (error) => {
            this.log("WebSocket error");
          };
        }
        async createAndSendOffer() {
          if (!this.pc || !this.ws) return;
          const offer = await this.pc.createOffer();
          await this.pc.setLocalDescription(offer);
          const iceCandidates = [];
          this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
              iceCandidates.push(evt.candidate);
            }
          };
          await this.waitForIceGathering();
          const sendOffer = () => {
            this.ws?.send(JSON.stringify({
              type: "offer",
              data: {
                sdp: this.pc?.localDescription?.sdp,
                ice: iceCandidates
              }
            }));
            this.log("Sent offer");
          };
          sendOffer();
          const offerResendInterval = setInterval(() => {
            if (this.pc?.currentRemoteDescription === null) {
              this.log("No answer received, resending offer...");
              sendOffer();
            } else {
              clearInterval(offerResendInterval);
            }
          }, 5e3);
        }
        async handleOffer(data) {
          if (!this.pc || !this.ws) return;
          await this.pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
          for (const candidate of data.ice) {
            await this.pc.addIceCandidate(candidate);
          }
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          const iceCandidates = [];
          this.pc.onicecandidate = (evt) => {
            if (evt.candidate) iceCandidates.push(evt.candidate);
          };
          await this.waitForIceGathering();
          this.ws.send(JSON.stringify({
            type: "answer",
            data: {
              sdp: this.pc.localDescription?.sdp,
              ice: iceCandidates
            }
          }));
          this.log("Sent answer");
        }
        async handleAnswer(data) {
          if (!this.pc) return;
          await this.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
          for (const candidate of data.ice) {
            await this.pc.addIceCandidate(candidate);
          }
        }
        waitForIceGathering() {
          return new Promise((resolve) => {
            if (!this.pc || this.pc.iceGatheringState === "complete") {
              resolve();
            } else {
              this.pc.onicegatheringstatechange = () => {
                if (this.pc?.iceGatheringState === "complete") {
                  resolve();
                }
              };
            }
          });
        }
        async cleanup() {
          if (this.reconnectionTimeout) clearTimeout(this.reconnectionTimeout);
          if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
          }
          if (this.pc) {
            this.pc.onconnectionstatechange = null;
            this.pc.oniceconnectionstatechange = null;
            this.pc.close();
            this.pc = null;
          }
          this.role = null;
        }
        log(msg) {
          this.onLog?.(msg);
        }
        updateTrack(kind, enabled) {
          if (!this.pc) return;
          const senders = this.pc.getSenders();
          const sender = senders.find((s) => s.track?.kind === kind);
          if (sender && sender.track) {
            sender.track.enabled = enabled;
          }
        }
      };
    }
  });

  // frontend/src/managers/DataChannelManager.ts
  var DataChannelManager;
  var init_DataChannelManager = __esm({
    "frontend/src/managers/DataChannelManager.ts"() {
      "use strict";
      DataChannelManager = class {
        dataChannel = null;
        onMessage = null;
        onSound = null;
        onMorse = null;
        onVideoStateChange = null;
        onOpen = null;
        onClose = null;
        onError = null;
        constructor() {
        }
        setupChannel(channel) {
          this.dataChannel = channel;
          this.dataChannel.onopen = () => {
            this.onOpen?.();
          };
          this.dataChannel.onclose = () => {
            this.onClose?.();
          };
          this.dataChannel.onerror = (error) => {
            this.onError?.(error);
          };
          this.dataChannel.onmessage = (event) => this.handleMessage(event);
        }
        send(type, data) {
          if (this.dataChannel?.readyState === "open") {
            this.dataChannel.send(JSON.stringify({ type, data }));
          } else {
            throw new Error("Data channel not ready");
          }
        }
        sendMessage(text) {
          this.send("message", window.btoa(text));
        }
        sendSound(path) {
          this.send("sound", path);
        }
        sendMorse(start) {
          this.send("morse", start);
        }
        sendVideoState(enabled) {
          this.send("videoState", { enabled });
        }
        /* 
        In app.js:
        dataChannel.send(JSON.stringify({
            type: "videoState",
            enabled: videoEnabled,
        }));
        
        BUT in my send() method I wrap it: { type, data }. 
        So if I call send("videoState", {enabled: true}), it sends { type: "videoState", data: {enabled: true} }.
        
        Let's look at app.js receiver:
        case "videoState":
            // ...
            videoTrack.enabled = data.enabled;
        
        Wait, app.js sends:
           JSON.stringify({
                  type: "videoState",
                  enabled: videoEnabled,
                })
        
        It DOES NOT wrap it in `data`. The structure varies.
        "message" -> { type: "message", data: b64 }
        "sound" -> { type: "sound", data: path }
        "morse" -> { type: "morse", data: boolean }
        "videoState" -> { type: "videoState", enabled: boolean }
        
        So I need to be careful.
        */
        sendRaw(obj) {
          if (this.dataChannel?.readyState === "open") {
            this.dataChannel.send(JSON.stringify(obj));
          }
        }
        handleMessage(event) {
          const msg = JSON.parse(event.data);
          console.log("Data channel message:", msg);
          switch (msg.type) {
            case "videoState":
              this.onVideoStateChange?.(msg.enabled);
              break;
            case "message":
              this.onMessage?.(atob(msg.data));
              break;
            case "sound":
              this.onSound?.(msg.data);
              break;
            case "morse":
              this.onMorse?.(msg.data);
              break;
            default:
              console.log(`Unhandled message type: ${msg.type}`);
          }
        }
        close() {
          if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
          }
        }
        isOpen() {
          return this.dataChannel?.readyState === "open";
        }
      };
    }
  });

  // frontend/src/App.ts
  var App;
  var init_App = __esm({
    "frontend/src/App.ts"() {
      "use strict";
      init_UIManager();
      init_SoundManager();
      init_MediaManager();
      init_ConnectionManager();
      init_DataChannelManager();
      App = class {
        uiManager;
        soundManager;
        mediaManager;
        dataChannelManager;
        connectionManager = null;
        constructor() {
          this.uiManager = new UIManager();
          this.soundManager = new SoundManager();
          this.mediaManager = new MediaManager();
          this.dataChannelManager = new DataChannelManager();
          this.setupBindings();
        }
        setupBindings() {
          this.uiManager.onSend = (message) => {
            if (this.dataChannelManager.isOpen()) {
              this.dataChannelManager.sendMessage(message);
              this.uiManager.log(message, "self");
            } else {
              this.uiManager.log("Data channel not ready");
            }
          };
          this.uiManager.onRing = () => {
            if (this.dataChannelManager.isOpen()) {
              this.dataChannelManager.sendSound("audios/ring.mp3");
              this.uiManager.log("Ring sent");
            } else {
              this.uiManager.log("Data channel not ready");
            }
          };
          this.uiManager.onMorseStart = () => {
            if (this.dataChannelManager.isOpen()) {
              this.dataChannelManager.sendMorse(true);
              this.soundManager.startMorseBeep();
            }
          };
          this.uiManager.onMorseStop = () => {
            if (this.dataChannelManager.isOpen()) {
              this.dataChannelManager.sendMorse(false);
              this.soundManager.stopMorseBeep();
            } else {
              this.soundManager.stopMorseBeep();
            }
          };
          this.uiManager.onVideoToggle = () => {
            const enabled = this.mediaManager.toggleVideo();
            this.uiManager.updateLocalMediaState(this.mediaManager.isVideoEnabled(), this.mediaManager.isAudioEnabled());
            this.uiManager.log(`Video ${enabled ? "enabled" : "disabled"}`);
            if (this.connectionManager) {
              this.connectionManager.updateTrack("video", enabled);
            }
            if (this.dataChannelManager.isOpen()) {
              this.dataChannelManager.sendVideoState(enabled);
            }
            this.soundManager.playSwitch();
          };
          this.uiManager.onAudioToggle = () => {
            const enabled = this.mediaManager.toggleAudio();
            this.uiManager.updateLocalMediaState(this.mediaManager.isVideoEnabled(), this.mediaManager.isAudioEnabled());
            this.uiManager.log(`Audio ${enabled ? "enabled" : "disabled"}`);
            if (this.connectionManager) {
              this.connectionManager.updateTrack("audio", enabled);
            }
            this.soundManager.playSwitch();
          };
          this.dataChannelManager.onMessage = (msg) => {
            this.uiManager.log(msg, "message");
            this.soundManager.playMessage();
          };
          this.dataChannelManager.onSound = (path) => {
            this.soundManager.playSound(path);
          };
          this.dataChannelManager.onMorse = (start) => {
            if (start) {
              this.soundManager.startMorseBeep();
            } else {
              this.soundManager.stopMorseBeep();
            }
          };
          this.dataChannelManager.onVideoStateChange = (enabled) => {
            this.uiManager.setRemoteVideoTrackEnabled(enabled);
          };
          this.dataChannelManager.onOpen = () => {
            this.uiManager.log("Data channel opened");
            this.uiManager.setRemoteLightActive(true);
          };
          this.dataChannelManager.onClose = () => {
            this.uiManager.log("Data channel closed");
            this.uiManager.setRemoteLightActive(false);
            if (this.connectionManager) {
              this.uiManager.log("Data channel closed, attempting to reconnect...");
              this.connectionManager.start(true);
            }
          };
          this.dataChannelManager.onError = (err) => {
            this.uiManager.log(`Data channel error`);
            if (this.connectionManager) {
              this.uiManager.log("Data channel error, attempting to reconnect...");
              this.connectionManager.start(true);
            }
          };
        }
        async init() {
          try {
            this.uiManager.log("Requesting local media...");
            const { stream, videoEnabled, audioEnabled } = await this.mediaManager.getLocalMedia();
            this.uiManager.setLocalVideoSrc(stream);
            this.uiManager.updateLocalMediaState(videoEnabled, audioEnabled);
            if (!videoEnabled && !audioEnabled) {
              this.uiManager.setMediaError("video", "Permission denied");
              this.uiManager.setMediaError("audio", "Permission denied");
            } else if (!videoEnabled) {
              this.uiManager.setMediaError("video", "Permission denied");
            }
            this.uiManager.log(`Local media acquired: ${stream.getTracks().map((t) => t.kind).join(", ")}`);
            this.connectionManager = new ConnectionManager(stream, this.dataChannelManager);
            this.connectionManager.onLog = (msg) => this.uiManager.log(msg);
            this.connectionManager.onTrack = (track) => {
              this.uiManager.addRemoteTrack(track);
              if (track.kind === "video") {
                const remoteVideo = this.uiManager.getRemoteVideoElement();
                this.mediaManager.startVideoMonitoring(remoteVideo, (status, opacity) => {
                  this.uiManager.setVideoStatus(status);
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
            };
            this.connectionManager.onConnectionStateChange = (state) => {
              this.uiManager.setConnectionState(state, false);
              if (state === "connected") {
                this.soundManager.playConnect();
              }
            };
            await this.connectionManager.start();
          } catch (err) {
            this.uiManager.log("Failed to start: " + (err instanceof Error ? err.message : String(err)));
          }
          window.addEventListener("beforeunload", () => this.cleanup());
        }
        cleanup() {
          this.connectionManager?.cleanup();
          this.mediaManager.cleanup();
          this.soundManager.cleanup();
        }
      };
    }
  });

  // frontend/src/index.ts
  var require_index = __commonJS({
    "frontend/src/index.ts"() {
      init_App();
      document.addEventListener("DOMContentLoaded", () => {
        const app = new App();
        app.init();
      });
    }
  });
  require_index();
})();
