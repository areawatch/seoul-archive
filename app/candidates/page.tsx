'use client';

import React, { useEffect, useMemo, useState } from 'react';
import candidatesFile from '@/public/data/candidates.json';
import wealthRecords from '../../data.json';

const NEC_ELECTION_ID = '0020260603';

/** 선관위 구시군 드롭다운 순서와 동일 */
const SEOUL_DISTRICTS = [
  '종로구',
  '중구',
  '용산구',
  '성동구',
  '광진구',
  '동대문구',
  '중랑구',
  '성북구',
  '강북구',
  '도봉구',
  '노원구',
  '은평구',
  '서대문구',
  '마포구',
  '양천구',
  '강서구',
  '구로구',
  '금천구',
  '영등포구',
  '동작구',
  '관악구',
  '서초구',
  '강남구',
  '송파구',
  '강동구',
] as const;

/** 구·정당 셀렉트: 네이티브 화살표 대신 살짝 안쪽에 배치 */
const FILTER_SELECT_BG_IMAGE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

const filterSelectClass =
  'w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-gray-50 bg-[length:14px_14px] bg-[position:right_0.65rem_center] bg-no-repeat px-3 py-2 pr-9 text-xs font-medium text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200';

type Candidate = {
  name?: string;
  district?: string;
  constituency?: string;
  party?: string;
  photo?: string;
  gender?: string;
  age?: string;
  address?: string;
  job?: string;
  education?: string;
  career?: string;
  criminal?: string;
  regDate?: string;
  huboId?: string | number;
};

type CandidatesPayload = {
  updatedAt?: string;
  candidates: Candidate[];
};

type WealthRow = {
  district?: string;
  name?: string;
  position?: string;
};

type SortKey = 'name' | 'age' | 'criminal';

const LIST_PAGE_SIZE = 20;

function loadCandidatesFile(raw: unknown): {
  rows: Candidate[];
  updatedAt: string | null;
} {
  if (Array.isArray(raw)) {
    return { rows: raw as Candidate[], updatedAt: null };
  }
  if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as CandidatesPayload).candidates)
  ) {
    const o = raw as CandidatesPayload;
    return {
      rows: o.candidates,
      updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : null,
    };
  }
  return { rows: [], updatedAt: null };
}

const { rows, updatedAt: dataUpdatedAt } = loadCandidatesFile(candidatesFile as unknown);

function normalizeWealthName(raw?: string): string {
  let s = String(raw ?? '')
    .split('\n')[0]
    .trim();
  s = s.replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

function buildWealthLookup(raw: unknown): Map<string, string> {
  const m = new Map<string, string>();
  if (!raw || typeof raw !== 'object') return m;
  for (const row of Object.values(raw as Record<string, WealthRow>)) {
    if (!row || typeof row !== 'object') continue;
    const d = String(row.district ?? '').trim();
    const n = normalizeWealthName(row.name);
    if (!d || !n) continue;
    const k = `${d}|${n}`;
    if (!m.has(k)) m.set(k, String(row.position ?? '').trim());
  }
  return m;
}

function wealthDisplayLabel(position: string): string {
  const p = position.trim();
  if (!p) return '';
  if (p === '구의원') return '현 구의원';
  if (p === '전)구의원') return '전 구의원';
  if (p === '구청장') return '현 구청장';
  if (p === '전)구청장') return '전 구청장';
  if (p.startsWith('전)')) return `전 ${p.slice(2)}`;
  return p;
}

const wealthLookup = buildWealthLookup(wealthRecords as unknown);

function wealthLabelForCandidate(c: Candidate): string {
  const d = String(c.district ?? '').trim();
  const n = normalizeWealthName(c.name);
  if (!d || !n) return '';
  const pos = wealthLookup.get(`${d}|${n}`);
  return pos ? wealthDisplayLabel(pos) : '';
}

function wealthRawPositionForCandidate(c: Candidate): string {
  const d = String(c.district ?? '').trim();
  const n = normalizeWealthName(c.name);
  if (!d || !n) return '';
  return String(wealthLookup.get(`${d}|${n}`) ?? '').trim();
}

/** archive.html 재산 상세 모달 딥링크 (script.js가 쿼리를 읽어 showDetail 호출) */
function wealthArchiveDetailHref(c: Candidate): string | null {
  if (!wealthLabelForCandidate(c)) return null;
  const d = String(c.district ?? '').trim();
  const n = normalizeWealthName(c.name);
  if (!d || !n) return null;
  const q = new URLSearchParams({
    wealthName: n,
    wealthDistrict: d,
  });
  return `/archive.html?${q.toString()}`;
}

function wealthDetailLinkCaption(c: Candidate): string | null {
  const label = wealthLabelForCandidate(c);
  if (!label) return null;
  return `${label}(재산내역 보기)`;
}

function formatDataUpdatedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(d);
}

const dataUpdatedLabel = formatDataUpdatedLabel(dataUpdatedAt);

function criminalShowsRecord(criminal: string | undefined) {
  const t = String(criminal ?? '').trim();
  if (!t || t === '없음') return false;
  if (/^0\s*건$/.test(t)) return false;
  return true;
}

function necPreHuboDetailUrl(huboId: string | number) {
  const q = new URLSearchParams({
    electionId: NEC_ELECTION_ID,
    huboId: String(huboId),
  });
  return `https://info.nec.go.kr/electioninfo/precandidate_detail_info.xhtml?${q}`;
}

function normalizeSearch(s: string) {
  return s.toLowerCase().replace(/\s+/g, '');
}

const DEFAULT_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#e2e8f0"/><circle cx="60" cy="48" r="22" fill="#94a3b8"/><path d="M24 108c4-28 72-28 72 0" fill="#94a3b8"/></svg>`
  );

/** config.js partyColors와 동기 (정당 공식 메인 컬러) */
const PARTY_UI: Record<string, { badgeSolid: string }> = {
  더불어민주당: { badgeSolid: 'bg-[#004EA2] text-white shadow-sm' },
  국민의힘: { badgeSolid: 'bg-[#E61E2B] text-white shadow-sm' },
  조국혁신당: { badgeSolid: 'bg-[#06275E] text-white shadow-sm' },
  정의당: { badgeSolid: 'bg-[#ffca00] text-slate-900 shadow-sm' },
  기본소득당: { badgeSolid: 'bg-[#00D2C3] text-slate-900 shadow-sm' },
  개혁신당: { badgeSolid: 'bg-[#FF7F32] text-white shadow-sm' },
  녹색당: { badgeSolid: 'bg-[#5CB531] text-white shadow-sm' },
  진보당: { badgeSolid: 'bg-[#E60020] text-white shadow-sm' },
  무소속: { badgeSolid: 'bg-[#707070] text-white shadow-sm' },
};

function partyUi(party?: string) {
  return (
    PARTY_UI[party ?? ''] ?? {
      badgeSolid: 'bg-[#64748B] text-white shadow-sm',
    }
  );
}

function ageSummary(ageStr?: string) {
  const s = String(ageStr ?? '').replace(/\n/g, ' ');
  const m = s.match(/\((\d+)세\)/);
  if (m) return `${m[1]}세`;
  const m2 = s.match(/(\d+)세/);
  if (m2) return `${m2[1]}세`;
  const t = s.trim();
  return t ? t.split(/\s+/)[0] : '—';
}

/** 정렬용 연령(숫자); 파싱 불가 시 null(목록 맨 뒤) */
function sortableAgeYears(ageStr?: string): number | null {
  const s = String(ageStr ?? '').replace(/\n/g, ' ');
  const m = s.match(/\((\d+)세\)/);
  if (m) return parseInt(m[1], 10);
  const m2 = s.match(/(\d+)세/);
  if (m2) return parseInt(m2[1], 10);
  const t = s.trim().split(/\s+/)[0];
  const m3 = /^(\d+)$/.exec(t);
  if (m3) return parseInt(m3[1], 10);
  return null;
}

function criminalSortRank(criminal?: string): number {
  const t = String(criminal ?? '').trim();
  if (!t || t === '없음' || /^0\s*건$/.test(t)) return 0;
  return 1;
}

/** 전과 문자열에서 N건 합산; 숫자 없으면 1 */
function parseCriminalCaseCount(criminal?: string): number {
  const s = String(criminal ?? '').trim();
  if (!s || s === '없음' || /^0\s*건$/.test(s)) return 0;
  const re = /(\d+)\s*건/g;
  let sum = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) sum += parseInt(m[1], 10);
  return sum > 0 ? sum : 1;
}

function elideText(str: string | undefined, max: number) {
  const t = String(str ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function educationFirstLine(education?: string): string {
  const line = String(education ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)[0];
  return line ? elideText(line, 56) : '—';
}

function criminalTableCell(criminal?: string): string {
  const t = String(criminal ?? '').trim();
  if (!t || t === '없음' || /^0\s*건$/.test(t)) return '—';
  return elideText(t, 24);
}

function WealthOpenIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

const WEALTH_CHIP_INLINE =
  'ml-1.5 inline-flex max-w-full items-center gap-0.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold leading-none tracking-tight text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400';

const WEALTH_CHIP_BLOCK =
  'inline-flex w-full max-w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 sm:w-auto sm:justify-start';

function primaryNameLine(name?: string) {
  return String(name ?? '')
    .split('\n')[0]
    .trim();
}

function subtitleFromName(name?: string) {
  const lines = String(name ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
  return lines.length >= 2 ? lines.slice(1).join(' · ') : '';
}

function CandidateDetailModal({ c, onClose }: { c: Candidate | null; onClose: () => void }) {
  useEffect(() => {
    if (!c) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [c, onClose]);

  if (!c) return null;
  const ui = partyUi(c.party);
  const pname = primaryNameLine(c.name);
  const sub = subtitleFromName(c.name);
  const wealthHref = wealthArchiveDetailHref(c);
  const wealthCaption = wealthDetailLinkCaption(c);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="candidate-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 id="candidate-modal-title" className="truncate text-lg font-bold text-slate-900">
            {pname} · 상세
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
          <div className="flex gap-4">
            <img
              src={c.photo || DEFAULT_AVATAR}
              alt=""
              width={86}
              height={102}
              className="h-[102px] w-[86px] shrink-0 rounded-xl object-cover object-top ring-1 ring-slate-200"
            />
            <div className="min-w-0">
              <span
                className={`inline-block rounded px-1 py-[3px] text-[11px] font-bold leading-none ${ui.badgeSolid}`}
              >
                {c.party ?? '정당 미상'}
              </span>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-lg font-bold leading-tight text-slate-900">
                <span>{pname}</span>
                {wealthHref && wealthCaption ? (
                  <a
                    href={wealthHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={WEALTH_CHIP_INLINE}
                    title="재산 공개 명부에 등재된 인원입니다."
                  >
                    <span className="truncate">{wealthCaption}</span>
                    <WealthOpenIcon className="h-2.5 w-2.5 shrink-0 text-slate-500" />
                  </a>
                ) : null}
              </p>
              {sub ? <p className="text-sm text-slate-500">{sub}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                {ageSummary(c.age)} · {c.gender ?? '—'} · {(c.job ?? '').trim() || '—'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {c.district ?? '—'} · {c.constituency ?? '—'}
              </p>
            </div>
          </div>
          <ModalField label="주소" value={c.address} />
          <ModalField label="직업" value={c.job} />
          <ModalField label="학력" value={c.education} multiline />
          <ModalField label="경력" value={c.career} multiline />
          <ModalField label="생년월일(연령)" value={c.age} multiline />
          <div className="border-b border-slate-100 pb-3 last:border-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">전과 기록</h3>
            <p className="mt-1.5 text-sm text-slate-800">
              <span className="font-medium">{c.criminal?.trim() || '—'}</span>
              {criminalShowsRecord(c.criminal) && c.huboId != null && String(c.huboId).trim() !== '' ? (
                <a
                  href={necPreHuboDetailUrl(c.huboId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                >
                  전과 서류 보기
                </a>
              ) : null}
            </p>
          </div>
          <ModalField label="등록일자" value={c.regDate} />
          {wealthHref && wealthCaption ? (
            <div className="border-b border-slate-100 pb-3 last:border-0">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">재산 공개 명부</h3>
              <p className="mt-1.5">
                <a
                  href={wealthHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={WEALTH_CHIP_BLOCK}
                >
                  <span className="min-w-0 flex-1 text-left leading-snug">{wealthCaption}</span>
                  <WealthOpenIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                </a>
              </p>
              <p className="mt-2 text-xs text-slate-500">재산 공개 데이터에서 이름·자치구가 일치합니다.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ModalField({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string;
  multiline?: boolean;
}) {
  const v = (value ?? '').trim() || '—';
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</h3>
      <p className={`mt-1.5 text-sm leading-relaxed text-slate-800 ${multiline ? 'whitespace-pre-line' : ''}`}>
        {v}
      </p>
    </div>
  );
}

export default function CandidatesPage() {
  const [district, setDistrict] = useState('');
  const [party, setParty] = useState('');
  const [nameQ, setNameQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const parties = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((c) => {
      const p = String(c.party ?? '').trim();
      if (p) s.add(p);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'));
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(nameQ);
    return rows.filter((c) => {
      if (district && c.district !== district) return false;
      if (party && String(c.party ?? '').trim() !== party) return false;
      if (!q) return true;
      const hay = normalizeSearch(
        [
          c.name,
          c.party,
          c.constituency,
          c.address,
          c.job,
          c.gender,
          c.age,
          c.education,
          c.career,
          c.criminal,
          c.regDate,
        ].join(' ')
      );
      return hay.includes(q);
    });
  }, [district, party, nameQ]);

  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const nameCmp = primaryNameLine(a.name).localeCompare(primaryNameLine(b.name), 'ko');
      if (sortKey === 'name') {
        const c = primaryNameLine(a.name).localeCompare(primaryNameLine(b.name), 'ko');
        return sortAsc ? c : -c;
      }
      if (sortKey === 'age') {
        const na = sortableAgeYears(a.age);
        const nb = sortableAgeYears(b.age);
        if (na == null && nb == null) return nameCmp;
        if (na == null) return 1;
        if (nb == null) return -1;
        const d = sortAsc ? na - nb : nb - na;
        if (d !== 0) return d;
        return nameCmp;
      }
      if (sortKey === 'criminal') {
        const ra = criminalSortRank(a.criminal);
        const rb = criminalSortRank(b.criminal);
        if (ra !== rb) return sortAsc ? ra - rb : rb - ra;
        const ta = String(a.criminal ?? '').trim();
        const tb = String(b.criminal ?? '').trim();
        const c = ta.localeCompare(tb, 'ko');
        if (c !== 0) return sortAsc ? c : -c;
        return nameCmp;
      }
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  useEffect(() => {
    setVisibleCount(LIST_PAGE_SIZE);
  }, [district, party, nameQ, sortKey, sortAsc]);

  const visibleRows = useMemo(
    () => sortedFiltered.slice(0, visibleCount),
    [sortedFiltered, visibleCount]
  );

  const filterStats = useMemo(() => {
    const n = filtered.length;
    if (n === 0) {
      return {
        avgAge: null as number | null,
        criminalPct: null as number | null,
        femalePct: null as number | null,
        n: 0,
        oldest: null as Candidate | null,
        youngest: null as Candidate | null,
        oldestAge: null as number | null,
        youngestAge: null as number | null,
        withCriminalCount: 0,
        topCriminal: null as Candidate | null,
        topCriminalCases: 0,
        femaleCount: 0,
        wealthCurrentCouncilorCount: 0,
      };
    }
    let ageSum = 0;
    let ageN = 0;
    let maxY = -Infinity;
    let minY = Infinity;
    let oldest: Candidate | null = null;
    let youngest: Candidate | null = null;
    for (const c of filtered) {
      const y = sortableAgeYears(c.age);
      if (y != null) {
        ageSum += y;
        ageN += 1;
        if (y > maxY) {
          maxY = y;
          oldest = c;
        }
        if (y < minY) {
          minY = y;
          youngest = c;
        }
      }
    }
    const avgAge = ageN > 0 ? ageSum / ageN : null;
    const withCriminalCount = filtered.filter((c) => criminalSortRank(c.criminal) === 1).length;
    const criminalPct = (withCriminalCount / n) * 100;
    const femaleCount = filtered.filter((c) => String(c.gender ?? '').trim() === '여').length;
    const femalePct = (femaleCount / n) * 100;
    let topCriminal: Candidate | null = null;
    let topCriminalCases = -1;
    for (const c of filtered) {
      if (criminalSortRank(c.criminal) !== 1) continue;
      const cnt = parseCriminalCaseCount(c.criminal);
      if (cnt > topCriminalCases) {
        topCriminalCases = cnt;
        topCriminal = c;
      }
    }
    const wealthCurrentCouncilorCount = filtered.filter(
      (c) => wealthRawPositionForCandidate(c) === '구의원'
    ).length;
    const hasAgeRange = ageN > 0 && oldest != null && youngest != null;
    return {
      avgAge,
      criminalPct,
      femalePct,
      n,
      oldest: hasAgeRange ? oldest : null,
      youngest: hasAgeRange ? youngest : null,
      oldestAge: hasAgeRange ? maxY : null,
      youngestAge: hasAgeRange ? minY : null,
      withCriminalCount,
      topCriminal: withCriminalCount > 0 ? topCriminal : null,
      topCriminalCases: withCriminalCount > 0 && topCriminal ? topCriminalCases : 0,
      femaleCount,
      wealthCurrentCouncilorCount,
    };
  }, [filtered]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const usingFilter = Boolean(district || party || normalizeSearch(nameQ));

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-slate-900">
      <nav className="mb-4 bg-gray-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <a
            href="/index.html"
            className="text-lg font-bold tracking-tight text-white no-underline hover:text-white/90"
          >
            👀 서울아카이브
          </a>
          <ul
            id="candidates-header-nav-slot"
            className="mb-0 min-h-[1.25rem] list-none"
            data-candidates-nav-placeholder
            aria-label="추가 메뉴(예정)"
          />
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-10 text-center sm:text-left">
        <h1 className="text-4xl font-black text-gray-900 mb-2">2026 지방선거 예비후보자</h1>
        <p className="text-gray-600">서울시 구의원 예비후보 데이터입니다. 구·정당·이름으로 필터할 수 있습니다.</p>
        {dataUpdatedLabel && (
          <p className="text-sm text-gray-500 mt-2" aria-live="polite">
            자료 갱신: {dataUpdatedLabel}
          </p>
        )}
      </header>

      <div className="mb-8 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label htmlFor="district" className="text-sm font-semibold text-gray-700">
            구 선택 <span className="font-normal text-gray-500">(25개구)</span>
          </label>
          <select
            id="district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className={filterSelectClass}
            style={{ backgroundImage: FILTER_SELECT_BG_IMAGE }}
          >
            <option value="">전체</option>
            {SEOUL_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label htmlFor="party" className="text-sm font-semibold text-gray-700">
            정당
          </label>
          <select
            id="party"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            className={filterSelectClass}
            style={{ backgroundImage: FILTER_SELECT_BG_IMAGE }}
          >
            <option value="">전체</option>
            {parties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
          <label htmlFor="nameQ" className="text-sm font-semibold text-gray-700">
            이름 검색
          </label>
          <input
            id="nameQ"
            type="search"
            value={nameQ}
            onChange={(e) => setNameQ(e.target.value)}
            placeholder="이름 또는 한자 일부 입력"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <p className="flex items-end justify-center text-xs text-gray-500 lg:col-span-2 lg:justify-end lg:pb-2">
          {usingFilter
            ? `표시 ${filtered.length}명 / 전체 ${rows.length}명`
            : `전체 ${filtered.length}명`}
        </p>
      </div>

      <section
        className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        aria-label="필터 결과 요약 통계"
      >
        {filterStats.n === 0 ? (
          <p className="text-sm text-gray-500">필터와 일치하는 후보가 없어 통계를 표시할 수 없습니다.</p>
        ) : (
          <>
            <h2 className="mb-3 text-base font-bold tracking-tight text-gray-900">👀구정감시 브리핑</h2>
            <ol className="m-0 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
              <li>
                평균 나이는{' '}
                <span className="font-semibold text-gray-900">
                  {filterStats.avgAge != null ? `${filterStats.avgAge.toFixed(1)}세` : '산출 불가'}
                </span>{' '}
                입니다.
                {filterStats.oldest &&
                filterStats.youngest &&
                filterStats.oldestAge != null &&
                filterStats.youngestAge != null ? (
                  <>
                    {' '}
                    최고령자는{' '}
                    <span
                      className={`mr-1 inline-flex max-w-[9rem] shrink-0 items-center truncate rounded px-1 py-px text-[10px] font-bold leading-none ${partyUi(filterStats.oldest.party).badgeSolid}`}
                    >
                      {String(filterStats.oldest.party ?? '').trim() || '정당 미상'}
                    </span>
                    <strong className="font-bold text-gray-900">
                      {primaryNameLine(filterStats.oldest.name)}
                    </strong>{' '}
                    후보({filterStats.oldestAge}세), 최연소자는{' '}
                    <span
                      className={`mr-1 inline-flex max-w-[9rem] shrink-0 items-center truncate rounded px-1 py-px text-[10px] font-bold leading-none ${partyUi(filterStats.youngest.party).badgeSolid}`}
                    >
                      {String(filterStats.youngest.party ?? '').trim() || '정당 미상'}
                    </span>
                    <strong className="font-bold text-gray-900">
                      {primaryNameLine(filterStats.youngest.name)}
                    </strong>{' '}
                    후보({filterStats.youngestAge}세)입니다.
                  </>
                ) : null}
              </li>
              <li>
                전과가 있는 후보는 전체 후보의{' '}
                <span className="font-semibold text-gray-900">
                  {filterStats.criminalPct!.toFixed(1)}%
                </span>
                입니다
                {filterStats.withCriminalCount > 0 && filterStats.topCriminal ? (
                  <>
                    이며, 가장 건수가 많은 후보는{' '}
                    <span className="font-semibold text-gray-900">
                      {filterStats.topCriminalCases}
                    </span>
                    건으로{' '}
                    <span
                      className={`mr-1 inline-flex max-w-[9rem] shrink-0 items-center truncate rounded px-1 py-px text-[10px] font-bold leading-none ${partyUi(filterStats.topCriminal.party).badgeSolid}`}
                    >
                      {String(filterStats.topCriminal.party ?? '').trim() || '정당 미상'}
                    </span>
                    <strong className="font-bold text-gray-900">
                      {primaryNameLine(filterStats.topCriminal.name)}
                    </strong>{' '}
                    후보입니다
                  </>
                ) : null}
                .
              </li>
              <li>
                여성 후보는{' '}
                <span className="font-semibold text-gray-900">{filterStats.femaleCount}</span>명으로 전체
                후보의{' '}
                <span className="font-semibold text-gray-900">{filterStats.femalePct!.toFixed(1)}%</span>
                입니다.
              </li>
              <li>
                예비후보자 중 현역 의원은{' '}
                <span className="font-semibold text-gray-900">
                  {filterStats.wealthCurrentCouncilorCount}
                </span>
                명으로, 재산내역을 열람할 수 있습니다.
              </li>
            </ol>
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
              ※ 위 통계는 현재 필터·검색에 해당하는{' '}
              <span className="font-medium text-gray-600">{filterStats.n}명</span>을 기준으로 합니다.
            </p>
          </>
        )}
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60">
        <table className="min-w-[920px] w-full border-collapse text-left text-sm text-slate-800">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/95">
              <th scope="col" className="whitespace-nowrap py-3 pl-4 pr-3 text-xs font-semibold tracking-wide text-sky-600">
                <button
                  type="button"
                  onClick={() => setSort('name')}
                  className="inline-flex items-center gap-1 rounded-md font-semibold text-sky-600 hover:bg-sky-50 hover:text-sky-800"
                >
                  이름
                  <span
                    className={`inline-block w-2.5 text-center text-[10px] font-bold ${sortKey === 'name' ? '' : 'invisible'}`}
                    aria-hidden
                  >
                    {sortKey === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                  </span>
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-xs font-semibold tracking-wide text-sky-600">
                정당
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-xs font-semibold tracking-wide text-sky-600">
                <button
                  type="button"
                  onClick={() => setSort('age')}
                  className="inline-flex items-center gap-1 rounded-md font-semibold text-sky-600 hover:bg-sky-50 hover:text-sky-800"
                >
                  나이
                  <span
                    className={`inline-block w-2.5 text-center text-[10px] font-bold ${sortKey === 'age' ? '' : 'invisible'}`}
                    aria-hidden
                  >
                    {sortKey === 'age' ? (sortAsc ? '↑' : '↓') : ''}
                  </span>
                </button>
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-xs font-semibold tracking-wide text-sky-600">
                성별
              </th>
              <th scope="col" className="min-w-[5rem] px-3 py-3 text-xs font-semibold tracking-wide text-sky-600">
                직업
              </th>
              <th scope="col" className="min-w-[8rem] max-w-[14rem] px-3 py-3 text-xs font-semibold tracking-wide text-sky-600">
                학력
              </th>
              <th scope="col" className="min-w-[4rem] px-3 py-3 text-xs font-semibold tracking-wide text-sky-600">
                <button
                  type="button"
                  onClick={() => setSort('criminal')}
                  className="inline-flex items-center gap-1 rounded-md font-semibold text-sky-600 hover:bg-sky-50 hover:text-sky-800"
                >
                  전과
                  <span
                    className={`inline-block w-2.5 text-center text-[10px] font-bold ${sortKey === 'criminal' ? '' : 'invisible'}`}
                    aria-hidden
                  >
                    {sortKey === 'criminal' ? (sortAsc ? '↑' : '↓') : ''}
                  </span>
                </button>
              </th>
              <th scope="col" className="whitespace-nowrap py-3 pl-3 pr-4 text-xs font-semibold tracking-wide text-sky-600">
                비고
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((person, index) => {
              const nameMain = primaryNameLine(person.name);
              const ui = partyUi(person.party);
              const necUrl =
                person.huboId != null && String(person.huboId).trim() !== ''
                  ? necPreHuboDetailUrl(person.huboId)
                  : null;
              const wealthHref = wealthArchiveDetailHref(person);
              const wealthCaption = wealthDetailLinkCaption(person);
              const jobShort = elideText(person.job, 26) || '—';

              return (
                <tr
                  key={`${person.huboId ?? nameMain}-${index}`}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/80"
                  onClick={(e) => {
                    const node = e.target as Node;
                    const el = node instanceof Element ? node : node.parentElement;
                    if (el?.closest('a')) return;
                    setDetail(person);
                  }}
                >
                  <td className="py-3 pl-4 pr-2 align-top">
                    <div className="flex gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/90">
                        <img
                          src={person.photo || DEFAULT_AVATAR}
                          alt=""
                          width={40}
                          height={40}
                          className="h-full w-full object-cover object-top"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-1 gap-y-1 font-bold leading-tight text-slate-900">
                          <span>{nameMain}</span>
                          {wealthHref && wealthCaption ? (
                            <a
                              href={wealthHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={WEALTH_CHIP_INLINE}
                              title="재산 공개 명부에 등재된 인원입니다."
                            >
                              <span className="truncate">{wealthCaption}</span>
                              <WealthOpenIcon className="h-2.5 w-2.5 shrink-0 text-slate-500" />
                            </a>
                          ) : null}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {person.district ?? '—'}
                          <span className="mx-0.5 text-slate-300">·</span>
                          {person.constituency ?? '—'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <span
                      className={`inline-flex max-w-[11rem] items-center rounded px-1 py-[3px] text-[11px] font-bold leading-none ${ui.badgeSolid}`}
                    >
                      {person.party ?? '정당 미상'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-middle text-xs leading-snug text-slate-600">
                    {ageSummary(person.age)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-middle text-xs leading-snug text-slate-600">
                    {person.gender ?? '—'}
                  </td>
                  <td className="max-w-[8rem] px-3 py-3 align-middle text-xs leading-snug text-slate-600">{jobShort}</td>
                  <td className="max-w-[14rem] px-3 py-3 align-middle text-xs leading-snug text-slate-600">
                    {educationFirstLine(person.education)}
                  </td>
                  <td className="max-w-[6rem] px-3 py-3 align-middle text-xs text-slate-600">
                    {criminalTableCell(person.criminal)}
                  </td>
                  <td className="whitespace-nowrap py-3 pl-2 pr-4 align-middle">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {necUrl ? (
                        <a
                          href={necUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200/80 hover:bg-slate-200"
                        >
                          선관위
                        </a>
                      ) : (
                        <span
                          className="cursor-not-allowed rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-400 ring-1 ring-slate-100"
                          title="후보 식별자가 없습니다."
                        >
                          선관위
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleCount < sortedFiltered.length ? (
          <div className="flex justify-center border-t border-slate-100 bg-slate-50/90 px-4 py-4">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50"
              onClick={() => setVisibleCount((n) => n + LIST_PAGE_SIZE)}
            >
              더보기{' '}
              <span className="font-normal text-slate-500">
                ({sortedFiltered.length - visibleCount}명 더)
              </span>
            </button>
          </div>
        ) : null}
      </div>

      <CandidateDetailModal c={detail} onClose={() => setDetail(null)} />
      </div>

      <footer className="mt-auto border-t border-black/10 bg-[#f4f6f9] pt-8 pb-6 text-center text-gray-600">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-center gap-x-3 gap-y-2 px-3 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="text-xs">제작 :</span>
            <a
              href="https://areawatch.tistory.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center no-underline"
            >
              <img
                src="/logo.svg"
                alt="구정감시서울네트워크(준)"
                width={80}
                height={24}
                className="h-6 w-auto"
                decoding="async"
              />
            </a>
          </span>
          <span className="text-gray-400" aria-hidden>
            |
          </span>
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1 text-xs sm:text-sm">
            <span>데이터 출처 :</span>
            <a
              href="https://www.nec.go.kr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 underline-offset-2 hover:underline"
            >
              중앙선거관리위원회
            </a>
          </span>
        </div>
        <p className="mt-4 mb-0 text-sm text-gray-600">
          <a
            href="/analysis-internal.html"
            className="text-gray-500 no-underline hover:text-gray-700"
            aria-label="연도·항목 집계(내부)"
          >
            ©
          </a>{' '}
          2026 구정감시서울네트워크(준)
        </p>
      </footer>
    </div>
  );
}
