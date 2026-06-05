import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Partido } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PartidosService {
  private url = `${environment.apiUrl}/partidos`;

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<Partido[]>(this.url);
  }

  crear(data: { equipo_local: string; equipo_visitante: string; fecha_partido: string }) {
    return this.http.post<Partido>(this.url, data);
  }

  actualizarResultado(id: number, data: { goles_local_mt: number; goles_visitante_mt: number; estado: string }) {
    return this.http.patch<{ message: string }>(`${this.url}/${id}/resultado`, data);
  }

  eliminar(id: number) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }

  toggleApuestas(id: number) {
    return this.http.patch<{ id: string; apuestas_abiertas: boolean }>(`${this.url}/${id}/toggle-apuestas`, {});
  }

  toggleVisibilidad(id: number) {
    return this.http.patch<{ id: string; visible_usuarios: boolean }>(`${this.url}/${id}/toggle-visibilidad`, {});
  }

  marcadorEnVivo(id: number, data: { goles_local_mt: number; goles_visitante_mt: number }) {
    return this.http.put<{ message: string; partido_id: number }>(`${this.url}/${id}/marcador-en-vivo`, data);
  }
}
