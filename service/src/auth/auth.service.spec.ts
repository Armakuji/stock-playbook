import { AuthService, GoogleProfile } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    authIdentity: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn() },
  } as unknown as PrismaService;
}

const profile: GoogleProfile = {
  sub: "google-sub-1",
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  picture: "https://example.com/pic.jpg",
};

describe("AuthService.findOrCreateUserFromGoogle", () => {
  it("returns the linked user when the identity already exists", async () => {
    const prisma = makePrismaMock();
    (prisma.authIdentity.findUnique as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: "user-1", email: profile.email });

    const service = new AuthService(prisma);
    const user = await service.findOrCreateUserFromGoogle(profile);

    expect(user.id).toBe("user-1");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("links to an existing user by verified email when no identity exists yet", async () => {
    const prisma = makePrismaMock();
    (prisma.authIdentity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "seeded-user", email: profile.email });
    (prisma.authIdentity.create as jest.Mock).mockResolvedValue({});

    const service = new AuthService(prisma);
    const user = await service.findOrCreateUserFromGoogle(profile);

    expect(user.id).toBe("seeded-user");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.authIdentity.create).toHaveBeenCalledWith({
      data: { userId: "seeded-user", provider: "google", subject: profile.sub, email: profile.email },
    });
  });

  it("creates a brand-new user when no identity and no existing user match", async () => {
    const prisma = makePrismaMock();
    (prisma.authIdentity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: "new-user", email: profile.email });
    (prisma.authIdentity.create as jest.Mock).mockResolvedValue({});

    const service = new AuthService(prisma);
    const user = await service.findOrCreateUserFromGoogle(profile);

    expect(user.id).toBe("new-user");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: profile.email, name: profile.name, avatarUrl: profile.picture },
    });
  });

  it("does not auto-link by email when Google reports email_verified: false", async () => {
    const prisma = makePrismaMock();
    (prisma.authIdentity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: "new-user-2", email: profile.email });
    (prisma.authIdentity.create as jest.Mock).mockResolvedValue({});

    const service = new AuthService(prisma);
    await service.findOrCreateUserFromGoogle({ ...profile, emailVerified: false });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalled();
  });
});
