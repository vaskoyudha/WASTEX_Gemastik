import { formatRupiah } from "./format";

describe("formatRupiah", () => {
  it("formats 0 as Rp 0", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("formats 15000 as Rp 15.000", () => {
    expect(formatRupiah(15000)).toBe("Rp 15.000");
  });

  it("formats 1250000 as Rp 1.250.000", () => {
    expect(formatRupiah(1250000)).toBe("Rp 1.250.000");
  });
});
