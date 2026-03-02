import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import "./listingdetailscreen.css";

// ✅ helpers
const formatMoney = (x) => Number(x || 0).toLocaleString();

function getCoverAndGallery(images = []) {
  const cover = images.find((i) => i.is_cover) || images[0] || null;
  const gallery = images.filter((i) => !i.is_cover);
  return { cover, gallery };
}

// ✅ CHANGE: CASE 2 (suivi/paiement) est géré ailleurs maintenant.
// Donc plus besoin des labels de statut booking sur cette page.

export default function ListingDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ form demande
  const [durationDays, setDurationDays] = useState(1);
  const [desiredStartDate, setDesiredStartDate] = useState(""); // optional
  const [guests, setGuests] = useState(1);
  const [customerNote, setCustomerNote] = useState("");

  // ✅ CHANGE: loading uniquement pour l'envoi de demande
  const [submitLoading, setSubmitLoading] = useState(false);

  // ✅ gallery UI
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  // ✅ CHANGE: CASE 2 (suivi/paiement) est géré ailleurs maintenant.
  // On garde cette page uniquement pour afficher les infos + envoyer une nouvelle demande.

  // -----------------------------------------------------
  // Fetch listing
  // -----------------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const { data } = await apiInstance.get(`listings/${id}/`);
        if (mounted) {
          setListing(data);
          setActiveImgIndex(0);
        }
      } catch (e) {
        console.error("Listing detail fetch error:", e?.response?.data || e?.message);
        Swal.fire({
          icon: "error",
          title: "Erreur",
          text: "Impossible de charger cette résidence.",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  // -----------------------------------------------------
  // Submit: create booking request
  // -----------------------------------------------------
  const submitRequest = async () => {
    if (!listing) return;

    // ✅ CHANGE: si résidence archivée, on ne laisse pas envoyer une demande
    if (listing?.is_active === false) {
      Swal.fire({
        icon: "info",
        title: "Résidence archivée",
        text: "La résidence a été archivée par le gérant. Elle n'est plus disponible.",
      });
      return;
    }

    // ✅ validation UX
    const days = Number(durationDays);
    if (!days || days < 1) {
      Swal.fire({
        icon: "warning",
        title: "Durée",
        text: "Le nombre de jours doit être >= 1.",
      });
      return;
    }

    const g = Number(guests);
    if (!g || g < 1 || g > Number(listing.max_guests || 1)) {
      Swal.fire({
        icon: "warning",
        title: "Personnes",
        text: `Max ${listing.max_guests} personnes.`,
      });
      return;
    }

    setSubmitLoading(true); // ✅ CHANGE: spinner bouton
    try {
      const payload = {
        listing: listing.id,
        duration_days: days,
        guests: g,
        customer_note: customerNote || "",
      };

      // desired_start_date facultatif
      if (desiredStartDate) payload.desired_start_date = desiredStartDate;

      const { data } = await apiInstance.post("bookings/request/", payload);

      Swal.fire({
        icon: "success",
        title: "Demande envoyée",
        text: "Le gérant a reçu ta demande. Tu seras notifié dès qu'il répond.",
      }).then(() => {
        navigate(`/bookings/${data.id}`); // ✅ CASE 2 géré ailleurs -> on y va direct
      });
    } catch (e) {
      const apiErr = e?.response?.data;
      console.error("booking request error:", apiErr || e?.message);

      const msg =
        apiErr?.detail ||
        (typeof apiErr === "string" ? apiErr : JSON.stringify(apiErr || {})) ||
        "Impossible d'envoyer la demande.";

      Swal.fire({ icon: "error", title: "Erreur", text: msg });
    } finally {
      setSubmitLoading(false); // ✅ CHANGE
    }
  };

  // -----------------------------------------------------
  // Images
  // -----------------------------------------------------
  const images = listing?.images || [];
  const { cover, gallery } = useMemo(() => getCoverAndGallery(images), [images]);

  const carousel = useMemo(() => {
    const arr = [];
    if (cover) arr.push(cover);
    gallery.forEach((g) => arr.push(g));
    return arr;
  }, [cover, gallery]);

  const activeImage = carousel[activeImgIndex] || cover || null;

  // -----------------------------------------------------
  // Calculs UI: estimation total si dates pas confirmées
  // -----------------------------------------------------
  const estTotal = useMemo(() => {
    const days = Number(durationDays || 0);
    const price = Number(listing?.price_per_night || 0);
    if (!days || days < 1) return 0;
    return days * price;
  }, [durationDays, listing?.price_per_night]);

  const estDeposit = useMemo(() => Math.round(estTotal * 0.5), [estTotal]);

  // -----------------------------------------------------
  // Render
  // -----------------------------------------------------
  if (loading) {
    return (
      <div className="container py-4">
        <div className="ld-skeleton">Chargement...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning">Résidence introuvable.</div>
      </div>
    );
  }

  const lat = listing?.lat;
  const lng = listing?.lng;

  return (
    <div className="ld-page">
      {/* ✅ Top bar */}
      <div className="ld-topbar">
        <button type="button" className="ld-back" onClick={() => navigate(-1)}>
          ← Retour
        </button>
        <div className="ld-topmeta">
          <div className="ld-top-title">{listing.title}</div>

          {listing.test && (
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
              ⚠️ Résidence de démonstration — annonce fictive
            </div>
          )}

          <div className="ld-top-sub">
            {listing.borough || ""}
            {listing.borough && listing.area ? " · " : ""}
            {listing.area || ""}
            {listing.city ? ` · ${listing.city}` : ""}
          </div>
        </div>
      </div>

      {/* ✅ Hero images */}
      <div className="ld-hero">
        <div className="ld-hero-main">
          <img
            src={activeImage?.image_url || "https://via.placeholder.com/900x600?text=Residence"}
            alt="cover"
          />
        </div>

        <div className="ld-hero-strip">
          {carousel.slice(0, 6).map((img, idx) => (
            <button
              type="button"
              key={img.id}
              className={`ld-thumb ${idx === activeImgIndex ? "active" : ""}`}
              onClick={() => setActiveImgIndex(idx)}
            >
              <img src={img.image_url} alt="" />
            </button>
          ))}
        </div>
      </div>

      <div className="ld-content container">
        <div className="row g-4">
          {/* LEFT: details */}
          <div className="col-12 col-lg-7">
            <div className="ld-card">
              <div className="ld-h1">{listing.title}</div>
              <div className="ld-loc">
                {listing.address_label ||
                  "" ||
                  `${listing.borough || ""} ${listing.area || ""} ${listing.city || ""}`}
              </div>

              <div className="ld-card mt-3">
                <div className="ld-section-title">Caractéristiques</div>
                <div className="ld-features">
                  <div>🛏️ Chambres : <b>{listing.bedrooms}</b></div>
                  <div>🚿 Salles de bain : <b>{listing.bathrooms}</b></div>
                  <div>🛋️ Salons : <b>{listing.living_rooms}</b></div>
                  <div>🍳 Cuisines : <b>{listing.kitchens}</b></div>
                  <div>🛌 Lits : <b>{listing.beds}</b></div>
                  <div>👥 Max Personnes : <b>{listing.max_guests}</b></div>
                </div>
              </div>

              <div className="ld-badges">
                <span className="ld-badge">{(listing.listing_type || "Résidence").toUpperCase()}</span>
                <span className="ld-badge">Max {listing.max_guests} pers.</span>
                {listing.has_wifi ? <span className="ld-badge">Wifi</span> : null}
                {listing.has_ac ? <span className="ld-badge">Clim</span> : null}
                {listing.has_parking ? <span className="ld-badge">Parking</span> : null}
                {listing.has_tv ? <span className="ld-badge">TV</span> : null}
                {listing.has_kitchen ? <span className="ld-badge">Cuisine</span> : null}
                {listing.has_hot_water ? <span className="ld-badge">Eau chaude</span> : null}
                {listing.has_pool ? <span className="ld-badge">Piscine</span> : null}
              </div>

              {/* ✅ Mini map */}
              <div className="ld-card mt-3">
                <div className="ld-section-title">Emplacement</div>

                <div className="ld-map">
                  <MapContainer
                    center={[
                      typeof lat === "number" ? lat : 5.3599,
                      typeof lng === "number" ? lng : -4.0082,
                    ]}
                    zoom={15}
                    scrollWheelZoom={true}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    {typeof lat === "number" && typeof lng === "number" && (
                      <Marker position={[lat, lng]} />
                    )}
                  </MapContainer>
                </div>

                <div className="ld-map-note">Tu peux zoomer et te déplacer librement.</div>
              </div>

              {listing.description && <div className="ld-desc">{listing.description}</div>}

              {/* ✅ Gérant */}
              <div className="mt-3">
                <div className="text-muted small">Gérant</div>
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={() => navigate(`/seller/${listing.author_id}`)}
                >
                  {listing.author_name || "Voir le profil"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: booking request */}
          <div className="col-12 col-lg-5">
            <div className="ld-bookbox">
              <div className="ld-price">
                {formatMoney(listing.price_per_night)} FCFA <span>/ nuit</span>
              </div>

              {/* ✅ CHANGE: si la résidence est archivée, on affiche un message et on bloque le formulaire */}
              {listing?.is_active === false ? (
                <div className="ld-form">
                  <div className="alert alert-warning mb-0">
                    <div className="fw-semibold">Résidence archivée</div>
                    <div className="small mt-1">
                      La résidence a été archivée par le gérant. Elle n'est plus disponible.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ld-form">
                  <div className="row g-2">
                    <div className="col-12">
                      <label className="form-label">Nombre de jours</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Date souhaitée </label>
                      <input
                        type="date"
                        className="form-control"
                        value={desiredStartDate}
                        onChange={(e) => setDesiredStartDate(e.target.value)}
                        required
                      />
                      <div className="form-text">
                        Le gérant pourra confirmer ou proposer d’autres dates.
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Personnes</label>
                      <input
                        type="number"
                        min="1"
                        max={listing.max_guests || 1}
                        className="form-control"
                        value={guests}
                        onChange={(e) => setGuests(e.target.value)}
                      />
                      <div className="form-text">Max {listing.max_guests} personnes</div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Message (optionnel)</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={customerNote}
                        onChange={(e) => setCustomerNote(e.target.value)}
                        placeholder="Ex: j'arrive vers 18h, je veux une facture..."
                      />
                    </div>
                  </div>

                  <div className="ld-summary">
                    <div>
                      <div className="ld-summary-label">Total estimé</div>
                      <div className="ld-summary-value">{formatMoney(estTotal)} FCFA</div>
                    </div>
                    <div>
                      <div className="ld-summary-label">Acompte (50%)</div>
                      <div className="ld-summary-value">{formatMoney(estDeposit)} FCFA</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-dark w-100"
                    disabled={submitLoading}
                    onClick={submitRequest}
                  >
                    {submitLoading ? "Envoi..." : "Envoyer la demande"}
                  </button>

                  <div className="ld-hint">Le gérant doit accepter avant que tu puisses payer.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}