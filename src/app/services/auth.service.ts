import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse, Usuario } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'pollamundial2026_token';
  private readonly USER_KEY  = 'pollamundial2026_user';

  currentUser = signal<Usuario | null>(this.loadUser());

  constructor(private http: HttpClient, private router: Router) {}

  login(nombre_usuario: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { nombre_usuario, password })
      .pipe(tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
        this.currentUser.set(res.user);
      }));
  }

  register(nombre_usuario: string, password: string) {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/register`, { nombre_usuario, password });
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    return this.currentUser()?.rol === 'admin';
  }

  private loadUser(): Usuario | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
