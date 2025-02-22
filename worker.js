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
  constructor(existingRoom = {}) {
    // Parse the JSON if it's a string
    if (typeof existingRoom === 'string') {
      existingRoom = JSON.parse(existingRoom);
    }
    this.clients = existingRoom?.clients || {};
    this.offer = existingRoom?.offer || null;
    this.answer = existingRoom?.answer || null;
  }

  removeOldestClients(maxClients = 5) {
    const clients = Object.entries(this.clients);
    if (clients.length > maxClients) {
      // Sort clients by joinedAt timestamp
      clients.sort(([, a], [, b]) => a.joinedAt - b.joinedAt);
      
      // Remove oldest clients until we reach maxClients
      const clientsToRemove = clients.slice(0, clients.length - maxClients);
      for (const [clientId, client] of clientsToRemove) {
        console.log(`Removing old client ${clientId} (${client.role})`);
        this.removeClient(clientId);
      }
    }
  }

  addClient(clientId) {
    // First check and remove old clients if needed
    this.removeOldestClients(5);
    
    // First client is offerer, second is answerer
    const isFirstClient = this.clients[Object.keys(this.clients)[Object.keys(this.clients).length - 1]]?.role !== "offerer";
    const role = isFirstClient ? "offerer" : "answerer";
    
    this.clients[clientId] = {
      role: role,
      joinedAt: Date.now()
    };

    console.log(`Added client ${clientId} as ${role}, total clients: ${Object.keys(this.clients).length}`);
    return role;
  }

  getClientRole(clientId) {
    return this.clients[clientId]?.role;
  }

  removeDeadClients() {
    const now = Date.now();
    Object.entries(this.clients).forEach(([clientId, client]) => {
      if (now - client.updatedAt > 20000) {
        console.log(`Removing dead client ${clientId}`);
        delete this.clients[clientId];
      }
    });
  }

  removeClient(clientId) {
    const client = this.clients[clientId];
    if (!client) return;
    
    // If offerer disconnects, clear offer and answer
    if (client.role === "offerer") {
      this.offer = null;
      this.answer = null;
    }
    // If answerer disconnects, only clear answer
    if (client.role === "answerer") {
      this.answer = null;
    }
    
    delete this.clients[clientId];
    console.log(`Removed client ${clientId}, remaining clients: ${Object.keys(this.clients).length}`);
  }

  addOffer(offer) {
    this.offer = offer;
    this.answer = null;
  }

  addAnswer(answer) {
    this.answer = answer;
  }

  heartbeatClient(clientId) {
    if (this.clients[clientId]) {
      this.clients[clientId].updatedAt = Date.now();
    }
  }

  toJSON() {
    return JSON.stringify({
      clients: this.clients,
      offer: this.offer,
      answer: this.answer
    });
  }

  friendlyJSON() {
    return JSON.stringify({
      numClients: Object.keys(this.clients).length,
      hasOffer: !!this.offer,
      hasAnswer: !!this.answer,
      lastRole: this.clients[Object.keys(this.clients)[Object.keys(this.clients).length - 1]]?.role || null
    });
  }
}

async function handleWebSocket(request, env) {
  const [client, server] = Object.values(new WebSocketPair());
  
  try {
    server.accept();
    const roomId = request.headers.get("CF-Connecting-IP");
    const clientId = crypto.randomUUID();
    let lastRoomState = null;

    // Get or create room
    let room = new Room(await env.PORTAL_KV.get(roomId));
    const role = room.addClient(clientId);
    await env.PORTAL_KV.put(roomId, room.toJSON());

    // Send role assignment
    server.send(JSON.stringify({ 
      type: "role",
      data: { role }
    }));

    // If answerer, send existing offer
    if (role === "answerer" && room.offer) {
      server.send(JSON.stringify({ 
        type: "offer",
        data: room.offer
      }));
    }

    // Set up polling interval
    const pollInterval = setInterval(async () => {
      try {
        const currentRoomState = await env.PORTAL_KV.get(roomId);
        
        // Only process if room state has changed
        if (currentRoomState !== lastRoomState) {
          const currentRoom = new Room(currentRoomState);
          
          // Send offer to answerer
          if (role === "answerer" && currentRoom.offer && (!lastRoomState || !new Room(lastRoomState).offer)) {
            server.send(JSON.stringify({
              type: "offer",
              data: currentRoom.offer
            }));
          }
          
          // Send answer to offerer
          if (role === "offerer" && currentRoom.answer && (!lastRoomState || !new Room(lastRoomState).answer)) {
            server.send(JSON.stringify({
              type: "answer",
              data: currentRoom.answer
            }));
          }
          
          lastRoomState = currentRoomState;
        }
        
        // Update client heartbeat
        room = new Room(currentRoomState);
        room.heartbeatClient(clientId);
        await env.PORTAL_KV.put(roomId, room.toJSON());
        
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 1000); // Poll every second

    // Handle messages
    server.addEventListener("message", async evt => {
      const msg = JSON.parse(evt.data);
      console.log(`Received: ${msg.type}`);
      
      // Get latest room state
      room = new Room(await env.PORTAL_KV.get(roomId));
      
      if (msg.type === "offer" && role === "offerer") {
        room.addOffer(msg.data);
        await env.PORTAL_KV.put(roomId, room.toJSON());
      }
      
      if (msg.type === "answer" && role === "answerer") {
        room.addAnswer(msg.data);
        await env.PORTAL_KV.put(roomId, room.toJSON());
      }
    });

    // Clean up on close
    server.addEventListener("close", async () => {
      clearInterval(pollInterval);
      
      // Get latest room state and remove client
      room = new Room(await env.PORTAL_KV.get(roomId));
      room.removeClient(clientId);
      await env.PORTAL_KV.put(roomId, room.toJSON());
    });

    // Add error handler
    server.addEventListener("error", async () => {
      clearInterval(pollInterval);
      
      // Get latest room state and remove client
      room = new Room(await env.PORTAL_KV.get(roomId));
      room.removeClient(clientId);
      await env.PORTAL_KV.put(roomId, room.toJSON());
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });

  } catch (err) {
    console.error("WebSocket error:", err);
    server.close(1011, err.message);
    return new Response(err.message, { status: 500 });
  }
}
