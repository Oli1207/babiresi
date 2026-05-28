import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Video, Compass, Utensils, Zap, Palette,
  MapPin, Eye, Star, Plane, ArrowLeft,
} from 'lucide-react';
import { destinationsApi, CI_REGIONS_LABELS } from '../../../utils/destinations';
import { setSEO } from '../../../utils/seo';
import './destinations.css';

function VlogMini({ vlog }) {
  return (
    <Link to={`/vlogs/${vlog.id}`} className="mini-card">
      <div className="mini-media">
        {vlog.thumbnail_url ? (
          <img src={vlog.thumbnail_url} alt={vlog.title} className="mini-img" />
        ) : (
          <div className="mini-placeholder"><Video size={28} strokeWidth={1.2} color="#bbb" /></div>
        )}
        <span className="mini-views"><Eye size={11} /> {vlog.views_count}</span>
      </div>
      <p className="mini-title">{vlog.title}</p>
    </Link>
  );
}

const SERVICE_ICONS = {
  guide:      <Compass  size={20} strokeWidth={1.4} />,
  restaurant: <Utensils size={20} strokeWidth={1.4} />,
  activity:   <Zap      size={20} strokeWidth={1.4} />,
  artisan:    <Palette  size={20} strokeWidth={1.4} />,
};

function ServiceCard({ item, type }) {
  return (
    <div className="service-mini-card">
      <div className="service-mini-icon">{SERVICE_ICONS[type] || <MapPin size={20} strokeWidth={1.4} />}</div>
      <div className="service-mini-info">
        <h4>{item.user?.full_name || item.name || item.title || 'Service'}</h4>
        {item.rating_avg && (
          <span className="rating-mini"><Star size={11} fill="#f59e0b" color="#f59e0b" /> {item.rating_avg}</span>
        )}
        {item.price_per_person && <span className="price-mini">À partir de {item.price_per_person} FCFA/pers.</span>}
        {item.half_day_price && <span className="price-mini">Demi-journée : {item.half_day_price} FCFA</span>}
      </div>
    </div>
  );
}

export default function DestinationScreen() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [dest, setDest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setLoading(true);
    destinationsApi.detail(slug)
      .then(r => {
        setDest(r.data);
        setSEO({
          title: r.data.name,
          description: r.data.description?.slice(0, 155) || `Découvrez ${r.data.name} en Côte d'Ivoire.`,
          image: r.data.cover_image,
          url: `https://babiresi.com/destinations/${slug}`,
        });
      })
      .catch(() => navigate('/decouvrir'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="destinations-screen"><div className="loading-spinner" /></div>;
  if (!dest) return null;

  const tabs = [
    { key: 'overview',    label: 'Aperçu',                                      Icon: null },
    { key: 'vlogs',       label: `Vlogs (${dest.vlogs?.length || 0})`,           Icon: Video },
    { key: 'guides',      label: `Guides (${dest.guides?.length || 0})`,         Icon: Compass },
    { key: 'restaurants', label: `Restos (${dest.restaurants?.length || 0})`,    Icon: Utensils },
    { key: 'activities',  label: `Activités (${dest.activities?.length || 0})`,  Icon: Zap },
    { key: 'artisans',    label: `Artisans (${dest.artisans?.length || 0})`,     Icon: Palette },
  ];

  return (
    <div className="destinations-screen">
      {/* Hero */}
      <div className="dest-hero" style={dest.cover_image ? { backgroundImage: `url(${dest.cover_image})` } : {}}>
        <div className="dest-hero-overlay">
          <button onClick={() => navigate(-1)} className="btn-back-dest"><ArrowLeft size={14} /> Retour</button>
          <div className="dest-hero-content">
            <h1 className="dest-hero-title">{dest.name}</h1>
            <p className="dest-hero-region"><MapPin size={13} /> {CI_REGIONS_LABELS[dest.region] || dest.region}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dest-tabs-scroll">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`vlog-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.Icon && <t.Icon size={13} strokeWidth={1.8} />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="dest-content">
        {activeTab === 'overview' && (
          <div className="dest-overview">
            {dest.description && (
              <div className="dest-section">
                <h3>À propos</h3>
                <p>{dest.description}</p>
              </div>
            )}
            {dest.practical_info && Object.keys(dest.practical_info).length > 0 && (
              <div className="dest-section">
                <h3>Infos pratiques</h3>
                <div className="practical-info">
                  {Object.entries(dest.practical_info).map(([key, val]) => (
                    <div key={key} className="practical-row">
                      <span className="practical-key">{key}</span>
                      <span className="practical-val">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="dest-cta">
              <Link to={`/voyager?destination=${slug}`} className="btn-plan-trip">
                <Plane size={15} /> Planifier mon séjour ici
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'vlogs' && (
          <div>
            {dest.vlogs?.length === 0 ? (
              <p className="no-data">Pas encore de vlogs pour cette destination.</p>
            ) : (
              <div className="mini-grid">
                {dest.vlogs?.map(v => <VlogMini key={v.id} vlog={v} />)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'guides' && (
          <div>
            {dest.guides?.length === 0 ? <p className="no-data">Pas de guides disponibles.</p> : (
              dest.guides?.map(g => <ServiceCard key={g.id} item={g} type="guide" />)
            )}
          </div>
        )}

        {activeTab === 'restaurants' && (
          <div>
            {dest.restaurants?.length === 0 ? <p className="no-data">Pas de restaurants répertoriés.</p> : (
              dest.restaurants?.map(r => <ServiceCard key={r.id} item={r} type="restaurant" />)
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <div>
            {dest.activities?.length === 0 ? <p className="no-data">Pas d'activités répertoriées.</p> : (
              dest.activities?.map(a => <ServiceCard key={a.id} item={a} type="activity" />)
            )}
          </div>
        )}

        {activeTab === 'artisans' && (
          <div>
            {dest.artisans?.length === 0 ? <p className="no-data">Pas d'artisans répertoriés.</p> : (
              dest.artisans?.map(a => <ServiceCard key={a.id} item={a} type="artisan" />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
