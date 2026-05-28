import apiInstance from './axios';

/**
 * Fetch unified map pins within given Leaflet bounds.
 * @param {Object} bounds  - Leaflet LatLngBounds object (has getNorthEast / getSouthWest)
 * @param {string[]} layers - e.g. ['vlogs','listings','activities']  (empty = all)
 * @returns Promise<{ vlogs, listings, activities, restaurants, guides, artisans }>
 */
export async function fetchMapPins(bounds, layers = []) {
  const params = new URLSearchParams();

  if (layers.length > 0) {
    params.set('layers', layers.join(','));
  }

  if (bounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    params.set('ne_lat', String(ne.lat));
    params.set('ne_lng', String(ne.lng));
    params.set('sw_lat', String(sw.lat));
    params.set('sw_lng', String(sw.lng));
  }

  const { data } = await apiInstance.get(`map/pins/?${params.toString()}`);
  return data;
}

/** Round bounds key to 4 dp — avoids re-fetching on tiny pan */
export function boundsKey(bounds) {
  if (!bounds) return '';
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const r = (n) => Number(n).toFixed(4);
  return `${r(sw.lat)}|${r(sw.lng)}|${r(ne.lat)}|${r(ne.lng)}`;
}

/** FCFA formatter (shared) */
export function fmtFCFA(n) {
  return `${Number(n || 0).toLocaleString('fr-CI')} FCFA`;
}
