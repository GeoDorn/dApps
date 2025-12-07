import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const AMADEUS_TOKEN_URL  = "https://test.api.amadeus.com/v1/security/oauth2/token";
const AMADEUS_HOTELS_URL = "https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city";

// --- Token cache ---
let cachedToken = null;
let tokenExpTs  = 0;

async function getServerAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < (tokenExpTs - 60)) return cachedToken;

  const resp = await fetch(AMADEUS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.AMADEUS_CLIENT_ID,
      client_secret: process.env.AMADEUS_CLIENT_SECRET,
      grant_type:    "client_credentials"
    })
  });

  const data = await resp.json();
  if (!resp.ok) {
    const msg = data.error_description || "Token request failed";
    throw new Error(msg);
  }
  cachedToken = data.access_token;
  tokenExpTs  = now + (data.expires_in || 1799);
  return cachedToken;
}

// --- Hotels proxy ---
app.get("/api/hotels", async (req, res) => {
  try {
    const cityCode = String(req.query.cityCode || "").toUpperCase();
    if (!cityCode) return res.status(400).json({ error: "Missing cityCode" });

    const token = await getServerAccessToken();
    const r = await fetch(
      `${AMADEUS_HOTELS_URL}?cityCode=${encodeURIComponent(cityCode)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const payload = await r.json();
    res.status(r.status).json(payload);
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: String(err.message || err) });
  }
});

// --- Fake bookings (in-memory) ---
const bookings = [];

function makeConfirmation() {
  return "H" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

app.post("/api/bookings", (req, res) => {
  const { hotelId, hotelName, cityCode, checkIn, checkOut, guests, fullName, email, price } = req.body || {};
  if (!hotelId || !hotelName || !cityCode || !checkIn || !checkOut || !fullName || !email) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  const conf = makeConfirmation();
  const record = {
    confirmation: conf,
    hotelId, hotelName, cityCode,
    checkIn, checkOut, guests: Number(guests) || 1,
    fullName, email, price: Number(price) || 0,
    createdAt: new Date().toISOString()
  };
  bookings.push(record);
  res.status(201).json({ ok: true, booking: record });
});

app.get("/api/bookings", (_req, res) => {
  res.json({ data: bookings.slice().reverse() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
