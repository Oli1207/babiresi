import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

function formatMoney(x) {
  const n = Number(x || 0);
  return n.toLocaleString();
}

function pickCover(listing) {
  const imgs = listing?.images || [];
  const cover = imgs.find((i) => i.is_cover) || imgs[0] || null;
  return cover?.image_url || "/listing-fallback.jpg";
}

function listingTypeLabel(t, type) {
  const key = String(type || "residence").toLowerCase();
  return t(`listings.types.${key}`, { defaultValue: type || t("listings.fallbackTitle") });
}

function ListingCard({ l, active, onClick, t }) {
  return (
    <div className={`list-card ${active ? "active" : ""}`} onClick={onClick}>
      <div className="list-thumb">
        <img src={pickCover(l)} alt="" />
      </div>

      <div className="list-meta">
        <div className="list-title">{l?.title || t("listings.fallbackTitle")}</div>
        {l?.test && (
          <div
            style={{
              background: "#fff3cd",
              border: "1px solid #ffecb5",
              color: "#664d03",
              padding: "8px 12px",
              borderRadius: 8,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            {t("listings.demoListing")}
          </div>
        )}

        <div className="list-sub">
          {l?.borough || ""}
          {l?.borough && l?.area ? " · " : ""}
          {l?.area || ""}
          {l?.city ? ` · ${l.city}` : ""}
        </div>

        <div className="small text-muted mt-1">
          🛏 {l?.bedrooms ?? 0} {t("listings.bedroomsShort")} · 🛋 {l?.living_rooms ?? 0} {t("listings.livingRooms")}
          {l?.author_name ? ` · 👤 ${l.author_name}` : ""}
        </div>

        <div className="list-bottom">
          <div className="list-price">
            {formatMoney(l?.price_per_night)} FCFA <span>{t("listings.perNight")}</span>
          </div>
          <div className="list-chip">
            {listingTypeLabel(t, l?.listing_type).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, items, activeId, onPick, t }) {
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
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

export default function ExploreListScreen(props) {
  const { t } = useTranslation();
  const {
    loading = false,
    loadingMore = false,
    hasNext = false,
    onLoadMore,
    listings = [], // ✅ Ces listings viennent du backend DÉJÀ filtrés
    filters,
    setFilters,
    activeId = null,
    setActiveId,
    onGoMap,
  } = props || {};

  const navigate = useNavigate();

  // ✅ Defaults filters
  const defaultFilters = useMemo(
    () => ({
      q: "",
      city: "",
      area: "",
      borough: "",
      listing_type: "all",
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
    }),
    []
  );

  const hasExternalFilters = typeof setFilters === "function";
  const [localFilters, setLocalFilters] = useState(defaultFilters);

  useEffect(() => {
    if (!hasExternalFilters && filters) {
      setLocalFilters((p) => ({ ...p, ...filters }));
    }
  }, [filters, hasExternalFilters]);

  const effectiveFilters = useMemo(() => {
    const base = defaultFilters;
    const incoming = filters || {};
    const chosen = hasExternalFilters ? incoming : localFilters;
    return { ...base, ...(chosen || {}) };
  }, [defaultFilters, filters, hasExternalFilters, localFilters]);

  const setEffectiveFilters = hasExternalFilters ? setFilters : setLocalFilters;
  const safeSetActiveId = typeof setActiveId === "function" ? setActiveId : () => {};
  const goMap = typeof onGoMap === "function" ? onGoMap : () => {};

  // ✅ NETTOYAGE : Plus de filtrage client (filtered = useMemo).
  // On utilise directement `listings` qui est la vérité venant du serveur.
  const dataList = Array.isArray(listings) ? listings : [];

  const categories = useMemo(() => {
    // On trie simplement pour l'affichage, sans filtrer (le backend a déjà filtré)
    const arr = dataList.slice().sort((a, b) => 
      Number(a?.price_per_night || 0) - Number(b?.price_per_night || 0)
    );

    // Si l'utilisateur a filtré par type (ex: Villa), toutes les sections ci-dessous
    // ne contiendront que des villas. C'est le comportement attendu.
    
    // Découpage par prix pour la présentation
    const budget = arr.filter((l) => Number(l?.price_per_night || 0) <= 20000);
    const mid = arr.filter((l) => Number(l?.price_per_night || 0) > 20000 && Number(l?.price_per_night || 0) <= 50000);
    const premium = arr.filter((l) => Number(l?.price_per_night || 0) > 50000);

    // Recommandées (Algorithme simple de complétude)
    const recommended = arr
  .slice()
  .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))
  .slice(0, 5);

    // Helper pour extraire par type (pour affichage catégorisé si aucun filtre type n'est actif)
    const byType = (t) => arr.filter((l) => (l?.listing_type || "").toLowerCase() === t).slice(0, 12);

    return {
      all: arr, // Cas général
      recommended,
      budget: budget.slice(0, 12),
      mid: mid.slice(0, 12),
      premium: premium.slice(0, 12),
      // Si on filtre déjà sur "Villa", studio sera vide.
      studio: byType("studio"),
      appartement: byType("appartement"),
      villa: byType("villa"),
      maison: byType("maison"),
    };
  }, [dataList]);

  const pick = (l) => {
    safeSetActiveId(l.id);
    navigate(`/listings/${l.id}`);
  };

  const toggleChip = (key) =>
    setEffectiveFilters((p) => ({ ...p, [key]: !p?.[key] }));

  const resetFilters = () =>
    setEffectiveFilters({
      q: "",
      city: "",
      area: "",
      borough: "",
      listing_type: "all",
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

  const canLoadMore = typeof onLoadMore === "function" && hasNext;

  // Si on a des filtres actifs, on affiche peut-être une vue simplifiée
  // plutôt que toutes les sections ? Pour l'instant on garde les sections.
  
  return (
    <div className="list-screen">
      <div className="list-header">
        <div>
          <div className="list-h1">{t("listings.residences")}</div>
          <div className="list-h2">
            {loading ? t("common.loading") : t("listings.resultsCount", { count: dataList.length })}
          </div>
        </div>

        <button type="button" className="btn btn-outline-dark" onClick={goMap}>
          {t("listings.viewOnMap")}
        </button>
      </div>

      {/* ✅ FILTRES */}
      <div className="list-controls">
        <input
          className="form-control"
          value={effectiveFilters.q}
          onChange={(e) =>
            setEffectiveFilters((p) => ({ ...p, q: e.target.value }))
          }
          placeholder={t("listings.searchPlaceholder")}
        />

        {/* ✅ SELECT bindé directement sur listing_type de l'API */}
        <select
          className="form-select"
          value={effectiveFilters.listing_type || "all"}
          onChange={(e) =>
            setEffectiveFilters((p) => ({ ...p, listing_type: e.target.value }))
          }
        >
          <option value="all">{t("listings.types.all")}</option>
          <option value="appartement">{t("listings.types.appartement")}</option>
          <option value="studio">{t("listings.types.studio")}</option>
          <option value="maison">{t("listings.types.maison")}</option>
          <option value="villa">{t("listings.types.villa")}</option>
          <option value="chambre">{t("listings.types.chambre")}</option>
        </select>

        <div className="row g-2 mt-2">
          <div className="col-6 col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder={t("listings.maxPrice")}
              value={effectiveFilters.max_price}
              onChange={(e) =>
                setEffectiveFilters((p) => ({ ...p, max_price: e.target.value }))
              }
            />
          </div>

          <div className="col-6 col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder={t("common.persons")}
              value={effectiveFilters.guests}
              onChange={(e) =>
                setEffectiveFilters((p) => ({ ...p, guests: e.target.value }))
              }
            />
          </div>

          <div className="col-6 col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder={t("listings.minBedrooms")}
              value={effectiveFilters.min_bedrooms}
              onChange={(e) =>
                setEffectiveFilters((p) => ({ ...p, min_bedrooms: e.target.value }))
              }
            />
          </div>

          <div className="col-6 col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder={t("listings.minLivingRooms")}
              value={effectiveFilters.min_living_rooms}
              onChange={(e) =>
                setEffectiveFilters((p) => ({
                  ...p,
                  min_living_rooms: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          {[
            ["has_wifi", t("listings.amenities.wifi")],
            ["has_ac", t("listings.amenities.ac")],
            ["has_parking", t("listings.amenities.parking")],
            ["has_garden", t("listings.amenities.garden")],
            ["has_generator", t("listings.amenities.generator")],
            ["has_security", t("listings.amenities.security")],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${
                effectiveFilters[key] ? "btn-dark" : "btn-outline-dark"
              }`}
              onClick={() => toggleChip(key)}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={resetFilters}
          >
            {t("common.reset")}
          </button>
        </div>
      </div>

      {/* Si l'utilisateur a fait une recherche précise (filtrée), 
         il vaut souvent mieux afficher une seule liste de résultats.
         Mais pour garder ton UX, on laisse les sections.
         Si le user cherche "Villa", la section "Appartements" sera juste vide.
      */}

      {(effectiveFilters.listing_type === "all" || !effectiveFilters.listing_type) ? (
         /* Affichage standard catégorisé si pas de filtre type strict */
         <>
            <Section title={t("listings.sections.recommended")} items={categories.recommended} activeId={activeId} onPick={pick} t={t} />
            <Section title={t("listings.sections.budget")} items={categories.budget} activeId={activeId} onPick={pick} t={t} />
            <Section title={t("listings.sections.comfort")} items={categories.mid} activeId={activeId} onPick={pick} t={t} />
            <Section title={t("listings.sections.premium")} items={categories.premium} activeId={activeId} onPick={pick} t={t} />
            
            <Section title={t("listings.sections.studios")} items={categories.studio} activeId={activeId} onPick={pick} t={t} />
            <Section title={t("listings.sections.apartments")} items={categories.appartement} activeId={activeId} onPick={pick} t={t} />
            <Section title={t("listings.sections.villas")} items={categories.villa} activeId={activeId} onPick={pick} t={t} />
            <Section title={t("listings.sections.houses")} items={categories.maison} activeId={activeId} onPick={pick} t={t} />
         </>
      ) : (
         /* Si un type est sélectionné, on affiche tout dans une section Résultats */
         <Section title={t("listings.filteredResults", { type: listingTypeLabel(t, effectiveFilters.listing_type) })} items={categories.all} activeId={activeId} onPick={pick} t={t} />
      )}

      {/* Load more pro */}
      {canLoadMore && (
        <div className="d-flex justify-content-center my-4">
          <button
            type="button"
            className="btn btn-dark"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? t("common.loading") : t("common.loadMore")}
          </button>
        </div>
      )}

      {!loading && dataList.length === 0 && (
        <div className="list-empty">
          <div className="fw-semibold">{t("listings.noResults")}</div>
          <div className="text-muted small">
            {t("listings.noResultsHint")}
          </div>
        </div>
      )}
    </div>
  );
}
