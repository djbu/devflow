import { Db, MongoServerError } from 'mongodb';

export interface ExecutionClaim {
  userId: string;
  connectionId: string;
  zapId: string;
  deliveryId: string;
  repository: string;
  pullRequestNumber: number;
}
export interface ExecutionRecord extends ExecutionClaim {
  status: 'processing' | 'succeeded' | 'failed';
  startedAt: Date;
  finishedAt?: Date;
  commentId?: number;
  commentUrl?: string;
  error?: string;
}
export interface ExecutionStore {
  claim(input: ExecutionClaim): Promise<boolean>;
  succeed(zapId: string, deliveryId: string, comment: { id: number; url: string }): Promise<void>;
  fail(zapId: string, deliveryId: string, error: string): Promise<void>;
  list(userId: string): Promise<ExecutionRecord[]>;
}
export class MongoExecutionStore implements ExecutionStore {
  private readonly collection;
  constructor(database: Db) { this.collection = database.collection<ExecutionRecord>('executions'); }
  async ensureIndexes() {
    await this.collection.createIndex({ zapId: 1, deliveryId: 1 }, { unique: true });
    await this.collection.createIndex({ userId: 1, startedAt: -1 });
  }
  async claim(input: ExecutionClaim): Promise<boolean> {
    try {
      await this.collection.insertOne({ ...input, status: 'processing', startedAt: new Date() });
      return true;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) return false;
      throw error;
    }
  }
  async succeed(zapId: string, deliveryId: string, comment: { id: number; url: string }) {
    const result = await this.collection.updateOne({ zapId, deliveryId, status: 'processing' }, {
      $set: { status: 'succeeded', commentId: comment.id, commentUrl: comment.url, finishedAt: new Date() },
    });
    if (result.matchedCount !== 1) throw new Error('Execution record is unavailable');
  }
  async fail(zapId: string, deliveryId: string, error: string) {
    const result = await this.collection.updateOne({ zapId, deliveryId, status: 'processing' }, {
      $set: { status: 'failed', error, finishedAt: new Date() },
    });
    if (result.matchedCount !== 1) throw new Error('Execution record is unavailable');
  }
  async list(userId: string): Promise<ExecutionRecord[]> {
    return this.collection.find({ userId }, { projection: { _id: 0 } }).sort({ startedAt: -1 }).limit(20).toArray();
  }
}
