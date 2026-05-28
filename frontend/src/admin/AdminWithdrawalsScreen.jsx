import { useEffect, useState } from 'react';
import apiInstance from '../utils/axios';

const STATUS_OPTIONS = ['paid', 'failed', 'rejected'];

export default function AdminWithdrawalsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiInstance.get('vlogs/admin/withdrawals/')
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      const res = await apiInstance.patch(`vlogs/admin/withdrawals/${id}/`, { status: newStatus });
      setItems(items.map(i => i.id === id ? res.data : i));
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur');
    }
  };

  const formatFCFA = (n) => new Intl.NumberFormat('fr-CI', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

  if (loading) return <div className="admin-loading">Chargement...</div>;

  return (
    <div>
      <h2 className="admin-section-title">💸 Retraits Points ({items.length} en attente)</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>Points</th>
            <th>FCFA</th>
            <th>Méthode</th>
            <th>Téléphone</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(w => (
            <tr key={w.id}>
              <td>{w.user_email || w.user}</td>
              <td>{w.amount_points}</td>
              <td>{formatFCFA(w.amount_fcfa)}</td>
              <td>{w.method}</td>
              <td>{w.phone_number}</td>
              <td>{new Date(w.created_at).toLocaleDateString('fr-CI')}</td>
              <td>
                <select
                  value={w.status}
                  onChange={e => updateStatus(w.id, e.target.value)}
                  className="admin-select"
                >
                  <option value="pending">pending</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Aucun retrait en attente.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
