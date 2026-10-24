import { Db, ObjectId } from 'mongodb';
import type { GitHubIdentity } from '../github/github.service.js';
import { decryptToken, encryptToken, type ProtectedToken } from './credentials.js';

export class CredentialUnavailable extends Error {
  constructor() { super('GitHub credentials are unavailable. Sign in again.'); }
}

export interface PublicUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
}
export interface UserStore {
  saveIdentity(identity: GitHubIdentity): Promise<PublicUser>;
  findPublicUser(id: string): Promise<PublicUser | null>;
}
interface UserDocument {
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  accessToken: ProtectedToken;
  scopes: string[];
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
function publicUser(user: UserDocument & { _id: ObjectId }): PublicUser {
  return { id: user._id.toHexString(), login: user.login, name: user.name, avatarUrl: user.avatarUrl, profileUrl: user.profileUrl };
}

export class MongoUserStore implements UserStore {
  private readonly users;
  constructor(database: Db, private readonly encryptionKey: string) {
    this.users = database.collection<UserDocument>('users');
  }
  async ensureIndexes() {
    await this.users.createIndex({ githubId: 1 }, { unique: true });
  }
  async saveIdentity(identity: GitHubIdentity): Promise<PublicUser> {
    const profile = identity.profile;
    const now = new Date();
    const user = await this.users.findOneAndUpdate({ githubId: String(profile.id) }, {
      $set: {
        login: profile.login, name: profile.name, avatarUrl: profile.avatar_url,
        profileUrl: profile.html_url, accessToken: encryptToken(identity.accessToken, this.encryptionKey),
        scopes: identity.scopes, tokenExpiresAt: identity.expiresAt ?? null, updatedAt: now,
      },
      $setOnInsert: { githubId: String(profile.id), createdAt: now },
    }, { upsert: true, returnDocument: 'after' });
    if (!user) throw new Error('Could not persist user');
    return publicUser(user);
  }
  async accessTokenFor(id: string): Promise<string> {
    if (!ObjectId.isValid(id)) throw new CredentialUnavailable();
    const user = await this.users.findOne({ _id: new ObjectId(id) });
    if (!user || (user.tokenExpiresAt && user.tokenExpiresAt.getTime() <= Date.now())) {
      throw new CredentialUnavailable();
    }
    try { return decryptToken(user.accessToken, this.encryptionKey); }
    catch { throw new CredentialUnavailable(); }
  }
  async findPublicUser(id: string): Promise<PublicUser | null> {
    if (!ObjectId.isValid(id)) return null;
    const user = await this.users.findOne({ _id: new ObjectId(id) });
    return user ? publicUser(user) : null;
  }
}
