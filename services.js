/* Fonctionnalités :
 *  1. Sélection d'un service depuis les cartes
 *  2. Calcul automatique du prix total
 *  3. Validation et soumission du formulaire
 *  4. Affichage dynamique des réservations
 *  5. Annulation d'une réservation
 *  6. Notifications Toast
 *  7. Persistance localStorage
 */

'use strict';
const SERVICES = [
  {
    id:    'spa',
    name:  'Spa Treatment',
    price: 80,
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=120&auto=format&fit=crop&q=60'
  },
  {
    id:    'dining',
    name:  'Gourmet Dining',
    price: 65,
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&auto=format&fit=crop&q=60'
  },
  {
    id:    'pool',
    name:  'Pool & Activities',
    price: 45,
    image: 'https://images.unsplash.com/photo-1501183009487-b19466e3f6b7?w=120&auto=format&fit=crop&q=60'
  }
];
let bookings = loadBookings();
document.addEventListener('DOMContentLoaded', () => {
  setMinDates();
  renderBookings();
  attachCardListeners();
  attachFormListeners();
});
function setMinDates() {
  const today    = new Date().toISOString().split('T')[0];
  const checkIn  = document.getElementById('checkIn');
  const checkOut = document.getElementById('checkOut');
  if (checkIn)  checkIn.setAttribute('min', today);
  if (checkOut) checkOut.setAttribute('min', today);
}
function attachCardListeners() {
  document.querySelectorAll('.service-card').forEach(card => {
    const btn = card.querySelector('[data-action="reserve"]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const name = card.getAttribute('data-service');
      selectService(name);
    });
  });
}
function attachFormListeners() {
  const form = document.getElementById('reservationForm');
  if (!form) return;

  form.addEventListener('submit', handleSubmit);

  const checkIn  = document.getElementById('checkIn');
  const checkOut = document.getElementById('checkOut');
  document.getElementById('serviceSelect').addEventListener('change', updatePriceSummary);
  checkIn.addEventListener('change', () => {
    if (checkIn.value) checkOut.setAttribute('min', checkIn.value);
    if (checkOut.value && checkOut.value <= checkIn.value) {
      checkOut.value = '';
    }
    updatePriceSummary();
  });
  checkOut.addEventListener('change', updatePriceSummary);
  document.getElementById('guests').addEventListener('change', updatePriceSummary);
}

function selectService(serviceName) {
  const sel = document.getElementById('serviceSelect');
  if (!sel) return;

  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === serviceName) {
      sel.selectedIndex = i;
      break;
    }
  }

  updatePriceSummary();
  const panel = document.querySelector('.reservation-panel');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  sel.style.borderColor = '#B8922A';
  setTimeout(() => { sel.style.borderColor = ''; }, 1500);
}
function updatePriceSummary() {
  const summary    = document.getElementById('priceSummary');
  const sel        = document.getElementById('serviceSelect');
  const checkInEl  = document.getElementById('checkIn');
  const checkOutEl = document.getElementById('checkOut');

  if (!summary || !sel || !checkInEl || !checkOutEl) return;

  const serviceName = sel.value;
  const checkIn     = checkInEl.value;
  const checkOut    = checkOutEl.value;

  if (!serviceName || !checkIn || !checkOut) {
    summary.classList.remove('visible');
    return;
  }

  const service = SERVICES.find(s => s.name === serviceName);
  if (!service) return;

  const nights = getNights(checkIn, checkOut);

  if (nights <= 0) {
    showToast('La date de départ doit être après la date d\'arrivée.', 'error');
    summary.classList.remove('visible');
    return;
  }

  setText('summaryService', serviceName);
  setText('summaryRate',    service.price + '€ / nuit');
  setText('summaryNights',  nights + ' nuit' + (nights > 1 ? 's' : ''));
  setText('summaryTotal',   (service.price * nights) + '€');

  summary.classList.add('visible');
}
function handleSubmit(e) {
  e.preventDefault();

  const serviceName = getVal('serviceSelect');
  const checkIn     = getVal('checkIn');
  const checkOut    = getVal('checkOut');
  const guests      = parseInt(getVal('guests') || '1', 10);

  if (!serviceName) { showToast('Veuillez sélectionner un service.', 'error'); return; }
  if (!checkIn)     { showToast("Veuillez saisir une date d'arrivée.", 'error'); return; }
  if (!checkOut)    { showToast('Veuillez saisir une date de départ.', 'error'); return; }

  const nights = getNights(checkIn, checkOut);
  if (nights <= 0)  { showToast('Dates invalides. Vérifiez vos dates.', 'error'); return; }

  const service = SERVICES.find(s => s.name === serviceName);
  if (!service) return;

  const booking = {
    id:        Date.now(),
    serviceId: service.id,
    service:   serviceName,
    checkIn,
    checkOut,
    nights,
    guests,
    total:     service.price * nights,
    status:    'Confirmé',
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  saveBookings();
  renderBookings();

  showToast(
    '✓ Réservé : ' + serviceName + ' (' + nights + ' nuit' + (nights > 1 ? 's' : '') + ') — ' + booking.total + '€',
    'success'
  );

  e.target.reset();
  const summary = document.getElementById('priceSummary');
  if (summary) summary.classList.remove('visible');
}
function cancelBooking(id) {
  const booking = bookings.find(b => b.id === id);
  if (!booking) return;
  if (!confirm('Annuler la réservation "' + booking.service + '" ?')) return;

  bookings = bookings.filter(b => b.id !== id);
  saveBookings();
  renderBookings();
  showToast('Réservation annulée.', 'error');
}
function renderBookings() {
  const el = document.getElementById('bookings-list');
  if (!el) return;

  if (bookings.length === 0) {
    el.innerHTML = '<p class="bookings-empty">Aucune réservation pour le moment.</p>';
    return;
  }

  el.innerHTML = bookings.map(b => {
    const service = SERVICES.find(s => s.name === b.service);
    const img     = service ? service.image : '';
    const badge   = b.status === 'Confirmé'
      ? '<span class="badge badge--confirmed">Confirmé</span>'
      : '<span class="badge badge--pending">En attente</span>';

    return (
      '<div class="booking-item" id="booking-' + b.id + '">' +
        '<img class="booking-item__thumb" src="' + img + '" alt="' + b.service + '" />' +
        '<div class="booking-item__info">' +
          '<div class="booking-item__title">' + b.service + '</div>' +
          '<div class="booking-item__meta">' +
            formatDate(b.checkIn) + ' – ' + formatDate(b.checkOut) +
            ' · ' + b.guests + ' pers. · <strong>' + b.total + '€</strong>' +
          '</div>' +
          badge +
        '</div>' +
        '<button class="btn btn-danger" onclick="cancelBooking(' + b.id + ')">Annuler</button>' +
      '</div>'
    );
  }).join('');
}
function saveBookings() {
  try {
    localStorage.setItem('hotelLuxe_serviceBookings', JSON.stringify(bookings));
  } catch (e) {}
}

function loadBookings() {
  try {
    const raw = localStorage.getItem('hotelLuxe_serviceBookings');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function showToast(message, type) {
  type = type || 'success';
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className   = 'toast ' + type + ' show';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () {
    toast.classList.remove('show');
  }, 3500);
}
function getNights(checkIn, checkOut) {
  return Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function getVal(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}
