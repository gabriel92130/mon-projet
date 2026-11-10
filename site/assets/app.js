/* GS HORIZON — interactions du site public */
(() => {
  'use strict';

  const PHONE_WA = '33759626982';
  const EMAIL = 'contact@gs-horizon.com';
  const API_URL = '/api/catalogue.php';
  const FRAME_COUNT = 169;
  const FRAME_URL = (i) => `/frames/${String(i + 1).padStart(3, '0')}.webp`;
  const PAGE_SIZE = 9;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null; };
  const fmtPrice = (v) => { const n = num(v); return n ? n.toLocaleString('fr-FR') + ' €' : 'Prix sur demande'; };
  const fmtKm = (v) => { const n = num(v); return n !== null ? n.toLocaleString('fr-FR') + ' km' : ''; };
  const waLink = (text) => `https://wa.me/${PHONE_WA}?text=${encodeURIComponent(text)}`;

  /* ------------------------------------------------------------------
     Header : état au scroll, menu mobile, lien actif
  ------------------------------------------------------------------ */
  const header = $('#site-header');
  const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  const nav = $('#main-nav');
  const toggle = $('#menu-toggle');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    toggle.querySelector('use').setAttribute('href', open ? '#i-x' : '#i-menu');
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); } });

  const navLinks = $$('a', nav);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['catalogue', 'process', 'rachat', 'avis', 'contact'].forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

  /* ------------------------------------------------------------------
     Apparition au scroll
  ------------------------------------------------------------------ */
  const revealIO = 'IntersectionObserver' in window && !reducedMotion
    ? new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  const reveal = (els) => { if (!revealIO) return; els.forEach((el) => { el.classList.add('reveal'); revealIO.observe(el); }); };
  reveal($$('.section-head, .rating-summary, .review, .social-card, .split > *'));

  /* ------------------------------------------------------------------
     Section "Notre méthode" : séquence d'images pilotée au scroll
  ------------------------------------------------------------------ */
  (function processAnimation() {
    const track = $('#process-track');
    const canvas = $('#frames-canvas');
    if (!track || !canvas) return;
    const ctx = canvas.getContext('2d');
    const steps = $$('.step', track);
    const bar = $('#process-bar');
    const frames = new Array(FRAME_COUNT);
    let current = -1;
    let wanted = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      current = -1;
      draw(wanted);
    };

    const nearestLoaded = (i) => {
      for (let d = 0; d < FRAME_COUNT; d++) {
        if (frames[i - d]) return i - d;
        if (frames[i + d]) return i + d;
      }
      return -1;
    };

    function draw(i) {
      const idx = nearestLoaded(i);
      if (idx < 0 || idx === current) return;
      current = idx;
      const img = frames[idx];
      const cw = canvas.width, ch = canvas.height;
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    const load = (i) => new Promise((res) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { frames[i] = img; if (Math.abs(i - wanted) < 3 || current < 0) draw(wanted); res(); };
      img.onerror = res;
      img.src = FRAME_URL(i);
    });

    if (reducedMotion) {
      // Mouvement réduit : une seule image représentative, pas d'animation
      wanted = 120;
      load(120);
      new ResizeObserver(resize).observe(canvas);
      return;
    }

    const update = () => {
      const r = track.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / (total || 1)));
      wanted = Math.min(FRAME_COUNT - 1, Math.floor(p * FRAME_COUNT));
      draw(wanted);
      bar.style.width = (p * 100).toFixed(1) + '%';
      const active = Math.min(steps.length - 1, Math.floor(p * steps.length));
      steps.forEach((s, k) => s.classList.toggle('is-active', k === active));
    };
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    new ResizeObserver(resize).observe(canvas);

    // Chargement progressif : on commence quand la section approche (ne bloque pas l'affichage)
    const start = async () => {
      await load(0);
      const order = [];
      for (let step = 16; step >= 1; step = Math.floor(step / 2)) {
        for (let i = 0; i < FRAME_COUNT; i += step) if (!order.includes(i)) order.push(i);
      }
      const queue = order.filter((i) => i !== 0);
      const worker = async () => { while (queue.length) await load(queue.shift()); };
      await Promise.all([worker(), worker(), worker(), worker()]);
    };
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { io.disconnect(); start(); update(); }
    }, { rootMargin: '600px 0px' });
    io.observe(track);
  })();

  /* ------------------------------------------------------------------
     Catalogue
  ------------------------------------------------------------------ */
  const state = { all: [], soon: [], sold: [], filter: 'all', query: '', sort: 'recent', shown: PAGE_SIZE };
  const byId = new Map();

  const photosOf = (v) => {
    let p = v.photos ?? v.photo ?? [];
    if (typeof p === 'string') {
      try { p = JSON.parse(p.replace(/'/g, '"')); } catch { p = [p]; }
    }
    return (Array.isArray(p) ? p : [p]).filter(Boolean).map((u) => (/^(https?:|\/|data:)/.test(u) ? u : '/' + u));
  };
  const titleOf = (v) => [v.brand, v.model].filter(Boolean).join(' ') || v.title || 'Véhicule';
  const kindOf = (v) => (String(v.status).toLowerCase() === 'neuf' ? 'neuf' : 'occasion');

  function specsHTML(v) {
    const items = [
      v.year && [icon('i-calendar'), esc(v.year)],
      fmtKm(v.mileage ?? v.km) && [icon('i-gauge'), fmtKm(v.mileage ?? v.km)],
      v.fuel && [icon('i-fuel'), esc(v.fuel)],
      (v.gearbox || v.transmission) && [icon('i-settings-2'), esc(v.gearbox || v.transmission)],
    ].filter(Boolean);
    return `<ul class="specs">${items.map(([i, t]) => `<li>${i}${t}</li>`).join('')}</ul>`;
  }

  function cardHTML(v, mode = 'stock') {
    const photos = photosOf(v);
    const status = String(v.status || 'dispo').toLowerCase();
    const sold = mode === 'sold' || status === 'vendu';
    const badge = mode === 'soon' ? '<span class="badge soon">Bientôt</span>'
      : sold ? '<span class="badge sold">Vendu</span>'
      : status === 'neuf' ? '<span class="badge neuf">Neuf</span>'
      : status === 'reserve' || status === 'réservé' ? '<span class="badge">Réservé</span>' : '';
    const media = photos[0]
      ? `<img src="${esc(photos[0])}" alt="${esc(titleOf(v))}" loading="lazy" decoding="async"/>`
      : `<div class="placeholder">${icon('i-car')}</div>`;
    const count = photos.length > 1 ? `<span class="vcard-photos">${icon('i-image')}${photos.length}</span>` : '';
    const foot = mode === 'soon'
      ? `<div><span class="price-note">Arrivage prochain</span></div><span class="btn btn-ghost btn-sm" aria-hidden="true">Détails</span>`
      : sold
        ? `<div><span class="price">${fmtPrice(v.price)}</span>${v.sold_at ? `<span class="price-note">Vendu le ${esc(new Date(v.sold_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }))}</span>` : ''}</div>`
        : `<div><span class="price">${fmtPrice(v.price)}</span><span class="price-note">TTC · ${status === 'neuf' ? 'garantie constructeur' : 'garantie 12 mois'}</span></div>
           <a class="btn btn-primary btn-sm" href="/commande.html?vehicleId=${encodeURIComponent(v.id)}">Réserver</a>`;
    return `
      <article class="vcard${mode === 'stock' ? '' : ' vcard-' + mode}">
        <div class="vcard-media">${badge}${media}${count}</div>
        <div class="vcard-body">
          <span class="vcard-brand">${esc(v.brand || '')}</span>
          <h3 class="vcard-title"><button type="button" data-vehicle="${esc(v.id)}" data-mode="${mode}" aria-haspopup="dialog">${esc(v.model || titleOf(v))}</button></h3>
          ${specsHTML(v)}
          <div class="vcard-foot">${foot}</div>
        </div>
      </article>`;
  }

  const skeletons = (n) => Array.from({ length: n }, () => `
    <div class="vcard skeleton" aria-hidden="true"><div class="vcard-media"></div>
      <div class="vcard-body"><div class="sk" style="width:30%"></div><div class="sk" style="width:70%;height:22px"></div><div class="sk" style="width:90%"></div><div class="sk" style="width:45%;height:26px;margin-top:16px"></div></div>
    </div>`).join('');

  const grid = $('#cat-grid');
  const countEl = $('#cat-count');
  const moreBtn = $('#cat-more');
  grid.innerHTML = skeletons(6);

  function filtered() {
    const q = state.query.trim().toLowerCase();
    let list = state.all.filter((v) => {
      if (state.filter !== 'all' && kindOf(v) !== state.filter) return false;
      if (!q) return true;
      return [v.brand, v.model, v.title, v.fuel, v.gearbox, v.year, v.color].join(' ').toLowerCase().includes(q);
    });
    const price = (v) => num(v.price) ?? Infinity;
    const km = (v) => num(v.mileage ?? v.km) ?? Infinity;
    const sorters = {
      'recent': (a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')),
      'price-asc': (a, b) => price(a) - price(b),
      'price-desc': (a, b) => (num(b.price) ?? -1) - (num(a.price) ?? -1),
      'km-asc': (a, b) => km(a) - km(b),
    };
    list = list.slice().sort(sorters[state.sort]);
    // Les véhicules vendus passent toujours en dernier
    return list.sort((a, b) => (String(a.status) === 'vendu') - (String(b.status) === 'vendu'));
  }

  function renderCatalogue() {
    const list = filtered();
    grid.setAttribute('aria-busy', 'false');
    if (!state.all.length) {
      grid.innerHTML = `<div class="empty-state">${icon('i-car')}<p>Nouveaux véhicules en préparation. Contactez-nous pour connaître les prochains arrivages.</p><a class="btn btn-primary" href="#contact">Nous contacter</a></div>`;
      countEl.textContent = '';
      moreBtn.hidden = true;
      return;
    }
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">${icon('i-search')}<p>Aucun véhicule ne correspond à votre recherche.</p><button class="btn btn-ghost" type="button" data-reset>Réinitialiser les filtres</button></div>`;
      countEl.textContent = '0 véhicule';
      moreBtn.hidden = true;
      return;
    }
    grid.innerHTML = list.slice(0, state.shown).map((v) => cardHTML(v)).join('');
    countEl.textContent = `${list.length} véhicule${list.length > 1 ? 's' : ''}`;
    moreBtn.hidden = list.length <= state.shown;
    moreBtn.textContent = `Afficher plus (${list.length - state.shown} restants)`;
  }

  $('#cat-search').addEventListener('input', (e) => { state.query = e.target.value; state.shown = PAGE_SIZE; renderCatalogue(); });
  $('#cat-sort').addEventListener('change', (e) => { state.sort = e.target.value; renderCatalogue(); });
  $$('.chip').forEach((chip) => chip.addEventListener('click', () => {
    $$('.chip').forEach((c) => { c.classList.toggle('is-active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
    state.filter = chip.dataset.filter; state.shown = PAGE_SIZE; renderCatalogue();
  }));
  moreBtn.addEventListener('click', () => {
    const first = state.shown;
    state.shown += PAGE_SIZE;
    renderCatalogue();
    grid.children[first]?.querySelector('button')?.focus({ preventScroll: true });
  });
  grid.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) {
      state.query = ''; state.filter = 'all'; state.shown = PAGE_SIZE;
      $('#cat-search').value = '';
      $$('.chip').forEach((c) => { const on = c.dataset.filter === 'all'; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      renderCatalogue();
    }
  });

  function renderSoon() {
    const sec = $('#coming-soon');
    sec.hidden = !state.soon.length;
    $('#cs-grid').innerHTML = state.soon.map((v) => cardHTML(v, 'soon')).join('');
  }

  function renderSold() {
    const sec = $('#vendus');
    sec.hidden = !state.sold.length;
    const sorted = state.sold.slice().sort((a, b) => String(b.sold_at || '').localeCompare(String(a.sold_at || '')));
    $('#vendus-track').innerHTML = sorted.slice(0, 24).map((v) => cardHTML(v, 'sold')).join('');
  }
  $$('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    const t = $('#vendus-track');
    t.scrollBy({ left: Number(b.dataset.scroll) * t.clientWidth * 0.9, behavior: reducedMotion ? 'auto' : 'smooth' });
  }));

  async function loadCatalogue() {
    try {
      const r = await fetch(API_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      state.all = data.record?.vehicles || data.vehicles || [];
      state.soon = data.vehicles_coming_soon || [];
      state.sold = data.vehicles_vendus || [];
      byId.clear();
      [['stock', state.all], ['soon', state.soon], ['sold', state.sold]].forEach(([mode, list]) => list.forEach((v) => byId.set(mode + ':' + v.id, v)));
      renderCatalogue(); renderSoon(); renderSold();
      reveal($$('#cs-grid .vcard, #vendus .section-head'));
    } catch (err) {
      console.error('[GSH] catalogue', err);
      if (!state.all.length) {
        grid.setAttribute('aria-busy', 'false');
        grid.innerHTML = `<div class="empty-state">${icon('i-car')}<p>Le catalogue est momentanément indisponible. Appelez-nous ou écrivez-nous sur WhatsApp pour connaître nos véhicules disponibles.</p><a class="btn btn-primary" href="tel:+33759626982">${icon('i-phone')}07 59 62 69 82</a></div>`;
      }
    }
  }
  loadCatalogue();
  setInterval(() => { if (!document.hidden) loadCatalogue(); }, 5 * 60 * 1000);

  /* ------------------------------------------------------------------
     Fiche véhicule
  ------------------------------------------------------------------ */
  const dlg = $('#dlg-vehicle');
  const content = $('#veh-content');

  function openVehicle(id, mode) {
    const v = byId.get(mode + ':' + id);
    if (!v) return;
    const photos = photosOf(v);
    const sold = mode === 'sold' || String(v.status) === 'vendu';
    const name = titleOf(v);
    const spec = [
      ['Année', v.year], ['Kilométrage', fmtKm(v.mileage ?? v.km)], ['Énergie', v.fuel], ['Boîte', v.gearbox || v.transmission],
      ['Puissance', v.horsepower && v.horsepower + ' ch'], ['Couleur', v.color], ['Portes', v.doors], ['Places', v.seats],
    ].filter(([, val]) => val);
    const docs = [
      v.histovec_url && `<a href="${esc(v.histovec_url)}" target="_blank" rel="noopener">${icon('i-history')}Historique Histovec</a>`,
      v.or_url && `<a href="${esc(v.or_url)}" target="_blank" rel="noopener">${icon('i-wrench')}Ordre de réparation</a>`,
      v.lbcUrl && `<a href="${esc(v.lbcUrl)}" target="_blank" rel="noopener">${icon('i-external-link')}Voir l'annonce</a>`,
    ].filter(Boolean).join('');
    const actions = mode === 'soon'
      ? `<a class="btn btn-wa" href="${waLink(`Bonjour GS HORIZON, je suis intéressé(e) par le véhicule à venir : ${name}`)}" target="_blank" rel="noopener">${icon('b-whatsapp')}Être prévenu de l'arrivée</a>`
      : sold
        ? `<a class="btn btn-primary" href="#catalogue" data-close>Voir les véhicules disponibles</a>`
        : `<a class="btn btn-primary btn-lg" href="/commande.html?vehicleId=${encodeURIComponent(v.id)}">Réserver ce véhicule</a>
           <a class="btn btn-wa" href="${waLink(`Bonjour GS HORIZON, je suis intéressé(e) par le véhicule : ${name} (${fmtPrice(v.price)})`)}" target="_blank" rel="noopener">${icon('b-whatsapp')}Poser une question</a>
           <button class="btn btn-ghost" type="button" data-share>${icon('i-share-2')}Partager</button>`;

    content.innerHTML = `
      <button class="icon-btn sheet-close" data-close aria-label="Fermer">${icon('i-x')}</button>
      <div class="veh-layout">
        <div>
          <div class="gallery-main">
            ${photos.length ? `<img id="gal-img" src="${esc(photos[0])}" alt="${esc(name)} — photo 1"/>` : `<div class="vcard-media"><div class="placeholder">${icon('i-car')}</div></div>`}
            ${photos.length > 1 ? `<button class="icon-btn prev" data-gal="-1" aria-label="Photo précédente">${icon('i-chevron-left')}</button>
            <button class="icon-btn next" data-gal="1" aria-label="Photo suivante">${icon('i-chevron-right')}</button>
            <span class="gallery-count" id="gal-count">1 / ${photos.length}</span>` : ''}
          </div>
          ${photos.length > 1 ? `<div class="thumbs">${photos.map((p, i) => `<button type="button" data-thumb="${i}" aria-label="Photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}><img src="${esc(p)}" alt="" loading="lazy"/></button>`).join('')}</div>` : ''}
        </div>
        <div class="veh-info">
          <span class="vcard-brand">${esc(v.brand || '')}${mode === 'soon' ? ' · Bientôt disponible' : sold ? ' · Vendu' : ''}</span>
          <h2 class="sheet-title" id="veh-title">${esc(v.model || name)}</h2>
          ${mode === 'soon' ? '' : `<div class="price">${fmtPrice(v.price)}</div>`}
          <dl class="spec-grid">${spec.map(([k, val]) => `<div><dt>${k}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>
          ${docs ? `<div class="veh-docs">${docs}</div>` : ''}
          <div class="veh-actions">${actions}</div>
        </div>
      </div>
      ${v.description ? `<div class="veh-desc"><h3>Description</h3><p>${esc(v.description)}</p></div>` : ''}`;

    let idx = 0;
    const show = (i) => {
      idx = (i + photos.length) % photos.length;
      const img = $('#gal-img', content);
      img.src = photos[idx];
      img.alt = `${name} — photo ${idx + 1}`;
      $('#gal-count', content).textContent = `${idx + 1} / ${photos.length}`;
      $$('[data-thumb]', content).forEach((t, k) => { if (k === idx) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
      $$('[data-thumb]', content)[idx]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    content.onclick = (e) => {
      const g = e.target.closest('[data-gal]'); if (g) return show(idx + Number(g.dataset.gal));
      const t = e.target.closest('[data-thumb]'); if (t) return show(Number(t.dataset.thumb));
      if (e.target.closest('[data-share]')) {
        const url = location.origin + location.pathname + '#catalogue';
        if (navigator.share) navigator.share({ title: 'GS HORIZON — ' + name, text: `${name} — ${fmtPrice(v.price)} chez GS HORIZON`, url }).catch(() => {});
        else navigator.clipboard?.writeText(url).then(() => { e.target.closest('[data-share]').lastChild.textContent = 'Lien copié'; });
      }
    };
    content.onkeydown = (e) => {
      if (photos.length < 2) return;
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    };
    openDialog(dlg);
    $('.sheet-close', content).focus();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vehicle]');
    if (b) openVehicle(b.dataset.vehicle, b.dataset.mode);
  });

  /* ------------------------------------------------------------------
     Dialogues
  ------------------------------------------------------------------ */
  function openDialog(d) {
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    document.documentElement.style.overflow = 'hidden';
  }
  $$('dialog').forEach((d) => {
    d.addEventListener('close', () => { document.documentElement.style.overflow = ''; });
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  });
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => openDialog(document.getElementById(b.dataset.open))));

  /* ------------------------------------------------------------------
     Onglets contact (ARIA tabs + flèches clavier)
  ------------------------------------------------------------------ */
  const tabs = $$('[role="tab"]');
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      selectTab(next); next.focus();
    });
  });

  /* ------------------------------------------------------------------
     Formulaires → WhatsApp / email
  ------------------------------------------------------------------ */
  const builders = {
    rachat: (f) => ({
      subject: `Demande de rachat - ${f.immat.toUpperCase()}`,
      text: `Bonjour GS HORIZON,\n\nDEMANDE DE RACHAT\n\nNom : ${f.prenom} ${f.nom}\nTéléphone : ${f.tel}\nImmatriculation : ${f.immat.toUpperCase()}\nKilométrage : ${f.km || 'Non précisé'}\nPrix souhaité : ${f.prix || 'Non précisé'}\nÉtat : ${f.etat || 'Non précisé'}`,
    }),
    message: (f) => ({
      subject: f.sujet || 'Message depuis le site',
      text: `Bonjour GS HORIZON,\n\n${f.message}\n\n${f.prenom} ${f.nom}${f.tel ? '\nTél : ' + f.tel : ''}${f.email ? '\nEmail : ' + f.email : ''}`,
    }),
    rappel: (f) => ({
      subject: 'Demande de rappel',
      text: `Bonjour GS HORIZON, je souhaite être rappelé(e).\n\nNom : ${[f.prenom, f.nom].filter(Boolean).join(' ') || 'Non précisé'}\nTéléphone : ${f.tel}\nCréneau : ${f.creneau || 'Peu importe'}${f.vehicule ? '\nVéhicule : ' + f.vehicule : ''}`,
    }),
    rdv: (f) => ({
      subject: 'Demande de rendez-vous',
      text: `Bonjour GS HORIZON, je souhaite prendre rendez-vous.\n\nNom : ${f.prenom} ${f.nom}\nTéléphone : ${f.tel}${f.email ? '\nEmail : ' + f.email : ''}\nMotif : ${f.motif || 'Non précisé'}\nDate souhaitée : ${f.date ? new Date(f.date).toLocaleDateString('fr-FR') : 'Non précisée'}\nCréneau : ${f.creneau}`,
    }),
  };

  $$('form.form').forEach((form) => {
    const kind = form.dataset.kind || 'rachat';
    const errEl = $('.form-error', form);
    const okEl = $('.form-success', form);
    $$('input, textarea', form).forEach((inp) => inp.addEventListener('input', () => inp.removeAttribute('aria-invalid')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const via = e.submitter?.dataset.via || 'whatsapp';
      const invalid = $$('[required]', form).filter((el) => !el.value.trim());
      $$('[required]', form).forEach((el) => { if (invalid.includes(el)) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); });
      if (invalid.length) {
        errEl.textContent = 'Merci de compléter : ' + invalid.map((el) => form.querySelector(`label[for="${el.id}"]`).childNodes[0].textContent.trim()).join(', ') + '.';
        errEl.hidden = false;
        invalid[0].focus();
        return;
      }
      errEl.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      const { subject, text } = builders[kind](data);
      if (via === 'email') window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      else window.open(waLink(text), '_blank', 'noopener');
      okEl.hidden = false;
    });
  });

  /* ------------------------------------------------------------------
     Divers
  ------------------------------------------------------------------ */
  $$('.review .stars[data-stars]').forEach((el) => {
    const n = Number(el.dataset.stars);
    el.innerHTML = Array.from({ length: 5 }, (_, i) => icon('i-star', i < n ? 'ic' : 'ic off')).join('');
  });
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();
