import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, MapPin } from 'lucide-react';
import { destinationsApi, CI_REGIONS_LABELS } from '../../../utils/destinations';
import './destinations.css';

export default function ExploreCIScreen() {
  const [destinations, setDestinations] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState('');
  const [search, setSearch] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const params = {};
    if (regionFilter) params.region = regionFilter;
    if (search) params.q = search;
    setLoading(true);
    destinationsApi.list(params)
      .then(r => {
        const data = r.data.results || r.data;
        setDestinations(data);
        setFeatured(data.filter(d => d.is_featured).slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [regionFilter, search]);

  return (
    <div className="destinations-screen">
      {/* Hero */}
      <div className="ci-hero">
        <div className="ci-hero-content">
          <h1>{t('destinations.explore')}</h1>
          <p>14 régions, des centaines de merveilles à explorer</p>
          <div className="hero-search">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('destinations.searchPlaceholder')}
              className="hero-search-input"
            />
          </div>
        </div>
      </div>

      {/* Featured */}
      {featured.length > 0 && !regionFilter && !search && (
        <section className="section">
          <h2 className="section-title"><Star size={16} fill="#f59e0b" color="#f59e0b" /> {t('destinations.featured')}</h2>
          <div className="featured-grid">
            {featured.map(dest => (
              <Link key={dest.slug} to={`/destinations/${dest.slug}`} className="featured-card">
                {dest.cover_image && (
                  <img src={dest.cover_image} alt={dest.name} className="featured-img" />
                )}
                <div className="featured-overlay">
                  <h3 className="featured-name">{dest.name}</h3>
                  <p className="featured-region">{CI_REGIONS_LABELS[dest.region] || dest.region}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Regions filter */}
      <section className="section">
        <h2 className="section-title">Filtrer par région</h2>
        <div className="regions-scroll">
          <button
            className={`region-chip ${regionFilter === '' ? 'active' : ''}`}
            onClick={() => setRegionFilter('')}
          >
            {t('destinations.allRegions')}
          </button>
          {Object.entries(CI_REGIONS_LABELS).map(([val, label]) => (
            <button
              key={val}
              className={`region-chip ${regionFilter === val ? 'active' : ''}`}
              onClick={() => setRegionFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Grid */}
      <section className="section">
        <h2 className="section-title">
          {regionFilter ? `${CI_REGIONS_LABELS[regionFilter]} (${destinations.length})` : `Toutes les destinations (${destinations.length})`}
        </h2>

        {loading ? (
          <div className="vlogs-loading"><div className="loading-spinner" /></div>
        ) : destinations.length === 0 ? (
          <p className="no-data">{t('destinations.noResults')}</p>
        ) : (
          <div className="destinations-grid">
            {destinations.map(dest => (
              <Link key={dest.slug} to={`/destinations/${dest.slug}`} className="dest-card">
                <div className="dest-img-wrap">
                  {dest.cover_image ? (
                    <img src={dest.cover_image} alt={dest.name} className="dest-img" />
                  ) : (
                    <div className="dest-img-placeholder"><MapPin size={32} strokeWidth={1.2} color="#ccc" /></div>
                  )}
                </div>
                <div className="dest-info">
                  <h3 className="dest-name">{dest.name}</h3>
                  <p className="dest-region"><MapPin size={11} /> {CI_REGIONS_LABELS[dest.region] || dest.region}</p>
                  {dest.description && (
                    <p className="dest-desc">{dest.description.slice(0, 80)}...</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
