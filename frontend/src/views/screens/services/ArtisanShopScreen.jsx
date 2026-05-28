import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { servicesApi, formatFCFA } from '../../../utils/services';
import { setSEO } from '../../../utils/seo';
import './services.css';

export default function ArtisanShopScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const [artisan, setArtisan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(null);
  const [orderForm, setOrderForm] = useState({ quantity: 1, delivery_type: 'local_abidjan', delivery_address: '', note: '' });
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    servicesApi.artisanDetail(id)
      .then(r => {
        setArtisan(r.data);
        setSEO({
          title: r.data.user_name,
          description: r.data.bio?.slice(0, 155) || `Artisan ivoirien — ${r.data.craft_type}. Découvrez ses créations sur Babiresi.`,
          image: r.data.photo,
          url: `https://babiresi.com/services/artisans/${id}`,
        });
      })
      .catch(() => navigate('/services'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleOrder = async (product) => {
    if (!isLoggedIn()) return navigate('/login');
    setFeedback('');
    try {
      await servicesApi.placeOrder({
        product: product.id,
        quantity: orderForm.quantity,
        delivery_type: orderForm.delivery_type,
        delivery_address: orderForm.delivery_address,
        note: orderForm.note,
      });
      setFeedback('✅ Commande envoyée ! L\'artisan vous contactera sous 24h.');
      setOrdering(null);
    } catch (err) {
      setFeedback(err.response?.data?.detail || 'Erreur. Réessaie.');
    }
  };

  if (loading) return <div className="services-screen"><div className="loading-spinner" /></div>;
  if (!artisan) return null;

  return (
    <div className="services-screen">
      {/* Header artisan */}
      <div className="artisan-header">
        <button onClick={() => navigate(-1)} className="btn-back-service">← Retour</button>
        <div className="artisan-profile">
          {artisan.photo ? (
            <img src={artisan.photo} alt={artisan.user_name} className="artisan-avatar" />
          ) : (
            <div className="artisan-avatar-placeholder">🎨</div>
          )}
          <div>
            <h1>{artisan.user_name}</h1>
            <p>{artisan.craft_type}</p>
            {artisan.made_in_ci_badge && <span className="cert-badge">🇨🇮 Made in CI</span>}
            {artisan.rating_avg && <span className="stars">⭐ {artisan.rating_avg}</span>}
          </div>
        </div>
        {artisan.story && <p className="artisan-story">{artisan.story}</p>}
      </div>

      {feedback && (
        <div className={`form-${feedback.startsWith('✅') ? 'success' : 'error'}`} style={{ margin: '16px 0' }}>
          {feedback}
        </div>
      )}

      {/* Products */}
      <h2 style={{ marginTop: 24, marginBottom: 16 }}>Créations ({artisan.products?.length || 0})</h2>
      {(!artisan.products || artisan.products.length === 0) ? (
        <p className="no-data">Pas encore de produits.</p>
      ) : (
        <div className="products-grid">
          {artisan.products.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-img-wrap">
                {product.images?.[0]?.image ? (
                  <img src={product.images[0].image} alt={product.name} className="product-img" />
                ) : (
                  <div className="product-img-placeholder">🎨</div>
                )}
                {product.made_to_order && <span className="made-to-order-badge">Sur commande</span>}
                {product.stock === 0 && !product.made_to_order && <span className="out-of-stock-badge">Épuisé</span>}
              </div>
              <div className="product-info">
                <h3>{product.name}</h3>
                <p className="product-desc">{product.description?.slice(0, 80)}</p>
                <div className="product-footer">
                  <span className="product-price">{formatFCFA(product.price_fcfa)}</span>
                  {product.made_to_order && (
                    <small>⏱ {product.production_time_days}j de fabrication</small>
                  )}
                </div>
                {(product.stock > 0 || product.made_to_order) && (
                  ordering === product.id ? (
                    <div className="order-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Qté</label>
                          <input type="number" min={1} value={orderForm.quantity} onChange={e => setOrderForm(f => ({ ...f, quantity: e.target.value }))} className="form-input" />
                        </div>
                        <div className="form-group">
                          <label>Livraison</label>
                          <select value={orderForm.delivery_type} onChange={e => setOrderForm(f => ({ ...f, delivery_type: e.target.value }))} className="form-input">
                            <option value="local_abidjan">Abidjan</option>
                            <option value="national">National</option>
                            <option value="international">International</option>
                          </select>
                        </div>
                      </div>
                      <input type="text" value={orderForm.delivery_address} onChange={e => setOrderForm(f => ({ ...f, delivery_address: e.target.value }))} placeholder="Adresse de livraison" className="form-input" style={{ marginBottom: 8 }} />
                      <textarea value={orderForm.note} onChange={e => setOrderForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (couleur, taille, personnalisation...)" rows={2} className="form-input" style={{ marginBottom: 8 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleOrder(product)} className="btn-order">Commander</button>
                        <button onClick={() => setOrdering(null)} className="btn-cancel-service">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setOrdering(product.id)} className="btn-order">Commander</button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
