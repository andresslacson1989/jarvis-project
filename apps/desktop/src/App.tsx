import { toInertText } from "./security/inertContent";

export function App() {
  return (
    <main aria-labelledby="jarvis-title">
      <header>
        <h1 id="jarvis-title">JARVIS Mission Control</h1>
      </header>
      <p role="status">{toInertText("Desktop foundation loaded from bundled application content.")}</p>
    </main>
  );
}
