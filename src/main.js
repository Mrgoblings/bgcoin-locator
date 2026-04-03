import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import data from './data.json';

// ── Fix Leaflet default marker icons broken by Vite bundling ──
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
});

// ── Icons ──
function coinSvg({ size = 36, rim = '#a0762a', face = '#c8922a', shine = '#f7d96b', shineEdge = '#e0aa38', center = '#b87d25', text = 'BG', textColor = '#7a4f10', shadow = 'rgba(0,0,0,0.55)' } = {}) {
  const r = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="cg${size}" cx="38%" cy="32%" r="62%">
        <stop offset="0%"   stop-color="${shine}"/>
        <stop offset="40%"  stop-color="${shineEdge}"/>
        <stop offset="100%" stop-color="${center}"/>
      </radialGradient>
      <filter id="cs${size}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="${shadow}"/>
      </filter>
    </defs>
    <!-- rim -->
    <circle cx="${r}" cy="${r}" r="${r - 0.5}" fill="${rim}" filter="url(#cs${size})"/>
    <!-- rim notches -->
    ${Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const x1 = r + (r - 2) * Math.cos(a), y1 = r + (r - 2) * Math.sin(a);
      const x2 = r + (r - 4.5) * Math.cos(a), y2 = r + (r - 4.5) * Math.sin(a);
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${shineEdge}" stroke-width="1.2" opacity="0.6"/>`;
    }).join('')}
    <!-- face -->
    <circle cx="${r}" cy="${r}" r="${r - 5}" fill="url(#cg${size})"/>
    <!-- inner ring -->
    <circle cx="${r}" cy="${r}" r="${r - 5}" fill="none" stroke="${rim}" stroke-width="0.8" opacity="0.5"/>
    <!-- label -->
    <text x="${r}" y="${r + 4}" text-anchor="middle" font-family="Georgia,serif" font-size="${size * 0.28}" font-weight="bold" fill="${textColor}" opacity="0.85">${text}</text>
    <!-- shine arc -->
    <ellipse cx="${r - 3}" cy="${r - 5}" rx="${r * 0.35}" ry="${r * 0.18}" fill="white" opacity="0.18" transform="rotate(-30,${r},${r})"/>
  </svg>`;
}

const goldIcon = L.divIcon({
  className: '',
  html: coinSvg({ size: 36 }),
  iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20],
});
const highlightIcon = L.divIcon({
  className: '',
  html: coinSvg({ size: 42, rim: '#7a3010', face: '#c0440a', shine: '#ff9a5c', shineEdge: '#e05c20', center: '#a03008', text: '★', textColor: '#5a1a00' }),
  iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -24],
});

// ── Map ──
const map = L.map('map', { zoomControl: true, attributionControl: false }).setView([42.73, 25.48], 7);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd', maxZoom: 19,
}).addTo(map);

// ── Build markers ──
const markers = {};
for (const [city, info] of Object.entries(data)) {
  const { lat, lon, collections } = info;
  const popupHtml = `
    <div class="popup-title">${city}</div>
    <div class="popup-count">${collections.length} coin machine${collections.length !== 1 ? 's' : ''}</div>
    <ul class="popup-coins">${collections.map(c => `<li>${c}</li>`).join('')}</ul>`;
  const marker = L.marker([lat, lon], { icon: goldIcon })
    .addTo(map)
    .bindPopup(popupHtml, { maxWidth: 280 });
  markers[city] = { marker, info };
}

// ── Sidebar city list ──
const cityItems = document.getElementById('city-items');
let activeItem = null;

for (const [city] of Object.entries(markers)) {
  const li = document.createElement('li');
  li.innerHTML = `<span class="city-name">${city}</span><span class="coin-count">${markers[city].info.collections.length}</span>`;
  li.addEventListener('click', () => focusCity(city, li, true));
  cityItems.appendChild(li);
  markers[city].li = li;
}

// ── URL hash helpers ──
function setHash(params) {
  const sp = new URLSearchParams(params);
  history.pushState(params, '', '#' + sp.toString());
}
function clearHash() {
  history.pushState(null, '', window.location.pathname + window.location.search);
}
function getHash(state) {
  // prefer state object passed via popstate; fall back to URL hash
  if (state && typeof state === 'object' && Object.keys(state).length) return state;
  const raw = window.location.hash.slice(1);
  return raw ? Object.fromEntries(new URLSearchParams(raw)) : {};
}

// ── Helpers ──
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function allCitiesByDistance(lat, lon) {
  return Object.entries(markers)
    .map(([city, { info }]) => ({
      city, collections: info.collections,
      dist: Math.round(haversine(lat, lon, info.lat, info.lon)),
    }))
    .sort((a, b) => a.dist - b.dist);
}
function resetHighlights() {
  Object.values(markers).forEach(({ marker }) => marker.setIcon(goldIcon));
}

// ── Result panel ──
const resultPanel = document.getElementById('result-panel');

function showCityResult(city, collections) {
  sheetExpand();
  resultPanel.className = 'has-result';
  const inner = `
    <div class="result-city">${city}</div>
    ${collections.map(c => `<span class="result-tag">${c}</span>`).join('')}`;
  resultPanel.innerHTML = `
    <button class="result-close">✕ Back</button>
    <div class="result-inner">${inner}</div>`;
  resultPanel.querySelector('.result-close').addEventListener('click', () => clearResult(true));
}

function showLocationResult({ displayName, nearestCity, distanceKm, collections }) {
  sheetExpand();
  resultPanel.className = 'has-result';
  let inner = `<div class="result-city">${displayName}</div>`;
  if (nearestCity) {
    inner += `<div class="nearest-label">No coins here. Nearest location:</div>
              <div class="result-city">${nearestCity}</div>`;
  }
  if (collections?.length) inner += collections.map(c => `<span class="result-tag">${c}</span>`).join('');
  if (distanceKm != null) inner += `<div class="distance">~${distanceKm} km away</div>`;
  resultPanel.innerHTML = `
    <button class="result-close">✕ Back</button>
    <div class="result-inner">${inner}</div>`;
  resultPanel.querySelector('.result-close').addEventListener('click', () => clearResult(true));
}

function showNearbyResult(lat, lon, animate = true) {
  const sorted = allCitiesByDistance(lat, lon);
  if (animate) map.flyTo([lat, lon], 9, { duration: 1.2 });
  else map.setView([lat, lon], 9);

  sheetExpand();
  resultPanel.className = 'has-result';
  resultPanel.innerHTML = `
    <button class="result-close">✕ Back</button>
    <div class="result-inner">
      <div class="result-city" style="margin-bottom:6px">📍 Coins near you</div>
      <div id="nearby-list">
        ${sorted.map(({ city, collections, dist }) => `
          <div class="nearby-item" data-city="${city}">
            <div class="nearby-row">
              <span class="nearby-city">${city}</span>
              <span class="nearby-dist">${dist} km</span>
            </div>
            <div class="nearby-tags">
              ${collections.map(c => `<span class="result-tag">${c}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  resultPanel.querySelector('.result-close').addEventListener('click', () => clearResult(true));
  document.querySelectorAll('#nearby-list .nearby-item').forEach(el => {
    el.addEventListener('click', () => focusCity(el.dataset.city, markers[el.dataset.city].li, true));
  });
}

function clearResult(updateHash = false) {
  resultPanel.className = '';
  resultPanel.innerHTML = '';
  if (activeItem) { activeItem.classList.remove('active'); activeItem = null; }
  resetHighlights();
  if (updateHash) clearHash();
  if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
  if (myLocationMarker) { map.removeLayer(myLocationMarker); myLocationMarker = null; }
}

// ── Focus city ──
function focusCity(city, liEl, updateHash = false, animate = true) {
  clearResult(false);
  if (activeItem) activeItem.classList.remove('active');
  activeItem = liEl;
  liEl.classList.add('active');
  const { marker, info } = markers[city];
  if (animate) map.flyTo([info.lat, info.lon], 13, { duration: 1 });
  else map.setView([info.lat, info.lon], 13);
  marker.openPopup();
  showCityResult(city, info.collections);
  if (updateHash) setHash({ city });
}

// ── Search ──
let searchMarker = null;

async function doSearch(query, updateHash = true) {
  if (!query.trim()) return;

  const exact = Object.keys(markers).find(
    c => c.toLowerCase() === query.trim().toLowerCase()
  );
  if (exact) {
    focusCity(exact, markers[exact].li, updateHash, true);
    return;
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', България')}&format=json&limit=1&countrycodes=bg`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'bg' } });
    const results = await res.json();
    if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }

    if (!results.length) {
      resultPanel.className = 'has-result';
      resultPanel.innerHTML = `
        <button class="result-close">✕ Back</button>
        <div class="result-inner" style="color:#e06060">Location not found.</div>`;
      resultPanel.querySelector('.result-close').addEventListener('click', () => clearResult(true));
      return;
    }

    const { lat, lon, display_name } = results[0];
    const placeLat = parseFloat(lat), placeLon = parseFloat(lon);
    const zoom = 12;
    const name = display_name.split(',')[0];

    searchMarker = L.circleMarker([placeLat, placeLon], {
      radius: 8, color: '#f5c542', fillColor: '#f5c542', fillOpacity: 0.6, weight: 2,
    }).addTo(map).bindPopup(`<b>${name}</b><br><small>Searched location</small>`).openPopup();
    map.flyTo([placeLat, placeLon], zoom, { duration: 1 });

    const exactMatch = Object.keys(markers).find(
      c => display_name.toLowerCase().includes(c.toLowerCase())
    );

    if (exactMatch) {
      showLocationResult({ displayName: exactMatch, collections: markers[exactMatch].info.collections });
      resetHighlights();
      markers[exactMatch].marker.setIcon(highlightIcon);
    } else {
      let best = null, bestDist = Infinity;
      for (const [city, { info }] of Object.entries(markers)) {
        const d = haversine(placeLat, placeLon, info.lat, info.lon);
        if (d < bestDist) { bestDist = d; best = city; }
      }
      showLocationResult({ displayName: name, nearestCity: best, distanceKm: Math.round(bestDist), collections: [] });
      resetHighlights();
      markers[best].marker.setIcon(highlightIcon);
    }

    if (updateHash) setHash({ loc: `${placeLat.toFixed(5)},${placeLon.toFixed(5)},${zoom}`, name });
  } catch {
    resultPanel.className = 'has-result';
    resultPanel.innerHTML = `<div style="color:#e06060">Search failed.</div>`;
  }
}

document.getElementById('search-btn').addEventListener('click', () => {
  doSearch(document.getElementById('search-input').value);
});
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch(e.target.value);
});

// ── Geolocation ──
let myLocationMarker = null;
const locateBtn = document.getElementById('locate-btn');
const fabLocate = document.getElementById('fab-locate');

function applyNearby(lat, lon, animate = true) {
  if (myLocationMarker) map.removeLayer(myLocationMarker);
  myLocationMarker = L.circleMarker([lat, lon], {
    radius: 10, color: '#4fc3f7', fillColor: '#4fc3f7', fillOpacity: 0.85, weight: 3,
  }).addTo(map).bindPopup('<b>You are here</b>').openPopup();
  showNearbyResult(lat, lon, animate);
}

function doLocate() {
  if (!navigator.geolocation) {
    resultPanel.className = 'has-result';
    resultPanel.innerHTML = `<div style="color:#e06060">Geolocation not supported.</div>`;
    return;
  }
  [locateBtn, fabLocate].forEach(b => { b.disabled = true; });
  locateBtn.textContent = '⏳ Locating…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      [locateBtn, fabLocate].forEach(b => { b.disabled = false; });
      locateBtn.textContent = '📍 Use my location';
      const { latitude: lat, longitude: lon } = pos.coords;
      setHash({ nearby: `${lat.toFixed(5)},${lon.toFixed(5)}` });
      applyNearby(lat, lon, true);
    },
    (err) => {
      [locateBtn, fabLocate].forEach(b => { b.disabled = false; });
      locateBtn.textContent = '📍 Use my location';
      resultPanel.className = 'has-result';
      const msg = err.code === 1 ? 'Location access denied.' : 'Could not get your location.';
      resultPanel.innerHTML = `
        <button class="result-close">✕ Back</button>
        <div class="result-inner" style="color:#e06060">${msg}</div>`;
      resultPanel.querySelector('.result-close').addEventListener('click', () => clearResult(true));
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

locateBtn.addEventListener('click', doLocate);
fabLocate.addEventListener('click', doLocate);

// ── Restore from URL hash on load / navigation ──
async function restoreFromHash(state) {
  const h = getHash(state);
  if (!h || !Object.keys(h).length) return;

  if (h.city) {
    const city = decodeURIComponent(h.city);
    if (markers[city]) focusCity(city, markers[city].li, false, false);

  } else if (h.loc) {
    const [lat, lon, zoom] = h.loc.split(',').map(Number);
    const name = h.name ? decodeURIComponent(h.name) : 'Searched location';
    map.setView([lat, lon], zoom || 12);

    if (searchMarker) map.removeLayer(searchMarker);
    searchMarker = L.circleMarker([lat, lon], {
      radius: 8, color: '#f5c542', fillColor: '#f5c542', fillOpacity: 0.6, weight: 2,
    }).addTo(map).bindPopup(`<b>${name}</b><br><small>Searched location</small>`).openPopup();

    const exactMatch = Object.keys(markers).find(
      c => name.toLowerCase().includes(c.toLowerCase())
    );
    if (exactMatch) {
      showLocationResult({ displayName: exactMatch, collections: markers[exactMatch].info.collections });
      markers[exactMatch].marker.setIcon(highlightIcon);
    } else {
      let best = null, bestDist = Infinity;
      for (const [city, { info }] of Object.entries(markers)) {
        const d = haversine(lat, lon, info.lat, info.lon);
        if (d < bestDist) { bestDist = d; best = city; }
      }
      showLocationResult({ displayName: name, nearestCity: best, distanceKm: Math.round(bestDist), collections: [] });
      markers[best].marker.setIcon(highlightIcon);
    }

  } else if (h.nearby) {
    const [lat, lon] = h.nearby.split(',').map(Number);
    applyNearby(lat, lon, false);
  }
}

// popstate fires on browser back/forward (pushState navigation)
window.addEventListener('popstate', (e) => {
  clearResult(false);
  restoreFromHash(e.state);
});

// hashchange fires when user manually edits the URL hash
window.addEventListener('hashchange', () => {
  clearResult(false);
  restoreFromHash();
});

restoreFromHash();

// ── Mobile bottom sheet ──
const sidebar = document.getElementById('sidebar');
const sheetHandle = document.getElementById('sheet-handle');

const SHEET_COLLAPSED_H = 130;
const SHEET_EXPANDED_H  = () => Math.round(window.innerHeight * 0.64);

function sheetExpand()   { sidebar.style.height = SHEET_EXPANDED_H() + 'px'; sidebar.classList.remove('sheet-collapsed'); }
function sheetCollapse() { sidebar.style.height = SHEET_COLLAPSED_H + 'px'; sidebar.classList.add('sheet-collapsed'); }

// ── Drag handle ──
let dragStartY = 0, dragStartH = 0, isDragging = false, lastVY = 0, lastT = 0;

function onDragStart(e) {
  if (window.innerWidth > 700) return;
  isDragging = true;
  sidebar.style.transition = 'none';
  dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
  dragStartH = sidebar.offsetHeight;
  lastVY = 0; lastT = Date.now();
  e.preventDefault();
}

function onDragMove(e) {
  if (!isDragging) return;
  const y   = e.touches ? e.touches[0].clientY : e.clientY;
  const now = Date.now();
  lastVY = (y - dragStartY - (lastVY ? (y - dragStartY) : 0)) / Math.max(now - lastT, 1);
  lastT = now;
  const delta  = dragStartY - y;
  const newH   = Math.min(Math.max(dragStartH + delta, SHEET_COLLAPSED_H), window.innerHeight * 0.92);
  sidebar.style.height = newH + 'px';
  e.preventDefault();
}

function onDragEnd(e) {
  if (!isDragging) return;
  isDragging = false;
  sidebar.style.transition = '';
  const y     = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  const delta = dragStartY - y;
  const expandedH = SHEET_EXPANDED_H();
  // snap: fast swipe up, or dragged more than 30% of the way → expand; else collapse
  if (lastVY < -0.4 || delta > (expandedH - SHEET_COLLAPSED_H) * 0.3) {
    sheetExpand();
  } else if (lastVY > 0.4 || delta < -(expandedH - SHEET_COLLAPSED_H) * 0.3) {
    sheetCollapse();
  } else {
    // snap to whichever is closer
    const mid = (expandedH + SHEET_COLLAPSED_H) / 2;
    sidebar.offsetHeight > mid ? sheetExpand() : sheetCollapse();
  }
}

sheetHandle.addEventListener('touchstart', onDragStart, { passive: false });
sheetHandle.addEventListener('touchmove',  onDragMove,  { passive: false });
sheetHandle.addEventListener('touchend',   onDragEnd);
sheetHandle.addEventListener('mousedown',  onDragStart);
window.addEventListener('mousemove', onDragMove);
window.addEventListener('mouseup',   onDragEnd);

// Tap the map to collapse sheet on mobile
document.getElementById('map').addEventListener('click', () => {
  if (window.innerWidth <= 700) sheetCollapse();
});
