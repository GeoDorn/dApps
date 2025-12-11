import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));



const AMADEUS_TOKEN_URL  = "https://test.api.amadeus.com/v1/security/oauth2/token";

async function getServerAccessToken() {
  try {
    console.log('Fetching new access token...');
    const response = await fetch(AMADEUS_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     process.env.AMADEUS_CLIENT_ID,
          client_secret: process.env.AMADEUS_CLIENT_SECRET,
          grant_type:    "client_credentials"
        })
      });
    const data = await resp.json();

    if (response.ok) {
      console.log('Access token fetched successfully');
      return data.access_token;
    } else {
      throw new Error(`Failed to fetch access token: ${data.error_description}`);
    }   
    } catch (error) {
        console.error('Error fetching access token:', error);
      }
}

async function fetchHotelData(cityCode) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    throw new Error('No access token available');
  return;
}

try {
    const response = await fetch(`https://test.api.amadeus.com/v2/locations/hotels/by-city?cityCode=${cityCode}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const hotelData = await response.json();
    
    if (response.ok) {
      displayResults(data);
    } else {
      throw new Error(`Failed to fetch hotel data: ${hotelData.error}`);
    }
  }catch (error) {
      console.error('Error fetching hotel data:', error);
  }
}

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});