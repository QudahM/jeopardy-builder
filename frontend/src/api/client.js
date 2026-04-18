import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

// Game API
export const getGames = () => api.get('/games').then(res => res.data);
export const getGame = (id) => api.get(`/games/${id}`).then(res => res.data);
export const createGame = (gameData) => api.post('/games', gameData).then(res => res.data);
export const deleteGame = (id) => api.delete(`/games/${id}`).then(res => res.data);

// Session API
export const createSession = (sessionData) => api.post('/sessions', sessionData).then(res => res.data);
export const getSession = (id) => api.get(`/sessions/${id}`).then(res => res.data);
export const updateScore = (sessionId, contestantId, delta) => api.patch(`/sessions/${sessionId}/contestants/${contestantId}/score`, { score_delta: delta }).then(res => res.data);
export const markQuestion = (sessionId, questionId) => api.post(`/sessions/${sessionId}/mark_question`, { question_id: questionId }).then(res => res.data);
