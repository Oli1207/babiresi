import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Layers, Video, Home, Zap, Utensils, Compass, Palette,
  ArrowRight, X, Eye, Heart, MapPin, Star,
} from 'lucide-react';
import { fetchMapPins, boundsKey, fmtFCFA } from '../../utils/mapApi';
import ExploreVlogsScreen from './vlogs/ExploreVlogsScreen';
import './home.css';

// ─── Bounds watcher ───────────────────────────────────────────
function BoundsWatcher({ onBoundsChange }) {
  const map = useMapEvents({
    moveend: (e) => onBoundsChange(e.target.getBounds()),
    zoomend: (e) => onBoundsChange(e.target.getBounds()),
  });
  // Fire once on mount for initial fetch
  useEffect(() => {
    onBoundsChange(map.getBounds());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─── Layer config ─────────────────────────────────────────────
const LAYERS = [
  { id: 'all',         labelKey: 'common.all',                Icon: Layers,   color: '#334155' },
  { id: 'vlogs',       labelKey: 'nav.vlogs',                 Icon: Video,    color: '#f97316' },
  { id: 'listings',    labelKey: 'map.layers.stays',          Icon: Home,     color: '#0ea5e9' },
  { id: 'activities',  labelKey: 'services.activities',       Icon: Zap,      color: '#8b5cf6' },
  { id: 'restaurants', labelKey: 'services.restaurantsShort', Icon: Utensils, color: '#ef4444' },
  { id: 'guides',      labelKey: 'services.guides',           Icon: Compass,  color: '#22c55e' },
];

// ─── Custom DivIcons ──────────────────────────────────────────
function makeVlogIcon(thumb) {
  const html = thumb
    ? `<div class="map-pin-vlog" style="background-image:url('${thumb}')"><span class="map-pin-play"></span></div>`
    : `<div class="map-pin-vlog map-pin-vlog-empty"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>`;
  return L.divIcon({ html, className: '', iconSize: [52, 52], iconAnchor: [26, 52] });
}

function makeListingIcon(listing, t) {
  const raw   = listing.title || listing.listing_type || t('listings.fallbackTitle');
  const label = raw.length > 16 ? raw.slice(0, 15) + '…' : raw;
  return L.divIcon({
    html: `<div class="map-pin-price">${label}</div>`,
    className: '',
    iconSize: null,
    iconAnchor: [0, 20],
  });
}

function makeServiceIcon(emoji, color) {
  return L.divIcon({
    html: `<div class="map-pin-service" style="background:${color}">${emoji}</div>`,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });
}

const svgIcon = (paths, color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ACTIVITY_ICON   = () => makeServiceIcon(svgIcon('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', '#fff'), '#8b5cf6');
const RESTAURANT_ICON = () => makeServiceIcon(svgIcon('<path d="M3 11l19-9-9 19-2-8-8-2z"/>', '#fff'), '#ef4444');
const GUIDE_ICON      = () => makeServiceIcon(svgIcon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>', '#fff'), '#22c55e');
const ARTISAN_ICON    = () => makeServiceIcon(svgIcon('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>', '#fff'), '#a16207');

// ─── Drawer content per type ──────────────────────────────────
function DrawerContent({ pin, onClose, onOpenVlogFeed, t }) {
  const navigate = useNavigate();
  if (!pin) return (
    <div className="umap-drawer-empty">
      <MapPin size={24} strokeWidth={1.5} style={{ opacity: .4, margin: '0 auto 8px', display: 'block' }} />
      <p>{t('map.clickPin')}</p>
    </div>
  );

  const { _type: type } = pin;

  if (type === 'vlog') {
    return (
      <div className="umap-drawer-vlog">
        <div className="umap-drawer-vthumb">
          {pin.thumb
            ? <img src={pin.thumb} alt={pin.title} />
            : <div className="umap-drawer-vthumb-empty"><Video size={40} strokeWidth={1.2} color="#555" /></div>
          }
          <div className="umap-drawer-vgrad" />
          <div className="umap-drawer-vinfo">
            <p className="umap-dv-author">@{pin.author_name}</p>
            <h3 className="umap-dv-title">{pin.title}</h3>
            <div className="umap-dv-stats">
              <span><Eye size={12} /> {pin.views_count}</span>
              <span><Heart size={12} /> {pin.likes_count}</span>
              {pin.city && <span><MapPin size={12} /> {pin.city}</span>}
            </div>
          </div>
        </div>
        <div className="umap-drawer-actions">
          <button className="umap-btn-primary" onClick={() => { onClose(); onOpenVlogFeed(pin); }}>
            {t('map.viewAreaFeed')}
          </button>
          <button className="umap-btn-secondary" onClick={() => { onClose(); navigate(`/vlogs/${pin.id}`); }}>
            {t('map.thisVlogOnly')}
          </button>
        </div>
      </div>
    );
  }

  const FALLBACK = {
    listing: <Home size={32} strokeWidth={1.2} color="#aaa" />,
    activity: <Zap size={32} strokeWidth={1.2} color="#aaa" />,
    restaurant: <Utensils size={32} strokeWidth={1.2} color="#aaa" />,
    guide: <Compass size={32} strokeWidth={1.2} color="#aaa" />,
    artisan: <Palette size={32} strokeWidth={1.2} color="#aaa" />,
  };

  const ROUTE = {
    listing:    (id) => `/listings/${id}`,
    activity:   (id) => `/services/activities/${id}`,
    restaurant: (id) => `/services/restaurants/${id}`,
    guide:      (id) => `/services/guides/${id}`,
    artisan:    (id) => `/services/artisans/${id}`,
  };

  const LABEL = {
    listing:    t('map.viewListing'),
    activity:   t('map.viewActivity'),
    restaurant: t('map.viewRestaurant'),
    guide:      t('map.viewGuide'),
    artisan:    t('map.viewArtisan'),
  };

  return (
    <div className="umap-drawer-service">
      <div className="umap-drawer-sthumb">
        {pin.thumb
          ? <img src={pin.thumb} alt={pin.title} />
          : <div className="umap-drawer-sthumb-empty">{FALLBACK[type]}</div>
        }
      </div>
      <div className="umap-drawer-sinfo">
        <h3>{pin.title}</h3>
        {pin.city && <p className="umap-ds-loc"><MapPin size={11} /> {pin.city}</p>}
        {pin.rating_avg > 0 && (
          <p className="umap-ds-rating"><Star size={11} fill="#f59e0b" color="#f59e0b" /> {Number(pin.rating_avg).toFixed(1)}</p>
        )}
        {type === 'listing'    && <p className="umap-ds-price">{fmtFCFA(pin.price_per_night)} <span>{t('listings.perNight')}</span></p>}
        {type === 'activity'   && <p className="umap-ds-price">{fmtFCFA(pin.price_per_person)} <span>{t('services.perPerson')}</span></p>}
        {type === 'guide'      && <p className="umap-ds-price">{t('services.halfDay')} : {fmtFCFA(pin.half_day_price)}</p>}
        {type === 'restaurant' && pin.price_range && <p className="umap-ds-loc">{pin.price_range}</p>}
        {ROUTE[type] && (
          <button className="umap-btn-primary" onClick={() => { onClose(); navigate(ROUTE[type](pin.id)); }}>
            {LABEL[type]} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function UnifiedMapScreen({ onGoList }) {
  const { t } = useTranslation();
  const mapRef    = useRef(null);
  const reqId     = useRef(0);
  const debounce  = useRef(null);
  const lastKey   = useRef('');

  const center = useMemo(() => [5.3599, -4.0082], []);   // Abidjan

  const [activeLayer, setActiveLayer] = useState('all');
  const [pins,        setPins]        = useState({ vlogs: [], listings: [], activities: [], restaurants: [], guides: [], artisans: [] });
  const [loading,     setLoading]     = useState(false);
  const [bounds,      setBounds]      = useState(null);
  const [drawerPin,   setDrawerPin]   = useState(null);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  // Vlog zone feed overlay
  const [vlogFeed,         setVlogFeed]         = useState(null); // { initialVlogId, region, city, destination_slug }
  const [vlogFeedVisible,  setVlogFeedVisible]  = useState(false);

  // ── Determine which layers to request ───────────────────────
  const activeLayers = useMemo(() => {
    if (activeLayer === 'all') return [];   // empty = all
    return [activeLayer];
  }, [activeLayer]);

  // ── Fetch pins ───────────────────────────────────────────────
  const fetchPins = useCallback(async (b, layers) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const data = await fetchMapPins(b, layers);
      if (id !== reqId.current) return;
      setPins(prev => ({ ...prev, ...data }));
    } catch (e) {
      console.error('Map pins fetch error', e?.message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  const scheduleFetch = useCallback((b, layers) => {
    const key = boundsKey(b) + layers.join(',');
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchPins(b, layers), 300);
  }, [fetchPins]);

  const handleBoundsChange = useCallback((b) => {
    setBounds(b);
    scheduleFetch(b, activeLayers);
  }, [scheduleFetch, activeLayers]);

  // mapRef is set via ref={mapRef} on MapContainer (react-leaflet v4+)

  // Refetch when layer filter changes
  useEffect(() => {
    if (!bounds) return;
    lastKey.current = '';   // force refetch
    scheduleFetch(bounds, activeLayers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer]);

  // ── Pin click ─────────────────────────────────────────────
  const handlePinClick = (pin) => {
    setDrawerPin(pin);
    setDrawerOpen(true);
    if (mapRef.current) {
      mapRef.current.setView([pin.lat, pin.lng], Math.max(mapRef.current.getZoom(), 14), { animate: true });
    }
  };

  const openVlogFeed = (vlogPin) => {
    setVlogFeed({
      initialVlogId: vlogPin.id,
      region: vlogPin.region || '',
      city: vlogPin.city || '',
      destination_slug: vlogPin.destination_slug || '',
    });
    setVlogFeedVisible(true);
  };

  // ── Render Leaflet markers ────────────────────────────────
  const markers = useMemo(() => {
    const els = [];
    const show = (layer) => activeLayer === 'all' || activeLayer === layer;

    if (show('vlogs')) {
      (pins.vlogs || []).forEach(v => {
        const icon = makeVlogIcon(v.thumb);
        els.push({ key: `v-${v.id}`, lat: v.lat, lng: v.lng, icon, pin: { ...v, _type: 'vlog' } });
      });
    }
    if (show('listings')) {
      (pins.listings || []).forEach(l => {
        const icon = makeListingIcon(l, t);
        els.push({ key: `l-${l.id}`, lat: l.lat, lng: l.lng, icon, pin: { ...l, _type: 'listing' } });
      });
    }
    if (show('activities')) {
      (pins.activities || []).forEach(a => {
        els.push({ key: `a-${a.id}`, lat: a.lat, lng: a.lng, icon: ACTIVITY_ICON(), pin: { ...a, _type: 'activity' } });
      });
    }
    if (show('restaurants')) {
      (pins.restaurants || []).forEach(r => {
        els.push({ key: `r-${r.id}`, lat: r.lat, lng: r.lng, icon: RESTAURANT_ICON(), pin: { ...r, _type: 'restaurant' } });
      });
    }
    if (show('guides')) {
      (pins.guides || []).forEach(g => {
        els.push({ key: `g-${g.id}`, lat: g.lat, lng: g.lng, icon: GUIDE_ICON(), pin: { ...g, _type: 'guide' } });
      });
    }
    if (show('artisans')) {
      (pins.artisans || []).forEach(a => {
        els.push({ key: `ar-${a.id}`, lat: a.lat, lng: a.lng, icon: ARTISAN_ICON(), pin: { ...a, _type: 'artisan' } });
      });
    }
    return els;
  }, [pins, activeLayer, t]);

  // ── Total count for current layer ─────────────────────────
  const totalCount = useMemo(() => {
    if (activeLayer === 'all') {
      return Object.values(pins).reduce((s, arr) => s + (arr?.length || 0), 0);
    }
    return (pins[activeLayer] || []).length;
  }, [pins, activeLayer]);

  return (
    <div className="map-screen">

      {/* ── Layer pills ── */}
      <div className="umap-layer-pills">
        {LAYERS.map(l => (
          <button
            key={l.id}
            className={`umap-layer-pill ${activeLayer === l.id ? 'active' : ''}`}
            style={activeLayer === l.id ? { background: l.color, borderColor: l.color } : {}}
            onClick={() => setActiveLayer(l.id)}
          >
            <l.Icon size={14} />
            {t(l.labelKey)}
          </button>
        ))}
      </div>

      {/* ── Top chip (count + go-list) ── */}
      <div className="map-overlay-top" style={{ top: 58 }}>
        <div className="map-chip">
          {loading ? t('common.loading') : t('listings.resultsCount', { count: totalCount })}
        </div>
        {onGoList && (
          <button className="map-chip map-chip-btn" onClick={onGoList}>
            {t('listings.list')} →
          </button>
        )}
      </div>

      {/* ── Map ── */}
      <div className="map-canvas">
        <MapContainer
          center={center}
          zoom={12}
          ref={mapRef}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution="© CartoDB"
          />
          <BoundsWatcher onBoundsChange={handleBoundsChange} />

          {/* Custom markers via useEffect on map after creation */}
          <MarkersLayer markers={markers} onPinClick={handlePinClick} />
        </MapContainer>
      </div>

      {/* ── Bottom drawer (carte flottante sur desktop) ── */}
      <div className={`umap-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="umap-drawer-handle" onClick={() => setDrawerOpen(p => !p)} />
        <button className="umap-drawer-close" onClick={() => setDrawerOpen(false)} aria-label={t('common.close')}>
          <X size={18} />
        </button>
        <DrawerContent
          pin={drawerPin}
          onClose={() => setDrawerOpen(false)}
          onOpenVlogFeed={openVlogFeed}
          t={t}
        />
      </div>

      {/* ── Vlog zone feed overlay (Snap-style) ── */}
      {vlogFeedVisible && vlogFeed && (
        <ExploreVlogsScreen
          initialVlogId={vlogFeed.initialVlogId}
          zoneFilter={{
            region: vlogFeed.region,
            city: vlogFeed.city,
            destination: vlogFeed.destination_slug,
          }}
          onClose={() => setVlogFeedVisible(false)}
        />
      )}
    </div>
  );
}

// ─── Markers layer (uses Leaflet directly, outside React tree) ─
function MarkersLayer({ markers, onPinClick }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    if (layerRef.current) {
      layerRef.current.clearLayers();
    } else {
      layerRef.current = L.layerGroup().addTo(map);
    }

    markers.forEach(({ lat, lng, icon, pin }) => {
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      const marker = L.marker([lat, lng], { icon });
      marker.on('click', () => onPinClick(pin));
      layerRef.current.addLayer(marker);
    });

    return () => {
      if (layerRef.current) layerRef.current.clearLayers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  return null;
}
