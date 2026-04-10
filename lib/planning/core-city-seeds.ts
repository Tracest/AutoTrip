import { normalizeDestinationTerm } from "@/lib/planning/destination";
import type { Poi } from "@/lib/schemas/trip";

type CoreCitySeedGroup = {
  aliases: string[];
  pois: Poi[];
};

function buildWikipediaUrl(title: string) {
  return `https://zh.wikipedia.org/wiki/${encodeURIComponent(title)}`;
}

const coreCitySeedGroups = [
  {
    aliases: ["贵阳", "贵阳市", "guiyang"],
    pois: [
      {
        id: "seed-guiyang-jiaxiu",
        name: "甲秀楼",
        address: "贵阳市南明区翠微巷8号",
        city: "贵阳",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 26.573484,
        longitude: 106.715154,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("甲秀楼")
      },
      {
        id: "seed-guiyang-qingyun",
        name: "青云市集",
        address: "贵阳市南明区青云路东段",
        city: "贵阳",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 26.565984,
        longitude: 106.722675,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-guiyang-museum",
        name: "贵州省博物馆",
        address: "贵阳市观山湖区林城东路107号",
        city: "贵阳",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 26.647661,
        longitude: 106.624805,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("贵州省博物馆")
      },
      {
        id: "seed-guiyang-qianling",
        name: "黔灵山公园",
        address: "贵阳市云岩区枣山路187号",
        city: "贵阳",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 26.600328,
        longitude: 106.694948,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("黔灵山公园")
      },
      {
        id: "seed-guiyang-wenchang",
        name: "文昌阁",
        address: "贵阳市云岩区文昌北路",
        city: "贵阳",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 26.586835,
        longitude: 106.723433,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("文昌阁_(贵阳)")
      },
      {
        id: "seed-guiyang-siwa",
        name: "丝恋丝娃娃",
        address: "贵阳市南明区护国路",
        city: "贵阳",
        country: "CN",
        categories: ["美食", "餐饮"],
        latitude: 26.579519,
        longitude: 106.714933,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-guiyang-minsheng",
        name: "民生路美食街",
        address: "贵阳市云岩区民生路",
        city: "贵阳",
        country: "CN",
        categories: ["美食", "小吃"],
        latitude: 26.585347,
        longitude: 106.711326,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-guiyang-dongshan",
        name: "东山公园观景台",
        address: "贵阳市云岩区东山路",
        city: "贵阳",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 26.593843,
        longitude: 106.733484,
        recommendedDurationMinutes: 60
      }
    ]
  },
  {
    aliases: ["上海", "上海市", "shanghai"],
    pois: [
      {
        id: "seed-shanghai-bund",
        name: "外滩",
        address: "上海市黄浦区中山东一路",
        city: "上海",
        country: "CN",
        categories: ["夜景", "历史"],
        latitude: 31.240038,
        longitude: 121.490317,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("外滩")
      },
      {
        id: "seed-shanghai-museum",
        name: "上海博物馆",
        address: "上海市黄浦区人民大道201号",
        city: "上海",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 31.228376,
        longitude: 121.474095,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("上海博物馆")
      },
      {
        id: "seed-shanghai-yuyuan",
        name: "豫园",
        address: "上海市黄浦区福佑路168号",
        city: "上海",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 31.227316,
        longitude: 121.492577,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("豫园")
      },
      {
        id: "seed-shanghai-oriental-pearl",
        name: "东方明珠广播电视塔",
        address: "上海市浦东新区世纪大道1号",
        city: "上海",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 31.239693,
        longitude: 121.499809,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("东方明珠广播电视塔")
      },
      {
        id: "seed-shanghai-tianzifang",
        name: "田子坊",
        address: "上海市黄浦区泰康路210弄",
        city: "上海",
        country: "CN",
        categories: ["美食", "拍照"],
        latitude: 31.209821,
        longitude: 121.468522,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("田子坊")
      },
      {
        id: "seed-shanghai-chenghuang",
        name: "城隍庙",
        address: "上海市黄浦区方浜中路",
        city: "上海",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 31.227123,
        longitude: 121.492028,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("上海城隍庙")
      },
      {
        id: "seed-shanghai-shenda",
        name: "沈大成",
        address: "上海市黄浦区南京东路636号",
        city: "上海",
        country: "CN",
        categories: ["美食", "点心"],
        latitude: 31.236842,
        longitude: 121.479083,
        recommendedDurationMinutes: 60
      },
      {
        id: "seed-shanghai-tower",
        name: "上海中心大厦",
        address: "上海市浦东新区银城中路501号",
        city: "上海",
        country: "CN",
        categories: ["夜景", "建筑"],
        latitude: 31.233568,
        longitude: 121.505504,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("上海中心大厦")
      }
    ]
  },
  {
    aliases: ["北京", "北京市", "beijing", "peking"],
    pois: [
      {
        id: "seed-beijing-forbidden-city",
        name: "故宫博物院",
        address: "北京市东城区景山前街4号",
        city: "北京",
        country: "CN",
        categories: ["历史", "博物馆"],
        latitude: 39.916344,
        longitude: 116.397155,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("故宫")
      },
      {
        id: "seed-beijing-jingshan",
        name: "景山公园",
        address: "北京市西城区景山西街44号",
        city: "北京",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 39.924037,
        longitude: 116.396243,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("景山公园")
      },
      {
        id: "seed-beijing-summer-palace",
        name: "颐和园",
        address: "北京市海淀区新建宫门路19号",
        city: "北京",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 39.999914,
        longitude: 116.275486,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("颐和园")
      },
      {
        id: "seed-beijing-temple-heaven",
        name: "天坛公园",
        address: "北京市东城区天坛东路甲1号",
        city: "北京",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 39.882184,
        longitude: 116.406605,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("天坛")
      },
      {
        id: "seed-beijing-nanluo",
        name: "南锣鼓巷",
        address: "北京市东城区南锣鼓巷",
        city: "北京",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 39.937516,
        longitude: 116.403688,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("南锣鼓巷")
      },
      {
        id: "seed-beijing-huguosi",
        name: "护国寺小吃",
        address: "北京市西城区护国寺街93号",
        city: "北京",
        country: "CN",
        categories: ["美食", "小吃"],
        latitude: 39.929557,
        longitude: 116.373919,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-beijing-shichahai",
        name: "什刹海",
        address: "北京市西城区前海西街",
        city: "北京",
        country: "CN",
        categories: ["夜景", "历史"],
        latitude: 39.940973,
        longitude: 116.385984,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("什刹海")
      },
      {
        id: "seed-beijing-quanjude",
        name: "全聚德前门店",
        address: "北京市东城区前门大街30号",
        city: "北京",
        country: "CN",
        categories: ["美食", "餐饮"],
        latitude: 39.899944,
        longitude: 116.397887,
        recommendedDurationMinutes: 90
      }
    ]
  },
  {
    aliases: ["成都", "成都市", "chengdu"],
    pois: [
      {
        id: "seed-chengdu-kuanzhai",
        name: "宽窄巷子",
        address: "成都市青羊区金河路口宽窄巷子",
        city: "成都",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 30.667891,
        longitude: 104.04986,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("宽窄巷子")
      },
      {
        id: "seed-chengdu-wuhou",
        name: "武侯祠",
        address: "成都市武侯区武侯祠大街231号",
        city: "成都",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 30.645767,
        longitude: 104.043374,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("武侯祠")
      },
      {
        id: "seed-chengdu-dufu",
        name: "杜甫草堂",
        address: "成都市青羊区青华路37号",
        city: "成都",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 30.665314,
        longitude: 104.028945,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("杜甫草堂")
      },
      {
        id: "seed-chengdu-jinli",
        name: "锦里古街",
        address: "成都市武侯区武侯祠大街231号附1号",
        city: "成都",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 30.645488,
        longitude: 104.042874,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("锦里")
      },
      {
        id: "seed-chengdu-chunxi",
        name: "春熙路太古里",
        address: "成都市锦江区春熙路商圈",
        city: "成都",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 30.659498,
        longitude: 104.083872,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("春熙路")
      },
      {
        id: "seed-chengdu-museum",
        name: "成都博物馆",
        address: "成都市青羊区小河街1号",
        city: "成都",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 30.657216,
        longitude: 104.064985,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("成都博物馆")
      },
      {
        id: "seed-chengdu-anshun",
        name: "安顺廊桥",
        address: "成都市锦江区滨江东路",
        city: "成都",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 30.650889,
        longitude: 104.082836,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("安顺廊桥")
      },
      {
        id: "seed-chengdu-heming",
        name: "鹤鸣茶社",
        address: "成都市青羊区少城路12号人民公园内",
        city: "成都",
        country: "CN",
        categories: ["美食", "人文"],
        latitude: 30.666187,
        longitude: 104.055462,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["广州", "广州市", "guangzhou", "canton"],
    pois: [
      {
        id: "seed-guangzhou-chenclan",
        name: "陈家祠",
        address: "广州市荔湾区中山七路恩龙里34号",
        city: "广州",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 23.125889,
        longitude: 113.244339,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("陈家祠")
      },
      {
        id: "seed-guangzhou-shamian",
        name: "沙面",
        address: "广州市荔湾区沙面南街52号附近",
        city: "广州",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 23.108998,
        longitude: 113.239563,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("沙面")
      },
      {
        id: "seed-guangzhou-canton-tower",
        name: "广州塔",
        address: "广州市海珠区阅江西路222号",
        city: "广州",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 23.108506,
        longitude: 113.319129,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("广州塔")
      },
      {
        id: "seed-guangzhou-yongqing",
        name: "永庆坊",
        address: "广州市荔湾区恩宁路99号",
        city: "广州",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 23.118423,
        longitude: 113.236851,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-guangzhou-beijing-road",
        name: "北京路步行街",
        address: "广州市越秀区北京路",
        city: "广州",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 23.125856,
        longitude: 113.272423,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("北京路步行街")
      },
      {
        id: "seed-guangzhou-shangxiajiu",
        name: "上下九步行街",
        address: "广州市荔湾区上九路",
        city: "广州",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 23.119062,
        longitude: 113.245291,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("上下九步行街")
      },
      {
        id: "seed-guangzhou-baiyun",
        name: "白云山",
        address: "广州市白云区广园中路801号",
        city: "广州",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 23.186531,
        longitude: 113.291027,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("白云山")
      },
      {
        id: "seed-guangzhou-pearl-river",
        name: "珠江夜游（天字码头）",
        address: "广州市越秀区沿江中路200号天字码头",
        city: "广州",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 23.112698,
        longitude: 113.272901,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("珠江")
      }
    ]
  },
  {
    aliases: ["深圳", "深圳市", "shenzhen"],
    pois: [
      {
        id: "seed-shenzhen-museum",
        name: "深圳博物馆",
        address: "深圳市福田区福中路市民中心A区",
        city: "深圳",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 22.541988,
        longitude: 114.059563,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("深圳博物馆")
      },
      {
        id: "seed-shenzhen-nantou",
        name: "南头古城",
        address: "深圳市南山区深南大道南头古城",
        city: "深圳",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 22.541742,
        longitude: 113.925495,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("南头古城")
      },
      {
        id: "seed-shenzhen-bay-park",
        name: "深圳湾公园",
        address: "深圳市南山区滨海大道深圳湾公园",
        city: "深圳",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 22.506149,
        longitude: 113.943862,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("深圳湾公园")
      },
      {
        id: "seed-shenzhen-pingan",
        name: "平安金融中心云际观光层",
        address: "深圳市福田区益田路5033号平安金融中心",
        city: "深圳",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 22.532975,
        longitude: 114.055532,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("平安国际金融中心")
      },
      {
        id: "seed-shenzhen-oct-loft",
        name: "华侨城创意文化园",
        address: "深圳市南山区锦绣北街2号",
        city: "深圳",
        country: "CN",
        categories: ["美食", "拍照"],
        latitude: 22.541262,
        longitude: 113.985415,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-shenzhen-dongmen",
        name: "东门步行街",
        address: "深圳市罗湖区东门中路",
        city: "深圳",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 22.548123,
        longitude: 114.123847,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("东门步行街")
      },
      {
        id: "seed-shenzhen-lianhuashan",
        name: "莲花山公园",
        address: "深圳市福田区红荔路6030号",
        city: "深圳",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 22.554073,
        longitude: 114.064551,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("莲花山公园")
      },
      {
        id: "seed-shenzhen-dafen",
        name: "大芬油画村",
        address: "深圳市龙岗区布吉街道大芬社区",
        city: "深圳",
        country: "CN",
        categories: ["拍照", "人文"],
        latitude: 22.615591,
        longitude: 114.132497,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("大芬油画村")
      }
    ]
  },
  {
    aliases: ["杭州", "杭州市", "hangzhou"],
    pois: [
      {
        id: "seed-hangzhou-westlake",
        name: "西湖",
        address: "杭州市西湖区龙井路1号附近",
        city: "杭州",
        country: "CN",
        categories: ["自然", "历史"],
        latitude: 30.248704,
        longitude: 120.15507,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("西湖")
      },
      {
        id: "seed-hangzhou-lingyin",
        name: "灵隐寺",
        address: "杭州市西湖区法云弄1号",
        city: "杭州",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 30.242454,
        longitude: 120.101191,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("灵隐寺")
      },
      {
        id: "seed-hangzhou-hefang",
        name: "河坊街",
        address: "杭州市上城区河坊街",
        city: "杭州",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 30.245004,
        longitude: 120.173936,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("河坊街")
      },
      {
        id: "seed-hangzhou-xixi",
        name: "西溪国家湿地公园",
        address: "杭州市西湖区天目山路518号",
        city: "杭州",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 30.27076,
        longitude: 120.063744,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("西溪国家湿地公园")
      },
      {
        id: "seed-hangzhou-zhejiang-museum",
        name: "浙江省博物馆（孤山馆区）",
        address: "杭州市西湖区孤山路25号",
        city: "杭州",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 30.257801,
        longitude: 120.147301,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("浙江省博物馆")
      },
      {
        id: "seed-hangzhou-city-balcony",
        name: "钱江新城城市阳台",
        address: "杭州市上城区之江路1078号附近",
        city: "杭州",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 30.246089,
        longitude: 120.219623,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-hangzhou-longjing",
        name: "龙井村",
        address: "杭州市西湖区龙井村",
        city: "杭州",
        country: "CN",
        categories: ["美食", "自然"],
        latitude: 30.214886,
        longitude: 120.116438,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("龙井村")
      },
      {
        id: "seed-hangzhou-wulin-night-market",
        name: "武林夜市",
        address: "杭州市拱墅区龙游路步行街",
        city: "杭州",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 30.261749,
        longitude: 120.169204,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["西安", "西安市", "xian", "xi'an"],
    pois: [
      {
        id: "seed-xian-warriors",
        name: "秦始皇兵马俑",
        address: "西安市临潼区秦陵北路",
        city: "西安",
        country: "CN",
        categories: ["历史", "博物馆"],
        latitude: 34.385285,
        longitude: 109.278542,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("秦始皇兵马俑")
      },
      {
        id: "seed-xian-city-wall",
        name: "西安城墙",
        address: "西安市碑林区南大街2号",
        city: "西安",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 34.258295,
        longitude: 108.947028,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("西安城墙")
      },
      {
        id: "seed-xian-big-wild-goose",
        name: "大雁塔",
        address: "西安市雁塔区雁塔路南段11号",
        city: "西安",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 34.222517,
        longitude: 108.964192,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("大雁塔")
      },
      {
        id: "seed-xian-grand-tang",
        name: "大唐不夜城",
        address: "西安市雁塔区慈恩路46号附近",
        city: "西安",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 34.219431,
        longitude: 108.968161,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("大唐不夜城")
      },
      {
        id: "seed-xian-muslim-quarter",
        name: "回民街",
        address: "西安市莲湖区北院门",
        city: "西安",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 34.266593,
        longitude: 108.94797,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("回民街")
      },
      {
        id: "seed-xian-history-museum",
        name: "陕西历史博物馆",
        address: "西安市雁塔区小寨东路91号",
        city: "西安",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 34.224631,
        longitude: 108.954694,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("陕西历史博物馆")
      },
      {
        id: "seed-xian-small-wild-goose",
        name: "小雁塔",
        address: "西安市碑林区友谊西路72号",
        city: "西安",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 34.241267,
        longitude: 108.936557,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("小雁塔")
      },
      {
        id: "seed-xian-yongxingfang",
        name: "永兴坊",
        address: "西安市新城区东新街小东门里",
        city: "西安",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 34.269718,
        longitude: 108.965592,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["重庆", "重庆市", "chongqing"],
    pois: [
      {
        id: "seed-chongqing-hongyadong",
        name: "洪崖洞",
        address: "重庆市渝中区嘉陵江滨江路88号",
        city: "重庆",
        country: "CN",
        categories: ["夜景", "历史"],
        latitude: 29.564734,
        longitude: 106.58037,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("洪崖洞")
      },
      {
        id: "seed-chongqing-jiefangbei",
        name: "解放碑",
        address: "重庆市渝中区民族路177号附近",
        city: "重庆",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 29.557266,
        longitude: 106.577094,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("解放碑")
      },
      {
        id: "seed-chongqing-liziba",
        name: "李子坝观景平台",
        address: "重庆市渝中区李子坝正街39号附近",
        city: "重庆",
        country: "CN",
        categories: ["拍照", "夜景"],
        latitude: 29.546631,
        longitude: 106.527374,
        recommendedDurationMinutes: 60
      },
      {
        id: "seed-chongqing-ciqikou",
        name: "磁器口古镇",
        address: "重庆市沙坪坝区磁南街1号",
        city: "重庆",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 29.587393,
        longitude: 106.44667,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("磁器口古镇")
      },
      {
        id: "seed-chongqing-trail",
        name: "山城步道",
        address: "重庆市渝中区中兴路234号附近",
        city: "重庆",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 29.551566,
        longitude: 106.573492,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("山城步道")
      },
      {
        id: "seed-chongqing-cableway",
        name: "长江索道",
        address: "重庆市渝中区新华路151号",
        city: "重庆",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 29.557805,
        longitude: 106.586978,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("长江索道")
      },
      {
        id: "seed-chongqing-three-gorges",
        name: "重庆中国三峡博物馆",
        address: "重庆市渝中区人民路236号",
        city: "重庆",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 29.563426,
        longitude: 106.549796,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("重庆中国三峡博物馆")
      },
      {
        id: "seed-chongqing-nanshan",
        name: "南山一棵树观景台",
        address: "重庆市南岸区龙黄公路",
        city: "重庆",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 29.531645,
        longitude: 106.600266,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["南京", "南京市", "nanjing"],
    pois: [
      {
        id: "seed-nanjing-qinhuai",
        name: "夫子庙秦淮风光带",
        address: "南京市秦淮区夫子庙贡院西街53号附近",
        city: "南京",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 32.022148,
        longitude: 118.792359,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("夫子庙秦淮风光带")
      },
      {
        id: "seed-nanjing-zhongshan",
        name: "中山陵",
        address: "南京市玄武区石象路7号",
        city: "南京",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 32.061725,
        longitude: 118.848537,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("中山陵")
      },
      {
        id: "seed-nanjing-museum",
        name: "南京博物院",
        address: "南京市玄武区中山东路321号",
        city: "南京",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 32.040457,
        longitude: 118.85002,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("南京博物院")
      },
      {
        id: "seed-nanjing-laomendong",
        name: "老门东",
        address: "南京市秦淮区剪子巷54号",
        city: "南京",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 32.015091,
        longitude: 118.795164,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("老门东")
      },
      {
        id: "seed-nanjing-xuanwu",
        name: "玄武湖公园",
        address: "南京市玄武区玄武巷1号",
        city: "南京",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 32.070669,
        longitude: 118.803921,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("玄武湖")
      },
      {
        id: "seed-nanjing-jiming",
        name: "鸡鸣寺",
        address: "南京市玄武区鸡鸣寺路1号",
        city: "南京",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 32.062476,
        longitude: 118.798265,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("鸡鸣寺")
      },
      {
        id: "seed-nanjing-presidential-palace",
        name: "南京总统府",
        address: "南京市玄武区长江路292号",
        city: "南京",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 32.044139,
        longitude: 118.792564,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("南京总统府")
      },
      {
        id: "seed-nanjing-kexiang",
        name: "科巷美食街",
        address: "南京市秦淮区科巷",
        city: "南京",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 32.032735,
        longitude: 118.793645,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["武汉", "武汉市", "wuhan"],
    pois: [
      {
        id: "seed-wuhan-yellow-crane",
        name: "黄鹤楼",
        address: "武汉市武昌区蛇山西山坡特1号",
        city: "武汉",
        country: "CN",
        categories: ["历史", "地标"],
        latitude: 30.544838,
        longitude: 114.306339,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("黄鹤楼")
      },
      {
        id: "seed-wuhan-hubei-museum",
        name: "湖北省博物馆",
        address: "武汉市武昌区东湖路160号",
        city: "武汉",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 30.547804,
        longitude: 114.362629,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("湖北省博物馆")
      },
      {
        id: "seed-wuhan-hubu",
        name: "户部巷",
        address: "武汉市武昌区自由路户部巷",
        city: "武汉",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 30.544599,
        longitude: 114.307811,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("户部巷")
      },
      {
        id: "seed-wuhan-eastlake",
        name: "东湖绿道",
        address: "武汉市武昌区沿湖大道16号附近",
        city: "武汉",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 30.556305,
        longitude: 114.387627,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("东湖绿道")
      },
      {
        id: "seed-wuhan-tanhualin",
        name: "昙华林",
        address: "武汉市武昌区胭脂路仁济医院西侧",
        city: "武汉",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 30.553411,
        longitude: 114.309297,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("昙华林")
      },
      {
        id: "seed-wuhan-jianghan-road",
        name: "江汉路步行街",
        address: "武汉市江汉区江汉路",
        city: "武汉",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 30.58236,
        longitude: 114.291692,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("江汉路步行街")
      },
      {
        id: "seed-wuhan-bridge",
        name: "武汉长江大桥",
        address: "武汉市武昌区临江大道",
        city: "武汉",
        country: "CN",
        categories: ["夜景", "历史"],
        latitude: 30.546434,
        longitude: 114.302084,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("武汉长江大桥")
      },
      {
        id: "seed-wuhan-chuhe-hanjie",
        name: "楚河汉街",
        address: "武汉市武昌区公正路9号附近",
        city: "武汉",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 30.562363,
        longitude: 114.335582,
        recommendedDurationMinutes: 90
      }
    ]
  },
  {
    aliases: ["苏州", "苏州市", "suzhou"],
    pois: [
      {
        id: "seed-suzhou-zhuozheng",
        name: "拙政园",
        address: "苏州市姑苏区东北街178号",
        city: "苏州",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 31.326834,
        longitude: 120.633846,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("拙政园")
      },
      {
        id: "seed-suzhou-pingjiang",
        name: "平江路",
        address: "苏州市姑苏区白塔东路65号附近",
        city: "苏州",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 31.319721,
        longitude: 120.639243,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("平江路")
      },
      {
        id: "seed-suzhou-museum",
        name: "苏州博物馆",
        address: "苏州市姑苏区东北街204号",
        city: "苏州",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 31.327294,
        longitude: 120.632567,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("苏州博物馆")
      },
      {
        id: "seed-suzhou-shantang",
        name: "山塘街",
        address: "苏州市姑苏区山塘街177号",
        city: "苏州",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 31.330612,
        longitude: 120.608916,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("山塘街")
      },
      {
        id: "seed-suzhou-huqiu",
        name: "虎丘山风景名胜区",
        address: "苏州市姑苏区虎丘山门内8号",
        city: "苏州",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 31.338894,
        longitude: 120.571503,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("虎丘")
      },
      {
        id: "seed-suzhou-jinji",
        name: "金鸡湖景区",
        address: "苏州市苏州工业园区金鸡湖大道",
        city: "苏州",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 31.322493,
        longitude: 120.704044,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("金鸡湖")
      },
      {
        id: "seed-suzhou-guanqian",
        name: "观前街",
        address: "苏州市姑苏区观前街",
        city: "苏州",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 31.311584,
        longitude: 120.628494,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("观前街")
      },
      {
        id: "seed-suzhou-hanshan",
        name: "寒山寺",
        address: "苏州市姑苏区枫桥路",
        city: "苏州",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 31.295846,
        longitude: 120.56071,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("寒山寺")
      }
    ]
  },
  {
    aliases: ["长沙", "长沙市", "changsha"],
    pois: [
      {
        id: "seed-changsha-yuelu",
        name: "岳麓山",
        address: "长沙市岳麓区登高路58号",
        city: "长沙",
        country: "CN",
        categories: ["自然", "历史"],
        latitude: 28.183982,
        longitude: 112.937201,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("岳麓山")
      },
      {
        id: "seed-changsha-orange-isle",
        name: "橘子洲",
        address: "长沙市岳麓区橘子洲头2号",
        city: "长沙",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 28.186943,
        longitude: 112.962137,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("橘子洲")
      },
      {
        id: "seed-changsha-hunan-museum",
        name: "湖南博物院",
        address: "长沙市开福区东风路50号",
        city: "长沙",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 28.210557,
        longitude: 112.990552,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("湖南博物院")
      },
      {
        id: "seed-changsha-taiping",
        name: "太平老街",
        address: "长沙市天心区太平街",
        city: "长沙",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 28.193977,
        longitude: 112.972308,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-changsha-huangxing",
        name: "黄兴路步行街",
        address: "长沙市天心区黄兴南路",
        city: "长沙",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 28.191746,
        longitude: 112.976511,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-changsha-dufu",
        name: "杜甫江阁",
        address: "长沙市天心区湘江中路二段108号",
        city: "长沙",
        country: "CN",
        categories: ["夜景", "历史"],
        latitude: 28.184594,
        longitude: 112.968497,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-changsha-fire-palace",
        name: "火宫殿（坡子街总店）",
        address: "长沙市天心区坡子街127号",
        city: "长沙",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 28.191332,
        longitude: 112.971445,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("火宫殿")
      },
      {
        id: "seed-changsha-ifs",
        name: "长沙IFS国金中心",
        address: "长沙市芙蓉区解放西路188号",
        city: "长沙",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 28.194836,
        longitude: 112.982733,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["青岛", "青岛市", "qingdao"],
    pois: [
      {
        id: "seed-qingdao-zhanqiao",
        name: "栈桥",
        address: "青岛市市南区太平路12号",
        city: "青岛",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 36.061089,
        longitude: 120.320292,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("栈桥")
      },
      {
        id: "seed-qingdao-badaguan",
        name: "八大关",
        address: "青岛市市南区山海关路",
        city: "青岛",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 36.051257,
        longitude: 120.348504,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("八大关")
      },
      {
        id: "seed-qingdao-beer-museum",
        name: "青岛啤酒博物馆",
        address: "青岛市市北区登州路56号",
        city: "青岛",
        country: "CN",
        categories: ["博物馆", "美食"],
        latitude: 36.075818,
        longitude: 120.332789,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("青岛啤酒博物馆")
      },
      {
        id: "seed-qingdao-wusi",
        name: "五四广场",
        address: "青岛市市南区东海西路35号",
        city: "青岛",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 36.062794,
        longitude: 120.382992,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("五四广场")
      },
      {
        id: "seed-qingdao-xiaoyushan",
        name: "小鱼山",
        address: "青岛市市南区福山支路24号",
        city: "青岛",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 36.058379,
        longitude: 120.324156,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("小鱼山")
      },
      {
        id: "seed-qingdao-taidong",
        name: "台东步行街",
        address: "青岛市市北区台东三路",
        city: "青岛",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 36.083942,
        longitude: 120.34366,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-qingdao-signal-hill",
        name: "信号山公园",
        address: "青岛市市南区龙山路16号",
        city: "青岛",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 36.06755,
        longitude: 120.325907,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("信号山公园")
      },
      {
        id: "seed-qingdao-cathedral",
        name: "圣弥厄尔天主教堂",
        address: "青岛市市南区浙江路15号",
        city: "青岛",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 36.064145,
        longitude: 120.324738,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("圣弥厄尔堂")
      }
    ]
  },
  {
    aliases: ["厦门", "厦门市", "xiamen"],
    pois: [
      {
        id: "seed-xiamen-gulangyu",
        name: "鼓浪屿",
        address: "厦门市思明区鼓浪屿",
        city: "厦门",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 24.448629,
        longitude: 118.067316,
        recommendedDurationMinutes: 180,
        sourcePageUrl: buildWikipediaUrl("鼓浪屿")
      },
      {
        id: "seed-xiamen-nanputuo",
        name: "南普陀寺",
        address: "厦门市思明区思明南路515号",
        city: "厦门",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 24.43814,
        longitude: 118.101315,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("南普陀寺")
      },
      {
        id: "seed-xiamen-zhongshan-road",
        name: "中山路步行街",
        address: "厦门市思明区中山路",
        city: "厦门",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 24.457836,
        longitude: 118.073664,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("中山路步行街_(厦门)")
      },
      {
        id: "seed-xiamen-shapowei",
        name: "沙坡尾",
        address: "厦门市思明区大学路沙坡尾",
        city: "厦门",
        country: "CN",
        categories: ["美食", "拍照"],
        latitude: 24.436677,
        longitude: 118.090431,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-xiamen-hulishan",
        name: "胡里山炮台",
        address: "厦门市思明区曾厝垵路2号",
        city: "厦门",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 24.430643,
        longitude: 118.103427,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("胡里山炮台")
      },
      {
        id: "seed-xiamen-botanical-garden",
        name: "厦门园林植物园",
        address: "厦门市思明区虎园路25号",
        city: "厦门",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 24.448244,
        longitude: 118.095796,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("厦门园林植物园")
      },
      {
        id: "seed-xiamen-zengcuoan",
        name: "曾厝垵",
        address: "厦门市思明区环岛南路曾厝垵社",
        city: "厦门",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 24.427237,
        longitude: 118.120414,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("曾厝垵")
      },
      {
        id: "seed-xiamen-yanwu",
        name: "演武大桥观景平台",
        address: "厦门市思明区演武路",
        city: "厦门",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 24.434384,
        longitude: 118.095948,
        recommendedDurationMinutes: 60
      }
    ]
  },
  {
    aliases: ["昆明", "昆明市", "kunming"],
    pois: [
      {
        id: "seed-kunming-green-lake",
        name: "翠湖公园",
        address: "昆明市五华区翠湖南路67号",
        city: "昆明",
        country: "CN",
        categories: ["自然", "历史"],
        latitude: 25.050165,
        longitude: 102.709692,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("翠湖公园")
      },
      {
        id: "seed-kunming-lecture-hall",
        name: "云南陆军讲武堂旧址",
        address: "昆明市五华区翠湖西路22号",
        city: "昆明",
        country: "CN",
        categories: ["历史", "博物馆"],
        latitude: 25.049438,
        longitude: 102.704799,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("云南陆军讲武堂")
      },
      {
        id: "seed-kunming-yunnan-museum",
        name: "云南省博物馆",
        address: "昆明市官渡区广福路6393号",
        city: "昆明",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 24.950228,
        longitude: 102.760051,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("云南省博物馆")
      },
      {
        id: "seed-kunming-jinma-biji",
        name: "金马碧鸡坊",
        address: "昆明市西山区金碧路",
        city: "昆明",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 25.038275,
        longitude: 102.714913,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("金马碧鸡坊")
      },
      {
        id: "seed-kunming-nanping",
        name: "南屏步行街",
        address: "昆明市五华区南屏街",
        city: "昆明",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 25.040983,
        longitude: 102.713388,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-kunming-dianchi",
        name: "滇池海埂大坝",
        address: "昆明市西山区观景路1310号附近",
        city: "昆明",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 24.961087,
        longitude: 102.664676,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("滇池")
      },
      {
        id: "seed-kunming-west-hill",
        name: "西山风景名胜区",
        address: "昆明市西山区西山公路",
        city: "昆明",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 25.023998,
        longitude: 102.639749,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("西山_(昆明)")
      },
      {
        id: "seed-kunming-dounan",
        name: "斗南花市",
        address: "昆明市呈贡区金桂街与鲜花大道交叉口",
        city: "昆明",
        country: "CN",
        categories: ["拍照", "夜景"],
        latitude: 24.879864,
        longitude: 102.802106,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("斗南街道")
      }
    ]
  },
  {
    aliases: ["福州", "福州市", "fuzhou"],
    pois: [
      {
        id: "seed-fuzhou-sanfang",
        name: "三坊七巷",
        address: "福州市鼓楼区南后街58号",
        city: "福州",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 26.082724,
        longitude: 119.296453,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("三坊七巷")
      },
      {
        id: "seed-fuzhou-shangxiahang",
        name: "上下杭",
        address: "福州市台江区上下杭历史文化街区",
        city: "福州",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 26.053347,
        longitude: 119.302634,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-fuzhou-yantaishan",
        name: "烟台山",
        address: "福州市仓山区梅坞路14号附近",
        city: "福州",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 26.043247,
        longitude: 119.311567,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("烟台山_(福州)")
      },
      {
        id: "seed-fuzhou-gushan",
        name: "鼓山风景区",
        address: "福州市晋安区鼓山镇鼓山路",
        city: "福州",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 26.084295,
        longitude: 119.387533,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("鼓山")
      },
      {
        id: "seed-fuzhou-linzexu",
        name: "林则徐纪念馆",
        address: "福州市鼓楼区澳门路16号",
        city: "福州",
        country: "CN",
        categories: ["历史", "博物馆"],
        latitude: 26.073298,
        longitude: 119.296996,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("林则徐纪念馆")
      },
      {
        id: "seed-fuzhou-westlake",
        name: "西湖公园",
        address: "福州市鼓楼区湖滨路71号",
        city: "福州",
        country: "CN",
        categories: ["自然", "历史"],
        latitude: 26.093623,
        longitude: 119.289648,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("福州西湖")
      },
      {
        id: "seed-fuzhou-daming",
        name: "达明美食街",
        address: "福州市鼓楼区达明路",
        city: "福州",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 26.085911,
        longitude: 119.29352,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-fuzhou-minjiang",
        name: "闽江夜游（台江码头）",
        address: "福州市台江区江滨中大道台江旅游码头",
        city: "福州",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 26.060071,
        longitude: 119.310341,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["海口", "海口市", "haikou"],
    pois: [
      {
        id: "seed-haikou-qilou",
        name: "骑楼老街",
        address: "海口市龙华区中山路",
        city: "海口",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 20.045123,
        longitude: 110.341389,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("海口骑楼老街")
      },
      {
        id: "seed-haikou-clocktower",
        name: "海口钟楼",
        address: "海口市龙华区长堤路20号",
        city: "海口",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 20.043626,
        longitude: 110.343439,
        recommendedDurationMinutes: 45,
        sourcePageUrl: buildWikipediaUrl("海口钟楼")
      },
      {
        id: "seed-haikou-wanlv",
        name: "万绿园",
        address: "海口市龙华区滨海大道38号",
        city: "海口",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 20.029884,
        longitude: 110.320934,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("万绿园")
      },
      {
        id: "seed-haikou-holiday-beach",
        name: "假日海滩",
        address: "海口市秀英区滨海大道111号",
        city: "海口",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 20.007173,
        longitude: 110.255761,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("假日海滩")
      },
      {
        id: "seed-haikou-hainan-museum",
        name: "海南省博物馆",
        address: "海口市琼山区国兴大道68号",
        city: "海口",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 20.018258,
        longitude: 110.350541,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("海南省博物馆")
      },
      {
        id: "seed-haikou-wugongci",
        name: "五公祠",
        address: "海口市琼山区海府路169号",
        city: "海口",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 20.020868,
        longitude: 110.358698,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("五公祠")
      },
      {
        id: "seed-haikou-yundong",
        name: "云洞图书馆",
        address: "海口市龙华区世纪公园北侧海边草坪",
        city: "海口",
        country: "CN",
        categories: ["拍照", "夜景"],
        latitude: 20.028991,
        longitude: 110.314629,
        recommendedDurationMinutes: 60
      },
      {
        id: "seed-haikou-nightmarket",
        name: "海大南门夜市",
        address: "海口市美兰区人民大道58号附近",
        city: "海口",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 20.044394,
        longitude: 110.330651,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["三亚", "三亚市", "sanya"],
    pois: [
      {
        id: "seed-sanya-tianya",
        name: "天涯海角",
        address: "三亚市天涯区天涯海角游览区",
        city: "三亚",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 18.298264,
        longitude: 109.343799,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("天涯海角")
      },
      {
        id: "seed-sanya-nanshan",
        name: "南山文化旅游区",
        address: "三亚市崖州区南山村",
        city: "三亚",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 18.299172,
        longitude: 109.173755,
        recommendedDurationMinutes: 180,
        sourcePageUrl: buildWikipediaUrl("南山文化旅游区")
      },
      {
        id: "seed-sanya-luhuitou",
        name: "鹿回头风景区",
        address: "三亚市吉阳区鹿岭路",
        city: "三亚",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 18.218695,
        longitude: 109.508277,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("鹿回头公园")
      },
      {
        id: "seed-sanya-first-market",
        name: "第一市场",
        address: "三亚市天涯区新建街155号",
        city: "三亚",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 18.247385,
        longitude: 109.505739,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-sanya-yalong",
        name: "亚龙湾",
        address: "三亚市吉阳区亚龙湾国家旅游度假区",
        city: "三亚",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 18.236286,
        longitude: 109.629885,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("亚龙湾")
      },
      {
        id: "seed-sanya-daxiaodongtian",
        name: "大小洞天",
        address: "三亚市崖州区南山西南隅",
        city: "三亚",
        country: "CN",
        categories: ["自然", "历史"],
        latitude: 18.206057,
        longitude: 109.354656,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("大小洞天")
      },
      {
        id: "seed-sanya-yemeng",
        name: "椰梦长廊",
        address: "三亚市天涯区三亚湾路",
        city: "三亚",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 18.270334,
        longitude: 109.493905,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-sanya-wuzhizhou",
        name: "蜈支洲岛",
        address: "三亚市海棠区蜈支洲岛旅游区",
        city: "三亚",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 18.314732,
        longitude: 109.759428,
        recommendedDurationMinutes: 180,
        sourcePageUrl: buildWikipediaUrl("蜈支洲岛")
      }
    ]
  },
  {
    aliases: ["哈尔滨", "哈尔滨市", "harbin"],
    pois: [
      {
        id: "seed-harbin-central",
        name: "中央大街",
        address: "哈尔滨市道里区中央大街",
        city: "哈尔滨",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 45.777208,
        longitude: 126.622833,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("中央大街")
      },
      {
        id: "seed-harbin-sofia",
        name: "圣索菲亚教堂",
        address: "哈尔滨市道里区透笼街88号",
        city: "哈尔滨",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 45.773228,
        longitude: 126.629245,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("圣索菲亚教堂_(哈尔滨)")
      },
      {
        id: "seed-harbin-flood",
        name: "防洪纪念塔",
        address: "哈尔滨市道里区斯大林街",
        city: "哈尔滨",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 45.785363,
        longitude: 126.618455,
        recommendedDurationMinutes: 45,
        sourcePageUrl: buildWikipediaUrl("哈尔滨防洪纪念塔")
      },
      {
        id: "seed-harbin-sun-island",
        name: "太阳岛",
        address: "哈尔滨市松北区警备路3号",
        city: "哈尔滨",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 45.806824,
        longitude: 126.598601,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("太阳岛")
      },
      {
        id: "seed-harbin-ice-world",
        name: "哈尔滨冰雪大世界",
        address: "哈尔滨市松北区太阳岛西侧",
        city: "哈尔滨",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 45.803121,
        longitude: 126.611162,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("哈尔滨冰雪大世界")
      },
      {
        id: "seed-harbin-laodaowai",
        name: "中华巴洛克历史文化街区",
        address: "哈尔滨市道外区靖宇街",
        city: "哈尔滨",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 45.788022,
        longitude: 126.64808,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-harbin-heilongjiang-museum",
        name: "黑龙江省博物馆",
        address: "哈尔滨市南岗区红军街64号",
        city: "哈尔滨",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 45.753798,
        longitude: 126.643773,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("黑龙江省博物馆")
      },
      {
        id: "seed-harbin-stalin",
        name: "斯大林公园",
        address: "哈尔滨市道里区斯大林街3号",
        city: "哈尔滨",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 45.783235,
        longitude: 126.616695,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("斯大林公园")
      }
    ]
  },
  {
    aliases: ["济南", "济南市", "jinan"],
    pois: [
      {
        id: "seed-jinan-baotu",
        name: "趵突泉",
        address: "济南市历下区趵突泉南路1号",
        city: "济南",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 36.660325,
        longitude: 117.01298,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("趵突泉")
      },
      {
        id: "seed-jinan-daming",
        name: "大明湖",
        address: "济南市历下区大明湖路271号",
        city: "济南",
        country: "CN",
        categories: ["自然", "历史"],
        latitude: 36.674652,
        longitude: 117.028596,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("大明湖")
      },
      {
        id: "seed-jinan-qianfo",
        name: "千佛山",
        address: "济南市历下区经十一路18号",
        city: "济南",
        country: "CN",
        categories: ["自然", "历史"],
        latitude: 36.639118,
        longitude: 117.040221,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("千佛山")
      },
      {
        id: "seed-jinan-furong",
        name: "芙蓉街",
        address: "济南市历下区芙蓉街",
        city: "济南",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 36.666618,
        longitude: 117.021486,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-jinan-kuanhouli",
        name: "宽厚里",
        address: "济南市历下区泉城路26号附近",
        city: "济南",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 36.665136,
        longitude: 117.027824,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-jinan-heihu",
        name: "黑虎泉",
        address: "济南市历下区解放阁南护城河畔",
        city: "济南",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 36.661706,
        longitude: 117.03533,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("黑虎泉")
      },
      {
        id: "seed-jinan-shandong-museum",
        name: "山东博物馆",
        address: "济南市历下区经十一路11899号",
        city: "济南",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 36.651071,
        longitude: 117.119748,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("山东博物馆")
      },
      {
        id: "seed-jinan-qushuiting",
        name: "曲水亭街",
        address: "济南市历下区曲水亭街",
        city: "济南",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 36.670153,
        longitude: 117.024194,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["沈阳", "沈阳市", "shenyang"],
    pois: [
      {
        id: "seed-shenyang-palace",
        name: "沈阳故宫",
        address: "沈阳市沈河区沈阳路171号",
        city: "沈阳",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 41.796442,
        longitude: 123.458723,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("盛京宫殿")
      },
      {
        id: "seed-shenyang-marshal",
        name: "张学良旧居",
        address: "沈阳市沈河区朝阳街少帅府巷46号",
        city: "沈阳",
        country: "CN",
        categories: ["历史", "博物馆"],
        latitude: 41.798401,
        longitude: 123.463708,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("张学良旧居")
      },
      {
        id: "seed-shenyang-beiling",
        name: "北陵公园",
        address: "沈阳市皇姑区泰山路12号",
        city: "沈阳",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 41.840513,
        longitude: 123.421685,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("北陵公园")
      },
      {
        id: "seed-shenyang-zhongjie",
        name: "中街步行街",
        address: "沈阳市沈河区中街路",
        city: "沈阳",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 41.803194,
        longitude: 123.458194,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-shenyang-xita",
        name: "西塔美食街",
        address: "沈阳市和平区西塔街",
        city: "沈阳",
        country: "CN",
        categories: ["美食", "人文"],
        latitude: 41.790875,
        longitude: 123.415089,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-shenyang-liaoning-museum",
        name: "辽宁省博物馆",
        address: "沈阳市浑南区智慧三街157号",
        city: "沈阳",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 41.742802,
        longitude: 123.445083,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("辽宁省博物馆")
      },
      {
        id: "seed-shenyang-laobeishi",
        name: "老北市",
        address: "沈阳市大东区北顺城路与北中街路口",
        city: "沈阳",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 41.808733,
        longitude: 123.463201,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-shenyang-fangcheng",
        name: "沈阳方城",
        address: "沈阳市沈河区正阳街",
        city: "沈阳",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 41.800639,
        longitude: 123.458871,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["珠海", "珠海市", "zhuhai"],
    pois: [
      {
        id: "seed-zhuhai-lover",
        name: "情侣路",
        address: "珠海市香洲区情侣中路",
        city: "珠海",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 22.270861,
        longitude: 113.576726,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("情侣路")
      },
      {
        id: "seed-zhuhai-fisher",
        name: "珠海渔女",
        address: "珠海市香洲区情侣中路63号附近",
        city: "珠海",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 22.273412,
        longitude: 113.584071,
        recommendedDurationMinutes: 45,
        sourcePageUrl: buildWikipediaUrl("珠海渔女")
      },
      {
        id: "seed-zhuhai-opera",
        name: "珠海大剧院（日月贝）",
        address: "珠海市香洲区野狸岛海滨路",
        city: "珠海",
        country: "CN",
        categories: ["夜景", "建筑"],
        latitude: 22.279913,
        longitude: 113.571225,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("珠海大剧院")
      },
      {
        id: "seed-zhuhai-yelidao",
        name: "野狸岛",
        address: "珠海市香洲区野狸岛",
        city: "珠海",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 22.279807,
        longitude: 113.569005,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("野狸岛")
      },
      {
        id: "seed-zhuhai-beishan",
        name: "北山大院",
        address: "珠海市香洲区南屏镇北山村",
        city: "珠海",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 22.246866,
        longitude: 113.525539,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-zhuhai-tangjiawan",
        name: "唐家湾古镇",
        address: "珠海市香洲区唐家湾镇山房路",
        city: "珠海",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 22.342589,
        longitude: 113.589142,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("唐家湾镇")
      },
      {
        id: "seed-zhuhai-yuanming",
        name: "圆明新园",
        address: "珠海市香洲区九洲大道兰埔路",
        city: "珠海",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 22.250787,
        longitude: 113.549811,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("圆明新园")
      },
      {
        id: "seed-zhuhai-xiangzhou-night",
        name: "香洲埠美食街",
        address: "珠海市香洲区香洲港附近",
        city: "珠海",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 22.291214,
        longitude: 113.569836,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["张家界", "张家界市", "zhangjiajie"],
    pois: [
      {
        id: "seed-zhangjiajie-forest",
        name: "张家界国家森林公园",
        address: "张家界市武陵源区军地坪街道",
        city: "张家界",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 29.347417,
        longitude: 110.55023,
        recommendedDurationMinutes: 180,
        sourcePageUrl: buildWikipediaUrl("张家界国家森林公园")
      },
      {
        id: "seed-zhangjiajie-tianmen",
        name: "天门山国家森林公园",
        address: "张家界市永定区大庸路11号",
        city: "张家界",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 29.050824,
        longitude: 110.479191,
        recommendedDurationMinutes: 180,
        sourcePageUrl: buildWikipediaUrl("天门山")
      },
      {
        id: "seed-zhangjiajie-grand-canyon",
        name: "张家界大峡谷",
        address: "张家界市慈利县三官寺土家族乡",
        city: "张家界",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 29.387964,
        longitude: 110.792543,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("张家界大峡谷")
      },
      {
        id: "seed-zhangjiajie-huanglong",
        name: "黄龙洞",
        address: "张家界市武陵源区索溪峪镇",
        city: "张家界",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 29.355049,
        longitude: 110.548205,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("黄龙洞")
      },
      {
        id: "seed-zhangjiajie-baofeng",
        name: "宝峰湖",
        address: "张家界市武陵源区宝峰路",
        city: "张家界",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 29.343634,
        longitude: 110.541908,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("宝峰湖")
      },
      {
        id: "seed-zhangjiajie-xibu",
        name: "溪布街",
        address: "张家界市武陵源区溪布街旅游商业街",
        city: "张家界",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 29.350357,
        longitude: 110.551857,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-zhangjiajie-qilou",
        name: "七十二奇楼",
        address: "张家界市永定区官黎坪街道鲤鱼池社区",
        city: "张家界",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 29.099633,
        longitude: 110.480576,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-zhangjiajie-tujia",
        name: "土家风情园",
        address: "张家界市永定区南庄坪",
        city: "张家界",
        country: "CN",
        categories: ["历史", "人文"],
        latitude: 29.117932,
        longitude: 110.473602,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("土家风情园")
      }
    ]
  },
  {
    aliases: ["长春", "长春市", "changchun"],
    pois: [
      {
        id: "seed-changchun-puppet",
        name: "伪满皇宫博物院",
        address: "长春市宽城区光复北路5号",
        city: "长春",
        country: "CN",
        categories: ["历史", "博物馆"],
        latitude: 43.908222,
        longitude: 125.342676,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("伪满皇宫博物院")
      },
      {
        id: "seed-changchun-film",
        name: "长影旧址博物馆",
        address: "长春市朝阳区红旗街1118号",
        city: "长春",
        country: "CN",
        categories: ["历史", "博物馆"],
        latitude: 43.859279,
        longitude: 125.290891,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-changchun-nanhu",
        name: "南湖公园",
        address: "长春市朝阳区南湖大路2715号",
        city: "长春",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 43.851734,
        longitude: 125.306621,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("南湖公园_(长春)")
      },
      {
        id: "seed-changchun-zheyou",
        name: "这有山",
        address: "长春市朝阳区红旗街959号",
        city: "长春",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 43.859128,
        longitude: 125.288427,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-changchun-guilin",
        name: "桂林路商圈",
        address: "长春市朝阳区桂林路",
        city: "长春",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 43.866763,
        longitude: 125.321567,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-changchun-culture-square",
        name: "文化广场",
        address: "长春市朝阳区人民大街",
        city: "长春",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 43.874623,
        longitude: 125.323522,
        recommendedDurationMinutes: 60
      }
    ]
  },
  {
    aliases: ["合肥", "合肥市", "hefei"],
    pois: [
      {
        id: "seed-hefei-bao",
        name: "包公园",
        address: "合肥市包河区芜湖路72号",
        city: "合肥",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 31.850274,
        longitude: 117.30357,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("包公园")
      },
      {
        id: "seed-hefei-lihongzhang",
        name: "李鸿章故居",
        address: "合肥市庐阳区淮河路208号",
        city: "合肥",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 31.870444,
        longitude: 117.289639,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("李鸿章故居")
      },
      {
        id: "seed-hefei-anhui-museum",
        name: "安徽博物院",
        address: "合肥市政务区怀宁路268号",
        city: "合肥",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 31.807024,
        longitude: 117.221736,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("安徽博物院")
      },
      {
        id: "seed-hefei-lei",
        name: "罍街",
        address: "合肥市包河区宁国南路与水阳江路交口",
        city: "合肥",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 31.827858,
        longitude: 117.317769,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-hefei-swan",
        name: "天鹅湖公园",
        address: "合肥市蜀山区怀宁路",
        city: "合肥",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 31.799522,
        longitude: 117.227768,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-hefei-huaihe",
        name: "淮河路步行街",
        address: "合肥市庐阳区淮河路",
        city: "合肥",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 31.870664,
        longitude: 117.291876,
        recommendedDurationMinutes: 75
      }
    ]
  },
  {
    aliases: ["呼和浩特", "呼和浩特市", "hohhot", "huhehaote"],
    pois: [
      {
        id: "seed-hohhot-dazhao",
        name: "大召寺",
        address: "呼和浩特市玉泉区大召前街",
        city: "呼和浩特",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 40.806039,
        longitude: 111.652872,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("大召寺")
      },
      {
        id: "seed-hohhot-saishang",
        name: "塞上老街",
        address: "呼和浩特市玉泉区大召西夹道",
        city: "呼和浩特",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 40.805548,
        longitude: 111.649439,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-hohhot-museum",
        name: "内蒙古博物院",
        address: "呼和浩特市新城区新华东街27号",
        city: "呼和浩特",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 40.842675,
        longitude: 111.748215,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("内蒙古博物院")
      },
      {
        id: "seed-hohhot-chilechuan",
        name: "敕勒川草原",
        address: "呼和浩特市新城区保合少镇",
        city: "呼和浩特",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 40.895987,
        longitude: 111.838904,
        recommendedDurationMinutes: 150
      },
      {
        id: "seed-hohhot-kuanxiangzi",
        name: "宽巷子美食街",
        address: "呼和浩特市新城区海拉尔东街附近",
        city: "呼和浩特",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 40.830998,
        longitude: 111.691827,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-hohhot-jiangjun",
        name: "绥远城将军衙署",
        address: "呼和浩特市新城区新华大街31号",
        city: "呼和浩特",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 40.819911,
        longitude: 111.667038,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("绥远城将军衙署")
      }
    ]
  },
  {
    aliases: ["兰州", "兰州市", "lanzhou"],
    pois: [
      {
        id: "seed-lanzhou-zhongshan",
        name: "中山桥",
        address: "兰州市城关区滨河路中段",
        city: "兰州",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 36.064718,
        longitude: 103.816534,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("中山桥_(兰州)")
      },
      {
        id: "seed-lanzhou-baita",
        name: "白塔山公园",
        address: "兰州市城关区白塔山1号",
        city: "兰州",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 36.06736,
        longitude: 103.820456,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("白塔山公园")
      },
      {
        id: "seed-lanzhou-gansu-museum",
        name: "甘肃省博物馆",
        address: "兰州市七里河区西津西路3号",
        city: "兰州",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 36.061621,
        longitude: 103.765616,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("甘肃省博物馆")
      },
      {
        id: "seed-lanzhou-zhengning",
        name: "正宁路夜市",
        address: "兰州市城关区正宁路",
        city: "兰州",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 36.054401,
        longitude: 103.826128,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-lanzhou-yellow-river",
        name: "黄河楼",
        address: "兰州市七里河区马滩中街",
        city: "兰州",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 36.047618,
        longitude: 103.739611,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-lanzhou-waterwheel",
        name: "水车博览园",
        address: "兰州市城关区滨河东路524号",
        city: "兰州",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 36.060736,
        longitude: 103.846348,
        recommendedDurationMinutes: 60
      }
    ]
  },
  {
    aliases: ["拉萨", "拉萨市", "lhasa"],
    pois: [
      {
        id: "seed-lhasa-potala",
        name: "布达拉宫",
        address: "拉萨市城关区北京中路35号",
        city: "拉萨",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 29.657775,
        longitude: 91.117424,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("布达拉宫")
      },
      {
        id: "seed-lhasa-jokhang",
        name: "大昭寺",
        address: "拉萨市城关区八廓西街2号",
        city: "拉萨",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 29.644252,
        longitude: 91.131675,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("大昭寺")
      },
      {
        id: "seed-lhasa-barkhor",
        name: "八廓街",
        address: "拉萨市城关区八廓街",
        city: "拉萨",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 29.644641,
        longitude: 91.132675,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("八廓街")
      },
      {
        id: "seed-lhasa-norbulingka",
        name: "罗布林卡",
        address: "拉萨市城关区罗布林卡路21号",
        city: "拉萨",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 29.65489,
        longitude: 91.104978,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("罗布林卡")
      },
      {
        id: "seed-lhasa-yaowang",
        name: "药王山观景台",
        address: "拉萨市城关区药王山",
        city: "拉萨",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 29.657169,
        longitude: 91.113658,
        recommendedDurationMinutes: 60
      },
      {
        id: "seed-lhasa-sweet-tea",
        name: "光明港琼甜茶馆",
        address: "拉萨市城关区北京东路",
        city: "拉萨",
        country: "CN",
        categories: ["美食", "人文"],
        latitude: 29.646165,
        longitude: 91.136172,
        recommendedDurationMinutes: 60
      }
    ]
  },
  {
    aliases: ["南昌", "南昌市", "nanchang"],
    pois: [
      {
        id: "seed-nanchang-tengwang",
        name: "滕王阁",
        address: "南昌市东湖区仿古街58号",
        city: "南昌",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 28.684205,
        longitude: 115.885278,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("滕王阁")
      },
      {
        id: "seed-nanchang-bayi",
        name: "八一起义纪念馆",
        address: "南昌市西湖区中山路380号",
        city: "南昌",
        country: "CN",
        categories: ["历史", "博物馆"],
        latitude: 28.674585,
        longitude: 115.887598,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("八一起义纪念馆")
      },
      {
        id: "seed-nanchang-wanshou",
        name: "万寿宫历史文化街区",
        address: "南昌市西湖区中山路",
        city: "南昌",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 28.672201,
        longitude: 115.886046,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-nanchang-qiushui",
        name: "秋水广场",
        address: "南昌市红谷滩区赣江中大道",
        city: "南昌",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 28.689416,
        longitude: 115.844208,
        recommendedDurationMinutes: 60
      },
      {
        id: "seed-nanchang-shengjin",
        name: "绳金塔美食街",
        address: "南昌市西湖区绳金塔街东侧",
        city: "南昌",
        country: "CN",
        categories: ["美食", "历史"],
        latitude: 28.658997,
        longitude: 115.893828,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("绳金塔")
      },
      {
        id: "seed-nanchang-meiling",
        name: "梅岭国家森林公园",
        address: "南昌市湾里管理局梅岭镇",
        city: "南昌",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 28.811436,
        longitude: 115.730127,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("梅岭")
      }
    ]
  },
  {
    aliases: ["南宁", "南宁市", "nanning"],
    pois: [
      {
        id: "seed-nanning-qingxiu",
        name: "青秀山",
        address: "南宁市青秀区青秀路19号",
        city: "南宁",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 22.791118,
        longitude: 108.399099,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("青秀山")
      },
      {
        id: "seed-nanning-sanji",
        name: "三街两巷",
        address: "南宁市兴宁区民生路37号附近",
        city: "南宁",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 22.818206,
        longitude: 108.320179,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-nanning-museum",
        name: "广西民族博物馆",
        address: "南宁市青秀区青环路11号",
        city: "南宁",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 22.817778,
        longitude: 108.433757,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("广西民族博物馆")
      },
      {
        id: "seed-nanning-zhongshan",
        name: "中山路夜市",
        address: "南宁市青秀区中山路",
        city: "南宁",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 22.814458,
        longitude: 108.324915,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-nanning-nanhu",
        name: "南湖公园",
        address: "南宁市青秀区双拥路1号",
        city: "南宁",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 22.808042,
        longitude: 108.354703,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("南湖公园_(南宁)")
      },
      {
        id: "seed-nanning-night",
        name: "南宁之夜",
        address: "南宁市良庆区五象新区宋厢路",
        city: "南宁",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 22.757247,
        longitude: 108.373764,
        recommendedDurationMinutes: 90
      }
    ]
  },
  {
    aliases: ["石家庄", "石家庄市", "shijiazhuang"],
    pois: [
      {
        id: "seed-shijiazhuang-zhengding",
        name: "正定古城",
        address: "石家庄市正定县燕赵南大街",
        city: "石家庄",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 38.146817,
        longitude: 114.570383,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("正定古城")
      },
      {
        id: "seed-shijiazhuang-longxing",
        name: "隆兴寺",
        address: "石家庄市正定县中山东路109号",
        city: "石家庄",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 38.149739,
        longitude: 114.570923,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("隆兴寺")
      },
      {
        id: "seed-shijiazhuang-hebei-museum",
        name: "河北博物院",
        address: "石家庄市长安区东大街4号",
        city: "石家庄",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 38.042667,
        longitude: 114.514278,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("河北博物院")
      },
      {
        id: "seed-shijiazhuang-wanlimiao",
        name: "湾里庙步行街",
        address: "石家庄市桥西区民族路",
        city: "石家庄",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 38.041231,
        longitude: 114.497297,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-shijiazhuang-hutuo",
        name: "滹沱河生态旅游景区",
        address: "石家庄市长安区滹沱河畔",
        city: "石家庄",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 38.107629,
        longitude: 114.563272,
        recommendedDurationMinutes: 120
      },
      {
        id: "seed-shijiazhuang-rongguo",
        name: "荣国府",
        address: "石家庄市正定县兴荣路51号",
        city: "石家庄",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 38.15341,
        longitude: 114.563896,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("荣国府_(正定)")
      }
    ]
  },
  {
    aliases: ["台北", "台北市", "taipei"],
    pois: [
      {
        id: "seed-taipei-palace",
        name: "台北故宫博物院",
        address: "台北市士林区至善路二段221号",
        city: "台北",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 25.102398,
        longitude: 121.548704,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("国立故宫博物院")
      },
      {
        id: "seed-taipei-101",
        name: "台北101",
        address: "台北市信义区信义路五段7号",
        city: "台北",
        country: "CN",
        categories: ["夜景", "地标"],
        latitude: 25.033968,
        longitude: 121.564468,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("台北101")
      },
      {
        id: "seed-taipei-ximen",
        name: "西门町",
        address: "台北市万华区西门町",
        city: "台北",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 25.042233,
        longitude: 121.507411,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("西门町")
      },
      {
        id: "seed-taipei-dihua",
        name: "迪化街",
        address: "台北市大同区迪化街一段",
        city: "台北",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 25.056223,
        longitude: 121.510967,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("迪化街")
      },
      {
        id: "seed-taipei-cks",
        name: "中正纪念堂",
        address: "台北市中正区中山南路21号",
        city: "台北",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 25.03456,
        longitude: 121.521144,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("中正纪念堂")
      },
      {
        id: "seed-taipei-xiangshan",
        name: "象山",
        address: "台北市信义区信义路五段150巷",
        city: "台北",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 25.027592,
        longitude: 121.570458,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("象山_(台北市)")
      }
    ]
  },
  {
    aliases: ["太原", "太原市", "taiyuan"],
    pois: [
      {
        id: "seed-taiyuan-jinci",
        name: "晋祠",
        address: "太原市晋源区晋祠镇晋祠公园内",
        city: "太原",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 37.708549,
        longitude: 112.453338,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("晋祠")
      },
      {
        id: "seed-taiyuan-shanxi-museum",
        name: "山西博物院",
        address: "太原市万柏林区滨河西路北段13号",
        city: "太原",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 37.870913,
        longitude: 112.533555,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("山西博物院")
      },
      {
        id: "seed-taiyuan-liuxiang",
        name: "柳巷",
        address: "太原市迎泽区柳巷南路",
        city: "太原",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 37.869648,
        longitude: 112.56382,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("柳巷")
      },
      {
        id: "seed-taiyuan-zhonglou",
        name: "钟楼街",
        address: "太原市迎泽区钟楼街",
        city: "太原",
        country: "CN",
        categories: ["历史", "美食"],
        latitude: 37.87023,
        longitude: 112.565142,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-taiyuan-fenhe",
        name: "汾河景区",
        address: "太原市迎泽区滨河东路",
        city: "太原",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 37.862183,
        longitude: 112.547536,
        recommendedDurationMinutes: 90
      },
      {
        id: "seed-taiyuan-shuangta",
        name: "双塔寺",
        address: "太原市迎泽区郝庄镇双塔寺街9号",
        city: "太原",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 37.85453,
        longitude: 112.592118,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("双塔寺")
      }
    ]
  },
  {
    aliases: ["乌鲁木齐", "乌鲁木齐市", "urumqi", "wulumuqi"],
    pois: [
      {
        id: "seed-urumqi-xinjiang-museum",
        name: "新疆维吾尔自治区博物馆",
        address: "乌鲁木齐市沙依巴克区西北路581号",
        city: "乌鲁木齐",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 43.805313,
        longitude: 87.603406,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("新疆维吾尔自治区博物馆")
      },
      {
        id: "seed-urumqi-bazaar",
        name: "国际大巴扎",
        address: "乌鲁木齐市天山区解放南路8号",
        city: "乌鲁木齐",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 43.777276,
        longitude: 87.613965,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("新疆国际大巴扎")
      },
      {
        id: "seed-urumqi-hongshan",
        name: "红山公园",
        address: "乌鲁木齐市水磨沟区红山路北一巷40号",
        city: "乌鲁木齐",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 43.817669,
        longitude: 87.620792,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("红山公园_(乌鲁木齐)")
      },
      {
        id: "seed-urumqi-minjie",
        name: "新疆民街",
        address: "乌鲁木齐市天山区龙泉街",
        city: "乌鲁木齐",
        country: "CN",
        categories: ["美食", "人文"],
        latitude: 43.788519,
        longitude: 87.618327,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-urumqi-shuimogou",
        name: "水磨沟公园",
        address: "乌鲁木齐市水磨沟区水磨沟路472号",
        city: "乌鲁木齐",
        country: "CN",
        categories: ["自然", "拍照"],
        latitude: 43.845901,
        longitude: 87.654952,
        recommendedDurationMinutes: 90,
        sourcePageUrl: buildWikipediaUrl("水磨沟公园")
      },
      {
        id: "seed-urumqi-people",
        name: "人民公园",
        address: "乌鲁木齐市天山区友好南路",
        city: "乌鲁木齐",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 43.801865,
        longitude: 87.616187,
        recommendedDurationMinutes: 60
      }
    ]
  },
  {
    aliases: ["西宁", "西宁市", "xining"],
    pois: [
      {
        id: "seed-xining-dongguan",
        name: "东关清真大寺",
        address: "西宁市城东区东关大街34号",
        city: "西宁",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 36.624954,
        longitude: 101.787433,
        recommendedDurationMinutes: 75,
        sourcePageUrl: buildWikipediaUrl("东关清真大寺")
      },
      {
        id: "seed-xining-qinghai-museum",
        name: "青海省博物馆",
        address: "西宁市城西区西关大街58号",
        city: "西宁",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 36.617241,
        longitude: 101.757664,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("青海省博物馆")
      },
      {
        id: "seed-xining-mojia",
        name: "莫家街",
        address: "西宁市城中区饮马街与莫家街交汇处",
        city: "西宁",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 36.623479,
        longitude: 101.778173,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-xining-taer",
        name: "塔尔寺",
        address: "西宁市湟中区金塔路56号",
        city: "西宁",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 36.480485,
        longitude: 101.569677,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("塔尔寺")
      },
      {
        id: "seed-xining-nanshan",
        name: "南山公园",
        address: "西宁市城中区凤凰山路211号",
        city: "西宁",
        country: "CN",
        categories: ["自然", "夜景"],
        latitude: 36.604811,
        longitude: 101.776805,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-xining-tibetan",
        name: "青海藏文化博物院",
        address: "西宁市城东区昆仑东路56号",
        city: "西宁",
        country: "CN",
        categories: ["博物馆", "人文"],
        latitude: 36.612154,
        longitude: 101.840434,
        recommendedDurationMinutes: 90
      }
    ]
  },
  {
    aliases: ["银川", "银川市", "yinchuan"],
    pois: [
      {
        id: "seed-yinchuan-zhenbeibao",
        name: "镇北堡西部影城",
        address: "银川市西夏区镇北堡110国道路东",
        city: "银川",
        country: "CN",
        categories: ["历史", "拍照"],
        latitude: 38.625265,
        longitude: 106.000361,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("镇北堡西部影城")
      },
      {
        id: "seed-yinchuan-xixia",
        name: "西夏陵",
        address: "银川市西夏区贺兰山东麓",
        city: "银川",
        country: "CN",
        categories: ["历史", "自然"],
        latitude: 38.484305,
        longitude: 105.998172,
        recommendedDurationMinutes: 150,
        sourcePageUrl: buildWikipediaUrl("西夏陵")
      },
      {
        id: "seed-yinchuan-ningxia-museum",
        name: "宁夏博物馆",
        address: "银川市金凤区人民广场东街6号",
        city: "银川",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 38.486698,
        longitude: 106.228086,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("宁夏博物馆")
      },
      {
        id: "seed-yinchuan-huaiyuan",
        name: "怀远夜市",
        address: "银川市西夏区怀远东路",
        city: "银川",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 38.492527,
        longitude: 106.124283,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-yinchuan-lanshan",
        name: "览山公园",
        address: "银川市金凤区亲水北大街",
        city: "银川",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 38.517524,
        longitude: 106.238981,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-yinchuan-gulou",
        name: "银川鼓楼",
        address: "银川市兴庆区解放东街",
        city: "银川",
        country: "CN",
        categories: ["历史", "建筑"],
        latitude: 38.468071,
        longitude: 106.273793,
        recommendedDurationMinutes: 45,
        sourcePageUrl: buildWikipediaUrl("银川鼓楼")
      }
    ]
  },
  {
    aliases: ["郑州", "郑州市", "zhengzhou"],
    pois: [
      {
        id: "seed-zhengzhou-erqi",
        name: "二七纪念塔",
        address: "郑州市二七区二七路230号",
        city: "郑州",
        country: "CN",
        categories: ["历史", "夜景"],
        latitude: 34.756871,
        longitude: 113.663221,
        recommendedDurationMinutes: 60,
        sourcePageUrl: buildWikipediaUrl("二七纪念塔")
      },
      {
        id: "seed-zhengzhou-henan-museum",
        name: "河南博物院",
        address: "郑州市金水区农业路8号",
        city: "郑州",
        country: "CN",
        categories: ["博物馆", "历史"],
        latitude: 34.787901,
        longitude: 113.660382,
        recommendedDurationMinutes: 120,
        sourcePageUrl: buildWikipediaUrl("河南博物院")
      },
      {
        id: "seed-zhengzhou-dehua",
        name: "德化步行街",
        address: "郑州市二七区德化街",
        city: "郑州",
        country: "CN",
        categories: ["美食", "夜景"],
        latitude: 34.751374,
        longitude: 113.668219,
        recommendedDurationMinutes: 75
      },
      {
        id: "seed-zhengzhou-ruyi",
        name: "如意湖文化广场",
        address: "郑州市郑东新区如意湖",
        city: "郑州",
        country: "CN",
        categories: ["夜景", "拍照"],
        latitude: 34.753787,
        longitude: 113.731527,
        recommendedDurationMinutes: 60
      },
      {
        id: "seed-zhengzhou-only-henan",
        name: "只有河南·戏剧幻城",
        address: "郑州市中牟县平安大道与广信街交叉口",
        city: "郑州",
        country: "CN",
        categories: ["历史", "人文"],
        latitude: 34.720888,
        longitude: 113.987216,
        recommendedDurationMinutes: 150
      },
      {
        id: "seed-zhengzhou-ersha",
        name: "二砂文创园",
        address: "郑州市中原区华山路105号",
        city: "郑州",
        country: "CN",
        categories: ["拍照", "人文"],
        latitude: 34.760875,
        longitude: 113.612471,
        recommendedDurationMinutes: 75
      }
    ]
  }
] as const satisfies ReadonlyArray<CoreCitySeedGroup>;

const coreCitySeedMap = new Map<string, Poi[]>();

for (const group of coreCitySeedGroups) {
  const normalizedAliases = group.aliases.map((alias) => normalizeDestinationTerm(alias)).filter(Boolean);
  const pois = group.pois.map((poi) => ({ ...poi }));

  for (const alias of normalizedAliases) {
    coreCitySeedMap.set(alias, pois);
  }
}

export function getCoreCitySeedPois(destination: string) {
  const seeds = coreCitySeedMap.get(normalizeDestinationTerm(destination));
  if (!seeds) {
    return [];
  }

  return seeds.map((poi) => ({
    ...poi,
    categories: [...poi.categories]
  }));
}
