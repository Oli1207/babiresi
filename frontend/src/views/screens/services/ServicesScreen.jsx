import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Compass, Utensils, Zap, Car, Palette,
  Star, Clock, Users, Search,
} from 'lucide-react';
import { servicesApi, formatFCFA, RESTAURANT_CATEGORIES, VEHICLE_TYPES } from '../../../utils/services';
import './services.css';

function StarRating({ value }) {
  if (!value) return null;
  const stars = Math.round(value);
  return (
    <span className="stars">
      {Array.from({ length: stars }).map((_, i) => (
        <Star key={i} size={12} fill="#f59e0b" color="#f59e0b" />
      ))}
      <span className="rating-num">{Number(value).toFixed(1)}</span>
    </span>
  );
}

function GuideCard({ guide }) {
  return (
    <Link to={`/services/guides/${guide.id}`} className="service-card">
      <div className="service-card-img">
        {guide.user_photo
          ? <img src={guide.user_photo} alt="" />
          : <div className="service-card-avatar"><Compass size={28} strokeWidth={1.4} /></div>
        }
        {guide.is_anglophone_certified && <span className="cert-badge">Certified</span>}
      </div>
      <div className="service-card-body">
        <h3>{guide.user_name || 'Guide'}</h3>
        <StarRating value={guide.rating_avg} />
        <div className="service-card-tags">
          {guide.languages?.slice(0, 3).map(l => <span key={l} className="tag">{l}</span>)}
        </div>
        <div className="service-card-price">À partir de {formatFCFA(guide.half_day_price || 0)}</div>
      </div>
    </Link>
  );
}

function RestaurantCard({ r }) {
  return (
    <Link to={`/services/restaurants/${r.id}`} className="service-card">
      <div className="service-card-img">
        {r.cover_image
          ? <img src={r.cover_image} alt={r.name} />
          : <div className="service-card-avatar"><Utensils size={28} strokeWidth={1.4} /></div>
        }
        <span className="category-badge">{RESTAURANT_CATEGORIES[r.category] || r.category}</span>
      </div>
      <div className="service-card-body">
        <h3>{r.name}</h3>
        <StarRating value={r.rating_avg} />
        <p className="service-card-desc">{r.address}</p>
        <span className="price-range-badge">{r.price_range}</span>
      </div>
    </Link>
  );
}

function ActivityCard({ a }) {
  return (
    <Link to={`/services/activities/${a.id}`} className="service-card">
      <div className="service-card-img">
        {a.cover_image
          ? <img src={a.cover_image} alt={a.title} />
          : <div className="service-card-avatar"><Zap size={28} strokeWidth={1.4} /></div>
        }
      </div>
      <div className="service-card-body">
        <h3>{a.title}</h3>
        <StarRating value={a.rating_avg} />
        <p className="service-card-desc">
          <Clock size={11} /> {a.duration_hours}h
          &nbsp;·&nbsp;
          <Users size={11} /> {a.min_persons}-{a.max_persons} pers.
        </p>
        <div className="service-card-price">{formatFCFA(a.price_per_person)}/pers.</div>
      </div>
    </Link>
  );
}

function DriverCard({ d }) {
  const vehicle = d.vehicles?.[0];
  return (
    <Link to={`/services/drivers/${d.id}`} className="service-card">
      <div className="service-card-img">
        {vehicle?.photo
          ? <img src={vehicle.photo} alt="" />
          : <div className="service-card-avatar"><Car size={28} strokeWidth={1.4} /></div>
        }
      </div>
      <div className="service-card-body">
        <h3>{d.user_name || 'Chauffeur'}</h3>
        <StarRating value={d.rating_avg} />
        {vehicle && (
          <p className="service-card-desc">
            {VEHICLE_TYPES[vehicle.type] || vehicle.type} · {vehicle.brand} {vehicle.model}
          </p>
        )}
        {vehicle && (
          <div className="service-card-price">
            Avec chauffeur : {formatFCFA(vehicle.price_per_day_with_driver)}/j
          </div>
        )}
      </div>
    </Link>
  );
}

function ArtisanCard({ a }) {
  return (
    <Link to={`/services/artisans/${a.id}`} className="service-card">
      <div className="service-card-img">
        {a.photo
          ? <img src={a.photo} alt={a.user_name} />
          : <div className="service-card-avatar"><Palette size={28} strokeWidth={1.4} /></div>
        }
        {a.made_in_ci_badge && <span className="cert-badge">Made in CI</span>}
      </div>
      <div className="service-card-body">
        <h3>{a.user_name}</h3>
        <StarRating value={a.rating_avg} />
        <p className="service-card-desc">{a.craft_type}</p>
        {a.products_count > 0 && <span className="tag">{a.products_count} créations</span>}
      </div>
    </Link>
  );
}

const TAB_ICONS = {
  guides:      <Compass  size={14} strokeWidth={1.8} />,
  restaurants: <Utensils size={14} strokeWidth={1.8} />,
  activities:  <Zap      size={14} strokeWidth={1.8} />,
  drivers:     <Car      size={14} strokeWidth={1.8} />,
  artisans:    <Palette  size={14} strokeWidth={1.8} />,
};

export default function ServicesScreen() {
  const [activeTab, setActiveTab] = useState('guides');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { t } = useTranslation();

  const TABS = [
    { key: 'guides',      label: t('services.guides') },
    { key: 'restaurants', label: t('services.restaurants') },
    { key: 'activities',  label: t('services.activities') },
    { key: 'drivers',     label: t('services.drivers') },
    { key: 'artisans',    label: t('services.artisans') },
  ];

  const load = async (tab, q = '') => {
    setLoading(true);
    const params = q ? { q } : {};
    try {
      let res;
      if (tab === 'guides')      res = await servicesApi.guides(params);
      else if (tab === 'restaurants') res = await servicesApi.restaurants(params);
      else if (tab === 'activities')  res = await servicesApi.activities(params);
      else if (tab === 'drivers')     res = await servicesApi.drivers(params);
      else if (tab === 'artisans')    res = await servicesApi.artisans(params);
      setData(res.data.results || res.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(activeTab, search); }, [activeTab]);

  const handleSearch = (e) => {
    e.preventDefault();
    load(activeTab, search);
  };

  return (
    <div className="services-screen">
      <div className="services-header">
        <h1>{t('services.title')}</h1>
        <p>Guides certifiés, restaurants authentiques, activités inoubliables</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="services-search">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`${t('common.search')}...`}
          className="services-search-input"
        />
        <button type="submit" className="services-search-btn">
          <Search size={16} />
        </button>
      </form>

      {/* Tabs */}
      <div className="vlogs-tabs" style={{ marginBottom: 20 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`vlog-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setSearch(''); }}
          >
            {TAB_ICONS[tab.key]}
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="vlogs-loading"><div className="loading-spinner" /></div>
      ) : data.length === 0 ? (
        <p className="no-data">{t('services.noServices')}</p>
      ) : (
        <div className="services-grid">
          {activeTab === 'guides'      && data.map(g => <GuideCard      key={g.id} guide={g} />)}
          {activeTab === 'restaurants' && data.map(r => <RestaurantCard key={r.id} r={r} />)}
          {activeTab === 'activities'  && data.map(a => <ActivityCard   key={a.id} a={a} />)}
          {activeTab === 'drivers'     && data.map(d => <DriverCard     key={d.id} d={d} />)}
          {activeTab === 'artisans'    && data.map(a => <ArtisanCard    key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}
