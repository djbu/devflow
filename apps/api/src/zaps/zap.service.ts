import type { ConnectionStore } from '../github/connections.js';
import type { ZapInput, ZapStore } from './zap-store.js';

export class ZapUnavailable extends Error {}
export class ZapService {
  constructor(private readonly zaps: ZapStore, private readonly connections: ConnectionStore) {}
  private async validateConnection(userId: string, connectionId: string) {
    const connection = await this.connections.find(connectionId);
    if (!connection || connection.userId !== userId || !connection.enabled || !connection.webhookId) {
      throw new ZapUnavailable('Connected repository is unavailable. Connect a repository you administer first.');
    }
  }
  async create(userId: string, input: ZapInput) {
    await this.validateConnection(userId, input.connectionId);
    return this.zaps.create(userId, input);
  }
  async update(id: string, userId: string, input: ZapInput) {
    if (!await this.zaps.findOwned(id, userId)) throw new ZapUnavailable('Zap not found');
    await this.validateConnection(userId, input.connectionId);
    const zap = await this.zaps.updateOwned(id, userId, input);
    if (!zap) throw new ZapUnavailable('Zap not found');
    return zap;
  }
}
