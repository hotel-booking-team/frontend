'use strict';

const STORAGE_KEY = 'mahariHotel_serviceBookings_v2';

const SERVICES = [
  {
    id: 1,
    nom_service: 'Spa Signature Mahari',
    type_service: 'Spa',
    prix: 52,
    description:
      'Hammam, gommage au savon noir et massage relaxant 50 min — praticiennes certifiées.',
    image:
      'https://static.sunweb.fr/products/Images/Original/47200000/15000/47215007-Original.jpg?width=1280&mode=crop&scale=both'
  },
  {
    id: 2,
    nom_service: "Restaurant L'Orient",
    type_service: 'Restaurant',
    prix: 58,
    description:
      'Carte méditerranéenne, poisson du jour et accords mets-vins avec notre sommelier.',
    image:
      'https://static.sunweb.fr/products/Images/Original/47200000/15000/47215015-Original.jpg?width=1280&mode=crop&scale=both'
  },
  {
    id: 3,
    nom_service: 'Lagon & espace piscine',
    type_service: 'Piscine',
    prix: 18,
    description:
      'Bassin chauffé, terrasse plein ciel, transats premium et serviettes fournies.',
    image: 'https://static.sunweb.fr/products/Images/Original/47200000/14000/47214983-Original.jpg?width=1280&mode=crop&scale=both'
  }
];

let bookings = [];
let activeFilter = 'all';
let toastTimeout;
let slideshowInterval;

const LEGACY_SERVICE_KEYS = { spa: 1, dining: 2, pool: 3 };

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findServiceById(id) {
  const n = Number(id);
  return SERVICES.find(s => s.id === n);
}

function resolveServiceForBooking(b) {
  if (!b) return undefined;
  if (b.service_id != null) {
    const byId = findServiceById(b.service_id);
    if (byId) return byId;
  }
  return SERVICES.find(s => s.nom_service === b.nom_service);
}

function getDurationHours(heureDebut, heureFin) {
  if (!heureDebut || !heureFin) return 0;
  const [h1, m1] = heureDebut.split(':').map(Number);
  const [h2, m2] = heureFin.split(':').map(Number);
  const start = h1 * 60 + m1;
  const end = h2 * 60 + m2;
  return (end - start) / 60;
}
function billableHours(rawHours) {
  if (rawHours <= 0) return 0;
  return Math.max(0.5, Math.ceil(rawHours * 2) / 2);
}

function formatDateFR(yyyyMmDd) {
  if (!yyyyMmDd) return '';
  const p = yyyyMmDd.split('-');
  if (p.length !== 3) return yyyyMmDd;
  return p[2] + '/' + p[1] + '/' + p[0];
}

function formatTimeFr(t) {
  if (!t) return '';
  return t.replace(':', 'h');
}

function setMinDate() {
  const el = document.getElementById('dateService');
  if (!el) return;
  el.setAttribute('min', new Date().toISOString().split('T')[0]);
}

function populateServiceSelect() {
  const sel = document.getElementById('serviceSelect');
  if (!sel) return;
  sel.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.disabled = true;
  opt0.selected = true;
  opt0.textContent = 'Choisir dans le catalogue…';
  sel.appendChild(opt0);
  SERVICES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = String(s.id);
    opt.textContent =
      s.nom_service + ' — ' + s.prix + ' € / pers. / h (' + s.type_service + ')';
    sel.appendChild(opt);
  });
}

function renderCatalog() {
  const root = document.getElementById('services-catalog');
  const countEl = document.getElementById('catalogCount');
  if (!root) return;
  const filteredServices = activeFilter === 'all'
    ? SERVICES
    : SERVICES.filter(s => s.type_service.toLowerCase() === activeFilter.toLowerCase());

  root.innerHTML = filteredServices.map(s => {
    const typeClass = 'service-card__type service-card__type--' + s.type_service.replace(/\s/g, '_');
    return `
      <article class="service-card" data-type="${escapeHtml(s.type_service)}" data-service-id="${s.id}">
        <div class="service-card__img-wrap">
          <img class="service-card__img" src="${escapeHtml(s.image)}" alt="${escapeHtml(s.nom_service)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x200?text=Image+non+disponible'" />
          <span class="${escapeHtml(typeClass)}">${escapeHtml(s.type_service)}</span>
        </div>
        <div class="service-card__body">
          <h3 class="service-card__title">${escapeHtml(s.nom_service)}</h3>
          <p class="service-card__desc">${escapeHtml(s.description)}</p>
          <p class="service-card__price"><span>${s.prix} €</span> / personne / heure</p>
          <button type="button" class="btn btn-primary btn-full" data-action="reserve" data-service-id="${s.id}">Réserver ce créneau</button>
        </div>
      </article>
    `;
  }).join('');

  root.querySelectorAll('[data-action="reserve"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectService(Number(btn.getAttribute('data-service-id')));
    });
  });

  if (countEl) {
    countEl.textContent = String(filteredServices.length);
  }
}

function applyFilter(filter) {
  activeFilter = filter;
  renderCatalog();
}

function selectService(serviceId) {
  const sel = document.getElementById('serviceSelect');
  if (!sel) return;
  sel.value = String(serviceId);
  sel.dispatchEvent(new Event('change'));
  updatePriceSummary();
  const panel = document.querySelector('.form-panel');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  sel.style.borderColor = '#c9a84c';
  setTimeout(() => {
    sel.style.borderColor = '';
  }, 1400);
}

function updatePriceSummary() {
  const box = document.getElementById('priceSummary');
  const sel = document.getElementById('serviceSelect');
  const dateEl = document.getElementById('dateService');
  const t1 = document.getElementById('heureDebut');
  const t2 = document.getElementById('heureFin');
  const partEl = document.getElementById('participants');

  if (!box || !sel || !dateEl || !t1 || !t2 || !partEl) return;

  const service = findServiceById(sel.value);
  const date = dateEl.value;
  const heureDebut = t1.value;
  const heureFin = t2.value;
  const participants = Math.max(1, parseInt(partEl.value, 10) || 1);

  if (!service || !date || !heureDebut || !heureFin) {
    box.hidden = true;
    return;
  }

  const rawDur = getDurationHours(heureDebut, heureFin);
  if (rawDur <= 0) {
    box.hidden = true;
    return;
  }

  const hours = billableHours(rawDur);
  const total = Math.round(service.prix * participants * hours * 100) / 100;

  document.getElementById('summaryService').textContent = service.nom_service;
  document.getElementById('summaryDuration').textContent =
    hours + ' h (' + formatTimeFr(heureDebut) + ' – ' + formatTimeFr(heureFin) + ')';
  document.getElementById('summaryParticipants').textContent = String(participants);
  document.getElementById('summaryTotal').textContent = total + ' €';

  box.hidden = false;
}

function cancelBooking(id) {
  const normalizedId = Number(id);
  const booking = bookings.find(b => Number(b.id) === normalizedId);
  if (!booking) {
    showToast('Réservation non trouvée.', 'error');
    return;
  }
  if (!confirm('Annuler la réservation pour « ' + booking.nom_service + ' » ?')) return;

  bookings = bookings.filter(b => Number(b.id) !== normalizedId);
  saveBookings();
  renderBookings();
  showToast('Réservation annulée avec succès.', 'success');
}
function handleSubmit(e) {
  e.preventDefault();

  const sel = document.getElementById('serviceSelect');
  const service = findServiceById(sel && sel.value);
  const date = getVal('dateService');
  const heureDebut = getVal('heureDebut');
  const heureFin = getVal('heureFin');
  const participants = Math.max(1, parseInt(getVal('participants') || '1', 10));

  if (!service) {
    showToast('Veuillez sélectionner une prestation.', 'error');
    return;
  }
  if (!date) {
    showToast('Veuillez choisir une date.', 'error');
    return;
  }
  if (!heureDebut || !heureFin) {
    showToast('Indiquez les heures de début et de fin.', 'error');
    return;
  }

  const rawDur = getDurationHours(heureDebut, heureFin);
  if (rawDur <= 0) {
    showToast('Créneau horaire invalide.', 'error');
    return;
  }

  const hours = billableHours(rawDur);
  const total = Math.round(service.prix * participants * hours * 100) / 100;

  const booking = {
    id: Date.now(),
    type_reservation: 'service',
    client_id: null,
    service_id: service.id,
    nom_service: service.nom_service,
    type_service: service.type_service,
    date_debut: date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    duree_facturee_h: hours,
    participants,
    total,
    statut: 'confirmé',
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  saveBookings();
  renderBookings();

  showToast(
    'Réservation enregistrée : ' +
      service.nom_service +
      ' le ' +
      formatDateFR(date) +
      ' de ' +
      formatTimeFr(heureDebut) +
      ' à ' +
      formatTimeFr(heureFin) +
      ' — ' +
      total +
      ' €',
    'success'
  );

  // Reset form but keep service selection
  const form = document.getElementById('serviceReservationForm');
  if (form) {
    const selectedService = sel.value;
    form.reset();
    sel.value = selectedService;
    setMinDate();
    document.getElementById('heureDebut').value = '10:00';
    document.getElementById('heureFin').value = '12:00';
    document.getElementById('participants').value = '1';
    updatePriceSummary();
  }
}

function renderBookings() {
  const el = document.getElementById('bookings-list');
  if (!el) return;

  if (bookings.length === 0) {
    el.innerHTML = '<p class="bookings-empty">Aucune réservation de service pour le moment.</p>';
    return;
  }

  const sorted = [...bookings].sort((a, b) => b.id - a.id);

  el.innerHTML = sorted
    .map(b => {
      const svc = resolveServiceForBooking(b);
      const img = svc && svc.image ? svc.image : '';
      const title = escapeHtml(b.nom_service || '');
      const type = escapeHtml(b.type_service || '');
      const st = (b.statut || '').toLowerCase();
      const badge = st === 'confirmé'
        ? '<span class="booking-row__badge">Confirmé</span>'
        : '<span class="booking-row__badge" style="background:#fef3c7;color:#92400e">En attente</span>';

      return `
        <div class="booking-row" data-booking-id="${b.id}">
          <img class="booking-row__thumb" src="${escapeHtml(img)}" alt="${escapeHtml(title)}" onerror="this.src='https://via.placeholder.com/72x60?text=No+image'" />
          <div class="booking-row__main">
            <div class="booking-row__title">${title}</div>
            <div class="booking-row__meta">
              ${formatDateFR(b.date_debut)} · ${formatTimeFr(b.heure_debut)} – ${formatTimeFr(b.heure_fin)} · ${b.participants} pers. · <strong>${typeof b.total === 'number' ? b.total.toFixed(2) : b.total} €</strong> · ${type}
            </div>
            ${badge}
          </div>
          <button type="button" class="btn btn-danger btn-cancel" data-booking-cancel="${b.id}">Annuler</button>
        </div>
      `;
    })
    .join('');
  el.addEventListener('click', function delegateCancelClick(e) {
    const btn = e.target.closest('[data-booking-cancel]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      cancelBooking(Number(btn.getAttribute('data-booking-cancel')));
    }
  }, { once: true });
}

function saveBookings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  } catch (err) {
    console.warn('Failed to save bookings:', err);
  }
}

function loadBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data.map(b => ({
          ...b,
          id: Number(b.id),
          total: Number(b.total)
        }));
      }
    }
  } catch (err) {
    console.warn('Failed to load bookings:', err);
  }

  const legacyRaw = localStorage.getItem('hotelLuxe_serviceBookings');
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy) && legacy.length) {
        const migrated = migrateLegacyBookings(legacy);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        } catch (e) {}
        return migrated;
      }
    } catch (e) {}
  }

  return [];
}

function resolveLegacyService(row) {
  if (row.service_id != null && findServiceById(row.service_id)) return findServiceById(row.service_id);
  const fromKey = LEGACY_SERVICE_KEYS[row.serviceId];
  if (fromKey) return findServiceById(fromKey);
  return SERVICES.find(s => s.nom_service === row.nom_service || s.nom_service === row.service);
}

function migrateLegacyBookings(legacy) {
  return legacy
    .map(row => {
      if (row.date_debut && row.heure_debut) return row;
      const svc = resolveLegacyService(row);
      if (!row.checkIn || !row.checkOut || !svc) return null;
      const hours = 2;
      const participants = row.guests || 1;
      const total = row.total != null ? row.total : Math.round(svc.prix * participants * hours * 100) / 100;
      return {
        id: row.id || Date.now(),
        type_reservation: 'service',
        client_id: null,
        service_id: svc.id,
        nom_service: svc.nom_service,
        type_service: svc.type_service,
        date_debut: row.checkIn,
        heure_debut: '14:00',
        heure_fin: '16:00',
        duree_facturee_h: hours,
        participants,
        total,
        statut: 'confirmé',
        createdAt: row.createdAt || new Date().toISOString()
      };
    })
    .filter(Boolean);
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + (type || 'success') + ' show';
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3800);
}

function getVal(id) {
  const node = document.getElementById(id);
  return node ? node.value.trim() : '';
}

function attachFormListeners() {
  const form = document.getElementById('serviceReservationForm');
  if (!form) return;

  form.removeEventListener('submit', handleSubmit);
  form.addEventListener('submit', handleSubmit);

  ['serviceSelect', 'dateService', 'heureDebut', 'heureFin', 'participants'].forEach(id => {
    const node = document.getElementById(id);
    if (node) {
      node.removeEventListener('change', updatePriceSummary);
      node.addEventListener('change', updatePriceSummary);
    }
  });

  const t1 = document.getElementById('heureDebut');
  const t2 = document.getElementById('heureFin');
  if (t1) {
    t1.removeEventListener('input', updatePriceSummary);
    t1.addEventListener('input', updatePriceSummary);
  }
  if (t2) {
    t2.removeEventListener('input', updatePriceSummary);
    t2.addEventListener('input', updatePriceSummary);
  }

  const part = document.getElementById('participants');
  if (part) {
    part.removeEventListener('input', updatePriceSummary);
    part.addEventListener('input', updatePriceSummary);
  }
}
function filterHandler(e) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  applyFilter(e.currentTarget.getAttribute('data-filter') || 'all');
}

function attachFilterListeners() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.removeEventListener('click', filterHandler);
    btn.addEventListener('click', filterHandler);
  });
}

function startHeroSlideshow() {
  const slides = document.querySelectorAll('.hero-slide');
  if (slides.length < 2) return;
  let i = 0;
  slideshowInterval = setInterval(() => {
    slides[i].classList.remove('active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('active');
  }, 4500);
}
document.addEventListener('DOMContentLoaded', () => {
  setMinDate();
  populateServiceSelect();
  renderCatalog();
  bookings = loadBookings();
  renderBookings();
  attachFormListeners();
  attachFilterListeners();
  startHeroSlideshow();
  updatePriceSummary();
});
