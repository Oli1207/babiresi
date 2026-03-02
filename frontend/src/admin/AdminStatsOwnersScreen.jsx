import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "./AdminApi";

const fmt = (x) => Number(x || 0).toLocaleString();
const Toast = Swal.mixin({ toast:true, position:"top", showConfirmButton:false, timer:2200, timerProgressBar:true });

export default function AdminStatsOwnersScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    owner: "",
    listing: "",
    include_listings: "1",
  });

  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.statsOwners(filters);
      setRows(data.results || []);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Stats owners indisponibles" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Stats · Gérants</h4>
          <div className="text-muted small">Gains par période</div>
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
          <div className="col-6 col-md-2">
            <label className="form-label small">Owner ID</label>
            <input className="form-control" value={filters.owner} onChange={(e)=>setF("owner", e.target.value)} placeholder="ex: 12" />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small">Listing ID</label>
            <input className="form-control" value={filters.listing} onChange={(e)=>setF("listing", e.target.value)} placeholder="ex: 55" />
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label small">Top résidences</label>
            <select className="form-select" value={filters.include_listings} onChange={(e)=>setF("include_listings", e.target.value)}>
              <option value="1">Oui</option>
              <option value="0">Non</option>
            </select>
          </div>
          <div className="col-12 col-md-2 d-flex align-items-end">
            <button className="btn btn-primary w-100" onClick={load}>OK</button>
          </div>
        </div>
      </div>

      <div className="admin-table">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Gérant</th>
              <th>Bookings</th>
              <th>Encaissé</th>
              <th>Commission</th>
              <th>Payout</th>
              <th>Dernier</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-4">Chargement...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-4 text-muted">Aucun</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.owner_id}>
                  <td>
                    <div className="fw-semibold">{r.owner_full_name || `#${r.owner_id}`}</div>
                    <div className="text-muted small">{r.owner_phone || r.owner_email || ""}</div>
                  </td>
                  <td className="fw-semibold">{r.bookings}</td>
                  <td className="fw-semibold">{fmt(r.total_deposit)} FCFA</td>
                  <td className="fw-semibold">{fmt(r.total_commission)} FCFA</td>
                  <td className="fw-semibold">{fmt(r.total_payout)} FCFA</td>
                  <td className="small text-muted">{r.last_booking ? new Date(r.last_booking).toLocaleString() : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && rows.some((x) => Array.isArray(x.top_listings) && x.top_listings.length) && (
        <div className="admin-card mt-3">
          <div className="fw-bold mb-2">Top résidences (par gérant)</div>
          {rows.slice(0, 10).map((r) => (
            r.top_listings?.length ? (
              <div key={r.owner_id} className="border rounded-3 p-2 mb-2">
                <div className="fw-semibold">{r.owner_full_name || `#${r.owner_id}`}</div>
                <div className="small text-muted mb-2">Top 10</div>
                <div className="row g-2">
                  {r.top_listings.map((t) => (
                    <div key={t.listing_id} className="col-12 col-md-6">
                      <div className="border rounded-3 p-2">
                        <div className="fw-semibold">{t.listing__title}</div>
                        <div className="text-muted small">{t.listing__city}</div>
                        <div className="small">Bookings: <b>{t.bookings}</b></div>
                        <div className="small">Payout: <b>{fmt(t.total_payout)} FCFA</b></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}