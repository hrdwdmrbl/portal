export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only handle WebSocket upgrades at /ws
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      return handleWebSocket(request, env);
    } else if (url.pathname === "/reset") {
      await handleReset(request, env);
      return new Response("OK", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleReset(request, env) {
  const roomId = request.headers.get("CF-Connecting-IP");
  await env.PORTAL_KV.delete(roomId);
}

class Room {
  constructor(existingRoom) {
    existingRoom ||= {};
    this.clients = existingRoom.clients || {};
    this.offer = existingRoom.offer || null;
    this.answer = existingRoom.answer || null;
    this.updatedAt = existingRoom.updatedAt || Date.now();
  }

  reset() {
    this.clients = {};
    this.offer = null;
    this.answer = null;
    this.updatedAt = Date.now();
  }

  addClient(clientId) {
    this.clients[clientId] = {
      connectedAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.updatedAt = Date.now();
    // Remove dead clients
    this.removeDeadClients();
  }

  heartbeatClient(clientId) {
    this.clients[clientId].updatedAt = Date.now();
  }

  // Remove "dead" clients that haven't sent a message in 10 seconds
  removeDeadClients() {
    Object.keys(this.clients).forEach((clientId) => {
      const client = this.clients[clientId];
      if (Date.now() - client.updatedAt > 10000) {
        this.removeClient(clientId);
      }
    });
  }

  get numberOfClients() {
    return Object.keys(this.clients).length;
  }

  removeClient(clientId) {
    delete this.clients[clientId];
    delete this.offer;
    delete this.answer;
    this.updatedAt = Date.now();
  }

  addOffer(offer) {
    this.offer = {
      sdp: offer.sdp,
      ice: offer.ice,
    };
    this.updatedAt = Date.now();
  }

  addAnswer(answer) {
    this.answer = {
      sdp: answer.sdp,
      ice: answer.ice,
    };
    this.updatedAt = Date.now();
  }

  toJSON() {
    return JSON.stringify({
      clients: this.clients,
      offer: this.offer,
      answer: this.answer,
      updatedAt: this.updatedAt,
    });
  }

  friendlyJSON() {
    return JSON.stringify({
      clients: Object.keys(this.clients).length,
      offer: !!this.offer,
      answer: !!this.answer,
      updatedAt: this.updatedAt,
    });
  }
}

async function handleWebSocket(request, env) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  server.addEventListener("error", (evt) => {
    console.error("WebSocket error", evt);
  });
  server.addEventListener("close", () => {
    console.error("WebSocket closed");
  });
  server.addEventListener("message", (evt) => {
    console.error("WebSocket message", evt.data);
  });

  // We'll treat CF-Connecting-IP as the "roomId"
  const roomId = request.headers.get("CF-Connecting-IP");
  if (!roomId) {
    console.error("No IP address found");
    server.send(JSON.stringify({ error: "No IP address found" }));
    server.close(1011, "No IP address");
    return new Response(null, { status: 400 });
  } else {
    console.log("New connection", roomId);
  }

  // Load or initialize room state
  let room;
  try {
    const record = await env.PORTAL_KV.get(roomId, { type: "json" });
    room = new Room(record);
    console.log("Load", roomId, room.friendlyJSON());
  } catch (err) {
    console.error("KV read error:", err);
    server.send(JSON.stringify({ error: "Failed to access room state" }));
    server.close(1011, "Storage error");
    return new Response(null, { status: 500 });
  }

  // Random unique ID for this connection
  const clientId = crypto.randomUUID();
  room.addClient(clientId);

  // Enforce maximum 2 clients per IP
  if (room.numberOfClients > 2) {
    console.log("Room is full, closing connection");
    server.send(JSON.stringify({ error: "Room is full (max 2 clients)" }));
    server.close(1000, "Room full");
    return new Response(null, { status: 403 });
  }

  try {
    await env.PORTAL_KV.put(roomId, room.toJSON());
    console.log("Client added", roomId, room.friendlyJSON());
  } catch (err) {
    console.error("KV write error:", err);
    server.send(JSON.stringify({ error: "Failed to update room state" }));
    server.close(1011, "Storage error");
    return new Response(null, { status: 500 });
  }

  const stopHeartbeat = startHeartbeat(env, clientId);
  const stopPolling = startPollingKV(env, roomId, room, server);

  listenForMessages(server, env, roomId);
  listenForClose(server, env, roomId, clientId, stopHeartbeat, stopPolling);

  return new Response(null, { status: 101, webSocket: client });
}

function listenForMessages(server, env, roomId) {
  server.addEventListener("message", async (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (err) {
      server.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    console.log("Message", roomId, msg.type);

    if (!msg.data?.sdp || !Array.isArray(msg.data?.ice)) {
      server.send(JSON.stringify({ error: "Missing or invalid sdp/ice" }));
      return;
    }

    // Get fresh state to handle concurrency
    let room;
    try {
      const record = await env.PORTAL_KV.get(roomId, { type: "json" });
      room = new Room(record);
    } catch (err) {
      console.error("KV read error:", err);
      server.send(JSON.stringify({ error: "Failed to check room state" }));
      return;
    }

    // Validate state transitions
    if (msg.type === "offer") {
      if (room.offer) {
        server.send(
          JSON.stringify({
            error: "Offer already exists. You must send an answer.",
          })
        );
        return;
      }
    } else if (msg.type === "answer") {
      if (!room.offer) {
        server.send(
          JSON.stringify({
            error: "Cannot answer: no offer exists yet.",
          })
        );
        return;
      }
      if (room.answer) {
        server.send(
          JSON.stringify({
            error: "Answer already exists.",
          })
        );
        return;
      }
    }

    // Store the update
    if (msg.type === "offer") {
      room.addOffer(msg.data);
    } else if (msg.type === "answer") {
      room.addAnswer(msg.data);
    }

    try {
      await env.PORTAL_KV.put(roomId, room.toJSON());
      console.log("Message stored", roomId, room.friendlyJSON());
      server.send(JSON.stringify({ ok: true, type: msg.type + "-stored" }));
    } catch (err) {
      console.error("KV write error:", err);
      server.send(JSON.stringify({ error: "Failed to save " + msg.type }));
    }
  });
}

function listenForClose(server, env, roomId, clientId, stopHeartbeat, stopPolling) {
  server.addEventListener("close", async () => {
    stopPolling();
    stopHeartbeat();

    // Get final state
    let room;
    try {
      const record = await env.PORTAL_KV.get(roomId, { type: "json" });
      room = new Room(record);
    } catch (err) {
      console.error("KV read error during cleanup:", err);
      return;
    }

    room.removeClient(clientId);

    try {
      if (room.numberOfClients === 0) {
        // Last client disconnected, clean up the room
        await env.PORTAL_KV.delete(roomId);
        console.log("Closing room", roomId);
      } else {
        // Other client still connected
        await env.PORTAL_KV.put(roomId, room.toJSON());
        console.log("Removed client", roomId, clientId, room.friendlyJSON());
      }
    } catch (err) {
      console.error("KV write error during cleanup:", err);
    }
  });
}

/**
 * Polls the KV store every 2 seconds for updates.
 */
function startPollingKV(env, roomId, room, server) {
  let lastOffer = room.offer;
  let lastAnswer = room.answer;

  const intervalId = setInterval(async () => {
    let room;
    try {
      const record = await env.PORTAL_KV.get(roomId, { type: "json" });
      room = new Room(record);
    } catch (err) {
      console.error("KV polling read error:", err);
      return;
    }

    console.log("Polling KV", roomId, room.friendlyJSON());

    // Check for offer changes
    const isOfferChanged = JSON.stringify(room.offer) !== JSON.stringify(lastOffer);
    if (isOfferChanged && room.offer) {
      lastOffer = room.offer;
      server.send(JSON.stringify({ type: "offer", data: room.offer }));
    }

    // Check for answer changes
    const isAnswerChanged = JSON.stringify(room.answer) !== JSON.stringify(lastAnswer);
    if (isAnswerChanged && room.answer) {
      lastAnswer = room.answer;
      server.send(JSON.stringify({ type: "answer", data: room.answer }));
    }
  }, 2000);

  return () => {
    clearInterval(intervalId);
  };
}

async function startHeartbeat(env, clientId) {
  const intervalId = setInterval(async () => {
    const record = await env.PORTAL_KV.get(clientId, { type: "json" });
    const room = new Room(record);
    room.heartbeatClient(clientId);

    room.removeDeadClients();

    await env.PORTAL_KV.put(clientId, room.toJSON());
    console.log("Heartbeat", clientId, room.friendlyJSON());
  }, 1000);

  return () => {
    clearInterval(intervalId);
  };
}
