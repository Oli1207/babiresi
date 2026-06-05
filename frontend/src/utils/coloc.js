import apiInstance from './axios';

export const colocApi = {
  // Profil
  getMyProfile: ()       => apiInstance.get('coloc/me/'),
  updateProfile: (data)  => apiInstance.patch('coloc/me/', data),

  // Photos
  addPhoto: (data)              => apiInstance.post('coloc/me/photos/', data),
  deletePhoto: (photoId)        => apiInstance.delete(`coloc/me/photos/${photoId}/`),

  // Feed + swipe
  getFeed: ()                   => apiInstance.get('coloc/feed/'),
  swipe: (profileId, liked)     => apiInstance.post(`coloc/swipe/${profileId}/`, { liked }),

  // Matchs
  getMatches: ()                => apiInstance.get('coloc/matches/'),
  getMessages: (matchId, since) => apiInstance.get(`coloc/matches/${matchId}/messages/`, { params: since ? { since } : {} }),
  sendMessage: (matchId, content) => apiInstance.post(`coloc/matches/${matchId}/messages/`, { content }),

  // Profil public
  getProfile: (id)              => apiInstance.get(`coloc/profiles/${id}/`),
};

export const ZONES_ABIDJAN = [
  { value: 'cocody',      label: 'Cocody' },
  { value: 'yopougon',    label: 'Yopougon' },
  { value: 'plateau',     label: 'Plateau' },
  { value: 'marcory',     label: 'Marcory' },
  { value: 'treichville', label: 'Treichville' },
  { value: 'adjame',      label: 'Adjamé' },
  { value: 'koumassi',    label: 'Koumassi' },
  { value: 'port_bouet',  label: 'Port-Bouët' },
  { value: 'abobo',       label: 'Abobo' },
  { value: 'attiecoube',  label: 'Attécoubé' },
  { value: 'bingerville', label: 'Bingerville' },
  { value: 'riviera',     label: 'Riviera' },
  { value: 'angre',       label: 'Angré' },
  { value: '2plateaux',   label: '2 Plateaux' },
];

export const INTERESTS = [
  'Sport', 'Musique', 'Cuisine', 'Cinéma', 'Voyage', 'Lecture',
  'Gaming', 'Art', 'Danse', 'Fitness', 'Photo', 'Mode',
  'Tech', 'Nature', 'Fêtes', 'Calme', 'Animaux', 'Entrepreneuriat',
];

export const LIFESTYLE_OPTIONS = {
  smoking:     { label: 'Tabac',        options: [{ v: 'no', l: 'Non-fumeur' }, { v: 'outdoor', l: 'Dehors OK' }, { v: 'yes', l: 'Fumeur' }] },
  pets:        { label: 'Animaux',      options: [{ v: 'yes', l: 'J\'aime' }, { v: 'no', l: 'Non merci' }] },
  wake_time:   { label: 'Réveil',       options: [{ v: 'early', l: 'Lève-tôt' }, { v: 'normal', l: 'Normal' }, { v: 'late', l: 'Tard' }] },
  sleep_time:  { label: 'Coucher',      options: [{ v: 'early', l: 'Tôt' }, { v: 'normal', l: 'Normal' }, { v: 'late', l: 'Tard' }] },
  cleanliness: { label: 'Propreté',     options: [{ v: 'strict', l: 'Très propre' }, { v: 'normal', l: 'Normal' }, { v: 'relaxed', l: 'Relax' }] },
  noise:       { label: 'Ambiance',     options: [{ v: 'quiet', l: 'Calme' }, { v: 'moderate', l: 'Modérée' }, { v: 'lively', l: 'Animée' }] },
  visitors:    { label: 'Visiteurs',    options: [{ v: 'rarely', l: 'Rarement' }, { v: 'sometimes', l: 'Parfois' }, { v: 'often', l: 'Souvent' }] },
};

export function fmtBudget(min, max) {
  const f = (n) => Number(n).toLocaleString('fr-CI');
  if (!min && !max) return 'Budget non défini';
  if (!max) return `à partir de ${f(min)} FCFA`;
  if (!min) return `jusqu'à ${f(max)} FCFA`;
  return `${f(min)} – ${f(max)} FCFA / mois`;
}
