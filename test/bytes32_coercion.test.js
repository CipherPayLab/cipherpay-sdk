import { describe, it, expect } from "vitest";
import { beBytes32 } from "../src/utils/big.js";
describe("beBytes32", () => {
    it("encodes 0x01 to last byte", () => {
        const b = beBytes32(1n);
        expect(b[31]).toBe(1);
        expect([...b.slice(0, 31)].every((v) => v === 0)).toBe(true);
    });
    it("encodes large value", () => {
        const x = 2n ** 256n - 1n;
        const b = beBytes32(x);
        expect(b.every((v) => v === 0xff)).toBe(true);
    });
});
