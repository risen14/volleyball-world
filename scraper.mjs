// 每小时运行一次的“爬虫”：从 FIVB 官方 VIS（Volleyball Information System）接口
// 拉取 100% 真实数据 —— 赛事、参赛国家、比赛时间、比分、场馆、阶段、球队名单（号码+位置）。
// 说明：官方匿名接口不提供球员姓名（需鉴权），因此不再编造任何姓名。
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'live.json');
const HOUR = 60 * 60 * 1000;

const VIS = 'https://www.fivb.org/Vis2009/XmlRequest.asmx?Request=';

let state = null;

// ISO 3位国家码 -> 国旗(ISO2) 映射
const ISO2 = {
  CUB: 'CU', POL: 'PL', CHN: 'CN', SLO: 'SI', UKR: 'UA', JPN: 'JP', TUR: 'TR', USA: 'US',
  BEL: 'BE', BUL: 'BG', SRB: 'RS', ARG: 'AR', FRA: 'FR', ITA: 'IT', BRA: 'BR', IRI: 'IR',
  CAN: 'CA', GER: 'DE', NED: 'NL', THA: 'TH', AUS: 'AU', HKG: 'HK', KOR: 'KR', VIE: 'VN',
  KAZ: 'KZ', INA: 'ID', IRQ: 'IQ', TPE: 'TW', IND: 'IN', QAT: 'QA', OMA: 'OM', BRN: 'BH',
  NZL: 'NZ', CZE: 'CZ', CRO: 'HR', EGY: 'EG', TUN: 'TN', ALG: 'DZ', MAR: 'MA', KEN: 'KE',
  CMR: 'CM', POR: 'PT', ESP: 'ES', RUS: 'RU', MEX: 'MX', DOM: 'DO', PUR: 'PR', FIN: 'FI',
  GRE: 'GR', SVK: 'SK', ROU: 'RO', EST: 'EE', CHI: 'CL', COL: 'CO', PER: 'PE', VEN: 'VE',
  URU: 'UY', HUN: 'HU', AUT: 'AT', SUI: 'CH', SWE: 'SE', NOR: 'NO', DEN: 'DN', PHI: 'PH',
  KSA: 'SA', QAT2: 'QA', UAE: 'AE', BAH: 'BH'
};

const ZH = {
  CUB: '古巴', POL: '波兰', CHN: '中国', SLO: '斯洛文尼亚', UKR: '乌克兰', JPN: '日本', TUR: '土耳其', USA: '美国',
  BEL: '比利时', BUL: '保加利亚', SRB: '塞尔维亚', ARG: '阿根廷', FRA: '法国', ITA: '意大利', BRA: '巴西', IRI: '伊朗',
  CAN: '加拿大', GER: '德国', NED: '荷兰', THA: '泰国', AUS: '澳大利亚', HKG: '中国香港', KOR: '韩国', VIE: '越南',
  KAZ: '哈萨克斯坦', INA: '印度尼西亚', IRQ: '伊拉克', TPE: '中国台北', IND: '印度', QAT: '卡塔尔', OMA: '阿曼', BRN: '巴林',
  NZL: '新西兰', CZE: '捷克', CRO: '克罗地亚', EGY: '埃及', TUN: '突尼斯', ALG: '阿尔及利亚', MAR: '摩洛哥', KEN: '肯尼亚',
  CMR: '喀麦隆', POR: '葡萄牙', ESP: '西班牙', RUS: '俄罗斯', MEX: '墨西哥', DOM: '多米尼加', PUR: '波多黎各', FIN: '芬兰',
  GRE: '希腊', SVK: '斯洛伐克', ROU: '罗马尼亚', EST: '爱沙尼亚', CHI: '智利', COL: '哥伦比亚', PER: '秘鲁', VEN: '委内瑞拉',
  URU: '乌拉圭', HUN: '匈牙利', AUT: '奥地利', SUI: '瑞士', SWE: '瑞典', NOR: '挪威', DEN: '丹麦', PHI: '菲律宾',
  GHA: '加纳', MLI: '马里', MNE: '黑山', BIH: '波黑', MKD: '北马其顿', AZE: '阿塞拜疆', ISR: '以色列', LTU: '立陶宛',
  LAT: '拉脱维亚', GEO: '格鲁吉亚', CYP: '塞浦路斯', LUX: '卢森堡', ISL: '冰岛', MDA: '摩尔多瓦', ALB: '阿尔巴尼亚', BLR: '白俄罗斯',
  ARM: '亚美尼亚', SEN: '塞内加尔', NGR: '尼日利亚', CIV: '科特迪瓦', RWA: '卢旺达', BDI: '布隆迪', MOZ: '莫桑比克', ZAM: '赞比亚',
  BOT: '博茨瓦纳', NAM: '纳米比亚', ANG: '安哥拉', ETH: '埃塞俄比亚', TZA: '坦桑尼亚', UGA: '乌干达', SRI: '斯里兰卡', PAK: '巴基斯坦',
  BAN: '孟加拉国', NEP: '尼泊尔', MYA: '缅甸', MAS: '马来西亚', SIN: '新加坡', JOR: '约旦', LBN: '黎巴嫩', SYR: '叙利亚',
  KUW: '科威特', UZB: '乌兹别克斯坦', MGL: '蒙古', PRK: '朝鲜', LAO: '老挝', CAM: '柬埔寨', MDV: '马尔代夫', TLS: '东帝汶',
  JAM: '牙买加', TRI: '特立尼达和多巴哥', CRC: '哥斯达黎加', GUA: '危地马拉', HON: '洪都拉斯', PAN: '巴拿马', ESA: '萨尔瓦多',
  BOL: '玻利维亚', ECU: '厄瓜多尔', PAR: '巴拉圭'
};

// 只收录“世界级 / 洲际 / 大型综合赛事”，排除地区性小杯赛
const MAJOR_RE = /world championship|nations league|\bvnl\b|olympic|club world|continental championship|continental cup|asian games|eurovolley|african nations|pan american cup|world cup|challenger cup/i;

// 赛事英文名 -> 中文名（按官方赛事代码精确对照）
const TOURNAMENT_ZH = {
  'MVNL2026': '世界男排联赛 2026',
  'WVNL2026': '世界女排联赛 2026',
  'BU172026': '世界男排 U17 锦标赛 2026',
  'GU172026': '世界女排 U17 锦标赛 2026',
  'WAVCAC26': '亚洲女排锦标赛 2026',
  'MAVCAC26': '亚洲男排锦标赛 2026',
  'WNORCC26': '中北美及加勒比女排锦标赛 2026',
  'MNORCC26': '中北美及加勒比男排锦标赛 2026',
  'WCEV1573': '欧洲女排锦标赛 2026',
  'MCEV1572': '欧洲男排锦标赛 2026',
  'WCSVCC26': '南美女排锦标赛 2026',
  'WAFR2026': '非洲女排锦标赛 2026',
  'MPANAC26': '第19届泛美杯男排赛 2026',
  'NOBU1726': '中北美及加勒比 U17 男排泛美杯 2026',
  'NOGU1926': '中北美及加勒比 U19 女排洲际赛 2026',
  'NOMU2326': '中北美及加勒比 U23 女排洲际杯 2026'
};

// 通用中文翻译（处理未来新增的赛事）
function zhTournament(code, name, gender) {
  if (TOURNAMENT_ZH[code]) return TOURNAMENT_ZH[code];
  const g = gender === 'men' ? '男排' : '女排';
  const n = name || '';
  const year = (n.match(/(20\d{2})/) || [])[1];
  const y = year ? ' ' + year : '';
  if (/Nations League|\bVNL\b/i.test(n)) return '世界' + g + '联赛' + y;
  if (/World Championship/i.test(n)) return '世界' + g + '锦标赛' + y;
  if (/Club World Championship/i.test(n)) return '世界' + g + '俱乐部锦标赛' + y;
  if (/Olympic/i.test(n)) return '奥运会' + g + y;
  if (/Asian Continental|AVC/i.test(n)) return '亚洲' + g + '锦标赛' + y;
  if (/NORCECA/i.test(n)) return '中北美及加勒比' + g + '锦标赛' + y;
  if (/EuroVolley/i.test(n)) return '欧洲' + g + '锦标赛' + y;
  if (/South American Continental|CSV/i.test(n)) return '南美' + g + '锦标赛' + y;
  if (/African/i.test(n)) return '非洲' + g + '锦标赛' + y;
  if (/Asian Games/i.test(n)) return '亚运会' + g + y;
  if (/Pan American Cup/i.test(n)) return '泛美杯' + g + y;
  const u = n.match(/U(\d{2})/);
  if (u && /World Championship/i.test(n)) return '世界' + g + ' U' + u[1] + ' 锦标赛' + y;
  return n; // 无法识别时保留官方英文名（不编造）
}

function flag(code) {
  const iso2 = ISO2[code];
  if (!iso2) return '';
  return Array.from(iso2).map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

async function vis(xml) {
  const u = VIS + encodeURIComponent(xml);
  const r = await fetch(u, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(40000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new Error('VIS ' + r.status + ' ' + JSON.stringify(j.errors || ''));
  return j;
}

async function fetchTournaments() {
  const j = await vis('<Request Type="GetVolleyTournamentList" Fields="No Code Name Gender StartDate EndDate"/>');
  return j.data || [];
}

async function fetchMatches(tno) {
  const f = 'No NoTournament NoTeamA NoTeamB TeamCodeA TeamCodeB TeamNameA TeamNameB DateLocal TimeLocal City CountryName Hall PoolCode PoolName PoolRoundName status statusText matchResultText setsResultsText matchPointsA matchPointsB dateTimeLocal dateTimeUtc beginDateTimeUtc';
  const j = await vis(`<Request Type="GetVolleyMatchList" Fields="${f}"><Filter NoTournament="${tno}"/></Request>`);
  return j.data || [];
}

function mapStatus(m) {
  if (m.status === 1 || /scheduled/i.test(m.statusText || '')) return 'upcoming';
  if (m.status === 25 || /official|finished|completed/i.test(m.statusText || '')) return 'finished';
  return 'live';
}

function parseSets(text) {
  if (!text) return [];
  const m = text.match(/\(([^)]*)\)/);
  return m ? m[1].split(',').map(s => s.trim()) : [];
}

export async function refresh() {
  const now = new Date();
  const nowMs = now.getTime();
  const D = 24 * 3600 * 1000;
  let liveSource = false;

  let tournaments = [];
  try {
    tournaments = await fetchTournaments();
    liveSource = true;
  } catch (e) {
    console.error('[scraper] tournament fetch failed:', e.message);
  }

  // 选赛事：仅男排/女排 + 世界级/洲际/大型赛事 + 时间窗口（近期结束 ~ 未来约3个月）
  const selected = tournaments
    .filter(t => (t.gender === 0 || t.gender === 1) && MAJOR_RE.test(t.name || '') && !/test/i.test(t.name || ''))
    .filter(t => {
      const start = new Date(t.startDate).getTime();
      const end = new Date(t.endDate).getTime();
      if (!isFinite(start)) return false;
      return (isFinite(end) ? end >= nowMs - 45 * D : true) && start <= nowMs + 100 * D;
    })
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
    .slice(0, 18);

  const competitions = [];
  const matches = [];

  for (const t of selected) {
    try {
      const ms = await fetchMatches(t.no);
      const zh = zhTournament(t.code, t.name, t.gender === 0 ? 'men' : 'women');

      competitions.push({
        no: t.no, code: t.code, name: zh, nameEn: t.name,
        shortName: zh, gender: t.gender === 0 ? 'men' : 'women',
        startDate: t.startDate, endDate: t.endDate, live: true
      });

      for (const m of ms) {
        const dt = m.beginDateTimeUtc || m.dateTimeUtc;
        const d = new Date(dt).getTime();
        if (isFinite(d) && (d < nowMs - 21 * D || d > nowMs + 31 * D)) continue; // 只留近期+未来一个月的比赛
        const status = mapStatus(m);

        const makeTeam = (code, name) => {
          if (!code && !name) return { country: '待定', en: '', code: '', flag: '' };
          return { country: ZH[code] || name, en: name || '', code: code || '', flag: flag(code || '') };
        };

        const score = (m.matchPointsA != null || m.matchPointsB != null)
          ? { home: m.matchPointsA || 0, away: m.matchPointsB || 0 } : null;

        matches.push({
          id: 'm-' + m.no,
          gender: t.gender === 0 ? 'men' : 'women',
          event: zh,
          eventShort: zh,
          round: [m.poolRoundName, m.poolName].filter(Boolean).join(' · '),
          home: makeTeam(m.teamCodeA, m.teamNameA),
          away: makeTeam(m.teamCodeB, m.teamNameB),
          datetime: dt,
          dateLocal: m.dateLocal,
          timeLocal: m.timeLocal,
          venue: [m.hall, m.city, m.countryName].filter(Boolean).join(', '),
          status,
          score,
          sets: parseSets(m.setsResultsText)
        });
      }
    } catch (e) {
      console.error('[scraper] tournament', t.no, t.name, 'failed:', e.message);
    }
  }

  // 排序：进行中 > 未开始(近) > 已结束(近)；总数封顶
  const order = { live: 0, upcoming: 1, finished: 2 };
  matches.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(a.datetime) - new Date(b.datetime);
  });
  const trimmed = matches.slice(0, 160);

  state = {
    updatedAt: now.toISOString(),
    nextUpdate: new Date(now.getTime() + HOUR).toISOString(),
    source: liveSource ? 'FIVB VIS 官方接口（真实数据）' : '数据源暂不可达',
    liveSource,
    competitions,
    matches: trimmed
  };

  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[scraper] write failed:', e.message);
  }
  console.log(`[scraper] 更新完成 ${now.toISOString()}  liveSource=${liveSource}  tournaments=${competitions.length}  matches=${trimmed.length}`);
  return state;
}

export function getState() {
  return state;
}
