import { useEffect, useMemo, useRef, useState } from "react";
import { Map, List } from "lucide-react";
import apiInstance from "../../utils/axios";

import UnifiedMapScreen from "./UnifiedMapScreen";
import ExploreListScreen from "./ExploreListScreen";
import "./home.css";

const PAGE_SIZE = 24;

function buildParams(filters, page, pageSize) {
  const p = new URLSearchParams();

  if (filters.q?.trim())        p.set("q",        filters.q.trim());
  if (filters.city?.trim())     p.set("city",     filters.city.trim());
  if (filters.area?.trim())     p.set("area",     filters.area.trim());
  if (filters.borough?.trim())  p.set("borough",  filters.borough.trim());
  if (filters.max_price)        p.set("max_price", String(filters.max_price));
  if (filters.guests)           p.set("guests",    String(filters.guests));
  if (filters.min_bedrooms)     p.set("min_bedrooms", String(filters.min_bedrooms));
  if (filters.min_living_rooms) p.set("min_living_rooms", String(filters.min_living_rooms));
  if (filters.listing_type && filters.listing_type !== "all")
    p.set("listing_type", filters.listing_type);

  [
    "has_wifi","has_ac","has_parking","has_tv","has_kitchen","has_hot_water",
    "has_garden","has_balcony","has_generator","has_security","allows_pets","allows_smoking",
  ].forEach(k => { if (filters[k]) p.set(k, "true"); });

  p.set("page",      String(page));
  p.set("page_size", String(pageSize));
  return p.toString();
}

export default function HomeScreen() {
  const [listings,    setListings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tab,         setTab]         = useState("map");
  const [activeId,    setActiveId]    = useState(null);
  const [page,        setPage]        = useState(1);
  const [hasNext,     setHasNext]     = useState(false);

  const [filters, setFilters] = useState({
    q: "", city: "", area: "", borough: "",
    listing_type: "all", max_price: "", guests: "",
    min_bedrooms: "", min_living_rooms: "",
    has_garden: false, has_generator: false, has_security: false,
    has_wifi: false, has_ac: false, has_parking: false,
  });

  const reqId = useRef(0);
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 350);
    return () => clearTimeout(t);
  }, [filters.q]);

  const effectiveFilters = useMemo(() => ({ ...filters, q: debouncedQ }), [filters, debouncedQ]);

  const fetchPage = async ({ nextPage = 1, append = false } = {}) => {
    const id = ++reqId.current;
    try {
      if (!append) setLoading(true); else setLoadingMore(true);
      const qs = buildParams(effectiveFilters, nextPage, PAGE_SIZE);
      const { data } = await apiInstance.get(`listings/?${qs}`);
      const arr  = Array.isArray(data) ? data : (data?.results || []);
      const next = Array.isArray(data) ? null : data?.next;
      if (id !== reqId.current) return;
      setListings(prev => append ? [...prev, ...arr] : arr);
      setPage(nextPage);
      setHasNext(Boolean(next));
    } catch {
      if (!append) setListings([]);
      setHasNext(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPage({ nextPage: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveFilters.q, effectiveFilters.city, effectiveFilters.area,
    effectiveFilters.borough, effectiveFilters.listing_type, effectiveFilters.max_price,
    effectiveFilters.guests, effectiveFilters.min_bedrooms, effectiveFilters.min_living_rooms,
    effectiveFilters.has_garden, effectiveFilters.has_generator, effectiveFilters.has_security,
    effectiveFilters.has_wifi, effectiveFilters.has_ac, effectiveFilters.has_parking,
  ]);

  const loadMore = () => {
    if (!hasNext || loadingMore) return;
    fetchPage({ nextPage: page + 1, append: true });
  };

  return (
    <div className="res-shell">
      {/* ── Sticky tab bar ── */}
      <div className="res-tabbar">
        <span className="res-tabbar-title">Hébergements</span>
        <div className="res-tabs">
          <button
            className={`res-tab ${tab === "map" ? "active" : ""}`}
            onClick={() => setTab("map")}
          >
            <Map size={15} />
            Carte
          </button>
          <button
            className={`res-tab ${tab === "list" ? "active" : ""}`}
            onClick={() => setTab("list")}
          >
            <List size={15} />
            Liste
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={`res-body ${tab === "list" ? "res-body--list" : "res-body--map"}`}>
        {tab === "map" ? (
          <UnifiedMapScreen onGoList={() => setTab("list")} />
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
