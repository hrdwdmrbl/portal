export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only handle WebSocket upgrades at /ws
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      return handleWebSocket(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

/**
 * The structure in KV for each IP (roomId):
 * {
 *   activeCount: number,        // 0..2
 *   offer: { sdp, ice } | null, // or undefined
 *   answer: { sdp, ice } | null,
 *   firstWriter: "offer"|"answer"|null,
 *   updatedAt: number // timestamp
 * }
 */

async function handleWebSocket(request, env) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  // We'll treat CF-Connecting-IP as the "roomId".
  const roomId = request.headers.get("CF-Connecting-IP") || "unknown";

  // Try loading the current record (or create a new one)
  let record = await env.PORTAL_KV.get(roomId, { type: "json" });
  if (!record) {
    record = {
      activeCount: 0,
      offer: null,
      answer: null,
      firstWriter: null,
      updatedAt: Date.now(),
    };
  }

  // Increment activeCount (one more connection for this IP)
  record.activeCount = (record.activeCount || 0) + 1;
  record.updatedAt = Date.now();
  await env.PORTAL_KV.put(roomId, JSON.stringify(record));

  // Start polling KV for changes, push them to the client in real time
  const stopPolling = startPollingKV(env, roomId, record, server);

  server.addEventListener("message", async (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (err) {
      server.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    // Expect shape: { type: "offer"|"answer", data: { sdp, ice[] } }
    if (!["offer", "answer"].includes(msg.type)) {
      server.send(JSON.stringify({ error: "Unknown type" }));
      return;
    }
    if (!msg.data || !msg.data.sdp || !Array.isArray(msg.data.ice)) {
      server.send(JSON.stringify({ error: "Missing or invalid sdp/ice" }));
      return;
    }

    // Re-fetch the record to avoid overwriting changes
    let freshRecord = await env.PORTAL_KV.get(roomId, { type: "json" });
    if (!freshRecord) {
      freshRecord = {
        activeCount: 1,
        offer: null,
        answer: null,
        firstWriter: null,
        updatedAt: Date.now(),
      };
    }

    // Handle concurrency: if there's no firstWriter, set it
    if (!freshRecord.firstWriter) {
      freshRecord.firstWriter = msg.type === "offer" ? "offer" : "answer";
    }

    // If the second client also tries to store an offer, but an offer is already there:
    if (msg.type === "offer" && freshRecord.offer) {
      // This means we already have an offer. The second client should be an answerer.
      server.send(
        JSON.stringify({
          error: "Offer already exists. You must send an answer or handle concurrency differently.",
        })
      );
      return;
    }
    // Similarly, if we had an answer but someone tries to store an answer again as first writer:
    if (msg.type === "answer" && freshRecord.answer && !freshRecord.offer) {
      server.send(
        JSON.stringify({
          error: "We have an answer but no offer? Possibly a concurrency issue.",
        })
      );
      return;
    }

    // Set or update the appropriate property
    if (msg.type === "offer") {
      freshRecord.offer = {
        sdp: msg.data.sdp,
        ice: msg.data.ice,
      };
    } else if (msg.type === "answer") {
      freshRecord.answer = {
        sdp: msg.data.sdp,
        ice: msg.data.ice,
      };
    }

    freshRecord.updatedAt = Date.now();
    await env.PORTAL_KV.put(roomId, JSON.stringify(freshRecord));

    // Acknowledge
    server.send(JSON.stringify({ ok: true, type: msg.type + "-stored" }));
  });

  server.addEventListener("close", async () => {
    // Stop polling
    stopPolling();

    // Decrement activeCount
    let rec = await env.PORTAL_KV.get(roomId, { type: "json" });
    if (!rec) rec = { activeCount: 1, offer: null, answer: null, firstWriter: null };
    rec.activeCount = Math.max(0, (rec.activeCount || 1) - 1);

    // If no more active connections, wipe the record
    if (rec.activeCount === 0) {
      await env.PORTAL_KV.delete(roomId);
    } else {
      rec.updatedAt = Date.now();
      await env.PORTAL_KV.put(roomId, JSON.stringify(rec));
    }
  });

  return new Response(null, { status: 101, webSocket: client });
}

/**
 * Polls the KV store every 2 seconds.
 * If it detects changes in 'offer' or 'answer', it sends them to the client.
 */
function startPollingKV(env, roomId, initialRecord, server) {
  let isStopped = false;
  let lastOffer = initialRecord.offer;
  let lastAnswer = initialRecord.answer;

  const intervalId = setInterval(async () => {
    if (isStopped) return;

    let rec = await env.PORTAL_KV.get(roomId, { type: "json" });
    if (!rec) {
      // Possibly cleared
      server.send(JSON.stringify({ info: "Room data cleared. Possibly other client disconnected." }));
      return;
    }

    // Check if there's a new or updated offer
    const isOfferChanged = JSON.stringify(rec.offer) !== JSON.stringify(lastOffer);
    if (isOfferChanged && rec.offer) {
      lastOffer = rec.offer;
      server.send(JSON.stringify({ type: "offer", data: rec.offer }));
    }

    // Check if there's a new or updated answer
    const isAnswerChanged = JSON.stringify(rec.answer) !== JSON.stringify(lastAnswer);
    if (isAnswerChanged && rec.answer) {
      lastAnswer = rec.answer;
      server.send(JSON.stringify({ type: "answer", data: rec.answer }));
    }
  }, 2000);

  return () => {
    isStopped = true;
    clearInterval(intervalId);
  };
}
