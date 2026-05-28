import { useEffect, useState } from 'react';
import apiInstance from '../utils/axios';

export default function AdminDestinationsScreen() {
  const [dests, setDests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [creating, setCreating] = useState(false);

  const load = () => {
    apiInstance.get('destinations/admin/')
      .then(r => setDests(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async (id) => {
    try {
      const res = await apiInstance.put(`destinations/admin/${id}/`, form);
      setDests(ds => ds.map(d => d.id === id ? res.data : d));
      setEditId(null);
    } catch {}
  };

  const toggleField = async (id, field, value) => {
    try {
      const res = await apiInstance.put(`destinations/admin/${id}/`, { [field]: value });
      setDests(ds => ds.map(d => d.id === id ? { ...d, ...res.data } : d));
    } catch {}
  };

  if (loading) return <div className="admin-loading">Chargement...</div>;

  return (
    <div>
      <h2 className="admin-section-title">📍 Destinations CI</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Nom</th><th>Région</th><th>Publié</th><th>Featured</th><th>Ordre</th></tr>
        </thead>
        <tbody>
          {dests.map(d => (
            <tr key={d.id}>
              <td>
                {editId === d.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={form.name || d.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ border: '1px solid #ddd', padding: '4px 8px', borderRadius: 6 }} />
                    <button onClick={() => save(d.id)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>✓</button>
                    <button onClick={() => setEditId(null)} style={{ background: '#f0f0f0', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <span style={{ cursor: 'pointer' }} onClick={() => { setEditId(d.id); setForm({ name: d.name, order: d.order }); }}>{d.name}</span>
                )}
              </td>
              <td>{d.region}</td>
              <td>
                <button className={`toggle-small ${d.is_published ? 'on' : 'off'}`} onClick={() => toggleField(d.id, 'is_published', !d.is_published)}>
                  {d.is_published ? '✅' : '❌'}
                </button>
              </td>
              <td>
                <button className={`toggle-small ${d.is_featured ? 'on' : 'off'}`} onClick={() => toggleField(d.id, 'is_featured', !d.is_featured)}>
                  {d.is_featured ? '⭐' : '☆'}
                </button>
              </td>
              <td>{d.order}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
