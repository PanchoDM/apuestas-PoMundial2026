import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent {
  user      = computed(() => this.auth.currentUser());
  isAdmin   = computed(() => this.auth.isAdmin());
  menuOpen  = signal(false);

  constructor(public auth: AuthService, private router: Router) {
    this.router.events.subscribe(() => this.menuOpen.set(false));
  }

  toggleMenu() { this.menuOpen.update(v => !v); }
}
