import { MissionControlShell, LOCKED_STARTUP_SNAPSHOT } from "./mission-control";

export function App() {
  return <MissionControlShell snapshot={LOCKED_STARTUP_SNAPSHOT} />;
}
