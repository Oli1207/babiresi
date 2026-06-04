/**
 * LocationPicker — Yango/Uber style
 *
 * Le pin est fixe au centre. L'utilisateur déplace la carte sous le pin.
 * À chaque arrêt (moveend), on reverse-geocode les coordonnées du centre.
 *
 * Props:
 *   value       { lat, lng, address }
 *   onChange    (newValue) => void
 *   height      string CSS (default "360px")
 *   required    bool
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import { Navigation, Search, X, MapPin, CheckCircle } from 'lucide-react';
import apiInstance from '../../utils/axios';
import './LocationPicker.css';

/* ── Helpers ─────────────────────────────────────────────── */

/** Recentre la carte programmatiquement. */
function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }, [lat, lng]); // eslint-disable-line
  return null;
}

/** Écoute les déplacements de la carte → donne le nouveau centre. */
function MoveWatcher({ onMoveEnd, onMoveStart }) {
  useMapEvents({
    movestart: () => onMoveStart?.(),
    moveend:   (e) => {
      const c = e.target.getCenter();
      onMoveEnd(c.lat, c.lng);
    },
  });
  return null;
}

/* ── Main component ──────────────────────────────────────── */
export default function LocationPicker({ value, onChange, height = '360px', required = false }) {
  const [flyTarget,    setFlyTarget]    = useState(null);   // { lat, lng }
  const [address,      setAddress]      = useState(value?.address || '');
  const [searchQ,      setSearchQ]      = useState('');
  const [suggestions,  setSuggestions]  = useState([]);
  const [showSuggest,  setShowSuggest]  = useState(false);
  const [loadingSug,   setLoadingSug]   = useState(false);
  const [loadingGeo,   setLoadingGeo]   = useState(false);
  const [isMoving,     setIsMoving]     = useState(false);
  const [geoError,     setGeoError]     = useState('');

  const sugTimer  = useRef(null);
  const revTimer  = useRef(null);
  const lastCoord = useRef({ lat: null, lng: null });

  const center = {
    lat: typeof value?.lat === 'number' ? value.lat : 5.3599,
    lng: typeof value?.lng === 'number' ? value.lng : -4.0082,
  };

  /* ── Reverse geocode on map stop ────────────────────── */
  const handleMoveEnd = useCallback((lat, lng) => {
    setIsMoving(false);

    const prev  = lastCoord.current;
    const delta = prev.lat === null ? 999 : Math.abs(prev.lat - lat) + Math.abs(prev.lng - lng);
    lastCoord.current = { lat, lng };

    onChange?.({ lat, lng, address });  // mise à jour coords immédiate

    if (delta < 0.00005) return;        // micro-mouvement → skip reverse

    if (revTimer.current) clearTimeout(revTimer.current);
    revTimer.current = setTimeout(async () => {
      try {
        const { data } = await apiInstance.post('utils/reverse-geocode/', { latitude: lat, longitude: lng });
        if (data?.warning) return;
        const addr = data?.city
          ? [data.borough, data.area, data.city].filter(Boolean).join(', ')
          : data?.address_label || '';
        setAddress(addr);
        onChange?.({ lat, lng, address: addr });
      } catch {}
    }, 600);
  }, [address, onChange]);

  /* ── GPS ─────────────────────────────────────────────── */
  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non disponible.'); return; }
    setLoadingGeo(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLoadingGeo(false);
        setFlyTarget({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { setLoadingGeo(false); setGeoError('Position refusée.'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  /* ── Search / autocomplete ───────────────────────────── */
  const search = async (q) => {
    if (!q || q.trim().length < 3) { setSuggestions([]); setShowSuggest(false); return; }
    setLoadingSug(true);
    try {
      const { data } = await apiInstance.get(`utils/search-places/?q=${encodeURIComponent(q)}&limit=5`);
      setSuggestions(data?.results || []);
      setShowSuggest(true);
    } catch { setSuggestions([]); }
    finally { setLoadingSug(false); }
  };

  const pickSuggestion = (s) => {
    setShowSuggest(false);
    const addr = [s.borough, s.area, s.city].filter(Boolean).join(', ');
    setAddress(addr);
    setSearchQ('');
    setFlyTarget({ lat: Number(s.latitude), lng: Number(s.longitude) });
    onChange?.({ lat: Number(s.latitude), lng: Number(s.longitude), address: addr });
  };

  const hasPin = typeof value?.lat === 'number' && typeof value?.lng === 'number';

  return (
    <div className="lp-wrap">

      {/* ── Barre de recherche ──────────────────────────── */}
      <div className="lp-search-bar" onClick={e => e.stopPropagation()}>
        <Search size={15} className="lp-search-icon" />
        <input
          className="lp-search-input"
          placeholder="Rechercher une adresse, quartier…"
          value={searchQ}
          onChange={e => {
            const v = e.target.value;
            setSearchQ(v);
            if (sugTimer.current) clearTimeout(sugTimer.current);
            sugTimer.current = setTimeout(() => search(v), 350);
          }}
          onFocus={() => { if (suggestions.length) setShowSuggest(true); }}
        />
        {searchQ && (
          <button className="lp-search-clear" onClick={() => { setSearchQ(''); setSuggestions([]); setShowSuggest(false); }}>
            <X size={14} />
          </button>
        )}
        {loadingSug && <span className="lp-loading-dot" />}
        {showSuggest && suggestions.length > 0 && (
          <div className="lp-suggestions">
            {suggestions.map((s, i) => (
              <button key={i} className="lp-suggest-item" onClick={() => pickSuggestion(s)}>
                <MapPin size={13} className="lp-suggest-icon" />
                <div>
                  <strong>{s.borough || s.area || s.city || 'Lieu'}</strong>
                  <small>{s.address_label}</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Carte ───────────────────────────────────────── */}
      <div className="lp-map-container" style={{ height }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={typeof value?.lat === 'number' ? 16 : 12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="© CartoDB"
          />
          <MoveWatcher
            onMoveStart={() => setIsMoving(true)}
            onMoveEnd={handleMoveEnd}
          />
          {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
        </MapContainer>

        {/* Pin fixe au centre */}
        <div className={`lp-center-pin ${isMoving ? 'moving' : ''} ${hasPin ? 'placed' : ''}`}>
          <div className="lp-pin-icon">
            <MapPin size={36} strokeWidth={2} />
          </div>
          <div className="lp-pin-shadow" />
        </div>

        {/* Bouton GPS */}
        <button className="lp-gps-btn" onClick={useMyLocation} disabled={loadingGeo} title="Ma position">
          <Navigation size={18} strokeWidth={2} className={loadingGeo ? 'lp-spin' : ''} />
        </button>

        {/* Erreur geo */}
        {geoError && (
          <div className="lp-geo-error">{geoError}</div>
        )}
      </div>

      {/* ── Adresse détectée ────────────────────────────── */}
      {hasPin && (
        <div className="lp-address-bar">
          <CheckCircle size={15} className="lp-addr-icon" />
          <span className="lp-addr-text">{address || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}</span>
        </div>
      )}

      {required && !hasPin && (
        <p className="lp-hint">Déplace la carte pour placer le pin à ton emplacement exact.</p>
      )}
    </div>
  );
}
