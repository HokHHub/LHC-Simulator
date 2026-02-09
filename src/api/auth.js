// src/api/auth.js
import axios from "axios";

export const authAPI = {
  register: (userData) => axios.post("/auth/signup/", userData),
  login: (credentials) => axios.post("/auth/login/", credentials),
  logout: (refreshToken) => axios.post("/auth/logout/", { refresh_token: refreshToken }),
  getProfile: () => axios.get("/auth/getprofile/"),
  updateProfile: (payload) => axios.put("/auth/profile/update/", payload),
  getMySimulations: () => axios.get("/auth/allsimulations/"),
  getMyStats: () => axios.get("/auth/stats/"),
  getLeaderboard: () => axios.get("/auth/leaderboard/"),  // Убрал /api/ из начала
  refreshToken: (refreshToken) => axios.post("/auth/token/refresh/", { refresh: refreshToken }),
};