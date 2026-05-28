import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { vlogsApi } from '../../utils/vlogs';
import { destinationsApi } from '../../utils/destinations';
import './PortalBanner.css';

export default function PortalBanner() {
  const [featuredVlogs, setFeaturedVlogs] = useState([]);
  const [featuredDests, setFeaturedDests] = useState([]);
  const { t } = useTranslation();

  useEffect(() => {
    vlogsApi.featured().then(r => setFeaturedVlogs(r.data.slice(0, 4))).catch(() => {});
    destinationsApi.list({ featured: true }).then(r => setFeaturedDests((r.data.results || r.data).slice(0, 4))).catch(() => {});
  }, []);

  return (
    <div className="portal-banner">
      {/* Hero */}
      <div className="portal-hero">
        <div className="portal-hero-content">
          <h1>{t('home.heroTitle')} 🇨🇮</h1>
          <p>{t('home.heroSubtitle')}</p>
          <div className="portal-hero-actions">
            <Link to="/voyager" className="portal-cta-primary">✈️ {t('home.planTrip')}</Link>
            <Link to="/decouvrir" className="portal-cta-secondary">🌍 {t('home.exploreBtn')}</Link>
          </div>
        </div>
      </div>

      {/* Pillars */}
      <div className="portal-pillars">
        <Link to="/decouvrir" className="pillar-card">
          <span className="pillar-icon">🌍</span>
          <h3>{t('home.pillars.discover')}</h3>
          <p>{t('home.pillars.discoverDesc')}</p>
        </Link>
        <Link to="/vlogs" className="pillar-card">
          <span className="pillar-icon">🎬</span>
          <h3>{t('nav.vlogs')}</h3>
          <p>Contenu local authentique + gagne des points</p>
        </Link>
        <Link to="/services" className="pillar-card">
          <span className="pillar-icon">🛎</span>
          <h3>{t('home.pillars.experience')}</h3>
          <p>{t('home.pillars.experienceDesc')}</p>
        </Link>
        <Link to="/voyager" className="pillar-card pillar-featured">
          <span className="pillar-icon">✈️</span>
          <h3>{t('home.pillars.stay')}</h3>
          <p>{t('home.pillars.stayDesc')}</p>
        </Link>
      </div>

      {/* Featured Vlogs */}
      {featuredVlogs.length > 0 && (
        <section className="portal-section">
          <div className="portal-section-header">
            <h2>🎬 {t('home.featuredVlogs')}</h2>
            <Link to="/vlogs" className="see-all">{t('common.viewAll')} →</Link>
          </div>
          <div className="portal-vlogs-row">
            {featuredVlogs.map(v => (
              <Link key={v.id} to={`/vlogs/${v.id}`} className="portal-vlog-card">
                <div className="portal-vlog-thumb">
                  {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} /> : <div className="portal-vlog-placeholder">🎬</div>}
                  <span className="portal-vlog-views">👁 {v.views_count}</span>
                </div>
                <p className="portal-vlog-title">{v.title}</p>
                <p className="portal-vlog-author">@{v.author_name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Destinations */}
      {featuredDests.length > 0 && (
        <section className="portal-section">
          <div className="portal-section-header">
            <h2>📍 {t('home.featuredDests')}</h2>
            <Link to="/decouvrir" className="see-all">{t('destinations.explore')} →</Link>
          </div>
          <div className="portal-dest-row">
            {featuredDests.map(d => (
              <Link key={d.slug} to={`/destinations/${d.slug}`} className="portal-dest-card">
                {d.cover_image ? <img src={d.cover_image} alt={d.name} className="portal-dest-img" /> : <div className="portal-dest-placeholder">🏞️</div>}
                <div className="portal-dest-overlay">
                  <span>{d.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Divider before listings */}
      <div className="portal-divider">
        <h2>🏠 Hébergements disponibles</h2>
      </div>
    </div>
  );
}
