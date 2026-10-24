import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth/auth.service';
import { RepositoryComponent } from './github/repository.component';

@Component({
  selector: 'app-root',
  imports: [RepositoryComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly status = signal('Checking API and database...');
  private readonly http = inject(HttpClient);

  constructor() {
    this.auth.load();
    this.http.get<{ status: string; database: string }>('/api/health').subscribe({
      next: (health) => this.status.set(
        health.status === 'ok' && health.database === 'connected'
          ? 'API and MongoDB are connected.'
          : 'API or database is unavailable.',
      ),
      error: () => this.status.set('API or database is unavailable. Check the API and MongoDB, then reload.'),
    });
  }
}
