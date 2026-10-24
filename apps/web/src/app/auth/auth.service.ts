import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface User {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
}
interface SessionResponse { configured: boolean; user: User | null; csrfToken?: string }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private csrfToken = '';
  readonly user = signal<User | null>(null);
  readonly configured = signal(false);
  readonly loading = signal(true);
  readonly signingOut = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set(new URLSearchParams(window.location.search).has('authError')
      ? 'GitHub sign-in failed or was cancelled. Please try again.' : '');
    this.http.get<SessionResponse>('/api/auth/me').subscribe({
      next: (session) => {
        this.user.set(session.user);
        this.configured.set(session.configured);
        this.csrfToken = session.csrfToken ?? '';
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load your session. Please try again.');
        this.loading.set(false);
      },
    });
  }

  requestHeaders() { return new HttpHeaders({ 'X-Devflow-CSRF': this.csrfToken }); }

  logout() {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.error.set('');
    this.http.post('/api/auth/logout', null, {
      headers: this.requestHeaders(),
    }).subscribe({
      next: () => {
        this.user.set(null);
        this.csrfToken = '';
        this.signingOut.set(false);
      },
      error: () => {
        this.error.set('Could not sign out. Please try again.');
        this.signingOut.set(false);
      },
    });
  }
}
