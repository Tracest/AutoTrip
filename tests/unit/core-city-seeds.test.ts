import { getCoreCitySeedPois } from "@/lib/planning/core-city-seeds";

describe("core city seed pois", () => {
  it("returns cloned seed pois for supported city aliases", () => {
    const fromCanonical = getCoreCitySeedPois("贵阳");
    const fromAlias = getCoreCitySeedPois("Guiyang");
    const hangzhou = getCoreCitySeedPois("Hangzhou");
    const xiamen = getCoreCitySeedPois("Xiamen");
    const sanya = getCoreCitySeedPois("Sanya");
    const zhengzhou = getCoreCitySeedPois("Zhengzhou");

    expect(fromCanonical.length).toBeGreaterThanOrEqual(8);
    expect(fromAlias.length).toBe(fromCanonical.length);
    expect(hangzhou.length).toBeGreaterThanOrEqual(8);
    expect(xiamen.length).toBeGreaterThanOrEqual(8);
    expect(sanya.length).toBeGreaterThanOrEqual(8);
    expect(zhengzhou.length).toBeGreaterThan(0);
    expect(fromCanonical.some((poi) => poi.categories.includes("美食"))).toBe(true);
    expect(fromCanonical.some((poi) => poi.sourcePageUrl?.includes("wikipedia.org"))).toBe(true);
    expect(hangzhou.some((poi) => poi.name === "西湖")).toBe(true);
    expect(xiamen.some((poi) => poi.name === "鼓浪屿")).toBe(true);
    expect(sanya.some((poi) => poi.name === "天涯海角")).toBe(true);
    expect(zhengzhou.some((poi) => poi.name === "二七纪念塔")).toBe(true);

    fromCanonical[0]?.categories.push("测试");

    expect(getCoreCitySeedPois("贵阳")[0]?.categories).not.toContain("测试");
  });

  it("returns an empty list for unsupported cities", () => {
    expect(getCoreCitySeedPois("洛阳")).toEqual([]);
  });
});
