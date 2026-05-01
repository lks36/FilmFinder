const API_BASE = "http://netflix.local/api";
const FAV_KEY  = "netplixe_favorites"; // localStorage key

/* ===== DOM ===== */
const navbar         = document.getElementById("navbar");
const searchToggle   = document.getElementById("searchToggle");
const searchInput    = document.getElementById("searchInput");
const filterSection  = document.getElementById("filterSection");
const filterGrid     = document.getElementById("filterGrid");
const filterTitle    = document.getElementById("filterTitle");
const filterStats    = document.getElementById("filterStats");
const filterPagination = document.getElementById("filterPagination");
const modal          = document.getElementById("modal");
const modalBg        = document.getElementById("modalBg");
const modalClose     = document.getElementById("modalClose");
const modalBody      = document.getElementById("modalBody");
const modalSimilar   = document.getElementById("modalSimilar");
const modalSimilarRow = document.getElementById("modalSimilarRow");
const statusToast    = document.getElementById("statusToast");
const favoritesSection = document.getElementById("favoritesSection");
const favoritesGrid  = document.getElementById("favoritesGrid");
const favBadge       = document.getElementById("favBadge");
const favCount       = document.getElementById("favCount");
const advSearchPanel = document.getElementById("advSearchPanel");
const advToggleBtn   = document.getElementById("advToggleBtn");
const advSearchBtn   = document.getElementById("advSearchBtn");
const advResetBtn    = document.getElementById("advResetBtn");
const advCloseBtn    = document.getElementById("advCloseBtn");
const navFavorites   = document.getElementById("navFavorites");

let searchOpen = false;

/* ===== PAGINATION STATE ===== */
let currentPaginationState = null;

/* ===== API ===== */

/**
 * GET /shows — retourne {items, total, page, pages, limit}
 */
async function fetchShows(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    )
  );
  const res = await fetch(`${API_BASE}/shows?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * GET /shows/search — retourne {items, total, page, pages}
 */
async function searchShows(q, limit = 24, skip = 0) {
  const res = await fetch(
    `${API_BASE}/shows/search?q=${encodeURIComponent(q)}&limit=${limit}&skip=${skip}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * GET /shows/search/advanced — retourne {items, total, page, pages, engine}
 */
async function searchAdvanced(params = {}, limit = 20, skip = 0) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ ...params, limit, skip })
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
    )
  );
  const res = await fetch(`${API_BASE}/shows/search/advanced?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * GET /shows/{id}/similar — retourne {items, from_cache}
 */
async function fetchSimilar(id) {
  const res = await fetch(`${API_BASE}/shows/${id}/similar?limit=8`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * POST /shows/favorites — retourne la liste des shows
 */
async function fetchFavoritesFromAPI(ids) {
  if (!ids.length) return [];
  const res = await fetch(`${API_BASE}/shows/favorites`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ===== FAVORIS (localStorage) ===== */

function getFavoriteIds() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFavoriteIds(ids) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...new Set(ids)]));
}

function isFavorite(id) {
  return getFavoriteIds().includes(id);
}

function toggleFavorite(show) {
  const ids  = getFavoriteIds();
  const idx  = ids.indexOf(show.id);
  if (idx === -1) {
    ids.push(show.id);
  } else {
    ids.splice(idx, 1);
  }
  saveFavoriteIds(ids);
  updateFavBadge();
  return idx === -1; // true = ajouté
}

function updateFavBadge() {
  const count = getFavoriteIds().length;
  favBadge.textContent = count;
  favBadge.classList.toggle("hidden", count === 0);
  if (favCount) {
    favCount.textContent = count > 0 ? `(${count})` : "";
  }
}

async function loadFavoritesSection() {
  const ids = getFavoriteIds();
  favoritesSection.classList.remove("hidden");
  favoritesGrid.innerHTML = "";
  if (ids.length === 0) {
    favoritesGrid.innerHTML =
      "<p style='color:#777;padding:20px 0'>Aucun favori pour l'instant. Cliquez sur ♡ pour en ajouter.</p>";
    return;
  }
  try {
    const shows = await fetchFavoritesFromAPI(ids);
    shows.forEach(s => favoritesGrid.appendChild(buildCard(s)));
  } catch {
    favoritesGrid.innerHTML =
      "<p style='color:#777;padding:20px 0'>Impossible de charger les favoris.</p>";
  }
}

/* ===== HERO ===== */
async function initHero() {
  try {
    const data = await fetchShows({ limit: 25, sort_by: "rating" });
    const shows = data.items || data;
    const show  = shows.find(s => s.poster_url) || shows[0];
    if (!show) return;

    const backdrop = document.getElementById("heroBackdrop");
    if (show.poster_url) {
      backdrop.style.backgroundImage = `url(${show.poster_url.replace("/w500/", "/w780/")})`;
    } else {
      backdrop.style.background = "linear-gradient(135deg, #1a1a2e, #0f3460)";
    }

    const genres = (show.listed_in || "").split(",").map(g => g.trim()).filter(Boolean).slice(0, 3);
    document.getElementById("heroGenres").innerHTML = genres
      .map((g, i) =>
        `<span class="genre-tag">${esc(g)}</span>${i < genres.length - 1 ? '<span class="genre-sep"> | </span>' : ""}`
      ).join("");

    document.getElementById("heroTitle").textContent = show.title || "—";

    const parts = [];
    if (show.release_year) parts.push(`<span>${esc(String(show.release_year))}</span>`);
    if (show.rating) parts.push(`<span class="hero-rating">&#9733; ${Number(show.rating).toFixed(1)}</span>`);
    document.getElementById("heroMeta").innerHTML = parts.join('<span class="hero-meta-sep"> | </span>');

    document.getElementById("heroDesc").textContent = show.description || show.overview || "";
    document.getElementById("heroPlayBtn").onclick = () => openModal(show);
    document.getElementById("heroInfoBtn").onclick = () => openModal(show);
  } catch (e) {
    console.error("Hero init error:", e);
  }
}

/* ===== CARD BUILDER ===== */
function buildCard(show) {
  const card = document.createElement("article");
  card.className = "card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");

  const year   = show.release_year ? String(show.release_year) : "";
  const rating = show.rating ? Number(show.rating).toFixed(1) : "";
  const isNew  = year && parseInt(year) >= 2023;
  const fav    = isFavorite(show.id);

  const mediaHTML = show.poster_url
    ? `<img src="${esc(show.poster_url)}" alt="${esc(show.title)}" class="card-poster" loading="lazy">`
    : `<div class="card-placeholder"><span>&#127916;</span><small>${esc(show.title)}</small></div>`;

  const badgeHTML = isNew
    ? `<span class="card-badge">NOUVEAU</span>`
    : (rating && parseFloat(rating) >= 7.5 ? `<span class="card-badge top10">TOP</span>` : "");

  const metaParts = [year, rating ? `&#9733; ${rating}` : ""].filter(Boolean).join(" &middot; ");

  card.innerHTML = `
    <div class="card-inner">
      ${badgeHTML}
      <button class="card-fav-btn${fav ? " active" : ""}" title="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}" aria-label="Favori">
        <svg width="15" height="15" viewBox="0 0 24 24"
          fill="${fav ? "#E50914" : "none"}" stroke="white" stroke-width="2.2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      ${mediaHTML}
      <div class="card-hover-info">
        <div class="card-hover-title">${esc(show.title)}</div>
        <div class="card-hover-meta">${metaParts}</div>
      </div>
    </div>
  `;

  const favBtn = card.querySelector(".card-fav-btn");
  favBtn.addEventListener("click", e => {
    e.stopPropagation();
    const added = toggleFavorite(show);
    favBtn.classList.toggle("active", added);
    const svg = favBtn.querySelector("svg");
    svg.setAttribute("fill", added ? "#E50914" : "none");
    favBtn.title = added ? "Retirer des favoris" : "Ajouter aux favoris";
    showToast(added ? `"${show.title}" ajouté aux favoris` : `"${show.title}" retiré des favoris`);
    // Si la section favoris est visible, la recharger
    if (!favoritesSection.classList.contains("hidden")) {
      loadFavoritesSection();
    }
  });

  card.addEventListener("click", () => openModal(show));
  card.addEventListener("keydown", e => { if (e.key === "Enter") openModal(show); });
  return card;
}

/* ===== TOP 10 WRAPPER ===== */
function buildTop10Item(show, rank) {
  const item = document.createElement("div");
  item.className = "top10-item";
  const numEl = document.createElement("div");
  numEl.className = "top10-number";
  numEl.textContent = rank;
  item.appendChild(numEl);
  item.appendChild(buildCard(show));
  return item;
}

/* ===== DEDUP ===== */
function dedup(shows) {
  const seen = new Set();
  return shows.filter(s => {
    const key = (String(s.title || "") + String(s.release_year || "")).toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ===== ROW LOADER ===== */
async function loadRow(containerId, params, isTop10 = false, maxDisplay = 0) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const data  = await fetchShows(params);
    let shows = dedup(data.items || data);
    if (maxDisplay > 0) shows = shows.slice(0, maxDisplay);
    container.innerHTML = "";
    shows.forEach((show, i) => {
      container.appendChild(isTop10 ? buildTop10Item(show, i + 1) : buildCard(show));
    });
  } catch (e) {
    console.error(`loadRow(${containerId}):`, e);
  }
}

async function initRows() {
  // On charge 100 items par rangée : le dataset a ~75% de doublons MongoDB,
  // donc 100 items → ~25 films uniques après dedup, suffisant pour scroller.
  // Les offsets par 100 garantissent des films différents entre rangées.
  await Promise.all([
    loadRow("rowPopular",   { limit: 100, skip: 0,   sort_by: "rating" }),
    loadRow("rowTrending",  { limit: 100, skip: 100, sort_by: "rating" }),
    loadRow("rowMustWatch", { limit: 100, skip: 200, sort_by: "rating" }),
    loadRow("rowAction",    { limit: 100, skip: 0,   genre: "Action",  sort_by: "rating" }),
    loadRow("rowDrama",     { limit: 100, skip: 0,   genre: "Drama",   sort_by: "rating" }),
    loadRow("rowComedy",    { limit: 100, skip: 0,   genre: "Comedy",  sort_by: "rating" }),
    loadRow("rowTop10",     { limit: 100, skip: 0,   sort_by: "rating" }, true, 10),
  ]);
}

/* ===== PAGINATION ===== */

function renderPagination(container, currentPage, totalPages, onPageChange) {
  container.innerHTML = "";
  if (totalPages <= 1) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");

  const addBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement("button");
    btn.className = "pagination-btn" + (active ? " active" : "");
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener("click", () => onPageChange(page));
    container.appendChild(btn);
  };

  addBtn("←", currentPage - 1, currentPage <= 1);

  const range = buildPageRange(currentPage, totalPages);
  let prev = null;
  for (const p of range) {
    if (prev !== null && p - prev > 1) {
      const dots = document.createElement("span");
      dots.className = "pagination-dots";
      dots.textContent = "…";
      container.appendChild(dots);
    }
    addBtn(String(p), p, false, p === currentPage);
    prev = p;
  }

  addBtn("→", currentPage + 1, currentPage >= totalPages);
}

function buildPageRange(current, total) {
  const delta = 2;
  const range = new Set([1, total]);
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.add(i);
  }
  return [...range].sort((a, b) => a - b);
}

/* ===== SEARCH ===== */
searchToggle.addEventListener("click", () => {
  searchOpen = !searchOpen;
  searchInput.classList.toggle("open", searchOpen);
  if (searchOpen) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    hideFilter();
  }
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const q = searchInput.value.trim();
    if (q) doSearch(q);
  }
  if (e.key === "Escape") {
    searchOpen = false;
    searchInput.classList.remove("open");
    searchInput.value = "";
    hideFilter();
  }
});

async function doSearch(q, skip = 0, limit = 24) {
  try {
    const data = await searchShows(q, limit, skip);
    const results = dedup(data.items || []);

    showFilterSection(`Résultats pour "${q}" — ${data.total} film${data.total > 1 ? "s" : ""} trouvé${data.total > 1 ? "s" : ""}`);
    filterStats.textContent = `Moteur : MongoDB  •  Page ${data.page} / ${data.pages}  •  ${data.total} résultats`;

    filterGrid.innerHTML = "";
    if (results.length === 0) {
      filterGrid.innerHTML = "<p style='color:#777;padding:20px 0'>Aucun résultat.</p>";
    } else {
      results.forEach(s => filterGrid.appendChild(buildCard(s)));
    }

    renderPagination(filterPagination, data.page, data.pages, p => {
      doSearch(q, (p - 1) * limit, limit);
      filterSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    filterSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    showToast("Erreur lors de la recherche.");
  }
}

/* ===== RECHERCHE AVANCÉE ===== */
advToggleBtn.addEventListener("click", () => {
  advSearchPanel.classList.toggle("hidden");
});

advCloseBtn.addEventListener("click", () => {
  advSearchPanel.classList.add("hidden");
});

advResetBtn.addEventListener("click", () => {
  document.getElementById("advQ").value          = "";
  document.getElementById("advGenre").value      = "";
  document.getElementById("advMinYear").value    = "";
  document.getElementById("advMaxYear").value    = "";
  document.getElementById("advMinRating").value  = "";
});

advSearchBtn.addEventListener("click", () => doAdvancedSearch());

document.getElementById("advQ").addEventListener("keydown", e => {
  if (e.key === "Enter") doAdvancedSearch();
});

async function doAdvancedSearch(skip = 0, limit = 24) {
  const params = {
    q:          document.getElementById("advQ").value.trim()        || undefined,
    genre:      document.getElementById("advGenre").value           || undefined,
    min_year:   document.getElementById("advMinYear").value         || undefined,
    max_year:   document.getElementById("advMaxYear").value         || undefined,
    min_rating: document.getElementById("advMinRating").value       || undefined,
  };

  advSearchPanel.classList.add("hidden");

  try {
    const data    = await searchAdvanced(params, limit, skip);
    const results = dedup(data.items || []);
    const engine  = data.engine === "elasticsearch" ? "Elasticsearch ⚡" : "MongoDB";

    showFilterSection(`Recherche avancée — ${data.total} résultat${data.total > 1 ? "s" : ""}`);
    filterStats.textContent =
      `Moteur : ${engine}  •  Page ${data.page} / ${data.pages}  •  ${data.total} résultats` +
      (data.from_cache ? "  •  [cache Redis]" : "");

    filterGrid.innerHTML = "";
    if (results.length === 0) {
      filterGrid.innerHTML = "<p style='color:#777;padding:20px 0'>Aucun résultat pour ces critères.</p>";
    } else {
      results.forEach(s => filterGrid.appendChild(buildCard(s)));
    }

    renderPagination(filterPagination, data.page, data.pages, p => {
      doAdvancedSearch((p - 1) * limit, limit);
      filterSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    filterSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    showToast("Erreur lors de la recherche avancée.");
  }
}

/* ===== CHARGEMENT PAGINÉ D'UN FILTRE NAV ===== */
async function loadNavFilter(baseParams, title, page) {
  const limit = baseParams.limit || 36;
  const skip  = (page - 1) * limit;

  try {
    const data    = await fetchShows({ ...baseParams, skip });
    const results = dedup(data.items || []);

    showFilterSection(title);
    filterStats.textContent = `${data.total} films  •  Page ${data.page} / ${data.pages}`;

    filterGrid.innerHTML = "";
    if (results.length === 0) {
      filterGrid.innerHTML = "<p style='color:#777;padding:20px 0'>Aucun résultat.</p>";
    } else {
      results.forEach(s => filterGrid.appendChild(buildCard(s)));
    }

    // Callback récursif : chaque bouton de page appelle loadNavFilter avec la bonne page
    renderPagination(filterPagination, data.page, data.pages, p => {
      loadNavFilter(baseParams, title, p);
      filterSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    filterSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    showToast("Erreur de chargement.");
  }
}

/* ===== NAV LINKS ===== */
document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", async e => {
    e.preventDefault();
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    link.classList.add("active");

    // Section Favoris
    if (link.dataset.section === "favorites") {
      hideFilter();
      await loadFavoritesSection();
      favoritesSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // Autres sections : cacher favoris
    favoritesSection.classList.add("hidden");

    const type  = link.dataset.type;
    const genre = link.dataset.genre;

    if (type === "" && !genre) {
      hideFilter();
      return;
    }

    const baseParams = { limit: 36, sort_by: "rating" };
    let   title      = "Catalogue";

    if (type)  { baseParams.type = type; title = "Films"; }
    if (genre) {
      baseParams.genre = genre;
      title = genre === "Comedy"   ? "Comédies"
            : genre === "Drama"    ? "Drames"
            : genre === "Thriller" ? "Thriller & Suspense"
            : genre;
    }

    await loadNavFilter(baseParams, title, 1);
  });
});

function showFilterSection(title) {
  filterTitle.textContent = title;
  filterGrid.innerHTML    = "";
  filterSection.classList.remove("hidden");
  favoritesSection.classList.add("hidden");
}

function hideFilter() {
  filterSection.classList.add("hidden");
  filterGrid.innerHTML = "";
  filterPagination.classList.add("hidden");
  filterStats.textContent = "";
}

/* ===== SCROLL ARROWS ===== */
document.querySelectorAll(".row-arrow").forEach(btn => {
  btn.addEventListener("click", () => {
    const row = document.getElementById(btn.dataset.row);
    if (!row) return;
    const amount = btn.classList.contains("arrow-left") ? -650 : 650;
    row.scrollBy({ left: amount, behavior: "smooth" });
  });
});

/* ===== MODAL ===== */
function openModal(show) {
  const posterHTML = show.poster_url
    ? `<img src="${esc(show.poster_url.replace("/w500/", "/w780/"))}" alt="${esc(show.title)}" class="modal-hero-img">`
    : `<div class="modal-hero-placeholder">&#127916;</div>`;

  const genres   = (show.listed_in || "").split(",").map(g => g.trim()).filter(Boolean);
  const tagsHTML = genres.map(g => `<span class="modal-tag">${esc(g)}</span>`).join("");

  const metaParts = [];
  if (show.release_year) metaParts.push(`<span class="modal-year">${esc(String(show.release_year))}</span>`);
  if (show.rating)       metaParts.push(`<span class="modal-rating">&#9733; ${Number(show.rating).toFixed(1)}</span>`);
  if (show.type)         metaParts.push(`<span style="color:#aaa;font-size:13px">${esc(show.type)}</span>`);

  const fav = isFavorite(show.id);

  modalBody.innerHTML = `
    ${posterHTML}
    <div class="modal-fade"></div>
    <div class="modal-body">
      <h2 class="modal-title">${esc(show.title)}</h2>
      <div class="modal-meta">${metaParts.join('<span style="color:#555"> &bull; </span>')}</div>
      ${tagsHTML ? `<div class="modal-tags">${tagsHTML}</div>` : ""}
      <div class="modal-actions">
        <button class="modal-play-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="black"><path d="M8 5v14l11-7z"/></svg>
          Lecture
        </button>
        <button class="modal-fav-btn ${fav ? "active" : ""}" id="modalFavBtn">
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill="${fav ? "#E50914" : "none"}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>${fav ? "Dans les favoris" : "Ajouter aux favoris"}</span>
        </button>
      </div>
      <p class="modal-desc">${esc(show.description || show.overview || "Aucune description disponible.")}</p>
      ${show.country  ? `<p class="modal-info"><strong>Pays :</strong> ${esc(show.country)}</p>`    : ""}
      ${show.listed_in ? `<p class="modal-info"><strong>Genres :</strong> ${esc(show.listed_in)}</p>` : ""}
    </div>
  `;

  // Bouton favori dans le modal
  const modalFavBtn = document.getElementById("modalFavBtn");
  modalFavBtn.addEventListener("click", () => {
    const added = toggleFavorite(show);
    modalFavBtn.classList.toggle("active", added);
    modalFavBtn.querySelector("svg").setAttribute("fill", added ? "#E50914" : "none");
    modalFavBtn.querySelector("span").textContent = added ? "Dans les favoris" : "Ajouter aux favoris";
    showToast(added ? `"${show.title}" ajouté aux favoris` : `"${show.title}" retiré des favoris`);
  });

  // Cacher la section similar pendant le chargement
  modalSimilar.classList.add("hidden");
  modalSimilarRow.innerHTML = "";

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Charger les films similaires en arrière-plan
  if (show.id) {
    fetchSimilar(show.id).then(data => {
      const items = data.items || [];
      if (items.length === 0) return;
      modalSimilarRow.innerHTML = "";
      items.forEach(s => {
        const mini = buildMiniCard(s);
        modalSimilarRow.appendChild(mini);
      });
      modalSimilar.classList.remove("hidden");
    }).catch(() => {});
  }
}

function buildMiniCard(show) {
  const card = document.createElement("div");
  card.className = "mini-card";
  const mediaHTML = show.poster_url
    ? `<img src="${esc(show.poster_url)}" alt="${esc(show.title)}" class="mini-card-img" loading="lazy">`
    : `<div class="mini-card-placeholder">&#127916;</div>`;
  card.innerHTML = `
    ${mediaHTML}
    <div class="mini-card-title">${esc(show.title)}</div>
    ${show.rating ? `<div class="mini-card-rating">&#9733; ${Number(show.rating).toFixed(1)}</div>` : ""}
  `;
  card.addEventListener("click", () => openModal(show));
  return card;
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  modalSimilar.classList.add("hidden");
}

modalClose.addEventListener("click", closeModal);
modalBg.addEventListener("click", closeModal);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

/* ===== NAVBAR SCROLL ===== */
window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 50);
}, { passive: true });

/* ===== TOAST ===== */
let toastTimer = null;
function showToast(msg) {
  statusToast.textContent = msg;
  statusToast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => statusToast.classList.add("hidden"), 3000);
}

/* ===== HELPERS ===== */
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ===== INIT ===== */
updateFavBadge();
initHero();
initRows();
