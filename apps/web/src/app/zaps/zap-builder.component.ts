import { Component, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';

export interface ConnectedRepository { id: string; fullName: string; enabled: boolean; webhookId?: number }
interface ZapInput {
  name: string; connectionId: string; enabled: boolean;
  trigger: { provider: 'github'; event: 'pull_request.opened' };
  action: { provider: 'github'; type: 'comment'; template: string };
}
interface Zap extends ZapInput { id: string }
@Component({
  selector: 'app-zaps', imports: [FormsModule],
  templateUrl: './zap-builder.html', styleUrl: './zap-builder.css',
})
export class ZapBuilderComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly connections = input<ConnectedRepository[]>([]);
  readonly zaps = signal<Zap[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly editorOpen = signal(false);
  readonly fields = ['pr.title', 'pr.author', 'pr.url', 'repository.fullName'];
  editingId: string | null = null;
  draft: ZapInput = this.emptyDraft();

  constructor() { this.load(); }
  private emptyDraft(): ZapInput {
    return { name: '', connectionId: '', enabled: false,
      trigger: { provider: 'github', event: 'pull_request.opened' },
      action: { provider: 'github', type: 'comment', template: 'Thanks {{pr.author}} for opening "{{pr.title}}"!' },
    };
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<{ zaps: Zap[] }>('/api/zaps').subscribe({
      next: response => { this.zaps.set(response.zaps); this.loading.set(false); },
      error: () => { this.error.set('Could not load your Zaps. Please try again.'); this.loading.set(false); },
    });
  }
  create() {
    this.editingId = null;
    this.draft = this.emptyDraft();
    this.draft.connectionId = this.connections().find(connection => connection.enabled)?.id ?? '';
    this.error.set(''); this.notice.set(''); this.editorOpen.set(true);
  }
  edit(zap: Zap) {
    this.editingId = zap.id;
    this.draft = { name: zap.name, connectionId: zap.connectionId, enabled: zap.enabled,
      trigger: { ...zap.trigger }, action: { ...zap.action } };
    this.error.set(''); this.notice.set(''); this.editorOpen.set(true);
  }
  repositoryName(connectionId: string) {
    return this.connections().find(connection => connection.id === connectionId)?.fullName ?? 'Unavailable repository';
  }
  insert(field: string) { this.draft.action.template += ` {{${field}}}`; }
  get preview() {
    const example: Record<string, string> = {
      'pr.title': 'Improve project documentation', 'pr.author': 'octocat',
      'pr.url': 'https://github.com/example/repository/pull/1',
      'repository.fullName': this.repositoryName(this.draft.connectionId),
    };
    return this.draft.action.template.replace(/\{\{([\s\S]*?)\}\}/g, (match, field: string) => example[field.trim()] ?? match);
  }
  save() {
    if (this.saving()) return;
    this.saving.set(true); this.error.set(''); this.notice.set('');
    const request = this.editingId
      ? this.http.put<{ zap: Zap }>('/api/zaps/' + this.editingId, this.draft, { headers: this.auth.requestHeaders() })
      : this.http.post<{ zap: Zap }>('/api/zaps', this.draft, { headers: this.auth.requestHeaders() });
    request.subscribe({
      next: () => {
        this.saving.set(false); this.editorOpen.set(false); this.notice.set('Zap saved.'); this.load();
      },
      error: response => {
        this.error.set(response.error?.error ?? 'Could not save your Zap. Please try again.');
        this.saving.set(false);
      },
    });
  }
}
