import { Component, computed } from '@angular/core';
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
  isMenuOpen = false;

  constructor(public auth: AuthService, private router: Router) {
    this.router.events.subscribe(() => { this.isMenuOpen = false; });
  }

  toggleMenu() { this.isMenuOpen = !this.isMenuOpen; }
  closeMenu()  { this.isMenuOpen = false; }
}
