import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";

const fmt = (x) => Number(x || 0).toLocaleString();

function statusLabel(status) {
  const map = {
    requested: "En attente gérant",
    awaiting_payment: "Paiement disponible",
    paid: "Payée",
    checked_in: "Check-in",
    released: "Terminée",
    rejected: "Refusée",
    cancelled: "Annulée",
    expired: "Expirée",
  };
  return map[status] || status;
}

export default function MyBookingsScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMine = async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get("bookings/my/");
      const arr = Array.isArray(data) ? data : (data?.results || []);
      setItems(arr);
    } catch (e) {
      console.error("my bookings error:", e?.response?.data || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: "Impossible de charger tes demandes." });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMine(); }, []);

  const groups = useMemo(() => {
    const pending = items.filter((b) => ["requested", "awaiting_payment"].includes(b.status));
    const active = items.filter((b) => ["paid", "checked_in"].includes(b.status));
    const history = items.filter((b) => ["released", "rejected", "cancelled", "expired"].includes(b.status));
    return { pending, active, history };
  }, [items]);

  const Section = ({ title, list }) => (
    <div className="mb-3">
      <div className="fw-bold mb-2">{title}</div>
      {list.length === 0 ? (
        <div className="alert alert-light border py-2">Aucun élément.</div>
      ) : (
        <div className="d-grid gap-2">
          {list.map((b) => (
            <button
              key={b.id}
              className="btn btn-light border text-start"
              onClick={() => navigate(`/bookings/${b.id}`)}
            >
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold">{b.listing_title}</div>
                <span className="badge text-bg-dark">{statusLabel(b.status)}</span>
              </div>
              <div className="small text-muted mt-1">
                {b.duration_days} jours · {b.guests} pers. · Total: {fmt(b.total_amount)} FCFA
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <div className="fw-bold" style={{ fontSize: 18 }}>Mes demandes</div>
          <div className="text-muted small">Suis l’état de tes réservations.</div>
        </div>
        <button className="btn btn-outline-dark btn-sm" onClick={() => navigate("/")}>
          Explorer
        </button>
      </div>

      {loading ? (
        <div className="alert alert-light border">Chargement...</div>
      ) : (
        <>
          <Section title="En cours" list={groups.pending} />
          <Section title="Actives" list={groups.active} />
          <Section title="Historique" list={groups.history} />
        </>
      )}
    </div>
  );
}
