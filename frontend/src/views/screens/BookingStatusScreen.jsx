import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import "./BookingStatusScreen.css";

const fmt = (x) => Number(x || 0).toLocaleString();

const STATUS_FLOW = [
  { key: "requested", label: "Demande envoyée" },
  { key: "awaiting_payment", label: "Acceptée (paiement)" },
  { key: "paid", label: "Acompte payé" },
  { key: "checked_in", label: "Clé remise (check-in)" },
  { key: "released", label: "Terminée" },
];

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

function statusStepIndex(status) {
  const idx = STATUS_FLOW.findIndex((s) => s.key === status);
  // statuts “hors flow”
  if (status === "rejected") return -1;
  if (status === "cancelled") return -2;
  if (status === "expired") return -3;
  return idx;
}

export default function BookingStatusScreen() {
  const { id } = useParams();
  const bookingId = Number(id);
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ code affichable UNE FOIS (stocké en sessionStorage depuis PaystackReturnScreen)
  const [keyCode, setKeyCode] = useState(null);
  const [keyExpiresAt, setKeyExpiresAt] = useState(null);

  const [payLoading, setPayLoading] = useState(false);

  // prevent double initial fetch
  const mountedRef = useRef(false);

const [expiresAt, setExpiresAt] = useState(null);
const [codeLoading, setCodeLoading] = useState(false);

const fetchCode = async () => {
  setCodeLoading(true);
  try {
    const { data } = await apiInstance.get(`bookings/${bookingId}/my-key-code/`);
    setKeyCode(data.code);
    setExpiresAt(data.expires_at);
  } catch (e) {
    const msg = e?.response?.data?.detail || "Impossible de récupérer le code.";
    Swal.fire({ icon: "error", title: "Code", text: msg });
  } finally {
    setCodeLoading(false);
  }
};

  const fetchBooking = async () => {
    setLoading(true);
    try {
      // ✅ booking detail endpoint (on l’a ajouté côté backend)
      const { data } = await apiInstance.get(`bookings/${bookingId}/`);
      setBooking(data);
    } catch (e) {
      console.error("booking detail error:", e?.response?.data || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: "Impossible de charger cette réservation." });
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ read key code from sessionStorage once
  const hydrateKeyCodeFromSession = () => {
    const k = sessionStorage.getItem(`booking_keycode_${bookingId}`);
    const exp = sessionStorage.getItem(`booking_keycode_exp_${bookingId}`);

    if (k) {
      setKeyCode(k);
      sessionStorage.removeItem(`booking_keycode_${bookingId}`); // ✅ consume
    }
    if (exp) {
      setKeyExpiresAt(exp);
      sessionStorage.removeItem(`booking_keycode_exp_${bookingId}`); // ✅ consume
    }
  };

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    hydrateKeyCodeFromSession();
    fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canPay = useMemo(() => booking?.status === "awaiting_payment", [booking?.status]);

  const payDeposit = async () => {
    if (!booking?.id) return;
    if (
    booking?.desired_start_date &&
    booking?.start_date &&
    booking.start_date !== booking.desired_start_date
  ) {
    const res = await Swal.fire({
      icon: "warning",
      title: "Dates modifiées par le gérant ⚠️",
      html: `
        <div style="text-align:left">
          <div>Le gérant a ajusté la période pour la disponibilité.</div>
          <hr/>
          <div><b>Ta date souhaitée :</b> ${booking.desired_start_date}</div>
          <div><b>Nouvelle date confirmée :</b> ${booking.start_date} → ${booking.end_date}</div>
          <hr/>
          <div style="font-size:13px;color:#555">
            Vérifie attentivement la nouvelle date avant de payer.
            Si ça ne te convient pas, d’autres résidences peuvent te plaire.
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "J’ai vérifié, continuer",
      cancelButtonText: "Annuler",
    });
     if (!res.isConfirmed) return;
  }
    setPayLoading(true);
    try {
      // ✅ init paystack -> redirect
      const { data } = await apiInstance.post(`bookings/${booking.id}/paystack/initialize/`);
      const url = data?.authorization_url;
      if (!url) {
        Swal.fire({ icon: "error", title: "Paystack", text: "Impossible de démarrer le paiement." });
        return;
      }
      window.location.href = url;
    } catch (e) {
      const apiErr = e?.response?.data;
      const msg =
        apiErr?.detail ||
        apiErr?.error ||
        (typeof apiErr === "string" ? apiErr : JSON.stringify(apiErr || {})) ||
        "Erreur Paystack.";
      Swal.fire({ icon: "error", title: "Paiement", text: msg });
    } finally {
      setPayLoading(false);
    }
  };

  const stepIdx = useMemo(() => statusStepIndex(booking?.status), [booking?.status]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(String(keyCode));
      Swal.fire({ icon: "success", title: "Copié", text: "Code copié dans le presse-papier.", timer: 1300, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "info", title: "Info", text: "Impossible de copier automatiquement. Sélectionne le code et copie." });
    }
  };

  if (loading) {
    return (
      <div className="container py-4">
        <div className="alert alert-light border">Chargement…</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning">Réservation introuvable.</div>
        <button type="button" className="bookings-btn" onClick={() => navigate("/me/bookings")}>
          Mes demandes
        </button>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 780 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <button type="button" className="bookings-back" onClick={() => navigate(-1)}>
          ← Retour
        </button>
        <button type="button" className="bookings-btn" onClick={() => navigate("/me/bookings")}>
          Mes demandes
        </button>
      </div>

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div>
              <div className="fw-bold" style={{ fontSize: 18, color: "#1a1a1a" }}>{booking.listing_title}</div>
              <div className="small" style={{ color: "#555" }}>
                Statut : <b>{statusLabel(booking.status)}</b>
              </div>
            </div>
            <span className="badge text-bg-dark" style={{ height: "fit-content" }}>
              #{booking.id}
            </span>
          </div>

          {/* ✅ summary */}
          <div className="mt-3 small" style={{ color: "#1a1a1a" }}>
            <div>Durée : <b>{booking.duration_days}</b> jours · Personnes : <b>{booking.guests}</b></div>
            {booking.start_date && booking.end_date ? (
              <div>Dates : <b>{booking.start_date}</b> → <b>{booking.end_date}</b></div>
            ) : booking.desired_start_date ? (
              <div>Date souhaitée : <b>{booking.desired_start_date}</b></div>
            ) : null}
          </div>

          {/* ✅ timeline */}
          <div className="mt-4">
            <div className="fw-bold mb-2" style={{ color: "#1a1a1a" }}>Progression</div>

            {booking.status === "rejected" || booking.status === "cancelled" || booking.status === "expired" ? (
              <div className="alert alert-warning mb-0">
                <div className="fw-semibold">Statut: {statusLabel(booking.status)}</div>
                {booking.owner_note ? <div className="small mt-1">{booking.owner_note}</div> : null}
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {STATUS_FLOW.map((s, idx) => {
                  const done = stepIdx >= idx;
                  return (
                    <div key={s.key} className="d-flex align-items-center gap-2">
                      <span
                        className={`badge ${done ? "text-bg-dark" : "text-bg-light"}`}
                        style={{ width: 28, display: "inline-flex", justifyContent: "center" }}
                      >
                        {idx + 1}
                      </span>
                      <div className={done ? "fw-bold" : ""} style={{ color: done ? "#1a1a1a" : "#555" }}>{s.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ✅ payment block */}
          {canPay && (
            <div className="mt-4">
              <div className="fw-semibold mb-2">Paiement</div>
              {booking?.desired_start_date &&
 booking?.start_date &&
 booking.start_date !== booking.desired_start_date && (
  <span
    className="d-block mb-2 px-3 py-2 rounded-3 border"
    style={{ background: "#ffe5e5", color: "#b00020", fontWeight: 700 }}
  >
    ⚠️ Attention : le gérant a modifié la période pour la disponibilité.  
    <span style={{ fontWeight: 800 }}>
      Vérifie les nouvelles dates ({booking.start_date} → {booking.end_date}) te conviennent
    </span>{" "}
    avant de payer.
  </span>
)}

              <div className="border rounded-3 p-3" style={{ color: "#1a1a1a" }}>
                <div className="d-flex justify-content-between"><span>Total</span><b>{fmt(booking.total_amount)} FCFA</b></div>
                <div className="d-flex justify-content-between"><span>Acompte (50%)</span><b>{fmt(booking.deposit_amount)} FCFA</b></div>
                <div className="d-flex justify-content-between">
  <span>Frais de service (sécurité)</span>
  <b>{fmt(booking.platform_commission)} FCFA</b>
</div>

                <hr className="my-2" />
                <div className="d-flex justify-content-between"><span>À payer</span><b>{fmt(booking.amount_to_pay)} FCFA</b></div>
              </div>

              <button className="btn btn-dark w-100 mt-3" onClick={payDeposit} disabled={payLoading}>
                {payLoading ? "Redirection..." : "Payer l’acompte"}
              </button>

              <div className="small text-muted mt-2">
                La plateforme conserve l’acompte jusqu’à remise de la clé.
              </div>
            </div>
          )}

          {/* ✅ paid block + code (from sessionStorage) */}
          {booking.status === "paid" && (
            <div className="mt-4">
              <div className="alert alert-success mb-0">
                <div className="fw-semibold">Acompte payé</div>
                <div className="contact-actions">
                  <a href={booking?.owner_contact?.phone_raw} className="bookings-contact-btn bookings-call-btn">
                    📞 Appeler
                  </a>
                  <a
                    href={booking?.owner_contact?.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bookings-contact-btn bookings-whatsapp-btn"
                  >
                    💬 WhatsApp
                  </a>
                </div>

                <div className="small mt-1">
                  À l’arrivée, le gérant te demandera un code pour valider la remise de la clé.
                </div>

                <button className="btn btn-dark w-100" onClick={fetchCode} disabled={codeLoading}>
  {codeLoading ? "Chargement..." : "Afficher mon code"}
</button>

{keyCode && (
  <div className="mt-3 p-3 bg-white border rounded-3">
    <div className="fw-semibold">Code de remise</div>
    <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 4, color:"black", textAlign: "center" }}>
      {keyCode}
    </div>
    {expiresAt && <div className="small text-muted text-center">Expire le : {String(expiresAt)}</div>}
  </div>
)}
              </div>
            </div>
          )}

          {/* ✅ checked_in / released blocks */}
          {booking.status === "checked_in" && (
            <div className="alert alert-info mt-4 mb-0">
              <div className="fw-semibold">Check-in validé</div>
              <div className="small mt-1">Le gérant a validé ton arrivée.</div>
            </div>
          )}

          {booking.status === "released" && (
            <div className="alert alert-light border mt-4 mb-0">
              <div className="fw-semibold">Réservation terminée</div>
              <div className="small mt-1">Reversement effectué au gérant. Merci !</div>
            </div>
          )}

          <button type="button" className="bookings-btn w-100 mt-4" onClick={fetchBooking}>
            Rafraîchir
          </button>
        </div>
      </div>
    </div>
  );
}
