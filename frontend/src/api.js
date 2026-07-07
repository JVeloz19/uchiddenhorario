const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

export class AuthExpiredError extends Error {}

export async function searchCourse(subjectCourse, term) {
  const params = new URLSearchParams({ subjectCourse, term });
  const res = await fetch(`${API_BASE}/api/search?${params.toString()}`);

  if (res.status === 401) {
    throw new AuthExpiredError('UC session cookies have expired, ask whoever runs the backend to refresh them.');
  }
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }
  return res.json();
}
