import jwt from "jsonwebtoken";

export interface SessionPayload {
  userId: string;
}

export function signSession(payload: SessionPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

export function verifySession(token: string, secret: string): SessionPayload {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string" || !("userId" in decoded)) {
    throw new Error("Invalid session payload");
  }
  return { userId: (decoded as SessionPayload).userId };
}
