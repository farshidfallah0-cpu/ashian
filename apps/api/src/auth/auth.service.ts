import type { DbClient } from '@ashian/db';
import { eq, schema } from '@ashian/db';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DB } from '../infra/tokens.js';
import type { AuthUser } from './auth.types.js';
import { TokenService, type TokenPair } from './token.service.js';

const { users } = schema;

export interface PublicUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: AuthUser['role'];
  avatarKey: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly tokens: TokenService,
  ) {}

  /** کاربر با این شماره را می‌گیرد یا می‌سازد (ورود و ثبت‌نام یکی است) */
  async loginOrRegister(phone: string): Promise<{ user: PublicUser; pair: TokenPair }> {
    const pg = this.db.primary;
    await pg.insert(users).values({ phone }).onConflictDoNothing({ target: users.phone });
    const [user] = await pg.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!user || user.deletedAt) throw new UnauthorizedException('حساب کاربری در دسترس نیست');
    if (user.status === 'blocked') throw new UnauthorizedException('این حساب مسدود شده است');

    await pg.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const pair = await this.tokens.issue({ id: user.id, role: user.role });
    return { user: this.toPublic(user), pair };
  }

  /** نوسازی نشست با چرخش توکن؛ نقش و وضعیت از دیتابیس تازه خوانده می‌شود */
  async refresh(refreshToken: string): Promise<{ user: PublicUser; pair: TokenPair }> {
    const userId = await this.tokens.consumeRefresh(refreshToken);
    if (!userId) throw new UnauthorizedException('نشست منقضی شده است');
    const user = await this.getUser(userId);
    if (!user) throw new UnauthorizedException('حساب کاربری در دسترس نیست');
    const pair = await this.tokens.issue({ id: user.id, role: user.role });
    return { user, pair };
  }

  async getUser(id: string): Promise<PublicUser | null> {
    const [user] = await this.db.primary.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user || user.deletedAt || user.status === 'blocked') return null;
    return this.toPublic(user);
  }

  async updateProfile(id: string, input: { name?: string; email?: string | null }): Promise<PublicUser> {
    const [user] = await this.db.primary
      .update(users)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new UnauthorizedException('حساب کاربری در دسترس نیست');
    return this.toPublic(user);
  }

  private toPublic(user: typeof users.$inferSelect): PublicUser {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarKey: user.avatarKey,
    };
  }
}
