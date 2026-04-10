import {
  getDefaultCountryForDestination,
  getDestinationAliases,
  isLikelyDomesticDestination,
  resolvePlanningDestination
} from "@/lib/planning/destination";

const guizhou = "\u8d35\u5dde";
const guiyang = "\u8d35\u9633";
const shanghai = "\u4e0a\u6d77";

describe("destination helpers", () => {
  it("maps broad domestic regions to their provincial capitals for planning", () => {
    expect(resolvePlanningDestination(guizhou)).toBe(guiyang);
    expect(resolvePlanningDestination("Guizhou")).toBe("guiyang");
    expect(resolvePlanningDestination(shanghai)).toBe(shanghai);
  });

  it("includes provincial capital aliases for broad region inputs", () => {
    const aliases = getDestinationAliases(guizhou);

    expect(aliases).toContain("\u8d35\u5dde");
    expect(aliases).toContain("guiyang");
    expect(aliases).toContain("\u8d35\u9633");
  });

  it("treats province aliases as domestic destinations", () => {
    expect(isLikelyDomesticDestination("Guizhou")).toBe(true);
    expect(getDefaultCountryForDestination("Guizhou")).toBe("CN");
  });
});
