export function App() {
  return (
    <main className="foundation-shell" aria-labelledby="foundation-title">
      <section className="foundation-card">
        <p className="eyebrow">JARVIS</p>
        <h1 id="foundation-title">Desktop foundation</h1>
        <p className="summary">
          The bundled local renderer is active inside the desktop host foundation.
        </p>
        <dl className="status-grid" aria-label="Foundation status">
          <div>
            <dt>Renderer</dt>
            <dd>Local application bundle</dd>
          </div>
          <div>
            <dt>Authority</dt>
            <dd>Not connected</dd>
          </div>
          <div>
            <dt>Core services</dt>
            <dd>Not started in Section 1.1</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
