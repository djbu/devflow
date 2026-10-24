import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { ZapBuilderComponent } from '../zaps/zap-builder.component';

interface Connection { id: string; fullName: string; enabled: boolean; webhookId?: number }
interface Execution { zapId: string; deliveryId: string; repository: string; pullRequestNumber: number; status: string; startedAt?: string; commentUrl?: string; error?: string }
@Component({
  selector: 'app-repositories', imports: [FormsModule, DatePipe, ZapBuilderComponent],
  templateUrl: './repository.html', styleUrl: './repository.css',
})
export class RepositoryComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  repository = '';
  readonly connections = signal<Connection[]>([]);
  readonly executions = signal<Execution[]>([]);
  readonly webhookConfigured = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() { this.refresh(); }
  refresh() {
    this.error.set('');
    this.loading.set(true);
    this.http.get<{ connections: Connection[]; webhookConfigured: boolean }>('/api/github/connections').subscribe({
      next: result => {
        this.connections.set(result.connections);
        this.webhookConfigured.set(result.webhookConfigured);
        this.loading.set(false);
      },
      error: () => { this.error.set('Could not load repository connections.'); this.loading.set(false); },
    });
    this.http.get<{ executions: Execution[] }>('/api/executions').subscribe({
      next: result => this.executions.set(result.executions),
      error: () => this.error.set('Could not load execution records.'),
    });
  }
  connect() {
    if (!this.repository.trim() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.http.post('/api/github/connections', { repository: this.repository.trim() }, { headers: this.auth.requestHeaders() }).subscribe({
      next: () => { this.saving.set(false); this.refresh(); },
      error: response => {
        this.error.set(response.error?.error ?? 'Repository connection failed.');
        this.saving.set(false);
      },
    });
  }
}
