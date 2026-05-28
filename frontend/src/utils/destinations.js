import apiInstance from './axios';

export const destinationsApi = {
  list: (params = {}) => apiInstance.get('destinations/', { params }),
  detail: (slug) => apiInstance.get(`destinations/${slug}/`),
};

export const CI_REGIONS_LABELS = {
  abidjan: 'Abidjan',
  bas_sassandra: 'Bas-Sassandra',
  comoe: 'Comoé',
  denguele: 'Denguélé',
  goh_djiboua: 'Gôh-Djiboua',
  lacs: 'Lacs',
  lagunes: 'Lagunes',
  montagnes: 'Montagnes',
  marahoue: 'Marahoué',
  sassandra_marahoue: 'Sassandra-Marahoué',
  savanes: 'Savanes',
  vallee_du_bandama: 'Vallée du Bandama',
  woroba: 'Woroba',
  zanzan: 'Zanzan',
};
