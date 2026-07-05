import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { User } from "@prisma/client";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUserFromGoogle(profile: GoogleProfile): Promise<User> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_subject: { provider: "google", subject: profile.sub } },
    });
    if (identity) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: identity.userId } });
      return this.backfillProfile(user, profile);
    }

    // Auto-link to an existing user by email ONLY when Google asserts the email
    // is verified — prevents an unverified email claim from hijacking an account.
    let user = profile.emailVerified ? await this.prisma.user.findUnique({ where: { email: profile.email } }) : null;

    if (!user) {
      user = await this.prisma.user.create({
        data: { email: profile.email, name: profile.name, avatarUrl: profile.picture },
      });
    } else {
      user = await this.backfillProfile(user, profile);
    }

    await this.prisma.authIdentity.create({
      data: { userId: user.id, provider: "google", subject: profile.sub, email: profile.email },
    });

    return user;
  }

  getById(id: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  // A user seeded before their first Google login (e.g. the imported owner) has
  // no name/avatarUrl until they actually log in — fill those in from the Google
  // profile the first time they're missing, without ever overwriting a value the
  // user (or a future profile-edit feature) already set.
  private async backfillProfile(user: User, profile: GoogleProfile): Promise<User> {
    const data: { name?: string; avatarUrl?: string } = {};
    if (!user.name && profile.name) data.name = profile.name;
    if (!user.avatarUrl && profile.picture) data.avatarUrl = profile.picture;
    if (Object.keys(data).length === 0) return user;
    return this.prisma.user.update({ where: { id: user.id }, data });
  }
}
