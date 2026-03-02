import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { adminApi } from "./AdminApi";

const Toast = Swal.mixin({
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

export default function AdminDisputesScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);

  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    booking: "",
    q: "",
    date_from: "",
    date_to: "",
    page_size: 25,
  });

  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = async (p = page, f = filters) => {
    try {
      setLoading(true);
      const { data } = await adminApi.disputes({ ...f, page: p });
      setRows(data.results || []);
      setCount(data.count || 0);
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      Toast.fire({ icon: "error", title: "Impossible de charger réclamations" });
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

  const createDispute = async () => {
    const { value: booking_id } = await Swal.fire({
      title: "Booking ID",
      input: "number",
      inputPlaceholder: "Ex: 123",
      showCancelButton: true,
      confirmButtonText: "Suivant",
      cancelButtonText: "Annuler",
    });
    if (!booking_id) return;

    const { value: title } = await Swal.fire({
      title: "Titre",
      input: "text",
      inputValue: "Réclamation",
      showCancelButton: true,
      confirmButtonText: "Suivant",
      cancelButtonText: "Annuler",
    });
    if (!title) return;

    const { value: description } = await Swal.fire({
      title: "Description",
      input: "textarea",
      inputPlaceholder: "Explique le problème…",
      showCancelButton: true,
      confirmButtonText: "Créer",
      cancelButtonText: "Annuler",
    });

    try {
      await adminApi.disputeCreate({
        booking_id: Number(booking_id),
        title,
        description: description || "",
      });
      Toast.fire({ icon: "success", title: "Réclamation créée" });
      load(1);
      setPage(1);
    } catch (e) {
      const apiErr = e?.response?.data;
      console.error(apiErr || e?.message);
      Swal.fire({ icon: "error", title: "Erreur", text: apiErr?.detail || "Impossible." });
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / Number(filters.page_size || 25)));

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">Réclamations</h4>
          <div className="text-muted small">{count} résultat(s)</div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-dark btn-sm" onClick={createDispute}>
            + Créer
          </button>
          <button className="btn btn-dark btn-sm" onClick={() => load(page)}>
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="admin-card mb-3">
        <div className="row g-2">
          <div className="col-12 col-md-2">
            <label className="form-label small">Statut</label>
            <select className="form-select" value={filters.status} onChange={(e) => setF("status", e.target.value)}>
              <option value="">Tous</option>
              <option value="open">open</option>
              <option value="in_review">in_review</option>
              <option value="resolved">resolved</option>
              <option value="rejected">rejected</option>
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small">Priorité</label>
            <select className="form-select" value={filters.priority} onChange={(e) => setF("priority", e.target.value)}>
              <option value="">Toutes</option>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small">Booking</label>
            <input className="form-control" value={filters.booking} onChange={(e) => setF("booking", e.target.value)} placeholder="id" />
          </div>

          <div className="col-12 col-md-3">
            <label className="form-label small">Recherche</label>
            <input className="form-control" value={filters.q} onChange={(e) => setF("q", e.target.value)} placeholder="title, category..." />
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
              <th>Booking</th>
              <th>Titre</th>
              <th>Catégorie</th>
              <th>Priorité</th>
              <th>Statut</th>
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
              rows.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.id}</b></td>
                  <td>#{d.booking_id}</td>
                  <td className="fw-semibold">{d.title}</td>
                  <td className="small text-muted">{d.category}</td>
                  <td><span className="badge text-bg-secondary">{d.priority}</span></td>
                  <td><span className="badge text-bg-dark">{d.status}</span></td>
                  <td className="small text-muted">{d.created_at ? new Date(d.created_at).toLocaleString() : ""}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-dark" onClick={() => navigate(`/admin/disputes/${d.id}`)}>
                      Ouvrir
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
          <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <button className="btn btn-outline-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      </div>
    </div>
  );
}