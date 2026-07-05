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
      return this.prisma.user.findUniqueOrThrow({ where: { id: identity.userId } });
    }

    // Auto-link to an existing user by email ONLY when Google asserts the email
    // is verified — prevents an unverified email claim from hijacking an account.
    let user = profile.emailVerified ? await this.prisma.user.findUnique({ where: { email: profile.email } }) : null;

    if (!user) {
      user = await this.prisma.user.create({
        data: { email: profile.email, name: profile.name, avatarUrl: profile.picture },
      });
    }

    await this.prisma.authIdentity.create({
      data: { userId: user.id, provider: "google", subject: profile.sub, email: profile.email },
    });

    return user;
  }

  getById(id: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }
}
