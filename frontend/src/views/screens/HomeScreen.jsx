import { useEffect, useMemo, useState } from "react";
import apiInstance from "../../utils/axios";

import ExploreMapScreen from "./ExploreMapScreen";
import ExploreListScreen from "./ExploreListScreen";
import "./home.css";

export default function HomeScreen() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ NEW: navigation interne (2 écrans)
  const [tab, setTab] = useState("map"); // "map" | "list"

  // ✅ NEW: item actif partagé entre map & list
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const { data } = await apiInstance.get("listings/");
        const arr = Array.isArray(data) ? data : (data?.results || []);
        if (mounted) setListings(arr);
      } catch (e) {
        console.error("Home listings fetch error:", e?.response?.data || e?.message);
        if (mounted) setListings([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const activeListing = useMemo(
    () => listings.find((l) => l.id === activeId) || null,
    [listings, activeId]
  );

  // ✅ NEW: “Top bar” simple pro
  return (
    <div className="home-shell">
      <div className="home-topbar">
        <div className="home-brand">
          <div className="home-title">Kelari</div>
          <div className="home-subtitle">Explore les résidences à Abidjan</div>
        </div>

        <div className="home-tabs">
          <button
            className={`home-tab ${tab === "map" ? "active" : ""}`}
            onClick={() => setTab("map")}
            type="button"
          >
            Carte
          </button>
          <button
            className={`home-tab ${tab === "list" ? "active" : ""}`}
            onClick={() => setTab("list")}
            type="button"
          >
            Liste
          </button>
        </div>
      </div>

      {/* ✅ Body */}
      <div className="home-body">
        {tab === "map" ? (
          <ExploreMapScreen
            loading={loading}
            listings={listings}
            activeId={activeId}
            setActiveId={setActiveId}
            onGoList={() => setTab("list")} // ✅ CTA depuis la map
          />
        ) : (
          <ExploreListScreen
            loading={loading}
            listings={listings}
            activeId={activeId}
            setActiveId={setActiveId}
            onGoMap={() => setTab("map")} // ✅ CTA depuis la liste
          />
        )}
      </div>

      {/* ✅ Optionnel : petit footer sticky mobile (pro & simple) */}
      <div className="home-bottomnav d-lg-none">
        <button
          className={`bn-item ${tab === "map" ? "active" : ""}`}
          onClick={() => setTab("map")}
          type="button"
        >
          Carte
        </button>
        <button
          className={`bn-item ${tab === "list" ? "active" : ""}`}
          onClick={() => setTab("list")}
          type="button"
        >
          Liste
        </button>
      </div>
    </div>
  );
}
