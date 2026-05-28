import { useEffect, useState } from 'react';
import apiInstance from '../utils/axios';

export default function AdminTravelScreen() {
  const [requests, setRequests] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('requests');

  useEffect(() => {
    Promise.all([
      apiInstance.get('travel/admin/requests/').catch(() => ({ data: [] })),
      apiInstance.get('travel/admin/agencies/').catch(() => ({ data: [] })),
    ]).then(([r, a]) => {
      setRequests(r.data.results || r.data);
      setAgencies(a.data.results || a.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-loading">Chargement...</div>;

  return (
    <div>
      <h2 className="admin-section-title">✈️ Voyages</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className={`toggle-small ${tab === 'requests' ? 'on' : 'off'}`} onClick={() => setTab('requests')}>Demandes ({requests.length})</button>
        <button className={`toggle-small ${tab === 'agencies' ? 'on' : 'off'}`} onClick={() => setTab('agencies')}>Agences ({agencies.length})</button>
      </div>

      {tab === 'requests' && (
        <table className="admin-table">
          <thead>
            <tr><th>Client</th><th>Destination</th><th>Dates</th><th>Statut</th><th>Conseiller</th></tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id}>
                <td>{r.email || r.client_email || r.first_name}</td>
                <td>{r.destination_free_text || 'CI'}</td>
                <td>{r.arrival_date} → {r.departure_date}</td>
                <td><span className={`status-chip status-${r.status}`}>{r.status}</span></td>
                <td>{r.consultant_name || '—'}</td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Aucune demande.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'agencies' && (
        <table className="admin-table">
          <thead>
            <tr><th>Agence</th><th>Vérifiée</th><th>Active</th><th>Note</th><th>Leads</th></tr>
          </thead>
          <tbody>
            {agencies.map(a => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.is_verified ? '✅' : '❌'}</td>
                <td>{a.is_active ? '✅' : '❌'}</td>
                <td>{a.rating_avg ? Number(a.rating_avg).toFixed(1) : '—'}</td>
                <td>{a.active_leads_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
