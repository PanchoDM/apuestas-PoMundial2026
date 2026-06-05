export interface Usuario {
  id: string;
  nombre_usuario: string;
  puntos_totales: number;
  aciertos_exactos: number;
  rol: 'user' | 'admin';
}

export interface AuthResponse {
  token: string;
  user: Usuario;
}

export interface Partido {
  id: number;
  equipo_local: string;
  equipo_visitante: string;
  fecha_partido: string;
  goles_local_mt: number | null;
  goles_visitante_mt: number | null;
  estado: 'pendiente' | 'medio_tiempo' | 'finalizado';
  apuestas_abiertas: boolean;
  visible_usuarios: boolean;
  ronda?: string;
}

export interface Prediccion {
  id: number;
  partido_id: number;
  equipo_local: string;
  equipo_visitante: string;
  fecha_partido: string;
  goles_local_esperados_mt: number;
  goles_visitante_esperados_mt: number;
  tendencia_apostada: string;
  puntos_obtenidos: number | null;
}

export interface Streak {
  streak: 'hot' | 'cold' | 'neutral';
  message: string | null;
}
