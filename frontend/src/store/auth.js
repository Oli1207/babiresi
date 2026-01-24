// store.auth.js
import { create } from 'zustand';
import { mountStoreDevtool } from 'simple-zustand-devtools';

const useAuthStore = create((set, get) => ({
    allUserData: null,
    loading: false,

    // CHANGE: on renvoie un objet user plus complet
    user: () => ({
        // compatibilité avec ton ancien code
        user_id: get().allUserData?.user_id ?? get().allUserData?.id ?? null,
        username: get().allUserData?.username ?? null,

        // NEW: champs envoyés par SafeUserSerializer
        id: get().allUserData?.id ?? null,
        email: get().allUserData?.email ?? null,
        full_name: get().allUserData?.full_name ?? null,
        phone: get().allUserData?.phone ?? null,
    
    }),

    setUser: (user) => set({ allUserData: user }),
    setLoading: (loading) => set({ loading }),
    isLoggedIn: () => !!get().allUserData,
}));

if (import.meta.env.DEV) {
    mountStoreDevtool('Store', useAuthStore);
}

export { useAuthStore };
