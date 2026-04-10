import {
  createSyntheticCoordinates,
  isUsefulSupplementalPage
} from "@/lib/geo/wikimedia-provider";
import { getPoiDistanceFromDestination } from "@/lib/planning/destination-geo";

const guiyang = "\u8d35\u9633";

describe("wikimedia supplemental filters", () => {
  it("grounds synthetic coordinates near the requested destination", () => {
    const coordinates = createSyntheticCoordinates(
      `${guiyang}:\u82b1\u679c\u56ed\u53cc\u5b50\u5854:supplemental`,
      guiyang
    );

    const distanceKm = getPoiDistanceFromDestination(guiyang, coordinates);
    expect(distanceKm).not.toBeNull();
    expect(distanceKm).toBeLessThan(80);
  });

  it("rejects administrative region pages", () => {
    expect(
      isUsefulSupplementalPage(
        guiyang,
        "\u8d35\u5dde\u7701",
        "\u8d35\u5dde\u7701\uff0c\u7701\u4f1a\u4e3a\u8d35\u9633\u5e02\u3002",
        "\u57ce\u5e02\u5730\u6807",
        true
      )
    ).toBe(false);
  });

  it("rejects transit lines and media organizations", () => {
    expect(
      isUsefulSupplementalPage(
        guiyang,
        "\u8d35\u9633\u8f68\u9053\u4ea4\u901a1\u53f7\u7ebf",
        "\u8d35\u9633\u8f68\u9053\u4ea4\u901a1\u53f7\u7ebf\u662f\u8d35\u9633\u5e02\u4e00\u6761\u5730\u94c1\u7ebf\u8def\u3002",
        "\u57ce\u5e02\u5730\u6807",
        false
      )
    ).toBe(false);

    expect(
      isUsefulSupplementalPage(
        guiyang,
        "\u8d35\u9633\u5e7f\u64ad\u7535\u89c6\u53f0",
        "\u8d35\u9633\u5e7f\u64ad\u7535\u89c6\u53f0\u662f\u8d35\u9633\u5e02\u7684\u5e7f\u64ad\u7535\u89c6\u673a\u6784\u3002",
        "\u57ce\u5e02\u5730\u6807",
        false
      )
    ).toBe(false);
  });

  it("keeps landmark pages even when upstream coordinates are missing", () => {
    expect(
      isUsefulSupplementalPage(
        guiyang,
        "\u82b1\u679c\u56ed\u53cc\u5b50\u5854",
        "\u82b1\u679c\u56ed\u53cc\u5b50\u5854\u662f\u8d35\u9633\u5357\u660e\u533a\u7684\u6469\u5929\u697c\u5730\u6807\u3002",
        "\u57ce\u5e02\u5730\u6807",
        false
      )
    ).toBe(true);
  });
});
