import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// ✅ util: flyTo quand on change l'actif
function FlyTo({ lat, lng, zoom = 15 }) {
  const map = useMap();
  if (typeof lat === "number" && typeof lng === "number") {
    map.flyTo([lat, lng], zoom, { duration: 0.6 });
  }
  return null;
}

// ✅ Marker icon
const icon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [28, 28],
});

// ✅ util: cover image depuis backend (images[])
function pickCover(listing) {
  const imgs = listing?.images || [];
  const cover = imgs.find((i) => i.is_cover) || imgs[0] || null;
  return cover?.image_url || "https://via.placeholder.com/420x260?text=Residence";
}

export default function ExploreMapScreen({
  loading,
  listings,
  filters,        // reçu mais pas obligatoire sur map (tu l’as quand même)
  setFilters,     // idem
  activeId,
  setActiveId,
  onGoList,
}) {
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const center = useMemo(() => [5.3599, -4.0082], []);
  const activeListing = useMemo(
    () => (listings || []).find((l) => l.id === activeId) || null,
    [listings, activeId]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  const focusListing = (l) => {
    setActiveId(l.id);
    setDrawerOpen(true);

    if (mapRef.current && typeof l.lat === "number" && typeof l.lng === "number") {
      mapRef.current.setView([l.lat, l.lng], 15, { animate: true });
    }
  };

  const openDetail = (id) => navigate(`/listings/${id}`);

  return (
    <div className="map-screen">
      {/* top overlay */}
      <div className="map-overlay-top">
        <div className="map-chip">
          {loading ? "Chargement..." : `${(listings || []).length} résidences`}
        </div>

        <button className="map-chip map-chip-btn" type="button" onClick={onGoList}>
          Voir la liste →
        </button>
      </div>

      <div className="map-canvas">
        <MapContainer
          center={center}
          zoom={12}
          whenCreated={(map) => (mapRef.current = map)}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

          {/* flyTo actif */}
          {activeListing?.lat && activeListing?.lng && (
            <FlyTo lat={activeListing.lat} lng={activeListing.lng} zoom={15} />
          )}

          {(listings || [])
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
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    🛏 {l.bedrooms ?? 0} ch · 🛋 {l.living_rooms ?? 0} salon(s)
                    {l.author_name ? ` · 👤 ${l.author_name}` : ""}
                  </span>
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

      {/* drawer */}
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

              {/* ✅ NEW: rooms + seller */}
              <div className="small text-muted mt-1">
                🛏 {activeListing.bedrooms ?? 0} ch · 🛋 {activeListing.living_rooms ?? 0} salon(s)
                {activeListing.author_name ? ` · 👤 ${activeListing.author_name}` : ""}
              </div>

              <div className="drawer-price">
                {Number(activeListing.price_per_night || 0).toLocaleString()} FCFA
                <span className="drawer-per"> / nuit</span>
              </div>

              <div className="drawer-actions">
                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={() => openDetail(activeListing.id)}
                >
                  Voir détails
                </button>

                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={() => setDrawerOpen(false)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
