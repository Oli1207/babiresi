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

  return (
    <div className="home-shell">
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
    </div>
  );
}
