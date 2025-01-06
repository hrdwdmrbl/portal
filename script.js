"use strict";

// npm i node-fetch

try {
  // Use dynamic import with await
  const { default: fetch } = await import("node-fetch");

  const API_KEY = "mirotalkc2c_default_secret";
  const MIROTALK_URL = "https://c2c.mirotalk.com/api/v1/join";

  const response = await fetch(MIROTALK_URL, {
    method: "POST",
    headers: {
      authorization: API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      room: "brasserie-de-s&m",
      name: "Office 1",
    }),
  });
  const data = await response.json();
  if (data.error) {
    console.log("Error:", data.error);
  } else {
    console.log("join:", data.join);
  }
} catch (error) {
  console.error("Error fetching data:", error);
}
