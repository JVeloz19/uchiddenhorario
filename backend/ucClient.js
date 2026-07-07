import 'dotenv/config';

const BASE = 'https://registration9.uc.cl/StudentRegistrationSsb/ssb';

const UNIQUE_SESSION_ID = `nwsef${Date.now()}`;

function buildCookieHeader() {
  const parts = [];
  if (process.env.UC_JSESSIONID) parts.push(`JSESSIONID=${process.env.UC_JSESSIONID}`);
  if (process.env.UC_RBDI_COOKIE) parts.push(`RbdI6CHvhzrLAA1Q6g__=${process.env.UC_RBDI_COOKIE}`);
  if (process.env.UC_CF_CLEARANCE) parts.push(`cf_clearance=${process.env.UC_CF_CLEARANCE}`);
  if (process.env.UC_QUEUEIT_COOKIE_NAME && process.env.UC_QUEUEIT_COOKIE_VALUE) {
    parts.push(`${process.env.UC_QUEUEIT_COOKIE_NAME}=${process.env.UC_QUEUEIT_COOKIE_VALUE}`);
  }
  return parts.join('; ');
}

function commonHeaders(extra = {}) {
  return {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9,es-CL;q=0.8,es;q=0.7',
    'Cache-Control': 'no-cache',
    Cookie: buildCookieHeader(),
    Pragma: 'no-cache',
    Referer: `${BASE}/classSearch/classSearch`,
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Synchronizer-Token': process.env.UC_SYNCHRONIZER_TOKEN ?? '',
    ...extra,
  };
}

// UC session tracks "which term" server-side, separate from the JSESSIONID.
// A stale/never-set term makes searchResults come back empty, so every
// search call re-selects the term first. Cheap and avoids a hidden bug
// where the first search of a session used the wrong term.
async function selectTerm(term) {
  const res = await fetch(`${BASE}/term/search?mode=search`, {
    method: 'POST',
    headers: commonHeaders({
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: 'https://registration9.uc.cl',
      Referer: `${BASE}/term/termSelection?mode=search`,
    }),
    body: new URLSearchParams({
      term,
      studyPath: '',
      studyPathText: '',
      startDatepicker: '',
      endDatepicker: '',
      uniqueSessionId: UNIQUE_SESSION_ID,
    }).toString(),
  });

  if (!isAuthenticated(res)) {
    throw new AuthExpiredError();
  }
  return res.json();
}

class AuthExpiredError extends Error {
  constructor() {
    super('UC session expired or invalid (cookies need refreshing)');
    this.name = 'AuthExpiredError';
  }
}

// Banner redirects to the login/error page (HTML, 200) instead of a 401
// when the session is dead, so status code alone can't detect it --
// check the content-type of what came back.
function isAuthenticated(res) {
  const contentType = res.headers.get('content-type') ?? '';
  return contentType.includes('application/json') || contentType.includes('javascript');
}

function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&amp;/g, '&');
}

function cleanFacultyName(displayName) {
  if (!displayName) return null;
  // Banner format: "Lastname1|Lastname2, Firstname" -> "Firstname Lastname1 Lastname2"
  const [lastNames, firstNames] = displayName.split(',').map((s) => s.trim());
  if (!firstNames) return decodeHtmlEntities(lastNames ?? displayName);
  return decodeHtmlEntities(`${firstNames} ${lastNames.replace(/\|/g, ' ')}`);
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function formatTime(hhmm) {
  if (!hhmm || hhmm.length !== 4) return null;
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
}

// EXAM slots are one-off calendar dates (not a weekly recurring class time),
// unlike CLAS/TAL/INT* which repeat on the flagged weekdays -- they need
// separate rendering in the UI, so split them out here instead of in React.
function normalizeSection(raw) {
  const meetings = (raw.meetingsFaculty ?? []).map((m) => m.meetingTime).filter(Boolean);

  const weekly = [];
  const exams = [];

  for (const mt of meetings) {
    const entry = {
      type: mt.meetingType,
      typeDescription: decodeHtmlEntities(mt.meetingTypeDescription),
      beginTime: formatTime(mt.beginTime),
      endTime: formatTime(mt.endTime),
      days: DAYS.filter((d) => mt[d]),
      building: mt.buildingDescription ? decodeHtmlEntities(mt.buildingDescription) : null,
      room: mt.room && mt.room !== 'SIN SALA' ? mt.room : null,
      startDate: mt.startDate,
      endDate: mt.endDate,
    };
    if (mt.meetingType === 'EXAM') exams.push(entry);
    else weekly.push(entry);
  }

  return {
    nrc: raw.courseReferenceNumber,
    subjectCourse: raw.subjectCourse,
    title: decodeHtmlEntities(raw.courseTitle),
    section: raw.sequenceNumber,
    credits: raw.creditHours,
    campus: decodeHtmlEntities(raw.campusDescription),
    instructionalMethod: decodeHtmlEntities(raw.instructionalMethodDescription),
    seatsAvailable: raw.seatsAvailable,
    maximumEnrollment: raw.maximumEnrollment,
    enrollment: raw.enrollment,
    waitAvailable: raw.waitAvailable,
    waitCapacity: raw.waitCapacity,
    isOpen: raw.openSection,
    instructors: (raw.faculty ?? []).map((f) => ({
      name: cleanFacultyName(f.displayName),
      email: f.emailAddress,
    })),
    weeklySchedule: weekly,
    exams,
  };
}

export async function searchCourse({ subjectCourse, term, pageOffset = 0, pageMaxSize = 20 }) {
  await selectTerm(term);

  const params = new URLSearchParams({
    txt_subjectcoursecombo: subjectCourse,
    txt_term: term,
    startDatepicker: '',
    endDatepicker: '',
    uniqueSessionId: UNIQUE_SESSION_ID,
    pageOffset: String(pageOffset),
    pageMaxSize: String(pageMaxSize),
    sortColumn: 'subjectDescription',
    sortDirection: 'asc',
  });

  const res = await fetch(`${BASE}/searchResults/searchResults?${params.toString()}`, {
    headers: commonHeaders(),
  });

  if (!isAuthenticated(res)) {
    throw new AuthExpiredError();
  }

  const json = await res.json();

  return {
    success: json.success ?? false,
    totalCount: json.totalCount ?? 0,
    sections: (json.data ?? []).map(normalizeSection),
  };
}

export { AuthExpiredError };
