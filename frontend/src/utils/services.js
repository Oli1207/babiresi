import apiInstance from './axios';

export const servicesApi = {
  // Guides
  guides: (params) => apiInstance.get('services/guides/', { params }),
  guideDetail: (pk) => apiInstance.get(`services/guides/${pk}/`),
  guideAvailability: (pk) => apiInstance.get(`services/guides/${pk}/availability/`),
  bookGuide: (pk, data) => apiInstance.post(`services/guides/${pk}/book/`, data),

  // Restaurants
  restaurants: (params) => apiInstance.get('services/restaurants/', { params }),
  restaurantDetail: (pk) => apiInstance.get(`services/restaurants/${pk}/`),

  // Activities
  activities: (params) => apiInstance.get('services/activities/', { params }),
  activityDetail: (pk) => apiInstance.get(`services/activities/${pk}/`),
  bookActivity: (pk, data) => apiInstance.post(`services/activities/${pk}/book/`, data),

  // Drivers
  drivers: (params) => apiInstance.get('services/drivers/', { params }),
  driverDetail: (pk) => apiInstance.get(`services/drivers/${pk}/`),
  bookVehicle: (vehiclePk, data) => apiInstance.post(`services/vehicles/${vehiclePk}/book/`, data),

  // Artisans & products
  artisans: (params) => apiInstance.get('services/artisans/', { params }),
  artisanDetail: (pk) => apiInstance.get(`services/artisans/${pk}/`),
  products: (params) => apiInstance.get('services/products/', { params }),
  productDetail: (pk) => apiInstance.get(`services/products/${pk}/`),
  placeOrder: (data) => apiInstance.post('services/orders/', data),

  // Reviews
  reviews: (params) => apiInstance.get('services/reviews/', { params }),
  postReview: (data) => apiInstance.post('services/reviews/', data),
};

export function formatFCFA(n) {
  return new Intl.NumberFormat('fr-CI', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

export const RESTAURANT_CATEGORIES = {
  maquis: '🍻 Maquis',
  restaurant: '🍽️ Restaurant',
  street_food: '🌮 Street Food',
  gastronomique: '⭐ Gastronomique',
};

export const PRICE_RANGES = {
  '€': 'Économique',
  '€€': 'Moyen',
  '€€€': 'Haut de gamme',
};

export const VEHICLE_TYPES = {
  citadine: '🚗 Citadine',
  berline: '🚘 Berline',
  suv: '🚙 SUV',
  minibus: '🚐 Minibus',
  '4x4': '🛻 4x4',
};
