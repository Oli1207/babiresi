// // src/utils/useAxios.js
// import axios from 'axios'
// import { isAccessTokenExpired, setAuthUser, getRefreshToken, logout } from './auth' // ✅ ADD logout
// import { BASE_URL } from './constants'
// import Cookies from 'js-cookie'

// const useAxios = async () => {
//   const access_token = Cookies.get("access_token")
//   const refresh_token = Cookies.get("refresh_token")

//   const axiosInstance = axios.create({
//     baseURL: BASE_URL,
//     headers: { Authorization: `Bearer ${access_token}` }
//   })

//   axiosInstance.interceptors.request.use(async (req) => {
//     const access_token = Cookies.get("access_token")

//     if (isAccessTokenExpired(access_token)) {
//       const response = await getRefreshToken() // ✅ response = { access }

//       // ✅ IMPORTANT: le refresh endpoint ne renvoie pas refresh
//       // donc on conserve le refresh_token déjà stocké
//       setAuthUser(response.access, refresh_token)

//       req.headers.Authorization = `Bearer ${response.access}`
//     }

//     return req
//   })

//   axiosInstance.interceptors.response.use(
//     (response) => response,
//     (error) => {
//       if (error.response?.status === 401) {
//         logout() // ✅ now it's defined
//         window.location.href = '/login'
//       }
//       return Promise.reject(error)
//     }
//   )

//   return axiosInstance
// }

// export default useAxios
