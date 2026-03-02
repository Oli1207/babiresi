import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function AdminBookingsScreen() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);

  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    status: "",
    q: "",
    city: "",
    owner: "",
    listing: "",
    date_from: "",
    date_to: "",
    ordering: "-created_at",
    page_size: 25,
  });

  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = async (p = page, f = filters) => {
    try {
      setLoading(true);
      const { data } = await adminApi.bookings({ ...f, page: p });
      setRows(data.results || []);
      setCount(data.count || 0);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Impossible de charger bookings" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); setPage(1); }, []);
  useEffect(() => { load(page); }, [page]);

  const onApply = () => {
    setPage(1);
    load(1, filters);
  };

  const totalPages = Math.max(1, Math.ceil(count / Number(filters.page_size || 25)));

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Bookings</h4>
          <div className="text-muted small">{count} résultat(s)</div>
        </div>
        <button className="btn btn-dark btn-sm" onClick={() => load(page)}>
          Rafraîchir
        </button>
      </div>

      <div className="admin-card mb-3">
        <div className="row g-2">
          <div className="col-12 col-md-2">
            <label className="form-label small">Statut</label>
            <select className="form-select" value={filters.status} onChange={(e) => setF("status", e.target.value)}>
              <option value="">Tous</option>
              <option value="requested">requested</option>
              <option value="approved">approved</option>
              <option value="paid">paid</option>
              <option value="checked_in">checked_in</option>
              <option value="released">released</option>
              <option value="cancelled">cancelled</option>
              <option value="expired">expired</option>
            </select>
          </div>

          <div className="col-12 col-md-3">
            <label className="form-label small">Recherche</label>
            <input className="form-control" value={filters.q} onChange={(e) => setF("q", e.target.value)} placeholder="email, tel, titre..." />
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small">Ville</label>
            <input className="form-control" value={filters.city} onChange={(e) => setF("city", e.target.value)} placeholder="Abidjan..." />
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label small">Du</label>
            <input type="date" className="form-control" value={filters.date_from} onChange={(e) => setF("date_from", e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small">Au</label>
            <input type="date" className="form-control" value={filters.date_to} onChange={(e) => setF("date_to", e.target.value)} />
          </div>

          <div className="col-12 col-md-1 d-flex align-items-end">
            <button className="btn btn-primary w-100" onClick={onApply}>
              OK
            </button>
          </div>
        </div>
      </div>

      <div className="admin-table">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Résidence</th>
              <th>Client</th>
              <th>Gérant</th>
              <th>Statut</th>
              <th>Montant</th>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-4">Chargement...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-4 text-muted">Aucun</td></tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.id}</b></td>
                  <td>
                    <div className="fw-semibold">{b?.listing?.title || "-"}</div>
                    <div className="text-muted small">{b?.listing?.city || ""}</div>
                  </td>
                  <td>
                    <div className="fw-semibold">{b?.client?.full_name || "-"}</div>
                    <div className="text-muted small">{b?.client?.phone || b?.client?.email || ""}</div>
                  </td>
                  <td>
                    <div className="fw-semibold">{b?.owner?.full_name || "-"}</div>
                    <div className="text-muted small">{b?.owner?.phone || b?.owner?.email || ""}</div>
                  </td>
                  <td>
                    <span className="badge text-bg-dark">{b.status}</span>
                  </td>
                  <td>
                    <div className="fw-semibold">{fmt(b.deposit_amount)} FCFA</div>
                    <div className="text-muted small">Comm: {fmt(b.platform_commission)} · Payout: {fmt(b.payout_amount)}</div>
                  </td>
                  <td className="small text-muted">
                    {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline-dark" onClick={() => navigate(`/admin/bookings/${b.id}`)}>
                      Détails
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3">
        <div className="text-muted small">Page {page} / {totalPages}</div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </button>
          <button className="btn btn-outline-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}