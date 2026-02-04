import { useEffect, useMemo, useRef, useState } from "react";
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

function statusLabel(status) {
  const map = {
    requested: "En attente du gérant",
    rejected: "Refusée",
    approved: "Acceptée",
    awaiting_payment: "Paiement disponible",
    paid: "Acompte payé",
    checked_in: "Check-in validé",
    released: "Terminée",
    cancelled: "Annulée",
    expired: "Expirée",
  };
  return map[status] || status;
}

export default function ListingDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ request/booking state
  const [booking, setBooking] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // ✅ form demande
  const [durationDays, setDurationDays] = useState(1);
  const [desiredStartDate, setDesiredStartDate] = useState(""); // optional
  const [guests, setGuests] = useState(1);
  const [customerNote, setCustomerNote] = useState("");

  // ✅ paystack return
  const [payCode, setPayCode] = useState(null);
  const [payExpiresAt, setPayExpiresAt] = useState(null);

  // ✅ gallery UI
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  // ✅ to avoid double verify
  const verifyingRef = useRef(false);

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
        Swal.fire({ icon: "error", title: "Erreur", text: "Impossible de charger cette résidence." });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  // -----------------------------------------------------
  // Optionnel: après retour Paystack (si tu mets un callback_url qui revient sur cette page)
  // On accepte ?reference=xxxx
  // -----------------------------------------------------
  useEffect(() => {
    const url = new URL(window.location.href);
    const reference = url.searchParams.get("reference");
    if (!reference) return;
    if (verifyingRef.current) return;

    verifyingRef.current = true;

    (async () => {
      try {
        const { data } = await apiInstance.post("payments/paystack/verify/", { reference });

        // ✅ data.key_code + data.expires_at (selon notre backend)
        setPayCode(data?.key_code || null);
        setPayExpiresAt(data?.expires_at || null);

        // ✅ refresh booking (si on a booking_id)
        if (data?.booking_id) {
          await refreshMyBookingForListing(data.booking_id);
        }

        // ✅ nettoyer l'URL (enlever reference)
        url.searchParams.delete("reference");
        window.history.replaceState({}, "", url.toString());
      } catch (e) {
        console.error("verify error:", e?.response?.data || e?.message);
        Swal.fire({ icon: "error", title: "Paiement", text: "Vérification paiement impossible." });
      } finally {
        verifyingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------
  // Helper: refresh booking by id
  // (Pour l’instant on n’a pas endpoint booking detail; on récupère via /bookings/my/)
  // -----------------------------------------------------
  const refreshMyBookingForListing = async (bookingId) => {
    try {
      const { data } = await apiInstance.get("bookings/my/");
      const arr = Array.isArray(data) ? data : (data?.results || []);
      const found = arr.find((b) => b.id === bookingId);
      if (found) setBooking(found);
    } catch (e) {
      console.warn("refresh booking failed:", e?.response?.data || e?.message);
    }
  };

  // -----------------------------------------------------
  // Submit: create booking request
  // -----------------------------------------------------
  const submitRequest = async () => {
    if (!listing) return;

    // ✅ validation UX
    const days = Number(durationDays);
    if (!days || days < 1) {
      Swal.fire({ icon: "warning", title: "Durée", text: "Le nombre de jours doit être >= 1." });
      return;
    }

    const g = Number(guests);
    if (!g || g < 1 || g > Number(listing.max_guests || 1)) {
      Swal.fire({ icon: "warning", title: "Personnes", text: `Max ${listing.max_guests} personnes.` });
      return;
    }

    setBookingLoading(true);
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

      setBooking(data); // ✅ on garde la réponse (BookingRequestCreateSerializer)
      Swal.fire({
        icon: "success",
        title: "Demande envoyée ✅",
        text: "Le gérant a reçu ta demande. Tu seras notifié dès qu'il répond.",
      }).then(() => {
  navigate(`/bookings/${data.id}`); // ✅ Option A
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
      setBookingLoading(false);
    }
  };

  // -----------------------------------------------------
  // Payment-info + Paystack init
  // -----------------------------------------------------
  const fetchPaymentInfo = async () => {
    if (!booking?.id) return null;
    const { data } = await apiInstance.get(`bookings/${booking.id}/payment-info/`);
    return data;
  };

  const payDeposit = async () => {
    if (!booking?.id) return;

    setBookingLoading(true);
    try {
      // ✅ get payment info (montants)
      const info = await fetchPaymentInfo();

      if (!info || info.status !== "awaiting_payment") {
        Swal.fire({ icon: "info", title: "Paiement", text: "Paiement non disponible." });
        return;
      }
    

      // ✅ init paystack -> redirect user to authorization_url
      const { data } = await apiInstance.post(`bookings/${booking.id}/paystack/initialize/`);
      const url = data?.authorization_url;

      if (!url) {
        Swal.fire({ icon: "error", title: "Paystack", text: "Impossible de démarrer le paiement." });
        return;
      }

      window.location.href = url; // ✅ redirection Paystack
    } catch (e) {
      const apiErr = e?.response?.data;
      console.error("pay init error:", apiErr || e?.message);

      const msg =
        apiErr?.detail ||
        apiErr?.error ||
        (typeof apiErr === "string" ? apiErr : JSON.stringify(apiErr || {})) ||
        "Erreur Paystack.";

      Swal.fire({ icon: "error", title: "Paiement", text: msg });
    } finally {
      setBookingLoading(false);
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
            {(listing.borough || "")}
            {listing.borough && listing.area ? " · " : ""}
            {(listing.area || "")}
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
                {(listing.address_label || "") || `${listing.borough || ""} ${listing.area || ""} ${listing.city || ""}`}
              </div>

              {listing.description && <div className="ld-desc">{listing.description}</div>}
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
              </div>
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
                  {typeof lat === "number" && typeof lng === "number" && <Marker position={[lat, lng]} />}
                </MapContainer>
              </div>

              <div className="ld-map-note">Tu peux zoomer et te déplacer librement.</div>
            </div>
          </div>

          {/* RIGHT: booking request / payment */}
          <div className="col-12 col-lg-5">
            <div className="ld-bookbox">
              <div className="ld-price">
                {formatMoney(listing.price_per_night)} FCFA <span>/ nuit</span>
              </div>

              {/* ==============================
                  ✅ CASE 1: pas encore de booking
                 ============================== */}
              {!booking ? (
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
                      <div className="form-text">Le gérant pourra confirmer ou proposer d’autres dates.</div>
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
                    disabled={bookingLoading}
                    onClick={submitRequest}
                  >
                    {bookingLoading ? "Envoi..." : "Envoyer la demande"}
                  </button>

                  <div className="ld-hint">
                    Le gérant doit accepter avant que tu puisses payer.
                  </div>
                </div>
              ) : (
                <>
                  {/* ==============================
                      ✅ CASE 2+: booking existe
                     ============================== */}
                  <div className="ld-form">
                    <div className="ld-status">
                      <div className="ld-status-pill">{statusLabel(booking.status)}</div>
                      <div className="ld-status-sub">
                        {booking.start_date && booking.end_date ? (
                          <span>
                            Dates confirmées : <b>{booking.start_date}</b> → <b>{booking.end_date}</b>
                          </span>
                        ) : booking.desired_start_date ? (
                          <span>
                            Date souhaitée : <b>{booking.desired_start_date}</b> · Durée : <b>{booking.duration_days} jours</b>
                          </span>
                        ) : (
                          <span>Durée : <b>{booking.duration_days} jours</b></span>
                        )}
                      </div>
                    </div>

                    {/* ✅ Si refus : afficher note + propositions si disponibles */}
                    {booking.status === "rejected" && (
                      <div className="alert alert-warning mt-3">
                        <div className="fw-semibold">Refusée</div>
                        {booking.owner_note ? <div className="small mt-1">{booking.owner_note}</div> : null}
                        <div className="small mt-2">Tu peux faire une nouvelle demande avec d’autres dates/jours.</div>
                      </div>
                    )}

                    {/* ✅ Si awaiting_payment : afficher montants + payer */}
                    {booking.status === "awaiting_payment" && (
                      <div className="mt-3">
                        <div className="ld-paybox">
                          <div className="ld-payrow">
                            <span>Total</span>
                            <b>{formatMoney(booking.total_amount)} FCFA</b>
                          </div>
                          <div className="ld-payrow">
                            <span>Acompte (50%)</span>
                            <b>{formatMoney(booking.deposit_amount)} FCFA</b>
                          </div>
                          <div className="ld-payrow">
  <span>Frais de service (sécurité)</span>
  <b>{formatMoney(booking.platform_commission)} FCFA</b>
</div>

                          <div className="ld-payrow total">
                            <span>À payer</span>
                            <b>{formatMoney(booking.amount_to_pay)} FCFA</b>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-dark w-100 mt-3"
                          disabled={bookingLoading}
                          onClick={payDeposit}
                        >
                          {bookingLoading ? "Redirection..." : "Payer l’acompte"}
                        </button>

                        <div className="ld-hint">
                          Le paiement est sécurisé. La plateforme conserve l’acompte jusqu’à remise de la clé.
                        </div>
                      </div>
                    )}

                    {/* ✅ Si paid : afficher confirmation + code (si on l'a) */}
                    {booking.status === "paid" && (
                      <div className="alert alert-success mt-3">
                        <div className="fw-semibold">Acompte payé ✅</div>
                        <div className="small mt-1">
                          Ton code de remise sera demandé à l’arrivée.
                        </div>

                        {payCode && (
                          <div className="mt-3">
                            <div className="fw-semibold">Code de remise</div>
                            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 3 }}>
                              {payCode}
                            </div>
                            {payExpiresAt && (
                              <div className="small text-muted mt-1">
                                Expire le: {String(payExpiresAt)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ✅ CTA: refaire une demande si rejetée */}
                    {booking.status === "rejected" && (
                      <button
                        type="button"
                        className="btn btn-outline-dark w-100 mt-3"
                        onClick={() => {
                          // reset pour refaire une demande
                          setBooking(null);
                          setPayCode(null);
                          setPayExpiresAt(null);
                        }}
                      >
                        Faire une nouvelle demande
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="ld-note mt-3">
              Notifications : le gérant reçoit une alerte dès qu’une demande arrive et peut accepter/refuser.
              Ensuite, le bouton de paiement apparaît chez le client.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
