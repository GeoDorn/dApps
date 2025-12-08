// ---- State ----
let HOTELS = [];
let SELECTED = null;

// ---- DOM helpers ----
const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => [...el.querySelectorAll(s)];
const fmt = (n) => new Intl.NumberFormat(undefined, {style:'currency', currency:'GBP'}).format(n);

// Deterministic fake price per night for a hotel (so it looks stable)
function pricePerNight(h) {
  const s = (h.hotelId || h.name || "X") + (h.cityCode || "");
  let hash = 0; for (let i=0;i<s.length;i++) hash = ((hash<<5)-hash)+s.charCodeAt(i) | 0;
  const base = 95 + Math.abs(hash % 120); // 95–214
  return base;
}

function nights(a, b) {
  const ms = (new Date(b)) - (new Date(a));
  return Math.max(1, Math.round(ms / (1000*60*60*24)));
}

function toast(msg) {
  const t = qs('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2400);
}

// ---- Fetch hotels ----
async function fetchHotelsByCityCode(cityCode) {
  const helper = qs('#destination');
  helper.textContent = "Jetting off!";
  try {
    const resp = await fetch(`/api/hotels?cityCode=${encodeURIComponent(cityCode)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.detail || 'Request failed');
    HOTELS = Array.isArray(data.data) ? data.data : [];
    renderHotels(HOTELS);
    helper.textContent = HOTELS.length ? `Found ${HOTELS.length} hotels in ${cityCode}.` : "No hotels found.";
  } catch (err) {
    console.error(err);
    toast(`Error: ${err.message}`);
    helper.textContent = "Search failed. Try a different city code.";
    qs('#results').innerHTML = '';
  }
}

// ---- Render cards ----
function renderHotels(list) {
  const wrap = qs('#results');
  wrap.innerHTML = '';
  list.forEach(h => {
    const chain = h.chainCode ? `<span class="badge">Chain ${h.chainCode}</span>` : '';
    const id    = h.hotelId ? `<span class="badge">ID ${h.hotelId}</span>` : '';
    const per   = pricePerNight(h);
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="kv">${chain} ${id}</div>
      <h3>${h.name || 'Unnamed Hotel'}</h3>
      <div class="kv">City: ${h.cityCode || '—'}</div>
      <div class="kv">From ${fmt(per)}/night</div>
      <div class="actions-row">
        <span></span>
        <button class="btn primary" data-hid="${h.hotelId}">Book</button>
      </div>
    `;
    wrap.appendChild(card);
  });

  // Bind book buttons
  qsa('.btn.primary').forEach(b =>
    b.addEventListener('click', (e) => {
      const hid = e.currentTarget.getAttribute('data-hid');
      SELECTED = HOTELS.find(x => String(x.hotelId) === String(hid));
      openBookingModal(SELECTED);
    })
  );
}

// ---- Modal ----
function openBookingModal(hotel) {
  if (!hotel) return;
  const modal = qs('#modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  qs('#bk-hotel').value = `${hotel.name || 'Hotel'} (${hotel.cityCode || '—'})`;
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24*3600*1000);
  qs('#bk-checkin').value = today.toISOString().slice(0,10);
  qs('#bk-checkout').value = tomorrow.toISOString().slice(0,10);
  qs('#bk-checkin').min = today.toISOString().slice(0,10);
  qs('#bk-checkout').min = qs('#bk-checkin').value;
  updateEstimatedPrice();
}

function closeModal() {
  const modal = qs('#modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  qs('#booking-form').reset();
  qs('#confirmation').classList.add('hidden');
  qs('#booking-form').classList.remove('hidden');
}

// Update price when dates or guests change
function updateEstimatedPrice() {
  if (!SELECTED) return;
  const per = pricePerNight(SELECTED);
  const n   = nights(qs('#bk-checkin').value, qs('#bk-checkout').value);
  const g   = Math.max(1, Number(qs('#bk-guests').value || 1));
  const total = per * n * Math.ceil(g/2); // pretend 2 guests per room
  qs('#bk-price').textContent = fmt(total);
  return total;
}

// ---- Booking submit ----
async function submitBooking(e) {
  e.preventDefault();
  if (!SELECTED) return;

  const checkIn  = qs('#bk-checkin').value;
  const checkOut = qs('#bk-checkout').value;
  if (new Date(checkOut) <= new Date(checkIn)) {
    toast("Check-out must be after check-in.");
    return;
  }

  const payload = {
    hotelId:   SELECTED.hotelId,
    hotelName: SELECTED.name,
    cityCode:  SELECTED.cityCode,
    checkIn, checkOut,
    guests: Number(qs('#bk-guests').value || 1),
    fullName: qs('#bk-name').value.trim(),
    email:    qs('#bk-email').value.trim(),
    price:    updateEstimatedPrice()
  };

  try {
    const resp = await fetch('/api/bookings', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.detail || 'Booking failed');
    showConfirmation(data.booking);
  } catch (err) {
    console.error(err);
    toast(`Booking error: ${err.message}`);
  }
}

function showConfirmation(bk) {
  qs('#booking-form').classList.add('hidden');
  const c = qs('#confirmation');
  c.classList.remove('hidden');
  qs('#c-code').textContent = `Confirmation: ${bk.confirmation}`;
  qs('#c-summary').textContent =
    `${bk.fullName} — ${bk.hotelName} (${bk.cityCode}), ${bk.checkIn} → ${bk.checkOut}, ${bk.guests} guest(s), ${fmt(bk.price)}.`;
}

// ---- Event wiring ----
document.getElementById('api-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const city = qs('#city-code').value.trim().toUpperCase();
  if (!city) return toast('Please enter a city code (e.g., PAR)');
  fetchHotelsByCityCode(city);
});

qs('#bk-checkin').addEventListener('change', () => {
  qs('#bk-checkout').min = qs('#bk-checkin').value;
  updateEstimatedPrice();
});
['#bk-checkout','#bk-guests'].forEach(sel => qs(sel).addEventListener('change', updateEstimatedPrice));

qs('#booking-form').addEventListener('submit', submitBooking);
qs('#cancel-booking').addEventListener('click', closeModal);
qs('#close-modal').addEventListener('click', closeModal);
qs('#close-confirmation').addEventListener('click', closeModal);

// My Bookings link (optional quick display)
qs('#view-bookings').addEventListener('click', async (e) => {
  e.preventDefault();
  const r = await fetch('/api/bookings');
  const j = await r.json();
  const list = Array.isArray(j.data) ? j.data : [];
  if (!list.length) return toast('No bookings yet.');
  const human = list.slice(0,3).map(b => `${b.confirmation} • ${b.hotelName} ${b.cityCode} • ${b.checkIn}→${b.checkOut}`).join(' | ');
  toast(human);
});
