import apiInstance from "../utils/axios";

const ADMIN = "/admin";

export const adminApi = {
  metrics: () => apiInstance.get(`${ADMIN}/metrics/`),

  bookings: (params) => apiInstance.get(`${ADMIN}/bookings/`, { params }),
  bookingDetail: (id) => apiInstance.get(`${ADMIN}/bookings/${id}/`),
  bookingOverrideStatus: (id, payload) =>
    apiInstance.patch(`${ADMIN}/bookings/${id}/override-status/`, payload),

  payouts: (params) => apiInstance.get(`${ADMIN}/payouts/`, { params }),
  payoutMarkPaid: (id, payload) =>
    apiInstance.post(`${ADMIN}/payouts/${id}/mark-paid/`, payload),

  disputes: (params) => apiInstance.get(`${ADMIN}/disputes/`, { params }),
  disputeCreate: (payload) => apiInstance.post(`${ADMIN}/disputes/`, payload),
  disputeDetail: (id) => apiInstance.get(`${ADMIN}/disputes/${id}/`),
  disputeUpdate: (id, payload) => apiInstance.patch(`${ADMIN}/disputes/${id}/`, payload),
  disputeAddMessage: (id, payload) =>
    apiInstance.post(`${ADMIN}/disputes/${id}/messages/`, payload),

  audit: (params) => apiInstance.get(`${ADMIN}/audit/`, { params }),

  statsOwners: (params) => apiInstance.get(`${ADMIN}/stats/owners/`, { params }),
  statsTopListings: (params) => apiInstance.get(`${ADMIN}/stats/top-listings/`, { params }),
  statsProfit: (params) => apiInstance.get(`${ADMIN}/stats/profit/`, { params }),
};