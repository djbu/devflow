import { config as loadEnvironment } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { createApp, createPublicWebhookApp } from './app.js';
import { GitHubRepositoryService } from './github/repository.service.js';
import { MongoConnectionStore, RepositoryConnectionService } from './github/connections.js';
import { MongoExecutionStore } from './executions/execution-store.js';
import { WebhookProcessor } from './github/webhook.processor.js';
import { createWebhookRouter } from './github/webhook.routes.js';
import { createGitHubRouter } from './github/github.routes.js';
import { createExecutionRouter } from './executions/execution.routes.js';
import { EnvironmentError, readConfig } from './config.js';
import { MongoZapStore } from './zaps/zap-store.js';
import { ZapService } from './zaps/zap.service.js';
import { createZapRouter } from './zaps/zap.routes.js';
import MongoStore from 'connect-mongo';
import { MongoUserStore } from './auth/user-store.js';
import { createSessionMiddleware } from './auth/session.js';
import { createAuthRouter } from './auth/auth.routes.js';
import { GitHubService } from './github/github.service.js';

loadEnvironment({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

async function start() {
  const config = readConfig(process.env);
  const client = new MongoClient(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const database = client.db();
    const checkDatabase = () => database.command({ ping: 1 }, { timeoutMS: 5000 });
    await checkDatabase();
    const users = new MongoUserStore(database, config.TOKEN_ENCRYPTION_KEY);
    await users.ensureIndexes();
    await database.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
    const store = MongoStore.create({ client, dbName: database.databaseName, autoRemove: 'disabled' });
    store.on('error', () => console.error('Session storage is unavailable.'));
    const secure = config.NODE_ENV === 'production';
    const github = config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET
      ? new GitHubService({ clientId: config.GITHUB_CLIENT_ID, clientSecret: config.GITHUB_CLIENT_SECRET,
          callbackUrl: config.GITHUB_CALLBACK_URL, scope: config.GITHUB_SCOPES })
      : undefined;
    const connections = new MongoConnectionStore(database);
    const executions = new MongoExecutionStore(database);
    await connections.ensureIndexes();
    await executions.ensureIndexes();
    const repositoryGitHub = new GitHubRepositoryService();
    const tokenFor = (userId: string) => users.accessTokenFor(userId);
    const zaps = new MongoZapStore(database);
    await zaps.ensureIndexes();
    const connectionService = config.WEBHOOK_PUBLIC_URL && config.GITHUB_WEBHOOK_SECRET
      ? new RepositoryConnectionService(connections, repositoryGitHub, tokenFor, config.WEBHOOK_PUBLIC_URL, config.GITHUB_WEBHOOK_SECRET)
      : undefined;
    const processor = new WebhookProcessor(connections, executions, repositoryGitHub, tokenFor, zaps);
    const webhooks = createWebhookRouter(config.GITHUB_WEBHOOK_SECRET, processor);
    const app = createApp(checkDatabase, {
      session: createSessionMiddleware(store, config.SESSION_SECRET, secure),
      router: createAuthRouter({ users, github, clientId: config.GITHUB_CLIENT_ID,
        appOrigin: config.APP_ORIGIN, callbackUrl: config.GITHUB_CALLBACK_URL,
        scope: config.GITHUB_SCOPES, secure }),
    }, { webhooks, github: createGitHubRouter(connections, connectionService),
      executions: createExecutionRouter(executions), zaps: createZapRouter(zaps, new ZapService(zaps, connections)) });
    // Local development uses the Angular proxy; production requires one trusted TLS proxy.
    if (secure) app.set('trust proxy', 'loopback');
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const listener = app.listen(config.PORT, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    const webhookApp = createPublicWebhookApp(webhooks);
    const webhookServer = await new Promise<ReturnType<typeof webhookApp.listen>>((resolve, reject) => {
      const listener = webhookApp.listen(config.WEBHOOK_PORT, '127.0.0.1', () => resolve(listener));
      listener.once('error', error => { server.close(); reject(error); });
    });
    console.log(`API listening at http://127.0.0.1:${config.PORT}`);
    console.log(`Webhook-only listener at http://127.0.0.1:${config.WEBHOOK_PORT}`);

    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => process.exit(1), 10_000).unref();
      void Promise.all([
        new Promise<void>(resolve => server.close(() => resolve())),
        new Promise<void>(resolve => webhookServer.close(() => resolve())),
      ]).then(() => client.close()).then(() => {
        clearTimeout(deadline);
        process.exit(0);
      }).catch(() => process.exit(1));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    await client.close();
    throw error;
  }
}

void start().catch(error => {
  console.error(error instanceof EnvironmentError ? error.message
    : 'API startup failed. Check MongoDB connectivity, database/index permissions, and port availability.');
  process.exitCode = 1;
});
