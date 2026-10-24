import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { ZapBuilderComponent } from '../zaps/zap-builder.component';

interface Connection { id: string; fullName: string; enabled: boolean; webhookId?: number }
interface Execution { zapId: string; deliveryId: string; repository: string; pullRequestNumber: number; status: string; commentUrl?: string; error?: string }
@Component({
  selector: 'app-repositories', imports: [FormsModule, ZapBuilderComponent],
  template: `
    <section aria-label="Repository integration">
      <h2>Connect a GitHub repository</h2>
      <p>Use a repository you administer. Public repository access is enabled by default.</p>
      @if (!webhookConfigured() && !loading()) { <p>Webhook delivery needs server configuration before connecting.</p> }
      <form (ngSubmit)="connect()">
        <label for="repository">Repository (owner/name)</label>
        <input id="repository" name="repository" [(ngModel)]="repository" required placeholder="owner/repository" />
        <button type="submit" [disabled]="saving() || !webhookConfigured()">{{ saving() ? 'Connecting...' : 'Connect repository' }}</button>
      </form>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (loading()) { <p>Loading repository connections...</p> }
      @else {
        @if (connections().length === 0) { <p>No repositories connected.</p> }
        @for (connection of connections(); track connection.id) {
          <p>{{ connection.fullName }}: {{ connection.enabled ? 'Connected' : 'Connection incomplete' }}</p>
        }
      }
      <app-zaps [connections]="connections()" />
      <h3>Recent executions</h3>
      <button type="button" (click)="refresh()" [disabled]="loading()">Refresh results</button>
      @if (executions().length === 0) { <p>No executions recorded.</p> }
      @for (execution of executions(); track execution.zapId + execution.deliveryId) {
        <p>{{ execution.repository }} #{{ execution.pullRequestNumber }}: {{ execution.status }}
          @if (execution.commentUrl) { <a [href]="execution.commentUrl" target="_blank" rel="noopener noreferrer">View comment</a> }
          @if (execution.error) { <span>{{ execution.error }}</span> }
        </p>
      }
    </section>
  `,
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
