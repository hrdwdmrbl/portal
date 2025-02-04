const WS_URL = "wss://signal.example.com/ws"; // Your Worker route
let ws;
let pc;
let localStream;
let role = null; // "offerer" or "answerer"

const logEl = document.getElementById("log");
function log(msg) {
  console.log(msg);
  logEl.textContent += msg + "\n";
}

document.getElementById("startBtn").onclick = async () => {
  document.getElementById("startBtn").disabled = true;
  try {
    await startConnection();
  } catch (err) {
    log("Error: " + err);
    document.getElementById("startBtn").disabled = false;
  }
};

document.getElementById("disconnectBtn").onclick = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
    log("Manually closed WebSocket.");
  }
};

async function startConnection() {
  log("Requesting local media...");
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  // document.getElementById("localVideo").srcObject = localStream;

  // Create RTCPeerConnection
  pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (evt) => {
    log("Received remote track.");
    document.getElementById("remoteVideo").srcObject = evt.streams[0];
  };

  // We'll gather ICE up front
  const iceCandidates = [];
  pc.onicecandidate = (evt) => {
    if (evt.candidate) {
      iceCandidates.push(evt.candidate);
    }
  };

  // We'll decide if we are "offerer" or "answerer" once we see if there's an existing offer in KV.
  // But the Worker doesn't directly tell us "there is/no existing offer" until it sees an update.
  // We'll do a small trick: we'll create the offer anyway, but hold off sending it until we see if
  // the Worker pushes an offer to us.

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Wait 2s for ICE
  await waitForIce(pc);

  const fullOffer = {
    sdp: pc.localDescription.sdp,
    ice: iceCandidates,
  };

  // Connect WebSocket
  ws = new WebSocket(WS_URL);
  ws.addEventListener("open", () => {
    log("WebSocket connected. We'll wait 2s to see if we get an existing offer from the Worker...");
    document.getElementById("disconnectBtn").disabled = false;
    // We'll do a short delay to see if the Worker pushes an existing offer
    setTimeout(() => {
      // If we haven't received an offer yet, we become the "offerer"
      if (!role) {
        role = "offerer";
        log("No existing offer arrived; sending my offer...");
        ws.send(JSON.stringify({ type: "offer", data: fullOffer }));
      }
    }, 2000);
  });

  ws.addEventListener("message", async (evt) => {
    const msg = JSON.parse(evt.data);

    if (msg.error) {
      log("WS error: " + msg.error);
      // If it's "Offer already exists" -> we might reload or become answerer
      return;
    }
    if (msg.info) {
      log("WS info: " + msg.info);
      return;
    }

    if (msg.type === "offer" && !role) {
      // We discovered there's already an offer => we must be answerer
      role = "answerer";
      log("Received existing offer from Worker. I'm the answerer now.");

      // Set that remote offer
      await pc.setRemoteDescription({ type: "offer", sdp: msg.data.sdp });
      // Add their ICE
      for (let c of msg.data.ice) {
        await pc.addIceCandidate(c);
      }

      // Now gather my ICE fully as well
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const localIce = [];
      pc.onicecandidate = (evt) => {
        if (evt.candidate) localIce.push(evt.candidate);
      };

      await waitForIce(pc);
      const fullAnswer = {
        sdp: pc.localDescription.sdp,
        ice: localIce,
      };

      ws.send(JSON.stringify({ type: "answer", data: fullAnswer }));
      log("Sent answer. Now we wait for them to see it in KV and finalize P2P.");
    } else if (msg.type === "answer") {
      // I am the offerer, I receive an answer
      log("Received answer from Worker. Setting remote description...");
      await pc.setRemoteDescription({ type: "answer", sdp: msg.data.sdp });
      for (let c of msg.data.ice) {
        await pc.addIceCandidate(c);
      }
      log("Answer applied. P2P established!");
    }
  });

  ws.addEventListener("close", () => {
    log("WebSocket closed by server or manual request.");
    document.getElementById("disconnectBtn").disabled = true;
  });

  ws.addEventListener("error", (err) => {
    log("WebSocket error: " + err);
  });
}

function waitForIce(pc) {
  return new Promise((resolve) => {
    let done = false;
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete" && !done) {
        done = true;
        resolve();
      }
    };
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 2000);
  });
}
