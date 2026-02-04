import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import "./owner.css";

const fmt = (x) => Number(x || 0).toLocaleString();

const isFinal = (status) =>
  ["rejected", "paid", "checked_in", "released"].includes(status);

const canDecide = (status) =>
  ["requested", "awaiting_payment"].includes(status);

export default function OwnerInboxScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("requested");
  const [active, setActive] = useState(null);

  const todayISO = new Date().toISOString().split("T")[0];

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get(
        `bookings/owner-inbox/?status=${statusFilter}`
      );
      const arr = Array.isArray(data) ? data : data?.results || [];
      setItems(arr);
    } catch (e) {
      console.error(e);
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
        start_date: startDate || null,
        owner_note: ownerNote || "",
      });
      Swal.fire("Acceptée", "Le client peut maintenant payer.", "success");
      setActive(null);
      fetchInbox();
    } catch (e) {
      Swal.fire("Erreur", "Action impossible.", "error");
    }
  };

  const reject = async (bookingId, ownerNote) => {
    try {
      await apiInstance.post(`bookings/${bookingId}/decision/`, {
        action: "reject",
        owner_note: ownerNote || "Déjà pris",
      });
      Swal.fire("Refusée", "Le client a été informé.", "success");
      setActive(null);
      fetchInbox();
    } catch (e) {
      Swal.fire("Erreur", "Action impossible.", "error");
    }
  };

  return (
    <div className="container py-3 owner-inbox-wrap">
      <div className="d-flex justify-content-between mb-3">
        <div>
          <h2>Demandes de réservation</h2>
          <p className="text-muted">Accepte ou refuse avant paiement</p>
        </div>

        <select
          className="form-select"
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
        <div className="alert alert-light border">Aucune demande.</div>
      ) : (
        <div className="owner-grid">
          {items.map((b) => (
            <div
              key={b.id}
              className="owner-card"
              onClick={() => setActive(b)}
            >
              <div className="owner-card-top">
                <div className="owner-title">{b.listing_title}</div>
                <div className={`owner-pill ${b.status}`}>{b.status}</div>
              </div>
              <div className="owner-sub">
                {b.duration_days} jours · {b.guests} pers.
              </div>
              <div className="owner-money">
                Total : <b>{fmt(b.total_amount)} FCFA</b>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {active && (
        <div className="owner-modal-backdrop" onClick={() => setActive(null)}>
          <div className="owner-modal" onClick={(e) => e.stopPropagation()}>
            <h5>{active.listing_title}</h5>

            {/* CLIENT */}
            <div className="border p-2 mb-2 rounded">
              <div className="fw-semibold mb-1">Client</div>
              <div>👤 {active.user_full_name}</div>
              <div>
                📞 <a href={`tel:${active.user_phone}`}>{active.user_phone}</a>
              </div>
              <div>✉️ {active.user_email}</div>
            </div>

            {/* MESSAGE CLIENT */}
            {active.customer_note && (
              <div className="alert alert-light border">
                <b>Message client</b>
                <div className="small">{active.customer_note}</div>
              </div>
            )}

            {/* MODE LECTURE SEULE */}
            {isFinal(active.status) && (
              <div className="alert alert-info">
                Statut : <b>{active.status}</b>
                {active.owner_note && (
                  <div className="small mt-1">
                    Note : <em>{active.owner_note}</em>
                  </div>
                )}
              </div>
            )}

            {/* ACTIONS */}
            {canDecide(active.status) && (
              <>
                <hr />
                <input
                  type="date"
                  className="form-control mb-2"
                  min={todayISO}
                  defaultValue={active.desired_start_date || ""}
                  id="approveStart"
                />
                <textarea
                  className="form-control mb-2"
                  rows={2}
                  placeholder="Note (optionnel)"
                  id="approveNote"
                />
                <button
                  className="btn btn-dark w-100 mb-2"
                  onClick={() => {
                    const sd = document.getElementById("approveStart").value;
                    const note =
                      document.getElementById("approveNote").value;

                    if (!sd && !active.desired_start_date) {
                      return Swal.fire(
                        "Date requise",
                        "Choisissez une date valide.",
                        "warning"
                      );
                    }
                    if (sd && sd < todayISO) {
                      return Swal.fire(
                        "Date invalide",
                        "Date passée interdite.",
                        "warning"
                      );
                    }
                    approve(active.id, sd, note);
                  }}
                >
                  Accepter
                </button>

                <textarea
                  className="form-control mb-2"
                  rows={2}
                  placeholder="Raison du refus"
                  id="rejectNote"
                />
                <button
                  className="btn btn-outline-dark w-100"
                  onClick={() => {
                    const note =
                      document.getElementById("rejectNote").value;
                    reject(active.id, note);
                  }}
                >
                  Refuser
                </button>
              </>
            )}

            <button
              className="btn btn-light w-100 mt-2"
              onClick={() => setActive(null)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
