import { useState } from 'react';
import { searchCourse, AuthExpiredError } from './api';
import { SectionCard } from './SectionCard';

const DEFAULT_TERM = '202622'; // 2026 Segundo Semestre

function App() {
  const [subjectCourse, setSubjectCourse] = useState('');
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [sections, setSections] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | error | authExpired
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const code = subjectCourse.trim().toUpperCase();
    if (!code) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const result = await searchCourse(code, term);
      setSections(result.sections);
      setStatus('idle');
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        setStatus('authExpired');
      } else {
        setStatus('error');
        setErrorMessage(err.message);
      }
      setSections(null);
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>uchiddenhorario</h1>
        <p>Buscador rápido de secciones y horarios UC</p>
      </header>

      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ej: IIC2133"
          value={subjectCourse}
          onChange={(e) => setSubjectCourse(e.target.value)}
          autoFocus
        />
        <select value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="202622">2026 Segundo Semestre</option>
          <option value="202610">2026 Primer Semestre</option>
          <option value="202512">2025 Segundo Semestre</option>
        </select>
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {status === 'authExpired' && (
        <p className="banner banner--warn">
          La sesión de UC expiró. Pídele a quien administra el backend que refresque las cookies (JSESSIONID / cf_clearance) en el <code>.env</code>.
        </p>
      )}
      {status === 'error' && (
        <p className="banner banner--danger">{errorMessage || 'Algo falló buscando el ramo.'}</p>
      )}

      {sections !== null && status === 'idle' && (
        <main className="results">
          {sections.length === 0 ? (
            <p className="empty-state">No se encontraron secciones para {subjectCourse.toUpperCase()} en este término.</p>
          ) : (
            sections.map((s) => <SectionCard key={s.nrc} section={s} />)
          )}
        </main>
      )}
    </div>
  );
}

export default App;
