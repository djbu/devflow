import { Db, ObjectId } from 'mongodb';
import { z } from 'zod';
import { validateTemplate } from './template.js';

export const zapSchema = z.object({
  name: z.string().trim().min(1).max(100),
  connectionId: z.string().regex(/^[a-f0-9]{24}$/),
  enabled: z.boolean(),
  trigger: z.object({ provider: z.literal('github'), event: z.literal('pull_request.opened') }).strict(),
  action: z.object({ provider: z.literal('github'), type: z.literal('comment'), template: z.string() }).strict(),
}).strict().superRefine((zap, context) => {
  try { validateTemplate(zap.action.template); }
  catch { context.addIssue({ code: 'custom', path: ['action', 'template'], message: 'Use a nonempty comment with only supported mapping variables.' }); }
});
export type ZapInput = z.infer<typeof zapSchema>;
export interface Zap extends ZapInput { id: string; userId: string; createdAt: Date; updatedAt: Date }
interface ZapDocument extends Omit<Zap, 'id'> { _id: ObjectId }
function publicZap(document: ZapDocument): Zap {
  const { _id, ...fields } = document;
  return { id: _id.toHexString(), ...fields };
}
export interface ZapStore {
  list(userId: string): Promise<Zap[]>;
  findOwned(id: string, userId: string): Promise<Zap | null>;
  create(userId: string, input: ZapInput): Promise<Zap>;
  updateOwned(id: string, userId: string, input: ZapInput): Promise<Zap | null>;
  enabledForConnection(connectionId: string, userId: string): Promise<Zap[]>;
}
export class MongoZapStore implements ZapStore {
  private readonly collection;
  constructor(database: Db) { this.collection = database.collection<ZapDocument>('zaps'); }
  async ensureIndexes() {
    await this.collection.createIndex({ userId: 1, updatedAt: -1 });
    await this.collection.createIndex({ connectionId: 1, userId: 1, enabled: 1 });
  }
  async list(userId: string) {
    return (await this.collection.find({ userId }).sort({ updatedAt: -1 }).toArray()).map(publicZap);
  }
  async findOwned(id: string, userId: string) {
    if (!ObjectId.isValid(id)) return null;
    const result = await this.collection.findOne({ _id: new ObjectId(id), userId });
    return result ? publicZap(result) : null;
  }
  async create(userId: string, input: ZapInput): Promise<Zap> {
    const document: ZapDocument = { ...input, _id: new ObjectId(), userId, createdAt: new Date(), updatedAt: new Date() };
    await this.collection.insertOne(document);
    return publicZap(document);
  }
  async updateOwned(id: string, userId: string, input: ZapInput): Promise<Zap | null> {
    if (!ObjectId.isValid(id)) return null;
    const result = await this.collection.findOneAndUpdate({ _id: new ObjectId(id), userId }, {
      $set: { ...input, updatedAt: new Date() },
    }, { returnDocument: 'after' });
    return result ? publicZap(result) : null;
  }
  async enabledForConnection(connectionId: string, userId: string) {
    return (await this.collection.find({ connectionId, userId, enabled: true,
      'trigger.provider': 'github', 'trigger.event': 'pull_request.opened',
      'action.provider': 'github', 'action.type': 'comment',
    }).toArray()).map(publicZap);
  }
}
