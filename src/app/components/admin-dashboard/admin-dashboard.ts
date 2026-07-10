import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PartidosService } from '../../services/partidos.service';
import { Partido, PartidoStats, ResumenAdmin } from '../../models/models';
import { NavbarComponent } from '../navbar/navbar';
import { CountryAutocompleteComponent } from '../country-autocomplete/country-autocomplete';
import { ResultadoModalComponent } from '../resultado-modal/resultado-modal';
import { FlagPipe } from '../../pipes/flag.pipe';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, NavbarComponent, ReactiveFormsModule, FormsModule,
            CountryAutocompleteComponent, ResultadoModalComponent, FlagPipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboardComponent implements OnInit {
  // ── Estado de lista ───────────────────────────────────────────────────────
  partidos         = signal<Partido[]>([]);
  loading          = signal(true);
  toggling         = signal<number | null>(null);
  showForm         = signal(false);
  saving           = signal(false);
  selectedPartido  = signal<Partido | null>(null);
  confirmingDelete = signal<number | null>(null);
  deleting         = signal<number | null>(null);
  togglingVis      = signal<number | null>(null);
  showAll          = signal(true);

  // ── v2.1: resumen, búsqueda, penales, stats y acciones masivas ───────────
  resumen          = signal<ResumenAdmin | null>(null);
  busqueda         = signal('');
  togglingPenales  = signal<number | null>(null);
  statsPartido     = signal<PartidoStats | null>(null);
  statsDe          = signal<Partido | null>(null);
  confirmCerrarTodas = signal(false);
  cerrandoTodas    = signal(false);

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebarOpen   = signal(false);
  selectedGrupo = signal<string | null>(null);   // 'A'..'L' o null
  selectedFase  = signal<string | null>(null);   // knockout o null

  // Datos estáticos del sidebar — se usan en el template con @for
  readonly grupos = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  readonly jornadas = [1, 2, 3];
  readonly fasesEliminacion = [
    { key: '16avos',  label: 'Dieciseisavos de Final' },
    { key: 'octavos', label: 'Octavos de Final' },
    { key: 'cuartos', label: 'Cuartos de Final' },
    { key: 'semifinal', label: 'Semifinal' },
    { key: 'tercero', label: 'Tercer Lugar' },
    { key: 'final',   label: 'Final' },
  ];

  // ── Visibilidad de fases (Interruptores Maestros) ────────────────────────
  togglingFaseVis = signal<string | null>(null);

  visibilidadGrupos = computed(() => {
    const map = new Map<string, boolean>();
    for (const g of this.grupos) {
      const ps = this.partidos().filter(p => p.grupo === g);
      if (ps.length) map.set(g, ps.every(p => p.visible_usuarios));
    }
    return map;
  });

  visibilidadRondas = computed(() => {
    const map = new Map<string, boolean>();
    for (const f of this.fasesEliminacion) {
      const ps = this.partidos().filter(p => p.ronda === f.key);
      if (ps.length) map.set(f.key, ps.every(p => p.visible_usuarios));
    }
    return map;
  });

  toggleVisibilidadFase(tipo: 'grupo' | 'ronda', valor: string) {
    const mapa   = tipo === 'grupo' ? this.visibilidadGrupos() : this.visibilidadRondas();
    const newVis = !(mapa.get(valor) ?? true);
    const key    = `${tipo}:${valor}`;
    this.togglingFaseVis.set(key);
    this.svc.setVisibilidadFase(tipo, valor, newVis).subscribe({
      next: () => {
        this.partidos.update(list => list.map(p => {
          if (tipo === 'grupo' && p.grupo === valor) return { ...p, visible_usuarios: newVis };
          if (tipo === 'ronda' && p.ronda === valor) return { ...p, visible_usuarios: newVis };
          return p;
        }));
        this.togglingFaseVis.set(null);
      },
      error: () => this.togglingFaseVis.set(null),
    });
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  filteredPartidos = computed(() => {
    let list = this.partidos();
    if (!this.showAll()) {
      list = list.filter(p => p.estado !== 'finalizado' && p.apuestas_abiertas);
    }
    const grupo = this.selectedGrupo();
    const fase  = this.selectedFase();
    if (grupo) list = list.filter(p => p.grupo === grupo);
    if (fase)  list = list.filter(p => p.ronda === fase);

    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.equipo_local.toLowerCase().includes(q) ||
        p.equipo_visitante.toLowerCase().includes(q) ||
        String(p.id) === q);
    }
    return list;
  });

  hiddenCount = computed(() => this.partidos().length - this.filteredPartidos().length);

  // Label descriptivo del filtro activo para el header de la tabla
  activeFilterLabel = computed(() => {
    const g = this.selectedGrupo();
    const f = this.selectedFase();
    if (g) return `Grupo ${g}`;
    if (f) return this.fasesEliminacion.find(x => x.key === f)?.label ?? f;
    return null;
  });

  // ── Formulario ────────────────────────────────────────────────────────────
  formError   = '';
  formSuccess = '';
  form: FormGroup;

  constructor(private svc: PartidosService, private fb: FormBuilder) {
    this.form = this.fb.group({
      equipo_local:     ['', Validators.required],
      equipo_visitante: ['', Validators.required],
      fecha_partido:    ['', Validators.required],
      grupo:            ['', Validators.required],
      jornada:          ['', Validators.required],
    });
  }

  ngOnInit() { this.loadPartidos(); this.loadResumen(); }

  loadResumen() {
    this.svc.getResumen().subscribe({ next: r => this.resumen.set(r), error: () => {} });
  }

  loadPartidos() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: p => { this.partidos.set(p); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  // ── Acciones sidebar ──────────────────────────────────────────────────────
  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  closeSidebar()  { this.sidebarOpen.set(false); }

  selectGrupo(g: string) {
    this.selectedGrupo.set(g);
    this.selectedFase.set(null);
    this.sidebarOpen.set(false);
  }

  selectFase(f: string) {
    this.selectedFase.set(f);
    this.selectedGrupo.set(null);
    this.sidebarOpen.set(false);
  }

  clearFilter() {
    this.selectedGrupo.set(null);
    this.selectedFase.set(null);
    this.sidebarOpen.set(false);
  }

  // ── Acciones tabla ────────────────────────────────────────────────────────
  toggle(id: number) {
    this.toggling.set(id);
    this.svc.toggleApuestas(id).subscribe({
      next: updated => {
        this.partidos.update(list =>
          list.map(p => p.id === +updated.id ? { ...p, apuestas_abiertas: updated.apuestas_abiertas } : p)
        );
        this.toggling.set(null);
      },
      error: () => this.toggling.set(null),
    });
  }

  openResultado(partido: Partido)  { this.selectedPartido.set(partido); }
  onResultadoSaved() { this.selectedPartido.set(null); this.loadPartidos(); }

  pedirConfirmacionEliminar(id: number) {
    this.confirmingDelete.set(id);
    setTimeout(() => {
      if (this.confirmingDelete() === id) this.confirmingDelete.set(null);
    }, 5000);
  }

  toggleVisibilidad(id: number) {
    this.togglingVis.set(id);
    this.svc.toggleVisibilidad(id).subscribe({
      next: updated => {
        this.partidos.update(list =>
          list.map(p => p.id === +updated.id ? { ...p, visible_usuarios: updated.visible_usuarios } : p)
        );
        this.togglingVis.set(null);
      },
      error: () => this.togglingVis.set(null),
    });
  }

  eliminar(id: number) {
    this.deleting.set(id);
    this.svc.eliminar(id).subscribe({
      next: () => {
        this.partidos.update(list => list.filter(p => p.id !== id));
        this.confirmingDelete.set(null);
        this.deleting.set(null);
      },
      error: () => { this.confirmingDelete.set(null); this.deleting.set(null); },
    });
  }

  // ── v2.1: penales ─────────────────────────────────────────────────────────
  togglePenales(id: number) {
    this.togglingPenales.set(id);
    this.svc.togglePenales(id).subscribe({
      next: updated => {
        this.partidos.update(list => list.map(p => p.id === +updated.id
          ? { ...p, penales_habilitados: updated.penales_habilitados,
              penales_local: updated.penales_habilitados ? (p.penales_local ?? 0) : null,
              penales_visitante: updated.penales_habilitados ? (p.penales_visitante ?? 0) : null }
          : p));
        this.togglingPenales.set(null);
      },
      error: () => this.togglingPenales.set(null),
    });
  }

  // ── v2.1: distribución de apuestas por partido ───────────────────────────
  verStats(partido: Partido) {
    this.statsDe.set(partido);
    this.statsPartido.set(null);
    this.svc.getStats(partido.id).subscribe({
      next: st => this.statsPartido.set(st),
      error: () => this.statsDe.set(null),
    });
  }

  cerrarStats() { this.statsDe.set(null); this.statsPartido.set(null); }

  // ── v2.1: cerrar todas las apuestas ──────────────────────────────────────
  cerrarTodas() {
    if (!this.confirmCerrarTodas()) {
      this.confirmCerrarTodas.set(true);
      setTimeout(() => this.confirmCerrarTodas.set(false), 5000);
      return;
    }
    this.cerrandoTodas.set(true);
    this.svc.cerrarTodas().subscribe({
      next: () => {
        this.partidos.update(list => list.map(p => ({ ...p, apuestas_abiertas: false })));
        this.cerrandoTodas.set(false);
        this.confirmCerrarTodas.set(false);
        this.loadResumen();
      },
      error: () => { this.cerrandoTodas.set(false); this.confirmCerrarTodas.set(false); },
    });
  }

  submitPartido() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.formError   = '';
    this.formSuccess = '';

    const raw = this.form.value;
    this.svc.crear({
      equipo_local:     raw.equipo_local.trim(),
      equipo_visitante: raw.equipo_visitante.trim(),
      fecha_partido:    raw.fecha_partido + ':00',
      grupo:            raw.grupo,
      jornada:          +raw.jornada,
    }).subscribe({
      next: nuevo => {
        this.saving.set(false);
        this.formSuccess = `✓ "${nuevo.equipo_local} vs ${nuevo.equipo_visitante}" creado en Grupo ${nuevo.grupo}`;
        this.form.reset();
        this.loadPartidos();
        setTimeout(() => { this.formSuccess = ''; this.showForm.set(false); }, 2500);
      },
      error: err => {
        this.saving.set(false);
        this.formError = err.error?.message || 'Error al crear partido';
      },
    });
  }
}
