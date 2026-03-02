import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "./AdminApi";

const fmt = (x) => Number(x || 0).toLocaleString();
const Toast = Swal.mixin({ toast:true, position:"top", showConfirmButton:false, timer:2200, timerProgressBar:true });

export default function AdminStatsProfitScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
  });
  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminApi.statsProfit(filters);
      setData(res.data);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Stats profit indisponibles" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Stats · Bénéfice plateforme</h4>
          <div className="text-muted small">Par période</div>
        </div>
        <button className="btn btn-dark btn-sm" onClick={load}>Rafraîchir</button>
      </div>

      <div className="admin-card mb-3">
        <div className="row g-2">
          <div className="col-6 col-md-3">
            <label className="form-label small">Du</label>
            <input type="date" className="form-control" value={filters.date_from} onChange={(e)=>setF("date_from", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small">Au</label>
            <input type="date" className="form-control" value={filters.date_to} onChange={(e)=>setF("date_to", e.target.value)} />
          </div>
          <div className="col-12 col-md-6 d-flex align-items-end">
            <button className="btn btn-primary w-100" onClick={load}>OK</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="admin-card">Chargement...</div>
      ) : !data ? (
        <div className="admin-card">Aucune donnée</div>
      ) : (
        <div className="admin-grid">
          <div className="admin-card">
            <div className="kpi-title">Bookings</div>
            <div className="kpi-value">{fmt(data.bookings)}</div>
          </div>

          <div className="admin-card">
            <div className="kpi-title">Total encaissé</div>
            <div className="kpi-value">{fmt(data.total_deposit)} FCFA</div>
          </div>

          <div className="admin-card">
            <div className="kpi-title">Bénéfice plateforme</div>
            <div className="kpi-value">{fmt(data.platform_profit_commission)} FCFA</div>
            <div className="kpi-sub">Somme commissions</div>
          </div>

          <div className="admin-card">
            <div className="kpi-title">Payout gérants</div>
            <div className="kpi-value">{fmt(data.total_payout_to_owners)} FCFA</div>
            <div className="kpi-sub">Versés + à verser (booking)</div>
          </div>

          <div className="admin-card">
            <div className="kpi-title">Pending payouts</div>
            <div className="kpi-value">{fmt(data.pending_payout)} FCFA</div>
          </div>

          <div className="admin-card">
            <div className="kpi-title">Paid payouts</div>
            <div className="kpi-value">{fmt(data.paid_payout)} FCFA</div>
          </div>
        </div>
      )}
    </div>
  );
}