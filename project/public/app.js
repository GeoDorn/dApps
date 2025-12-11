const API_BASE_URL = 'http://localhost:3000';

FLIGHTS = [];
HOTELS = [];
SELECTED = null;

// DOM elements
const searchForm = document.getElementById('searchForm');
const resultsContainer = document.getElementById('results');
const loadingIndicator = document.getElementById('loading');
const originLocationCode = document.getElementById("originLocationCode");
const destinationLocationCode = document.getElementById("destinationLocationCode");
const departureInput = document.getElementById("departureDateInput");
const returnCheckbox = document.getElementById("returnFlightCheckbox");
const returnDateWrapper = document.getElementById("returnDateWrapper");
const returnDateInput = document.getElementById("returnDateInput");
const adultsInput = document.getElementById("adultsInput");


// Toggle return date visibility
returnCheckbox.addEventListener("change", () => {
  returnDateWrapper.style.display = returnCheckbox.checked ? "block" : "none";

  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];
  
  // Set the min and default date
  departureInput.min = today;
  departureInput.value = today;
  if (returnCheckbox.checked) {
    returnDateInput.min = today;
    returnDateInput.value = today;
  }
  
  // Clear the date if unchecked
  if (!returnCheckbox.checked) {
    returnDateInput.value = "";
  }
});

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  searchForm.addEventListener('submit', handleSearch);
});

async function handleSearch(e) {
  e.preventDefault();
  
  const origin = originLocationCode.value.trim().toUpperCase();
  const destination = destinationLocationCode.value.trim().toUpperCase();
  const departureDate = departureDateInput.value;

  // Only include return date if checkbox is checked
  const returnDate = returnCheckbox.checked ? returnDateInput.value : '';

  const adults = adultsInput.value;

  if (!origin || !destination) {
    showError('Please enter a city code');
    return;
  }

  // Validate origin & destination codes
  if (origin.length !== 3 || destination.length !== 3) {
    showError('City code must be 3 letters (e.g., NYC, LON, PAR)');
    return;
  }

  // Validate return date (only if return flight selected)
  if (returnCheckbox.checked && !returnDate) {
    showError("Please select a return date.");
    return;
  }

  await searchFlights(origin, destination, departureDate, returnDate, adults);
}


//Search for flights
async function searchFlights(originLocationCode,destinationLocationCode,departureDate,returnDate,adults) {
  showLoading(true);
  clearResults();
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/flights?originLocationCode=${originLocationCode}&destinationLocationCode=${destinationLocationCode}&departureDate=${departureDate}&returnDate=${returnDate}&adults=${adults}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch flight');
    }
    
    displayFlightResults(data);
  } catch (error) {
    showError(`Error: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

// Search for hotels
async function searchHotels(destinationLocationCode) {
  showLoading(true);
  clearResults();
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/hotels?cityCode=${destinationLocationCode}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch flight');
    }
    
    displayResults(data);
  } catch (error) {
    showError(`Error: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

// Display flight results
function displayFlightResults(data) {
  if (!data.data || data.data.length === 0) {
    resultsContainer.innerHTML = '<p class="no-results">No flights available</p>';
    return;
  }

  const flightsHTML = data.data.map(flight => {
    // Get first itinerary (you could loop if you want multiple)
    const itinerary = flight.itineraries[0];

    // Map segments to HTML
    const segmentsHTML = itinerary.segments.map(segment => `
      <li>
        ✈ ${segment.departure.iataCode} (${segment.departure.at}) → 
        ${segment.arrival.iataCode} (${segment.arrival.at}) | 
        Duration: ${segment.duration} | Flight: ${segment.carrierCode}${segment.number}
      </li>
    `).join("");

    return `
      <div class="flight-card">
        <h3>Flight ID: ${flight.id} | Total Price: ${flight.price.total} ${flight.price.currency}</h3>
        <ul>
          ${segmentsHTML}
        </ul>
        <p>Bookable Seats: ${flight.numberOfBookableSeats}</p>
      </div>
    `;
  }).join("");

  resultsContainer.innerHTML = flightsHTML;
}

// Display hotel results
function displayHotelResults(data) {
  if (!data.data || data.data.length === 0) {
    resultsContainer.innerHTML = '<p class="no-results">No hotels available</p>';
    return;
  }
  
  const hotelsHTML = data.data.map(hotel => `
    <div class="hotel-card">
      <h3>${hotel.name}</h3>
      <p class="hotel-id">Hotel ID: ${hotel.hotelId}</p>
      ${hotel.iataCode ? `<p class="iata-code">IATA: ${hotel.iataCode}</p>` : ''}
      ${hotel.address ? `
        <div class="hotel-address">
          <strong>Address:</strong>
          ${hotel.address.cityName ? `<p>${hotel.address.cityName}</p>` : ''}
          ${hotel.address.countryCode ? `<p>${hotel.address.countryCode}</p>` : ''}
        </div>
      ` : ''}
      ${hotel.geoCode ? `
        <p class="coordinates">
          📍 ${hotel.geoCode.latitude}, ${hotel.geoCode.longitude}
        </p>
      ` : ''}
    </div>
  `).join('');
  
  resultsContainer.innerHTML = hotelsHTML;
}

// Show/hide loading indicator
function showLoading(show) {
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'block' : 'none';
  }
}

// Clear results
function clearResults() {
  resultsContainer.innerHTML = '';
}

// Show error message
function showError(message) {
  resultsContainer.innerHTML = `
    <div class="error-message">
      <strong>⚠️ Error:</strong> ${message}
    </div>
  `;
}