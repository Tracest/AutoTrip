import { normalizeDestinationTerm } from "@/lib/planning/destination";

export type SupportedDestinationOption = {
  value: string;
  sortKey: string;
  aliases: string[];
};

type SupportedDestinationGroup = {
  letter: string;
  options: SupportedDestinationOption[];
};

const supportedDestinationOptionsRaw = [
  { value: "北京", sortKey: "Beijing", aliases: ["北京", "北京市", "beijing", "peking"] },
  { value: "长春", sortKey: "Changchun", aliases: ["长春", "长春市", "changchun"] },
  { value: "长沙", sortKey: "Changsha", aliases: ["长沙", "长沙市", "changsha"] },
  { value: "成都", sortKey: "Chengdu", aliases: ["成都", "成都市", "chengdu"] },
  { value: "重庆", sortKey: "Chongqing", aliases: ["重庆", "重庆市", "chongqing"] },
  { value: "福州", sortKey: "Fuzhou", aliases: ["福州", "福州市", "fuzhou"] },
  { value: "广州", sortKey: "Guangzhou", aliases: ["广州", "广州市", "guangzhou", "canton"] },
  { value: "贵阳", sortKey: "Guiyang", aliases: ["贵阳", "贵阳市", "guiyang"] },
  { value: "海口", sortKey: "Haikou", aliases: ["海口", "海口市", "haikou"] },
  { value: "哈尔滨", sortKey: "Harbin", aliases: ["哈尔滨", "哈尔滨市", "harbin"] },
  { value: "杭州", sortKey: "Hangzhou", aliases: ["杭州", "杭州市", "hangzhou"] },
  { value: "合肥", sortKey: "Hefei", aliases: ["合肥", "合肥市", "hefei"] },
  { value: "呼和浩特", sortKey: "Hohhot", aliases: ["呼和浩特", "呼和浩特市", "hohhot", "huhehaote"] },
  { value: "济南", sortKey: "Jinan", aliases: ["济南", "济南市", "jinan"] },
  { value: "昆明", sortKey: "Kunming", aliases: ["昆明", "昆明市", "kunming"] },
  { value: "兰州", sortKey: "Lanzhou", aliases: ["兰州", "兰州市", "lanzhou"] },
  { value: "拉萨", sortKey: "Lhasa", aliases: ["拉萨", "拉萨市", "lhasa"] },
  { value: "南昌", sortKey: "Nanchang", aliases: ["南昌", "南昌市", "nanchang"] },
  { value: "南京", sortKey: "Nanjing", aliases: ["南京", "南京市", "nanjing"] },
  { value: "南宁", sortKey: "Nanning", aliases: ["南宁", "南宁市", "nanning"] },
  { value: "青岛", sortKey: "Qingdao", aliases: ["青岛", "青岛市", "qingdao"] },
  { value: "三亚", sortKey: "Sanya", aliases: ["三亚", "三亚市", "sanya"] },
  { value: "上海", sortKey: "Shanghai", aliases: ["上海", "上海市", "shanghai"] },
  { value: "沈阳", sortKey: "Shenyang", aliases: ["沈阳", "沈阳市", "shenyang"] },
  { value: "深圳", sortKey: "Shenzhen", aliases: ["深圳", "深圳市", "shenzhen"] },
  { value: "石家庄", sortKey: "Shijiazhuang", aliases: ["石家庄", "石家庄市", "shijiazhuang"] },
  { value: "苏州", sortKey: "Suzhou", aliases: ["苏州", "苏州市", "suzhou"] },
  { value: "台北", sortKey: "Taipei", aliases: ["台北", "台北市", "taipei"] },
  { value: "太原", sortKey: "Taiyuan", aliases: ["太原", "太原市", "taiyuan"] },
  { value: "乌鲁木齐", sortKey: "Urumqi", aliases: ["乌鲁木齐", "乌鲁木齐市", "urumqi", "wulumuqi"] },
  { value: "武汉", sortKey: "Wuhan", aliases: ["武汉", "武汉市", "wuhan"] },
  { value: "厦门", sortKey: "Xiamen", aliases: ["厦门", "厦门市", "xiamen"] },
  { value: "西安", sortKey: "Xian", aliases: ["西安", "西安市", "xian", "xi'an"] },
  { value: "西宁", sortKey: "Xining", aliases: ["西宁", "西宁市", "xining"] },
  { value: "银川", sortKey: "Yinchuan", aliases: ["银川", "银川市", "yinchuan"] },
  { value: "张家界", sortKey: "Zhangjiajie", aliases: ["张家界", "张家界市", "zhangjiajie"] },
  { value: "郑州", sortKey: "Zhengzhou", aliases: ["郑州", "郑州市", "zhengzhou"] },
  { value: "珠海", sortKey: "Zhuhai", aliases: ["珠海", "珠海市", "zhuhai"] }
] as const satisfies ReadonlyArray<SupportedDestinationOption>;

export const supportedDestinationOptions = [...supportedDestinationOptionsRaw].sort((left, right) =>
  left.sortKey.localeCompare(right.sortKey, "en")
);

const supportedDestinationAliasMap = new Map<string, string>();

for (const option of supportedDestinationOptions) {
  for (const alias of [option.value, ...option.aliases]) {
    supportedDestinationAliasMap.set(normalizeDestinationTerm(alias), option.value);
  }
}

export const SUPPORTED_DESTINATION_COUNT = supportedDestinationOptions.length;

export const supportedDestinationGroups = supportedDestinationOptions.reduce<SupportedDestinationGroup[]>(
  (groups, option) => {
    const letter = option.sortKey.slice(0, 1).toUpperCase();
    const currentGroup = groups.at(-1);

    if (!currentGroup || currentGroup.letter !== letter) {
      groups.push({
        letter,
        options: [option]
      });
      return groups;
    }

    currentGroup.options.push(option);
    return groups;
  },
  []
);

export function resolveSupportedPlanningDestination(value: string) {
  return supportedDestinationAliasMap.get(normalizeDestinationTerm(value)) ?? null;
}

export function isSupportedPlanningDestination(value: string) {
  return resolveSupportedPlanningDestination(value) !== null;
}
