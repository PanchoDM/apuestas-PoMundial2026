import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar';
import { LeaderboardService, LeaderboardEntry } from '../../services/leaderboard.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class LeaderboardComponent implements OnInit {
  private svc  = inject(LeaderboardService);
  private auth = inject(AuthService);

  entries  = signal<LeaderboardEntry[]>([]);
  loading  = signal(true);

  currentUser = this.auth.currentUser;

  myEntry = computed(() =>
    this.entries().find(e => e.nombre_usuario === this.currentUser()?.nombre_usuario)
  );

  ngOnInit() {
    this.svc.get().subscribe({
      next: data => { this.entries.set(data); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  getMedalEmoji(pos: number): string {
    return ['🥇', '🥈', '🥉'][pos - 1] ?? `${pos}`;
  }

  isCurrentUser(nombre: string): boolean {
    return nombre === this.currentUser()?.nombre_usuario;
  }

  displayName(nombre: string): string {
    return nombre.split('@')[0];
  }
}
