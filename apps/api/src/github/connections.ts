import { Db, ObjectId } from 'mongodb';
import { createHmac } from 'node:crypto';
import type { RepositoryGateway, RepositoryInfo } from './repository.service.js';

export interface Connection {
  id: string;
  userId: string;
  repositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  webhookId?: number;
  enabled: boolean;
  updatedAt: Date;
}
interface ConnectionDocument extends Omit<Connection, 'id'> { _id: ObjectId }
function connection(document: ConnectionDocument): Connection {
  const { _id, ...fields } = document;
  return { id: _id.toHexString(), ...fields };
}
export interface ConnectionStore {
  reserve(userId: string, repo: RepositoryInfo): Promise<Connection>;
  activate(id: string, userId: string, webhookId: number): Promise<Connection>;
  find(id: string): Promise<Connection | null>;
  list(userId: string): Promise<Connection[]>;
}
export class MongoConnectionStore implements ConnectionStore {
  private readonly collection;
  constructor(database: Db) { this.collection = database.collection<ConnectionDocument>('connections'); }
  async ensureIndexes() { await this.collection.createIndex({ userId: 1, repositoryId: 1 }, { unique: true }); }
  async reserve(userId: string, repo: RepositoryInfo): Promise<Connection> {
    const result = await this.collection.findOneAndUpdate({ userId, repositoryId: repo.id }, {
      $set: { owner: repo.owner, name: repo.name, fullName: repo.fullName, updatedAt: new Date() },
      $setOnInsert: { enabled: false },
    }, { upsert: true, returnDocument: 'after' });
    if (!result) throw new Error('Connection could not be saved');
    return connection(result);
  }
  async activate(id: string, userId: string, webhookId: number): Promise<Connection> {
    const result = await this.collection.findOneAndUpdate({ _id: new ObjectId(id), userId }, {
      $set: { webhookId, enabled: true, updatedAt: new Date() },
    }, { returnDocument: 'after' });
    if (!result) throw new Error('Connection is unavailable');
    return connection(result);
  }
  async find(id: string) {
    if (!ObjectId.isValid(id)) return null;
    const result = await this.collection.findOne({ _id: new ObjectId(id) });
    return result ? connection(result) : null;
  }
  async list(userId: string) { return (await this.collection.find({ userId }).sort({ updatedAt: -1 }).toArray()).map(connection); }
}
export function webhookSecret(master: string, connectionId: string) {
  return createHmac('sha256', master).update(connectionId).digest('hex');
}
export class ConnectionError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export class RepositoryConnectionService {
  constructor(private readonly store: ConnectionStore, private readonly github: RepositoryGateway,
    private readonly tokenFor: (userId: string) => Promise<string>, private readonly publicUrl: string,
    private readonly masterSecret: string) {}

  async connect(userId: string, owner: string, name: string): Promise<Connection> {
    const token = await this.tokenFor(userId);
    const repo = await this.github.repository(token, owner, name);
    if (!repo.admin) throw new ConnectionError('Repository administrator access is required.', 403);
    const saved = await this.store.reserve(userId, repo);
    const url = `${this.publicUrl}/api/github/webhooks/${saved.id}`;
    const hooks = await this.github.hooks(token, repo.owner, repo.name);
    // A recorded hook ID proves ownership. Exact URL matching recovers an
    // interrupted first connection; that URL includes our persisted random ID.
    const tracked = hooks.find(hook => hook.id === saved.webhookId);
    const ownHook = tracked ?? hooks.find(hook => hook.url === url);
    if (tracked) {
      let ownedPath = false;
      try { ownedPath = new URL(tracked.url).pathname === `/api/github/webhooks/${saved.id}`; }
      catch { /* An invalid URL is treated as an externally changed hook. */ }
      if (!ownedPath) throw new ConnectionError('Managed webhook was changed outside Devflow. Inspect repository settings.', 409);
    }
    const hookId = await this.github.saveHook(token, repo.owner, repo.name, url, webhookSecret(this.masterSecret, saved.id), ownHook?.id);
    return this.store.activate(saved.id, userId, hookId);
  }
}
