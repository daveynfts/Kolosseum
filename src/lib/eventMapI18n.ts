/**
 * Lightweight VI/EN i18n for Conviction Event Map.
 * Persists choice in localStorage; falls back to browser language.
 */
import { useCallback, useEffect, useState } from 'react'

export type EventMapLocale = 'vi' | 'en'

const STORAGE_KEY = 'emp-locale-v1'

const DICT = {
  vi: {
    pageTitle: 'Conviction 2026 · Side Events',
    mainHeader: 'Main · {window} · {venue} · Thủ Đức',
    liveCount: '{n} đang live',
    fromConviction: 'Từ Conviction',
    fromConvictionTitle: 'Từ Thiskyhall Sala · Conviction main venue',
    fromMe: 'Từ tôi',
    fromMeTitle: 'Từ vị trí của bạn',
    locating: 'Đang lấy vị trí…',
    betweenEvents: 'Giữa events',
    betweenEventsTitle: 'Từ sự kiện đang chọn',
    distGroup: 'Đo khoảng cách',
    sortGroup: 'Sắp xếp',
    sortUpcoming: 'Sắp tới',
    sortUpcomingTitle: 'Sắp diễn ra / đang live trước',
    sortNearest: 'Gần nhất',
    sortNearestTitle: 'Gần → xa',
    openList: 'Mở list',
    expandList: 'Mở rộng',
    collapseList: 'Thu list',
    filterDays: 'Lọc theo ngày',
    scope: 'Phạm vi',
    all: 'Tất cả',
    dateUnconfirmed: 'Ngày chưa chốt',
    eventsInWeek: '{n} sự kiện trong tuần',
    pickDay: 'Chọn ngày',
    dayTitle: '{date} · {n} sự kiện',
    dayTitleMain: '{short} · {track}{sides}',
    daySides: ' · {n} side',
    dateNotSet: 'Chưa chốt ngày',
    mainForumDay: 'Main forum · Day {day}',
    mainPinHint: ' · pin lớn trên map',
    fromTime: ' · từ 08:00',
    untilTime: ' · đến 18:00',
    agenda: 'Agenda',
    timelineAria: 'Timeline trùng giờ trong ngày',
    timelineTitle: 'Timeline ngày',
    timelineSub: '{date} · side events chồng giờ được tô cam',
    timelineWarn: '{n} side trùng slot',
    timelineOk: 'Không trùng side',
    timelineLegend:
      'Vàng = Main forum · Tím = Stage Sala · Cam = side trùng giờ · Click bar để mở pin',
    typesAll: 'Mọi loại',
    freeOnly: 'Free',
    searchPh: 'Tìm tên / host / địa điểm…',
    filterTimeAll: 'Cả ngày',
    filterMorning: 'Sáng',
    filterAfternoon: 'Chiều',
    filterEvening: 'Tối',
    filterHasPin: 'Có pin',
    filterHasPinTitle: 'Chỉ sự kiện đã có địa điểm trên map',
    filterMore: 'Thêm · loại',
    filterMoreHide: 'Ẩn loại',
    filterMoreTitle: 'Lọc theo loại sự kiện (nâng cao)',
    filterRowPrimary: 'Bộ lọc chính',
    metaEvents: '{n} sự kiện',
    metaOnMap: ' · {n} trên map',
    metaSortUpcoming: ' · sort: sắp tới',
    metaSortNearest: ' · sort: gần nhất',
    chipEvents: '{n} sự kiện',
    chipEventsToday: '{n} hôm nay',
    chipEventsDay: '{n} ngày này',
    chipEventsWord: 'sự kiện',
    chipEventsTodayWord: 'hôm nay',
    chipEventsDayWord: 'ngày này',
    chipConflict: '{n} trùng giờ',
    chipConflictWord: 'cùng giờ',
    chipConflictAria: '{n} sự kiện trùng khung giờ — mở timeline',
    chipTbd: '{n} TBD',
    chipTbdWord: 'TBD',
    chipConflictTitle: 'Xem timeline trùng giờ',
    chipTbdTitle: 'Chỉ hiện sự kiện chưa chốt ngày/địa điểm',
    chipEventsTitle: 'Số sự kiện đang lọc',
    panelTitle: 'Main forum + Side events',
    panelToday: 'Đang lọc hôm nay · Main trước · side sắp tới',
    panelAll: 'Mọi ngày · Main forum tách riêng · side events bên dưới',
    panelDay: 'Ngày {date} · Main rồi side',
    panelDist: 'khoảng cách từ {from}',
    fromYou: 'bạn',
    fromSelected: 'event chọn',
    fromVenue: 'Conviction',
    emptyToday: 'Không có sự kiện hôm nay. Thử',
    emptyFilter: 'Không khớp bộ lọc. Thử “Tất cả” hoặc bỏ “Chỉ Free”.',
    orOtherDay: 'hoặc ngày khác.',
    dateTbd: 'Ngày TBD',
    today: 'Hôm nay',
    sectionMain: 'Main forum',
    sectionMainHint: 'Diễn đàn chính · pin vàng lớn',
    sectionSide: 'Side events',
    sectionSideHint: '{n} sự kiện',
    sectionSideHintStage: ' · Stage Sala = viền tím',
    badgeMain: 'Main forum',
    badgeStage: 'Stage · Sala',
    badgeSide: 'Side event',
    badgeConflict: 'Trùng giờ · {n}',
    badgeConflictShort: '{n} cùng giờ',
    badgeLocTbd: 'Location TBD',
    badgeDateTbd: 'Date TBD',
    badgeLive: 'Đang diễn ra',
    badgeFree: 'Free',
    timeTbd: 'Time TBD',
    placeTbd: 'Địa điểm sẽ công bố sau (TBD)',
    noCoords: 'Chưa có tọa độ · xem chi tiết bên dưới',
    metaMain: 'Main forum · Thiskyhall Sala · 14–15/08',
    metaStage: 'Side stage tại venue chính (Sala)',
    metaSide: 'Side event · ngoài main stage',
    metaLocTbd: ' · Địa điểm public sau khi duyệt Luma',
    conflictHint: ' — chọn 1 slot hoặc đi nối nếu venue gần',
    conflictPick: 'Trùng giờ · chọn sự kiện',
    conflictPickHint: 'Chạm ảnh để mở',
    registerLuma: 'Đăng ký Luma',
    directions: 'Chỉ đường',
    mainVenue: 'Venue chính',
    addCalendar: 'Thêm lịch',
    register: 'Đăng ký',
    host: 'Host',
    place: 'Địa điểm',
    placeTbdLong: 'Địa điểm sẽ công bố sau khi duyệt (Location TBD)',
    pinTempNote: 'Pin tạm tại Thiskyhall Sala · tọa độ thật chưa public',
    whenTbd: 'Ngày TBD · {time}',
    liveNow: 'Đang diễn ra',
    langToggle: 'Ngôn ngữ',
    langVi: 'VI',
    langEn: 'EN',
    // status details
    statusDateTbd: 'Ngày chưa công bố',
    statusMissingStart: 'Thiếu giờ bắt đầu',
    statusStartsIn: 'Bắt đầu sau {cd}',
    statusLiveLeft: 'Đang diễn ra · còn {cd}',
    statusEnded: 'Đã kết thúc',
    // distance
    driveLt1: '< 1 phút đi xe',
    driveMin: '~{n} phút đi xe',
    driveHour: '~{h}h{m}m đi xe',
    driveFrom: '{dist} · {eta} từ {from}',
    // conflict
    conflictWith: 'Trùng giờ với {names}',
    conflictWithMore: 'Trùng giờ với {names} +{n}',
    // month
    monthYear: 'Tháng {m} · {y}',
    // tiers
    tierMain: 'MAIN',
    tierStage: 'STAGE',
    tierSide: 'SIDE',
    loading: 'Đang tải bản đồ…',
    toolsMore: 'Thêm',
    toolsLess: 'Ẩn',
    mapHint: 'Chạm pin · xem chi tiết',
    sheetAria: 'Danh sách sự kiện',
    fabList: 'List',
    fabListOpen: 'Mở list',
    fabLocate: 'Vị trí',
    filtersCollapse: 'Thu gọn lịch',
    filtersExpand: 'Mở lịch',
    pageTitleShort: 'Conviction · Events',
    calendarToggle: 'Lịch + Timeline',
    calendarHide: 'Minimize',
    calendarShow: 'Expand',
    calendarCollapsedHint: 'đã thu · map rộng hơn',
    panelTitleSimple: 'Side events',
  },
  en: {
    pageTitle: 'Conviction 2026 · Side Events',
    mainHeader: 'Main · {window} · {venue} · Thu Duc',
    liveCount: '{n} live now',
    fromConviction: 'From Conviction',
    fromConvictionTitle: 'From Thiskyhall Sala · main venue',
    fromMe: 'From me',
    fromMeTitle: 'From your location',
    locating: 'Getting your location…',
    betweenEvents: 'Between events',
    betweenEventsTitle: 'From selected event',
    distGroup: 'Distance origin',
    sortGroup: 'Sort',
    sortUpcoming: 'Upcoming',
    sortUpcomingTitle: 'Live / starting soon first',
    sortNearest: 'Nearest',
    sortNearestTitle: 'Near → far',
    openList: 'Open list',
    expandList: 'Expand',
    collapseList: 'Collapse',
    filterDays: 'Filter by day',
    scope: 'Scope',
    all: 'All',
    dateUnconfirmed: 'Date TBD',
    eventsInWeek: '{n} events this week',
    pickDay: 'Pick a day',
    dayTitle: '{date} · {n} events',
    dayTitleMain: '{short} · {track}{sides}',
    daySides: ' · {n} side',
    dateNotSet: 'Date not set',
    mainForumDay: 'Main forum · Day {day}',
    mainPinHint: ' · large pin on map',
    fromTime: ' · from 08:00',
    untilTime: ' · until 18:00',
    agenda: 'Agenda',
    timelineAria: 'Same-day schedule conflict timeline',
    timelineTitle: 'Day timeline',
    timelineSub: '{date} · overlapping side events highlighted in orange',
    timelineWarn: '{n} side slots overlap',
    timelineOk: 'No side conflicts',
    timelineLegend:
      'Gold = Main · Purple = Sala stage · Orange = overlapping sides · Click a bar to open',
    typesAll: 'All types',
    freeOnly: 'Free',
    searchPh: 'Search title / host / place…',
    filterTimeAll: 'All day',
    filterMorning: 'Morning',
    filterAfternoon: 'Afternoon',
    filterEvening: 'Evening',
    filterHasPin: 'On map',
    filterHasPinTitle: 'Only events with a public map pin',
    filterMore: 'More · type',
    filterMoreHide: 'Hide types',
    filterMoreTitle: 'Filter by event type (advanced)',
    filterRowPrimary: 'Primary filters',
    metaEvents: '{n} events',
    metaOnMap: ' · {n} on map',
    metaSortUpcoming: ' · sort: upcoming',
    metaSortNearest: ' · sort: nearest',
    chipEvents: '{n} events',
    chipEventsToday: '{n} today',
    chipEventsDay: '{n} this day',
    chipEventsWord: 'events',
    chipEventsTodayWord: 'today',
    chipEventsDayWord: 'this day',
    chipConflict: '{n} overlap',
    chipConflictWord: 'same time',
    chipConflictAria: '{n} events at the same time — open timeline',
    chipTbd: '{n} TBD',
    chipTbdWord: 'TBD',
    chipConflictTitle: 'Jump to conflict timeline',
    chipTbdTitle: 'Show date/location TBD only',
    chipEventsTitle: 'Events in current filter',
    panelTitle: 'Main forum + Side events',
    panelToday: 'Today · Main first · upcoming sides',
    panelAll: 'All days · Main section then side events',
    panelDay: '{date} · Main then sides',
    panelDist: 'distance from {from}',
    fromYou: 'you',
    fromSelected: 'selected event',
    fromVenue: 'Conviction',
    emptyToday: 'No events today. Try',
    emptyFilter: 'No matches. Try “All” or turn off “Free only”.',
    orOtherDay: 'or another day.',
    dateTbd: 'Date TBD',
    today: 'Today',
    sectionMain: 'Main forum',
    sectionMainHint: 'Main stage · large gold pin',
    sectionSide: 'Side events',
    sectionSideHint: '{n} events',
    sectionSideHintStage: ' · Sala stage = purple ring',
    badgeMain: 'Main forum',
    badgeStage: 'Stage · Sala',
    badgeSide: 'Side event',
    badgeConflict: 'Conflict · {n}',
    badgeConflictShort: '{n} same time',
    badgeLocTbd: 'Location TBD',
    badgeDateTbd: 'Date TBD',
    badgeLive: 'Live now',
    badgeFree: 'Free',
    timeTbd: 'Time TBD',
    placeTbd: 'Location announced after approval (TBD)',
    noCoords: 'No coordinates yet · see details below',
    metaMain: 'Main forum · Thiskyhall Sala · 14–15 Aug',
    metaStage: 'Side stage at the main venue (Sala)',
    metaSide: 'Side event · off main stage',
    metaLocTbd: ' · Location public after Luma approval',
    conflictHint: ' — pick one slot, or hop if venues are close',
    conflictPick: 'Overlaps · pick one',
    conflictPickHint: 'Tap a cover to open',
    registerLuma: 'Register on Luma',
    directions: 'Directions',
    mainVenue: 'Main venue',
    addCalendar: 'Add to calendar',
    register: 'Register',
    host: 'Host',
    place: 'Venue',
    placeTbdLong: 'Location revealed after approval (Location TBD)',
    pinTempNote: 'Temporary pin at Thiskyhall Sala · exact coords not public',
    whenTbd: 'Date TBD · {time}',
    liveNow: 'Live now',
    langToggle: 'Language',
    langVi: 'VI',
    langEn: 'EN',
    statusDateTbd: 'Date not announced',
    statusMissingStart: 'Missing start time',
    statusStartsIn: 'Starts in {cd}',
    statusLiveLeft: 'Live · {cd} left',
    statusEnded: 'Ended',
    driveLt1: '< 1 min ride',
    driveMin: '~{n} min ride',
    driveHour: '~{h}h{m}m ride',
    driveFrom: '{dist} · {eta} from {from}',
    conflictWith: 'Overlaps {names}',
    conflictWithMore: 'Overlaps {names} +{n}',
    monthYear: '{month} {y}',
    tierMain: 'MAIN',
    tierStage: 'STAGE',
    tierSide: 'SIDE',
    loading: 'Loading map…',
    toolsMore: 'More',
    toolsLess: 'Less',
    mapHint: 'Tap a pin · view details',
    sheetAria: 'Event list',
    fabList: 'List',
    fabListOpen: 'Open list',
    fabLocate: 'Locate',
    filtersCollapse: 'Hide calendar',
    filtersExpand: 'Show calendar',
    pageTitleShort: 'Conviction · Events',
    calendarToggle: 'Calendar + Timeline',
    calendarHide: 'Minimize',
    calendarShow: 'Expand',
    calendarCollapsedHint: 'minimized · larger map',
    panelTitleSimple: 'Side events',
  },
} as const

export type EventMapMsgKey = keyof typeof DICT.vi

export function detectDefaultLocale(): EventMapLocale {
  try {
    const nav = (navigator.language || '').toLowerCase()
    if (nav.startsWith('vi')) return 'vi'
    if (nav.startsWith('en')) return 'en'
  } catch {
    /* ignore */
  }
  return 'vi'
}

export function readStoredLocale(): EventMapLocale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'vi' || v === 'en') return v
  } catch {
    /* ignore */
  }
  return null
}

export function writeStoredLocale(locale: EventMapLocale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export function t(
  locale: EventMapLocale,
  key: EventMapMsgKey,
  vars?: Record<string, string | number>,
): string {
  const table = DICT[locale] || DICT.vi
  let s: string = table[key] ?? DICT.vi[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}

export function useEventMapLocale(): {
  locale: EventMapLocale
  setLocale: (l: EventMapLocale) => void
  tt: (key: EventMapMsgKey, vars?: Record<string, string | number>) => string
} {
  const [locale, setLocaleState] = useState<EventMapLocale>(() => {
    return readStoredLocale() || detectDefaultLocale()
  })

  useEffect(() => {
    writeStoredLocale(locale)
    try {
      document.documentElement.lang = locale === 'vi' ? 'vi' : 'en'
    } catch {
      /* ignore */
    }
  }, [locale])

  const setLocale = useCallback((l: EventMapLocale) => {
    setLocaleState(l)
  }, [])

  const tt = useCallback(
    (key: EventMapMsgKey, vars?: Record<string, string | number>) =>
      t(locale, key, vars),
    [locale],
  )

  return { locale, setLocale, tt }
}

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_VI_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WEEKDAYS_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
]
const WEEKDAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export function formatWeekdayShort(
  isoDate: string,
  locale: EventMapLocale,
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return ''
  const table = locale === 'en' ? WEEKDAYS_EN_SHORT : WEEKDAYS_VI_SHORT
  return table[d.getUTCDay()] || ''
}

export function formatMonthYear(
  isoDate: string,
  locale: EventMapLocale,
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return ''
  if (locale === 'en') {
    return t('en', 'monthYear', {
      month: MONTHS_EN[Number(m[2]) - 1] || m[2],
      y: m[1],
    })
  }
  return t('vi', 'monthYear', { m: Number(m[2]), y: m[1] })
}

export function formatLumaDayLocale(
  isoDate: string,
  locale: EventMapLocale,
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return `${m[3]}/${m[2]}`
  if (locale === 'en') {
    return `${WEEKDAYS_EN[d.getUTCDay()]}, ${MONTHS_EN[Number(m[2]) - 1]} ${Number(m[3])}`
  }
  return `${WEEKDAYS_VI[d.getUTCDay()]}, ${Number(m[3])}/${Number(m[2])}`
}
