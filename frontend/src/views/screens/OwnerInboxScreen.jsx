import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import "./owner.css";

const fmt = (x) => Number(x || 0).toLocaleString();

function BookingCard({ b, onOpen }) {
  return (
    <div className="owner-card" onClick={onOpen}>
      <div className="owner-card-top">
        <div className="owner-title">{b.listing_title}</div>
        <div className={`owner-pill ${b.status}`}>{b.status}</div>
      </div>

      <div className="owner-sub">
        Client: <b>{b.user}</b> · {b.duration_days} jours · {b.guests} pers.
      </div>

      <div className="owner-sub2">
        {b.desired_start_date ? (
          <>Date souhaitée: <b>{b.desired_start_date}</b></>
        ) : (
          <>Date souhaitée: <b>non précisée</b></>
        )}
      </div>

      <div className="owner-money">
        Total estimé: <b>{fmt(b.total_amount)} FCFA</b> · Acompte: <b>{fmt(b.deposit_amount || Math.round((b.total_amount || 0) * 0.5))} FCFA</b>
      </div>
    </div>
  );
}

export default function OwnerInboxScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("requested");

  // ✅ modal state
  const [active, setActive] = useState(null);

  // ✅ proposals (facultatif)
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pNote, setPNote] = useState("");

  const proposals = useMemo(() => {
    if (!pStart || !pEnd) return [];
    return [{ start_date: pStart, end_date: pEnd, note: pNote || "" }];
  }, [pStart, pEnd, pNote]);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get(`bookings/owner-inbox/?status=${statusFilter}`);
      const arr = Array.isArray(data) ? data : (data?.results || []);
      setItems(arr);
    } catch (e) {
      console.error("owner inbox error:", e?.response?.data || e?.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const approve = async (bookingId, startDate, ownerNote) => {
    try {
      await apiInstance.post(`bookings/${bookingId}/decision/`, {
        action: "approve",
        start_date: startDate || null, // si null, backend utilise desired_start_date
        owner_note: ownerNote || "",
      });
      Swal.fire({ icon: "success", title: "Acceptée", text: "Le client peut maintenant payer." });
      setActive(null);
      fetchInbox();
    } catch (e) {
      const apiErr = e?.response?.data;
      const msg = apiErr?.detail || JSON.stringify(apiErr || {}) || "Erreur.";
      Swal.fire({ icon: "error", title: "Erreur", text: msg });
    }
  };

  const reject = async (bookingId, ownerNote) => {
    try {
      await apiInstance.post(`bookings/${bookingId}/decision/`, {
        action: "reject",
        owner_note: ownerNote || "Déjà pris",
        proposals: proposals.length ? proposals : [],
      });
      Swal.fire({ icon: "success", title: "Refusée", text: "Le client a été informé." });
      setActive(null);
      setPStart("");
      setPEnd("");
      setPNote("");
      fetchInbox();
    } catch (e) {
      const apiErr = e?.response?.data;
      const msg = apiErr?.detail || JSON.stringify(apiErr || {}) || "Erreur.";
      Swal.fire({ icon: "error", title: "Erreur", text: msg });
    }
  };

  return (
    <div className="container py-3 owner-inbox-wrap">
      <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h2 className="owner-inbox-title">Demandes de réservation</h2>
          <p className="owner-inbox-subtitle">Accepte/refuse avant paiement.</p>
        </div>

        <select
          className="form-select owner-inbox-select"
          style={{ maxWidth: 220 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="requested">En attente</option>
          <option value="awaiting_payment">En attente paiement</option>
          <option value="paid">Payées</option>
          <option value="rejected">Refusées</option>
        </select>
      </div>

      {loading ? (
        <div className="alert alert-light border">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="alert alert-light border">Aucune demande pour ce filtre.</div>
      ) : (
        <div className="owner-grid">
          {items.map((b) => (
            <BookingCard key={b.id} b={b} onOpen={() => setActive(b)} />
          ))}
        </div>
      )}

      {/* ✅ Modal simple */}
      {active && (
        <div className="owner-modal-backdrop" onClick={() => setActive(null)}>
          <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="owner-modal-title">{active.listing_title}</div>
            <div className="owner-modal-sub">
              Durée: <b>{active.duration_days} jours</b> · Voyageurs: <b>{active.guests}</b>
            </div>
            <div className="owner-modal-sub">
              Date souhaitée: <b>{active.desired_start_date || "non précisée"}</b>
            </div>

            {active.customer_note ? (
              <div className="owner-note">
                <div className="fw-semibold">Message client</div>
                <div className="small text-muted">{active.customer_note}</div>
              </div>
            ) : null}

            <hr />

            {/* ✅ APPROVE */}
            <div className="fw-semibold mb-2">Accepter</div>
            <div className="small text-muted mb-2">
              Mets une date de début (sinon on prend la date souhaitée du client si elle existe).
            </div>
            <input
              type="date"
              className="form-control mb-2"
              defaultValue={active.desired_start_date || ""}
              id="approveStart"
            />
            <textarea
              className="form-control mb-2"
              rows={2}
              placeholder="Note au client (optionnel)"
              id="approveNote"
            />
            <button
              className="btn btn-dark w-100"
              onClick={() => {
                const sd = document.getElementById("approveStart").value;
                const note = document.getElementById("approveNote").value;
                approve(active.id, sd, note);
              }}
            >
              Valider (le client pourra payer)
            </button>

            <hr />

            {/* ✅ REJECT + proposals */}
            <div className="fw-semibold mb-2">Refuser (déjà pris)</div>
            <textarea
              className="form-control mb-2"
              rows={2}
              placeholder="Raison (optionnel)"
              id="rejectNote"
            />

            {/* <div className="small text-muted mb-2">
              Proposer des dates (facultatif) :
            </div>
            <div className="row g-2 mb-2">
              <div className="col-6">
                <input
                  type="date"
                  className="form-control"
                  value={pStart}
                  onChange={(e) => setPStart(e.target.value)}
                />
              </div>
              <div className="col-6">
                <input
                  type="date"
                  className="form-control"
                  value={pEnd}
                  onChange={(e) => setPEnd(e.target.value)}
                />
              </div>
              <div className="col-12">
                <input
                  className="form-control"
                  value={pNote}
                  onChange={(e) => setPNote(e.target.value)}
                  placeholder="Note (optionnel)"
                />
              </div>
            </div> */}

            <button
              className="btn btn-outline-dark w-100"
              onClick={() => {
                const note = document.getElementById("rejectNote").value;
                reject(active.id, note);
              }}
            >
              Non, c’est déjà pris
            </button>

            <button className="btn btn-light w-100 mt-2" onClick={() => setActive(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
