import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('Connection and authentication status', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows loading and then confirms the API/database connection', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/auth/me').flush({ configured: false, user: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Checking API and database');
    http.expectOne('/api/health').flush({ status: 'ok', database: 'connected' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('API and MongoDB are connected.');
  });

  it('shows a useful failure state when the API returns 503', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/auth/me').flush({ configured: false, user: null });
    http.expectOne('/api/health').flush({}, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('API or database is unavailable.');
  });

  it('shows login for an anonymous user when GitHub is configured', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/health').flush({ status: 'ok', database: 'connected' });
    http.expectOne('/api/auth/me').flush({ configured: true, user: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.login').getAttribute('href')).toBe('/api/auth/github');
  });

  it('shows account details and signs out with the request token', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/health').flush({ status: 'ok', database: 'connected' });
    http.expectOne('/api/auth/me').flush({ configured: true, user: { id: 'id', login: 'test-user', name: 'Test', profileUrl: 'https://github.com/test-user' }, csrfToken: 'csrf' });
    fixture.detectChanges();
    http.expectOne('/api/github/connections').flush({ connections: [], webhookConfigured: false });
    http.expectOne('/api/executions').flush({ executions: [] });
    fixture.detectChanges();
    http.expectOne('/api/zaps').flush({ zaps: [] });
    expect(fixture.nativeElement.textContent).toContain('Signed in as test-user');
    fixture.nativeElement.querySelector('section[aria-label="GitHub account"] > button').click();
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.method).toBe('POST');
    expect(logout.request.headers.get('X-Devflow-CSRF')).toBe('csrf');
    logout.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.login')).not.toBeNull();
  });

  it('reports session loading failures', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/health').flush({ status: 'ok', database: 'connected' });
    http.expectOne('/api/auth/me').flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Could not load your session');
  });
});
