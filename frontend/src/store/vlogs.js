import { create } from 'zustand';

const useVlogStore = create((set, get) => ({
  feed: [],
  trending: [],
  currentVlog: null,
  loading: false,
  hasMore: true,
  page: 1,
  filters: { region: '', category: '', ambiance: '' },

  setFeed: (feed) => set({ feed }),
  appendFeed: (vlogs) => set((s) => ({ feed: [...s.feed, ...vlogs] })),
  setTrending: (trending) => set({ trending }),
  setCurrentVlog: (vlog) => set({ currentVlog: vlog }),
  setLoading: (loading) => set({ loading }),
  setHasMore: (hasMore) => set({ hasMore }),
  setPage: (page) => set({ page }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters }, feed: [], page: 1, hasMore: true })),
  resetFeed: () => set({ feed: [], page: 1, hasMore: true }),

  // Creator dashboard data
  creatorStats: null,
  pointsHistory: [],
  withdrawals: [],
  setCreatorStats: (creatorStats) => set({ creatorStats }),
  setPointsHistory: (pointsHistory) => set({ pointsHistory }),
  setWithdrawals: (withdrawals) => set({ withdrawals }),

  // Challenges
  challenges: [],
  setChallenges: (challenges) => set({ challenges }),
}));

export { useVlogStore };
