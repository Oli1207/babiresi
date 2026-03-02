import { useEffect, useMemo, useRef, useState } from "react";
import apiInstance from "../../utils/axios";

import ExploreMapScreen from "./ExploreMapScreen";
import ExploreListScreen from "./ExploreListScreen";
import "./home.css";

function buildParams(filters, page, pageSize) {
  const p = new URLSearchParams();

  // ✅ 1. TEXTE & LOCALISATION
  if (filters.q?.trim()) p.set("q", filters.q.trim());
  if (filters.city?.trim()) p.set("city", filters.city.trim());
  if (filters.area?.trim()) p.set("area", filters.area.trim());
  if (filters.borough?.trim()) p.set("borough", filters.borough.trim());

  // ✅ 2. NUMÉRIQUES
  if (filters.max_price) p.set("max_price", String(filters.max_price));
  if (filters.guests) p.set("guests", String(filters.guests));
  if (filters.min_bedrooms) p.set("min_bedrooms", String(filters.min_bedrooms));
  if (filters.min_living_rooms) p.set("min_living_rooms", String(filters.min_living_rooms));

  // ✅ 3. TYPE DE LOGEMENT (Important !)
  if (filters.listing_type && filters.listing_type !== "all") {
    p.set("listing_type", filters.listing_type);
  }

  // ✅ 4. BOOLEENS (amenities)
  [
    "has_wifi",
    "has_ac",
    "has_parking",
    "has_garden",
    "has_generator",
    "has_security",
    // Ajoute ceux manquants si tu veux filtrer aussi dessus :
    // "has_tv", "has_kitchen", "has_pool" etc.
  ].forEach((k) => {
    if (filters[k]) p.set(k, "true");
  });

  // ✅ 5. PAGINATION
  p.set("page", String(page));
  p.set("page_size", String(pageSize));

  return p.toString();
}

export default function HomeScreen() {
  const PAGE_SIZE = 24;

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Navigation interne
  const [tab, setTab] = useState("map");
  const [activeId, setActiveId] = useState(null);

  // ✅ Source unique de vérité pour les filtres
  const [filters, setFilters] = useState({
    q: "",
    city: "",
    area: "",
    borough: "",
    listing_type: "all", // ✅ Ajouté ici
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

  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const reqId = useRef(0);

  // Debounce search text only
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 350);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Fusion pour l'effect
  const effectiveFilters = useMemo(() => ({ ...filters, q: debouncedQ }), [filters, debouncedQ]);

  const fetchPage = async ({ nextPage = 1, append = false } = {}) => {
    const id = ++reqId.current;

    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const qs = buildParams(effectiveFilters, nextPage, PAGE_SIZE);
      const { data } = await apiInstance.get(`listings/?${qs}`);

      const arr = Array.isArray(data) ? data : (data?.results || []);
      const next = Array.isArray(data) ? null : data?.next;

      if (id !== reqId.current) return;

      setListings((prev) => (append ? [...prev, ...arr] : arr));
      setPage(nextPage);
      setHasNext(Boolean(next));
    } catch (e) {

      if (!append) setListings([]);
      setHasNext(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ✅ Re-fetch quand un filtre change (remise à page 1)
  useEffect(() => {
    fetchPage({ nextPage: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveFilters.q,
    effectiveFilters.city,
    effectiveFilters.area,
    effectiveFilters.borough,
    effectiveFilters.listing_type, // ✅ Déclenche le refresh
    effectiveFilters.max_price,
    effectiveFilters.guests,
    effectiveFilters.min_bedrooms,
    effectiveFilters.min_living_rooms,
    effectiveFilters.has_garden,
    effectiveFilters.has_generator,
    effectiveFilters.has_security,
    effectiveFilters.has_wifi,
    effectiveFilters.has_ac,
    effectiveFilters.has_parking,
  ]);

  const loadMore = () => {
    if (!hasNext || loadingMore) return;
    fetchPage({ nextPage: page + 1, append: true });
  };

  return (
    <div className="home-shell">
      <div className="home-body">
        {tab === "map" ? (
          <ExploreMapScreen
            loading={loading}
            listings={listings}
            filters={filters}
            setFilters={setFilters}
            activeId={activeId}
            setActiveId={setActiveId}
            onGoList={() => setTab("list")}
          />
        ) : (
          <ExploreListScreen
            loading={loading}
            loadingMore={loadingMore}
            hasNext={hasNext}
            onLoadMore={loadMore}
            listings={listings}
            filters={filters}
            setFilters={setFilters}
            activeId={activeId}
            setActiveId={setActiveId}
            onGoMap={() => setTab("map")}
          />
        )}
      </div>
    </div>
  );
}