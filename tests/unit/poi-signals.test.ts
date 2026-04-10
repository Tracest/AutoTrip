import { normalizePoiCategories } from "@/lib/planning/poi-signals";

describe("poi signals", () => {
  it("会把博物馆从错误的美食分类纠偏回来", () => {
    const categories = normalizePoiCategories("贵阳", {
      name: "贵州民族博物馆",
      address: "贵阳市南明区市府路38号",
      categories: ["美食"],
      openingHoursText: undefined
    });

    expect(categories).toEqual(["博物馆", "历史"]);
  });

  it("会把美食街从错误的历史分类纠偏回来", () => {
    const categories = normalizePoiCategories("贵阳", {
      name: "民生路美食街",
      address: "贵阳市云岩区民生路",
      categories: ["历史"],
      openingHoursText: undefined
    });

    expect(categories).toEqual(["美食"]);
  });
});
