import apiInstance from './axios';

export const vlogsApi = {
  list: (params = {}) => apiInstance.get('vlogs/', { params }),
  trending: () => apiInstance.get('vlogs/trending/'),
  featured: () => apiInstance.get('vlogs/featured/'),
  detail: (pk) => apiInstance.get(`vlogs/${pk}/`),

  create: (data) => apiInstance.post('vlogs/', data),
  update: (pk, data) => apiInstance.put(`vlogs/${pk}/`, data),
  delete: (pk) => apiInstance.delete(`vlogs/${pk}/`),

  registerView: (pk, watchPercentage) =>
    apiInstance.post(`vlogs/${pk}/view/`, { watch_percentage: watchPercentage }),
  toggleLike: (pk) => apiInstance.post(`vlogs/${pk}/like/`),
  toggleSave: (pk) => apiInstance.post(`vlogs/${pk}/save/`),
  share: (pk) => apiInstance.post(`vlogs/${pk}/share/`),

  getComments: (pk) => apiInstance.get(`vlogs/${pk}/comments/`),
  postComment: (pk, message, parentId = null) =>
    apiInstance.post(`vlogs/${pk}/comments/`, { message, ...(parentId ? { parent: parentId } : {}) }),

  series: (authorId = null) =>
    apiInstance.get('vlogs/series/', { params: authorId ? { author: authorId } : {} }),
  createSeries: (data) => apiInstance.post('vlogs/series/', data),

  challenges: () => apiInstance.get('vlogs/challenges/'),
  enterChallenge: (pk, vlogId) =>
    apiInstance.post(`vlogs/challenges/${pk}/enter/`, { vlog_id: vlogId }),

  creatorDashboard: () => apiInstance.get('vlogs/creator/dashboard/'),
  pointsHistory: () => apiInstance.get('vlogs/creator/points/history/'),
  withdrawals: () => apiInstance.get('vlogs/creator/points/withdraw/'),
  requestWithdrawal: (data) => apiInstance.post('vlogs/creator/points/withdraw/', data),
};

export const REGIONS_CI = [
  { value: 'abidjan', label: 'Abidjan' },
  { value: 'bas_sassandra', label: 'Bas-Sassandra' },
  { value: 'comoé', label: 'Comoé' },
  { value: 'denguélé', label: 'Denguélé' },
  { value: 'gôh_djiboua', label: 'Gôh-Djiboua' },
  { value: 'lacs', label: 'Lacs' },
  { value: 'lagunes', label: 'Lagunes' },
  { value: 'montagnes', label: 'Montagnes' },
  { value: 'marahoué', label: 'Marahoué' },
  { value: 'sassandra_marahoué', label: 'Sassandra-Marahoué' },
  { value: 'savanes', label: 'Savanes' },
  { value: 'vallée_du_bandama', label: 'Vallée du Bandama' },
  { value: 'woroba', label: 'Woroba' },
  { value: 'zanzan', label: 'Zanzan' },
];

export const VLOG_CATEGORIES = [
  { value: 'nature',    label: 'Nature & Paysages' },
  { value: 'culture',   label: 'Culture & Traditions' },
  { value: 'food',      label: 'Gastronomie & Food' },
  { value: 'nightlife', label: 'Vie nocturne' },
  { value: 'sport',     label: 'Sport' },
  { value: 'artisanat', label: 'Artisanat' },
  { value: 'voyage',    label: 'Voyage' },
  { value: 'lifestyle', label: 'Lifestyle' },
];

export const AMBIANCES = [
  { value: 'chill',      label: 'Chill' },
  { value: 'festif',     label: 'Festif' },
  { value: 'aventure',   label: 'Aventure' },
  { value: 'romantique', label: 'Romantique' },
  { value: 'famille',    label: 'Famille' },
  { value: 'decouverte', label: 'Découverte' },
];

export const CREATOR_LEVELS = {
  bronze: { label: 'Bronze', color: '#cd7f32', emoji: '🥉', minPoints: 0 },
  silver: { label: 'Silver', color: '#c0c0c0', emoji: '🥈', minPoints: 5000 },
  gold: { label: 'Gold', color: '#ffd700', emoji: '🥇', minPoints: 25000 },
  platinum: { label: 'Platinum', color: '#e5e4e2', emoji: '💎', minPoints: 100000 },
};

export function formatPoints(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatFCFA(n) {
  return new Intl.NumberFormat('fr-CI', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}
