let FLIGHTS = [];
let HOTELS = [];
let SELECTED = null;
let web3;
let contract;
let userAccount;

const API_URL = 'http://localhost:3000/api';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setMinDate();
});

function setupEventListeners() {
  // Form submission
  document.getElementById('travel-form').addEventListener('submit', handleSearch);
  
  // Location autocomplete
  document.getElementById('origin').addEventListener('input', (e) => {
    handleLocationSearch(e.target.value, 'origin-suggestions');
  });
  
  document.getElementById('destination').addEventListener('input', (e) => {
    handleLocationSearch(e.target.value, 'destination-suggestions');
  });
  
  // Wallet connection
  document.getElementById('connect-wallet').addEventListener('click', connectWallet);
  
  // Booking confirmation
  document.getElementById('confirm-booking').addEventListener('click', confirmBooking);
}

function setMinDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('departure-date').setAttribute('min', today);
}

// Location search with debouncing
let searchTimeout;
async function handleLocationSearch(keyword, suggestionsId) {
  clearTimeout(searchTimeout);
  
  if (keyword.length < 2) {
    document.getElementById(suggestionsId).style.display = 'none';
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`${API_URL}/locations?keyword=${keyword}`);
      const locations = await response.json();
      
      displaySuggestions(locations, suggestionsId);
    } catch (error) {
      console.error('Location search error:', error);
    }
  }, 300);
}

function displaySuggestions(locations, suggestionsId) {
  const container = document.getElementById(suggestionsId);
  container.innerHTML = '';
  
  if (locations.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  locations.slice(0, 5).forEach(location => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = `${location.name} (${location.iataCode})`;
    div.onclick = () => {
      const inputId = suggestionsId.replace('-suggestions', '');
      document.getElementById(inputId).value = location.iataCode;
      container.style.display = 'none';
    };
    container.appendChild(div);
  });
  
  container.style.display = 'block';
}

async function handleSearch(e) {
  e.preventDefault();
  
  const origin = document.getElementById('origin').value;
  const destination = document.getElementById('destination').value;
  const departureDate = document.getElementById('departure-date').value;
  const adults = document.getElementById('adults').value;
  
  showLoading(true);
  
  try {
    // Search flights
    const flightResponse = await fetch(`${API_URL}/flights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, departureDate, adults })
    });
    FLIGHTS = await flightResponse.json();
    
    // Search hotels
    const hotelResponse = await fetch(`${API_URL}/hotels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityCode: destination })
    });
    HOTELS = await hotelResponse.json();
    
    displayResults();
    showLoading(false);
  } catch (error) {
    console.error('Search error:', error);
    alert('Error searching for travel options. Please try again.');
    showLoading(false);
  }
}

function displayResults() {
  // Display flights
  const flightsList = document.getElementById('flights-list');
  flightsList.innerHTML = '';
  
  if (FLIGHTS.length === 0) {
    flightsList.innerHTML = '<p>No flights found for this route.</p>';
  } else {
    FLIGHTS.slice(0, 5).forEach((flight, index) => {
      const segment = flight.itineraries[0].segments[0];
      const price = flight.price.total;
      
      const card = document.createElement('div');
      card.className = 'flight-card';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4>${segment.departure.iataCode} → ${segment.arrival.iataCode}</h4>
            <p>Departure: ${new Date(segment.departure.at).toLocaleString()}</p>
            <p>Arrival: ${new Date(segment.arrival.at).toLocaleString()}</p>
            <p>Carrier: ${segment.carrierCode} ${segment.number}</p>
          </div>
          <div>
            <div class="price">${price} ${flight.price.currency}</div>
          </div>
        </div>
      `;
      card.onclick = () => selectFlight(index);
      flightsList.appendChild(card);
    });
  }
  
  // Display hotels
  const hotelsList = document.getElementById('hotels-list');
  hotelsList.innerHTML = '';
  
  if (HOTELS.length === 0) {
    hotelsList.innerHTML = '<p>No hotels found for this destination.</p>';
  } else {
    HOTELS.slice(0, 5).forEach((hotel, index) => {
      const offer = hotel.offers ? hotel.offers[0] : null;
      
      const card = document.createElement('div');
      card.className = 'hotel-card';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4>${hotel.hotel.name}</h4>
            <p>📍 ${hotel.hotel.cityCode}</p>
            ${offer ? `<p>Room: ${offer.room.description.text || 'Standard Room'}</p>` : ''}
          </div>
          ${offer ? `<div class="price">${offer.price.total} ${offer.price.currency}</div>` : ''}
        </div>
      `;
      if (offer) {
        card.onclick = () => selectHotel(index);
      }
      hotelsList.appendChild(card);
    });
  }
  
  document.getElementById('results-section').style.display = 'block';
}

function selectFlight(index) {
  SELECTED = { type: 'flight', data: FLIGHTS[index] };
  showBookingSummary();
}

function selectHotel(index) {
  SELECTED = { type: 'hotel', data: HOTELS[index] };
  showBookingSummary();
}

function showBookingSummary() {
  const bookingSection = document.getElementById('booking-section');
  const bookingDetails = document.getElementById('booking-details');
  
  if (SELECTED.type === 'flight') {
    const flight = SELECTED.data;
    const segment = flight.itineraries[0].segments[0];
    bookingDetails.innerHTML = `
      <h4>Flight Booking</h4>
      <p><strong>Route:</strong> ${segment.departure.iataCode} → ${segment.arrival.iataCode}</p>
      <p><strong>Departure:</strong> ${new Date(segment.departure.at).toLocaleString()}</p>
      <p><strong>Price:</strong> ${flight.price.total} ${flight.price.currency}</p>
    `;
  } else {
    const hotel = SELECTED.data;
    const offer = hotel.offers[0];
    bookingDetails.innerHTML = `
      <h4>Hotel Booking</h4>
      <p><strong>Hotel:</strong> ${hotel.hotel.name}</p>
      <p><strong>Location:</strong> ${hotel.hotel.cityCode}</p>
      <p><strong>Price:</strong> ${offer.price.total} ${offer.price.currency}</p>
    `;
  }
  
  bookingSection.style.display = 'block';
  bookingSection.scrollIntoView({ behavior: 'smooth' });
}

async function connectWallet() {
  if (typeof window.ethereum !== 'undefined') {
    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      userAccount = accounts[0];
      
      // Initialize Web3
      web3 = new Web3(window.ethereum);
      
      // Get balance
      const balance = await web3.eth.getBalance(userAccount);
      const ethBalance = web3.utils.fromWei(balance, 'ether');
      
      document.getElementById('wallet-balance').textContent = parseFloat(ethBalance).toFixed(4);
      document.getElementById('connect-wallet').textContent = 'Connected: ' + userAccount.slice(0, 6) + '...';
      
      alert('Wallet connected successfully!');
    } catch (error) {
      console.error('Wallet connection error:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  } else {
    alert('Please install MetaMask to use the wallet features!');
  }
}

async function confirmBooking() {
  if (!userAccount) {
    alert('Please connect your wallet first!');
    return;
  }
  
  if (!SELECTED) {
    alert('Please select a flight or hotel first!');
    return;
  }
  
  // In a real implementation, this would interact with the smart contract
  alert('Booking confirmed! Transaction will be processed via smart contract.');
  
  // Reset
  SELECTED = null;
  document.getElementById('booking-section').style.display = 'none';
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}