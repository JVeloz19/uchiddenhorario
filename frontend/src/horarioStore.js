const STORAGE_KEY = 'uchiddenhorario:mihorario';
const SAFE_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SAFE_DAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

// Cute pastel starter palette, auto-assigned round-robin as courses get
// added; user can override any of them from the color picker.
const PALETTE = [
  '#ffb3d9', // pink
  '#b3e0ff', // sky
  '#c9b3ff', // lavender
  '#b3ffd9', // mint
  '#ffe0b3', // peach
  '#ffb3b3', // coral
  '#d9ffb3', // lime
  '#b3f0ff', // cyan
];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function save(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeEntries(entries)));
}

function text(value, maxLength = 120) {
  if (typeof value !== 'string') return '';
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .slice(0, maxLength);
}

function safeTime(value) {
  return value === null || SAFE_TIME.test(value) ? value : null;
}

function sanitizeBlock(block) {
  const days = Array.isArray(block?.days) ? block.days.filter((day) => SAFE_DAYS.has(day)) : [];
  return {
    type: text(block?.type, 40),
    typeDescription: text(block?.typeDescription, 120),
    beginTime: safeTime(block?.beginTime),
    endTime: safeTime(block?.endTime),
    days,
  };
}

function sanitizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 50).map((entry) => ({
    nrc: text(entry?.nrc, 20),
    subjectCourse: text(entry?.subjectCourse, 20),
    title: text(entry?.title, 160),
    section: text(entry?.section, 20),
    color: SAFE_COLOR.test(entry?.color ?? '') ? entry.color : nextColor([]),
    weeklySchedule: Array.isArray(entry?.weeklySchedule) ? entry.weeklySchedule.slice(0, 30).map(sanitizeBlock) : [],
  }));
}

function nextColor(existingEntries) {
  const usedCount = existingEntries.length;
  return PALETTE[usedCount % PALETTE.length];
}

export function listHorario() {
  return load();
}

export function isInHorario(nrc) {
  return load().some((e) => e.nrc === nrc);
}

export function addToHorario(section) {
  const entries = load();
  if (entries.some((e) => e.nrc === section.nrc)) return entries;

  const entry = {
    nrc: section.nrc,
    subjectCourse: section.subjectCourse,
    title: section.title,
    section: section.section,
    color: nextColor(entries),
    weeklySchedule: section.weeklySchedule,
  };
  const updated = [...entries, entry];
  save(updated);
  return updated;
}

export function removeFromHorario(nrc) {
  const updated = load().filter((e) => e.nrc !== nrc);
  save(updated);
  return updated;
}

export function setColor(nrc, color) {
  const updated = load().map((e) => (e.nrc === nrc ? { ...e, color } : e));
  save(updated);
  return updated;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function timeOverlapsOnDay(a, b, day) {
  if (a.beginTime === null || a.endTime === null || b.beginTime === null || b.endTime === null) return false;
  if (!a.days.includes(day) || !b.days.includes(day)) return false;
  const aStart = timeToMinutes(a.beginTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.beginTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Flags conflicts per rendered day-cell (not per block): a block spanning
// Lun/Mié only conflicts on the specific day its time actually overlaps
// another course, so a Monday clash must not also stripe that same
// course's unrelated Wednesday slot.
export function findConflicts(entries) {
  const conflicts = new Set();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].nrc === entries[j].nrc) continue;
      for (const blockA of entries[i].weeklySchedule) {
        for (const blockB of entries[j].weeklySchedule) {
          for (const day of ALL_DAYS) {
            if (timeOverlapsOnDay(blockA, blockB, day)) {
              conflicts.add(blockKey(entries[i].nrc, blockA, day));
              conflicts.add(blockKey(entries[j].nrc, blockB, day));
            }
          }
        }
      }
    }
  }
  return conflicts;
}

export function blockKey(nrc, block, day) {
  return `${nrc}:${block.type}:${day}:${block.beginTime}`;
}
