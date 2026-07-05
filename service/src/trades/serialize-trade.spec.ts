import { serializeTrade } from "./serialize-trade";

describe("serializeTrade", () => {
  it("converts entryDate and exit dates from Date objects to YYYY-MM-DD strings", () => {
    const trade = {
      id: "t1",
      entryDate: new Date("2026-07-01T00:00:00.000Z"),
      exits: [
        { id: "e1", date: new Date("2026-07-10T00:00:00.000Z"), price: 120 },
        { id: "e2", date: new Date("2026-07-15T00:00:00.000Z"), price: 130 },
      ],
    };

    const result = serializeTrade(trade);

    expect(result.entryDate).toBe("2026-07-01");
    expect(result.exits[0].date).toBe("2026-07-10");
    expect(result.exits[1].date).toBe("2026-07-15");
  });

  it("leaves entryDate untouched when it's already a string (defensive, not expected from Prisma)", () => {
    const trade = {
      id: "t1",
      entryDate: "2026-07-01",
      exits: [] as { date: unknown }[],
    };
    expect(serializeTrade(trade).entryDate).toBe("2026-07-01");
  });

  it("leaves a missing/undefined exits field as-is instead of throwing (findOne has no include)", () => {
    const trade: { id: string; entryDate: Date; exits?: unknown } = {
      id: "t1",
      entryDate: new Date("2026-07-01T00:00:00.000Z"),
    };
    const result = serializeTrade(trade);
    expect(result.exits).toBeUndefined();
    expect(result.entryDate).toBe("2026-07-01");
  });
});
