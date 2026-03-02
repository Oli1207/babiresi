import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { adminApi } from "./AdminApi";

const fmt = (x) => Number(x || 0).toLocaleString();

const Toast = Swal.mixin({
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

export default function AdminBookingDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [b, setB] = useState(null);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.bookingDetail(id);
      setB(data);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Impossible de charger le booking" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const overrideStatus = async () => {
    if (!b) return;

    const { value: status } = await Swal.fire({
      title: "Changer le statut",
      input: "select",
      inputOptions: {
        requested: "requested",
        approved: "approved",
        paid: "paid",
        checked_in: "checked_in",
        released: "released",
        cancelled: "cancelled",
        expired: "expired",
      },
      inputValue: b.status,
      showCancelButton: true,
      confirmButtonText: "Valider",
      cancelButtonText: "Annuler",
    });

    if (!status) return;

    const { value: reason } = await Swal.fire({
      title: "Raison (optionnel)",
      input: "text",
      inputPlaceholder: "Ex: litige, correction support...",
      showCancelButton: true,
      confirmButtonText: "Appliquer",
      cancelButtonText: "Annuler",
    });

    try {
      setUpdating(true);
      await adminApi.bookingOverrideStatus(b.id, { status, reason: reason || "" });
      Toast.fire({ icon: "success", title: "Statut mis à jour" });
      await load();
    } catch (e) {
      const apiErr = e?.response?.data;
      console.error(apiErr || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: apiErr?.detail || "Impossible de modifier." });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="admin-card">Chargement...</div>;
  if (!b) return <div className="admin-card">Introuvable</div>;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <button className="btn btn-outline-dark btn-sm" onClick={() => navigate(-1)}>
          ← Retour
        </button>
        <div className="d-flex gap-2">
          <button className="btn btn-dark btn-sm" onClick={load}>Rafraîchir</button>
          <button className="btn btn-primary btn-sm" onClick={overrideStatus} disabled={updating}>
            {updating ? "..." : "Override statut"}
          </button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <div className="admin-card">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h5 className="mb-0">Booking #{b.id}</h5>
                <div className="text-muted small">
                  Créé: {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
                </div>
              </div>
              <span className="badge text-bg-dark">{b.status}</span>
            </div>

            <hr />

            <div className="fw-bold">Résidence</div>
            <div className="mt-1">{b?.listing?.title || "-"}</div>
            <div className="text-muted small">{b?.listing?.city || ""}</div>

            <hr />

            <div className="row g-2">
              <div className="col-6">
                <div className="text-muted small">Acompte</div>
                <div className="fw-bold">{fmt(b.deposit_amount)} FCFA</div>
              </div>
              <div className="col-6">
                <div className="text-muted small">Commission</div>
                <div className="fw-bold">{fmt(b.platform_commission)} FCFA</div>
              </div>
              <div className="col-6">
                <div className="text-muted small">Payout gérant</div>
                <div className="fw-bold">{fmt(b.payout_amount)} FCFA</div>
              </div>
              <div className="col-6">
                <div className="text-muted small">Check-in</div>
                <div className="fw-bold">{b.checked_in_at ? new Date(b.checked_in_at).toLocaleString() : "-"}</div>
              </div>
            </div>
          </div>

          <div className="admin-card mt-3">
            <div className="fw-bold mb-2">Paiements</div>
            {!b.payments || b.payments.length === 0 ? (
              <div className="text-muted small">Aucun</div>
            ) : (
              <div style={{ maxHeight: 240, overflow: "auto" }}>
                {b.payments.map((p) => (
                  <div key={p.id} className="border rounded-3 p-2 mb-2">
                    <div className="d-flex justify-content-between">
                      <b>{p.provider}</b>
                      <span className="text-muted small">{p.created_at ? new Date(p.created_at).toLocaleString() : ""}</span>
                    </div>
                    <div className="small">Ref: {p.reference}</div>
                    <div className="small">Montant: {fmt(p.amount)} · {p.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="admin-card">
            <div className="fw-bold mb-2">Client</div>
            <div className="fw-semibold">{b?.client?.full_name || "-"}</div>
            <div className="text-muted small">{b?.client?.phone || b?.client?.email || ""}</div>

            <hr />

            <div className="fw-bold mb-2">Gérant</div>
            <div className="fw-semibold">{b?.owner?.full_name || "-"}</div>
            <div className="text-muted small">{b?.owner?.phone || b?.owner?.email || ""}</div>

            <hr />

            <div className="fw-bold mb-2">Reversement</div>
            {!b.payout ? (
              <div className="text-muted small">Aucun payout lié (sera créé au check-in)</div>
            ) : (
              <div className="border rounded-3 p-2">
                <div className="d-flex justify-content-between">
                  <span>Status</span>
                  <b>{b.payout.status}</b>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Montant</span>
                  <b>{fmt(b.payout.amount)} FCFA</b>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Référence</span>
                  <b className="text-muted">{b.payout.reference || "-"}</b>
                </div>
              </div>
            )}
          </div>

          <div className="admin-card mt-3">
            <div className="fw-bold mb-2">Réclamations</div>
            {!b.disputes || b.disputes.length === 0 ? (
              <div className="text-muted small">Aucune</div>
            ) : (
              b.disputes.map((d) => (
                <div key={d.id} className="border rounded-3 p-2 mb-2">
                  <div className="d-flex justify-content-between">
                    <b>#{d.id} · {d.status}</b>
                    <span className="text-muted small">{d.created_at ? new Date(d.created_at).toLocaleString() : ""}</span>
                  </div>
                  <div className="small">{d.title}</div>
                </div>
              ))
            )}
          </div>

          <div className="admin-card mt-3">
            <div className="fw-bold mb-2">Audit (booking)</div>
            {!b.audit || b.audit.length === 0 ? (
              <div className="text-muted small">Aucun</div>
            ) : (
              <div style={{ maxHeight: 240, overflow: "auto" }}>
                {b.audit.map((a) => (
                  <div key={a.id} className="border rounded-3 p-2 mb-2">
                    <div className="d-flex justify-content-between">
                      <b style={{ fontSize: 13 }}>{a.action}</b>
                      <span className="text-muted small">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <div className="text-muted small">{a.object_type}:{a.object_id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}