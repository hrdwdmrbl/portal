// A minimal Cloudflare Worker for WebRTC signaling
// with connections "bucketed" by IP so only peers on the same public IP see each other.

let connectionsByIP = new Map();

addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // WebSocket endpoint for signaling
  if (url.pathname === "/ws" && event.request.headers.get("Upgrade") === "websocket") {
    event.respondWith(handleWebSocket(event.request));
    return;
  } else if (url.pathname === "/ws") {
    event.respondWith(new Response("Connect with websockets", { status: 200 }));
    return;
  }

  // Return a 404 (or similar) for any other path
  event.respondWith(new Response("Not found", { status: 404 }));
});

async function handleWebSocket(request) {
  // Cloudflare sets the client's public IP in the CF-Connecting-IP header
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  console.log("Client IP:", ip);

  // Create a WebSocket server/client pair
  const [client, server] = Object.values(new WebSocketPair());
  server.accept(); // Accept the server side

  // Add this server connection to the correct "bucket" (the IP)
  if (!connectionsByIP.has(ip)) {
    connectionsByIP.set(ip, []);
  }
  const connectionTimestamp = Date.now();
  connectionsByIP.get(ip).push({ server, connectionTimestamp });

  // If more than one connection, remove the oldest. Max 2 connections per IP.
  if (connectionsByIP.get(ip).length > 1) {
    const oldestConnection = connectionsByIP.get(ip).sort((a, b) => a.connectionTimestamp - b.connectionTimestamp)[0];
    oldestConnection.server.close();
    connectionsByIP.set(
      ip,
      connectionsByIP.get(ip).filter((conn) => conn !== oldestConnection)
    );
  }

  // Broadcast any incoming message to all others on the same IP
  server.addEventListener("message", (event) => {
    console.log("Received message:", ip, event.data);
    const peers = (connectionsByIP.get(ip) || []).map((conn) => conn.server);
    for (let conn of peers) {
      if (conn !== server) {
        conn.send(event.data);
      }
    }
  });

  // Clean up when a connection closes
  server.addEventListener("close", () => {
    console.log("Connection closed:", ip);
    const peers = (connectionsByIP.get(ip) || []).map((conn) => conn.server);
    connectionsByIP.set(
      ip,
      peers.filter((conn) => conn !== server)
    );
  });

  // Return the client side of the pair to the browser
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
