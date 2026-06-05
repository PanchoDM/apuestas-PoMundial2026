import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { timer } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PartidosService } from '../../services/partidos.service';
import { PrediccionesService } from '../../services/predicciones.service';
import { NotificationsService } from '../../services/notifications.service';
import { Partido, Prediccion, Streak } from '../../models/models';
import { PrediccionFormComponent } from '../prediccion-form/prediccion-form';
import { StreakBannerComponent } from '../streak-banner/streak-banner';
import { NavbarComponent } from '../navbar/navbar';
import { FlagPipe } from '../../pipes/flag.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, PrediccionFormComponent, StreakBannerComponent, NavbarComponent, FlagPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  partidos        = signal<Partido[]>([]);
  predicciones    = signal<Prediccion[]>([]);
  streak          = signal<Streak | null>(null);
  selectedPartido = signal<Partido | null>(null);
  loading         = signal(true);

  readonly auth            = inject(AuthService);
  readonly partidosSvc     = inject(PartidosService);
  readonly prediccionesSvc = inject(PrediccionesService);
  readonly notif           = inject(NotificationsService);
  private  destroyRef      = inject(DestroyRef);

  user = this.auth.currentUser;

  // Título dinámico: usa el campo `ronda` del primer partido activo si está disponible
  faseActual = computed(() => {
    const list = this.partidos();
    if (!list.length) return 'PARTIDOS • FASE DE GRUPOS';
    const activos = list.filter(p => p.estado !== 'finalizado');
    if (!activos.length) return 'TORNEO FINALIZADO';
    const ronda = activos[0]?.ronda;
    return ronda ? `PARTIDOS • ${ronda.toUpperCase()}` : 'PARTIDOS • FASE DE GRUPOS';
  });

  ngOnInit() {
    this.loadData();
    this.loadStreak();

    // Short polling cada 30 s para actualizaciones de marcador en vivo
    timer(30_000, 30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadData());

    this.notif.scoreUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadData());

    // Retirar partido eliminado de la lista sin recarga completa
    this.notif.partidoDelete$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => this.partidos.update(list => list.filter(p => p.id !== id)));
  }

  loadData() {
    this.loading.set(true);
    this.partidosSvc.getAll().subscribe({
      next: p => { this.partidos.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.prediccionesSvc.getMias().subscribe(p => this.predicciones.set(p));
  }

  loadStreak() {
    this.prediccionesSvc.getMiRacha().subscribe(s => {
      if (s.streak !== 'neutral') this.streak.set(s);
    });
  }

  getPrediccion(partidoId: number): Prediccion | undefined {
    return this.predicciones().find(p => p.partido_id === partidoId);
  }

  openBet(partido: Partido) {
    if (!partido.apuestas_abiertas) return;
    this.selectedPartido.set(partido);
  }

  onSaved() {
    this.selectedPartido.set(null);
    this.loadData();
  }

  getEstadoBadgeClass(estado: string): string {
    return { pendiente: 'badge-pending', medio_tiempo: 'badge-live', finalizado: 'badge-done' }[estado] ?? '';
  }

  getPuntosClass(pts: number | null): string {
    if (pts === null) return '';
    if (pts === 10) return 'pts-exact';
    if (pts === 3)  return 'pts-trend';
    return 'pts-miss';
  }
}
