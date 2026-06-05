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

  private readonly GRUPOS_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  private readonly RONDA_ORDER  = ['16avos','octavos','cuartos','semis','tercero','final'];
  private readonly RONDA_LABELS: Record<string, string> = {
    '16avos':  'DIECISEISAVOS DE FINAL',
    'octavos': 'OCTAVOS DE FINAL',
    'cuartos': 'CUARTOS DE FINAL',
    'semis':   'SEMIFINAL',
    'tercero': 'TERCER LUGAR',
    'final':   'FINAL',
  };

  partidosAgrupados = computed(() => {
    const list = this.partidos();
    const grupoMap = new Map<string, Partido[]>();
    const rondaMap = new Map<string, Partido[]>();

    for (const p of list) {
      if (p.ronda) {
        if (!rondaMap.has(p.ronda)) rondaMap.set(p.ronda, []);
        rondaMap.get(p.ronda)!.push(p);
      } else {
        const key = p.grupo ?? '__sin_grupo__';
        if (!grupoMap.has(key)) grupoMap.set(key, []);
        grupoMap.get(key)!.push(p);
      }
    }

    const secciones: { titulo: string; partidos: Partido[] }[] = [];

    for (const g of this.GRUPOS_ORDER) {
      if (grupoMap.has(g)) secciones.push({ titulo: `GRUPO ${g}`, partidos: grupoMap.get(g)! });
    }
    if (grupoMap.has('__sin_grupo__')) {
      secciones.push({ titulo: 'FASE DE GRUPOS', partidos: grupoMap.get('__sin_grupo__')! });
    }
    for (const r of this.RONDA_ORDER) {
      if (rondaMap.has(r)) secciones.push({ titulo: this.RONDA_LABELS[r], partidos: rondaMap.get(r)! });
    }
    for (const [r, ps] of rondaMap.entries()) {
      if (!this.RONDA_ORDER.includes(r)) secciones.push({ titulo: r.toUpperCase(), partidos: ps });
    }

    return secciones;
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
