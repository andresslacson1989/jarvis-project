import { createHash } from "node:crypto";
import { closeSync, copyFileSync, existsSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import type Database from "better-sqlite3-multiple-ciphers";
import {
  assertAttemptInitialState,
  assertAttemptTransition,
  assertMissionInitialState,
  assertMissionTransition,
  assertTaskInitialState,
  assertTaskTransition,
  validateAttemptState,
  validateMissionState,
  validateTaskState,
} from "../../../packages/protocol/src/state-machine-runtime.mjs";
import type { AttemptState, MissionState, TaskState } from "../../../packages/protocol/src/state-machine.js";
import { compareDataSensitivity, validateDataPolicy, validateTaskExecutionScopeRecord } from "../../../packages/protocol/src/execution-scope-runtime.mjs";
import type { TaskExecutionScopeRecord } from "../../../packages/protocol/src/execution-scope.js";
import type { DataPolicy } from "../../../packages/protocol/src/data.js";
import { validateMissionGraphVersion } from "../../../packages/protocol/src/mission-graph-runtime.mjs";
import type { MissionGraphVersion } from "../../../packages/protocol/src/mission-graph.js";
import {
  validateApprovalRequest,
  validateApprovalDecision,
  validateAuthorityEnvelope,
  validateCanonicalActionDescriptor,
  validateFinalDestructiveConfirmation,
  validateFreshTargetResolution,
  validatePermissionDecision,
} from "../../../packages/protocol/src/authority-runtime.mjs";
import type {
  ApprovalRequest,
  ApprovalDecision,
  AuthorityEnvelope,
  CanonicalActionDescriptorV1,
  FinalDestructiveConfirmation,
  FreshTargetResolution,
  PermissionDecision,
} from "../../../packages/protocol/src/authority.js";
import { FRESH_EXECUTION_EVIDENCE_MAX_AGE_MS } from "../../../packages/protocol/src/authority-runtime.mjs";
import {
  validateBudgetPolicy,
  validateBudgetReservation,
  validateProviderQuotaSnapshot,
  validateUsageRecord,
} from "../../../packages/protocol/src/accounting-runtime.mjs";
import type {
  BudgetPolicy,
  BudgetReservation,
  ProviderQuotaSnapshot,
  UsageRecord,
} from "../../../packages/protocol/src/accounting.js";
import { validateArtifact, validateLease, validateWorkerCheckpoint } from "../../../packages/protocol/src/worker-runtime.mjs";
import type { ArtifactRecord, LeaseRecord, WorkerCheckpoint } from "../../../packages/protocol/src/worker.js";
import {
  validateIntegrationAccount,
  validateModuleManifest,
  validateProxmoxConnection,
  validateProviderCompatibilityPolicy,
  validateProviderProfile,
  validateProviderQualificationRecord,
  validateProviderQualificationRecordWithSetupPlan,
  validateProviderSetupRecord,
  advanceProviderSetupState,
} from "../../../packages/protocol/src/provider-runtime.mjs";
import type {
  IntegrationAccount,
  ModuleManifest,
  ProxmoxConnection,
  ProviderCompatibilityPolicy,
  ProviderProfile,
  ProviderQualificationRecord,
  ProviderSetupRecord,
  ProviderSetupWorkflowAction,
} from "../../../packages/protocol/src/provider.js";
import { evaluateProjectPolicyMutationGate, resolveApplicableTrustedProjectPolicies, validateProjectPolicyDecisionRequest, validateProjectPolicySnapshot, validateProjectPolicySnapshotRevalidationRequest, validateProjectPolicyTrustRecord } from "../../../packages/protocol/src/project-policy-runtime.mjs";
import type { ProjectPolicyDecisionRequest, ProjectPolicyMutationGateResult, ProjectPolicySnapshotRecord, ProjectPolicySnapshotRevalidationRequest, ProjectPolicyTrustRecord } from "../../../packages/protocol/src/project-policy.js";
import { evaluateProjectPolicyMutation, validateProjectPolicyMutationAdmission } from "../../../packages/policy/src/project-policy-mutation.mjs";
import {
  validateProjectAliasRecord,
  validateProjectEnvironmentRecord,
  validateProjectRecord,
  validateProjectWorkspaceRecord,
} from "../../../packages/protocol/src/project-runtime.mjs";
import type {
  ProjectAliasRecord,
  ProjectEnvironmentRecord,
  ProjectRecord,
  ProjectWorkspaceRecord,
} from "../../../packages/protocol/src/project.js";
import { validateReleaseTrustRecord, validateTrustedUpdateMetadata, validateUpdateIncident, validateUpdateOperation } from "../../../packages/protocol/src/update-trust-runtime.mjs";
import type { ReleaseTrustRecord, TrustedUpdateMetadataRecord, UpdateIncidentRecord, UpdateOperationRecord } from "../../../packages/protocol/src/update-trust.js";
import { validateDomainEvent, validateExternalEventProvenance } from "../../../packages/protocol/src/domain-event-runtime.mjs";
import type { DomainEvent, DomainEventAppendResult, DomainEventCommittedListener, ExternalEventProvenance } from "../../../packages/protocol/src/domain-event.js";
import { validateActiveConfiguration, validateConfigurationCandidate, validateConfigurationDomain } from "../../../packages/protocol/src/config-runtime.mjs";
import type { ActiveConfiguration, ConfigurationCandidate, ConfigurationDomain } from "../../../packages/protocol/src/config.js";
import { validateConversation, validateConversationMessage, validateMemory, validateMemoryRetrievalRequest, validateRetentionAnchor } from "../../../packages/protocol/src/memory-runtime.mjs";
import type { ConversationMessage, ConversationRecord, MemoryRecord, MemoryRetrievalRequest, MemoryRetrievalResult, RetentionAnchor } from "../../../packages/protocol/src/memory.js";
import { canonicalizeJcs } from "./backup-descriptor.js";
import { digestCanonicalActionDescriptor } from "./authority-canonical.js";
import {
  validateOpaquePlatformIdentifier,
  validatePlatformCompatibility,
  validatePlatformPathRef,
  validatePlatformRuntimeIdentity,
} from "../../../packages/protocol/src/platform-runtime.mjs";
import type {
  PlatformCompatibility,
  PlatformPathRef,
  PlatformRuntimeIdentity,
} from "../../../packages/protocol/src/platform.js";
import { isSessionCooldownActive, progressiveCooldownMs, validateSessionSecurityState } from "../../../packages/protocol/src/session-runtime.mjs";
import type { SessionSecurityState } from "../../../packages/protocol/src/session.js";
import { validateSecurityAuditEvent } from "../../../packages/protocol/src/security-audit-runtime.mjs";
import type { SecurityAuditEvent } from "../../../packages/protocol/src/security-audit.mjs";
import {
  CoreDatabaseConnection,
  CorePersistenceError,
} from "./persistence.js";

export const CURRENT_SCHEMA_VERSION = 14 as const;
const INITIAL_MIGRATION_ID = "0001-core-proof-schema" as const;
const FULL_STATE_MIGRATION_ID = "0002-authoritative-state-ownership" as const;
const PLATFORM_STATE_MIGRATION_ID = "0003-platform-identity-and-path-state" as const;
const EXECUTION_SCOPE_MIGRATION_ID = "0004-execution-scope-uniqueness" as const;
const MISSION_GRAPH_IMMUTABILITY_MIGRATION_ID = "0005-mission-graph-immutability" as const;
const AUTHORITY_RECORDS_MIGRATION_ID = "0006-authority-records" as const;
const PROVIDER_INTEGRATION_STATE_MIGRATION_ID = "0007-provider-integration-state" as const;
const PROJECT_POLICY_TRUST_MIGRATION_ID = "0008-project-policy-trust" as const;
const UPDATE_TRUST_STATE_MIGRATION_ID = "0009-update-trust-state" as const;
const DOMAIN_EVENT_PROVENANCE_MIGRATION_ID = "0010-domain-event-provenance" as const;
const CONFIGURATION_AUTHORITY_MIGRATION_ID = "0011-configuration-authority" as const;
const MEMORY_RETENTION_MIGRATION_ID = "0012-memory-retention" as const;
const SESSION_SECURITY_MIGRATION_ID = "0013-session-security" as const;
const APPROVAL_LIFECYCLE_MIGRATION_ID = "0014-approval-lifecycle" as const;
const SESSION_SECURITY_STATE_ID = "primary" as const;

const INITIAL_MIGRATION_SQL = `
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  migration_id TEXT NOT NULL UNIQUE,
  checksum_sha256 TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE system_meta (
  meta_key TEXT PRIMARY KEY,
  meta_value TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE authoritative_records (
  record_id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  payload_json TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE UNIQUE INDEX events_aggregate_version_idx
  ON events (aggregate_type, aggregate_id, aggregate_version);
CREATE TABLE integration_accounts (
  integration_account_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  account_label TEXT,
  credential_handle TEXT,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'REAUTH_REQUIRED')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const INITIAL_MIGRATION_CHECKSUM = createHash("sha256")
  .update(INITIAL_MIGRATION_SQL, "utf8")
  .digest("hex");

const FULL_STATE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  setting_key TEXT PRIMARY KEY,
  setting_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS release_profile_state (
  profile_id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kdf_profiles (
  profile_id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trusted_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  state TEXT NOT NULL,
  session_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS session_auth_verifiers (
  verifier_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  verifier_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  state TEXT NOT NULL,
  conversation_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  message_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_context (
  context_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  context_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  project_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_aliases (
  alias TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_environments (
  environment_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  environment_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_workspaces (
  workspace_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workspace_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_integrations (
  project_integration_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  integration_account_id TEXT NOT NULL,
  integration_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_execution_scopes (
  scope_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_integration_scope_bindings (
  binding_id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  integration_account_id TEXT NOT NULL,
  binding_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memories (
  memory_id TEXT PRIMARY KEY,
  memory_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_links (
  link_id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  linked_memory_id TEXT NOT NULL,
  link_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_revisions (
  revision_id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  revision_json TEXT NOT NULL,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS missions (
  mission_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  mission_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mission_graph_versions (
  graph_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  graph_version INTEGER NOT NULL CHECK (graph_version > 0),
  graph_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (mission_id, graph_version)
);
CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  state TEXT NOT NULL,
  task_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (task_id, depends_on_task_id)
);
CREATE TABLE IF NOT EXISTS task_attempts (
  attempt_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  state TEXT NOT NULL,
  attempt_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_inputs (
  input_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_outputs (
  output_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS authority_envelopes (
  envelope_id TEXT PRIMARY KEY,
  mission_id TEXT,
  task_id TEXT,
  envelope_json TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS authority_envelope_scopes (
  envelope_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (envelope_id, scope_id)
);
CREATE TABLE IF NOT EXISTS worker_checkpoints (
  checkpoint_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  task_id TEXT,
  checkpoint_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS worker_events (
  worker_event_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  event_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  artifact_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS artifact_links (
  artifact_id TEXT NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  link_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (artifact_id, owner_type, owner_id)
);
CREATE TABLE IF NOT EXISTS workspace_leases (
  lease_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  owner_instance_id TEXT NOT NULL,
  owner_task_id TEXT,
  lease_type TEXT NOT NULL,
  state TEXT NOT NULL,
  lease_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  acquired_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS resource_leases (
  lease_id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  owner_instance_id TEXT NOT NULL,
  owner_task_id TEXT,
  lease_type TEXT NOT NULL,
  state TEXT NOT NULL,
  lease_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  acquired_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS permission_policies (
  policy_id TEXT PRIMARY KEY,
  policy_version TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS standing_permissions (
  permission_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  permission_json TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approval_requests (
  approval_request_id TEXT PRIMARY KEY,
  action_descriptor_json TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approval_decisions (
  approval_decision_id TEXT PRIMARY KEY,
  approval_request_id TEXT NOT NULL,
  decision_json TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS precedent_records (
  precedent_id TEXT PRIMARY KEY,
  precedent_json TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS providers (
  provider_id TEXT PRIMARY KEY,
  provider_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_profiles (
  profile_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_setup_state (
  provider_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  setup_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_qualification_state (
  provider_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  qualification_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_health_history (
  health_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  health_json TEXT NOT NULL,
  observed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS modules (
  module_id TEXT PRIMARY KEY,
  module_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS module_versions (
  module_version_id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  version_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (module_id, version_label)
);
CREATE TABLE IF NOT EXISTS module_catalog_entries (
  catalog_entry_id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  entry_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS module_catalog_keys (
  catalog_key_id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  key_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS integration_capabilities (
  capability_id TEXT PRIMARY KEY,
  integration_account_id TEXT NOT NULL,
  capability_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS proxmox_connections (
  connection_id TEXT PRIMARY KEY,
  connection_json TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS event_dedup (
  deduplication_key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id TEXT PRIMARY KEY,
  subscription_json TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS automation_rules (
  rule_id TEXT PRIMARY KEY,
  rule_json TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS automation_runs (
  run_id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  state TEXT NOT NULL,
  run_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  notification_id TEXT PRIMARY KEY,
  notification_json TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_quota_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  observed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_records (
  usage_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  usage_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pricing_snapshots (
  pricing_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  pricing_json TEXT NOT NULL,
  observed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS budgets (
  budget_id TEXT PRIMARY KEY,
  budget_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS budget_reservations (
  reservation_id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  reservation_json TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  audit_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  audit_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backup_history (
  backup_id TEXT PRIMARY KEY,
  backup_json TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS update_history (
  update_id TEXT PRIMARY KEY,
  update_json TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recovery_actions (
  recovery_action_id TEXT PRIMARY KEY,
  action_json TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

const FULL_STATE_MIGRATION_CHECKSUM = createHash("sha256")
  .update(FULL_STATE_MIGRATION_SQL, "utf8")
  .digest("hex");

const PLATFORM_STATE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS platform_runtime_identities (
  identity_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('WINDOWS', 'LINUX', 'ANDROID')),
  runtime_role TEXT NOT NULL CHECK (runtime_role IN ('FULL_HOST', 'COMPANION')),
  architecture TEXT NOT NULL,
  backend_profile_id TEXT NOT NULL,
  identity_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platform_compatibility_records (
  compatibility_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('WINDOWS', 'LINUX', 'ANDROID')),
  runtime_roles_json TEXT NOT NULL,
  os_version_range TEXT,
  architectures_json TEXT,
  compatibility_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platform_path_refs (
  path_ref_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('WINDOWS', 'LINUX', 'ANDROID')),
  path_value TEXT NOT NULL,
  path_ref_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const PLATFORM_STATE_MIGRATION_CHECKSUM = createHash("sha256")
  .update(PLATFORM_STATE_MIGRATION_SQL, "utf8")
  .digest("hex");

const EXECUTION_SCOPE_MIGRATION_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS task_execution_scopes_task_idx
  ON task_execution_scopes (task_id);
`;

const EXECUTION_SCOPE_MIGRATION_CHECKSUM = createHash("sha256")
  .update(EXECUTION_SCOPE_MIGRATION_SQL, "utf8")
  .digest("hex");

const MISSION_GRAPH_IMMUTABILITY_MIGRATION_SQL = `
CREATE TRIGGER IF NOT EXISTS mission_graph_versions_no_update
BEFORE UPDATE ON mission_graph_versions
BEGIN
  SELECT RAISE(ABORT, 'MISSION_GRAPH_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS mission_graph_versions_no_delete
BEFORE DELETE ON mission_graph_versions
BEGIN
  SELECT RAISE(ABORT, 'MISSION_GRAPH_IMMUTABLE');
END;
`;

const MISSION_GRAPH_IMMUTABILITY_MIGRATION_CHECKSUM = createHash("sha256")
  .update(MISSION_GRAPH_IMMUTABILITY_MIGRATION_SQL, "utf8")
  .digest("hex");

const AUTHORITY_RECORDS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS permission_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_json TEXT NOT NULL,
  policy_version INTEGER NOT NULL CHECK (policy_version > 0),
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS authority_envelopes_no_update
BEFORE UPDATE ON authority_envelopes
BEGIN
  SELECT RAISE(ABORT, 'AUTHORITY_ENVELOPE_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS authority_envelopes_no_delete
BEFORE DELETE ON authority_envelopes
BEGIN
  SELECT RAISE(ABORT, 'AUTHORITY_ENVELOPE_IMMUTABLE');
END;
`;

const AUTHORITY_RECORDS_MIGRATION_CHECKSUM = createHash("sha256")
  .update(AUTHORITY_RECORDS_MIGRATION_SQL, "utf8")
  .digest("hex");

const PROVIDER_INTEGRATION_STATE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS integration_account_state (
  account_id TEXT PRIMARY KEY,
  integration_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CONNECTED', 'DEGRADED', 'REAUTH_REQUIRED', 'DISABLED', 'ERROR')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const PROVIDER_INTEGRATION_STATE_MIGRATION_CHECKSUM = createHash("sha256")
  .update(PROVIDER_INTEGRATION_STATE_MIGRATION_SQL, "utf8")
  .digest("hex");

const PROJECT_POLICY_TRUST_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS project_policy_trust_records (
  policy_trust_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  state TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_policy_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL UNIQUE,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS project_policy_snapshots_no_update
BEFORE UPDATE ON project_policy_snapshots
BEGIN
  SELECT RAISE(ABORT, 'PROJECT_POLICY_SNAPSHOT_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS project_policy_snapshots_no_delete
BEFORE DELETE ON project_policy_snapshots
BEGIN
  SELECT RAISE(ABORT, 'PROJECT_POLICY_SNAPSHOT_IMMUTABLE');
END;
`;

const PROJECT_POLICY_TRUST_MIGRATION_CHECKSUM = createHash("sha256")
  .update(PROJECT_POLICY_TRUST_MIGRATION_SQL, "utf8")
  .digest("hex");

const UPDATE_TRUST_STATE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS trusted_update_metadata (
  metadata_id TEXT PRIMARY KEY,
  metadata_json TEXT NOT NULL,
  metadata_version TEXT NOT NULL,
  metadata_sha256 TEXT NOT NULL,
  trusted_root_version TEXT NOT NULL,
  minimum_security_epoch TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trusted_release_state (
  release_id TEXT PRIMARY KEY,
  release_json TEXT NOT NULL,
  release_sequence TEXT NOT NULL,
  security_epoch TEXT NOT NULL,
  revoked INTEGER NOT NULL CHECK (revoked IN (0, 1)),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS update_incidents (
  incident_id TEXT PRIMARY KEY,
  incident_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  observed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS update_operation_state (
  operation_id TEXT PRIMARY KEY,
  operation_json TEXT NOT NULL,
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const UPDATE_TRUST_STATE_MIGRATION_CHECKSUM = createHash("sha256")
  .update(UPDATE_TRUST_STATE_MIGRATION_SQL, "utf8")
  .digest("hex");

const DOMAIN_EVENT_PROVENANCE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS domain_event_envelopes (
  event_id TEXT PRIMARY KEY,
  event_json TEXT NOT NULL,
  causation_id TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  payload_version INTEGER NOT NULL CHECK (payload_version > 0)
);
CREATE TABLE IF NOT EXISTS event_provenance (
  event_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  deduplication_key TEXT,
  first_seen_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS event_provenance_dedup_idx
  ON event_provenance (deduplication_key) WHERE deduplication_key IS NOT NULL;
`;

const DOMAIN_EVENT_PROVENANCE_MIGRATION_CHECKSUM = createHash("sha256")
  .update(DOMAIN_EVENT_PROVENANCE_MIGRATION_SQL, "utf8")
  .digest("hex");

const CONFIGURATION_AUTHORITY_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS configuration_candidates (
  candidate_id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  config_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  expected_active_version INTEGER NOT NULL CHECK (expected_active_version >= 0),
  state TEXT NOT NULL CHECK (state IN ('STAGED', 'ACTIVATED', 'REJECTED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS active_configurations (
  domain TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  version INTEGER NOT NULL CHECK (version > 0),
  source_candidate_id TEXT NOT NULL,
  activated_at TEXT NOT NULL
);
`;

const CONFIGURATION_AUTHORITY_MIGRATION_CHECKSUM = createHash("sha256")
  .update(CONFIGURATION_AUTHORITY_MIGRATION_SQL, "utf8")
  .digest("hex");

const MEMORY_RETENTION_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS retention_anchors (
  anchor_id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  anchor_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS retention_anchors_record_idx ON retention_anchors (record_type, record_id);
`;

const MEMORY_RETENTION_MIGRATION_CHECKSUM = createHash("sha256")
  .update(MEMORY_RETENTION_MIGRATION_SQL, "utf8")
  .digest("hex");

const SESSION_SECURITY_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS session_security_state (
  state_id TEXT PRIMARY KEY CHECK (state_id = 'primary'),
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const SESSION_SECURITY_MIGRATION_CHECKSUM = createHash("sha256")
  .update(SESSION_SECURITY_MIGRATION_SQL, "utf8")
  .digest("hex");

const APPROVAL_LIFECYCLE_MIGRATION_SQL = `
ALTER TABLE approval_requests ADD COLUMN approval_json TEXT;
`;

const APPROVAL_LIFECYCLE_MIGRATION_CHECKSUM = createHash("sha256")
  .update(APPROVAL_LIFECYCLE_MIGRATION_SQL, "utf8")
  .digest("hex");

const MIGRATION_IDS = Object.freeze([
  INITIAL_MIGRATION_ID,
  FULL_STATE_MIGRATION_ID,
  PLATFORM_STATE_MIGRATION_ID,
  EXECUTION_SCOPE_MIGRATION_ID,
  MISSION_GRAPH_IMMUTABILITY_MIGRATION_ID,
  AUTHORITY_RECORDS_MIGRATION_ID,
  PROVIDER_INTEGRATION_STATE_MIGRATION_ID,
  PROJECT_POLICY_TRUST_MIGRATION_ID,
  UPDATE_TRUST_STATE_MIGRATION_ID,
  DOMAIN_EVENT_PROVENANCE_MIGRATION_ID,
  CONFIGURATION_AUTHORITY_MIGRATION_ID,
  MEMORY_RETENTION_MIGRATION_ID,
  SESSION_SECURITY_MIGRATION_ID,
  APPROVAL_LIFECYCLE_MIGRATION_ID,
]);

export interface MigrationResult {
  readonly currentVersion: number;
  readonly appliedMigrationIds: readonly string[];
}

export interface StateTransition {
  readonly recordId: string;
  readonly recordType: string;
  readonly state: unknown;
  readonly expectedVersion: number;
  readonly eventId: string;
  readonly eventType: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}

export interface StateTransitionResult {
  readonly recordId: string;
  readonly version: number;
  readonly eventId: string;
}

interface DurableStateTransitionRequest {
  readonly nextState: unknown;
  readonly state: unknown;
  readonly expectedVersion: number;
  readonly eventId: string;
  readonly eventType: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}

export type MissionStateTransitionRequest = DurableStateTransitionRequest & {
  readonly missionId: string;
};

export type TaskStateTransitionRequest = DurableStateTransitionRequest & {
  readonly taskId: string;
  readonly missionId: string;
};

export type AttemptStateTransitionRequest = DurableStateTransitionRequest & {
  readonly attemptId: string;
  readonly taskId: string;
};

export interface PortableRestoreCredentialReconciliation {
  readonly affectedIntegrationAccountIds: readonly string[];
}

export interface SessionStateMutationRequest {
  readonly userId: string;
  readonly sessionId: string;
  readonly now: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly correlationId: string;
}

export interface SessionAuthenticationRequest extends SessionStateMutationRequest {
  readonly passwordVerified: boolean;
}

export interface SessionAuthenticationResult {
  readonly status: "UNLOCKED" | "DENIED" | "COOLDOWN";
  readonly version: number;
  readonly retryAfterMs: number;
  readonly state: SessionSecurityState;
}

export interface SessionStateWriteResult {
  readonly version: number;
  readonly state: SessionSecurityState;
}

export type PlatformSessionLockReason = "OS_SESSION_LOCK" | "OS_SESSION_END" | "IDLE";

export interface PlatformSessionLockRequest extends SessionStateMutationRequest {
  readonly reason: PlatformSessionLockReason;
}

export interface DataPolicyDeclassificationRequest extends SessionStateMutationRequest {
  readonly decisionId: string;
  readonly sourcePolicy: unknown;
  readonly targetPolicy: unknown;
  readonly reason: string;
  readonly explicitConfirmation: true;
}

export interface DataPolicyDeclassificationResult {
  readonly decisionId: string;
  readonly sourcePolicy: DataPolicy;
  readonly targetPolicy: DataPolicy;
}

export interface SessionPasswordVerifierRecord {
  readonly userId: string;
  readonly version: number;
  readonly verifier: SessionPasswordVerifier;
}

export type SessionPasswordUpgradeKind = "REHASH_AFTER_AUTH" | "EXPLICIT_PASSWORD_CHANGE";

export interface SessionPasswordUpgradeRequest extends SessionStateMutationRequest {
  readonly expectedVerifierVersion: number;
  readonly replacementVerifier: SessionPasswordVerifier;
  readonly kind: SessionPasswordUpgradeKind;
  readonly currentVerifierVerified: true;
  readonly explicitConfirmation?: true;
}

export interface SessionPasswordWriteResult {
  readonly version: number;
  readonly profileId: string;
}

export interface SessionPasswordRecoveryEvidence {
  readonly type: "GENERATED_RECOVERY_V1";
  readonly evidenceId: string;
  readonly backupId: string;
  readonly slotId: string;
  readonly descriptorDigestSha256: string;
  readonly verifiedAt: string;
}

export interface SessionPasswordRecoveryResetRequest extends SessionStateMutationRequest {
  readonly expectedSessionVersion: number;
  readonly expectedVerifierVersion: number;
  readonly replacementVerifier: SessionPasswordVerifier;
  readonly recoveryEvidence: SessionPasswordRecoveryEvidence;
  readonly explicitConfirmation: true;
}

export interface PlatformStateWriteResult {
  readonly id: string;
  readonly version: number;
}

export interface TaskExecutionScopeWriteRequest {
  readonly scopeId: string;
  readonly taskId: string;
  readonly scope: unknown;
  readonly dataPolicy: unknown;
  readonly expectedVersion: number;
  readonly now: string;
}

export interface TaskExecutionScopeWriteResult {
  readonly scopeId: string;
  readonly taskId: string;
  readonly version: number;
}

export interface MissionGraphActivationRequest {
  readonly graph: unknown;
  readonly expectedMissionVersion: number;
  readonly eventId: string;
  readonly eventType: string;
  readonly correlationId: string;
}

export interface MissionGraphActivationResult {
  readonly graphId: string;
  readonly missionId: string;
  readonly graphVersion: number;
  readonly missionVersion: number;
  readonly eventId: string;
}

export interface AuthorityEnvelopeWriteResult {
  readonly envelopeId: string;
}

export interface PermissionDecisionWriteResult {
  readonly decisionId: string;
}

export interface ApprovalRequestWriteRequest {
  readonly approval: unknown;
  readonly descriptor: unknown;
}

export interface ApprovalRequestWriteResult {
  readonly approvalId: string;
  readonly version: number;
}

export interface ApprovalDecisionRequest {
  readonly approvalId: string;
  readonly expectedVersion: number;
  readonly decision: unknown;
  readonly now: string;
}

export interface ApprovalDecisionResult {
  readonly approvalId: string;
  readonly version: number;
  readonly status: "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
}

export interface ApprovalCancellationRequest {
  readonly approvalId: string;
  readonly expectedVersion: number;
  readonly now: string;
}

export interface ApprovalExpirationRequest {
  readonly approvalId: string;
  readonly expectedVersion: number;
  readonly now: string;
}

export interface ApprovalConsumptionRequest {
  readonly approvalId: string;
  readonly expectedVersion: number;
  readonly sessionId: string;
  readonly freshDescriptor: unknown;
  readonly freshTargetResolution: unknown;
  readonly finalConfirmation?: unknown;
  readonly now: string;
}

export interface ApprovalConsumptionResult {
  readonly approvalId: string;
  readonly version: number;
  readonly status: "CONSUMED" | "EXPIRED";
}

export interface BudgetPolicyWriteRequest {
  readonly budget: unknown;
  readonly expectedVersion: number;
}

export interface BudgetReservationWriteRequest {
  readonly reservation: unknown;
  readonly expectedBudgetVersion: number;
}

export interface WorkerCheckpointWriteResult {
  readonly checkpointId: string;
  readonly sequence: number;
}

export interface LeaseWriteResult {
  readonly leaseId: string;
  readonly version: number;
}

export interface ProviderStateWriteResult {
  readonly id: string;
  readonly version: number;
}

export interface PolicySnapshotWriteResult {
  readonly snapshotId: string;
  readonly attemptId: string;
}

export interface SessionPasswordVerifier {
  readonly profileId: string;
  readonly purpose: "SESSION_PASSWORD";
  readonly algorithm: "ARGON2ID";
  readonly version: 0x13;
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: 4;
  readonly salt: Buffer;
  readonly verifier: Buffer;
}

export type CoreSchemaFailureCode =
  | "PERSISTENCE_SCHEMA_UNSUPPORTED"
  | "PERSISTENCE_SCHEMA_INVALID"
  | "PERSISTENCE_CONFLICT"
  | "PERSISTENCE_MIGRATION_LOCKED"
  | "PERSISTENCE_MIGRATION_BACKUP_FAILED"
  | "PROJECT_POLICY_DECISION_REQUIRED";

export class CoreSchemaError extends Error {
  readonly code: CoreSchemaFailureCode;

  constructor(code: CoreSchemaFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CoreSchemaError";
    this.code = code;
  }
}

interface MigrationRow {
  readonly version: number;
  readonly migration_id: string;
  readonly checksum_sha256: string;
}

interface RecordRow {
  readonly version: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tableExists(database: Database.Database, name: string): boolean {
  const row = database
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { present?: number } | undefined;
  return row?.present === 1;
}

function assertJsonObject(value: unknown): string {
  if (!isRecord(value)) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "authoritative state must be a JSON object");
  }
  return JSON.stringify(value);
}

function validateMissionStateForStorage(value: unknown): MissionState {
  try {
    return validateMissionState(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "mission state is not canonical", { cause: error });
  }
}

function validateTaskStateForStorage(value: unknown): TaskState {
  try {
    return validateTaskState(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "task state is not canonical", { cause: error });
  }
}

function validateAttemptStateForStorage(value: unknown): AttemptState {
  try {
    return validateAttemptState(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "attempt state is not canonical", { cause: error });
  }
}

function assertStateTransitionRequest(request: DurableStateTransitionRequest, label: string): string {
  if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 0) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${label} expected state version must be a non-negative integer`);
  }
  if (!request.eventId || !request.eventType || !request.correlationId || request.eventId.includes("\0") || request.eventType.includes("\0") || request.correlationId.includes("\0")) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${label} transition event fields are invalid`);
  }
  assertPlatformStateTimestamp(request.occurredAt);
  const state = isRecord(request.state) ? request.state : undefined;
  if (!state) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${label} state payload must be a JSON object`);
  if ("state" in state && state.state !== request.nextState) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${label} state payload disagrees with nextState`);
  }
  return JSON.stringify({ ...state, state: request.nextState });
}

function assertStoredState(raw: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error("stored payload is not an object");
    return parsed;
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${label} stored state payload is invalid`, { cause: error });
  }
}

function assertStateMachinePolicy(action: () => void, label: string): void {
  try {
    action();
  } catch (error) {
    if (error instanceof CoreSchemaError) throw error;
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${label} state transition violates the canonical state machine`, { cause: error });
  }
}

function validateStateMachineState<T>(validate: (value: unknown) => T, value: unknown, label: string): T {
  try {
    return validate(value);
  } catch (error) {
    if (error instanceof CoreSchemaError) throw error;
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${label} state is invalid`, { cause: error });
  }
}

function assertSessionPasswordVerifier(verifier: SessionPasswordVerifier, now: string): string {
  if (
    verifier.profileId !== "session-password-v1" ||
    verifier.purpose !== "SESSION_PASSWORD" ||
    verifier.algorithm !== "ARGON2ID" ||
    verifier.version !== 0x13 ||
    verifier.memoryKiB < 65_536 ||
    verifier.iterations < 3 ||
    verifier.parallelism !== 4 ||
    verifier.salt.length < 16 ||
    verifier.salt.length > 1_024 ||
    verifier.verifier.length < 32 ||
    verifier.verifier.length > 1_024 ||
    !Number.isInteger(verifier.memoryKiB) ||
    !Number.isInteger(verifier.iterations) ||
    verifier.memoryKiB > 4_194_304 ||
    verifier.iterations > 100
  ) {
    throw new CoreSchemaError(
      "PERSISTENCE_SCHEMA_INVALID",
      "session-password verifier does not meet the approved Argon2id profile",
    );
  }
  return JSON.stringify({
    profileId: verifier.profileId,
    purpose: verifier.purpose,
    algorithm: verifier.algorithm,
    version: verifier.version,
    memoryKiB: verifier.memoryKiB,
    iterations: verifier.iterations,
    parallelism: verifier.parallelism,
    salt: verifier.salt.toString("hex"),
    verifier: verifier.verifier.toString("hex"),
    createdAt: now,
  });
}

function parseSessionPasswordVerifierJson(raw: string): SessionPasswordVerifier {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const verifier: SessionPasswordVerifier = {
      profileId: value.profileId as string,
      purpose: value.purpose as "SESSION_PASSWORD",
      algorithm: value.algorithm as "ARGON2ID",
      version: value.version as 0x13,
      memoryKiB: value.memoryKiB as number,
      iterations: value.iterations as number,
      parallelism: value.parallelism as 4,
      salt: Buffer.from(value.salt as string, "hex"),
      verifier: Buffer.from(value.verifier as string, "hex"),
    };
    assertSessionPasswordVerifier(
      verifier,
      typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    );
    return verifier;
  } catch (error) {
    if (error instanceof CoreSchemaError) throw error;
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored session password verifier is invalid", { cause: error });
  }
}

function assertSessionPasswordUpgrade(
  previous: SessionPasswordVerifier,
  replacement: SessionPasswordVerifier,
  now: string,
): string {
  const replacementJson = assertSessionPasswordVerifier(replacement, now);
  if (
    replacement.profileId !== previous.profileId ||
    replacement.memoryKiB < previous.memoryKiB ||
    replacement.iterations < previous.iterations ||
    (replacement.memoryKiB === previous.memoryKiB && replacement.iterations === previous.iterations) ||
    replacement.salt.equals(previous.salt)
  ) {
    throw new CoreSchemaError(
      "PERSISTENCE_SCHEMA_INVALID",
      "session password rehash must use a fresh salt and a strictly stronger approved profile",
    );
  }
  return replacementJson;
}

function assertRecoveryEvidence(evidence: SessionPasswordRecoveryEvidence, now: string): void {
  if (
    evidence.type !== "GENERATED_RECOVERY_V1" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(evidence.evidenceId) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(evidence.backupId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(evidence.slotId) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(evidence.descriptorDigestSha256) ||
    !evidence.verifiedAt ||
    Number.isNaN(Date.parse(evidence.verifiedAt)) ||
    Date.parse(evidence.verifiedAt) > Date.parse(now)
  ) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "recovery-factor verification evidence is invalid or stale");
  }
}

function validateSessionSecurityStateForStorage(value: unknown): SessionSecurityState {
  try {
    return validateSessionSecurityState(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "session security state is invalid", { cause: error });
  }
}

function assertSessionMutationRequest(request: SessionStateMutationRequest): void {
  if (!request.userId || request.userId.length > 256 || request.userId.includes("\0")) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "session user identity is invalid");
  }
  if (!request.sessionId || request.sessionId.length > 128 || request.sessionId.includes("\0")) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "session identity is invalid");
  }
  if (!request.eventId || !request.eventType || !request.correlationId) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "session transition evidence identity is invalid");
  }
  assertPlatformStateTimestamp(request.now);
}

function assertDeclassificationText(value: unknown, label: string, maximum: number): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value.includes("\0") ||
    /(?:password|passwd|secret|token|private[_ -]?key|credential|api[_ -]?key|db[_ -]?dek|backup[_ -]?dek)/iu.test(value)
  ) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${label} is invalid or secret-bearing`);
  }
  return value;
}

function assertIntegrity(database: Database.Database): void {
  const integrity = database.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "SQLite integrity check failed after migration");
  }
  const foreignKeys = database.pragma("foreign_key_check");
  if (!Array.isArray(foreignKeys) || foreignKeys.length !== 0) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "SQLite foreign-key check failed after migration");
  }
}

function assertMigrationRow(row: MigrationRow | undefined, expected: MigrationRow): void {
  if (
    !row ||
    row.version !== expected.version ||
    row.migration_id !== expected.migration_id ||
    row.checksum_sha256 !== expected.checksum_sha256
  ) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "recorded migration identity is not deterministic");
  }
}

function assertMigrationLedger(database: Database.Database, currentVersion: number): void {
  const rows = database
    .prepare("SELECT version, migration_id, checksum_sha256 FROM schema_migrations ORDER BY version")
    .all() as MigrationRow[];
  const expected = [
    { version: 1, migration_id: INITIAL_MIGRATION_ID, checksum_sha256: INITIAL_MIGRATION_CHECKSUM },
    { version: 2, migration_id: FULL_STATE_MIGRATION_ID, checksum_sha256: FULL_STATE_MIGRATION_CHECKSUM },
    { version: 3, migration_id: PLATFORM_STATE_MIGRATION_ID, checksum_sha256: PLATFORM_STATE_MIGRATION_CHECKSUM },
    { version: 4, migration_id: EXECUTION_SCOPE_MIGRATION_ID, checksum_sha256: EXECUTION_SCOPE_MIGRATION_CHECKSUM },
    { version: 5, migration_id: MISSION_GRAPH_IMMUTABILITY_MIGRATION_ID, checksum_sha256: MISSION_GRAPH_IMMUTABILITY_MIGRATION_CHECKSUM },
    { version: 6, migration_id: AUTHORITY_RECORDS_MIGRATION_ID, checksum_sha256: AUTHORITY_RECORDS_MIGRATION_CHECKSUM },
    { version: 7, migration_id: PROVIDER_INTEGRATION_STATE_MIGRATION_ID, checksum_sha256: PROVIDER_INTEGRATION_STATE_MIGRATION_CHECKSUM },
    { version: 8, migration_id: PROJECT_POLICY_TRUST_MIGRATION_ID, checksum_sha256: PROJECT_POLICY_TRUST_MIGRATION_CHECKSUM },
    { version: 9, migration_id: UPDATE_TRUST_STATE_MIGRATION_ID, checksum_sha256: UPDATE_TRUST_STATE_MIGRATION_CHECKSUM },
    { version: 10, migration_id: DOMAIN_EVENT_PROVENANCE_MIGRATION_ID, checksum_sha256: DOMAIN_EVENT_PROVENANCE_MIGRATION_CHECKSUM },
    { version: 11, migration_id: CONFIGURATION_AUTHORITY_MIGRATION_ID, checksum_sha256: CONFIGURATION_AUTHORITY_MIGRATION_CHECKSUM },
    { version: 12, migration_id: MEMORY_RETENTION_MIGRATION_ID, checksum_sha256: MEMORY_RETENTION_MIGRATION_CHECKSUM },
    { version: 13, migration_id: SESSION_SECURITY_MIGRATION_ID, checksum_sha256: SESSION_SECURITY_MIGRATION_CHECKSUM },
    { version: 14, migration_id: APPROVAL_LIFECYCLE_MIGRATION_ID, checksum_sha256: APPROVAL_LIFECYCLE_MIGRATION_CHECKSUM },
  ].slice(0, currentVersion);
  if (rows.length !== expected.length) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "schema migration ledger is incomplete");
  }
  expected.forEach((migration, index) => assertMigrationRow(rows[index], migration));
}

function assertPlatformStateTimestamp(value: string): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "platform state timestamp must be an ISO timestamp");
  }
}

function validatePlatformIdentifierForStorage(value: unknown): string {
  try {
    return validateOpaquePlatformIdentifier(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "platform state identifier is invalid", { cause: error });
  }
}

function validatePlatformRuntimeForStorage(value: unknown): PlatformRuntimeIdentity {
  try {
    return validatePlatformRuntimeIdentity(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "platform runtime identity is invalid", { cause: error });
  }
}

function validatePlatformCompatibilityForStorage(value: unknown): PlatformCompatibility {
  try {
    return validatePlatformCompatibility(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "platform compatibility is invalid", { cause: error });
  }
}

function validatePlatformPathForStorage(value: unknown): PlatformPathRef {
  try {
    return validatePlatformPathRef(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "platform path reference is invalid", { cause: error });
  }
}

function validateTaskExecutionScopeForStorage(value: unknown): TaskExecutionScopeRecord {
  try {
    return validateTaskExecutionScopeRecord(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "task execution scope is invalid", { cause: error });
  }
}

function validateMissionGraphForStorage(value: unknown): MissionGraphVersion {
  try {
    return validateMissionGraphVersion(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "mission graph version is invalid", { cause: error });
  }
}

function validateAuthorityForStorage(value: unknown): AuthorityEnvelope {
  try {
    return validateAuthorityEnvelope(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "authority envelope is invalid", { cause: error });
  }
}

function validatePermissionForStorage(value: unknown): PermissionDecision {
  try {
    return validatePermissionDecision(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "permission decision is invalid", { cause: error });
  }
}

function validateCanonicalDescriptorForStorage(value: unknown): CanonicalActionDescriptorV1 {
  try {
    return validateCanonicalActionDescriptor(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "canonical action descriptor is invalid", { cause: error });
  }
}

function validateApprovalForStorage(value: unknown): ApprovalRequest {
  try {
    return validateApprovalRequest(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval request is invalid", { cause: error });
  }
}

function validateApprovalDecisionForStorage(value: unknown): ApprovalDecision {
  try {
    return validateApprovalDecision(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval decision is invalid", { cause: error });
  }
}

function validateFreshTargetResolutionForStorage(value: unknown): FreshTargetResolution {
  try {
    return validateFreshTargetResolution(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "fresh target resolution is invalid", { cause: error });
  }
}

function validateFinalDestructiveConfirmationForStorage(value: unknown): FinalDestructiveConfirmation {
  try {
    return validateFinalDestructiveConfirmation(value);
  } catch (error) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "final destructive confirmation is invalid", { cause: error });
  }
}

function assertFreshExecutionEvidence(timestampValue: string, nowValue: string, label: string): void {
  const observedAt = Date.parse(timestampValue);
  const now = Date.parse(nowValue);
  if (observedAt > now || now - observedAt > FRESH_EXECUTION_EVIDENCE_MAX_AGE_MS) {
    throw new CoreSchemaError("PERSISTENCE_CONFLICT", `${label} is stale or future-dated`);
  }
}

function validateQuotaForStorage(value: unknown): ProviderQuotaSnapshot {
  try { return validateProviderQuotaSnapshot(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider quota snapshot is invalid", { cause: error }); }
}
function validateUsageForStorage(value: unknown): UsageRecord {
  try { return validateUsageRecord(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "usage record is invalid", { cause: error }); }
}
function validateBudgetForStorage(value: unknown): BudgetPolicy {
  try { return validateBudgetPolicy(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "budget policy is invalid", { cause: error }); }
}
function validateReservationForStorage(value: unknown): BudgetReservation {
  try { return validateBudgetReservation(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "budget reservation is invalid", { cause: error }); }
}
function validateCheckpointForStorage(value: unknown): WorkerCheckpoint {
  try { return validateWorkerCheckpoint(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "worker checkpoint is invalid", { cause: error }); }
}
function validateArtifactForStorage(value: unknown): ArtifactRecord {
  try { return validateArtifact(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "artifact record is invalid", { cause: error }); }
}
function validateLeaseForStorage(value: unknown): LeaseRecord {
  try { return validateLease(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "lease record is invalid", { cause: error }); }
}
function validateProviderProfileForStorage(value: unknown): ProviderProfile {
  try { return validateProviderProfile(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider profile is invalid", { cause: error }); }
}
function validateProviderPolicyForStorage(value: unknown): ProviderCompatibilityPolicy {
  try { return validateProviderCompatibilityPolicy(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider compatibility policy is invalid", { cause: error }); }
}
function validateProviderSetupForStorage(value: unknown): ProviderSetupRecord {
  try { return validateProviderSetupRecord(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider setup state is invalid", { cause: error }); }
}
function validateProviderQualificationForStorage(value: unknown): ProviderQualificationRecord {
  try { return validateProviderQualificationRecordWithSetupPlan(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider qualification state is invalid", { cause: error }); }
}
function validateModuleForStorage(value: unknown): ModuleManifest {
  try { return validateModuleManifest(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "module manifest is invalid", { cause: error }); }
}
function validateIntegrationForStorage(value: unknown): IntegrationAccount {
  try { return validateIntegrationAccount(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "integration account is invalid", { cause: error }); }
}
function validateProxmoxForStorage(value: unknown): ProxmoxConnection {
  try { return validateProxmoxConnection(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "Proxmox connection is invalid", { cause: error }); }
}
function validatePolicyTrustForStorage(value: unknown): ProjectPolicyTrustRecord {
  try { return validateProjectPolicyTrustRecord(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project policy trust record is invalid", { cause: error }); }
}
function validatePolicySnapshotForStorage(value: unknown): ProjectPolicySnapshotRecord {
  try { return validateProjectPolicySnapshot(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project policy snapshot is invalid", { cause: error }); }
}
function validatePolicyDecisionForStorage(value: unknown): ProjectPolicyDecisionRequest {
  try { return validateProjectPolicyDecisionRequest(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project policy decision is invalid", { cause: error }); }
}
function validateProjectForStorage(value: unknown): ProjectRecord {
  try { return validateProjectRecord(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project record is invalid", { cause: error }); }
}
function validateProjectAliasForStorage(value: unknown): ProjectAliasRecord {
  try { return validateProjectAliasRecord(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project alias is invalid", { cause: error }); }
}
function validateProjectEnvironmentForStorage(value: unknown): ProjectEnvironmentRecord {
  try { return validateProjectEnvironmentRecord(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project environment is invalid", { cause: error }); }
}
function validateProjectWorkspaceForStorage(value: unknown): ProjectWorkspaceRecord {
  try { return validateProjectWorkspaceRecord(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project workspace is invalid", { cause: error }); }
}
function validateTrustedMetadataForStorage(value: unknown): TrustedUpdateMetadataRecord {
  try { return validateTrustedUpdateMetadata(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "trusted update metadata is invalid", { cause: error }); }
}
function validateReleaseTrustForStorage(value: unknown): ReleaseTrustRecord {
  try { return validateReleaseTrustRecord(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "release trust record is invalid", { cause: error }); }
}
function validateUpdateIncidentForStorage(value: unknown): UpdateIncidentRecord {
  try { return validateUpdateIncident(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "update incident is invalid", { cause: error }); }
}
function validateUpdateOperationForStorage(value: unknown): UpdateOperationRecord {
  try { return validateUpdateOperation(value); } catch (error) { throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "update operation is invalid", { cause: error }); }
}

interface MigrationGuard {
  readonly backupPath: string;
  release(): void;
}

interface MigrationLockOwner {
  readonly pid: number;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readMigrationLockOwner(path: string): MigrationLockOwner | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { pid?: unknown };
    return typeof parsed.pid === "number" && Number.isInteger(parsed.pid) && parsed.pid > 0
      ? { pid: parsed.pid }
      : undefined;
  } catch {
    return undefined;
  }
}

function acquireMigrationGuard(connection: CoreDatabaseConnection, fromVersion: number): MigrationGuard {
  const lockPath = `${connection.databasePath}.migration.lock`;
  const backupPath = `${connection.databasePath}.pre-migration-v${fromVersion}-to-v${CURRENT_SCHEMA_VERSION}.bak`;
  let lockDescriptor: number | undefined;
  try {
    lockDescriptor = openSync(lockPath, "wx");
  } catch {
    const owner = readMigrationLockOwner(lockPath);
    if (owner && !isProcessAlive(owner.pid)) {
      try {
        unlinkSync(lockPath);
        lockDescriptor = openSync(lockPath, "wx");
      } catch {
        throw new CoreSchemaError(
          "PERSISTENCE_MIGRATION_LOCKED",
          "a stale migration lock could not be reclaimed safely",
        );
      }
    } else {
      throw new CoreSchemaError(
        "PERSISTENCE_MIGRATION_LOCKED",
        "another migration is already holding the exclusive migration lock",
      );
    }
  }

  try {
    const metadata = Buffer.from(JSON.stringify({ pid: process.pid, fromVersion, toVersion: CURRENT_SCHEMA_VERSION }), "utf8");
    writeSync(lockDescriptor, metadata, 0, metadata.length, 0);
    if (!existsSync(backupPath)) {
      const checkpoint = connection.checkpoint("TRUNCATE");
      if (!checkpoint.complete) {
        throw new Error("pre-migration WAL checkpoint did not complete");
      }
      copyFileSync(connection.databasePath, backupPath);
    }
  } catch (error) {
    closeSync(lockDescriptor);
    try {
      unlinkSync(lockPath);
    } catch {
      // Preserve the original migration-backup failure; cleanup is best effort.
    }
    throw new CoreSchemaError(
      "PERSISTENCE_MIGRATION_BACKUP_FAILED",
      "the pre-migration database backup could not be prepared",
      { cause: error },
    );
  }

  let released = false;
  return {
    backupPath,
    release(): void {
      if (released) return;
      released = true;
      closeSync(lockDescriptor);
      try {
        unlinkSync(lockPath);
      } catch {
        // The migration result remains authoritative; a later startup will fail closed if needed.
      }
    },
  };
}

export function applyCoreMigrations(
  connection: CoreDatabaseConnection,
  now: () => string = () => new Date().toISOString(),
): MigrationResult {
  const database = connection.database;
  const userVersion = database.pragma("user_version", { simple: true });
  if (typeof userVersion !== "number" || !Number.isInteger(userVersion) || userVersion < 0) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "SQLite schema version is malformed");
  }
  if (userVersion > CURRENT_SCHEMA_VERSION) {
    throw new CoreSchemaError(
      "PERSISTENCE_SCHEMA_UNSUPPORTED",
      `database schema ${userVersion} is newer than supported schema ${CURRENT_SCHEMA_VERSION}`,
    );
  }

  if (userVersion === CURRENT_SCHEMA_VERSION) {
    if (!tableExists(database, "schema_migrations")) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "schema version has no migration ledger");
    }
    assertMigrationLedger(database, CURRENT_SCHEMA_VERSION);
    assertIntegrity(database);
    return { currentVersion: CURRENT_SCHEMA_VERSION, appliedMigrationIds: MIGRATION_IDS };
  }

  if (tableExists(database, "schema_migrations")) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "schema migration ledger exists at schema version zero");
  }

  const migrationGuard = acquireMigrationGuard(connection, userVersion);
  try {
    const appliedAt = now();
    if (!appliedAt || Number.isNaN(Date.parse(appliedAt))) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "migration timestamp must be an ISO timestamp");
    }

    const apply = database.transaction(() => {
      let currentVersion = userVersion;
      if (currentVersion === 0) {
        database.exec(INITIAL_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(1, INITIAL_MIGRATION_ID, INITIAL_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 1");
        currentVersion = 1;
      } else {
        assertMigrationLedger(database, currentVersion);
      }
      if (currentVersion === 1) {
        database.exec(FULL_STATE_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
        )
          .run(2, FULL_STATE_MIGRATION_ID, FULL_STATE_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 2");
        currentVersion = 2;
      }
      if (currentVersion === 2) {
        database.exec(PLATFORM_STATE_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
        )
          .run(3, PLATFORM_STATE_MIGRATION_ID, PLATFORM_STATE_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 3");
        currentVersion = 3;
      }
      if (currentVersion === 3) {
        database.exec(EXECUTION_SCOPE_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
        )
          .run(4, EXECUTION_SCOPE_MIGRATION_ID, EXECUTION_SCOPE_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 4");
        currentVersion = 4;
      }
      if (currentVersion === 4) {
        database.exec(MISSION_GRAPH_IMMUTABILITY_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
        )
          .run(5, MISSION_GRAPH_IMMUTABILITY_MIGRATION_ID, MISSION_GRAPH_IMMUTABILITY_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 5");
        currentVersion = 5;
      }
      if (currentVersion === 5) {
        database.exec(AUTHORITY_RECORDS_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
        )
          .run(6, AUTHORITY_RECORDS_MIGRATION_ID, AUTHORITY_RECORDS_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 6");
        currentVersion = 6;
      }
      if (currentVersion === 6) {
        database.exec(PROVIDER_INTEGRATION_STATE_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(7, PROVIDER_INTEGRATION_STATE_MIGRATION_ID, PROVIDER_INTEGRATION_STATE_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 7");
        currentVersion = 7;
      }
      if (currentVersion === 7) {
        database.exec(PROJECT_POLICY_TRUST_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(8, PROJECT_POLICY_TRUST_MIGRATION_ID, PROJECT_POLICY_TRUST_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 8");
        currentVersion = 8;
      }
      if (currentVersion === 8) {
        database.exec(UPDATE_TRUST_STATE_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(9, UPDATE_TRUST_STATE_MIGRATION_ID, UPDATE_TRUST_STATE_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 9");
        currentVersion = 9;
      }
      if (currentVersion === 9) {
        database.exec(DOMAIN_EVENT_PROVENANCE_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(10, DOMAIN_EVENT_PROVENANCE_MIGRATION_ID, DOMAIN_EVENT_PROVENANCE_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 10");
        currentVersion = 10;
      }
      if (currentVersion === 10) {
        database.exec(CONFIGURATION_AUTHORITY_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(11, CONFIGURATION_AUTHORITY_MIGRATION_ID, CONFIGURATION_AUTHORITY_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 11");
        currentVersion = 11;
      }
      if (currentVersion === 11) {
        database.exec(MEMORY_RETENTION_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(12, MEMORY_RETENTION_MIGRATION_ID, MEMORY_RETENTION_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 12");
        currentVersion = 12;
      }
      if (currentVersion === 12) {
        database.exec(SESSION_SECURITY_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(13, SESSION_SECURITY_MIGRATION_ID, SESSION_SECURITY_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 13");
        currentVersion = 13;
      }
      if (currentVersion === 13) {
        database.exec(APPROVAL_LIFECYCLE_MIGRATION_SQL);
        database
          .prepare(
            "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
          )
          .run(14, APPROVAL_LIFECYCLE_MIGRATION_ID, APPROVAL_LIFECYCLE_MIGRATION_CHECKSUM, appliedAt);
        database.pragma("user_version = 14");
        currentVersion = 14;
      }
      assertMigrationLedger(database, CURRENT_SCHEMA_VERSION);
      assertIntegrity(database);
    });
    try {
      apply();
    } catch (error) {
      if (error instanceof CoreSchemaError) throw error;
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "deterministic schema migration failed", {
        cause: error,
      });
    }
    return { currentVersion: CURRENT_SCHEMA_VERSION, appliedMigrationIds: MIGRATION_IDS };
  } finally {
    migrationGuard.release();
  }
}

export class CoreStateRepository {
  private readonly connection: CoreDatabaseConnection;
  private readonly domainEventListeners = new Set<DomainEventCommittedListener>();

  constructor(connection: CoreDatabaseConnection) {
    this.connection = connection;
  }

  onDomainEventCommitted(listener: DomainEventCommittedListener): () => void {
    if (typeof listener !== "function") {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "domain event listener must be callable");
    }
    this.domainEventListeners.add(listener);
    return () => {
      this.domainEventListeners.delete(listener);
    };
  }

  stageConfigurationCandidate(value: unknown): { readonly candidateId: string; readonly state: "STAGED" } {
    let candidate: ConfigurationCandidate;
    try {
      candidate = validateConfigurationCandidate(value);
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "configuration candidate is invalid", { cause: error });
    }
    const insert = this.connection.database.transaction(() => {
      this.connection.database
        .prepare("INSERT INTO configuration_candidates (candidate_id, domain, config_json, schema_version, expected_active_version, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'STAGED', ?, ?)")
        .run(candidate.candidateId, candidate.domain, JSON.stringify(candidate), candidate.schemaVersion, candidate.expectedActiveVersion, candidate.createdAt, candidate.createdAt);
      return { candidateId: candidate.candidateId, state: "STAGED" as const };
    });
    try {
      return insert();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "configuration candidate staging failed", { cause: error });
    }
  }

  activateConfigurationCandidate(
    candidateIdValue: unknown,
    expectedActiveVersion: number,
    now: string,
  ): { readonly candidateId: string; readonly domain: ConfigurationDomain; readonly version: number } {
    if (typeof candidateIdValue !== "string" || candidateIdValue.length < 1 || candidateIdValue.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(candidateIdValue)) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "configuration candidate identifier is invalid");
    }
    if (!Number.isSafeInteger(expectedActiveVersion) || expectedActiveVersion < 0) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "configuration activation expected version is invalid");
    }
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const row = this.connection.database
        .prepare("SELECT candidate_id, domain, config_json, schema_version, expected_active_version, state FROM configuration_candidates WHERE candidate_id = ?")
        .get(candidateIdValue) as { candidate_id?: string; domain?: string; config_json?: string; schema_version?: number; expected_active_version?: number; state?: string } | undefined;
      if (!row || row.state !== "STAGED" || row.config_json === undefined || row.domain === undefined || row.schema_version === undefined || row.expected_active_version === undefined) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "configuration candidate is missing or no longer staged");
      }
      let candidate: ConfigurationCandidate;
      try {
        candidate = validateConfigurationCandidate(JSON.parse(row.config_json));
      } catch (error) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "staged configuration candidate failed revalidation", { cause: error });
      }
      if (candidate.candidateId !== candidateIdValue || candidate.domain !== row.domain || candidate.schemaVersion !== row.schema_version || candidate.expectedActiveVersion !== row.expected_active_version) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "staged configuration candidate identity drifted");
      }
      if (candidate.expectedActiveVersion !== expectedActiveVersion) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "configuration candidate was staged against a different active version");
      }
      const active = this.connection.database
        .prepare("SELECT version FROM active_configurations WHERE domain = ?")
        .get(candidate.domain) as { version?: number } | undefined;
      const currentVersion = active?.version ?? 0;
      if (currentVersion !== expectedActiveVersion) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", `configuration domain ${candidate.domain} expected version ${expectedActiveVersion}, found ${currentVersion}`);
      }
      const nextVersion = currentVersion + 1;
      const activated: ActiveConfiguration = validateActiveConfiguration({
        domain: candidate.domain,
        schemaVersion: candidate.schemaVersion,
        values: candidate.values,
        version: nextVersion,
        sourceCandidateId: candidate.candidateId,
        activatedAt: now,
      });
      if (active) {
        const update = this.connection.database
          .prepare("UPDATE active_configurations SET config_json = ?, schema_version = ?, version = ?, source_candidate_id = ?, activated_at = ? WHERE domain = ? AND version = ?")
          .run(JSON.stringify(activated), activated.schemaVersion, activated.version, activated.sourceCandidateId, activated.activatedAt, activated.domain, currentVersion);
        if (update.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "configuration activation lost its version race");
      } else {
        this.connection.database
          .prepare("INSERT INTO active_configurations (domain, config_json, schema_version, version, source_candidate_id, activated_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(activated.domain, JSON.stringify(activated), activated.schemaVersion, activated.version, activated.sourceCandidateId, activated.activatedAt);
      }
      const candidateUpdate = this.connection.database
        .prepare("UPDATE configuration_candidates SET state = 'ACTIVATED', updated_at = ? WHERE candidate_id = ? AND state = 'STAGED'")
        .run(now, candidate.candidateId);
      if (candidateUpdate.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "configuration candidate activation state changed");
      this.connection.database
        .prepare("INSERT INTO audit_events (audit_event_id, event_type, subject_type, subject_id, audit_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(`configuration-activation:${candidate.candidateId}:${nextVersion}`, "CONFIGURATION_ACTIVATED", "CONFIGURATION", candidate.domain, JSON.stringify({ candidateId: candidate.candidateId, domain: candidate.domain, version: nextVersion }), now);
      return { candidateId: candidate.candidateId, domain: candidate.domain, version: nextVersion };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "configuration activation failed", { cause: error });
    }
  }

  getActiveConfiguration(domainValue: unknown): ActiveConfiguration | undefined {
    let domain: ConfigurationDomain;
    try {
      domain = validateConfigurationDomain(domainValue);
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "configuration domain is invalid", { cause: error });
    }
    const row = this.connection.database
      .prepare("SELECT config_json FROM active_configurations WHERE domain = ?")
      .get(domain) as { config_json?: string } | undefined;
    if (!row?.config_json) return undefined;
    try {
      return validateActiveConfiguration(JSON.parse(row.config_json));
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored active configuration is invalid", { cause: error });
    }
  }

  putRetentionAnchor(value: unknown): { readonly anchorId: string; readonly version: number } {
    let anchor: RetentionAnchor;
    try {
      anchor = validateRetentionAnchor(value);
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "retention anchor is invalid", { cause: error });
    }
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database
        .prepare("SELECT anchor_json, version FROM retention_anchors WHERE anchor_id = ?")
        .get(anchor.anchorId) as { anchor_json?: string; version?: number } | undefined;
      if (!existing) {
        this.connection.database
          .prepare("INSERT INTO retention_anchors (anchor_id, record_type, record_id, anchor_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
          .run(anchor.anchorId, anchor.recordType, anchor.recordId, JSON.stringify(anchor), anchor.createdAt, anchor.createdAt);
        return { anchorId: anchor.anchorId, version: 1 };
      }
      let prior: RetentionAnchor;
      try {
        prior = validateRetentionAnchor(JSON.parse(existing.anchor_json ?? ""));
      } catch (error) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored retention anchor is invalid", { cause: error });
      }
      if (prior.recordType !== anchor.recordType || prior.recordId !== anchor.recordId || prior.policyId !== anchor.policyId) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "retention anchor identity cannot change");
      }
      if (Date.parse(anchor.retainUntil) < Date.parse(prior.retainUntil)) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "retention anchor cannot be shortened");
      }
      const version = (existing.version ?? 0) + 1;
      this.connection.database
        .prepare("UPDATE retention_anchors SET anchor_json = ?, version = ?, updated_at = ? WHERE anchor_id = ? AND version = ?")
        .run(JSON.stringify(anchor), version, anchor.createdAt, anchor.anchorId, existing.version);
      return { anchorId: anchor.anchorId, version };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "retention anchor persistence failed", { cause: error });
    }
  }

  putConversation(value: unknown): { readonly conversationId: string; readonly version: number } {
    let conversation: ConversationRecord;
    try {
      conversation = validateConversation(value);
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "conversation is invalid", { cause: error });
    }
    const apply = this.connection.database.transaction(() => {
      const anchor = this.connection.database
        .prepare("SELECT record_type, record_id FROM retention_anchors WHERE anchor_id = ?")
        .get(conversation.retentionAnchorId) as { record_type?: string; record_id?: string } | undefined;
      if (!anchor || anchor.record_type !== "CONVERSATION" || anchor.record_id !== conversation.conversationId) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "conversation retention anchor is missing or mismatched");
      }
      const existing = this.connection.database
        .prepare("SELECT user_id, conversation_json, version FROM conversations WHERE conversation_id = ?")
        .get(conversation.conversationId) as { user_id?: string; conversation_json?: string; version?: number } | undefined;
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== conversation.expectedVersion) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "conversation version is stale");
      if (existing?.user_id !== undefined && existing.user_id !== conversation.userId) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "conversation owner cannot change");
      const version = currentVersion + 1;
      if (existing) this.connection.database.prepare("UPDATE conversations SET conversation_json = ?, version = ?, updated_at = ? WHERE conversation_id = ? AND version = ?").run(JSON.stringify(conversation), version, conversation.updatedAt, conversation.conversationId, currentVersion);
      else this.connection.database.prepare("INSERT INTO conversations (conversation_id, user_id, state, conversation_json, version, created_at, updated_at) VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?)").run(conversation.conversationId, conversation.userId, JSON.stringify(conversation), version, conversation.createdAt, conversation.updatedAt);
      return { conversationId: conversation.conversationId, version };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "conversation persistence failed", { cause: error });
    }
  }

  appendConversationMessage(value: unknown): { readonly messageId: string } {
    let message: ConversationMessage;
    try {
      message = validateConversationMessage(value);
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "conversation message is invalid", { cause: error });
    }
    const insert = this.connection.database.transaction(() => {
      const conversation = this.connection.database
        .prepare("SELECT conversation_json FROM conversations WHERE conversation_id = ?")
        .get(message.conversationId) as { conversation_json?: string } | undefined;
      if (!conversation?.conversation_json) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "conversation does not exist");
      let parent: ConversationRecord;
      try {
        parent = validateConversation(JSON.parse(conversation.conversation_json));
      } catch (error) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored conversation is invalid", { cause: error });
      }
      if (JSON.stringify(parent.dataPolicy) !== JSON.stringify(message.dataPolicy)) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "conversation message data policy disagrees with its conversation");
      this.connection.database
        .prepare("INSERT INTO messages (message_id, conversation_id, role, message_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
        .run(message.messageId, message.conversationId, message.role, JSON.stringify(message), message.createdAt, message.createdAt);
      return { messageId: message.messageId };
    });
    try {
      return insert();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "conversation message persistence failed", { cause: error });
    }
  }

  putMemory(value: unknown): { readonly memoryId: string; readonly version: number } {
    let memory: MemoryRecord;
    try {
      memory = validateMemory(value);
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "memory is invalid", { cause: error });
    }
    const apply = this.connection.database.transaction(() => {
      const anchor = this.connection.database
        .prepare("SELECT record_type, record_id FROM retention_anchors WHERE anchor_id = ?")
        .get(memory.retentionAnchorId) as { record_type?: string; record_id?: string } | undefined;
      if (!anchor || anchor.record_type !== "MEMORY" || anchor.record_id !== memory.memoryId) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "memory retention anchor is missing or mismatched");
      const existing = this.connection.database
        .prepare("SELECT memory_json, version FROM memories WHERE memory_id = ?")
        .get(memory.memoryId) as { memory_json?: string; version?: number } | undefined;
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== memory.expectedVersion) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "memory version is stale");
      if (existing?.memory_json) {
        let prior: MemoryRecord;
        try {
          prior = validateMemory(JSON.parse(existing.memory_json));
        } catch (error) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored memory is invalid", { cause: error });
        }
        if (memory.sourceRevision <= prior.sourceRevision) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "memory source revision is not monotonic");
      }
      const version = currentVersion + 1;
      const payload = JSON.stringify(memory);
      if (existing) this.connection.database.prepare("UPDATE memories SET memory_json = ?, version = ?, updated_at = ? WHERE memory_id = ? AND version = ?").run(payload, version, memory.observedAt, memory.memoryId, currentVersion);
      else this.connection.database.prepare("INSERT INTO memories (memory_id, memory_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(memory.memoryId, payload, version, memory.observedAt, memory.observedAt);
      this.connection.database.prepare("INSERT INTO memory_revisions (revision_id, memory_id, revision_json, revision_number, created_at) VALUES (?, ?, ?, ?, ?)").run(`${memory.memoryId}:revision:${memory.sourceRevision}`, memory.memoryId, payload, memory.sourceRevision, memory.observedAt);
      return { memoryId: memory.memoryId, version };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "memory persistence failed", { cause: error });
    }
  }

  retrieveMemory(value: unknown): readonly MemoryRetrievalResult[] {
    const request = validateMemoryRetrievalRequest(value);
    const requestedScopes = request.applicableScopes.map((scope) => `${scope.kind}:${scope.scopeId ?? ""}`);
    const authoritativeSourceIds = new Set(request.authoritativeSourceIds);
    const terms = request.queryTerms.map((term) => term.toLocaleLowerCase("en-US"));
    const sensitivityRank: Record<string, number> = { PUBLIC: 0, PRIVATE: 1, SENSITIVE: 2, SECRET: 3 };
    const confidenceRank: Record<string, number> = { VERIFIED: 400, CONFIRMED: 300, INFERRED: 150, STALE: 0 };
    const nowMs = Date.parse(request.now);
    const rows = this.connection.database.prepare("SELECT memory_json FROM memories ORDER BY memory_id").all() as Array<{ memory_json?: string }>;
    const results: MemoryRetrievalResult[] = [];
    for (const row of rows) {
      if (!row.memory_json) continue;
      const memory = validateMemory(JSON.parse(row.memory_json));
      if (authoritativeSourceIds.has(memory.sourceId)) continue;
      if ((sensitivityRank[memory.dataPolicy.sensitivity] ?? 99) > (sensitivityRank[request.dataPolicy.sensitivity] ?? -1)) continue;
      if (request.dataPolicy.locality === "LOCAL_ONLY" && memory.dataPolicy.locality !== "LOCAL_ONLY") continue;
      const scopeKey = `${memory.scope.kind}:${memory.scope.scopeId ?? ""}`;
      const scopeRank = requestedScopes.indexOf(scopeKey);
      if (scopeRank < 0) continue;
      const loweredContent = memory.content.toLocaleLowerCase("en-US");
      const relevance = terms.length === 0 ? 0 : terms.reduce((count, term) => count + (loweredContent.includes(term) ? 1 : 0), 0);
      if (terms.length > 0 && relevance === 0) continue;
      const stale = memory.confidence === "STALE" || (memory.staleAt !== undefined && Date.parse(memory.staleAt) <= nowMs);
      const ageDays = Math.max(0, Math.floor((nowMs - Date.parse(memory.observedAt)) / 86_400_000));
      const score = (requestedScopes.length - scopeRank) * 1000 + (stale ? 0 : confidenceRank[memory.confidence] ?? 0) + relevance * 100 + (stale ? 0 : Math.max(0, 100 - ageDays));
      results.push(Object.freeze({ memory, rankScore: score }));
    }
    return Object.freeze(results.sort((left, right) => right.rankScore - left.rankScore || right.memory.observedAt.localeCompare(left.memory.observedAt) || left.memory.memoryId.localeCompare(right.memory.memoryId)).slice(0, request.limit));
  }

  appendDomainEvent(value: unknown, provenanceValue?: unknown): DomainEventAppendResult {
    let event: DomainEvent;
    let provenance: ExternalEventProvenance | undefined;
    try {
      event = validateDomainEvent(value);
      provenance = provenanceValue === undefined ? undefined : validateExternalEventProvenance(provenanceValue);
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "domain event is invalid", { cause: error });
    }

    const append = this.connection.database.transaction((): DomainEventAppendResult => {
      if (provenance?.deduplicationKey !== undefined) {
        const existing = this.connection.database
          .prepare("SELECT event_id FROM event_dedup WHERE deduplication_key = ?")
          .get(provenance.deduplicationKey) as { event_id?: string } | undefined;
        if (existing?.event_id !== undefined) {
          const stored = this.connection.database
            .prepare("SELECT aggregate_version FROM events WHERE event_id = ?")
            .get(existing.event_id) as { aggregate_version?: number } | undefined;
          const storedVersion = stored?.aggregate_version;
          if (typeof storedVersion !== "number" || !Number.isInteger(storedVersion)) {
            throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "event deduplication ledger references a missing event");
          }
          return { eventId: existing.event_id, aggregateVersion: storedVersion, duplicate: true };
        }
      }

      const aggregate = this.connection.database
        .prepare("SELECT COALESCE(MAX(aggregate_version), 0) + 1 AS next_version FROM events WHERE aggregate_type = ? AND aggregate_id = ?")
        .get(event.aggregateType, event.aggregateId) as { next_version?: number } | undefined;
      const aggregateVersion = aggregate?.next_version;
      if (typeof aggregateVersion !== "number" || !Number.isSafeInteger(aggregateVersion) || aggregateVersion < 1) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "domain event aggregate version could not be allocated");
      }

      this.connection.database
        .prepare("INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(event.eventId, event.type, event.aggregateType, event.aggregateId, aggregateVersion, JSON.stringify(event.payload), event.correlationId, event.occurredAt);
      this.connection.database
        .prepare("INSERT INTO domain_event_envelopes (event_id, event_json, causation_id, actor_type, actor_id, payload_version) VALUES (?, ?, ?, ?, ?, ?)")
        .run(event.eventId, JSON.stringify(event), event.causationId ?? null, event.actorType, event.actorId ?? null, event.payloadVersion);
      if (provenance !== undefined) {
        this.connection.database
          .prepare("INSERT INTO event_provenance (event_id, source_type, source_id, deduplication_key, first_seen_at) VALUES (?, ?, ?, ?, ?)")
          .run(event.eventId, provenance.sourceType, provenance.sourceId, provenance.deduplicationKey ?? null, event.occurredAt);
        if (provenance.deduplicationKey !== undefined) {
          this.connection.database
            .prepare("INSERT INTO event_dedup (deduplication_key, event_id, first_seen_at) VALUES (?, ?, ?)")
            .run(provenance.deduplicationKey, event.eventId, event.occurredAt);
        }
      }
      return { eventId: event.eventId, aggregateVersion, duplicate: false };
    });

    const result = append();
    if (!result.duplicate) {
      for (const listener of this.domainEventListeners) {
        try {
          listener(event);
        } catch {
          // Publication is post-commit; a consumer failure cannot roll back durable state.
        }
      }
    }
    return result;
  }

  private assertExecutionScopeReferences(scope: TaskExecutionScopeRecord["scope"]): void {
    const exists = (sql: string, value: string): boolean => {
      const row = this.connection.database.prepare(sql).get(value) as { present?: number } | undefined;
      return row?.present === 1;
    };
    const assertEnvironment = (environmentId: string, projectId?: string): void => {
      const row = this.connection.database
        .prepare("SELECT project_id FROM project_environments WHERE environment_id = ?")
        .get(environmentId) as { project_id?: string } | undefined;
      if (!row || (projectId !== undefined && row.project_id !== projectId)) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "execution scope environment is not a member of its project");
      }
    };
    if (scope.kind === "PROJECT_WORKSPACE") {
      if (!exists("SELECT 1 AS present FROM projects WHERE project_id = ?", scope.projectId)) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "execution scope project does not exist");
      }
      const workspace = this.connection.database
        .prepare("SELECT project_id FROM project_workspaces WHERE workspace_id = ?")
        .get(scope.workspaceId) as { project_id?: string } | undefined;
      if (!workspace || workspace.project_id !== scope.projectId) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "execution scope workspace is not a member of its project");
      }
      if (scope.environmentId !== undefined) assertEnvironment(scope.environmentId, scope.projectId);
      return;
    }
    if (scope.kind === "INTEGRATION") {
      if (scope.projectId !== undefined && !exists("SELECT 1 AS present FROM projects WHERE project_id = ?", scope.projectId)) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "integration scope project does not exist");
      }
      if (scope.environmentId !== undefined) assertEnvironment(scope.environmentId, scope.projectId);
      for (const binding of scope.bindings) {
        if (!exists("SELECT 1 AS present FROM integration_accounts WHERE integration_account_id = ?", binding.accountId)) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "integration scope account does not exist");
        }
        for (const capabilityId of binding.capabilityIds) {
          const capability = this.connection.database
            .prepare("SELECT 1 AS present FROM integration_capabilities WHERE capability_id = ? AND integration_account_id = ?")
            .get(capabilityId, binding.accountId) as { present?: number } | undefined;
          if (capability?.present !== 1) {
            throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "integration scope capability is not bound to its account");
          }
        }
      }
      return;
    }
    if (scope.kind === "SYSTEM" && scope.environmentId !== undefined) assertEnvironment(scope.environmentId);
  }

  private appendStateTransitionEvidence(
    request: Pick<DurableStateTransitionRequest, "eventId" | "eventType" | "correlationId" | "occurredAt">,
    recordType: string,
    recordId: string,
    aggregateVersion: number,
    stateJson: string,
  ): void {
    this.connection.database
      .prepare(
        "INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        request.eventId,
        request.eventType,
        recordType,
        recordId,
        aggregateVersion,
        stateJson,
        request.correlationId,
        request.occurredAt,
      );
    this.connection.database
      .prepare("INSERT INTO audit_events (audit_event_id, event_type, subject_type, subject_id, audit_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        `state-transition:${request.eventId}`,
        "STATE_TRANSITION",
        recordType,
        recordId,
        JSON.stringify({
          eventId: request.eventId,
          eventType: request.eventType,
          aggregateVersion,
          correlationId: request.correlationId,
        }),
        request.occurredAt,
    );
  }

  private appendSessionPasswordEvidence(
    request: Pick<SessionStateMutationRequest, "eventId" | "eventType" | "correlationId" | "now">,
    verifierVersion: number,
    metadata: {
      readonly operation: SessionPasswordUpgradeKind | "RECOVERY_RESET";
      readonly profileId: string;
      readonly recoveryEvidenceId?: string;
      readonly backupId?: string;
      readonly slotId?: string;
    },
  ): void {
    const payload = JSON.stringify({
      operation: metadata.operation,
      profileId: metadata.profileId,
      recoveryEvidenceId: metadata.recoveryEvidenceId,
      backupId: metadata.backupId,
      slotId: metadata.slotId,
    });
    this.connection.database
      .prepare("INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        `${request.eventId}:verifier`,
        request.eventType,
        "SESSION_PASSWORD_VERIFIER",
        "session-password-verifier",
        verifierVersion,
        payload,
        request.correlationId,
        request.now,
      );
    this.connection.database
      .prepare("INSERT INTO audit_events (audit_event_id, event_type, subject_type, subject_id, audit_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        `password-verifier:${request.eventId}`,
        "SESSION_PASSWORD_VERIFIER_CHANGED",
        "SESSION_PASSWORD_VERIFIER",
        "session-password-verifier",
        payload,
        request.now,
      );
  }

  putTaskExecutionScope(request: TaskExecutionScopeWriteRequest): TaskExecutionScopeWriteResult {
    const scopeId = validatePlatformIdentifierForStorage(request.scopeId);
    const taskId = validatePlatformIdentifierForStorage(request.taskId);
    if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 0) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "execution scope expected version must be a non-negative integer");
    }
    assertPlatformStateTimestamp(request.now);
    const validated = validateTaskExecutionScopeForStorage({ scope: request.scope, dataPolicy: request.dataPolicy });
    const scopeJson = JSON.stringify(validated);
    const apply = this.connection.database.transaction(() => {
      this.assertExecutionScopeReferences(validated.scope);
      const task = this.connection.database
        .prepare("SELECT 1 AS present FROM tasks WHERE task_id = ?")
        .get(taskId) as { present?: number } | undefined;
      if (task?.present !== 1) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "execution scope task does not exist");
      }
      const existing = this.connection.database
        .prepare("SELECT task_id, version FROM task_execution_scopes WHERE scope_id = ?")
        .get(scopeId) as { task_id?: string; version?: number } | undefined;
      const taskScope = this.connection.database
        .prepare("SELECT scope_id, version FROM task_execution_scopes WHERE task_id = ?")
        .get(taskId) as { scope_id?: string; version?: number } | undefined;
      if (taskScope && taskScope.scope_id !== scopeId) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "a task may have exactly one execution scope");
      }
      if (existing && existing.task_id !== taskId) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "an execution scope cannot move between tasks");
      }
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== request.expectedVersion) {
        throw new CoreSchemaError(
          "PERSISTENCE_CONFLICT",
          `execution scope ${scopeId} expected version ${request.expectedVersion}, found ${currentVersion}`,
        );
      }
      const nextVersion = currentVersion + 1;
      if (existing) {
        const result = this.connection.database
          .prepare("UPDATE task_execution_scopes SET scope_json = ?, version = ?, updated_at = ? WHERE scope_id = ? AND task_id = ? AND version = ?")
          .run(scopeJson, nextVersion, request.now, scopeId, taskId, currentVersion);
        if (result.changes !== 1) {
          throw new CoreSchemaError("PERSISTENCE_CONFLICT", "execution scope update lost its version race");
        }
      } else {
        this.connection.database
          .prepare("INSERT INTO task_execution_scopes (scope_id, task_id, scope_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(scopeId, taskId, scopeJson, nextVersion, request.now, request.now);
      }
      return { scopeId, taskId, version: nextVersion };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "execution scope persistence failed", { cause: error });
    }
  }

  getTaskExecutionScope(scopeIdValue: unknown): TaskExecutionScopeRecord | undefined {
    const scopeId = validatePlatformIdentifierForStorage(scopeIdValue);
    const row = this.connection.database
      .prepare("SELECT scope_json FROM task_execution_scopes WHERE scope_id = ?")
      .get(scopeId) as { scope_json?: string } | undefined;
    if (!row) return undefined;
    try {
      return validateTaskExecutionScopeForStorage(JSON.parse(row.scope_json ?? ""));
    } catch (error) {
      if (error instanceof CoreSchemaError) throw error;
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored execution scope is invalid", { cause: error });
    }
  }

  activateMissionGraphVersion(request: MissionGraphActivationRequest): MissionGraphActivationResult {
    const graph = validateMissionGraphForStorage(request.graph);
    if (!Number.isInteger(request.expectedMissionVersion) || request.expectedMissionVersion < 1) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "mission graph activation expected version is invalid");
    }
    if (graph.causationEventId !== request.eventId || !request.eventType || !request.correlationId || request.eventId.includes("\0") || request.eventType.includes("\0") || request.correlationId.includes("\0")) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "mission graph activation event binding is invalid");
    }
    const graphJson = JSON.stringify(graph);
    const apply = this.connection.database.transaction(() => {
      const mission = this.connection.database
        .prepare("SELECT state, mission_json, version FROM missions WHERE mission_id = ?")
        .get(graph.missionId) as { state?: string; mission_json?: string; version?: number } | undefined;
      if (!mission) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "mission graph mission does not exist");
      if (mission.version !== request.expectedMissionVersion) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "mission graph activation observed a stale mission version");
      }
      if (mission.state === "COMPLETED" || mission.state === "FAILED" || mission.state === "CANCELLED") {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "terminal missions cannot activate a new graph version");
      }
      const existingGraph = this.connection.database
        .prepare("SELECT 1 AS present FROM mission_graph_versions WHERE mission_id = ? AND graph_version = ?")
        .get(graph.missionId, graph.version) as { present?: number } | undefined;
      if (existingGraph?.present === 1) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "mission graph version already exists and is immutable");
      }
      for (const taskId of graph.taskIds) {
        const task = this.connection.database
          .prepare("SELECT mission_id, task_json FROM tasks WHERE task_id = ?")
          .get(taskId) as { mission_id?: string; task_json?: string } | undefined;
        if (!task || task.mission_id !== graph.missionId) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "mission graph references a missing or foreign task");
        }
        const scope = this.connection.database
          .prepare("SELECT scope_id, scope_json FROM task_execution_scopes WHERE task_id = ?")
          .get(taskId) as { scope_id?: string; scope_json?: string } | undefined;
        if (!scope || !scope.scope_id || !scope.scope_json) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "every activated graph task requires exactly one execution scope");
        }
        const taskPayload = assertStoredState(task.task_json ?? "", "TASK");
        const authorityEnvelopeId = taskPayload.authorityEnvelopeId;
        if (typeof authorityEnvelopeId !== "string" || authorityEnvelopeId.length < 1) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "every activated graph task requires an authority envelope");
        }
        const envelope = this.connection.database
          .prepare("SELECT task_id FROM authority_envelopes WHERE envelope_id = ?")
          .get(authorityEnvelopeId) as { task_id?: string | null } | undefined;
        if (!envelope || (envelope.task_id !== null && envelope.task_id !== taskId)) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "task authority envelope is missing or outside task containment");
        }
        const envelopeScope = this.connection.database
          .prepare("SELECT 1 AS present FROM authority_envelope_scopes WHERE envelope_id = ? AND scope_id = ?")
          .get(authorityEnvelopeId, scope.scope_id) as { present?: number } | undefined;
        if (envelopeScope?.present !== 1) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "task authority envelope does not contain its execution scope");
        }
        if (taskPayload.dataPolicy !== undefined) {
          const taskScope = validateTaskExecutionScopeForStorage(JSON.parse(scope.scope_json));
          if (JSON.stringify(taskPayload.dataPolicy) !== JSON.stringify(taskScope.dataPolicy)) {
            throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "task data policy disagrees with its execution scope");
          }
        }
      }
      const missionPayload = assertStoredState(mission.mission_json ?? "", "MISSION");
      const nextMissionJson = JSON.stringify({ ...missionPayload, activeGraphVersion: graph.version });
      const nextMissionVersion = (mission.version ?? 0) + 1;
      this.connection.database
        .prepare("INSERT INTO mission_graph_versions (graph_id, mission_id, graph_version, graph_json, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(graph.graphId, graph.missionId, graph.version, graphJson, graph.createdAt);
      const missionUpdate = this.connection.database
        .prepare("UPDATE missions SET mission_json = ?, version = ?, updated_at = ? WHERE mission_id = ? AND version = ?")
        .run(nextMissionJson, nextMissionVersion, graph.createdAt, graph.missionId, mission.version);
      if (missionUpdate.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "mission graph activation lost its mission version race");
      this.connection.database
        .prepare("INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(request.eventId, request.eventType, "MISSION", graph.missionId, nextMissionVersion, graphJson, request.correlationId, graph.createdAt);
      return {
        graphId: graph.graphId,
        missionId: graph.missionId,
        graphVersion: graph.version,
        missionVersion: nextMissionVersion,
        eventId: request.eventId,
      };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "mission graph activation failed", { cause: error });
    }
  }

  putAuthorityEnvelope(envelopeValue: unknown, missionId?: string, taskId?: string): AuthorityEnvelopeWriteResult {
    const envelope = validateAuthorityForStorage(envelopeValue);
    const now = envelope.createdAt;
    const insert = this.connection.database.transaction(() => {
      this.connection.database
        .prepare("INSERT INTO authority_envelopes (envelope_id, mission_id, task_id, envelope_json, policy_version, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)")
        .run(envelope.id, missionId ?? null, taskId ?? null, JSON.stringify(envelope), String(envelope.policySnapshotVersion), now, now);
      return { envelopeId: envelope.id };
    });
    try {
      return insert();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "authority envelope persistence failed", { cause: error });
    }
  }

  private appendSecurityAudit(event: SecurityAuditEvent): void {
    const audit = validateSecurityAuditEvent(event);
    this.connection.database
      .prepare("INSERT INTO audit_events (audit_event_id, event_type, subject_type, subject_id, audit_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        audit.auditEventId,
        audit.eventType,
        audit.subjectType,
        audit.subjectId,
        JSON.stringify({ reasonCode: audit.reasonCode, details: audit.details }),
        audit.occurredAt,
      );
  }

  putPermissionDecision(decisionValue: unknown): PermissionDecisionWriteResult {
    const decision = validatePermissionForStorage(decisionValue);
    const insert = this.connection.database.transaction(() => {
      this.connection.database
        .prepare("INSERT INTO permission_decisions (decision_id, decision_json, policy_version, created_at) VALUES (?, ?, ?, ?)")
        .run(decision.decisionId, JSON.stringify(decision), decision.policyVersion, decision.decidedAt);
      this.appendSecurityAudit({
        auditEventId: `permission-decision:${decision.decisionId}`,
        eventType: "PERMISSION_DECISION",
        subjectType: "PERMISSION_DECISION",
        subjectId: decision.decisionId,
        reasonCode: decision.outcome === "ALLOW" ? "PERMISSION_ALLOWED" : decision.outcome === "DENY" ? "PERMISSION_DENIED" : "PERMISSION_APPROVAL_REQUIRED",
        occurredAt: decision.decidedAt,
        details: { outcome: decision.outcome, contextualRisk: decision.contextualRisk, policyVersion: decision.policyVersion },
      });
      return { decisionId: decision.decisionId };
    });
    try {
      return insert();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "permission decision persistence failed", { cause: error });
    }
  }

  putApprovalRequest(request: ApprovalRequestWriteRequest): ApprovalRequestWriteResult {
    const descriptor = validateCanonicalDescriptorForStorage(request.descriptor);
    const approval = validateApprovalForStorage(request.approval);
    const digest = digestCanonicalActionDescriptor(descriptor);
    if (approval.actionDigest !== digest || approval.status !== "PENDING") {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval request digest or initial status is invalid");
    }
    const insert = this.connection.database.transaction(() => {
      this.connection.database
        .prepare("INSERT INTO approval_requests (approval_request_id, action_descriptor_json, approval_json, policy_version, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)")
        .run(approval.approvalId, JSON.stringify(descriptor), JSON.stringify(approval), String(descriptor.policySnapshotVersion), approval.status, approval.createdAt, approval.createdAt);
      this.appendSecurityAudit({
        auditEventId: `approval-issued:${approval.approvalId}:1`,
        eventType: "APPROVAL_ISSUED",
        subjectType: "APPROVAL",
        subjectId: approval.approvalId,
        reasonCode: "APPROVAL_REQUESTED",
        occurredAt: approval.createdAt,
        details: { kind: approval.kind, descriptorDigest: approval.actionDigest },
      });
      return { approvalId: approval.approvalId, version: 1 };
    });
    try {
      return insert();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "approval request persistence failed", { cause: error });
    }
  }

  decideApproval(request: ApprovalDecisionRequest): ApprovalDecisionResult {
    const approvalId = validatePlatformIdentifierForStorage(request.approvalId);
    const decision = validateApprovalDecisionForStorage(request.decision);
    if (decision.approvalId !== approvalId) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval decision targets a different approval");
    if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval expected version is invalid");
    assertPlatformStateTimestamp(request.now);
    if (Date.parse(decision.decidedAt) > Date.parse(request.now)) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval decision cannot be future-dated");
    const apply = this.connection.database.transaction(() => {
      const row = this.connection.database
        .prepare("SELECT approval_json, policy_version, state, version FROM approval_requests WHERE approval_request_id = ?")
        .get(approvalId) as { approval_json?: string | null; policy_version?: string; state?: string; version?: number } | undefined;
      if (!row) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval request does not exist");
      if (row.version !== request.expectedVersion) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval decision is stale");
      if (typeof row.approval_json !== "string") throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval metadata is unavailable for lifecycle enforcement");
      const approval = validateApprovalForStorage(JSON.parse(row.approval_json));
      if (row.state !== "PENDING") throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval is not pending");
      if (Date.parse(request.now) >= Date.parse(approval.expiresAt)) {
        const nextVersion = request.expectedVersion + 1;
        const expired = this.connection.database
          .prepare("UPDATE approval_requests SET state = 'EXPIRED', version = ?, updated_at = ? WHERE approval_request_id = ? AND state = 'PENDING' AND version = ?")
          .run(nextVersion, request.now, approvalId, request.expectedVersion);
        if (expired.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval expiry lost its single-use race");
        this.appendSecurityAudit({
          auditEventId: `approval-expired:${approvalId}:${nextVersion}`,
          eventType: "APPROVAL_EXPIRED",
          subjectType: "APPROVAL",
          subjectId: approvalId,
          reasonCode: "APPROVAL_EXPIRED",
          occurredAt: request.now,
          details: { version: nextVersion },
        });
        return { approvalId, version: nextVersion, status: "EXPIRED" as const };
      }
      this.connection.database
        .prepare("INSERT INTO approval_decisions (approval_decision_id, approval_request_id, decision_json, policy_version, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(decision.decisionId, approvalId, JSON.stringify(decision), Number(row.policy_version), decision.decidedAt);
      const nextVersion = request.expectedVersion + 1;
      const update = this.connection.database
        .prepare("UPDATE approval_requests SET state = ?, version = ?, updated_at = ? WHERE approval_request_id = ? AND state = 'PENDING' AND version = ?")
        .run(decision.status, nextVersion, request.now, approvalId, request.expectedVersion);
      if (update.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval decision lost its single-use race");
      this.appendSecurityAudit({
        auditEventId: `approval-decided:${approvalId}:${nextVersion}`,
        eventType: "APPROVAL_DECIDED",
        subjectType: "APPROVAL",
        subjectId: approvalId,
        reasonCode: decision.status === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
        occurredAt: request.now,
        details: { version: nextVersion, decisionId: decision.decisionId, sessionId: decision.sessionId },
      });
      return { approvalId, version: nextVersion, status: decision.status };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "approval decision failed", { cause: error });
    }
  }

  cancelApproval(request: ApprovalCancellationRequest): ApprovalDecisionResult {
    return this.transitionPendingApproval(request.approvalId, request.expectedVersion, request.now, "CANCELLED");
  }

  expireApproval(request: ApprovalExpirationRequest): ApprovalDecisionResult {
    const approvalId = validatePlatformIdentifierForStorage(request.approvalId);
    if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval expected version is invalid");
    assertPlatformStateTimestamp(request.now);
    const apply = this.connection.database.transaction(() => {
      const row = this.connection.database
        .prepare("SELECT approval_json, state, version FROM approval_requests WHERE approval_request_id = ?")
        .get(approvalId) as { approval_json?: string | null; state?: string; version?: number } | undefined;
      if (!row) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval request does not exist");
      if (row.version !== request.expectedVersion || row.state !== "PENDING") throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval is stale or not pending");
      if (typeof row.approval_json !== "string") throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval metadata is unavailable for lifecycle enforcement");
      const approval = validateApprovalForStorage(JSON.parse(row.approval_json));
      if (Date.parse(request.now) < Date.parse(approval.expiresAt)) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval has not expired");
      const nextVersion = request.expectedVersion + 1;
      const update = this.connection.database
        .prepare("UPDATE approval_requests SET state = 'EXPIRED', version = ?, updated_at = ? WHERE approval_request_id = ? AND state = 'PENDING' AND version = ?")
        .run(nextVersion, request.now, approvalId, request.expectedVersion);
      if (update.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval expiry lost its single-use race");
      this.appendSecurityAudit({
        auditEventId: `approval-expired:${approvalId}:${nextVersion}`,
        eventType: "APPROVAL_EXPIRED",
        subjectType: "APPROVAL",
        subjectId: approvalId,
        reasonCode: "APPROVAL_EXPIRED",
        occurredAt: request.now,
        details: { version: nextVersion },
      });
      return { approvalId, version: nextVersion, status: "EXPIRED" as const };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "approval expiry failed", { cause: error });
    }
  }

  private transitionPendingApproval(approvalIdValue: string, expectedVersion: number, nowValue: string, status: "CANCELLED"): ApprovalDecisionResult {
    const approvalId = validatePlatformIdentifierForStorage(approvalIdValue);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval expected version is invalid");
    assertPlatformStateTimestamp(nowValue);
    const apply = this.connection.database.transaction(() => {
      const row = this.connection.database
        .prepare("SELECT approval_json, state, version FROM approval_requests WHERE approval_request_id = ?")
        .get(approvalId) as { approval_json?: string | null; state?: string; version?: number } | undefined;
      if (!row) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval request does not exist");
      if (row.version !== expectedVersion || row.state !== "PENDING") throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval is stale or not pending");
      if (typeof row.approval_json !== "string") throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval metadata is unavailable for lifecycle enforcement");
      const approval = validateApprovalForStorage(JSON.parse(row.approval_json));
      if (Date.parse(nowValue) >= Date.parse(approval.expiresAt)) {
        const nextVersion = expectedVersion + 1;
        const expired = this.connection.database.prepare("UPDATE approval_requests SET state = 'EXPIRED', version = ?, updated_at = ? WHERE approval_request_id = ? AND state = 'PENDING' AND version = ?").run(nextVersion, nowValue, approvalId, expectedVersion);
        if (expired.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval expiry lost its single-use race");
        this.appendSecurityAudit({
          auditEventId: `approval-expired:${approvalId}:${nextVersion}`,
          eventType: "APPROVAL_EXPIRED",
          subjectType: "APPROVAL",
          subjectId: approvalId,
          reasonCode: "APPROVAL_EXPIRED",
          occurredAt: nowValue,
          details: { version: nextVersion },
        });
        return { approvalId, version: nextVersion, status: "EXPIRED" as const };
      }
      const nextVersion = expectedVersion + 1;
      const update = this.connection.database
        .prepare("UPDATE approval_requests SET state = ?, version = ?, updated_at = ? WHERE approval_request_id = ? AND state = 'PENDING' AND version = ?")
        .run(status, nextVersion, nowValue, approvalId, expectedVersion);
      if (update.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval cancellation lost its single-use race");
      this.appendSecurityAudit({
        auditEventId: `approval-cancelled:${approvalId}:${nextVersion}`,
        eventType: "APPROVAL_CANCELLED",
        subjectType: "APPROVAL",
        subjectId: approvalId,
        reasonCode: "APPROVAL_CANCELLED",
        occurredAt: nowValue,
        details: { version: nextVersion },
      });
      return { approvalId, version: nextVersion, status };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "approval cancellation failed", { cause: error });
    }
  }

  consumeApproval(request: ApprovalConsumptionRequest): ApprovalConsumptionResult {
    const approvalId = validatePlatformIdentifierForStorage(request.approvalId);
    const sessionId = validatePlatformIdentifierForStorage(request.sessionId);
    const freshDescriptor = validateCanonicalDescriptorForStorage(request.freshDescriptor);
    const freshTargetResolution = validateFreshTargetResolutionForStorage(request.freshTargetResolution);
    if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 1) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval expected version is invalid");
    }
    assertPlatformStateTimestamp(request.now);
    assertFreshExecutionEvidence(freshTargetResolution.resolvedAt, request.now, "fresh target resolution");
    const apply = this.connection.database.transaction(() => {
      const row = this.connection.database
        .prepare("SELECT action_descriptor_json, approval_json, state, version FROM approval_requests WHERE approval_request_id = ?")
        .get(approvalId) as { action_descriptor_json?: string; approval_json?: string | null; state?: string; version?: number } | undefined;
      if (!row) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval request does not exist");
      if (row.version !== request.expectedVersion || row.state !== "APPROVED") throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval is stale, not approved, or already consumed");
      if (typeof row.approval_json !== "string") throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval metadata is unavailable for lifecycle enforcement");
      const approval = validateApprovalForStorage(JSON.parse(row.approval_json));
      if (Date.parse(request.now) >= Date.parse(approval.expiresAt)) {
        const nextVersion = request.expectedVersion + 1;
        const expired = this.connection.database.prepare("UPDATE approval_requests SET state = 'EXPIRED', version = ?, updated_at = ? WHERE approval_request_id = ? AND state = 'APPROVED' AND version = ?").run(nextVersion, request.now, approvalId, request.expectedVersion);
        if (expired.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval expiry lost its single-use race");
        this.appendSecurityAudit({
          auditEventId: `approval-expired:${approvalId}:${nextVersion}`,
          eventType: "APPROVAL_EXPIRED",
          subjectType: "APPROVAL",
          subjectId: approvalId,
          reasonCode: "APPROVAL_EXPIRED",
          occurredAt: request.now,
          details: { version: nextVersion, fromState: "APPROVED" },
        });
        return { approvalId, version: nextVersion, status: "EXPIRED" as const };
      }
      const storedDescriptor = validateCanonicalDescriptorForStorage(JSON.parse(row.action_descriptor_json ?? ""));
      const storedDigest = digestCanonicalActionDescriptor(storedDescriptor);
      const freshDigest = digestCanonicalActionDescriptor(freshDescriptor);
      if (storedDigest !== approval.actionDigest || freshDigest !== storedDigest || freshTargetResolution.descriptorDigest !== freshDigest) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "approval descriptor changed before consumption");
      }
      const requiresFinalConfirmation = approval.kind === "DESTRUCTIVE_FINAL_CONFIRMATION" || storedDescriptor.actionClass === "DESTRUCTIVE" || storedDescriptor.sideEffectClass === "DESTRUCTIVE";
      if (requiresFinalConfirmation) {
        if (request.finalConfirmation === undefined) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "destructive approval requires fresh final confirmation");
        const confirmation = validateFinalDestructiveConfirmationForStorage(request.finalConfirmation);
        assertFreshExecutionEvidence(confirmation.confirmedAt, request.now, "final destructive confirmation");
        if (
          confirmation.approvalId !== approval.approvalId ||
          confirmation.descriptorDigest !== freshDigest ||
          confirmation.sessionId !== sessionId ||
          confirmation.actionSummary !== approval.actionSummary ||
          confirmation.targetSummary !== approval.targetSummary ||
          confirmation.environmentSummary !== approval.environmentSummary ||
          confirmation.consequenceSummary !== approval.consequenceSummary
        ) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "final destructive confirmation is not bound to the approved action");
        }
      } else if (request.finalConfirmation !== undefined) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "final destructive confirmation is not applicable to this approval");
      }
      const nextVersion = request.expectedVersion + 1;
      const update = this.connection.database
        .prepare("UPDATE approval_requests SET state = 'CONSUMED', version = ?, updated_at = ? WHERE approval_request_id = ? AND state = 'APPROVED' AND version = ?")
        .run(nextVersion, request.now, approvalId, request.expectedVersion);
      if (update.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "approval consumption lost its single-use race");
      this.appendSecurityAudit({
        auditEventId: `approval-consumed:${approvalId}:${nextVersion}`,
        eventType: "APPROVAL_CONSUMED",
        subjectType: "APPROVAL",
        subjectId: approvalId,
        reasonCode: "APPROVAL_CONSUMED",
        occurredAt: request.now,
        details: { version: nextVersion, sessionId },
      });
      return { approvalId, version: nextVersion, status: "CONSUMED" as const };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "approval consumption failed", { cause: error });
    }
  }

  appendProviderQuotaSnapshot(value: unknown): { readonly snapshotId: string } {
    const snapshot = validateQuotaForStorage(value);
    const insert = this.connection.database.transaction(() => {
      this.connection.database.prepare("INSERT INTO provider_quota_snapshots (snapshot_id, provider_id, snapshot_json, observed_at) VALUES (?, ?, ?, ?)").run(snapshot.snapshotId, snapshot.providerId, JSON.stringify(snapshot), snapshot.observedAt);
      return { snapshotId: snapshot.snapshotId };
    });
    try { return insert(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "provider quota snapshot persistence failed", { cause: error }); }
  }

  appendUsageRecord(value: unknown): { readonly usageId: string } {
    const usage = validateUsageForStorage(value);
    const insert = this.connection.database.transaction(() => {
      this.connection.database.prepare("INSERT INTO usage_records (usage_id, provider_id, usage_json, occurred_at) VALUES (?, ?, ?, ?)").run(usage.usageId, usage.providerId, JSON.stringify(usage), usage.occurredAt);
      return { usageId: usage.usageId };
    });
    try { return insert(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "usage record persistence failed", { cause: error }); }
  }

  putBudgetPolicy(request: BudgetPolicyWriteRequest): { readonly budgetId: string; readonly version: number } {
    const budget = validateBudgetForStorage(request.budget);
    if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 0) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "budget expected version is invalid");
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database.prepare("SELECT version FROM budgets WHERE budget_id = ?").get(budget.budgetId) as { version?: number } | undefined;
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== request.expectedVersion) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "budget policy is stale");
      const nextVersion = currentVersion + 1;
      if (existing) this.connection.database.prepare("UPDATE budgets SET budget_json = ?, version = ?, updated_at = ? WHERE budget_id = ? AND version = ?").run(JSON.stringify(budget), nextVersion, new Date().toISOString(), budget.budgetId, currentVersion);
      else this.connection.database.prepare("INSERT INTO budgets (budget_id, budget_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(budget.budgetId, JSON.stringify(budget), nextVersion, new Date().toISOString(), new Date().toISOString());
      return { budgetId: budget.budgetId, version: nextVersion };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "budget policy persistence failed", { cause: error }); }
  }

  reserveBudget(request: BudgetReservationWriteRequest): { readonly reservationId: string; readonly budgetVersion: number } {
    const reservation = validateReservationForStorage(request.reservation);
    if (reservation.state !== "RESERVED" || reservation.amount.nanoUnits.startsWith("-")) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "budget reservation must be a non-negative RESERVED amount");
    if (!Number.isInteger(request.expectedBudgetVersion) || request.expectedBudgetVersion < 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "budget reservation expected version is invalid");
    const apply = this.connection.database.transaction(() => {
      const budgetRow = this.connection.database.prepare("SELECT budget_json, version FROM budgets WHERE budget_id = ?").get(reservation.budgetId) as { budget_json?: string; version?: number } | undefined;
      if (!budgetRow || budgetRow.version !== request.expectedBudgetVersion) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "budget reservation observed a stale or missing budget");
      const budget = validateBudgetForStorage(JSON.parse(budgetRow.budget_json ?? ""));
      if (budget.limit.currency !== reservation.amount.currency) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "different currencies cannot share a budget");
      const rows = this.connection.database.prepare("SELECT reservation_json, state FROM budget_reservations WHERE budget_id = ?").all(reservation.budgetId) as Array<{ reservation_json?: string; state?: string }>;
      let committed = 0n;
      for (const row of rows) {
        if (row.state === "RELEASED" || row.state === "EXPIRED") continue;
        const prior = validateReservationForStorage(JSON.parse(row.reservation_json ?? ""));
        if (prior.amount.currency !== budget.limit.currency) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "budget contains mixed currencies");
        committed += BigInt(prior.amount.nanoUnits);
      }
      const limit = BigInt(budget.limit.nanoUnits);
      const requested = BigInt(reservation.amount.nanoUnits);
      if (budget.hardLimit && committed + requested > limit) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "budget hard limit would be exceeded");
      const nextBudgetVersion = request.expectedBudgetVersion + 1;
      this.connection.database.prepare("INSERT INTO budget_reservations (reservation_id, budget_id, reservation_json, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(reservation.reservationId, reservation.budgetId, JSON.stringify(reservation), reservation.state, reservation.createdAt, reservation.createdAt);
      const updated = this.connection.database.prepare("UPDATE budgets SET version = ?, updated_at = ? WHERE budget_id = ? AND version = ?").run(nextBudgetVersion, reservation.createdAt, reservation.budgetId, request.expectedBudgetVersion);
      if (updated.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "budget reservation lost its serialization race");
      return { reservationId: reservation.reservationId, budgetVersion: nextBudgetVersion };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "budget reservation failed", { cause: error }); }
  }

  appendWorkerCheckpoint(workerIdValue: unknown, checkpointValue: unknown): WorkerCheckpointWriteResult {
    const workerId = validatePlatformIdentifierForStorage(workerIdValue);
    const checkpoint = validateCheckpointForStorage(checkpointValue);
    const apply = this.connection.database.transaction(() => {
      const attempt = this.connection.database
        .prepare("SELECT task_id FROM task_attempts WHERE attempt_id = ?")
        .get(checkpoint.attemptId) as { task_id?: string } | undefined;
      if (!attempt || attempt.task_id !== checkpoint.taskId) {
        throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "worker checkpoint attempt is missing or outside task containment");
      }
      const task = this.connection.database
        .prepare("SELECT 1 AS present FROM tasks WHERE task_id = ?")
        .get(checkpoint.taskId) as { present?: number } | undefined;
      if (task?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "worker checkpoint task does not exist");
      const prior = this.connection.database
        .prepare("SELECT MAX(CAST(json_extract(checkpoint_json, '$.sequence') AS INTEGER)) AS sequence FROM worker_checkpoints WHERE worker_id = ? AND task_id = ? AND json_extract(checkpoint_json, '$.attemptId') = ?")
        .get(workerId, checkpoint.taskId, checkpoint.attemptId) as { sequence?: number | null } | undefined;
      if (prior?.sequence !== null && prior?.sequence !== undefined && checkpoint.sequence <= prior.sequence) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "worker checkpoint sequence is not monotonic");
      }
      for (const artifact of checkpoint.artifacts) {
        const producingAttempt = this.connection.database
          .prepare("SELECT 1 AS present FROM task_attempts WHERE attempt_id = ?")
          .get(artifact.producingAttemptId) as { present?: number } | undefined;
        if (producingAttempt?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "checkpoint artifact producing attempt does not exist");
        if (artifact.projectId !== undefined) {
          const project = this.connection.database
            .prepare("SELECT 1 AS present FROM projects WHERE project_id = ?")
            .get(artifact.projectId) as { present?: number } | undefined;
          if (project?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "checkpoint artifact project does not exist");
        }
        const existing = this.connection.database
          .prepare("SELECT artifact_json FROM artifacts WHERE artifact_id = ?")
          .get(artifact.artifactId) as { artifact_json?: string } | undefined;
        const artifactJson = JSON.stringify(artifact);
        if (existing) {
          if (existing.artifact_json !== artifactJson) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "artifact identity is immutable");
        } else {
          const now = checkpoint.createdAt;
          this.connection.database
            .prepare("INSERT INTO artifacts (artifact_id, artifact_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)")
            .run(artifact.artifactId, artifactJson, now, now);
        }
      }
      this.connection.database
        .prepare("INSERT INTO worker_checkpoints (checkpoint_id, worker_id, task_id, checkpoint_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(checkpoint.checkpointId, workerId, checkpoint.taskId, JSON.stringify(checkpoint), checkpoint.sequence, checkpoint.createdAt, checkpoint.createdAt);
      return { checkpointId: checkpoint.checkpointId, sequence: checkpoint.sequence };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "worker checkpoint persistence failed", { cause: error }); }
  }

  putArtifact(value: unknown): { readonly artifactId: string } {
    const artifact = validateArtifactForStorage(value);
    const now = new Date().toISOString();
    const apply = this.connection.database.transaction(() => {
      const attempt = this.connection.database
        .prepare("SELECT 1 AS present FROM task_attempts WHERE attempt_id = ?")
        .get(artifact.producingAttemptId) as { present?: number } | undefined;
      if (attempt?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "artifact producing attempt does not exist");
      if (artifact.projectId !== undefined) {
        const project = this.connection.database
          .prepare("SELECT 1 AS present FROM projects WHERE project_id = ?")
          .get(artifact.projectId) as { present?: number } | undefined;
        if (project?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "artifact project does not exist");
      }
      const existing = this.connection.database
        .prepare("SELECT artifact_json FROM artifacts WHERE artifact_id = ?")
        .get(artifact.artifactId) as { artifact_json?: string } | undefined;
      const artifactJson = JSON.stringify(artifact);
      if (existing) {
        if (existing.artifact_json !== artifactJson) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "artifact identity is immutable");
      } else {
        this.connection.database
          .prepare("INSERT INTO artifacts (artifact_id, artifact_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)")
          .run(artifact.artifactId, artifactJson, now, now);
      }
      return { artifactId: artifact.artifactId };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "artifact persistence failed", { cause: error }); }
  }

  acquireWorkspaceLease(value: unknown): LeaseWriteResult {
    const lease = validateLeaseForStorage(value);
    if (lease.state !== "ACTIVE" || lease.resourceType !== "WORKSPACE") throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "workspace lease must be ACTIVE and have WORKSPACE resource type");
    const apply = this.connection.database.transaction(() => {
      const workspace = this.connection.database
        .prepare("SELECT 1 AS present FROM project_workspaces WHERE workspace_id = ?")
        .get(lease.resourceId) as { present?: number } | undefined;
      if (workspace?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "workspace lease resource does not exist");
      this.assertLeaseOwnerReferences(lease);
      const active = this.connection.database
        .prepare("SELECT 1 AS present FROM workspace_leases WHERE workspace_id = ? AND state = 'ACTIVE'")
        .get(lease.resourceId) as { present?: number } | undefined;
      if (active?.present === 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "workspace already has an active lease");
      this.connection.database
        .prepare("INSERT INTO workspace_leases (lease_id, workspace_id, owner_instance_id, owner_task_id, lease_type, state, lease_json, version, acquired_at, heartbeat_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
        .run(lease.leaseId, lease.resourceId, lease.ownerInstanceId, lease.ownerTaskId ?? null, lease.leaseType, lease.state, JSON.stringify(lease), lease.acquiredAt, lease.heartbeatAt);
      return { leaseId: lease.leaseId, version: 1 };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "workspace lease persistence failed", { cause: error }); }
  }

  acquireResourceLease(value: unknown): LeaseWriteResult {
    const lease = validateLeaseForStorage(value);
    if (lease.state !== "ACTIVE" || lease.resourceType === "WORKSPACE") throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "resource lease must be ACTIVE and not use WORKSPACE resource type");
    const apply = this.connection.database.transaction(() => {
      this.assertLeaseOwnerReferences(lease);
      const active = this.connection.database
        .prepare("SELECT 1 AS present FROM resource_leases WHERE resource_type = ? AND resource_id = ? AND state = 'ACTIVE'")
        .get(lease.resourceType, lease.resourceId) as { present?: number } | undefined;
      if (active?.present === 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "resource already has an active lease");
      this.connection.database
        .prepare("INSERT INTO resource_leases (lease_id, resource_type, resource_id, owner_instance_id, owner_task_id, lease_type, state, lease_json, version, acquired_at, heartbeat_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
        .run(lease.leaseId, lease.resourceType, lease.resourceId, lease.ownerInstanceId, lease.ownerTaskId ?? null, lease.leaseType, lease.state, JSON.stringify(lease), lease.acquiredAt, lease.heartbeatAt);
      return { leaseId: lease.leaseId, version: 1 };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "resource lease persistence failed", { cause: error }); }
  }

  private assertLeaseOwnerReferences(lease: LeaseRecord): void {
    if (lease.ownerTaskId === undefined) {
      if (lease.ownerAttemptId !== undefined) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "lease attempt owner requires a task owner");
      return;
    }
    const task = this.connection.database
      .prepare("SELECT 1 AS present FROM tasks WHERE task_id = ?")
      .get(lease.ownerTaskId) as { present?: number } | undefined;
    if (task?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "lease owner task does not exist");
    if (lease.ownerAttemptId !== undefined) {
      const attempt = this.connection.database
        .prepare("SELECT 1 AS present FROM task_attempts WHERE attempt_id = ? AND task_id = ?")
        .get(lease.ownerAttemptId, lease.ownerTaskId) as { present?: number } | undefined;
      if (attempt?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "lease owner attempt is missing or outside its task");
    }
  }

  putProviderProfile(profileValue: unknown, policyValue: unknown, now: string): ProviderStateWriteResult {
    const profile = validateProviderProfileForStorage(profileValue);
    const policy = validateProviderPolicyForStorage(policyValue);
    if (policy.providerId !== profile.providerId || policy.adapterVersion !== profile.adapterVersion) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider profile and compatibility policy identity disagree");
    assertPlatformStateTimestamp(now);
    const profileId = `${profile.providerId}:${profile.modelId ?? "default"}`;
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database.prepare("SELECT version FROM provider_profiles WHERE profile_id = ?").get(profileId) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      const providerJson = JSON.stringify({ providerId: profile.providerId, adapterType: profile.adapterType, adapterVersion: profile.adapterVersion });
      if (!this.connection.database.prepare("SELECT 1 AS present FROM providers WHERE provider_id = ?").get(profile.providerId)) {
        this.connection.database.prepare("INSERT INTO providers (provider_id, provider_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run(profile.providerId, providerJson, now, now);
      }
      const payload = JSON.stringify({ profile, compatibilityPolicy: policy });
      if (existing) this.connection.database.prepare("UPDATE provider_profiles SET profile_json = ?, version = ?, updated_at = ? WHERE profile_id = ? AND version = ?").run(payload, version, now, profileId, existing.version);
      else this.connection.database.prepare("INSERT INTO provider_profiles (profile_id, provider_id, profile_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(profileId, profile.providerId, payload, version, now, now);
      const setupRow = this.connection.database.prepare("SELECT version, setup_json FROM provider_setup_state WHERE provider_id = ?").get(profile.providerId) as { version?: number; setup_json?: string } | undefined;
      if (setupRow?.setup_json) {
        const priorSetup = validateProviderSetupForStorage(JSON.parse(setupRow.setup_json));
        const providerVersionChanged = priorSetup.providerVersion !== profile.providerVersion;
        const adapterVersionChanged = priorSetup.adapterVersion !== profile.adapterVersion;
        if (providerVersionChanged || adapterVersionChanged) {
          const { lastAttemptAt: _lastAttemptAt, sanitizedFailureReason: _sanitizedFailureReason, lastVerifiedAt: _lastVerifiedAt, conformanceEvidenceRef: _conformanceEvidenceRef, ...stableSetup } = priorSetup;
          const invalidatedSetup = {
            ...stableSetup,
            adapterVersion: profile.adapterVersion,
            ...(profile.providerVersion === undefined ? {} : { providerVersion: profile.providerVersion }),
            state: "SETUP_REQUIRED" as const,
            lastAttemptOutcome: "PROVIDER_UPDATED",
          } satisfies ProviderSetupRecord;
          const setupVersion = (setupRow.version ?? 0) + 1;
          this.connection.database.prepare("UPDATE provider_setup_state SET state = ?, setup_json = ?, version = ?, updated_at = ? WHERE provider_id = ? AND version = ?").run(invalidatedSetup.state, JSON.stringify(invalidatedSetup), setupVersion, now, profile.providerId, setupRow.version);
        }
      }
      return { id: profileId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "provider profile persistence failed", { cause: error }); }
  }

  putProviderSetupState(value: unknown, now: string): ProviderStateWriteResult {
    const setup = validateProviderSetupForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const provider = this.connection.database.prepare("SELECT 1 AS present FROM providers WHERE provider_id = ?").get(setup.providerId) as { present?: number } | undefined;
      if (provider?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider setup state references an unknown provider");
      const existing = this.connection.database.prepare("SELECT version, setup_json FROM provider_setup_state WHERE provider_id = ?").get(setup.providerId) as { version?: number; setup_json?: string } | undefined;
      if (existing?.setup_json) {
        const prior = JSON.parse(existing.setup_json) as ProviderSetupRecord;
        if (prior.adapterVersion !== setup.adapterVersion && setup.state === "SETUP_READY") throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider version change cannot retain SETUP_READY without requalification");
      }
      const version = (existing?.version ?? 0) + 1;
      if (existing) this.connection.database.prepare("UPDATE provider_setup_state SET state = ?, setup_json = ?, version = ?, updated_at = ? WHERE provider_id = ? AND version = ?").run(setup.state, JSON.stringify(setup), version, now, setup.providerId, existing.version);
      else this.connection.database.prepare("INSERT INTO provider_setup_state (provider_id, state, setup_json, version, updated_at) VALUES (?, ?, ?, ?, ?)").run(setup.providerId, setup.state, JSON.stringify(setup), version, now);
      return { id: setup.providerId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "provider setup persistence failed", { cause: error }); }
  }

  ensureProviderSetupState(value: unknown, now: string): ProviderStateWriteResult | undefined {
    const setup = validateProviderSetupForStorage(value);
    assertPlatformStateTimestamp(now);
    const existing = this.connection.database.prepare("SELECT version FROM provider_setup_state WHERE provider_id = ?").get(setup.providerId) as { version?: number } | undefined;
    if (existing) return undefined;
    const provider = this.connection.database.prepare("SELECT 1 AS present FROM providers WHERE provider_id = ?").get(setup.providerId) as { present?: number } | undefined;
    if (provider?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider setup state references an unknown provider");
    this.connection.database.prepare("INSERT INTO provider_setup_state (provider_id, state, setup_json, version, updated_at) VALUES (?, ?, ?, 1, ?)").run(setup.providerId, setup.state, JSON.stringify(setup), now);
    return { id: setup.providerId, version: 1 };
  }

  transitionProviderSetupState(providerId: string, action: ProviderSetupWorkflowAction, now: string, expectedVersion: number): ProviderStateWriteResult {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider setup expected version is invalid");
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const row = this.connection.database.prepare("SELECT version, setup_json FROM provider_setup_state WHERE provider_id = ?").get(providerId) as { version?: number; setup_json?: string } | undefined;
      if (row?.version !== expectedVersion || !row.setup_json) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider setup state version is stale or missing");
      const current = validateProviderSetupForStorage(JSON.parse(row.setup_json));
      let transition;
      try {
        transition = advanceProviderSetupState(current.state, action);
      } catch (error) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider setup state transition is not permitted", { cause: error });
      }
      const { lastAttemptAt: _lastAttemptAt, sanitizedFailureReason: _sanitizedFailureReason, lastVerifiedAt: _lastVerifiedAt, conformanceEvidenceRef: _conformanceEvidenceRef, ...stable } = current;
      const next: ProviderSetupRecord = {
        ...stable,
        state: transition.nextState,
        ...(action === "AUTHENTICATED_USER_START" ? { lastAttemptAt: now, lastAttemptOutcome: action } : {}),
        ...(action === "HELPER_EXITED" ? { lastAttemptOutcome: action } : {}),
        ...(action === "SETUP_PROBE_PASSED" ? { lastAttemptOutcome: action, lastVerifiedAt: now } : {}),
        ...(action === "SETUP_PROBE_FAILED" || action === "CANCELLED" ? { lastAttemptOutcome: action, sanitizedFailureReason: "setup did not complete successfully" } : {}),
        ...(action === "PROVIDER_UPDATED" ? { lastAttemptOutcome: action } : {}),
      };
      const version = expectedVersion + 1;
      const result = this.connection.database.prepare("UPDATE provider_setup_state SET state = ?, setup_json = ?, version = ?, updated_at = ? WHERE provider_id = ? AND version = ?").run(next.state, JSON.stringify(next), version, now, providerId, expectedVersion);
      if (result.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider setup state changed during transition");
      return { id: providerId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "provider setup transition failed", { cause: error }); }
  }

  beginProviderSetup(providerId: string, distributionId: string, adapterVersion: string, now: string): ProviderStateWriteResult {
    assertPlatformStateTimestamp(now);
    const row = this.connection.database.prepare("SELECT version, setup_json FROM provider_setup_state WHERE provider_id = ?").get(providerId) as { version?: number; setup_json?: string } | undefined;
    const version = row?.version;
    if (!row?.setup_json || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider setup state is missing");
    if (!Number.isSafeInteger(version) || version < 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider setup version is invalid");
    const current = validateProviderSetupForStorage(JSON.parse(row.setup_json));
    if (current.distributionId !== distributionId || current.adapterVersion !== adapterVersion) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider setup identity is stale");
    return this.transitionProviderSetupState(providerId, "AUTHENTICATED_USER_START", now, version);
  }

  completeProviderSetup(providerId: string, now: string): ProviderStateWriteResult {
    assertPlatformStateTimestamp(now);
    const row = this.connection.database.prepare("SELECT version FROM provider_setup_state WHERE provider_id = ?").get(providerId) as { version?: number } | undefined;
    const version = row?.version;
    if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider setup state is missing");
    return this.transitionProviderSetupState(providerId, "SETUP_PROBE_PASSED", now, version);
  }

  failProviderSetup(providerId: string, now: string): ProviderStateWriteResult {
    assertPlatformStateTimestamp(now);
    const row = this.connection.database.prepare("SELECT version FROM provider_setup_state WHERE provider_id = ?").get(providerId) as { version?: number } | undefined;
    const version = row?.version;
    if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "provider setup state is missing");
    return this.transitionProviderSetupState(providerId, "SETUP_PROBE_FAILED", now, version);
  }

  listProviderSetupStates(): readonly ProviderSetupRecord[] {
    const rows = this.connection.database
      .prepare("SELECT setup_json FROM provider_setup_state ORDER BY provider_id ASC")
      .all() as readonly { setup_json?: string }[];
    return rows.map((row) => {
      if (typeof row.setup_json !== "string") throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider setup state payload is missing");
      return validateProviderSetupForStorage(JSON.parse(row.setup_json));
    });
  }

  putProviderQualificationState(value: unknown, now: string): ProviderStateWriteResult {
    const qualification = validateProviderQualificationForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const provider = this.connection.database.prepare("SELECT 1 AS present FROM providers WHERE provider_id = ?").get(qualification.providerId) as { present?: number } | undefined;
      if (provider?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "provider qualification references an unknown provider");
      const existing = this.connection.database.prepare("SELECT version FROM provider_qualification_state WHERE provider_id = ?").get(qualification.providerId) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      if (existing) this.connection.database.prepare("UPDATE provider_qualification_state SET state = ?, qualification_json = ?, version = ?, updated_at = ? WHERE provider_id = ? AND version = ?").run(qualification.state, JSON.stringify(qualification), version, now, qualification.providerId, existing.version);
      else this.connection.database.prepare("INSERT INTO provider_qualification_state (provider_id, state, qualification_json, version, updated_at) VALUES (?, ?, ?, ?, ?)").run(qualification.providerId, qualification.state, JSON.stringify(qualification), version, now);
      return { id: qualification.providerId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "provider qualification persistence failed", { cause: error }); }
  }

  putModuleManifest(value: unknown, now: string): ProviderStateWriteResult {
    const manifest = validateModuleForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database.prepare("SELECT version FROM modules WHERE module_id = ?").get(manifest.moduleId) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      const payload = JSON.stringify(manifest);
      if (existing) this.connection.database.prepare("UPDATE modules SET module_json = ?, version = ?, updated_at = ? WHERE module_id = ? AND version = ?").run(payload, version, now, manifest.moduleId, existing.version);
      else this.connection.database.prepare("INSERT INTO modules (module_id, module_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(manifest.moduleId, payload, version, now, now);
      const moduleVersionId = `${manifest.moduleId}:${manifest.version}`;
      const moduleVersion = this.connection.database.prepare("SELECT 1 AS present FROM module_versions WHERE module_version_id = ?").get(moduleVersionId) as { present?: number } | undefined;
      if (!moduleVersion) this.connection.database.prepare("INSERT INTO module_versions (module_version_id, module_id, version_label, version_json, created_at) VALUES (?, ?, ?, ?, ?)").run(moduleVersionId, manifest.moduleId, manifest.version, payload, now);
      const catalog = this.connection.database.prepare("SELECT catalog_entry_id FROM module_catalog_entries WHERE module_id = ?").get(manifest.moduleId) as { catalog_entry_id?: string } | undefined;
      if (catalog?.catalog_entry_id) this.connection.database.prepare("UPDATE module_catalog_entries SET entry_json = ?, version = version + 1, updated_at = ? WHERE catalog_entry_id = ?").run(JSON.stringify(manifest.integrity), now, catalog.catalog_entry_id);
      else this.connection.database.prepare("INSERT INTO module_catalog_entries (catalog_entry_id, module_id, entry_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(manifest.integrity.catalogEntryId, manifest.moduleId, JSON.stringify(manifest.integrity), now, now);
      return { id: manifest.moduleId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "module manifest persistence failed", { cause: error }); }
  }

  putIntegrationAccount(value: unknown, now: string): ProviderStateWriteResult {
    const account = validateIntegrationForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database.prepare("SELECT version FROM integration_account_state WHERE account_id = ?").get(account.accountId) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      const legacyState = account.status === "REAUTH_REQUIRED" ? "REAUTH_REQUIRED" : "ACTIVE";
      const legacy = this.connection.database.prepare("SELECT version FROM integration_accounts WHERE integration_account_id = ?").get(account.accountId) as { version?: number } | undefined;
      if (legacy) this.connection.database.prepare("UPDATE integration_accounts SET provider_id = ?, account_label = ?, credential_handle = ?, state = ?, version = ?, updated_at = ? WHERE integration_account_id = ? AND version = ?").run(account.integrationId, account.displayName, account.credentialHandle, legacyState, (legacy.version ?? 0) + 1, now, account.accountId, legacy.version);
      else this.connection.database.prepare("INSERT INTO integration_accounts (integration_account_id, provider_id, account_label, credential_handle, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)").run(account.accountId, account.integrationId, account.displayName, account.credentialHandle, legacyState, now, now);
      const payload = JSON.stringify(account);
      if (existing) this.connection.database.prepare("UPDATE integration_account_state SET integration_json = ?, status = ?, version = ?, updated_at = ? WHERE account_id = ? AND version = ?").run(payload, account.status, version, now, account.accountId, existing.version);
      else this.connection.database.prepare("INSERT INTO integration_account_state (account_id, integration_json, status, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(account.accountId, payload, account.status, now, now);
      this.connection.database.prepare("DELETE FROM integration_capabilities WHERE integration_account_id = ?").run(account.accountId);
      for (const capability of account.enabledCapabilities) this.connection.database.prepare("INSERT INTO integration_capabilities (capability_id, integration_account_id, capability_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(`${account.accountId}:${capability}`, account.accountId, JSON.stringify({ capability, grantedScopes: account.grantedScopes }), now, now);
      return { id: account.accountId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "integration account persistence failed", { cause: error }); }
  }

  putProxmoxConnection(value: unknown, now: string): ProviderStateWriteResult {
    const connection = validateProxmoxForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database.prepare("SELECT version FROM proxmox_connections WHERE connection_id = ?").get(connection.connectionId) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      if (existing) this.connection.database.prepare("UPDATE proxmox_connections SET connection_json = ?, state = ?, version = ?, updated_at = ? WHERE connection_id = ? AND version = ?").run(JSON.stringify(connection), connection.status, version, now, connection.connectionId, existing.version);
      else this.connection.database.prepare("INSERT INTO proxmox_connections (connection_id, connection_json, state, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(connection.connectionId, JSON.stringify(connection), connection.status, now, now);
      return { id: connection.connectionId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "Proxmox connection persistence failed", { cause: error }); }
  }

  putProject(value: unknown, now: string): ProviderStateWriteResult {
    const project = validateProjectForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database.prepare("SELECT project_json, version FROM projects WHERE project_id = ?").get(project.projectId) as { project_json?: string; version?: number } | undefined;
      if (existing?.project_json !== undefined) {
        const prior = validateProjectForStorage(JSON.parse(existing.project_json));
        if (prior.canonicalIdentity !== project.canonicalIdentity || prior.canonicalRoot.platform !== project.canonicalRoot.platform || prior.canonicalRoot.value !== project.canonicalRoot.value) {
          throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project canonical identity cannot move");
        }
      }
      const collisionRows = this.connection.database.prepare("SELECT project_id, project_json FROM projects WHERE project_id <> ?").all(project.projectId) as Array<{ project_id?: string; project_json?: string }>;
      for (const row of collisionRows) {
        if (row.project_json === undefined) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored project identity is missing");
        const prior = validateProjectForStorage(JSON.parse(row.project_json));
        if (prior.canonicalIdentity === project.canonicalIdentity || (prior.canonicalRoot.platform === project.canonicalRoot.platform && prior.canonicalRoot.value === project.canonicalRoot.value)) {
          throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project canonical identity is already registered");
        }
      }
      const version = (existing?.version ?? 0) + 1;
      const payload = JSON.stringify(project);
      if (existing) {
        const result = this.connection.database.prepare("UPDATE projects SET project_json = ?, version = ?, updated_at = ? WHERE project_id = ? AND version = ?").run(payload, version, now, project.projectId, existing.version);
        if (result.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project update lost its version precondition");
      } else {
        this.connection.database.prepare("INSERT INTO projects (project_id, project_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run(project.projectId, payload, now, now);
      }
      return { id: project.projectId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "project persistence failed", { cause: error }); }
  }

  putProjectAlias(value: unknown, now: string): ProviderStateWriteResult {
    const alias = validateProjectAliasForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const project = this.connection.database.prepare("SELECT 1 AS present FROM projects WHERE project_id = ?").get(alias.projectId) as { present?: number } | undefined;
      if (project?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project alias references an unknown project");
      const existing = this.connection.database.prepare("SELECT project_id, version FROM project_aliases WHERE alias = ?").get(alias.alias) as { project_id?: string; version?: number } | undefined;
      if (existing && existing.project_id !== alias.projectId) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project alias cannot move between projects");
      const version = (existing?.version ?? 0) + 1;
      if (existing) {
        const result = this.connection.database.prepare("UPDATE project_aliases SET project_id = ?, version = ?, updated_at = ? WHERE alias = ? AND version = ?").run(alias.projectId, version, now, alias.alias, existing.version);
        if (result.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project alias update lost its version precondition");
      } else {
        this.connection.database.prepare("INSERT INTO project_aliases (alias, project_id, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run(alias.alias, alias.projectId, now, now);
      }
      return { id: alias.alias, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "project alias persistence failed", { cause: error }); }
  }

  putProjectEnvironment(value: unknown, now: string): ProviderStateWriteResult {
    const environment = validateProjectEnvironmentForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const project = this.connection.database.prepare("SELECT 1 AS present FROM projects WHERE project_id = ?").get(environment.projectId) as { present?: number } | undefined;
      if (project?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project environment references an unknown project");
      const existing = this.connection.database.prepare("SELECT project_id, version FROM project_environments WHERE environment_id = ?").get(environment.environmentId) as { project_id?: string; version?: number } | undefined;
      if (existing && existing.project_id !== environment.projectId) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project environment cannot move between projects");
      const version = (existing?.version ?? 0) + 1;
      const payload = JSON.stringify(environment);
      if (existing) {
        const result = this.connection.database.prepare("UPDATE project_environments SET project_id = ?, environment_json = ?, version = ?, updated_at = ? WHERE environment_id = ? AND version = ?").run(environment.projectId, payload, version, now, environment.environmentId, existing.version);
        if (result.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project environment update lost its version precondition");
      } else {
        this.connection.database.prepare("INSERT INTO project_environments (environment_id, project_id, environment_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(environment.environmentId, environment.projectId, payload, now, now);
      }
      return { id: environment.environmentId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "project environment persistence failed", { cause: error }); }
  }

  putProjectWorkspace(value: unknown, now: string): ProviderStateWriteResult {
    const workspace = validateProjectWorkspaceForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const project = this.connection.database.prepare("SELECT 1 AS present FROM projects WHERE project_id = ?").get(workspace.projectId) as { present?: number } | undefined;
      if (project?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project workspace references an unknown project");
      const existing = this.connection.database.prepare("SELECT project_id, workspace_json, version FROM project_workspaces WHERE workspace_id = ?").get(workspace.workspaceId) as { project_id?: string; workspace_json?: string; version?: number } | undefined;
      if (existing?.project_id !== undefined && existing.project_id !== workspace.projectId) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project workspace cannot move between projects");
      if (existing?.workspace_json !== undefined) {
        const prior = validateProjectWorkspaceForStorage(JSON.parse(existing.workspace_json));
        if (prior.kind !== workspace.kind || prior.canonicalRoot.platform !== workspace.canonicalRoot.platform || prior.canonicalRoot.value !== workspace.canonicalRoot.value || prior.worktreeIdentity !== workspace.worktreeIdentity) {
          throw new CoreSchemaError("PERSISTENCE_CONFLICT", "workspace canonical identity cannot move");
        }
      }
      const rows = this.connection.database.prepare("SELECT workspace_id, workspace_json FROM project_workspaces WHERE workspace_id <> ?").all(workspace.workspaceId) as Array<{ workspace_id?: string; workspace_json?: string }>;
      for (const row of rows) {
        if (row.workspace_json === undefined) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored workspace identity is missing");
        const prior = validateProjectWorkspaceForStorage(JSON.parse(row.workspace_json));
        if (prior.canonicalRoot.platform === workspace.canonicalRoot.platform && prior.canonicalRoot.value === workspace.canonicalRoot.value) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "workspace canonical path is already registered");
        if (workspace.worktreeIdentity !== undefined && prior.worktreeIdentity === workspace.worktreeIdentity) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "worktree identity is already registered");
      }
      const version = (existing?.version ?? 0) + 1;
      const payload = JSON.stringify(workspace);
      if (existing) {
        const result = this.connection.database.prepare("UPDATE project_workspaces SET project_id = ?, workspace_json = ?, version = ?, updated_at = ? WHERE workspace_id = ? AND version = ?").run(workspace.projectId, payload, version, now, workspace.workspaceId, existing.version);
        if (result.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project workspace update lost its version precondition");
      } else {
        this.connection.database.prepare("INSERT INTO project_workspaces (workspace_id, project_id, workspace_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(workspace.workspaceId, workspace.projectId, payload, now, now);
      }
      return { id: workspace.workspaceId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "project workspace persistence failed", { cause: error }); }
  }

  putProjectPolicyTrustRecord(value: unknown, now: string): ProviderStateWriteResult {
    const candidate = validatePolicyTrustForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const project = this.connection.database.prepare("SELECT 1 AS present FROM projects WHERE project_id = ?").get(candidate.projectId) as { present?: number } | undefined;
      if (project?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "policy trust record references an unknown project");
      const existing = this.connection.database.prepare("SELECT revision, policy_json FROM project_policy_trust_records WHERE policy_trust_id = ?").get(candidate.policyTrustId) as { revision?: number; policy_json?: string } | undefined;
      if (existing?.policy_json) {
        const prior = validatePolicyTrustForStorage(JSON.parse(existing.policy_json));
        if (prior.projectId !== candidate.projectId) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "policy trust identity cannot move between projects");
        if (candidate.revision !== (existing.revision ?? 0) + 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "policy trust revision is stale or non-monotonic");
        const identityChanged = prior.canonicalRelativePath !== candidate.canonicalRelativePath || prior.canonicalScopeRoot !== candidate.canonicalScopeRoot;
        const provenanceChanged = prior.gitBlobOid !== candidate.gitBlobOid || prior.sourceCommit !== candidate.sourceCommit;
        if (prior.state === "TRUSTED" && candidate.state === "TRUSTED" && (identityChanged || provenanceChanged || prior.contentSha256 !== candidate.contentSha256)) {
          const changed = { ...candidate, state: "CHANGED_REVIEW_REQUIRED" as const };
          const changedJson = JSON.stringify(changed);
          this.connection.database.prepare("UPDATE project_policy_trust_records SET state = ?, policy_json = ?, revision = ?, updated_at = ? WHERE policy_trust_id = ? AND revision = ?").run(changed.state, changedJson, changed.revision, now, candidate.policyTrustId, existing.revision);
          return { id: candidate.policyTrustId, version: changed.revision };
        }
        if (identityChanged) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "policy trust identity cannot move outside the changed-review transition");
      } else if (candidate.revision !== 1) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "new policy trust records must begin at revision one");
      }
      const payload = JSON.stringify(candidate);
      if (existing) this.connection.database.prepare("UPDATE project_policy_trust_records SET state = ?, policy_json = ?, revision = ?, updated_at = ? WHERE policy_trust_id = ? AND revision = ?").run(candidate.state, payload, candidate.revision, now, candidate.policyTrustId, existing.revision);
      else this.connection.database.prepare("INSERT INTO project_policy_trust_records (policy_trust_id, project_id, state, policy_json, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(candidate.policyTrustId, candidate.projectId, candidate.state, payload, candidate.revision, now, now);
      return { id: candidate.policyTrustId, version: candidate.revision };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "project policy trust persistence failed", { cause: error }); }
  }

  registerProjectPolicyCandidate(value: unknown, now: string): ProviderStateWriteResult {
    const candidate = validatePolicyTrustForStorage(value);
    if (candidate.state !== "UNTRUSTED_CANDIDATE" || candidate.revision !== 1) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "new project policy candidates must begin untrusted at revision one");
    }
    const existing = this.connection.database
      .prepare("SELECT policy_json, revision FROM project_policy_trust_records WHERE policy_trust_id = ?")
      .get(candidate.policyTrustId) as { policy_json?: string; revision?: number } | undefined;
    if (existing?.policy_json !== undefined) {
      const prior = validatePolicyTrustForStorage(JSON.parse(existing.policy_json));
      if (prior.projectId !== candidate.projectId || prior.canonicalRelativePath !== candidate.canonicalRelativePath || prior.canonicalScopeRoot !== candidate.canonicalScopeRoot) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project policy candidate identity cannot move");
      }
      if (prior.contentSha256 === candidate.contentSha256 && prior.state === "UNTRUSTED_CANDIDATE" && existing.revision === 1) {
        return { id: candidate.policyTrustId, version: 1 };
      }
      throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project policy candidate already has a different authoritative state or content");
    }
    return this.putProjectPolicyTrustRecord(candidate, now);
  }

  decideProjectPolicyTrust(requestValue: unknown): ProviderStateWriteResult {
    const request = validatePolicyDecisionForStorage(requestValue);
    assertPlatformStateTimestamp(request.now);
    const targetState = request.decision === "TRUST" ? "TRUSTED" : request.decision === "DISABLE" ? "DISABLED_BY_USER" : "REVOKED";
    const apply = this.connection.database.transaction(() => {
      const sessionRow = this.connection.database
        .prepare("SELECT state_json FROM session_security_state WHERE state_id = ?")
        .get(SESSION_SECURITY_STATE_ID) as { state_json?: string } | undefined;
      if (!sessionRow?.state_json) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "an unlocked JARVIS session is required for project-policy decisions");
      const session = validateSessionSecurityStateForStorage(JSON.parse(sessionRow.state_json));
      if (session.userId !== request.userId || session.state !== "UNLOCKED" || session.sessionId !== request.sessionId) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "an unlocked authenticated session is required for project-policy decisions");
      }
      const row = this.connection.database
        .prepare("SELECT project_id, policy_json, revision FROM project_policy_trust_records WHERE policy_trust_id = ?")
        .get(request.policyTrustId) as { project_id?: string; policy_json?: string; revision?: number } | undefined;
      if (!row?.policy_json || !Number.isSafeInteger(row.revision)) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project policy trust record does not exist");
      if (row.revision !== request.expectedRevision) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project policy trust record revision is stale");
      const prior = validatePolicyTrustForStorage(JSON.parse(row.policy_json));
      if (request.decision === "TRUST" && prior.state !== "UNTRUSTED_CANDIDATE" && prior.state !== "CHANGED_REVIEW_REQUIRED") {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "only an untrusted or changed project policy may be explicitly trusted");
      }
      const next = validatePolicyTrustForStorage({
        ...prior,
        state: targetState,
        ...(request.decision === "TRUST" ? { acceptedAt: request.now, acceptedSessionId: request.sessionId } : {}),
        revision: request.expectedRevision + 1,
      });
      const payload = JSON.stringify(next);
      const updated = this.connection.database
        .prepare("UPDATE project_policy_trust_records SET state = ?, policy_json = ?, revision = ?, updated_at = ? WHERE policy_trust_id = ? AND revision = ?")
        .run(next.state, payload, next.revision, request.now, request.policyTrustId, request.expectedRevision);
      if (updated.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project policy decision lost its revision race");
      const evidence = JSON.stringify({ policyTrustId: next.policyTrustId, projectId: next.projectId, fromState: prior.state, toState: next.state, revision: next.revision, sessionId: request.sessionId });
      this.connection.database
        .prepare("INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(`project-policy:${next.policyTrustId}:${next.revision}`, "PROJECT_POLICY_DECISION", "PROJECT_POLICY_TRUST", next.policyTrustId, next.revision, evidence, request.sessionId, request.now);
      this.connection.database
        .prepare("INSERT INTO audit_events (audit_event_id, event_type, subject_type, subject_id, audit_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(`project-policy:${next.policyTrustId}:${next.revision}`, "PROJECT_POLICY_DECISION", "PROJECT_POLICY_TRUST", next.policyTrustId, evidence, request.now);
      return { id: next.policyTrustId, version: next.revision };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "project policy decision persistence failed", { cause: error }); }
  }

  assertProjectPolicyMutationAllowed(projectIdValue: unknown, consequential: boolean): ProjectPolicyMutationGateResult {
    const projectId = validatePlatformIdentifierForStorage(projectIdValue);
    if (typeof consequential !== "boolean") throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project policy mutation consequence flag is invalid");
    const project = this.connection.database.prepare("SELECT 1 AS present FROM projects WHERE project_id = ?").get(projectId) as { present?: number } | undefined;
    if (project?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project policy mutation references an unknown project");
    const rows = this.connection.database.prepare("SELECT policy_json FROM project_policy_trust_records WHERE project_id = ? ORDER BY policy_trust_id").all(projectId) as Array<{ policy_json?: string }>;
    const states = rows.map((row) => {
      if (row.policy_json === undefined) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored project policy trust record is missing");
      return validatePolicyTrustForStorage(JSON.parse(row.policy_json)).state;
    });
    const observedState = states.find((state) => state !== "TRUSTED" && state !== "DISABLED_BY_USER") ?? (states.includes("TRUSTED") ? "TRUSTED" : states[0]);
    const gate = evaluateProjectPolicyMutationGate(observedState, consequential);
    if (gate.status === "PROJECT_POLICY_DECISION_REQUIRED") {
      throw new CoreSchemaError("PROJECT_POLICY_DECISION_REQUIRED", "consequential project mutation requires an explicit project-policy decision");
    }
    return gate;
  }

  authorizeProjectPolicyMutation(value: unknown): PermissionDecision {
    const request = validateProjectPolicyMutationAdmission(value);
    const row = this.connection.database.prepare("SELECT * FROM project_policy_trust_records WHERE policy_trust_id = ?").get(request.target.policyTrustId) as Record<string, unknown> | undefined;
    if (row === undefined) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project-policy mutation references an unknown trust record");
    const stored = validatePolicyTrustForStorage(row);
    if (stored.projectId !== request.target.projectId || stored.canonicalRelativePath !== request.target.canonicalRelativePath) {
      throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project-policy mutation target does not match the enrolled policy identity");
    }
    if (stored.state !== "TRUSTED") throw new CoreSchemaError("PROJECT_POLICY_DECISION_REQUIRED", "project-policy mutation requires a currently trusted policy");
    return evaluateProjectPolicyMutation(request);
  }

  getApplicableProjectPolicies(projectIdValue: unknown, targetCanonicalPath: unknown): readonly ProjectPolicyTrustRecord[] {
    const projectId = validatePlatformIdentifierForStorage(projectIdValue);
    const target = typeof targetCanonicalPath === "string" ? targetCanonicalPath : "";
    const project = this.connection.database.prepare("SELECT 1 AS present FROM projects WHERE project_id = ?").get(projectId) as { present?: number } | undefined;
    if (project?.present !== 1) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "policy applicability references an unknown project");
    const rows = this.connection.database.prepare("SELECT policy_json FROM project_policy_trust_records WHERE project_id = ? ORDER BY policy_trust_id").all(projectId) as Array<{ policy_json?: string }>;
    try {
      return resolveApplicableTrustedProjectPolicies(rows.map((row) => JSON.parse(row.policy_json ?? "")), target);
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project policy applicability is invalid or ambiguous", { cause: error });
    }
  }

  createProjectPolicySnapshot(value: unknown): PolicySnapshotWriteResult {
    const snapshot = validatePolicySnapshotForStorage(value);
    const apply = this.connection.database.transaction(() => {
      const attempt = this.connection.database.prepare("SELECT task_id FROM task_attempts WHERE attempt_id = ?").get(snapshot.attemptId) as { task_id?: string } | undefined;
      if (!attempt) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "policy snapshot attempt does not exist");
      const existing = this.connection.database.prepare("SELECT 1 AS present FROM project_policy_snapshots WHERE attempt_id = ?").get(snapshot.attemptId) as { present?: number } | undefined;
      if (existing?.present === 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "an attempt may have only one immutable policy snapshot");
      for (const policy of snapshot.policies) {
        const row = this.connection.database.prepare("SELECT policy_json, state, revision FROM project_policy_trust_records WHERE policy_trust_id = ? AND project_id = ?").get(policy.policyTrustId, snapshot.projectId) as { policy_json?: string; state?: string; revision?: number } | undefined;
        if (!row || row.state !== "TRUSTED") throw new CoreSchemaError("PERSISTENCE_CONFLICT", "only currently trusted policy records may enter a new snapshot");
        const record = validatePolicyTrustForStorage(JSON.parse(row.policy_json ?? ""));
        if (record.revision !== policy.revision || record.contentSha256 !== policy.contentSha256) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "policy snapshot observed stale trust-record identity");
      }
      this.connection.database.prepare("INSERT INTO project_policy_snapshots (snapshot_id, project_id, attempt_id, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)").run(snapshot.snapshotId, snapshot.projectId, snapshot.attemptId, JSON.stringify(snapshot), snapshot.createdAt);
      return { snapshotId: snapshot.snapshotId, attemptId: snapshot.attemptId };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "project policy snapshot persistence failed", { cause: error }); }
  }

  revalidateProjectPolicySnapshot(value: unknown): ProjectPolicySnapshotRevalidationRequest {
    const request = validateProjectPolicySnapshotRevalidationRequest(value);
    const row = this.connection.database.prepare("SELECT snapshot_json FROM project_policy_snapshots WHERE snapshot_id = ? AND project_id = ? AND attempt_id = ?").get(request.snapshotId, request.projectId, request.attemptId) as { snapshot_json?: string } | undefined;
    if (!row?.snapshot_json) throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "project policy snapshot does not exist for the requested attempt");
    const snapshot = validatePolicySnapshotForStorage(JSON.parse(row.snapshot_json));
    for (const policy of snapshot.policies) {
      const current = this.connection.database.prepare("SELECT policy_json, state FROM project_policy_trust_records WHERE policy_trust_id = ? AND project_id = ?").get(policy.policyTrustId, snapshot.projectId) as { policy_json?: string; state?: string } | undefined;
      if (!current?.policy_json || current.state !== "TRUSTED") throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project policy snapshot requires revalidation after trust-state change");
      const record = validatePolicyTrustForStorage(JSON.parse(current.policy_json));
      if (record.revision !== policy.revision || record.contentSha256 !== policy.contentSha256) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "project policy snapshot requires revalidation after trust-identity change");
    }
    return request;
  }

  putTrustedUpdateMetadata(value: unknown, now: string): ProviderStateWriteResult {
    const metadata = validateTrustedMetadataForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const prior = this.connection.database.prepare("SELECT metadata_version, trusted_root_version, minimum_security_epoch FROM trusted_update_metadata ORDER BY version DESC LIMIT 1").get() as { metadata_version?: string; trusted_root_version?: string; minimum_security_epoch?: string } | undefined;
      if (prior && (BigInt(metadata.metadataVersion) < BigInt(prior.metadata_version ?? "0") || BigInt(metadata.trustedRootVersion) < BigInt(prior.trusted_root_version ?? "0") || BigInt(metadata.minimumSecurityEpoch) < BigInt(prior.minimum_security_epoch ?? "0"))) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "trusted update metadata rollback floor would decrease");
      const existing = this.connection.database.prepare("SELECT version FROM trusted_update_metadata WHERE metadata_id = ?").get(metadata.metadataId) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      if (existing) this.connection.database.prepare("UPDATE trusted_update_metadata SET metadata_json = ?, metadata_version = ?, metadata_sha256 = ?, trusted_root_version = ?, minimum_security_epoch = ?, state = ?, version = ?, updated_at = ? WHERE metadata_id = ? AND version = ?").run(JSON.stringify(metadata), metadata.metadataVersion, metadata.metadataSha256, metadata.trustedRootVersion, metadata.minimumSecurityEpoch, metadata.state, version, now, metadata.metadataId, existing.version);
      else this.connection.database.prepare("INSERT INTO trusted_update_metadata (metadata_id, metadata_json, metadata_version, metadata_sha256, trusted_root_version, minimum_security_epoch, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").run(metadata.metadataId, JSON.stringify(metadata), metadata.metadataVersion, metadata.metadataSha256, metadata.trustedRootVersion, metadata.minimumSecurityEpoch, metadata.state, now, now);
      return { id: metadata.metadataId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "trusted update metadata persistence failed", { cause: error }); }
  }

  putReleaseTrustRecord(value: unknown, now: string): ProviderStateWriteResult {
    const release = validateReleaseTrustForStorage(value);
    const apply = this.connection.database.transaction(() => {
      const priorRows = this.connection.database.prepare("SELECT release_sequence, security_epoch FROM trusted_release_state").all() as Array<{ release_sequence?: string; security_epoch?: string }>;
      let highestReleaseSequence = 0n;
      let highestSecurityEpoch = 0n;
      for (const row of priorRows) {
        if (row.release_sequence !== undefined && BigInt(row.release_sequence) > highestReleaseSequence) highestReleaseSequence = BigInt(row.release_sequence);
        if (row.security_epoch !== undefined && BigInt(row.security_epoch) > highestSecurityEpoch) highestSecurityEpoch = BigInt(row.security_epoch);
      }
      if (!release.revoked && (BigInt(release.releaseSequence) < highestReleaseSequence || BigInt(release.securityEpoch) < highestSecurityEpoch)) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "release sequence or security epoch rollback is blocked");
      const existing = this.connection.database.prepare("SELECT version FROM trusted_release_state WHERE release_id = ?").get(release.releaseId) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      if (existing) this.connection.database.prepare("UPDATE trusted_release_state SET release_json = ?, release_sequence = ?, security_epoch = ?, revoked = ?, version = ?, updated_at = ? WHERE release_id = ? AND version = ?").run(JSON.stringify(release), release.releaseSequence, release.securityEpoch, release.revoked ? 1 : 0, version, now, release.releaseId, existing.version);
      else this.connection.database.prepare("INSERT INTO trusted_release_state (release_id, release_json, release_sequence, security_epoch, revoked, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)").run(release.releaseId, JSON.stringify(release), release.releaseSequence, release.securityEpoch, release.revoked ? 1 : 0, now, now);
      return { id: release.releaseId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "release trust persistence failed", { cause: error }); }
  }

  appendUpdateIncident(value: unknown): { readonly incidentId: string } {
    const incident = validateUpdateIncidentForStorage(value);
    const insert = this.connection.database.transaction(() => {
      this.connection.database.prepare("INSERT INTO update_incidents (incident_id, incident_json, reason, observed_at) VALUES (?, ?, ?, ?)").run(incident.incidentId, JSON.stringify(incident), incident.reason, incident.observedAt);
      return { incidentId: incident.incidentId };
    });
    try { return insert(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "update incident persistence failed", { cause: error }); }
  }

  putUpdateOperation(value: unknown, now: string): ProviderStateWriteResult {
    const operation = validateUpdateOperationForStorage(value);
    assertPlatformStateTimestamp(now);
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database.prepare("SELECT version, operation_json, state FROM update_operation_state WHERE operation_id = ?").get(operation.operationId) as { version?: number; operation_json?: string; state?: string } | undefined;
      if (existing?.state === "COMMITTED" && operation.state !== "COMMITTED") throw new CoreSchemaError("PERSISTENCE_CONFLICT", "committed update operation cannot regress");
      const version = (existing?.version ?? 0) + 1;
      if (existing) this.connection.database.prepare("UPDATE update_operation_state SET operation_json = ?, kind = ?, state = ?, version = ?, updated_at = ? WHERE operation_id = ? AND version = ?").run(JSON.stringify(operation), operation.kind, operation.state, version, now, operation.operationId, existing.version);
      else this.connection.database.prepare("INSERT INTO update_operation_state (operation_id, operation_json, kind, state, version, started_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(operation.operationId, JSON.stringify(operation), operation.kind, operation.state, operation.startedAt, now);
      return { id: operation.operationId, version };
    });
    try { return apply(); } catch (error) { if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error; throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "update operation persistence failed", { cause: error }); }
  }

  putPlatformRuntimeIdentity(
    identityId: unknown,
    identity: unknown,
    now: string,
  ): PlatformStateWriteResult {
    const id = validatePlatformIdentifierForStorage(identityId);
    const validated = validatePlatformRuntimeForStorage(identity);
    assertPlatformStateTimestamp(now);
    const write = this.connection.database.transaction(() => {
      const existing = this.connection.database
        .prepare("SELECT version FROM platform_runtime_identities WHERE identity_id = ?")
        .get(id) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      if (existing) {
        this.connection.database
          .prepare(
            "UPDATE platform_runtime_identities SET platform = ?, runtime_role = ?, architecture = ?, backend_profile_id = ?, identity_json = ?, version = ?, updated_at = ? WHERE identity_id = ? AND version = ?",
          )
          .run(
            validated.platform,
            validated.runtimeRole,
            validated.architecture,
            validated.backendProfileId,
            JSON.stringify(validated),
            version,
            now,
            id,
            existing.version,
          );
      } else {
        this.connection.database
          .prepare(
            "INSERT INTO platform_runtime_identities (identity_id, platform, runtime_role, architecture, backend_profile_id, identity_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            id,
            validated.platform,
            validated.runtimeRole,
            validated.architecture,
            validated.backendProfileId,
            JSON.stringify(validated),
            version,
            now,
            now,
          );
      }
      return { id, version };
    });
    return write();
  }

  putPlatformCompatibility(
    compatibilityId: unknown,
    compatibility: unknown,
    now: string,
  ): PlatformStateWriteResult {
    const id = validatePlatformIdentifierForStorage(compatibilityId);
    const validated = validatePlatformCompatibilityForStorage(compatibility);
    assertPlatformStateTimestamp(now);
    const write = this.connection.database.transaction(() => {
      const existing = this.connection.database
        .prepare("SELECT version FROM platform_compatibility_records WHERE compatibility_id = ?")
        .get(id) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      const runtimeRolesJson = JSON.stringify(validated.runtimeRoles);
      const architecturesJson = validated.architecture === undefined ? null : JSON.stringify(validated.architecture);
      if (existing) {
        this.connection.database
          .prepare(
            "UPDATE platform_compatibility_records SET platform = ?, runtime_roles_json = ?, os_version_range = ?, architectures_json = ?, compatibility_json = ?, version = ?, updated_at = ? WHERE compatibility_id = ? AND version = ?",
          )
          .run(
            validated.platform,
            runtimeRolesJson,
            validated.osVersionRange ?? null,
            architecturesJson,
            JSON.stringify(validated),
            version,
            now,
            id,
            existing.version,
          );
      } else {
        this.connection.database
          .prepare(
            "INSERT INTO platform_compatibility_records (compatibility_id, platform, runtime_roles_json, os_version_range, architectures_json, compatibility_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            id,
            validated.platform,
            runtimeRolesJson,
            validated.osVersionRange ?? null,
            architecturesJson,
            JSON.stringify(validated),
            version,
            now,
            now,
          );
      }
      return { id, version };
    });
    return write();
  }

  putPlatformPathRef(pathRefId: unknown, pathRef: unknown, now: string): PlatformStateWriteResult {
    const id = validatePlatformIdentifierForStorage(pathRefId);
    const validated = validatePlatformPathForStorage(pathRef);
    assertPlatformStateTimestamp(now);
    const write = this.connection.database.transaction(() => {
      const existing = this.connection.database
        .prepare("SELECT version FROM platform_path_refs WHERE path_ref_id = ?")
        .get(id) as { version?: number } | undefined;
      const version = (existing?.version ?? 0) + 1;
      if (existing) {
        this.connection.database
          .prepare(
            "UPDATE platform_path_refs SET platform = ?, path_value = ?, path_ref_json = ?, version = ?, updated_at = ? WHERE path_ref_id = ? AND version = ?",
          )
          .run(validated.platform, validated.value, JSON.stringify(validated), version, now, id, existing.version);
      } else {
        this.connection.database
          .prepare(
            "INSERT INTO platform_path_refs (path_ref_id, platform, path_value, path_ref_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(id, validated.platform, validated.value, JSON.stringify(validated), version, now, now);
      }
      return { id, version };
    });
    return write();
  }

  getPlatformPathRef(pathRefId: unknown): PlatformPathRef | undefined {
    const id = validatePlatformIdentifierForStorage(pathRefId);
    const row = this.connection.database
      .prepare("SELECT path_ref_json FROM platform_path_refs WHERE path_ref_id = ?")
      .get(id) as { path_ref_json?: string } | undefined;
    if (!row) return undefined;
    try {
      return validatePlatformPathForStorage(JSON.parse(row.path_ref_json ?? ""));
    } catch (error) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored platform path reference is invalid", { cause: error });
    }
  }

  initializeSession(
    request: SessionStateMutationRequest,
    sessionPasswordVerifier: SessionPasswordVerifier,
  ): SessionStateWriteResult {
    assertSessionMutationRequest(request);
    const verifierJson = assertSessionPasswordVerifier(sessionPasswordVerifier, request.now);
    const initialState = validateSessionSecurityStateForStorage({
      userId: request.userId,
      state: "LOCKED",
      sessionId: null,
      unlockedAt: null,
      lockedReason: "STARTUP",
      failedUnlockAttempts: 0,
      cooldownUntil: null,
    });
    const stateJson = JSON.stringify(initialState);
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database
        .prepare("SELECT version FROM session_security_state WHERE state_id = ?")
        .get(SESSION_SECURITY_STATE_ID) as RecordRow | undefined;
      if (existing) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "the primary JARVIS session is already initialized");
      this.connection.database
        .prepare("INSERT INTO session_auth_verifiers (verifier_id, user_id, profile_id, verifier_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run("session-password-verifier", request.userId, sessionPasswordVerifier.profileId, verifierJson, 1, request.now, request.now);
      this.connection.database
        .prepare("INSERT INTO session_security_state (state_id, state_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(SESSION_SECURITY_STATE_ID, stateJson, 1, request.now, request.now);
      this.appendStateTransitionEvidence(
        { eventId: request.eventId, eventType: request.eventType, correlationId: request.correlationId, occurredAt: request.now },
        "SESSION_SECURITY",
        SESSION_SECURITY_STATE_ID,
        1,
        stateJson,
      );
      return { version: 1, state: initialState };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "session initialization failed", { cause: error });
    }
  }

  getSessionSecurityState(): SessionSecurityState | undefined {
    const row = this.connection.database
      .prepare("SELECT state_json FROM session_security_state WHERE state_id = ?")
      .get(SESSION_SECURITY_STATE_ID) as { state_json?: string } | undefined;
    if (!row) return undefined;
    try {
      return validateSessionSecurityStateForStorage(JSON.parse(row.state_json ?? ""));
    } catch (error) {
      if (error instanceof CoreSchemaError) throw error;
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored session security state is invalid", { cause: error });
    }
  }

  getSessionPasswordVerifierRecord(): SessionPasswordVerifierRecord | undefined {
    const row = this.connection.database
      .prepare("SELECT user_id, verifier_json, version FROM session_auth_verifiers WHERE verifier_id = ?")
      .get("session-password-verifier") as { user_id?: string; verifier_json?: string; version?: number } | undefined;
    if (!row) return undefined;
    if (typeof row.verifier_json !== "string" || typeof row.user_id !== "string" || !Number.isInteger(row.version)) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "stored session password verifier record is invalid");
    }
    const version = row.version as number;
    return Object.freeze({
      userId: row.user_id,
      version,
      verifier: parseSessionPasswordVerifierJson(row.verifier_json),
    });
  }

  getSessionPasswordVerifier(): SessionPasswordVerifier | undefined {
    return this.getSessionPasswordVerifierRecord()?.verifier;
  }

  upgradeSessionPasswordVerifier(request: SessionPasswordUpgradeRequest): SessionPasswordWriteResult {
    assertSessionMutationRequest(request);
    if (
      !Number.isInteger(request.expectedVerifierVersion) ||
      request.expectedVerifierVersion < 1 ||
      request.currentVerifierVerified !== true ||
      (request.kind === "EXPLICIT_PASSWORD_CHANGE" && (request.explicitConfirmation !== true || request.eventType !== "SESSION_PASSWORD_CHANGE")) ||
      (request.kind === "REHASH_AFTER_AUTH" && request.eventType !== "SESSION_PASSWORD_REHASH_AFTER_AUTH")
    ) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "session password upgrade authorization is invalid");
    }
    const replacementJson = assertSessionPasswordVerifier(request.replacementVerifier, request.now);
    const apply = this.connection.database.transaction(() => {
      const stateRow = this.connection.database
        .prepare("SELECT state_json FROM session_security_state WHERE state_id = ?")
        .get(SESSION_SECURITY_STATE_ID) as { state_json?: string } | undefined;
      if (!stateRow) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "the primary JARVIS session is not initialized");
      const state = validateSessionSecurityStateForStorage(JSON.parse(stateRow.state_json ?? ""));
      if (state.userId !== request.userId || state.state !== "UNLOCKED" || state.sessionId !== request.sessionId) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "an unlocked JARVIS session is required for password upgrade");
      }
      const row = this.connection.database
        .prepare("SELECT user_id, verifier_json, version FROM session_auth_verifiers WHERE verifier_id = ?")
        .get("session-password-verifier") as { user_id?: string; verifier_json?: string; version?: number } | undefined;
      if (!row || typeof row.user_id !== "string" || typeof row.verifier_json !== "string" || !Number.isInteger(row.version)) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "the primary session password verifier is not initialized");
      }
      if (row.user_id !== request.userId || row.version !== request.expectedVerifierVersion) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "session password verifier version is stale");
      }
      const previous = parseSessionPasswordVerifierJson(row.verifier_json);
      assertSessionPasswordUpgrade(previous, request.replacementVerifier, request.now);
      const nextVersion = row.version + 1;
      const updated = this.connection.database
        .prepare("UPDATE session_auth_verifiers SET profile_id = ?, verifier_json = ?, version = ?, updated_at = ? WHERE verifier_id = ? AND version = ?")
        .run(request.replacementVerifier.profileId, replacementJson, nextVersion, request.now, "session-password-verifier", row.version);
      if (updated.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "session password verifier upgrade raced with another change");
      this.appendSessionPasswordEvidence(request, nextVersion, {
        operation: request.kind,
        profileId: request.replacementVerifier.profileId,
      });
      return { version: nextVersion, profileId: request.replacementVerifier.profileId };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "session password verifier upgrade failed", { cause: error });
    }
  }

  resetSessionPasswordAfterRecovery(request: SessionPasswordRecoveryResetRequest): SessionPasswordWriteResult {
    assertSessionMutationRequest(request);
    if (
      !Number.isInteger(request.expectedSessionVersion) ||
      request.expectedSessionVersion < 1 ||
      !Number.isInteger(request.expectedVerifierVersion) ||
      request.expectedVerifierVersion < 1 ||
      request.explicitConfirmation !== true ||
      request.eventType !== "SESSION_PASSWORD_RECOVERY_RESET"
    ) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "session password recovery reset authorization is invalid");
    }
    assertRecoveryEvidence(request.recoveryEvidence, request.now);
    const replacementJson = assertSessionPasswordVerifier(request.replacementVerifier, request.now);
    const apply = this.connection.database.transaction(() => {
      const stateRow = this.connection.database
        .prepare("SELECT state_json, version FROM session_security_state WHERE state_id = ?")
        .get(SESSION_SECURITY_STATE_ID) as { state_json?: string; version?: number } | undefined;
      if (!stateRow || !Number.isInteger(stateRow.version)) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "the primary JARVIS session is not initialized");
      const state = validateSessionSecurityStateForStorage(JSON.parse(stateRow.state_json ?? ""));
      if (state.userId !== request.userId || state.state === "UNLOCKED" || stateRow.version !== request.expectedSessionVersion) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "recovery password reset requires the expected locked session state");
      }
      const verifierRow = this.connection.database
        .prepare("SELECT user_id, version FROM session_auth_verifiers WHERE verifier_id = ?")
        .get("session-password-verifier") as { user_id?: string; version?: number } | undefined;
      if (!verifierRow || verifierRow.user_id !== request.userId || verifierRow.version !== request.expectedVerifierVersion) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "session password verifier version is stale");
      }
      const nextVerifierVersion = verifierRow.version + 1;
      const updatedVerifier = this.connection.database
        .prepare("UPDATE session_auth_verifiers SET profile_id = ?, verifier_json = ?, version = ?, updated_at = ? WHERE verifier_id = ? AND version = ?")
        .run(request.replacementVerifier.profileId, replacementJson, nextVerifierVersion, request.now, "session-password-verifier", verifierRow.version);
      if (updatedVerifier.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "recovery password reset raced with another change");
      const nextSessionVersion = stateRow.version + 1;
      const nextState = validateSessionSecurityStateForStorage({
        ...state,
        state: "LOCKED",
        sessionId: null,
        unlockedAt: null,
        lockedReason: "SECURITY",
        failedUnlockAttempts: 0,
        cooldownUntil: null,
      });
      const stateJson = JSON.stringify(nextState);
      const updatedState = this.connection.database
        .prepare("UPDATE session_security_state SET state_json = ?, version = ?, updated_at = ? WHERE state_id = ? AND version = ?")
        .run(stateJson, nextSessionVersion, request.now, SESSION_SECURITY_STATE_ID, stateRow.version);
      if (updatedState.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "recovery password reset state change raced with another change");
      this.appendSessionPasswordEvidence(request, nextVerifierVersion, {
        operation: "RECOVERY_RESET",
        profileId: request.replacementVerifier.profileId,
        recoveryEvidenceId: request.recoveryEvidence.evidenceId,
        backupId: request.recoveryEvidence.backupId,
        slotId: request.recoveryEvidence.slotId,
      });
      this.appendStateTransitionEvidence(
        { eventId: request.eventId, eventType: request.eventType, correlationId: request.correlationId, occurredAt: request.now },
        "SESSION_SECURITY",
        SESSION_SECURITY_STATE_ID,
        nextSessionVersion,
        stateJson,
      );
      return { version: nextVerifierVersion, profileId: request.replacementVerifier.profileId };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "session password recovery reset failed", { cause: error });
    }
  }

  authenticateSession(request: SessionAuthenticationRequest): SessionAuthenticationResult {
    assertSessionMutationRequest(request);
    const apply = this.connection.database.transaction(() => {
      const row = this.connection.database
        .prepare("SELECT state_json, version FROM session_security_state WHERE state_id = ?")
        .get(SESSION_SECURITY_STATE_ID) as { state_json?: string; version?: number } | undefined;
      if (!row || !Number.isInteger(row.version)) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "the primary JARVIS session is not initialized");
      const currentVersion = row.version as number;
      const current = validateSessionSecurityStateForStorage(JSON.parse(row.state_json ?? ""));
      if (current.userId !== request.userId) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "session user identity changed");
      if (current.state === "UNLOCKED" && current.sessionId !== request.sessionId) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "session identity changed");
      if (isSessionCooldownActive(current, request.now)) {
        return { status: "COOLDOWN" as const, version: currentVersion, retryAfterMs: Math.max(0, Date.parse(current.cooldownUntil as string) - Date.parse(request.now)), state: current };
      }
      const nextFailedUnlockAttempts = Math.min(31, current.failedUnlockAttempts + 1);
      const next: SessionSecurityState = request.passwordVerified
        ? validateSessionSecurityStateForStorage({ ...current, state: "UNLOCKED", sessionId: request.sessionId, unlockedAt: request.now, lockedReason: null, failedUnlockAttempts: 0, cooldownUntil: null })
        : validateSessionSecurityStateForStorage({ ...current, state: "LOCKED", sessionId: null, unlockedAt: null, lockedReason: "SECURITY", failedUnlockAttempts: nextFailedUnlockAttempts, cooldownUntil: new Date(Date.parse(request.now) + progressiveCooldownMs(nextFailedUnlockAttempts)).toISOString() });
      const nextVersion = currentVersion + 1;
      const stateJson = JSON.stringify(next);
      const updated = this.connection.database
        .prepare("UPDATE session_security_state SET state_json = ?, version = ?, updated_at = ? WHERE state_id = ? AND version = ?")
        .run(stateJson, nextVersion, request.now, SESSION_SECURITY_STATE_ID, currentVersion);
      if (updated.changes !== 1) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "session authentication raced with another state change");
      this.appendStateTransitionEvidence(
        { eventId: request.eventId, eventType: request.eventType, correlationId: request.correlationId, occurredAt: request.now },
        "SESSION_SECURITY",
        SESSION_SECURITY_STATE_ID,
        nextVersion,
        stateJson,
      );
      return { status: request.passwordVerified ? "UNLOCKED" as const : "DENIED" as const, version: nextVersion, retryAfterMs: request.passwordVerified ? 0 : progressiveCooldownMs(next.failedUnlockAttempts), state: next };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "session authentication transition failed", { cause: error });
    }
  }

  lockSession(request: SessionStateMutationRequest): SessionStateWriteResult {
    return this.lockSessionWithReason(request, "USER");
  }

  lockSessionForPlatform(request: PlatformSessionLockRequest): SessionStateWriteResult {
    if (!(["OS_SESSION_LOCK", "OS_SESSION_END", "IDLE"] as const).includes(request.reason)) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "platform session lock reason is invalid");
    }
    return this.lockSessionWithReason(request, request.reason);
  }

  private lockSessionWithReason(
    request: SessionStateMutationRequest,
    reason: "USER" | PlatformSessionLockReason,
  ): SessionStateWriteResult {
    assertSessionMutationRequest(request);
    const apply = this.connection.database.transaction(() => {
      const row = this.connection.database
        .prepare("SELECT state_json, version FROM session_security_state WHERE state_id = ?")
        .get(SESSION_SECURITY_STATE_ID) as { state_json?: string; version?: number } | undefined;
      if (!row || !Number.isInteger(row.version)) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "the primary JARVIS session is not initialized");
      const currentVersion = row.version as number;
      const current = validateSessionSecurityStateForStorage(JSON.parse(row.state_json ?? ""));
      if (current.userId !== request.userId || (current.sessionId !== null && current.sessionId !== request.sessionId)) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "session identity changed");
      const next = validateSessionSecurityStateForStorage({ ...current, state: "LOCKED", sessionId: null, unlockedAt: null, lockedReason: reason });
      const nextVersion = currentVersion + 1;
      const stateJson = JSON.stringify(next);
      this.connection.database.prepare("UPDATE session_security_state SET state_json = ?, version = ?, updated_at = ? WHERE state_id = ? AND version = ?").run(stateJson, nextVersion, request.now, SESSION_SECURITY_STATE_ID, currentVersion);
      this.appendStateTransitionEvidence(
        { eventId: request.eventId, eventType: request.eventType, correlationId: request.correlationId, occurredAt: request.now },
        "SESSION_SECURITY",
        SESSION_SECURITY_STATE_ID,
        nextVersion,
        stateJson,
      );
      return { version: nextVersion, state: next };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "session lock transition failed", { cause: error });
    }
  }

  declassifyDataPolicy(request: DataPolicyDeclassificationRequest): DataPolicyDeclassificationResult {
    assertSessionMutationRequest(request);
    if (request.eventType !== "DATA_POLICY_DECLASSIFIED" || request.explicitConfirmation !== true) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "data-policy declassification requires explicit confirmation and the canonical event type");
    }
    const decisionId = assertDeclassificationText(request.decisionId, "declassification decision id", 256);
    const reason = assertDeclassificationText(request.reason, "declassification reason", 512);
    let sourcePolicy: DataPolicy;
    let targetPolicy: DataPolicy;
    try {
      sourcePolicy = validateDataPolicy(request.sourcePolicy);
      targetPolicy = validateDataPolicy(request.targetPolicy);
    } catch (error) {
      if (error instanceof CoreSchemaError) throw error;
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "data-policy declassification contains an invalid policy", { cause: error });
    }
    const sensitivityChange = compareDataSensitivity(targetPolicy.sensitivity, sourcePolicy.sensitivity);
    const localityChange = sourcePolicy.locality === "LOCAL_ONLY" && targetPolicy.locality === "ANY_APPROVED_PROVIDER";
    if (sensitivityChange > 0 || (targetPolicy.locality === "LOCAL_ONLY" && sourcePolicy.locality === "ANY_APPROVED_PROVIDER") || (sensitivityChange === 0 && !localityChange)) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "target data policy is not a strict audited declassification");
    }
    const payload = JSON.stringify({ decisionId, sourcePolicy, targetPolicy, reason });
    const apply = this.connection.database.transaction(() => {
      const stateRow = this.connection.database
        .prepare("SELECT state_json FROM session_security_state WHERE state_id = ?")
        .get(SESSION_SECURITY_STATE_ID) as { state_json?: string } | undefined;
      if (!stateRow) throw new CoreSchemaError("PERSISTENCE_CONFLICT", "the primary JARVIS session is not initialized");
      const state = validateSessionSecurityStateForStorage(JSON.parse(stateRow.state_json ?? ""));
      if (state.userId !== request.userId || state.state !== "UNLOCKED" || state.sessionId !== request.sessionId) {
        throw new CoreSchemaError("PERSISTENCE_CONFLICT", "an unlocked JARVIS session is required for declassification");
      }
      this.connection.database
        .prepare("INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(request.eventId, request.eventType, "DATA_POLICY_DECLASSIFICATION", decisionId, 1, payload, request.correlationId, request.now);
      this.connection.database
        .prepare("INSERT INTO audit_events (audit_event_id, event_type, subject_type, subject_id, audit_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(`declassification:${decisionId}`, "DATA_POLICY_DECLASSIFIED", "DATA_POLICY", decisionId, JSON.stringify({ decisionId, sourcePolicy, targetPolicy, reason, sessionId: request.sessionId }), request.now);
      return Object.freeze({ decisionId, sourcePolicy, targetPolicy });
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "data-policy declassification failed", { cause: error });
    }
  }

  markPortableRestoreCredentialsReauthRequired(
    now: string,
    sessionPasswordVerifier: SessionPasswordVerifier,
  ): PortableRestoreCredentialReconciliation {
    if (!now || Number.isNaN(Date.parse(now))) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "restore reconciliation timestamp must be an ISO timestamp");
    }
    const sessionPasswordVerifierJson = assertSessionPasswordVerifier(sessionPasswordVerifier, now);
    try {
      const reconcile = this.connection.database.transaction(() => {
        const rows = this.connection.database
          .prepare(
            "SELECT integration_account_id FROM integration_accounts WHERE credential_handle IS NOT NULL OR state <> 'REAUTH_REQUIRED' ORDER BY integration_account_id",
          )
          .all() as Array<{ integration_account_id: string }>;
        this.connection.database
          .prepare(
            "UPDATE integration_accounts SET credential_handle = NULL, state = 'REAUTH_REQUIRED', version = version + 1, updated_at = ? WHERE credential_handle IS NOT NULL OR state <> 'REAUTH_REQUIRED'",
          )
          .run(now);
        this.connection.database
          .prepare(
            "INSERT INTO system_meta (meta_key, meta_value, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT(meta_key) DO UPDATE SET meta_value = excluded.meta_value, version = system_meta.version + 1, updated_at = excluded.updated_at",
          )
          .run("session-password-verifier", sessionPasswordVerifierJson, now, now);
        return Object.freeze({
          affectedIntegrationAccountIds: Object.freeze(rows.map(({ integration_account_id }) => integration_account_id)),
        });
      });
      return reconcile();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "portable restore credential reconciliation failed", {
        cause: error,
      });
    }
  }

  transitionMission(request: MissionStateTransitionRequest): StateTransitionResult {
    const nextState = validateMissionStateForStorage(request.nextState);
    return this.transitionDurableState(
      request,
      {
        table: "missions",
        idColumn: "mission_id",
        jsonColumn: "mission_json",
        recordType: "MISSION",
        validateState: validateMissionStateForStorage,
        assertInitialState: assertMissionInitialState,
        assertTransition: assertMissionTransition,
      },
      request.missionId,
      nextState,
    );
  }

  transitionTask(request: TaskStateTransitionRequest): StateTransitionResult {
    const nextState = validateTaskStateForStorage(request.nextState);
    return this.transitionDurableState(
      request,
      {
        table: "tasks",
        idColumn: "task_id",
        jsonColumn: "task_json",
        recordType: "TASK",
        parentColumn: "mission_id",
        parentTable: "missions",
        validateState: validateTaskStateForStorage,
        assertInitialState: assertTaskInitialState,
        assertTransition: assertTaskTransition,
      },
      request.taskId,
      nextState,
      request.missionId,
    );
  }

  transitionAttempt(request: AttemptStateTransitionRequest): StateTransitionResult {
    const nextState = validateAttemptStateForStorage(request.nextState);
    return this.transitionDurableState(
      request,
      {
        table: "task_attempts",
        idColumn: "attempt_id",
        jsonColumn: "attempt_json",
        recordType: "TASK_ATTEMPT",
        parentColumn: "task_id",
        parentTable: "tasks",
        validateState: validateAttemptStateForStorage,
        assertInitialState: assertAttemptInitialState,
        assertTransition: assertAttemptTransition,
      },
      request.attemptId,
      nextState,
      request.taskId,
    );
  }

  private transitionDurableState(
    request: DurableStateTransitionRequest,
    definition: {
      readonly table: "missions" | "tasks" | "task_attempts";
      readonly idColumn: "mission_id" | "task_id" | "attempt_id";
      readonly jsonColumn: "mission_json" | "task_json" | "attempt_json";
      readonly recordType: "MISSION" | "TASK" | "TASK_ATTEMPT";
      readonly parentColumn?: "mission_id" | "task_id";
      readonly parentTable?: "missions" | "tasks";
      readonly validateState: (value: unknown) => MissionState | TaskState | AttemptState;
      readonly assertInitialState: (value: unknown) => void;
      readonly assertTransition: (current: unknown, next: unknown) => void;
    },
    recordId: string,
    nextState: MissionState | TaskState | AttemptState,
    parentId?: string,
  ): StateTransitionResult {
    if (!recordId || recordId.includes("\0")) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${definition.recordType} identifier is invalid`);
    }
    if (definition.parentColumn && (!parentId || parentId.includes("\0"))) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${definition.recordType} parent identifier is invalid`);
    }
    const stateJson = assertStateTransitionRequest(request, definition.recordType);
    const apply = this.connection.database.transaction(() => {
      if (definition.parentColumn && definition.parentTable && parentId) {
        const parent = this.connection.database
          .prepare(`SELECT 1 AS present FROM ${definition.parentTable} WHERE ${definition.parentColumn} = ?`)
          .get(parentId) as { present?: number } | undefined;
        if (parent?.present !== 1) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${definition.recordType} parent does not exist`);
        }
      }

      const existing = this.connection.database
        .prepare(`SELECT ${definition.parentColumn ? `${definition.parentColumn}, ` : ""}state, ${definition.jsonColumn} AS state_json, version FROM ${definition.table} WHERE ${definition.idColumn} = ?`)
        .get(recordId) as { state?: unknown; state_json?: string; version?: number; [key: string]: unknown } | undefined;
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== request.expectedVersion) {
        throw new CoreSchemaError(
          "PERSISTENCE_CONFLICT",
          `${definition.recordType} ${recordId} expected version ${request.expectedVersion}, found ${currentVersion}`,
        );
      }

      if (!existing) {
        assertStateMachinePolicy(() => definition.assertInitialState(nextState), definition.recordType);
      } else {
        const currentState = validateStateMachineState(definition.validateState, existing.state, definition.recordType);
        assertStateMachinePolicy(() => definition.assertTransition(currentState, nextState), definition.recordType);
        if (existing.state_json !== undefined) {
          const storedState = assertStoredState(existing.state_json, definition.recordType);
          if (storedState.state !== currentState) {
            throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", `${definition.recordType} row state disagrees with its JSON payload`);
          }
        }
        if (definition.parentColumn && parentId && existing[definition.parentColumn] !== parentId) {
          throw new CoreSchemaError("PERSISTENCE_CONFLICT", `${definition.recordType} parent cannot change`);
        }
      }

      const nextVersion = currentVersion + 1;
      if (existing) {
        const result = this.connection.database
          .prepare(`UPDATE ${definition.table} SET state = ?, ${definition.jsonColumn} = ?, version = ?, updated_at = ? WHERE ${definition.idColumn} = ? AND version = ?`)
          .run(nextState, stateJson, nextVersion, request.occurredAt, recordId, currentVersion);
        if (result.changes !== 1) {
          throw new CoreSchemaError("PERSISTENCE_CONFLICT", `${definition.recordType} transition lost its version race`);
        }
      } else {
        if (definition.parentColumn && parentId) {
          this.connection.database
            .prepare(`INSERT INTO ${definition.table} (${definition.idColumn}, ${definition.parentColumn}, state, ${definition.jsonColumn}, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(recordId, parentId, nextState, stateJson, nextVersion, request.occurredAt, request.occurredAt);
        } else {
          this.connection.database
            .prepare(`INSERT INTO ${definition.table} (${definition.idColumn}, state, ${definition.jsonColumn}, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(recordId, nextState, stateJson, nextVersion, request.occurredAt, request.occurredAt);
        }
      }

      if (definition.recordType === "MISSION" && (nextState === "QUEUED" || nextState === "RUNNING") && existing?.state === "PAUSED") {
        const pausedTasks = this.connection.database
          .prepare("SELECT COUNT(*) AS count FROM tasks WHERE mission_id = ? AND state = 'PAUSED'")
          .get(recordId) as { count?: number };
        if ((pausedTasks.count ?? 0) > 0) {
          throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "mission resume requires paused tasks to enter durable RESUMING first");
        }
      }

      this.appendStateTransitionEvidence(request, definition.recordType, recordId, nextVersion, stateJson);
      return { recordId, version: nextVersion, eventId: request.eventId };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", `${definition.recordType} state transition failed`, {
        cause: error,
      });
    }
  }

  transition(request: StateTransition): StateTransitionResult {
    if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 0) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "expected state version must be a non-negative integer");
    }
    const stateJson = assertJsonObject(request.state);
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database
        .prepare("SELECT version FROM authoritative_records WHERE record_id = ?")
        .get(request.recordId) as RecordRow | undefined;
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== request.expectedVersion) {
        throw new CoreSchemaError(
          "PERSISTENCE_CONFLICT",
          `record ${request.recordId} expected version ${request.expectedVersion}, found ${currentVersion}`,
        );
      }
      const nextVersion = currentVersion + 1;
      if (existing) {
        this.connection.database
          .prepare(
            "UPDATE authoritative_records SET state_json = ?, version = ?, updated_at = ? WHERE record_id = ? AND version = ?",
          )
          .run(stateJson, nextVersion, request.occurredAt, request.recordId, currentVersion);
      } else {
        this.connection.database
          .prepare(
            "INSERT INTO authoritative_records (record_id, record_type, state_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            request.recordId,
            request.recordType,
            stateJson,
            nextVersion,
            request.occurredAt,
            request.occurredAt,
          );
      }
      this.appendStateTransitionEvidence(request, request.recordType, request.recordId, nextVersion, stateJson);
      return { recordId: request.recordId, version: nextVersion, eventId: request.eventId };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "authoritative state transition failed", {
        cause: error,
      });
    }
  }
}
