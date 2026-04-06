'use client';

import React, { useEffect, useMemo, useState } from 'react';
import candidatesFile from '@/public/data/candidates.json';

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

const PARTY_UI: Record<string, { badgeSolid: string; topAccent: string }> = {
  더불어민주당: { badgeSolid: 'bg-blue-600 text-white', topAccent: 'border-t-[3px] border-t-blue-600' },
  국민의힘: { badgeSolid: 'bg-red-600 text-white', topAccent: 'border-t-[3px] border-t-red-600' },
  조국혁신당: { badgeSolid: 'bg-violet-600 text-white', topAccent: 'border-t-[3px] border-t-violet-600' },
  개혁신당: { badgeSolid: 'bg-cyan-600 text-white', topAccent: 'border-t-[3px] border-t-cyan-600' },
  진보당: { badgeSolid: 'bg-emerald-600 text-white', topAccent: 'border-t-[3px] border-t-emerald-600' },
  무소속: { badgeSolid: 'bg-slate-600 text-white', topAccent: 'border-t-[3px] border-t-slate-500' },
};

function partyUi(party?: string) {
  return PARTY_UI[party ?? ''] ?? {
    badgeSolid: 'bg-slate-600 text-white',
    topAccent: 'border-t-[3px] border-t-slate-400',
  };
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

function elideText(str: string | undefined, max: number) {
  const t = String(str ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

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

function summarySnippetLines(c: Candidate): string[] {
  const edu = String(c.education ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)[0];
  const career = String(c.career ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
  const parts: string[] = [];
  if (edu) parts.push(elideText(edu, 80));
  career.slice(0, 2).forEach((line) => parts.push(elideText(line, 88)));
  return parts.slice(0, 3);
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
              <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${ui.badgeSolid}`}>
                {c.party ?? '정당 미상'}
              </span>
              <p className="mt-2 text-lg font-bold text-slate-900">{pname}</p>
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
  const [detail, setDetail] = useState<Candidate | null>(null);

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

  const usingFilter = Boolean(district || party || normalizeSearch(nameQ));

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <header className="mb-10 text-center sm:text-left">
        <h1 className="text-4xl font-black text-gray-900 mb-2">2026 지방선거 예비후보자</h1>
        <p className="text-gray-600">서울시 구의원 예비후보 데이터입니다. 구·정당·이름으로 필터할 수 있습니다.</p>
        {dataUpdatedLabel && (
          <p className="text-sm text-gray-500 mt-2" aria-live="polite">
            자료 갱신: {dataUpdatedLabel}
          </p>
        )}
      </header>

      <div className="mb-8 grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        <div className="flex flex-col gap-2 lg:col-span-3">
          <label htmlFor="district" className="text-sm font-semibold text-gray-700">
            구 선택 <span className="font-normal text-gray-500">(25개구)</span>
          </label>
          <select
            id="district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200"
          >
            <option value="">전체</option>
            {SEOUL_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 lg:col-span-3">
          <label htmlFor="party" className="text-sm font-semibold text-gray-700">
            정당
          </label>
          <select
            id="party"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200"
          >
            <option value="">전체</option>
            {parties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
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
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <p className="flex items-end justify-center text-sm text-gray-500 lg:col-span-2 lg:justify-end lg:pb-3">
          {usingFilter
            ? `표시 ${filtered.length}명 / 전체 ${rows.length}명`
            : `전체 ${filtered.length}명`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((person, index) => {
          const nameMain = primaryNameLine(person.name);
          const sub = subtitleFromName(person.name);
          const ui = partyUi(person.party);
          const snippets = summarySnippetLines(person);
          const necUrl =
            person.huboId != null && String(person.huboId).trim() !== ''
              ? necPreHuboDetailUrl(person.huboId)
              : null;

          return (
            <article
              key={`${person.huboId ?? nameMain}-${index}`}
              className={`flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md ${ui.topAccent}`}
            >
              <div className="flex gap-4 p-5">
                <div className="relative h-[102px] w-[86px] shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
                  <img
                    src={person.photo || DEFAULT_AVATAR}
                    alt={`${nameMain} 사진`}
                    width={86}
                    height={102}
                    className="h-full w-full object-cover object-top"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-900">{nameMain}</h2>
                  {sub ? <p className="mt-0.5 text-sm text-slate-500">{sub}</p> : null}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span
                      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${ui.badgeSolid}`}
                    >
                      {person.party ?? '정당 미상'}
                    </span>
                    <span className="text-sm text-slate-500">
                      {ageSummary(person.age)} · {person.gender ?? '—'} ·{' '}
                      {elideText(person.job, 32) || '—'}
                    </span>
                  </div>
                  <p className="mt-2.5 inline-flex max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {person.district ?? '—'}
                    <span className="mx-1 text-slate-300">·</span>
                    {person.constituency ?? '—'}
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 px-5 py-3.5">
                {snippets.length ? (
                  <div className="space-y-1.5">
                    {snippets.map((line, si) => (
                      <p key={si} className="text-[13px] leading-relaxed text-slate-600">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">등록된 학력·경력 요약이 없습니다.</p>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setDetail(person)}
                  className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  상세 정보
                </button>
                {necUrl ? (
                  <a
                    href={necUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    선관위 상세
                  </a>
                ) : (
                  <span
                    className="inline-flex cursor-not-allowed items-center rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400"
                    title="후보 식별자가 없습니다."
                  >
                    선관위 상세
                  </span>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    const text = `${nameMain} · ${person.party ?? ''} · ${person.district ?? ''} 구의원 예비후보`;
                    try {
                      if (navigator.share) await navigator.share({ title: nameMain, text });
                      else if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text);
                        alert('후보 요약을 클립보드에 복사했습니다.');
                      } else {
                        window.prompt('복사:', text);
                      }
                    } catch (err) {
                      if ((err as Error).name === 'AbortError') return;
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 transition hover:bg-sky-100/90"
                >
                  공유
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <CandidateDetailModal c={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
