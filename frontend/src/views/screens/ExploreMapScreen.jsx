import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import apiInstance from "../../utils/axios";

// ✅ Watch bounds (move/zoom)
function BoundsWatcher({ onBoundsChange }) {
  useMapEvents({
    moveend: (e) => {
      const b = e.target.getBounds();
      onBoundsChange(b);
    },
    zoomend: (e) => {
      const b = e.target.getBounds();
      onBoundsChange(b);
    },
  });
  return null;
}

const icon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [28, 28],
});

function pickCover(listing) {
  const imgs = listing?.images || [];
  const cover = imgs.find((i) => i.is_cover) || imgs[0] || null;
  return cover?.image_url || "/listing-fallback.jpg";
}

// ✅ Build query: bounds + filters
function buildMapParams(filters, bounds, limit = 250) {
  const p = new URLSearchParams();

  p.set("map", "1");
  p.set("limit", String(limit));

  if (bounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    p.set("ne_lat", String(ne.lat));
    p.set("ne_lng", String(ne.lng));
    p.set("sw_lat", String(sw.lat));
    p.set("sw_lng", String(sw.lng));
  }

  const f = filters || {};

  if (f.q?.trim()) p.set("q", f.q.trim());
  if (f.city?.trim()) p.set("city", f.city.trim());
  if (f.area?.trim()) p.set("area", f.area.trim());
  if (f.borough?.trim()) p.set("borough", f.borough.trim());

  if (f.max_price !== "" && f.max_price != null) p.set("max_price", String(f.max_price));
  if (f.guests !== "" && f.guests != null) p.set("guests", String(f.guests));
  if (f.min_bedrooms !== "" && f.min_bedrooms != null) p.set("min_bedrooms", String(f.min_bedrooms));
  if (f.min_bathrooms !== "" && f.min_bathrooms != null) p.set("min_bathrooms", String(f.min_bathrooms));
  if (f.min_living_rooms !== "" && f.min_living_rooms != null) p.set("min_living_rooms", String(f.min_living_rooms));
  if (f.min_kitchens !== "" && f.min_kitchens != null) p.set("min_kitchens", String(f.min_kitchens));
  if (f.min_beds !== "" && f.min_beds != null) p.set("min_beds", String(f.min_beds));

  [
    "has_wifi",
    "has_ac",
    "has_parking",
    "has_tv",
    "has_kitchen",
    "has_hot_water",
    "has_garden",
    "has_balcony",
    "has_generator",
    "has_security",
    "allows_pets",
    "allows_smoking",
  ].forEach((k) => {
    if (f[k]) p.set(k, "true");
  });

  return p.toString();
}

// ✅ bounds key stable (arrondi) pour éviter fetchs inutiles
function boundsKey(bounds) {
  if (!bounds) return "";
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const r = (n) => Number(n).toFixed(4);
  return `${r(sw.lat)}|${r(sw.lng)}|${r(ne.lat)}|${r(ne.lng)}`;
}

export default function ExploreMapScreen({
  filters,
  activeId,
  setActiveId,
  onGoList,
}) {
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const center = useMemo(() => [5.3599, -4.0082], []); // Abidjan

  const [mapListings, setMapListings] = useState([]);
  const [mapLoading, setMapLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // ✅ anti-race + debounce
  const reqId = useRef(0);
  const debounceTimer = useRef(null);

  // ✅ bounds tracking
  const [bounds, setBounds] = useState(null);
  const lastBoundsKeyRef = useRef("");

  const activeListing = useMemo(
    () => (mapListings || []).find((l) => l.id === activeId) || null,
    [mapListings, activeId]
  );

  const fetchMap = async (b) => {
    const id = ++reqId.current;

    try {
      setMapLoading(true);
      const qs = buildMapParams(filters, b, 250);
      const { data } = await apiInstance.get(`listings/?${qs}`);

      const arr = Array.isArray(data) ? data : (data?.results || []);
      if (id !== reqId.current) return;

      setMapListings(arr);
    } catch (e) {
      console.error("Map bounds fetch error:", e?.response?.data || e?.message);
      if (id !== reqId.current) return;
      setMapListings([]);
    } finally {
      if (id === reqId.current) setMapLoading(false);
    }
  };

  const scheduleFetchForBounds = (b) => {
    const key = boundsKey(b);

    // ✅ GUARD: si bounds quasi identiques => pas de fetch
    if (key && key === lastBoundsKeyRef.current) return;
    lastBoundsKeyRef.current = key;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchMap(b);
    }, 300);
  };

  const handleBoundsChange = (b) => {
    setBounds(b);
    scheduleFetchForBounds(b);
  };

  const handleMapCreated = (map) => {
    mapRef.current = map;
    const b = map.getBounds();
    handleBoundsChange(b);
  };

  // ✅ Quand filters changent => refetch sur mêmes bounds (sans boucle)
  useEffect(() => {
    if (!bounds) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      // ✅ pas besoin de changer lastBoundsKeyRef ici
      fetchMap(bounds);
    }, 350);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const focusListing = (l) => {
    setActiveId?.(l.id);
    setDrawerOpen(true);

    // ✅ IMPORTANT: on centre UNE FOIS au click, pas en permanence
    if (mapRef.current && typeof l.lat === "number" && typeof l.lng === "number") {
      mapRef.current.setView([l.lat, l.lng], 15, { animate: true });
    }
  };

  const openDetail = (id) => navigate(`/listings/${id}`);

  return (
    <div className="map-screen">
      <div className="map-overlay-top">
        <div className="map-chip">
          {mapLoading ? "Chargement..." : `${(mapListings || []).length} résidences (zone)`}
        </div>

        <button className="map-chip map-chip-btn" type="button" onClick={onGoList}>
          Voir la liste →
        </button>
      </div>

      <div className="map-canvas">
        <MapContainer
          center={center}
          zoom={12}
          whenCreated={handleMapCreated}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <BoundsWatcher onBoundsChange={handleBoundsChange} />

          {(mapListings || [])
            .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
            .map((l) => (
              <Marker
                key={l.id}
                position={[l.lat, l.lng]}
                icon={icon}
                eventHandlers={{ click: () => focusListing(l) }}
              >
                <Popup>
                  <strong>{l.title}</strong>
                  <br />
                  {Number(l.price_per_night || 0).toLocaleString()} FCFA / nuit
                  <br />
                  <button
                    type="button"
                    className="btn btn-dark btn-sm mt-2"
                    onClick={() => openDetail(l.id)}
                  >
                    Voir détails
                  </button>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      <div className={`map-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="map-drawer-handle" onClick={() => setDrawerOpen((p) => !p)} />

        {!activeListing ? (
          <div className="map-drawer-empty">
            <div className="fw-semibold">Explore la carte</div>
            <div className="text-muted small">Clique sur un pin pour voir une résidence.</div>
          </div>
        ) : (
          <div className="map-drawer-card">
            <div className="drawer-thumb">
              <img src={pickCover(activeListing)} alt="" />
            </div>

            <div className="drawer-info">
              <div className="drawer-title">{activeListing.title}</div>

              <div className="drawer-loc">
                {(activeListing.borough || "")}
                {activeListing.borough && activeListing.area ? " · " : ""}
                {(activeListing.area || "")}
                {activeListing.city ? ` · ${activeListing.city}` : ""}
              </div>

              <div className="drawer-price">
                {Number(activeListing.price_per_night || 0).toLocaleString()} FCFA
                <span className="drawer-per"> / nuit</span>
              </div>

              <div className="drawer-actions">
                <button type="button" className="btn btn-dark" onClick={() => openDetail(activeListing.id)}>
                  Voir détails
                </button>

                {/* ✅ Bonus UX: bouton pour recentrer si tu veux */}
                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={() => focusListing(activeListing)}
                >
                  Recentrer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
