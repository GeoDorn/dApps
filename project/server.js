import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import Amadeus from "amadeus";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Initialize Amadeus SDK
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  hostname: 'test'
});

app.post("/api/flights", async (req, res) => {
  try {
    const { origin, destination, departureDate, returnDate, adults } = req.body;
    
    if (!origin || !destination || !departureDate || !adults) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    const response = await amadeus.shopping.flightOffers.search.get({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: departureDate,
      returnDate: returnDate,
      adults: adults,
      max: 10
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: "Search Error", detail: String(err.message || err) });
  }
});

app.post("/api/hotels", async (req, res) => {
  try {
    const { cityCode } = req.body;
    
    // First get hotel IDs in the city
    const hotelIds = await amadeus.referenceData.locations.hotels.byCity.get({
      cityCode: cityCode
    });
    
    if (hotelIds.data && hotelIds.data.length > 0) {
      // Get offers for the first few hotels
      const hotelIdList = hotelIds.data.slice(0, 10).map(h => h.hotelId).join(',');
      
      const offers = await amadeus.shopping.hotelOffersSearch.get({
        hotelIds: hotelIdList
      });
      
      res.json(offers.data);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Hotel search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/locations", async (req, res) => {
  try {
    const { keyword } = req.query;
    
    const response = await amadeus.referenceData.locations.get({
      keyword: keyword,
      subType: 'CITY,AIRPORT'
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
