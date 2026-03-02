import { useEffect, useState } from "react";
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

export default function AdminDashboardScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminApi.metrics();
      setData(res.data);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Impossible de charger les métriques" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="admin-card">Chargement...</div>;
  }

  if (!data) {
    return <div className="admin-card">Aucune donnée.</div>;
  }

  const money = data.money || {};
  const toHandle = data.to_handle || {};
  const byStatus = data.by_status || {};
  const recent = data.recent_activity || [];

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Dashboard</h4>
          <div className="text-muted small">Supervision en temps réel</div>
        </div>
        <button className="btn btn-dark btn-sm" onClick={load}>
          Rafraîchir
        </button>
      </div>

      <div className="admin-grid mb-3">
        <div className="admin-card">
          <div className="kpi-title">Total encaissé</div>
          <div className="kpi-value">{fmt(money.total_deposit)} FCFA</div>
          <div className="kpi-sub">Bookings payés / check-in / released</div>
        </div>

        <div className="admin-card">
          <div className="kpi-title">Bénéfice plateforme</div>
          <div className="kpi-value">{fmt(money.total_commission)} FCFA</div>
          <div className="kpi-sub">Somme des commissions</div>
        </div>

        <div className="admin-card">
          <div className="kpi-title">À reverser (pending)</div>
          <div className="kpi-value">{fmt(money.pending_payout)} FCFA</div>
          <div className="kpi-sub">Reversements en attente</div>
        </div>

        <div className="admin-card">
          <div className="kpi-title">Réclamations ouvertes</div>
          <div className="kpi-value">{fmt(toHandle.open_disputes)}</div>
          <div className="kpi-sub">Open / in_review</div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="admin-card">
            <div className="fw-bold mb-2">À traiter</div>
            <div className="d-flex justify-content-between py-1">
              <span>Demandes à valider</span>
              <b>{toHandle.awaiting_owner_decision || 0}</b>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span>En attente paiement</span>
              <b>{toHandle.awaiting_payment || 0}</b>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span>En attente remise clés (code)</span>
              <b>{toHandle.awaiting_checkin || 0}</b>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span>En attente reversement</span>
              <b>{toHandle.awaiting_payout || 0}</b>
            </div>

            <hr />

            <div className="fw-bold mb-2">Bookings par statut</div>
            {Object.keys(byStatus).length === 0 ? (
              <div className="text-muted small">Aucun</div>
            ) : (
              Object.entries(byStatus).map(([k, v]) => (
                <div className="d-flex justify-content-between py-1" key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="admin-card">
            <div className="fw-bold mb-2">Activité récente</div>
            {recent.length === 0 ? (
              <div className="text-muted small">Aucune activité</div>
            ) : (
              <div style={{ maxHeight: 420, overflow: "auto" }}>
                {recent.map((a) => (
                  <div key={a.id} className="border rounded-3 p-2 mb-2">
                    <div className="d-flex justify-content-between">
                      <b style={{ fontSize: 13 }}>{a.action}</b>
                      <span className="text-muted small">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <div className="text-muted small">
                      {a.object_type}:{a.object_id}
                    </div>
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