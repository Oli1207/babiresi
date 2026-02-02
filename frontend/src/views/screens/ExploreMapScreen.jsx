import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import apiInstance from "../../utils/axios";

/* =======================
   Helpers
======================= */

function BoundsWatcher({ onUserMove }) {
  useMapEvents({
    moveend(e) {
      onUserMove(e.target.getBounds());
    },
    zoomend(e) {
      onUserMove(e.target.getBounds());
    },
  });
  return null;
}

const markerIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [28, 28],
});

function pickCover(listing) {
  const imgs = listing?.images || [];
  const cover = imgs.find((i) => i.is_cover) || imgs[0];
  return cover?.image_url || "/listing-fallback.jpg";
}

function buildParams(filters, bounds, limit = 250) {
  const p = new URLSearchParams();
  p.set("map", "1");
  p.set("limit", limit);

  if (bounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    p.set("ne_lat", ne.lat);
    p.set("ne_lng", ne.lng);
    p.set("sw_lat", sw.lat);
    p.set("sw_lng", sw.lng);
  }

  if (!filters) return p.toString();

  if (filters.q) p.set("q", filters.q);
  if (filters.city) p.set("city", filters.city);
  if (filters.max_price) p.set("max_price", filters.max_price);
  if (filters.guests) p.set("guests", filters.guests);

  return p.toString();
}

function boundsKey(b) {
  if (!b) return "";
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  return `${sw.lat.toFixed(3)}|${sw.lng.toFixed(3)}|${ne.lat.toFixed(
    3
  )}|${ne.lng.toFixed(3)}`;
}

/* =======================
   Screen
======================= */

export default function ExploreMapScreen({
  filters,
  activeId,
  setActiveId,
  onGoList,
}) {
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  const lastBoundsKey = useRef("");
  const debounceRef = useRef(null);
  const requestId = useRef(0);

  const center = useMemo(() => [5.3599, -4.0082], []); // Abidjan

  const activeListing = useMemo(
    () => listings.find((l) => l.id === activeId) || null,
    [listings, activeId]
  );

  /* =======================
     Fetch map data
  ======================= */
  const fetchForBounds = async (bounds) => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const qs = buildParams(filters, bounds);
      const { data } = await apiInstance.get(`listings/?${qs}`);

      if (id !== requestId.current) return;
      setListings(Array.isArray(data) ? data : data.results || []);
    } catch (e) {
      console.error("Map fetch error", e);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const handleUserMove = (bounds) => {
    const key = boundsKey(bounds);
    if (key === lastBoundsKey.current) return;

    lastBoundsKey.current = key;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchForBounds(bounds);
    }, 400);
  };

  const onMapReady = (map) => {
    mapRef.current = map;
    handleUserMove(map.getBounds());
  };

  /* =======================
     Events
  ======================= */

  const openDetail = (id) => navigate(`/listings/${id}`);

  const onMarkerClick = (listing) => {
    setActiveId(listing.id);
    // ❌ PAS DE setView ici → bug supprimé
  };

  /* =======================
     Render
  ======================= */

  return (
    <div className="map-screen">
      <div className="map-overlay-top">
        <div className="map-chip">
          {loading
            ? "Mise à jour…"
            : `${listings.length} résidences dans la zone`}
        </div>

        <button className="map-chip map-chip-btn" onClick={onGoList}>
          Voir la liste →
        </button>
      </div>

      <div className="map-canvas">
        <MapContainer
          center={center}
          zoom={12}
          whenCreated={onMapReady}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <BoundsWatcher onUserMove={handleUserMove} />

          {listings
           .filter(
  (l) =>
    typeof (l.lat ?? l.latitude) === "number" &&
    typeof (l.lng ?? l.longitude) === "number"
)

            .map((l) => (
              <Marker
                key={l.id}
               position={[
  l.lat ?? l.latitude,
  l.lng ?? l.longitude,
]}
                icon={markerIcon}
                eventHandlers={{ click: () => onMarkerClick(l) }}
              >
                <Popup autoClose={false} closeOnClick={false}>
                  <strong>{l.title}</strong>
                  {l.test && (
  <div
    style={{
      background: "#ffcc00",
      color: "#000",
      fontWeight: 700,
      fontSize: 12,
      padding: "2px 6px",
      borderRadius: 4,
      marginBottom: 4,
      display: "inline-block",
    }}
  >
    TEST
  </div>
)}

                  <br />
                  {Number(l.price_per_night).toLocaleString()} FCFA / nuit
                  <br />
                  <button
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
    </div>
  );
}
