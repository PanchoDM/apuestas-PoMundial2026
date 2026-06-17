// Las fechas en BD están en hora Lima (UTC-5) guardadas como naive; el JSON
// las trae como ISO interpretadas en UTC, por eso comparamos contra
// "ahora en Lima" (Date.now() - 5h). Las apuestas cierran 5 minutos después
// de la hora oficial de inicio del partido.
const LIMA_OFFSET_MS = 5 * 3_600_000;
export const CIERRE_APUESTAS_MS = 5 * 60_000;

export function nowLima(): number {
  return Date.now() - LIMA_OFFSET_MS;
}

// Milisegundos restantes hasta el cierre de apuestas (negativo si ya cerró).
export function msHastaCierre(fechaPartido: string): number {
  const inicio = Date.parse(fechaPartido);
  if (isNaN(inicio)) return -1;
  return inicio + CIERRE_APUESTAS_MS - nowLima();
}

export function apuestasVencidas(fechaPartido: string): boolean {
  return msHastaCierre(fechaPartido) <= 0;
}
