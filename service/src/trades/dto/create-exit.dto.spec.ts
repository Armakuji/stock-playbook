import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateExitDto } from "./create-exit.dto";

async function validateShares(shares: number) {
  const dto = plainToInstance(CreateExitDto, {
    date: "2026-07-01",
    price: 120,
    shares,
  });
  return validate(dto);
}

describe("CreateExitDto", () => {
  it("rejects shares = 0", async () => {
    const errors = await validateShares(0);
    expect(errors.some((e) => e.property === "shares")).toBe(true);
  });

  it("rejects negative shares", async () => {
    const errors = await validateShares(-2);
    expect(errors.some((e) => e.property === "shares")).toBe(true);
  });

  it("accepts positive shares", async () => {
    const errors = await validateShares(2);
    expect(errors).toHaveLength(0);
  });
});
