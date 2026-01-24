import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";

export default function PaystackReturnScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reference = params.get("reference");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const ranRef = useRef(false);

  const verify = async () => {
    if (!reference) {
      setErrorMsg("Référence Paystack manquante.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const { data } = await apiInstance.post("payments/paystack/verify/", { reference });

      // ✅ succès -> redirect booking
      const bookingId = data?.booking_id;
      if (bookingId) {
        // Optionnel : message rapide
        Swal.fire({
          icon: "success",
          title: "Paiement confirmé ✅",
          text: "Redirection vers ta réservation…",
          timer: 1400,
          showConfirmButton: false,
        });
// ✅ store code temporarily (session only)
if (data?.key_code) {
  sessionStorage.setItem(`booking_keycode_${data.booking_id}`, data.key_code);
}
if (data?.expires_at) {
  sessionStorage.setItem(`booking_keycode_exp_${data.booking_id}`, String(data.expires_at));
}

        navigate(`/bookings/${bookingId}`, { replace: true });
        return;
      }

      // Si pas booking_id => fallback
      setErrorMsg("Paiement vérifié, mais réservation introuvable.");
    } catch (e) {
      const apiErr = e?.response?.data;
      const msg =
        apiErr?.detail ||
        apiErr?.error ||
        (typeof apiErr === "string" ? apiErr : JSON.stringify(apiErr || {})) ||
        "Vérification impossible.";

      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body text-center">
          <div style={{ fontSize: 20, fontWeight: 800 }}>Paiement Paystack</div>

          {loading ? (
            <>
              <div className="text-muted mt-2">Vérification en cours…</div>
              <div className="spinner-border mt-4" role="status" />
              <div className="small text-muted mt-3">
                Ne ferme pas cette page.
              </div>
            </>
          ) : errorMsg ? (
            <>
              <div className="alert alert-warning mt-3 text-start">{errorMsg}</div>
              <button className="btn btn-dark w-100" onClick={verify}>
                Réessayer
              </button>
              <button className="btn btn-outline-dark w-100 mt-2" onClick={() => navigate("/me/bookings")}>
                Mes demandes
              </button>
            </>
          ) : (
            <>
              <div className="text-muted mt-2">Redirection…</div>
            </>
          )}

          {reference ? (
            <div className="small text-muted mt-3">
              Ref: <code>{reference}</code>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
