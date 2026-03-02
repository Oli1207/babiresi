import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "./AdminApi";

const Toast = Swal.mixin({
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

export default function AdminAuditScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    action: "",
    object_type: "",
    object_id: "",
    actor: "",
    date_from: "",
    date_to: "",
    page_size: 25,
  });

  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = async (p = page) => {
    try {
      setLoading(true);
      const { data } = await adminApi.audit({ ...filters, page: p });
      setRows(data.results || []);
      setCount(data.count || 0);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Impossible de charger audit" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); setPage(1); }, []);
  useEffect(() => { load(page); }, [page]);

  const onApply = () => {
    setPage(1);
    load(1);
  };

  const totalPages = Math.max(1, Math.ceil(count / Number(filters.page_size || 25)));

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Audit</h4>
          <div className="text-muted small">{count} résultat(s)</div>
        </div>
        <button className="btn btn-dark btn-sm" onClick={() => load(page)}>Rafraîchir</button>
      </div>

      <div className="admin-card mb-3">
        <div className="row g-2">
          <div className="col-12 col-md-3">
            <label className="form-label small">Action</label>
            <input className="form-control" value={filters.action} onChange={(e) => setF("action", e.target.value)} placeholder="BOOKING_STATUS..." />
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label small">Object type</label>
            <input className="form-control" value={filters.object_type} onChange={(e) => setF("object_type", e.target.value)} placeholder="Booking / Payout..." />
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label small">Object id</label>
            <input className="form-control" value={filters.object_id} onChange={(e) => setF("object_id", e.target.value)} placeholder="id" />
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label small">Actor</label>
            <input className="form-control" value={filters.actor} onChange={(e) => setF("actor", e.target.value)} placeholder="user id" />
          </div>
          <div className="col-6 col-md-1">
            <label className="form-label small">Du</label>
            <input type="date" className="form-control" value={filters.date_from} onChange={(e) => setF("date_from", e.target.value)} />
          </div>
          <div className="col-6 col-md-1">
            <label className="form-label small">Au</label>
            <input type="date" className="form-control" value={filters.date_to} onChange={(e) => setF("date_to", e.target.value)} />
          </div>
          <div className="col-12 col-md-1 d-flex align-items-end">
            <button className="btn btn-primary w-100" onClick={onApply}>OK</button>
          </div>
        </div>
      </div>

      <div className="admin-table">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Action</th>
              <th>Objet</th>
              <th>Actor</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-4">Chargement...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-4 text-muted">Aucun</td></tr>
            ) : (
              rows.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.id}</b></td>
                  <td className="fw-semibold">{a.action}</td>
                  <td className="small text-muted">{a.object_type}:{a.object_id}</td>
                  <td className="small text-muted">{a.actor_id || "-"}</td>
                  <td className="small text-muted">{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3">
        <div className="text-muted small">Page {page} / {totalPages}</div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <button className="btn btn-outline-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      </div>
    </div>
  );
}