import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { timer } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PartidosService } from '../../services/partidos.service';
import { PrediccionesService } from '../../services/predicciones.service';
import { NotificationsService } from '../../services/notifications.service';
import { Partido, PartidoStats, Prediccion, Streak } from '../../models/models';
import { PrediccionFormComponent } from '../prediccion-form/prediccion-form';
import { StreakBannerComponent } from '../streak-banner/streak-banner';
import { ApoyoBannerComponent } from '../apoyo-banner/apoyo-banner';
import { NavbarComponent } from '../navbar/navbar';
import { FlagPipe } from '../../pipes/flag.pipe';
import { msHastaCierre, apuestasVencidas } from '../../utils/apuestas.util';

type FiltroChip = 'todos' | 'abiertas' | 'mis-apuestas' | 'en-vivo' | 'mas-cercanos';

const APOYO_BANNER_KEY = 'apoyo_banner_visto';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, PrediccionFormComponent, StreakBannerComponent, ApoyoBannerComponent, NavbarComponent, FlagPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  partidos        = signal<Partido[]>([]);
  predicciones    = signal<Prediccion[]>([]);
  streak          = signal<Streak | null>(null);
  selectedPartido = signal<Partido | null>(null);
  loading         = signal(true);
  showApoyoBanner = signal(!localStorage.getItem(APOYO_BANNER_KEY));

  // ── Marcadores en tiempo real ─────────────────────────────────────────────
  // ids de partidos cuyo marcador acaba de cambiar → dispara animación de gol
  flashScore   = signal<Set<number>>(new Set());
  flashPenales = signal<Set<number>>(new Set());

  // ── Probabilidades de la comunidad ────────────────────────────────────────
  stats         = signal<Map<number, PartidoStats>>(new Map());
  statsAbiertas = signal<Set<number>>(new Set());
  statsLoading  = signal<number | null>(null);
  statsError    = signal<Set<number>>(new Set());

  // ── Filtros y búsqueda ────────────────────────────────────────────────────
  busqueda    = signal('');
  filtroChip  = signal<FiltroChip>('todos');

  // ── Reloj para cuenta regresiva (tick cada segundo) ───────────────────────
  private nowTick = signal(Date.now());

  readonly auth            = inject(AuthService);
  readonly partidosSvc     = inject(PartidosService);
  readonly prediccionesSvc = inject(PrediccionesService);
  readonly notif           = inject(NotificationsService);
  private  destroyRef      = inject(DestroyRef);

  user = this.auth.currentUser;

  private readonly GRUPOS_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  private readonly RONDA_ORDER  = ['16avos','octavos','cuartos','semifinal','tercero','final'];
  private readonly RONDA_LABELS: Record<string, string> = {
    '16avos':    'DIECISEISAVOS DE FINAL',
    'octavos':   'OCTAVOS DE FINAL',
    'cuartos':   'CUARTOS DE FINAL',
    'semifinal': 'SEMIFINAL',
    'tercero':   'TERCER LUGAR',
    'final':     'FINAL',
  };

  partidosAgrupados = computed(() => {
    // Excluir partidos ocultos por el admin antes de agrupar
    let list = this.partidos().filter(p => p.visible_usuarios !== false);

    // Búsqueda por equipo
    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.equipo_local.toLowerCase().includes(q) || p.equipo_visitante.toLowerCase().includes(q));
    }

    // Chips de filtro rápido
    const chip = this.filtroChip();
    if (chip === 'abiertas')      list = list.filter(p => p.apuestas_abiertas && p.estado !== 'finalizado');
    // 'en-vivo': únicamente partidos jugándose en este preciso instante.
    // El estado 'medio_tiempo' es el que la BD usa para "partido en curso"
    // (ver partidosController.marcadorEnVivo) — excluye explícitamente
    // pendientes y finalizados.
    if (chip === 'en-vivo')       list = list.filter(p => p.estado === 'medio_tiempo');
    if (chip === 'mas-cercanos')  list = list.filter(p => p.estado === 'pendiente');
    if (chip === 'mis-apuestas') {
      const ids = new Set(this.predicciones().map(pr => pr.partido_id));
      list = list.filter(p => ids.has(p.id));
    }

    // 'mas-cercanos' se muestra como una sola lista cronológica (más próximo
    // primero), sin agrupar por grupo/ronda — el orden es el requisito clave.
    if (chip === 'mas-cercanos') {
      const ordenados = [...list].sort((a, b) => Date.parse(a.fecha_partido) - Date.parse(b.fecha_partido));
      return ordenados.length ? [{ titulo: 'MÁS CERCANOS', partidos: ordenados }] : [];
    }

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

    // Tick de 1 s para las cuentas regresivas
    timer(0, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.nowTick.set(Date.now()));

    // RENDIMIENTO: el SSE ya empuja marcadores en tiempo real; el polling
    // queda solo como respaldo lejano (90 s) por si la conexión SSE se cae.
    timer(90_000, 90_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadData(true));

    // ⚡ Marcador en tiempo real: actualiza la tarjeta EN SITIO (sin recargar
    // toda la lista) y dispara la animación de gol.
    this.notif.scoreUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ev => {
        this.partidos.update(list => list.map(p => p.id === ev.partido_id
          ? { ...p, goles_local_mt: ev.goles_local_mt, goles_visitante_mt: ev.goles_visitante_mt, estado: ev.estado as Partido['estado'] }
          : p));
        this.triggerFlash(this.flashScore, ev.partido_id);
        // Si el partido terminó, refrescar puntos de mis predicciones
        if (ev.estado === 'finalizado' || ev.estado === 'medio_tiempo') {
          this.prediccionesSvc.getMias().subscribe(p => this.predicciones.set(p));
          this.loadStreak();
        }
      });

    // 🥅 Tanda de penales en tiempo real
    this.notif.penalesUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ev => {
        this.partidos.update(list => list.map(p => p.id === ev.partido_id
          ? { ...p, penales_habilitados: ev.penales_habilitados, penales_local: ev.penales_local, penales_visitante: ev.penales_visitante }
          : p));
        this.triggerFlash(this.flashPenales, ev.partido_id);
      });

    // Apertura/cierre de apuestas en tiempo real, sin recarga
    this.notif.betToggle$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ partido_id, abierta }) => {
        const existe = this.partidos().some(p => p.id === partido_id);
        if (!existe && abierta) { this.loadData(true); return; }
        this.partidos.update(list => list.map(p => p.id === partido_id ? { ...p, apuestas_abiertas: abierta } : p));
      });

    // Retirar partido eliminado de la lista sin recarga completa
    this.notif.partidoDelete$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => this.partidos.update(list => list.filter(p => p.id !== id)));
  }

  private triggerFlash(target: typeof this.flashScore, id: number) {
    target.update(s => new Set(s).add(id));
    setTimeout(() => target.update(s => { const n = new Set(s); n.delete(id); return n; }), 2500);
  }

  loadData(silent = false) {
    if (!silent) this.loading.set(true);
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

  // ── Probabilidades de la comunidad ────────────────────────────────────────
  // Solo se pueden ver si el usuario ya apostó o las apuestas están cerradas,
  // para no sesgar las apuestas de los demás.
  puedeVerStats(partido: Partido): boolean {
    return !!this.getPrediccion(partido.id) || !partido.apuestas_abiertas || partido.estado !== 'pendiente';
  }

  toggleStats(partido: Partido) {
    const abiertas = this.statsAbiertas();
    if (abiertas.has(partido.id)) {
      this.statsAbiertas.update(s => { const n = new Set(s); n.delete(partido.id); return n; });
      return;
    }
    this.statsAbiertas.update(s => new Set(s).add(partido.id));
    this.statsError.update(s => { const n = new Set(s); n.delete(partido.id); return n; });
    this.statsLoading.set(partido.id);
    this.partidosSvc.getStats(partido.id).subscribe({
      next: st => {
        this.stats.update(m => new Map(m).set(partido.id, st));
        this.statsLoading.set(null);
      },
      error: () => {
        this.statsLoading.set(null);
        this.statsError.update(s => new Set(s).add(partido.id));
      },
    });
  }

  getStats(id: number): PartidoStats | undefined { return this.stats().get(id); }

  // ── Cuenta regresiva al cierre de apuestas ────────────────────────────────
  // Las apuestas cierran 5 minutos después de la hora oficial de inicio del
  // partido (ver utils/apuestas.util.ts). this.nowTick() se lee aquí solo
  // para mantener el método reactivo al tick de 1s del componente.
  countdown(partido: Partido): string | null {
    if (this.apuestasCerradas(partido)) return null;
    this.nowTick();
    const diff = msHastaCierre(partido.fecha_partido);
    if (diff <= 0) return null;

    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1000);
    if (d > 0)  return `${d}d ${h}h`;
    if (h > 0)  return `${h}h ${m}m`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  countdownUrgente(partido: Partido): boolean {
    if (this.apuestasCerradas(partido)) return false;
    this.nowTick();
    return msHastaCierre(partido.fecha_partido) < 2 * 60_000; // menos de 2 minutos
  }

  // Bloqueo de tarjeta/inputs/botón: cerrado por flag de BD, por estado, o
  // porque ya pasaron los 5 minutos de margen desde el inicio del partido.
  apuestasCerradas(partido: Partido): boolean {
    this.nowTick();
    if (!partido.apuestas_abiertas || partido.estado !== 'pendiente') return true;
    return apuestasVencidas(partido.fecha_partido);
  }

  setFiltro(chip: FiltroChip) { this.filtroChip.set(chip); }

  openBet(partido: Partido) {
    if (this.apuestasCerradas(partido)) return;
    this.selectedPartido.set(partido);
  }

  onSaved() {
    this.selectedPartido.set(null);
    this.loadData(true);
  }

  closeApoyoBanner() {
    localStorage.setItem(APOYO_BANNER_KEY, '1');
    this.showApoyoBanner.set(false);
  }

  sectionId(titulo: string): string {
    return 'sec-' + titulo.toLowerCase().replace(/[\s·]+/g, '-');
  }

  scrollTo(titulo: string) {
    document.getElementById(this.sectionId(titulo))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  getEstadoBadgeClass(estado: string): string {
    return { pendiente: 'badge-pending', medio_tiempo: 'badge-live', finalizado: 'badge-done' }[estado] ?? '';
  }

  getPuntosClass(pts: number | null): string {
    if (pts === null) return '';
    if (pts >= 7) return 'pts-exact';
    if (pts === 3)  return 'pts-trend';
    return 'pts-miss';
  }
}
