'use client';

import React, { useMemo, useState } from 'react';
import candidates from '@/public/data/candidates.json';

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

const rows = candidates as Candidate[];

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

export default function CandidatesPage() {
  const [district, setDistrict] = useState('');
  const [party, setParty] = useState('');
  const [nameQ, setNameQ] = useState('');

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
        {filtered.map((person, index) => {
          const nameMain = person.name?.split('\n')[0] ?? '';
          const ageLine = person.age?.replace(/\n/g, ' ') ?? '—';
          return (
            <div
              key={`${person.huboId ?? nameMain}-${index}`}
              className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col hover:scale-[1.02] transition-transform"
            >
              <div className="flex p-5 gap-4">
                <div className="w-[86px] h-[102px] bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0">
                  <img
                    src={person.photo || 'https://via.placeholder.com/150'}
                    alt={nameMain}
                    width={86}
                    height={102}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/150';
                    }}
                  />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit mb-1">
                    {person.party}
                  </span>
                  <h2 className="text-xl font-bold text-gray-800 leading-tight">{nameMain}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    자치구 {person.district ?? '—'} · 선거구 {person.constituency ?? '—'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    성별 {person.gender ?? '—'} · {ageLine}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-2 flex-grow bg-gray-50/50 space-y-3 text-xs text-gray-700">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase">주소</h4>
                  <p className="leading-relaxed">{person.address ?? '—'}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase">직업</h4>
                  <p className="leading-relaxed">{person.job ?? '—'}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase">학력</h4>
                  <p className="leading-relaxed whitespace-pre-line">{person.education ?? '—'}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase">경력</h4>
                  <p className="leading-relaxed whitespace-pre-line">{person.career ?? '—'}</p>
                </div>
                <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-gray-200 text-gray-600">
                  <span className="min-w-0">
                    전과{' '}
                    <span className="font-medium text-gray-800">
                      {person.criminal?.trim() || '—'}
                    </span>
                    {criminalShowsRecord(person.criminal) &&
                      person.huboId != null &&
                      String(person.huboId).trim() !== '' && (
                        <a
                          href={necPreHuboDetailUrl(person.huboId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="선관위 상세 창에서 「전과」를 누르면 스캔 서류를 볼 수 있습니다."
                          className="ml-2 font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                        >
                          전과 서류 보기
                        </a>
                      )}
                  </span>
                  <span>등록 {person.regDate ?? '—'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
