import { TestBed } from '@angular/core/testing';
import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../auth/auth.service';
import { ZapBuilderComponent } from './zap-builder.component';

const connection = { id: '507f1f77bcf86cd799439011', fullName: 'owner/demo', enabled: true };
const zap = {
  id: '507f191e810c19729de860ea', name: 'Welcome', connectionId: connection.id, enabled: true,
  trigger: { provider: 'github' as const, event: 'pull_request.opened' as const },
  action: { provider: 'github' as const, type: 'comment' as const, template: 'Thanks {{pr.author}}' },
};
describe('Zap builder', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ZapBuilderComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { requestHeaders: () => new HttpHeaders({ 'X-Devflow-CSRF': 'csrf' }) } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function fixture() {
    const fixture = TestBed.createComponent(ZapBuilderComponent);
    fixture.componentRef.setInput('connections', [connection]);
    return fixture;
  }
  it('shows loading and empty states, and makes unsupported integrations unavailable', () => {
    const f = fixture();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Loading your Zaps');
    http.expectOne('/api/zaps').flush({ zaps: [] });
    f.componentInstance.create(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No Zaps yet');
    const options = (f.nativeElement as HTMLElement).querySelectorAll<HTMLSelectElement>('#trigger-provider option:disabled');
    expect(options.length).toBe(3);
    expect(Array.from(options).every(option => option.textContent?.includes('unavailable'))).toBe(true);
  });
  it('creates a Zap with a CSRF header and no frontend ownership field', () => {
    const f = fixture();
    http.expectOne('/api/zaps').flush({ zaps: [] });
    f.componentInstance.create();
    f.componentInstance.draft.name = 'Welcome'; f.componentInstance.draft.enabled = true;
    f.componentInstance.save();
    expect(f.componentInstance.saving()).toBe(true);
    const save = http.expectOne('/api/zaps');
    expect(save.request.method).toBe('POST');
    expect(save.request.headers.get('X-Devflow-CSRF')).toBe('csrf');
    expect(save.request.body.userId).toBeUndefined();
    expect(save.request.body.connectionId).toBe(connection.id);
    save.flush({ zap });
    http.expectOne('/api/zaps').flush({ zaps: [zap] });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Zap saved.');
    expect(f.componentInstance.editorOpen()).toBe(false);
  });
  it('edits and disables an existing Zap without mutating the list before saving', () => {
    const f = fixture();
    http.expectOne('/api/zaps').flush({ zaps: [zap] });
    f.componentInstance.edit(zap);
    f.componentInstance.draft.enabled = false;
    f.componentInstance.draft.action.template = 'Edited {{pr.title}}';
    expect(f.componentInstance.zaps()[0].action.template).toBe('Thanks {{pr.author}}');
    f.componentInstance.save();
    const save = http.expectOne('/api/zaps/' + zap.id);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body.enabled).toBe(false);
    save.flush({ zap: { ...zap, enabled: false } });
    http.expectOne('/api/zaps').flush({ zaps: [{ ...zap, enabled: false }] });
    expect(f.componentInstance.zaps()[0].enabled).toBe(false);
  });
  it('preserves the draft and shows a backend validation error when saving fails', () => {
    const f = fixture();
    http.expectOne('/api/zaps').flush({ zaps: [] });
    f.componentInstance.create(); f.componentInstance.draft.name = 'Draft'; f.componentInstance.save();
    http.expectOne('/api/zaps').flush({ error: 'Invalid template' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain('Invalid template');
    expect(f.componentInstance.draft.name).toBe('Draft');
    expect(f.componentInstance.saving()).toBe(false);
    expect(f.componentInstance.editorOpen()).toBe(true);
  });
  it('inserts a supported field and renders a clearly labelled sample preview', () => {
    const f = fixture();
    http.expectOne('/api/zaps').flush({ zaps: [] });
    f.componentInstance.create(); f.componentInstance.draft.action.template = 'Thanks';
    f.componentInstance.insert('pr.author'); f.detectChanges();
    expect(f.componentInstance.draft.action.template).toBe('Thanks {{pr.author}}');
    expect(f.nativeElement.querySelector('[aria-label="Comment preview"]').textContent).toBe('Thanks octocat');
  });
  it('shows a list error and supports reloading', () => {
    const f = fixture();
    http.expectOne('/api/zaps').flush({}, { status: 500, statusText: 'Error' });
    expect(f.componentInstance.error()).toContain('Could not load your Zaps');
    f.componentInstance.load();
    http.expectOne('/api/zaps').flush({ zaps: [] });
    expect(f.componentInstance.error()).toBe('');
  });
});
