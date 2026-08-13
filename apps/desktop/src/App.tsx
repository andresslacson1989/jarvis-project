import { toInertText } from "./security/inertContent";
import { Button, Panel, SkipLink, StatusChip, TextInput } from "./design-system/components";

export function App() {
  return (
    <>
      <SkipLink />
      <main aria-labelledby="jarvis-title" id="main-content">
        <header>
        <h1 id="jarvis-title">JARVIS Mission Control</h1>
        </header>
        <Panel heading="Desktop foundation">
          <p role="status">{toInertText("Desktop foundation loaded from bundled application content.")}</p>
          <StatusChip state="info">UI foundation ready</StatusChip>
          <TextInput label="Command preview" description="Presentation-only input until the authenticated Core boundary is ready." placeholder="No command will run" />
          <Button variant="quiet" disabled>Core connection unavailable</Button>
        </Panel>
      </main>
    </>
  );
}
