import { enrichPoisWithWikimediaImages, getWikimediaPageReference } from "@/lib/geo/wikimedia-images";
import { poiSchema, type Poi } from "@/lib/schemas/trip";

const basePoi: Poi = {
  id: "wikimedia-shanghai-bund",
  name: "外滩",
  address: "上海市黄浦区中山东一路",
  city: "上海",
  country: "CN",
  categories: ["夜景"],
  latitude: 31.2402,
  longitude: 121.4903,
  recommendedDurationMinutes: 90,
  sourcePageUrl: "https://zh.wikipedia.org/wiki/%E5%A4%96%E6%BB%A9"
};

describe("wikimedia image helpers", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses poi schema with or without image metadata", () => {
    expect(poiSchema.parse(basePoi).image).toBeUndefined();

    const parsed = poiSchema.parse({
      ...basePoi,
      image: {
        url: "https://upload.wikimedia.org/example.jpg",
        width: 320,
        height: 240,
        alt: "外滩 图片预览",
        sourcePageUrl: "https://zh.wikipedia.org/wiki/%E5%A4%96%E6%BB%A9",
        provider: "wikimedia"
      }
    });

    expect(parsed.image?.provider).toBe("wikimedia");
  });

  it("extracts a page reference from the stored source page url", () => {
    expect(getWikimediaPageReference(basePoi, "上海")).toMatchObject({
      poiId: basePoi.id,
      host: "zh.wikipedia.org",
      title: "外滩"
    });
  });

  it("fills matching thumbnails and leaves unmatched pois unchanged", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: [
              {
                title: "外滩",
                thumbnail: {
                  source: "https://upload.wikimedia.org/example-bund.jpg",
                  width: 400,
                  height: 260
                }
              },
              {
                title: "未知景点"
              }
            ]
          }
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await enrichPoisWithWikimediaImages(
      [
        basePoi,
        {
          ...basePoi,
          id: "wikimedia-shanghai-unknown",
          name: "未知景点",
          sourcePageUrl: "https://zh.wikipedia.org/wiki/%E6%9C%AA%E7%9F%A5%E6%99%AF%E7%82%B9"
        }
      ],
      "上海"
    );

    expect(result[0].image?.url).toContain("upload.wikimedia.org/example-bund.jpg");
    expect(result[0].image?.sourcePageUrl).toContain("%E5%A4%96%E6%BB%A9");
    expect(result[1].image).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
