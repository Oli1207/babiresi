import { useEffect, useState } from 'react';
import apiInstance from '../utils/axios';

export default function AdminVlogsScreen() {
  const [vlogs, setVlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiInstance.get('vlogs/admin/vlogs/')
      .then(r => setVlogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id, field, value) => {
    try {
      const res = await apiInstance.patch(`vlogs/admin/vlogs/${id}/`, { [field]: value });
      setVlogs(vs => vs.map(v => v.id === id ? { ...v, ...res.data } : v));
    } catch {}
  };

  if (loading) return <div className="admin-loading">Chargement...</div>;

  return (
    <div>
      <h2 className="admin-section-title">🎬 Modération Vlogs</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Auteur</th>
            <th>Vues</th>
            <th>Likes</th>
            <th>Publié</th>
            <th>Featured</th>
          </tr>
        </thead>
        <tbody>
          {vlogs.map(v => (
            <tr key={v.id}>
              <td style={{ maxWidth: 200 }}>{v.title}</td>
              <td>{v.author_name}</td>
              <td>{v.views_count}</td>
              <td>{v.likes_count}</td>
              <td>
                <button
                  className={`toggle-small ${v.is_published ? 'on' : 'off'}`}
                  onClick={() => toggle(v.id, 'is_published', !v.is_published)}
                >
                  {v.is_published ? '✅' : '❌'}
                </button>
              </td>
              <td>
                <button
                  className={`toggle-small ${v.is_featured ? 'on' : 'off'}`}
                  onClick={() => toggle(v.id, 'is_featured', !v.is_featured)}
                >
                  {v.is_featured ? '⭐' : '☆'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
