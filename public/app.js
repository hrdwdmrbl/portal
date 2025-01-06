/****************************** 
  Configuration 
******************************/
const SIGNALING_URL = "wss://signal.portl.cam/ws";
// Replace with your actual Worker subdomain if needed.

const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Add a TURN server here if needed for NAT traversal (probably not needed on LAN).
  ],
};

/******************************
  Global Variables
******************************/
let pc; // RTCPeerConnection
let localStream; // MediaStream from getUserMedia
let ws; // WebSocket to Cloudflare Worker
let dataChannel; // RTCDataChannel for ring, morse, messages
let isVideoEnabled = true;
let isAudioEnabled = true;
let beepPlaying = false;

/******************************
  DOM Elements
******************************/
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const btnToggleVideo = document.getElementById("btnToggleVideo");
const btnToggleAudio = document.getElementById("btnToggleAudio");
const btnRing = document.getElementById("btnRing");
const btnMorse = document.getElementById("btnMorse");
const txtMessage = document.getElementById("txtMessage");
const btnSend = document.getElementById("btnSend");
const messageBubble = document.getElementById("messageBubble");
const ringAudio = document.getElementById("ringAudio");
const beepAudio = document.getElementById("beepAudio");

/******************************
  Initialize 
******************************/
init();

async function init() {
  // Start media (we don't display it locally; just send it to the peer)
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    console.error("Error getting user media:", err);
  }

  // Connect WebSocket (auto-reconnect on failure)
  connectWebSocket();

  // Wire up UI events
  btnToggleVideo.addEventListener("click", toggleVideo);
  btnToggleAudio.addEventListener("click", toggleAudio);
  btnRing.addEventListener("click", sendRing);
  btnMorse.addEventListener("mousedown", startMorse);
  btnMorse.addEventListener("mouseup", stopMorse);
  // For touchscreen
  btnMorse.addEventListener("touchstart", startMorse);
  btnMorse.addEventListener("touchend", stopMorse);
  btnSend.addEventListener("click", sendMessage);

  messageBubble.addEventListener("click", () => {
    messageBubble.style.display = "none";
  });
}

/******************************
  WebSocket Handling
******************************/
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }
  ws = new WebSocket(SIGNALING_URL);

  ws.onopen = () => {
    console.log("WebSocket connected");
    setupPeerConnection();
  };

  ws.onmessage = (evt) => {
    // We receive the raw message from the Worker, which is from the other peer
    const data = JSON.parse(evt.data);
    handleSignal(data);
  };

  ws.onclose = () => {
    console.warn("WebSocket closed. Reconnecting in 3s...");
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    ws.close();
  };
}

function sendSignal(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/******************************
  Peer Connection Setup 
******************************/
function setupPeerConnection() {
  pc = new RTCPeerConnection(ICE_CONFIG);

  // Add local tracks so the other side can see/hear us
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  // Create data channel for ring/morse/messages
  dataChannel = pc.createDataChannel("portalChannel");
  dataChannel.onmessage = (e) => onDataChannelMessage(e.data);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({ candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    // Attach the remote's stream to our video element
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = () => {
    console.log("PC state:", pc.connectionState);
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      // Attempt renegotiation or refresh
      renegotiate();
    }
  };

  pc.ondatachannel = (event) => {
    // If the other peer created the channel, we get it here
    const channel = event.channel;
    channel.onmessage = (e) => onDataChannelMessage(e.data);
  };

  // Initiate an offer to connect
  renegotiate();
  console.log("PC created");
}

/******************************
  Negotiation Logic 
******************************/
async function renegotiate() {
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal({ sdp: pc.localDescription });
  } catch (err) {
    console.error("Error in renegotiate:", err);
  }
}

async function handleSignal(data) {
  // Remote ICE candidate
  if (data.candidate) {
    try {
      await pc.addIceCandidate(data.candidate);
    } catch (err) {
      console.error("Error adding ice candidate:", err);
    }
  } else if (data.sdp) {
    // Remote SDP (offer/answer)
    try {
      const remoteDesc = new RTCSessionDescription(data.sdp);
      await pc.setRemoteDescription(remoteDesc);

      if (remoteDesc.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ sdp: pc.localDescription });
      }
    } catch (err) {
      console.error("Error setting remote SDP:", err);
    }
  } else {
    console.warn("Unknown signal:", data);
  }
}

/******************************
  Data Channel: ring, morse, messages
******************************/
function onDataChannelMessage(message) {
  console.log("Received message:", message);

  let msgObj;
  try {
    msgObj = JSON.parse(message);
  } catch {
    console.warn("Received non-JSON data on channel:", message);
    return;
  }

  switch (msgObj.type) {
    case "ring":
      playRing();
      break;
    case "morseStart":
      startBeep();
      break;
    case "morseStop":
      stopBeep();
      break;
    case "text":
      showMessage(msgObj.text);
      break;
    default:
      console.warn("Unknown message type:", msgObj.type);
  }
}

function sendDataChannelMessage(obj) {
  if (dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(JSON.stringify(obj));
  }
}

/******************************
  Ring & Morse 
******************************/
function sendRing() {
  sendDataChannelMessage({ type: "ring" });
}
function playRing() {
  ringAudio.currentTime = 0;
  ringAudio.play().catch((err) => console.error("Ring play error:", err));
}

function startMorse() {
  sendDataChannelMessage({ type: "morseStart" });
}
function stopMorse() {
  sendDataChannelMessage({ type: "morseStop" });
}

function startBeep() {
  if (!beepPlaying) {
    beepPlaying = true;
    beepAudio.currentTime = 0;
    beepAudio.play().catch((err) => console.error("Beep play error:", err));
  }
}
function stopBeep() {
  beepPlaying = false;
  beepAudio.pause();
  beepAudio.currentTime = 0;
}

/******************************
  Send & Show Text Messages
******************************/
function sendMessage() {
  const text = txtMessage.value.trim();
  if (!text) return;
  txtMessage.value = "";
  sendDataChannelMessage({ type: "text", text });
}

function showMessage(text) {
  messageBubble.textContent = text;
  messageBubble.style.display = "block";
}

/******************************
  Audio/Video Toggles
******************************/
function toggleVideo() {
  if (!localStream) return;
  isVideoEnabled = !isVideoEnabled;
  localStream.getVideoTracks().forEach((track) => (track.enabled = isVideoEnabled));
  btnToggleVideo.textContent = isVideoEnabled ? "Video On" : "Video Off";
}

function toggleAudio() {
  if (!localStream) return;
  isAudioEnabled = !isAudioEnabled;
  localStream.getAudioTracks().forEach((track) => (track.enabled = isAudioEnabled));
  btnToggleAudio.textContent = isAudioEnabled ? "Audio On" : "Audio Off";
}
