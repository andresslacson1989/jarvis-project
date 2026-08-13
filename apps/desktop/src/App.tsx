import { MissionControlShell, resolveStartupSnapshot } from "./mission-control";

export function App() {
  return <MissionControlShell snapshot={resolveStartupSnapshot()} />;
}
