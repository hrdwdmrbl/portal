document.addEventListener("DOMContentLoaded", async () => {
  const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
  let ws;
  let pc;
  let localStream;
  let role = null;
  let reconnectAttempts = 0;
  let isReconnecting = false;
  let videoCheckInterval;
  let dataChannel = null;
  let reconnectionTimeout;

  // Add track state variables
  let videoEnabled = true;
  let audioEnabled = true;

  // Add after other variable declarations
  let audioContext;
  let oscillator;

  // Add at the top with other variable declarations
  let errorSound = new Audio("audios/error.mp3");
  let connectSound = new Audio("audios/join.mp3");

  let localVideoVisible = true;

  const morseButton = document.getElementById("morseButton");
  const ringButton = document.getElementById("ringButton");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");

  messageInput.ontouchstart = (e) => {
    e.preventDefault();
    messageInput.focus();
  };

  // Add fullscreen button handler
  const fullscreenToggle = document.getElementById("fullscreenToggle");
  const videoContainer = document.querySelector("body");

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      try {
        await videoContainer.requestFullscreen();
        fullscreenToggle.classList.add("active");
      } catch (err) {
        console.log(err);
      }
    } else {
      try {
        await document.exitFullscreen();
        fullscreenToggle.classList.remove("active");
      } catch (err) {
        console.log(err);
      }
    }
  }

  // Handle fullscreen change events
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      fullscreenToggle.classList.remove("active");
    }
  });

  // Add click and touch handlers for fullscreen button
  fullscreenToggle.addEventListener("click", toggleFullscreen);
  fullscreenToggle.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      toggleFullscreen();
    },
    { passive: false }
  );

  // Update the log function
  function log(msg, type = "system") {
    if (type === "system") {
      console.log(msg);
      return;
    }

    const messagesEl = document.getElementById("messages");
    if (!messagesEl) {
      console.error("Messages container not found");
      return;
    }

    const messageEl = document.createElement("div");
    messageEl.className = `message ${type}`; // Simplified class assignment

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";
    contentEl.textContent = msg;

    const timeEl = document.createElement("span");
    timeEl.className = "message-time";
    timeEl.textContent = new Date().toLocaleTimeString();

    messageEl.appendChild(contentEl);
    messageEl.appendChild(timeEl);

    // Handle different message types
    if (type === "self") {
      messageEl.addEventListener("animationend", (e) => {
        if (e.animationName === "fadeOut") {
          messageEl.remove();
        }
      });
    } else {
      // Click-to-dismiss for all other messages
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
        e.preventDefault(); // Prevent ghost clicks
        dismiss();
      });
    }

    if (type === "message") {
      messageEl.classList.add("received");
    }

    messagesEl.appendChild(messageEl);
    messageEl.scrollIntoView({ behavior: "smooth" });
  }

  // Modify the cleanupConnection function to not reset media states
  async function cleanupConnection() {
    clearTimeout(reconnectionTimeout);

    if (videoCheckInterval && ws) {
      ws.onclose = null; // Remove onclose handler to prevent reconnection
      ws.close();
      ws = null;
    }

    // Close and cleanup PeerConnection
    if (pc) {
      pc.onconnectionstatechange = null; // Remove state change handler
      pc.oniceconnectionstatechange = null;
      pc.close();
      pc = null;
    }

    if (dataChannel) {
      dataChannel.close();
      dataChannel = null;
      errorSound.play().catch((err) => log("Error playing sound: " + err.message));
    }

    // Reset connection variables but preserve media states
    role = null;
    isReconnecting = false;
    reconnectAttempts = 0;

    // Reset connection status
    const remoteLight = document.getElementById("remoteLight");
    remoteLight.classList.remove("active");
    remoteLight.classList.add("disconnected");

    // Reset video status and stream
    document.getElementById("videoStatus").textContent = "Disconnected";
    document.getElementById("remoteVideo").srcObject = null;
    // Unhide - Return to default state, whatever CSS is set
    document.getElementById("status").style.display = "";

    // Reset morse state
    isPressed = false;
    morseButton?.classList.remove("pressed");

    stopBeep();
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }
  }

  // Update setupVideoMonitoring function
  function setupVideoMonitoring() {
    const remoteVideo = document.getElementById("remoteVideo");
    const videoStatus = document.getElementById("videoStatus");

    clearInterval(videoCheckInterval);
    videoCheckInterval = setInterval(() => {
      const stream = remoteVideo.srcObject;
      const videoTrack = stream?.getVideoTracks()[0];

      if (!stream) {
        videoStatus.textContent = "Disconnected";
        remoteVideo.style.opacity = "0";
      } else if (!videoTrack) {
        videoStatus.textContent = "No video available"; // Update status for audio-only
        remoteVideo.style.opacity = "0";
      } else if (!videoTrack.enabled || videoTrack.readyState === "ended") {
        videoStatus.textContent = "Video paused";
        remoteVideo.style.opacity = "0";
      } else {
        videoStatus.textContent = "";
        remoteVideo.style.opacity = "1";
      }
    }, 1000);
  }

  function setupDataChannel(isOfferer) {
    if (isOfferer) {
      dataChannel = pc.createDataChannel("messages");
      setupDataChannelHandlers(dataChannel);
    } else {
      pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannelHandlers(dataChannel);
      };
    }
  }

  function setupDataChannelHandlers(channel) {
    channel.onopen = () => {
      log("Data channel opened");
      document.getElementById("remoteLight").classList.add("active");
    };

    channel.onclose = () => {
      log("Data channel closed");
      document.getElementById("remoteLight").classList.remove("active");
      // Trigger immediate reconnection if not already reconnecting
      if (!isReconnecting) {
        log("Data channel closed, attempting to reconnect...");
        startConnection(true);
      }
    };

    channel.onerror = (error) => {
      log(`Data channel error: ${error.message}`);
      // Also trigger reconnection on error if not already reconnecting
      if (!isReconnecting) {
        log("Data channel error, attempting to reconnect...");
        startConnection(true);
      }
    };

    channel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Data channel message:", data);
      switch (data.type) {
        case "videoState":
          // Update UI when remote video state changes
          const remoteVideo = document.getElementById("remoteVideo");
          if (remoteVideo.srcObject) {
            const videoTrack = remoteVideo.srcObject.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.enabled = data.enabled;
            }
          }
          break;

        case "message": {
          // Decode base64 message and log it
          const decodedMessage = atob(data.data);
          log(`${decodedMessage}`, "message");
          // play audio
          const audio = new Audio("audios/message.mp3");
          audio.play().catch((err) => log("Error playing sound: " + err.message));
          break;
        }
        case "sound": {
          // Play sound
          const audio = new Audio(data.data);
          audio.play().catch((err) => log("Error playing sound: " + err.message));
          break;
        }
        case "morse":
          if (data.data) {
            if (!audioContext) {
              audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (!oscillator) {
              oscillator = audioContext.createOscillator();
              oscillator.type = "sine";
              oscillator.frequency.setValueAtTime(800, audioContext.currentTime);

              const gainNode = audioContext.createGain();
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              oscillator.start();
            }
          } else {
            stopBeep();
          }
          break;
        default:
          log(`Unhandled message type: ${data.type}`);
      }
    };
  }

  // Update toggle functions to handle touch events
  function toggleVideo(e) {
    e.preventDefault();
    const videoToggle = document.getElementById("videoToggle");
    const videoTrack = localStream.getVideoTracks()[0];

    if (videoTrack) {
      videoEnabled = !videoEnabled;
      videoTrack.enabled = videoEnabled;

      // Update sender track
      const senders = pc?.getSenders();
      const videoSender = senders?.find((sender) => sender.track?.kind === "video");
      if (videoSender && videoSender.track) {
        videoSender.track.enabled = videoEnabled;
      }

      // Update button state
      videoToggle.classList.toggle("disabled", !videoEnabled);

      log(`Video ${videoEnabled ? "enabled" : "disabled"}`);

      // Send status via data channel
      if (dataChannel?.readyState === "open") {
        dataChannel.send(
          JSON.stringify({
            type: "videoState",
            enabled: videoEnabled,
          })
        );
      }
      const audio = new Audio("audios/switch.mp3");
      audio.play().catch((err) => log("Error playing sound: " + err.message));
    }
  }

  // Update toggle functions to handle touch events
  function toggleAudio(e) {
    e.preventDefault();
    const audioToggle = document.getElementById("audioToggle");
    const audioTrack = localStream.getAudioTracks()[0];

    if (audioTrack) {
      audioEnabled = !audioEnabled;
      audioTrack.enabled = audioEnabled;

      // Update sender track
      const senders = pc?.getSenders();
      const audioSender = senders?.find((sender) => sender.track?.kind === "audio");
      if (audioSender && audioSender.track) {
        audioSender.track.enabled = audioEnabled;
      }

      // Update button state
      audioToggle.classList.toggle("disabled", !audioEnabled);

      log(`Audio ${audioEnabled ? "enabled" : "disabled"}`);
      const audio = new Audio("audios/switch.mp3");
      audio.play().catch((err) => log("Error playing sound: " + err.message));
    }
  }

  // Update setupMediaControls with touch events
  async function setupMediaControls() {
    const videoToggle = document.getElementById("videoToggle");
    const audioToggle = document.getElementById("audioToggle");

    // Update initial button states
    videoToggle.classList.toggle("disabled", !videoEnabled);
    audioToggle.classList.toggle("disabled", !audioEnabled);

    // Only add listeners if media is available
    if (localStream.getVideoTracks().length > 0) {
      videoToggle.addEventListener("click", toggleVideo);
      videoToggle.addEventListener("touchstart", toggleVideo, { passive: false });
    }

    if (localStream.getAudioTracks().length > 0) {
      audioToggle.addEventListener("click", toggleAudio);
      audioToggle.addEventListener("touchstart", toggleAudio, { passive: false });
    }

    // Add other control listeners
    ringButton.addEventListener("click", sendRingSound);
    ringButton.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        sendRingSound();
      },
      { passive: false }
    );
  }

  async function startConnection(isReconnect = false) {
    if (isReconnecting) {
      log("Already attempting to reconnect...");
      return;
    }

    isReconnecting = true;

    try {
      if (isReconnect) {
        log("Attempting to reconnect...");
        await cleanupConnection();
        // Add delay before reconnecting with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Modify the media setup section in startConnection
      if (!localStream) {
        log("Requesting local media...");

        try {
          // First try to get both audio and video
          localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          // Only set initial states if they haven't been set before
          if (videoEnabled === undefined) videoEnabled = true;
          if (audioEnabled === undefined) audioEnabled = true;

          // Apply existing states to new tracks
          const videoTrack = localStream.getVideoTracks()[0];
          const audioTrack = localStream.getAudioTracks()[0];
          if (videoTrack) videoTrack.enabled = videoEnabled;
          if (audioTrack) audioTrack.enabled = audioEnabled;
        } catch (err) {
          log("Could not get video permission, trying audio only...");
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true,
            });
            videoEnabled = false;
            if (audioEnabled === undefined) audioEnabled = true;

            // Update UI to show video is disabled
            const videoToggle = document.getElementById("videoToggle");
            videoToggle.classList.add("disabled");
            videoToggle.setAttribute("title", "Video permission denied");
          } catch (audioErr) {
            log("Could not get audio permission either, continuing without media...");
            localStream = new MediaStream();
            videoEnabled = false;
            audioEnabled = false;

            // Update UI to show both are disabled
            const videoToggle = document.getElementById("videoToggle");
            const audioToggle = document.getElementById("audioToggle");
            videoToggle.classList.add("disabled");
            audioToggle.classList.add("disabled");
            videoToggle.setAttribute("title", "Video permission denied");
            audioToggle.setAttribute("title", "Audio permission denied");
          }
        }

        // Update the local video display and status
        const localVideo = document.getElementById("localVideo");
        localVideo.srcObject = localStream;
        localVideo.style.opacity = videoEnabled ? "1" : "0";

        document.getElementById("localLight").classList.add("active");
        log(
          `Local media acquired: ${
            localStream
              .getTracks()
              .map((t) => t.kind)
              .join(", ") || "none"
          }`
        );

        // Setup media controls with current states
        setupMediaControls();
      }

      // Create new RTCPeerConnection
      pc = new RTCPeerConnection({});

      // Add local tracks
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Update ontrack handler in startConnection
      pc.ontrack = (evt) => {
        log(`Received remote ${evt.track.kind} track`);

        // Clear disconnected status when receiving tracks
        document.getElementById("videoStatus").textContent = "";

        // Get or create stream for remote video
        const remoteVideo = document.getElementById("remoteVideo");
        if (!remoteVideo.srcObject) {
          remoteVideo.srcObject = new MediaStream();
        }

        // Add the track to existing stream
        remoteVideo.srcObject.addTrack(evt.track);

        if (evt.track.kind === "video") {
          setupVideoMonitoring();
          // Only show video if track is enabled and active
          if (evt.track.enabled && evt.track.readyState === "live") {
            remoteVideo.style.opacity = "1";
          }
        }

        // Setup track ended/disabled handling
        evt.track.onended = () => {
          log(`Remote ${evt.track.kind} track ended`);
          if (evt.track.kind === "video") {
            setupVideoMonitoring();
          }
        };

        evt.track.onmute = () => {
          if (evt.track.kind === "video") {
            remoteVideo.style.opacity = "0";
          }
        };

        evt.track.onunmute = () => {
          if (evt.track.kind === "video" && evt.track.enabled) {
            remoteVideo.style.opacity = "1";
          }
        };
      };

      // Connect WebSocket
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        log(isReconnect ? "Reconnected" : "WebSocket connected");
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      };

      ws.onmessage = async (evt) => {
        const msg = JSON.parse(evt.data);
        log("Received: " + msg.type);

        try {
          if (msg.type === "role") {
            role = msg.data.role;
            log(`I am the ${role}`);

            setupDataChannel(role === "offerer");

            if (role === "offerer") {
              // Create and send offer
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              const iceCandidates = [];
              pc.onicecandidate = (evt) => {
                if (evt.candidate) {
                  iceCandidates.push(evt.candidate);
                }
              };

              // Wait for ICE gathering
              await new Promise((resolve) => {
                if (pc.iceGatheringState === "complete") {
                  resolve();
                } else {
                  pc.onicegatheringstatechange = () => {
                    if (pc.iceGatheringState === "complete") {
                      resolve();
                    }
                  };
                }
              });

              const sendOffer = () => {
                ws.send(
                  JSON.stringify({
                    type: "offer",
                    data: {
                      sdp: pc.localDescription.sdp,
                      ice: iceCandidates,
                    },
                  })
                );
                log("Sent offer");
              };

              // Send initial offer
              sendOffer();

              // Set timeout to resend offer if no answer received
              const offerResendInterval = setInterval(() => {
                if (pc == null || pc.currentRemoteDescription === null) {
                  log("No answer received, resending offer...");
                  sendOffer();
                } else {
                  clearInterval(offerResendInterval);
                }
              }, 5000);

              // Clear timeout when answer is received
              const originalOnMessage = ws.onmessage;
              ws.onmessage = async (evt) => {
                const msg = JSON.parse(evt.data);
                if (msg.type === "answer") {
                  clearTimeout(offerResendInterval);
                }
                await originalOnMessage(evt);
              };
            }
          } else if (msg.type === "offer" && role === "answerer") {
            // Handle received offer
            await pc.setRemoteDescription({
              type: "offer",
              sdp: msg.data.sdp,
            });

            for (const candidate of msg.data.ice) {
              await pc.addIceCandidate(candidate);
            }

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            const iceCandidates = [];
            pc.onicecandidate = (evt) => {
              if (evt.candidate) {
                iceCandidates.push(evt.candidate);
              }
            };

            // Wait for ICE gathering
            await new Promise((resolve) => {
              if (pc.iceGatheringState === "complete") {
                resolve();
              } else {
                pc.onicegatheringstatechange = () => {
                  if (pc.iceGatheringState === "complete") {
                    resolve();
                  }
                };
              }
            });

            ws.send(
              JSON.stringify({
                type: "answer",
                data: {
                  sdp: pc.localDescription.sdp,
                  ice: iceCandidates,
                },
              })
            );
            log("Sent answer");
          } else if (msg.type === "answer" && role === "offerer") {
            try {
              // Handle received answer
              await pc.setRemoteDescription({
                type: "answer",
                sdp: msg.data.sdp,
              });

              for (const candidate of msg.data.ice) {
                await pc.addIceCandidate(candidate);
              }

              if (pc.connectionState === "connected") {
                isReconnecting = false;
                reconnectAttempts = 0;
              }
            } catch (err) {
              log("Error setting remote description: " + err.message);
            }
          }
        } catch (err) {
          log("Error: " + err.message);
        }
      };

      // Update ws.onclose handler
      ws.onclose = async () => {
        log("WebSocket closed");
        console.log(pc, pc.connectionState);

        // Only attempt reconnection if we're completely disconnected
        if (!pc || (pc.connectionState !== "connected" && !isReconnecting)) {
          handleDisconnect("WebSocket closed");
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          log(`Reconnecting in ${delay / 1000} seconds...`);
          reconnectionTimeout = setTimeout(() => startConnection(true), delay);
        } else {
          console.log("ignoring");
        }
      };

      ws.onerror = (error) => {
        log("WebSocket error: " + error.message);
      };

      // Update pc.onconnectionstatechange handler
      pc.onconnectionstatechange = () => {
        log(`Connection state: ${pc.connectionState}`);
        const remoteLight = document.getElementById("remoteLight");

        switch (pc.connectionState) {
          case "connected":
            log("Connection established");
            isReconnecting = false;
            reconnectAttempts = 0;
            remoteLight.classList.add("active");
            remoteLight.classList.remove("disconnected");
            document.getElementById("videoStatus").textContent = "";
            document.getElementById("status").style.display = "none";
            // Hide local video on connection
            if (localVideoVisible) {
              toggleLocalVideoVisibility();
            }
            connectSound.play().catch((err) => log("Error playing sound: " + err.message));
            ws.close();
            break;

          case "disconnected":
            // Unhide - Return to default state, whatever CSS is set
            document.getElementById("status").style.display = "";
          case "failed":
            handleDisconnect(`Connection ${pc.connectionState}`);
            if (!isReconnecting) {
              startConnection(true);
            }
            break;
        }
      };

      isReconnecting = false;
      reconnectAttempts = 0;
    } catch (err) {
      isReconnecting = false;
      log("Connection error: " + err.message);
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
      reconnectionTimeout = setTimeout(() => startConnection(true), delay);
      throw err;
    }
  }

  // Update the sendMessage function
  function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    if (dataChannel?.readyState === "open") {
      dataChannel.send(
        JSON.stringify({
          type: "message",
          data: window.btoa(message),
        })
      );
      log(`${message}`, "self"); // Add 'self' type
      messageInput.value = ""; // Clear input after sending
    } else {
      log("Data channel not ready");
    }
  }

  // Update message input events
  sendButton.addEventListener("click", sendMessage);
  sendButton.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      sendMessage();
    },
    { passive: false }
  );

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Add ring button handling
  async function sendRingSound() {
    if (dataChannel?.readyState === "open") {
      dataChannel.send(
        JSON.stringify({
          type: "sound",
          data: "audios/ring.mp3",
        })
      );
      log("Ring sent");
    } else {
      log("Data channel not ready");
    }
  }

  // Add morse code button handling
  let isPressed = false;

  function sendMorseBeep(start = true) {
    if (dataChannel?.readyState === "open") {
      dataChannel.send(
        JSON.stringify({
          type: "morse",
          data: start,
        })
      );

      if (start) {
        // Create local beep
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (!oscillator) {
          oscillator = audioContext.createOscillator();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);

          const gainNode = audioContext.createGain();
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
        }
      } else {
        stopBeep();
      }
    }
  }

  function stopBeep() {
    if (oscillator) {
      try {
        oscillator.stop();
        oscillator.disconnect();
      } catch (err) {
        console.log("Error stopping oscillator:", err);
      }
      oscillator = null;
    }
  }

  function startMorse(e) {
    e.preventDefault();
    if (isPressed) return;
    isPressed = true;
    morseButton.classList.add("pressed");
    sendMorseBeep(true);
  }

  function stopMorse(e) {
    e.preventDefault();
    if (!isPressed) return;
    isPressed = false;
    morseButton.classList.remove("pressed");
    sendMorseBeep(false);
  }

  // Add morse button event listeners
  function setupMorseHandlers() {
    morseButton.addEventListener("mousedown", startMorse);
    morseButton.addEventListener("mouseup", stopMorse);
    morseButton.addEventListener("touchstart", startMorse, { passive: false });
    morseButton.addEventListener("touchend", stopMorse, { passive: false });
    morseButton.addEventListener("touchcancel", stopMorse, { passive: false });

    // Listen for mouse up on window to catch all cases
    window.addEventListener("mouseup", stopMorse);
    window.addEventListener("touchend", stopMorse);
  }

  // Call setup after DOM content loaded
  setupMorseHandlers();

  // Add cleanup on page unload
  window.addEventListener("beforeunload", cleanupConnection);

  // Start initial connection
  try {
    await startConnection();
  } catch (err) {
    log("Failed to start: " + err.message);
  }

  // Add function to handle disconnect state
  function handleDisconnect(reason = "") {
    const remoteLight = document.getElementById("remoteLight");
    const videoStatus = document.getElementById("videoStatus");
    // Unhide - Return to default state, whatever CSS is set
    document.getElementById("status").style.display = "";

    remoteLight.classList.remove("active");
    remoteLight.classList.add("disconnected");
    videoStatus.textContent = "Disconnected";

    log(`Connection lost${reason ? `: ${reason}` : ""}, attempting to reconnect...`);
  }

  function toggleLocalVideoVisibility(e) {
    if (e) e.preventDefault();

    const localVideo = document.getElementById("localVideo");
    const toggleButton = document.getElementById("toggleLocalVideo");

    localVideoVisible = !localVideoVisible;

    localVideo.classList.toggle("visible", localVideoVisible);
    toggleButton.classList.toggle("visible", localVideoVisible);
  }

  document.getElementById("toggleLocalVideo").addEventListener("click", toggleLocalVideoVisibility);
  document
    .getElementById("toggleLocalVideo")
    .addEventListener("touchstart", toggleLocalVideoVisibility, { passive: false });
});
