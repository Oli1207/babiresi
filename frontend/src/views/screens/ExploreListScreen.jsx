import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function formatMoney(x) {
  const n = Number(x || 0);
  return n.toLocaleString();
}

// ✅ util: cover depuis backend images[]
function pickCover(listing) {
  const imgs = listing?.images || [];
  const cover = imgs.find((i) => i.is_cover) || imgs[0] || null;
  return cover?.image_url || "https://via.placeholder.com/320x220?text=Residence";
}

function ListingCard({ l, active, onClick }) {
  return (
    <div className={`list-card ${active ? "active" : ""}`} onClick={onClick}>
      <div className="list-thumb">
        <img src={pickCover(l)} alt="" />
      </div>

      <div className="list-meta">
        <div className="list-title">{l?.title || "Résidence"}</div>

        <div className="list-sub">
          {(l?.borough || "")}
          {l?.borough && l?.area ? " · " : ""}
          {(l?.area || "")}
          {l?.city ? ` · ${l.city}` : ""}
        </div>

        {/* ✅ NEW: infos rapides (chambres/salons + vendeur) */}
        <div className="small text-muted mt-1">
          🛏 {l?.bedrooms ?? 0} ch · 🛋 {l?.living_rooms ?? 0} salon(s)
          {l?.author_name ? ` · 👤 ${l.author_name}` : ""}
        </div>

        <div className="list-bottom">
          <div className="list-price">
            {formatMoney(l?.price_per_night)} FCFA <span>/ nuit</span>
          </div>
          <div className="list-chip">{(l?.listing_type || "Résidence").toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, items, activeId, onPick }) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return null;

  return (
    <div className="list-section">
      <div className="list-section-title">{title}</div>
      <div className="list-grid">
        {arr.map((l) => (
          <ListingCard
            key={l.id}
            l={l}
            active={activeId === l.id}
            onClick={() => onPick(l)}
          />
        ))}
      </div>
    </div>
  );
}

export default function ExploreListScreen(props) {
  const {
    loading = false,
    listings = [],
    filters,
    setFilters,
    activeId = null,
    setActiveId,
    onGoMap,
  } = props || {};

  const navigate = useNavigate();

  // ✅ defaults (anti-crash si filters est undefined)
  const defaultFilters = {
    q: "",
    max_price: "",
    guests: "",
    min_bedrooms: "",
    min_living_rooms: "",
    has_garden: false,
    has_generator: false,
    has_security: false,
    has_wifi: false,
    has_ac: false,
    has_parking: false,
  };

  const safeFilters = { ...defaultFilters, ...(filters || {}) };
  const safeSetFilters = typeof setFilters === "function" ? setFilters : () => {};

  const safeSetActiveId = typeof setActiveId === "function" ? setActiveId : () => {};
  const goMap = typeof onGoMap === "function" ? onGoMap : () => {};

  // ✅ optionnel: type filter local
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    const arr = Array.isArray(listings) ? listings : [];
    if (typeFilter === "all") return arr;
    return arr.filter((l) => (l?.listing_type || "").toLowerCase() === typeFilter);
  }, [listings, typeFilter]);

  const categories = useMemo(() => {
    const arr = filtered
      .slice()
      .sort((a, b) => Number(a?.price_per_night || 0) - Number(b?.price_per_night || 0));

    const budget = arr.filter((l) => Number(l?.price_per_night || 0) > 0 && Number(l?.price_per_night || 0) <= 20000);
    const mid = arr.filter((l) => Number(l?.price_per_night || 0) > 20000 && Number(l?.price_per_night || 0) <= 50000);
    const premium = arr.filter((l) => Number(l?.price_per_night || 0) > 50000);

    const recommended = filtered
      .slice()
      .sort((a, b) => {
        const sa = ["title", "city", "area", "borough", "address_label"].reduce((s, k) => s + (a?.[k] ? 1 : 0), 0);
        const sb = ["title", "city", "area", "borough", "address_label"].reduce((s, k) => s + (b?.[k] ? 1 : 0), 0);
        return sb - sa;
      })
      .slice(0, 12);

    const byType = (t) => filtered.filter((l) => (l?.listing_type || "").toLowerCase() === t).slice(0, 12);

    return {
      recommended,
      budget: budget.slice(0, 12),
      mid: mid.slice(0, 12),
      premium: premium.slice(0, 12),
      studio: byType("studio"),
      appartement: byType("appartement"),
      villa: byType("villa"),
      maison: byType("maison"),
    };
  }, [filtered]);

  const pick = (l) => {
    safeSetActiveId(l.id);
    navigate(`/listings/${l.id}`);
  };

  const toggleChip = (key) => safeSetFilters((p) => ({ ...p, [key]: !p?.[key] }));

  const resetFilters = () =>
    safeSetFilters({
      q: "",
      max_price: "",
      guests: "",
      min_bedrooms: "",
      min_living_rooms: "",
      has_garden: false,
      has_generator: false,
      has_security: false,
      has_wifi: false,
      has_ac: false,
      has_parking: false,
    });

  return (
    <div className="list-screen">
      <div className="list-header">
        <div>
          <div className="list-h1">Résidences</div>
          <div className="list-h2">{loading ? "Chargement..." : `${filtered.length} résultats`}</div>
        </div>

        <button type="button" className="btn btn-outline-dark" onClick={goMap}>
          Voir sur la carte
        </button>
      </div>

      {/* ✅ FILTRES */}
      <div className="list-controls">
        <input
          className="form-control"
          value={safeFilters.q}
          onChange={(e) => safeSetFilters((p) => ({ ...p, q: e.target.value }))}
          placeholder="Rechercher: titre, quartier, commune, ville..."
        />

        <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">Tous types</option>
          <option value="appartement">Appartement</option>
          <option value="studio">Studio</option>
          <option value="maison">Maison</option>
          <option value="villa">Villa</option>
          <option value="chambre">Chambre</option>
        </select>

        <div className="row g-2 mt-2">
          <div className="col-6 col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder="Prix max"
              value={safeFilters.max_price}
              onChange={(e) => safeSetFilters((p) => ({ ...p, max_price: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder="Voyageurs"
              value={safeFilters.guests}
              onChange={(e) => safeSetFilters((p) => ({ ...p, guests: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder="Min chambres"
              value={safeFilters.min_bedrooms}
              onChange={(e) => safeSetFilters((p) => ({ ...p, min_bedrooms: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder="Min salons"
              value={safeFilters.min_living_rooms}
              onChange={(e) => safeSetFilters((p) => ({ ...p, min_living_rooms: e.target.value }))}
            />
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          {[
            ["has_wifi", "Wifi"],
            ["has_ac", "Clim"],
            ["has_parking", "Parking"],
            ["has_garden", "Jardin"],
            ["has_generator", "Groupe"],
            ["has_security", "Sécurité"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${safeFilters[key] ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => toggleChip(key)}
            >
              {label}
            </button>
          ))}

          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      <Section title="Recommandées" items={categories.recommended} activeId={activeId} onPick={pick} />
      <Section title="Petits budgets (≤ 20k)" items={categories.budget} activeId={activeId} onPick={pick} />
      <Section title="Confort (20k – 50k)" items={categories.mid} activeId={activeId} onPick={pick} />
      <Section title="Premium (50k+)" items={categories.premium} activeId={activeId} onPick={pick} />

      <Section title="Studios" items={categories.studio} activeId={activeId} onPick={pick} />
      <Section title="Appartements" items={categories.appartement} activeId={activeId} onPick={pick} />
      <Section title="Villas" items={categories.villa} activeId={activeId} onPick={pick} />
      <Section title="Maisons" items={categories.maison} activeId={activeId} onPick={pick} />

      {!loading && filtered.length === 0 && (
        <div className="list-empty">
          <div className="fw-semibold">Aucun résultat</div>
          <div className="text-muted small">Essaie un autre quartier ou retire un filtre.</div>
        </div>
      )}
    </div>
  );
}