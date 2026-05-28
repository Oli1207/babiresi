import apiInstance from './axios';

export const travelApi = {
  // Agencies
  agencies: () => apiInstance.get('travel/agencies/'),
  agencyDetail: (pk) => apiInstance.get(`travel/agencies/${pk}/`),

  // Travel requests
  createRequest: (data) => apiInstance.post('travel/request/', data),
  myRequests: () => apiInstance.get('travel/my-requests/'),
  requestDetail: (pk) => apiInstance.get(`travel/request/${pk}/`),

  // Quotes
  quoteVersions: (requestPk) => apiInstance.get(`travel/request/${requestPk}/quotes/`),
  quoteDetail: (pk) => apiInstance.get(`travel/quote/${pk}/`),
  acceptQuote: (pk) => apiInstance.post(`travel/quote/${pk}/accept/`),
  rejectQuote: (pk) => apiInstance.post(`travel/quote/${pk}/reject/`),

  // Trip room
  tripRoom: (requestPk) => apiInstance.get(`travel/request/${requestPk}/trip-room/`),
  tripRoomMessages: (requestPk) => apiInstance.get(`travel/request/${requestPk}/trip-room/messages/`),

  // Payments
  paymentSchedule: (requestPk) => apiInstance.get(`travel/request/${requestPk}/payment-schedule/`),
  payDeposit: (requestPk) => apiInstance.post(`travel/request/${requestPk}/pay-deposit/`),
  payBalance: (requestPk) => apiInstance.post(`travel/request/${requestPk}/pay-balance/`),

  // Insurance
  insurance: (requestPk) => apiInstance.get(`travel/request/${requestPk}/insurance/`),
};

export const TRIP_TYPES = [
  { value: 'cultural', label: '🎭 Culturel' },
  { value: 'beach', label: '🏖️ Plage' },
  { value: 'adventure', label: '🏕️ Aventure' },
  { value: 'safari', label: '🦁 Safari nature' },
  { value: 'gastronomy', label: '🍽️ Gastronomie' },
  { value: 'business', label: '💼 Business' },
  { value: 'wellness', label: '🧘 Bien-être' },
  { value: 'event', label: '🎉 Événement' },
  { value: 'honeymoon', label: '💕 Lune de miel' },
];

export const ACCOMMODATION_TYPES = [
  { value: 'hotel_budget', label: '🏨 Hôtel budget' },
  { value: 'hotel_mid', label: '🏩 Hôtel milieu de gamme' },
  { value: 'hotel_luxury', label: '🏰 Hôtel luxe' },
  { value: 'villa', label: '🏡 Villa privée' },
  { value: 'guesthouse', label: '🛖 Maison d\'hôtes' },
  { value: 'no_preference', label: 'Pas de préférence' },
];

export const TRANSPORT_TYPES = [
  { value: 'private_car', label: '🚗 Voiture privée' },
  { value: 'shuttle', label: '🚐 Navette' },
  { value: 'domestic_flight', label: '✈️ Vol intérieur' },
  { value: 'no_transport', label: 'Je me débrouille' },
];

export const INTEREST_TAGS = [
  'Nature', 'Culture', 'Histoire', 'Artisanat', 'Cuisine locale', 'Plage',
  'Randonnée', 'Pêche', 'Surf', 'Plongée', 'Safari', 'Nuit en brousse',
  'Marchés locaux', 'Musique', 'Danse', 'Villages traditionnels',
];
