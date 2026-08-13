import { toInertText } from "./security/inertContent";
import { Panel, SkipLink, StatusChip } from "./design-system/components";

const destinations = [
  "Mission Control",
  "Missions",
  "Queue",
  "Approvals",
  "Systems / Integrations",
  "Data",
  "Memory",
  "Artifacts",
  "Settings",
] as const;

export interface MissionControlSnapshot {
  readonly serviceState: "LOCKED";
  readonly transportState: "NOT_CONNECTED";
  readonly voiceState: "IDLE";
  readonly activeMissionCount: 0;
  readonly attentionCount: 0;
}

export const LOCKED_STARTUP_SNAPSHOT: MissionControlSnapshot = {
  serviceState: "LOCKED",
  transportState: "NOT_CONNECTED",
  voiceState: "IDLE",
  activeMissionCount: 0,
  attentionCount: 0,
};

function destinationId(destination: string) {
  return destination.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

export function MissionControlShell({ snapshot }: { snapshot: MissionControlSnapshot }) {
  return (
    <div className="mission-control" data-service-state={snapshot.serviceState} data-transport-state={snapshot.transportState}>
      <SkipLink targetId="mission-control-main" />
      <aside aria-label="JARVIS navigation" className="mission-control__rail">
        <a aria-label="JARVIS Mission Control home" className="mission-control__brand" href="#mission-control-main">
          <img alt="JARVIS" src="/brand/jarvis-lockup.svg" />
        </a>
        <nav aria-label="Primary navigation">
          <ul className="mission-control__nav-list">
            {destinations.map((destination, index) => {
              const current = index === 0;
              return (
                <li key={destination}>
                  <a aria-current={current ? "page" : undefined} className={`mission-control__nav-link${current ? " is-current" : ""}`} href={`#${destinationId(destination)}`}>
                    {destination}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="mission-control__body">
        <header aria-label="JARVIS system status" className="mission-control__status-strip">
          <div>
            <p className="mission-control__eyebrow">System status</p>
            <h1>Mission Control</h1>
          </div>
          <div className="mission-control__status-group">
            <StatusChip state="warning">Core locked</StatusChip>
            <StatusChip state="neutral">Voice idle</StatusChip>
            <span className="mission-control__metric">Missions {snapshot.activeMissionCount}</span>
            <span className="mission-control__metric">Attention {snapshot.attentionCount}</span>
          </div>
        </header>

        <div className="mission-control__content">
          <main aria-labelledby="mission-control-title" className="mission-control__workspace" id="mission-control-main">
            <div className="mission-control__workspace-heading">
              <p className="mission-control__eyebrow">Current workspace</p>
              <h2 id="mission-control-title">Ready when authenticated</h2>
            </div>
            <Panel heading="JARVIS is locked">
              <p>{toInertText("The desktop surface is available, but Core transport is not connected. No mission, approval, provider, or project state is being inferred or displayed.")}</p>
              <StatusChip state="warning">LOCKED · NOT_CONNECTED</StatusChip>
            </Panel>
            <Panel heading="What remains available">
              <ul className="mission-control__plain-list">
                <li>Navigation and visual presentation are available.</li>
                <li>Native window presentation remains controlled by the desktop host.</li>
                <li>Authenticated Core state will appear only after the typed boundary reports it.</li>
              </ul>
            </Panel>
          </main>

          <aside aria-label="Context and attention" className="mission-control__context">
            <Panel heading="Context">
              <p className="mission-control__muted">No selected mission, task, project, or artifact.</p>
            </Panel>
            <Panel heading="Attention">
              <p className="mission-control__muted">No verified attention items are available while Core is locked.</p>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}
