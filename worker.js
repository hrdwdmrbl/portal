class ConnectionsManager {
  constructor() {
    this.connectionState = new Map();
  }

  addConnection(ip, server) {
    if (!this.connectionState.has(ip)) {
      this.connectionState.set(ip, []);
    }

    console.log("Client IP:", ip, "connections:", this.connectionState.get(ip).length);
    const connectionTimestamp = Date.now();
    this.connectionState.get(ip).push({ server, connectionTimestamp });
  }

  checkForExcessConnections(ip) {
    const servers = this.connectionState.get(ip);
    if (servers.length > 2) {
      const oldestServer = servers.sort((a, b) => a.connectionTimestamp - b.connectionTimestamp)[0];
      oldestServer.server.close();
      this.connectionState.set(
        ip,
        servers.filter((conn) => conn !== oldestServer)
      );
    }
  }

  removeConnection(ip, server) {
    console.log("Connection closed:", ip);
    const servers = this.connectionState.get(ip);
    this.connectionState.set(
      ip,
      servers.filter((conn) => conn !== server)
    );
  }

  getPeers(ip, server) {
    return this.connectionState
      .get(ip)
      .map((conn) => conn.server)
      .filter((conn) => conn !== server);
  }
}

const connectionsManager = new ConnectionsManager();

addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === "/ws" && event.request.headers.get("Upgrade") === "websocket") {
    event.respondWith(handleWebSocket(event.request));
    return;
  } else if (url.pathname === "/ws") {
    event.respondWith(new Response("Connect with websockets", { status: 200 }));
    return;
  }

  event.respondWith(new Response("Not found", { status: 404 }));
});

async function handleWebSocket(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  const [client, server] = Object.values(new WebSocketPair());
  server.accept(); // Accept the server side

  connectionsManager.addConnection(ip, server);

  // Broadcast any incoming message to all others on the same IP
  server.addEventListener("message", (event) => {
    const peers = connectionsManager.getPeers(ip, server);
    console.log("Received message:", ip, "peers:", peers.length);
    peers.forEach((conn) => {
      conn.send(event.data);
    });
  });

  // Clean up when a connection closes
  server.addEventListener("close", () => {
    connectionsManager.removeConnection(ip, server);
  });

  // Return the client side of the pair to the browser
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
