import { toInertText } from "./security/inertContent";
import { Button, Panel, SkipLink, StatusChip } from "./design-system/components";

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
  readonly startupCondition: "LOCKED" | "REPAIR_REQUIRED" | "DEGRADED";
  readonly serviceState: "LOCKED";
  readonly transportState: "NOT_CONNECTED";
  readonly voiceState: "IDLE";
  readonly activeMissionCount: 0;
  readonly attentionCount: 0;
  readonly approval?: ApprovalReviewModel;
  readonly projectPolicy?: ProjectPolicyDiagnosticModel;
  readonly providerSetup?: ProviderSetupModel;
}

export type ProviderSetupState = "NOT_REQUIRED" | "SETUP_REQUIRED" | "SETUP_IN_PROGRESS" | "SETUP_READY" | "REPAIR_REQUIRED" | "SETUP_FAILED";

export interface ProviderSetupModel {
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
  readonly state: ProviderSetupState;
  readonly failureMessage?: string;
  readonly onStart?: () => void;
}

export type ProjectPolicyDiagnosticStatus = "NO_POLICY_CANDIDATE" | "POLICY_DECISION_REQUIRED" | "TRUSTED_POLICY" | "POLICY_CHANGED_REVIEW_REQUIRED" | "POLICY_DISABLED" | "POLICY_REVOKED" | "POLICY_PATH_VALIDATION_ERROR";

export interface ProjectPolicyDiagnosticModel {
  readonly status: ProjectPolicyDiagnosticStatus;
  readonly canonicalPath?: string;
  readonly canonicalScopeRoot?: string;
  readonly contentSha256?: string;
  readonly revision?: number;
  readonly gitBlobOid?: string;
  readonly sourceCommit?: string;
}

export interface ApprovalReviewModel {
  readonly approvalId: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
  readonly kind: "HIGH_RISK" | "DESTRUCTIVE_FINAL_CONFIRMATION";
  readonly actionSummary: string;
  readonly targetSummary: string;
  readonly environmentSummary?: string;
  readonly consequenceSummary: string;
  readonly rollbackSummary?: string;
  readonly expiresAt: string;
}

export const LOCKED_STARTUP_SNAPSHOT: MissionControlSnapshot = {
  startupCondition: "LOCKED",
  serviceState: "LOCKED",
  transportState: "NOT_CONNECTED",
  voiceState: "IDLE",
  activeMissionCount: 0,
  attentionCount: 0,
};

export function resolveStartupSnapshot(): MissionControlSnapshot {
  const startupCondition = new URLSearchParams(window.location.search).get("startup");
  if (startupCondition !== "REPAIR_REQUIRED" && startupCondition !== "DEGRADED") {
    return LOCKED_STARTUP_SNAPSHOT;
  }
  return { ...LOCKED_STARTUP_SNAPSHOT, startupCondition };
}

function destinationId(destination: string) {
  return destination.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

export function ApprovalReview({ approval, onConfirm, onReject }: { approval: ApprovalReviewModel; onConfirm?: () => void; onReject?: () => void }) {
  const destructive = approval.kind === "DESTRUCTIVE_FINAL_CONFIRMATION";
  const statusState = approval.status === "APPROVED" ? "success" : approval.status === "REJECTED" || approval.status === "EXPIRED" || approval.status === "CANCELLED" ? "error" : "warning";
  const pending = approval.status === "PENDING";
  return (
    <Panel className="mission-control__approval" heading="Approval review">
      <div aria-live="polite" className="mission-control__approval-heading">
        <StatusChip state={statusState}>{approval.status}</StatusChip>
        <span>{destructive ? "Destructive final confirmation required" : "Approval required before execution"}</span>
      </div>
      <dl className="mission-control__approval-details">
        <div><dt>Action</dt><dd>{toInertText(approval.actionSummary)}</dd></div>
        <div><dt>Exact target</dt><dd>{toInertText(approval.targetSummary)}</dd></div>
        {approval.environmentSummary ? <div><dt>Environment</dt><dd>{toInertText(approval.environmentSummary)}</dd></div> : null}
        <div><dt>Expected consequence</dt><dd>{toInertText(approval.consequenceSummary)}</dd></div>
        {approval.rollbackSummary ? <div><dt>Rollback / backup</dt><dd>{toInertText(approval.rollbackSummary)}</dd></div> : null}
        <div><dt>Expires</dt><dd>{toInertText(approval.expiresAt)}</dd></div>
      </dl>
      <p className="mission-control__approval-note">The displayed action, target, environment, and consequence are bound to this approval. Any material change requires a new approval.</p>
      {pending ? (
        <div aria-label="Approval actions" className="mission-control__approval-actions" role="group">
          <Button disabled={!onConfirm} onClick={onConfirm} variant={destructive ? "danger" : "primary"}>{destructive ? "Confirm and continue" : "Approve action"}</Button>
          <Button disabled={!onReject} onClick={onReject} variant="secondary">Reject</Button>
        </div>
      ) : null}
    </Panel>
  );
}

function projectPolicyStatusState(status: ProjectPolicyDiagnosticStatus): "info" | "success" | "warning" | "error" | "waiting" | "neutral" {
  if (status === "TRUSTED_POLICY") return "success";
  if (status === "POLICY_PATH_VALIDATION_ERROR") return "error";
  if (status === "POLICY_DECISION_REQUIRED" || status === "POLICY_CHANGED_REVIEW_REQUIRED") return "warning";
  return "neutral";
}

export function ProjectPolicyDiagnostics({ model }: { model: ProjectPolicyDiagnosticModel }) {
  return (
    <Panel heading="Project policy" className="mission-control__policy-diagnostics">
      <div aria-live="polite" className="mission-control__policy-status">
        <StatusChip state={projectPolicyStatusState(model.status)}>{model.status}</StatusChip>
      </div>
      <dl className="mission-control__diagnostic-details">
        {model.canonicalPath ? <div><dt>Canonical path</dt><dd>{toInertText(model.canonicalPath)}</dd></div> : null}
        {model.canonicalScopeRoot ? <div><dt>Scope root</dt><dd>{toInertText(model.canonicalScopeRoot)}</dd></div> : null}
        {model.contentSha256 ? <div><dt>Content SHA-256</dt><dd>{toInertText(model.contentSha256)}</dd></div> : null}
        {model.revision !== undefined ? <div><dt>Trust revision</dt><dd>{model.revision}</dd></div> : null}
        {model.gitBlobOid ? <div><dt>Git blob</dt><dd>{toInertText(model.gitBlobOid)}</dd></div> : null}
        {model.sourceCommit ? <div><dt>Source commit</dt><dd>{toInertText(model.sourceCommit)}</dd></div> : null}
      </dl>
    </Panel>
  );
}

function providerSetupStatusState(state: ProviderSetupState): "info" | "success" | "warning" | "error" | "waiting" | "neutral" {
  if (state === "SETUP_READY" || state === "NOT_REQUIRED") return "success";
  if (state === "SETUP_FAILED" || state === "REPAIR_REQUIRED") return "error";
  if (state === "SETUP_REQUIRED") return "warning";
  if (state === "SETUP_IN_PROGRESS") return "waiting";
  return "neutral";
}

export function ProviderSetupPanel({ model }: { model: ProviderSetupModel }) {
  const actionRequired = model.state === "SETUP_REQUIRED" || model.state === "REPAIR_REQUIRED" || model.state === "SETUP_FAILED";
  return (
    <Panel heading="Codex provider setup" className="mission-control__provider-setup">
      <div aria-live="polite" className="mission-control__provider-setup-status">
        <StatusChip state={providerSetupStatusState(model.state)}>{model.state}</StatusChip>
      </div>
      <dl className="mission-control__diagnostic-details">
        <div><dt>Provider</dt><dd>{toInertText(model.providerId)}</dd></div>
        <div><dt>Distribution</dt><dd>{toInertText(model.distributionId)}</dd></div>
        <div><dt>Adapter version</dt><dd>{toInertText(model.adapterVersion)}</dd></div>
      </dl>
      {model.failureMessage ? <p className="mission-control__provider-setup-error">{toInertText(model.failureMessage)}</p> : null}
      <p className="mission-control__muted">Setup uses only the qualified provider helper. Normal workers remain non-elevated, and readiness is reported only after the independent probe passes.</p>
      {actionRequired ? <Button disabled={!model.onStart} onClick={model.onStart} variant="primary">{model.state === "REPAIR_REQUIRED" ? "Repair Codex setup" : "Start Codex setup"}</Button> : null}
    </Panel>
  );
}

export function MissionControlShell({ snapshot }: { snapshot: MissionControlSnapshot }) {
  return (
    <div className="mission-control" data-service-state={snapshot.serviceState} data-startup-condition={snapshot.startupCondition} data-transport-state={snapshot.transportState}>
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
              <h2 id="mission-control-title">{snapshot.startupCondition === "REPAIR_REQUIRED" ? "Repair required before Core can start" : snapshot.startupCondition === "DEGRADED" ? "Core is degraded" : "Ready when authenticated"}</h2>
            </div>
            <Panel heading={snapshot.startupCondition === "REPAIR_REQUIRED" ? "Core runtime requires repair" : "JARVIS is locked"}>
              <p>{toInertText(snapshot.startupCondition === "REPAIR_REQUIRED" ? "The release-owned Core runtime did not pass preflight. JARVIS will not use a system Node or an unverified fallback. Repair the packaged runtime before Core can start." : snapshot.startupCondition === "DEGRADED" ? "The desktop surface is available in degraded mode. Core transport is not available, and no mission, approval, provider, or project state is being inferred or displayed." : "The desktop surface is available and the protected Core transport is authenticated. The JARVIS user session is still locked, so no mission, approval, provider, or project state is being displayed.")}</p>
              <StatusChip state={snapshot.startupCondition === "REPAIR_REQUIRED" ? "error" : "warning"}>{snapshot.startupCondition} · {snapshot.startupCondition === "LOCKED" ? "SESSION_LOCKED" : snapshot.transportState}</StatusChip>
            </Panel>
            <Panel heading="What remains available">
              <ul className="mission-control__plain-list">
                <li>Navigation and visual presentation are available.</li>
                <li>Native window presentation remains controlled by the desktop host.</li>
                <li>{snapshot.startupCondition === "REPAIR_REQUIRED" ? "Only a verified release-owned runtime may clear this repair state." : "Protected mission state will appear only after the JARVIS user session is unlocked through the typed boundary."}</li>
              </ul>
            </Panel>
          </main>

          <aside aria-label="Context and attention" className="mission-control__context">
            {snapshot.approval ? <ApprovalReview approval={snapshot.approval} /> : null}
            {snapshot.providerSetup ? <ProviderSetupPanel model={snapshot.providerSetup} /> : null}
            {snapshot.projectPolicy ? <ProjectPolicyDiagnostics model={snapshot.projectPolicy} /> : <Panel heading="Context"><p className="mission-control__muted">No selected mission, task, project, or artifact.</p></Panel>}
            <Panel heading="Attention">
              <p className="mission-control__muted">No verified attention items are available while Core is locked.</p>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}
