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

export default function AdminPayoutsScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);

  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState(null);

  const [filters, setFilters] = useState({
    status: "pending",
    owner: "",
    booking: "",
    date_from: "",
    date_to: "",
    page_size: 25,
    ordering: "-created_at",
  });

  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = async (p = page, f = filters) => {
    try {
      setLoading(true);
      const { data } = await adminApi.payouts({ ...f, page: p });
      setRows(data.results || []);
      setCount(data.count || 0);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Impossible de charger reversements" });
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

  const markPaid = async (p) => {
    const { value: reference } = await Swal.fire({
      title: "Référence / preuve",
      input: "text",
      inputPlaceholder: "Ex: TXN123 / capture...",
      showCancelButton: true,
      confirmButtonText: "Marquer payé",
      cancelButtonText: "Annuler",
    });

    if (!reference) return;

    try {
      setUpdatingId(p.id);
      await adminApi.payoutMarkPaid(p.id, { reference });
      Toast.fire({ icon: "success", title: "Reversement payé" });
      await load(page);
    } catch (e) {
      const apiErr = e?.response?.data;
      console.error(apiErr || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: apiErr?.detail || "Impossible." });
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / Number(filters.page_size || 25)));

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Reversements</h4>
          <div className="text-muted small">{count} résultat(s)</div>
        </div>
        <button className="btn btn-dark btn-sm" onClick={() => load(page)}>Rafraîchir</button>
      </div>

      <div className="admin-card mb-3">
        <div className="row g-2">
          <div className="col-12 col-md-2">
            <label className="form-label small">Statut</label>
            <select className="form-select" value={filters.status} onChange={(e) => setF("status", e.target.value)}>
              <option value="">Tous</option>
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="failed">failed</option>
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small">Owner ID</label>
            <input className="form-control" value={filters.owner} onChange={(e) => setF("owner", e.target.value)} placeholder="ex: 12" />
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small">Booking ID</label>
            <input className="form-control" value={filters.booking} onChange={(e) => setF("booking", e.target.value)} placeholder="ex: 55" />
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label small">Du</label>
            <input type="date" className="form-control" value={filters.date_from} onChange={(e) => setF("date_from", e.target.value)} />
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label small">Au</label>
            <input type="date" className="form-control" value={filters.date_to} onChange={(e) => setF("date_to", e.target.value)} />
          </div>

          <div className="col-12 col-md-2 d-flex align-items-end">
            <button className="btn btn-primary w-100" onClick={onApply}>OK</button>
          </div>
        </div>
      </div>

      <div className="admin-table">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Booking</th>
              <th>Owner</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Référence</th>
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
              rows.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.id}</b></td>
                  <td>#{p.booking_id}</td>
                  <td>{p.owner_id || "-"}</td>
                  <td className="fw-semibold">{fmt(p.amount)} FCFA</td>
                  <td><span className="badge text-bg-dark">{p.status}</span></td>
                  <td className="small text-muted">{p.reference || "-"}</td>
                  <td className="small text-muted">{p.created_at ? new Date(p.created_at).toLocaleString() : ""}</td>
                  <td>
                    {p.status !== "paid" ? (
                      <button
                        className="btn btn-sm btn-outline-dark"
                        onClick={() => markPaid(p)}
                        disabled={updatingId === p.id}
                      >
                        {updatingId === p.id ? "..." : "Marquer payé"}
                      </button>
                    ) : (
                      <span className="text-muted small">OK</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3">
        <div className="text-muted small">Page {page} / {Math.max(1, Math.ceil(count / (filters.page_size || 25)))}</div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <button className="btn btn-outline-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      </div>
    </div>
  );
}