import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const AMADEUS_TOKEN_URL = "https://test.api.amadeus.com/v1/security/oauth2/token";

// Token cache
let cachedToken = null;
let tokenExpiresAt = null;

// Get Amadeus access token (cached)
async function getServerAccessToken() {
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
    console.log("Using cached token");
    return cachedToken;
  }

  console.log("Fetching new access token...");
  const response = await fetch(AMADEUS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AMADEUS_CLIENT_ID,
      client_secret: process.env.AMADEUS_CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "Failed to get access token");
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

//
// ------------------------ FLIGHTS ------------------------
//
async function fetchFlightData(origin, destination, departureDate, returnDate, adults) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    throw new Error('No access token available');
  }

  try {
    // Build query params dynamically
    const params = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: departureDate,
      adults: adults
    });

    // Only add returnDate if provided
    if (returnDate) {
      params.append("returnDate", returnDate);
    }

    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    console.log(url)

    const flightData = await response.json();

    if (response.ok) {
      return flightData;
    } else {
      throw new Error(flightData.errors?.[0]?.detail || "Unknown error");
    }

  } catch (error) {
    console.error("Error fetching flight data:", error);
    throw error;
  }
}

app.get("/api/flights", async (req, res) => {
  const { originLocationCode, destinationLocationCode, departureDate, returnDate, adults } = req.query;

  if (!originLocationCode || !destinationLocationCode || !departureDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const flightData = await fetchFlightData(
      originLocationCode,
      destinationLocationCode,
      departureDate,
      returnDate,
      adults
    );

    res.json(flightData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//
// ------------------------ HOTELS ------------------------
//
async function fetchHotelData(cityCode) {
  const token = await getServerAccessToken();

  const response = await fetch(
    `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.errors?.[0]?.detail || "Failed to fetch hotels");
  }

  return data;
}

app.get('/api/hotels', async (req, res) => {
  const { cityCode } = req.query;

  if (!cityCode) {
    return res.status(400).json({ error: "City code is required" });
  }

  try {
    const hotelData = await fetchHotelData(cityCode);
    res.json(hotelData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//
// ------------------------ START SERVER ------------------------
//
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
