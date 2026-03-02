import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "./AdminApi";

const fmt = (x) => Number(x || 0).toLocaleString();
const Toast = Swal.mixin({ toast:true, position:"top", showConfirmButton:false, timer:2200, timerProgressBar:true });

export default function AdminStatsTopListingsScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    city: "",
    limit: 10,
  });
  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.statsTopListings(filters);
      setRows(data.results || []);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Stats top listings indisponibles" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Stats · Top résidences</h4>
          <div className="text-muted small">Par période + montants</div>
        </div>
        <button className="btn btn-dark btn-sm" onClick={load}>Rafraîchir</button>
      </div>

      <div className="admin-card mb-3">
        <div className="row g-2">
          <div className="col-6 col-md-2">
            <label className="form-label small">Du</label>
            <input type="date" className="form-control" value={filters.date_from} onChange={(e)=>setF("date_from", e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small">Au</label>
            <input type="date" className="form-control" value={filters.date_to} onChange={(e)=>setF("date_to", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small">Ville (optionnel)</label>
            <input className="form-control" value={filters.city} onChange={(e)=>setF("city", e.target.value)} placeholder="Abidjan..." />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small">Limit</label>
            <input type="number" min="1" max="100" className="form-control" value={filters.limit} onChange={(e)=>setF("limit", e.target.value)} />
          </div>
          <div className="col-12 col-md-3 d-flex align-items-end">
            <button className="btn btn-primary w-100" onClick={load}>OK</button>
          </div>
        </div>
      </div>

      <div className="admin-table">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Résidence</th>
              <th>Ville</th>
              <th>Bookings</th>
              <th>Encaissé</th>
              <th>Commission</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-4">Chargement...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-4 text-muted">Aucun</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.listing_id}>
                  <td>
                    <div className="fw-semibold">{r.listing__title}</div>
                    <div className="text-muted small">Owner: {r.listing__author__full_name || `#${r.listing__author_id}`}</div>
                  </td>
                  <td className="text-muted small">{r.listing__city}</td>
                  <td className="fw-semibold">{r.bookings}</td>
                  <td className="fw-semibold">{fmt(r.total_deposit)} FCFA</td>
                  <td className="fw-semibold">{fmt(r.total_commission)} FCFA</td>
                  <td className="fw-semibold">{fmt(r.total_payout)} FCFA</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}