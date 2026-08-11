# JARVIS
## Technical Architecture, Development & Product Contract

**Document Version:** 0.1  
**Status:** Initial Architecture Baseline / Living Contract  
**Date Established:** August 11, 2026  
**Project Codename:** JARVIS  
**Primary Platform:** Microsoft Windows  
**Document Type:** Technical Architecture and Development Contract  
**Purpose:** Governing specification for the design, implementation, security, extensibility, and future evolution of JARVIS.

---

# 1. PURPOSE OF THIS CONTRACT

This document establishes the technical contract governing the JARVIS project.

JARVIS is intended to become a persistent, voice-capable, context-aware artificial intelligence assistant running primarily on the user's personal computer.

JARVIS shall not be implemented as a simple chatbot.

JARVIS shall instead function as an intelligent orchestration platform capable of:

- communicating naturally with the user;
- understanding ambiguous or incomplete natural-language requests;
- asking clarification questions when required;
- remembering active context;
- selecting appropriate AI providers;
- delegating complex work to specialized AI workers;
- executing approved local tools;
- managing long-running missions and tasks;
- interacting with the Windows environment;
- integrating with Codex CLI;
- integrating with additional AI CLIs in the future;
- supporting local AI models in the future;
- supporting remote or network AI compute in the future;
- supporting local speech recognition and speech synthesis;
- maintaining a strong separation between AI decision-making and deterministic authorization;
- evolving without requiring fundamental architectural rewrites.

This contract is intended to remain a **living technical specification**.

As the project evolves, this contract SHALL be amended rather than silently ignored.

---

# 2. CONTRACT LANGUAGE

The following terms have specific meanings throughout this specification.

## MUST

A mandatory architectural or implementation requirement.

An implementation violating a MUST requirement is considered non-compliant with this contract.

## MUST NOT

A prohibited behavior or architectural pattern.

## SHOULD

A strong recommendation that may only be violated for a documented technical reason.

## SHOULD NOT

A pattern that should normally be avoided.

## MAY

An optional capability or implementation decision.

---

# 3. PRIMARY PRODUCT VISION

JARVIS shall become an AI operating companion for the user's computer.

The long-term experience should resemble:

> “Jarvis, let's continue working on LocalCI.”

JARVIS should understand:

- what “LocalCI” refers to;
- where the repository is located;
- what task was last being performed;
- whether an existing Codex session/thread should be resumed;
- what tools are available;
- what permissions are required.

The conversation may continue:

> “What were we stuck on?”

JARVIS should retrieve the relevant project/task context.

The user may then say:

> “Use the separate archive approach and let Codex continue.”

JARVIS should understand the instruction, construct an appropriate engineering task, and delegate the work to Codex.

The user should not need to manually specify:

- repository paths;
- model names;
- terminal commands;
- Codex CLI syntax;
- context already known to JARVIS;
- implementation details of the orchestration system.

The target interaction model is:

**Human intent → JARVIS reasoning → controlled delegation → observable execution → useful response.**

---

# 4. FUNDAMENTAL ARCHITECTURAL PRINCIPLE

JARVIS shall be designed around the following separation:

```text
Human
  │
  ▼
JARVIS Interface
  │
  ▼
JARVIS Core
  │
  ▼
AI Orchestrator
  │
  ▼
Capability / Tool Selection
  │
  ├── Local deterministic tools
  ├── Codex worker
  ├── Future AI CLI
  ├── Future local AI
  └── Future network AI
```

JARVIS itself is the platform.

AI models are replaceable intelligence providers.

Codex is an initial provider and worker.

Codex MUST NOT become architecturally synonymous with JARVIS.

---

# 5. CORE DESIGN PRINCIPLE: AI IS REPLACEABLE

The architecture MUST assume that AI technology will change substantially over the life of the project.

Today, a cloud-hosted model accessed through Codex CLI may provide the best balance of capability and cost.

Future consumer devices may contain:

- significantly larger GPUs;
- NPUs;
- high-bandwidth unified memory;
- dedicated AI accelerators;
- efficient local inference hardware;
- integrated neural processors capable of running sophisticated models locally.

The architecture MUST therefore support transition from:

```text
JARVIS
   ↓
Cloud AI
```

to:

```text
JARVIS
   ↓
Local AI
```

without redesigning JARVIS Core.

The AI provider shall be considered an implementation dependency, not the identity of the system.

---

# 6. INITIAL PLATFORM

The initial supported operating system SHALL be:

**Microsoft Windows 11**

JARVIS V1 shall be implemented as a Windows desktop application.

A traditional browser-hosted web application SHALL NOT be the primary V1 platform.

Reasons include the requirement for future access to:

- microphone devices;
- speech processing;
- Codex CLI;
- local repositories;
- local processes;
- local files;
- Windows applications;
- system tray integration;
- global keyboard shortcuts;
- background operation;
- local AI runtimes;
- future wake-word detection;
- operating system tools.

---

# 7. DESKTOP APPLICATION ARCHITECTURE

The preferred initial desktop architecture shall be:

```text
Tauri 2
+
React
+
TypeScript
```

The desktop application MUST remain thin relative to JARVIS Core.

The desktop UI MUST NOT contain the primary orchestration logic.

The desktop shell shall be responsible primarily for:

- rendering user interface;
- displaying conversation;
- displaying tasks;
- displaying status;
- collecting typed commands;
- collecting voice commands;
- system tray integration;
- native notifications;
- window lifecycle;
- visual approval prompts;
- settings;
- presenting events emitted by JARVIS Core.

The architecture MUST permit the desktop shell to be replaced or substantially redesigned without rewriting the orchestration engine.

---

# 8. FUTURE BROWSER CAPABILITY

An integrated JARVIS-controlled browser is explicitly **deferred**.

It is NOT part of the initial implementation scope.

However, the architecture MUST NOT prevent the future addition of:

- an integrated browser;
- an embedded WebView;
- browser automation;
- a Chromium-based browser subsystem;
- browser context awareness;
- active-page context;
- JARVIS-controlled navigation.

No current subsystem shall assume that browser capabilities will never exist.

Browser automation SHALL eventually be implemented as another tool/capability provider.

Conceptually:

```text
JARVIS Core
   │
   └── Browser Capability
          │
          ├── read page
          ├── navigate
          ├── search
          ├── click
          ├── type
          └── future browser operations
```

The eventual browser implementation MUST NOT require replacement of the AI orchestration architecture.

---

# 9. JARVIS CORE

JARVIS Core is the central runtime of the project.

It MUST remain logically separate from the desktop UI.

The preferred implementation language is:

**TypeScript**

The preferred runtime is:

**Node.js**

JARVIS Core shall contain the primary implementation of:

- orchestration;
- AI provider management;
- task management;
- mission management;
- conversation context;
- project context;
- permission policies;
- tool execution;
- provider routing;
- memory;
- event distribution;
- worker management;
- voice coordination;
- configuration;
- logging.

---

# 10. HIGH-LEVEL ARCHITECTURE

```text
┌─────────────────────────────────────────┐
│              USER                       │
│                                         │
│ Voice / Keyboard / UI                   │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         JARVIS DESKTOP                  │
│                                         │
│ Tauri                                   │
│ React                                   │
│ TypeScript                              │
└───────────────────┬─────────────────────┘
                    │
             secure local IPC
                    │
                    ▼
┌─────────────────────────────────────────┐
│             JARVIS CORE                 │
│                                         │
│ Orchestration                           │
│ Context                                 │
│ Memory                                  │
│ Missions                                │
│ Permissions                             │
│ AI Runtime Manager                      │
│ Tool Registry                           │
│ Event Bus                               │
└───────────────────┬─────────────────────┘
                    │
       ┌────────────┼──────────────┐
       │            │              │
       ▼            ▼              ▼
 AI Providers    Local Tools     Voice
       │            │              │
       ▼            ▼              ▼
 Codex CLI       Windows        Whisper
 Future CLI      Git            TTS
 Local AI        Projects       Wake word
 Remote AI       Files          VAD
```

---

# 11. AI ORCHESTRATOR

The orchestrator MUST itself be AI-powered.

A purely deterministic intent router is insufficient for the target JARVIS experience.

The orchestrator shall be responsible for understanding the user, not merely matching keywords.

The orchestrator MUST be capable of:

- interpreting natural-language instructions;
- understanding variations in phrasing;
- using conversation context;
- interpreting references such as:
  - “it”;
  - “that”;
  - “this project”;
  - “the other one”;
  - “continue what we were doing”;
- identifying ambiguity;
- determining when required information is missing;
- asking clarification questions;
- choosing whether to answer directly;
- choosing whether to call a tool;
- choosing whether to delegate to a worker;
- requesting authorization where necessary;
- determining whether additional investigation can safely resolve ambiguity;
- coordinating multi-step missions.

---

# 12. ORCHESTRATOR CLARIFICATION REQUIREMENT

The orchestrator MUST NOT blindly guess when ambiguity materially affects execution.

Example:

User:

> “Deploy it.”

Known state:

```text
Active project: IBMA

Available environments:
- staging
- production
```

The orchestrator MUST NOT arbitrarily choose an environment.

It should respond:

> “Do you want me to deploy IBMA to staging or production?”

Another example:

User:

> “Fix the server.”

Known servers:

- LocalCI production server;
- IBMA server;
- Proxmox host;
- development VM.

JARVIS should ask an appropriate clarification question unless context strongly establishes the target.

---

# 13. INTELLIGENT AMBIGUITY RESOLUTION

Clarification does not mean JARVIS should ask unnecessary questions.

If ambiguity can be resolved using safe, read-only context gathering, JARVIS SHOULD investigate first.

Example:

User:

> “Why isn't the application working?”

JARVIS may safely inspect:

- active project;
- application status;
- health endpoint;
- service status;
- recent non-sensitive logs.

If JARVIS discovers:

```text
Application: running
Database connection: failing
```

it should preferably say:

> “The application is running, but it cannot reach PostgreSQL. Do you want Codex to investigate the database configuration?”

rather than asking:

> “What do you mean by not working?”

The assistant SHOULD attempt useful safe investigation before asking questions whose answers can easily be discovered.

---

# 14. INITIAL ORCHESTRATOR PROVIDER

The initial orchestrator shall use:

**Codex CLI**

with a low-cost, lightweight model selected through configuration.

The architecture MUST NOT hard-code a specific model name.

An initial configuration may use a model such as:

```text
GPT-5.6 Luna
```

if available and appropriate.

However, configuration shall conceptually be:

```yaml
role: orchestrator
provider: codex-cli
model: configurable
reasoning: low
```

rather than:

```text
Jarvis = GPT-5.6 Luna
```

The model MUST be replaceable.

---

# 15. ORCHESTRATOR AND ENGINEERING WORKER ARE DIFFERENT ROLES

JARVIS SHALL initially use Codex CLI in at least two logically separate roles.

## Role A — JARVIS Orchestrator

Purpose:

- understand user intent;
- converse;
- clarify;
- choose capabilities;
- construct tasks;
- manage high-level decisions.

Characteristics:

- low-cost model preferred;
- short prompts;
- limited tool exposure;
- no arbitrary repository access;
- structured output;
- no unrestricted shell;
- low reasoning mode preferred for routine interactions;
- short-lived executions MAY be used.

## Role B — Engineering Worker

Purpose:

- inspect repositories;
- implement code;
- run development commands;
- debug;
- test;
- refactor;
- review;
- perform engineering missions.

Characteristics:

- stronger model may be selected;
- repository-specific working directory;
- repository instructions;
- command access according to sandbox policy;
- longer context;
- streamed event handling;
- resumable engineering sessions where possible.

These roles MUST remain logically separated even if both currently use Codex CLI.

---

# 16. PROVIDER-AGNOSTIC AI ARCHITECTURE

JARVIS Core MUST NOT directly depend on Codex-specific concepts throughout the codebase.

A provider abstraction layer SHALL exist.

Conceptually:

```typescript
interface AIProvider {
    id: string;

    health(): Promise<ProviderHealth>;

    capabilities(): Promise<AICapabilities>;

    run(
        request: AIRequest
    ): AsyncIterable<AIEvent>;

    cancel(
        executionId: string
    ): Promise<void>;
}
```

Provider implementations may eventually include:

```text
Codex CLI
Local AI
Remote JARVIS node
Other AI CLI
Other cloud AI
```

Provider-specific behavior MUST remain encapsulated inside provider adapters.

---

# 17. ROLE-BASED AI SELECTION

JARVIS SHALL separate AI roles from AI providers.

Roles may include:

```text
orchestrator
software_engineer
researcher
summarizer
vision_agent
automation_agent
```

Roles specify required capabilities.

Example:

```yaml
orchestrator:
  requires:
    natural_language: true
    structured_output: true
    tool_selection: true
    clarification: true

  preferences:
    low_latency: true
    low_cost: true
```

The AI Runtime Manager chooses an appropriate provider/model.

Today:

```text
orchestrator
    ↓
Codex CLI
    ↓
low-cost Codex model
```

Future:

```text
orchestrator
    ↓
local AI runtime
    ↓
local model
```

No JARVIS Core rewrite should be required.

---

# 18. AI RUNTIME MANAGER

JARVIS SHALL include an AI Runtime Manager.

Its responsibilities shall eventually include:

- provider registration;
- provider health monitoring;
- model discovery;
- capability discovery;
- model/provider selection;
- routing;
- fallback;
- privacy policy enforcement;
- latency preferences;
- cost preferences;
- availability;
- local-versus-cloud preference;
- context-window requirements;
- task complexity requirements.

Potential future settings:

```text
AI Mode:

Automatic
Local Preferred
Cloud Preferred
Local Only
Cloud Only
```

V1 MAY implement only the subset needed for Codex CLI, but its public interfaces MUST allow later expansion.

---

# 19. LOCAL AI FUTURE COMPATIBILITY

Local AI is not required for JARVIS V1.

However, local AI support is a mandatory architectural provision.

The design MUST permit future providers such as:

```text
llama.cpp
Ollama
ONNX Runtime
DirectML
CUDA runtime
NPU runtime
future local inference runtimes
```

without requiring changes to:

- conversation logic;
- mission management;
- permissions;
- project management;
- UI;
- tool registry.

The local AI implementation itself MAY be deferred.

---

# 20. DISTRIBUTED AI FUTURE

JARVIS SHALL remain open to future network AI nodes.

Possible future topology:

```text
Main PC
  │
  ├── JARVIS UI
  ├── voice
  └── local GPU
         │
         │ LAN
         ▼
AI Workstation
  │
  └── larger model
```

Future nodes may include:

- desktop computers;
- laptops;
- home servers;
- dedicated AI appliances;
- NAS systems with accelerators;
- other personal devices.

The AI Runtime Manager MAY eventually treat these devices as compute providers.

---

# 21. AI DECISION OUTPUT

The orchestrator SHOULD return machine-readable structured decisions rather than unstructured prose whenever the runtime must perform an action.

A normalized conceptual decision format shall include actions such as:

```text
respond
clarify
tool
delegate
approval
continue_mission
cancel
```

Example:

```json
{
  "action": "clarify",
  "message": "Which environment should I deploy to?",
  "missing": ["environment"]
}
```

Example:

```json
{
  "action": "delegate",
  "message": "I'll have the engineering agent investigate it.",
  "capability": "software_engineering",
  "project": "localci",
  "task": "Investigate the runner-image installation failure before making changes."
}
```

JARVIS Core MUST validate AI-produced structured outputs before execution.

---

# 22. SECURITY PRINCIPLE

The core security rule of JARVIS is:

# AI DECIDES. SOFTWARE AUTHORIZES.

An AI model may decide:

> “The appropriate action is to deploy IBMA.”

The AI model SHALL NOT possess authority to perform unrestricted system actions by itself.

The deterministic runtime shall determine:

- whether the tool exists;
- whether arguments are valid;
- whether the user is authorized;
- whether the action is permitted;
- whether confirmation is required;
- whether the current environment permits the operation.

---

# 23. NO UNRESTRICTED SHELL FOR ORCHESTRATOR

The primary JARVIS orchestrator MUST NOT receive a general-purpose tool equivalent to:

```text
shell(command)
```

for normal orchestration.

Instead, JARVIS SHALL expose controlled capabilities such as:

```text
open_application(application)
set_volume(level)
get_project_status(project)
get_git_status(project)
run_tests(project)
delegate_engineering_task(project, task)
open_project(project)
get_service_status(service)
```

Arbitrary command execution shall remain confined to specialized workers or explicitly controlled administrative capabilities.

---

# 24. PERMISSION ENGINE

JARVIS Core SHALL contain a deterministic Permission Engine.

The AI MUST NOT define its own permission level.

The Permission Engine shall evaluate:

```text
requested action
target
environment
user policy
risk classification
provider
task context
```

Risk classes SHOULD include at least:

## LOW

Examples:

- read project status;
- open an application;
- query Git branch;
- retrieve non-sensitive information;
- run approved read-only diagnostics.

May execute automatically.

## MODERATE

Examples:

- edit development files;
- run local tests;
- install a project dependency;
- create local artifacts.

May be automatic depending on policy.

## HIGH

Examples:

- git push;
- external publication;
- deployments;
- database migrations;
- service restart;
- modification of remote infrastructure.

Requires stronger authorization according to configured policy.

## CRITICAL

Examples:

- production database deletion;
- repository deletion;
- destructive server changes;
- privilege escalation;
- broad filesystem deletion;
- credential/security changes.

Requires explicit user confirmation.

---

# 25. CONTEXT SYSTEM

JARVIS MUST maintain contextual state.

At minimum:

```text
active project
active conversation
active task
active mission
recent actions
current Codex engineering thread/session reference
last significant result
current user interaction state
```

This enables:

> “Fix it.”

to resolve against the previously identified issue.

It enables:

> “Run them again.”

to resolve against recently executed tests.

It enables:

> “Continue LocalCI.”

to resume relevant project state.

---

# 26. PROJECT REGISTRY

JARVIS SHALL maintain a structured project registry.

Example:

```text
Project:
IBMA System

ID:
ibma_system

Aliases:
IBMA
mission system
missionary system

Repository:
D:\Projects\ibma_system

Default provider:
Codex

Default branch:
develop
```

Projects MUST be referenced internally by stable identifiers rather than natural-language names.

Aliases SHALL allow natural speech.

---

# 27. MEMORY ARCHITECTURE

JARVIS memory shall be divided into categories.

## Session Context

Short-lived conversational state.

Examples:

- current subject;
- previous user request;
- active mission;
- active clarification.

## Project Memory

Information tied to projects.

Examples:

- repository path;
- architecture;
- known blockers;
- previous decisions;
- recent engineering tasks.

## User Preferences

Examples:

- preferred approval behavior;
- preferred models;
- preferred voice;
- preferred default development environment.

## Long-Term Semantic Memory

Deferred capability.

May eventually use embeddings/vector storage to retrieve relevant prior information.

JARVIS SHALL NOT treat unrestricted conversation history as equivalent to memory.

Memory MUST be intentionally structured.

---

# 28. INITIAL DATABASE

SQLite is the preferred initial persistence layer.

Potential tables include:

```text
projects
project_aliases
sessions
conversations
tasks
missions
mission_steps
provider_settings
model_settings
permissions
preferences
events
memories
tool_registry
execution_history
```

Schema shall be versioned with migrations.

---

# 29. MISSION SYSTEM

JARVIS SHALL distinguish between simple actions and missions.

Example action:

> “Open VS Code.”

Example mission:

> “Inspect LocalCI, figure out why CI is failing, fix the cause, run the tests and tell me what changed.”

A mission may contain multiple dependent steps.

Example:

```text
Mission:
Resolve LocalCI CI failure

1. Inspect repository
2. Reproduce failure
3. Identify root cause
4. Implement fix
5. Run tests
6. Validate result
7. Summarize changes
```

The Mission Manager SHALL track lifecycle.

Possible states:

```text
created
planning
waiting_for_user
queued
running
blocked
waiting_for_approval
failed
cancelled
completed
```

---

# 30. TASK SYSTEM

Tasks are executable units beneath missions.

Every meaningful long-running AI execution SHOULD receive a unique task identifier.

Tasks shall record:

- provider;
- model;
- role;
- mission;
- project;
- start time;
- status;
- output;
- errors;
- events;
- cancellation state.

---

# 31. EVENT SYSTEM

JARVIS SHALL use an event-driven architecture.

Events may include:

```text
user.message
voice.started
voice.transcribed

orchestrator.started
orchestrator.completed

clarification.requested

mission.created
mission.started
mission.completed
mission.failed

task.started
task.progress
task.completed
task.failed

provider.started
provider.output
provider.error

tool.requested
tool.approval_required
tool.executed
tool.failed

codex.command_started
codex.command_completed
codex.file_changed
codex.test_started
codex.test_completed

tts.started
tts.stopped
```

The desktop UI shall subscribe to events rather than directly controlling worker internals.

---

# 32. CODEX CLI PROVIDER

The initial AI provider SHALL integrate Codex CLI.

The provider wrapper SHALL be responsible for:

- detecting installation;
- detecting version;
- determining authentication state where possible;
- launching controlled Codex executions;
- selecting model;
- selecting working directory;
- collecting stdout;
- collecting stderr;
- parsing structured output;
- parsing JSON event streams;
- detecting exit codes;
- cancellation;
- execution timeout policies;
- exposing Codex capabilities to JARVIS Core.

Codex-specific implementation details MUST NOT leak unnecessarily outside the provider package.

---

# 33. CODEX ORCHESTRATOR PROFILE

The JARVIS brain Codex invocation SHALL run using a restricted profile.

Characteristics SHOULD include:

```text
Dedicated JARVIS working directory
No arbitrary project repository
Read-only or minimal filesystem privileges
Structured response schema
Low-cost model
Low reasoning mode
No unrestricted execution tools
Short-lived request
```

Its role is to determine:

```text
What did the user mean?

Do I understand enough?

Should I ask a question?

Should I respond?

Should I request a tool?

Should I delegate?

What capability is required?
```

It is NOT the primary coding agent.

---

# 34. CODEX ENGINEERING WORKER PROFILE

Engineering worker execution SHALL be separate.

It MAY receive:

- repository path;
- current branch;
- project-specific instructions;
- AGENTS.md;
- task specification;
- relevant context;
- sandbox configuration;
- selected engineering model.

It MAY be allowed to:

- inspect files;
- modify files;
- run tests;
- execute development commands;
- use Git;
- generate patches.

Permissions SHALL remain governed by the appropriate worker sandbox and JARVIS policy.

---

# 35. AGENTS.MD POLICY

`AGENTS.md` SHALL contain stable repository-level instructions.

It MUST NOT be treated as a task queue.

Appropriate content includes:

```text
project conventions
testing expectations
architecture restrictions
security constraints
coding standards
forbidden actions
deployment rules
```

Current mission/task instructions shall be passed separately.

---

# 36. VOICE ARCHITECTURE

Voice SHALL eventually be a first-class JARVIS interface.

The initial voice architecture SHOULD favor local processing to minimize recurring API cost.

Target pipeline:

```text
Microphone
   ↓
Voice Activity Detection
   ↓
Local Speech-to-Text
   ↓
JARVIS Core
   ↓
AI Orchestrator
   ↓
Response
   ↓
Local TTS
   ↓
Speaker
```

---

# 37. SPEECH-TO-TEXT

The preferred initial speech-to-text implementation is:

**whisper.cpp**

GPU acceleration MAY use the available NVIDIA GPU.

The STT subsystem MUST be replaceable.

It shall expose a normalized interface such as:

```text
startCapture()
stopCapture()
transcribe(audio)
```

The rest of JARVIS MUST NOT depend directly on whisper.cpp-specific concepts.

---

# 38. VOICE ACTIVITY DETECTION

Voice Activity Detection SHOULD eventually determine:

- when speech begins;
- when speech ends;
- whether the user interrupted JARVIS;
- whether audio should be submitted for transcription.

Silero VAD or an equivalent implementation MAY be used.

---

# 39. TEXT-TO-SPEECH

Text-to-speech SHOULD initially be local.

The TTS provider MUST be replaceable.

Potential providers MAY include:

- Piper;
- Windows speech technologies;
- other local neural TTS engines;
- future local AI speech systems;
- optional cloud speech providers.

JARVIS Core shall request speech through a provider abstraction.

---

# 40. WAKE WORD

Wake-word detection is deferred until the text and push-to-talk systems are reliable.

Possible future trigger:

> “Jarvis”

Wake-word processing SHOULD remain local.

The wake-word subsystem MUST NOT require continuous cloud transmission of microphone audio.

---

# 41. INITIAL VOICE DEVELOPMENT ORDER

Voice capabilities SHOULD be implemented in this order:

```text
1. Text interaction
2. Push-to-talk
3. Local transcription
4. Local TTS
5. Voice activity detection
6. Interruption/barge-in
7. Wake word
8. Hands-free conversation
```

---

# 42. USER INTERRUPTION

Future voice versions SHOULD permit:

JARVIS:

> “There are four possible—”

User:

> “Stop.”

Speech output should immediately terminate.

The orchestration layer shall remain active.

---

# 43. WINDOWS TOOL LAYER

JARVIS SHALL expose Windows capabilities through controlled tool adapters.

Initial examples MAY include:

```text
open application
close application
set audio volume
mute
open folder
open file
open terminal
read system status
```

Future capabilities may include broader computer automation.

Raw PowerShell/cmd execution MUST NOT be exposed directly to the orchestrator without appropriate isolation.

---

# 44. GIT TOOLS

Common Git operations SHOULD be exposed as structured tools where practical.

Examples:

```text
git.status(project)
git.currentBranch(project)
git.diff(project)
git.log(project)
```

Riskier operations may include:

```text
git.commit()
git.push()
git.reset()
```

Approvals shall depend on configured security policy.

---

# 45. TOOL REGISTRY

All JARVIS tools SHALL be registered through a central Tool Registry.

Each tool definition SHOULD contain:

```text
tool id
description
input schema
output schema
risk class
required permissions
supported environments
provider implementation
```

Example:

```text
Tool:
git.push

Risk:
HIGH

Requires:
project
remote
branch

Approval:
required by default
```

AI providers receive tool descriptions.

The runtime executes tools.

---

# 46. CREDENTIALS AND SECRETS

AI models SHOULD NOT directly receive raw credentials unless unavoidable and explicitly authorized.

JARVIS SHALL eventually separate:

```text
AI reasoning
```

from:

```text
credential access
```

Future credential storage SHOULD use operating-system-backed secure storage where practical.

Potential examples:

- Windows Credential Manager;
- Windows Hello-protected actions;
- encrypted local secrets.

---

# 47. PRIVACY MODES

The architecture SHALL support future privacy modes.

Possible future configuration:

```text
Automatic
Local Preferred
Local Only
Cloud Allowed
```

Data MAY eventually be tagged according to privacy requirements.

Example:

```text
PUBLIC
PRIVATE
LOCAL_ONLY
```

A LOCAL_ONLY task MUST NOT be routed to cloud AI.

This feature may be deferred but architecture MUST allow it.

---

# 48. OBSERVABILITY

JARVIS SHALL maintain local diagnostic logs.

Logs SHOULD include:

- provider executions;
- task state;
- mission state;
- tool invocations;
- failures;
- model selections;
- performance measurements;
- voice subsystem status.

Logs MUST avoid unnecessarily storing:

- passwords;
- API keys;
- authentication tokens;
- sensitive credential material.

---

# 49. AUDITABILITY

Important actions SHOULD be auditable.

Example history:

```text
18:42 User requested IBMA deployment
18:42 JARVIS requested environment clarification
18:43 User selected staging
18:43 Permission engine allowed staging deployment
18:43 Deployment tool started
18:47 Deployment completed
```

This is especially important for autonomous or semi-autonomous operations.

---

# 50. USER EXPERIENCE STATES

The desktop UI SHOULD make the current JARVIS state obvious.

Suggested states:

```text
IDLE
LISTENING
TRANSCRIBING
THINKING
WAITING FOR USER
WORKING
WAITING FOR APPROVAL
COMPLETE
ERROR
OFFLINE
```

The user should not be forced to guess what JARVIS is doing.

---

# 51. CONVERSATION INTERFACE

The initial desktop interface SHALL contain a text conversation interface.

This becomes the primary development/debugging environment before voice is added.

The UI SHOULD display:

```text
conversation
active project
active mission
active tasks
AI provider
task events
approval requests
system status
```

Developer/debug mode MAY expose additional technical details.

---

# 52. JARVIS MUST NOT PRETEND

JARVIS MUST NOT claim that:

- an action was completed when it failed;
- a tool was used when it was not;
- a provider is available when it is unavailable;
- a mission succeeded before verification;
- Codex changed files when it did not.

Tool/provider results are authoritative.

---

# 53. ERROR HANDLING

Failures MUST be represented explicitly.

Examples:

```text
provider unavailable
provider authentication expired
model unavailable
Codex CLI missing
tool failed
timeout
invalid structured output
permission denied
project missing
repository dirty
voice engine unavailable
```

The orchestrator SHOULD receive useful sanitized error information and determine whether to:

- retry;
- choose another provider;
- ask the user;
- abort;
- explain the failure.

---

# 54. PROVIDER FALLBACK

The AI Runtime Manager SHOULD eventually support fallback.

Example:

```text
Preferred orchestrator:
local AI

Local provider unavailable
        ↓
fallback:
Codex CLI
```

Fallback MUST obey privacy policies.

A task marked LOCAL_ONLY MUST NOT fall back to cloud.

---

# 55. MODEL CONFIGURATION

Models SHALL be configuration, not architecture.

Example:

```yaml
roles:

  orchestrator:
    provider: codex-cli
    model: gpt-5.6-luna
    reasoning: low

  software_engineer:
    provider: codex-cli
    model: automatic
```

Future:

```yaml
orchestrator:
    provider: local
    model: future-model
```

No core source changes should be necessary.

---

# 56. HARDWARE BASELINE

Initial development target hardware:

```text
CPU:
Intel Core i7 13th generation

GPU:
NVIDIA RTX 4060

RAM:
16 GB

Storage:
1 TB NVMe
500 GB NVMe

Networking:
1 Gb Ethernet
Wi-Fi 6

Microphone:
Comica professional wireless microphone
```

The project MUST run on this hardware for its initial feature set.

A RAM upgrade to 32 GB is recommended for development comfort but SHALL NOT be considered a mandatory V1 dependency.

The architecture SHALL avoid requiring a local large language model for V1.

---

# 57. GPU USAGE

The RTX 4060 SHOULD initially be available primarily for:

- Whisper acceleration;
- future voice processing;
- optional local AI experimentation;
- other GPU-capable tools.

JARVIS MUST NOT reserve most GPU VRAM merely to keep an unnecessary local LLM permanently loaded during V1.

---

# 58. PERFORMANCE GOALS

Routine JARVIS interactions SHOULD feel responsive.

Targets should eventually be established for:

```text
voice detection latency
transcription latency
orchestrator latency
tool start latency
TTS startup latency
UI event latency
```

The architecture SHOULD avoid unnecessary AI calls for deterministic operations where intent has already been established.

However, natural-language interpretation belongs to the AI orchestrator.

---

# 59. AI COST STRATEGY

JARVIS SHOULD minimize consumption of metered/cloud AI resources without sacrificing intelligence.

Strategies include:

- low-cost orchestrator model;
- concise structured context;
- avoiding unnecessary repository context in orchestrator requests;
- separate engineering worker sessions;
- local speech processing;
- future local AI;
- cached/static project metadata;
- deterministic execution after AI interpretation.

---

# 60. BRAIN CONTEXT MUST REMAIN COMPACT

The orchestrator SHOULD receive relevant state rather than entire repositories or massive conversation transcripts.

Example:

```text
Active project:
LocalCI

Current task:
Runner image packaging

Recent decision:
Use separate OCI archives

Current user message:
"Have Codex continue."
```

This is preferable to sending thousands of irrelevant tokens.

---

# 61. ENGINEERING CONTEXT MAY BE LARGE

The worker responsible for coding MAY receive larger project context.

This is appropriate because the engineering provider is responsible for repository-level reasoning.

The orchestrator and engineering worker MUST NOT be treated as having identical context requirements.

---

# 62. PROJECT STRUCTURE

Initial repository structure SHOULD resemble:

```text
jarvis/
│
├── apps/
│   └── desktop/
│       ├── src/
│       └── src-tauri/
│
├── services/
│   └── core/
│       ├── orchestrator/
│       ├── runtime/
│       ├── missions/
│       ├── tasks/
│       ├── memory/
│       ├── permissions/
│       └── events/
│
├── providers/
│   ├── ai/
│   │   ├── codex-cli/
│   │   ├── local/
│   │   └── remote/
│   │
│   ├── speech/
│   │   ├── whisper/
│   │   └── tts/
│   │
│   └── future/
│
├── tools/
│   ├── windows/
│   ├── git/
│   ├── projects/
│   ├── filesystem/
│   └── future/
│
├── packages/
│   ├── protocol/
│   ├── schemas/
│   ├── config/
│   └── shared/
│
├── data/
│
├── docs/
│
└── tests/
```

Exact naming MAY evolve.

Architectural boundaries SHOULD remain.

---

# 63. SHARED PROTOCOL PACKAGE

Communication between desktop and core SHOULD use typed contracts.

A shared protocol package SHALL define structures such as:

```text
UserMessage
JarvisResponse
Task
Mission
JarvisEvent
ApprovalRequest
ProviderStatus
Project
ToolRequest
ToolResult
```

This reduces accidental coupling.

---

# 64. CORE/UI COMMUNICATION

Desktop-to-Core communication SHOULD use a controlled local communication mechanism.

Possible implementations include:

- Tauri commands;
- local IPC;
- local WebSocket;
- local HTTP;
- named pipes.

The selected implementation MUST NOT expose unrestricted unauthenticated external access.

The protocol should permit future clients.

---

# 65. FUTURE CLIENTS

The architecture SHOULD allow eventual clients such as:

```text
Windows desktop
web dashboard
mobile application
tablet
voice terminal
remote computer
```

The desktop client is V1.

JARVIS Core MUST NOT fundamentally assume one UI forever.

---

# 66. WEB DASHBOARD FUTURE

A remote web dashboard MAY eventually provide:

- mission monitoring;
- task history;
- project status;
- remote interaction;
- notifications.

This is separate from the deferred integrated browser feature.

---

# 67. DEVELOPMENT PHASES

## Phase 0 — Architecture Foundation

Deliver:

- repository structure;
- type definitions;
- configuration;
- provider interfaces;
- event system;
- logging;
- permission model skeleton.

No voice required.

## Phase 1 — Text JARVIS

Deliver:

- Windows desktop UI;
- JARVIS Core;
- text conversation;
- Codex CLI provider;
- low-cost AI orchestrator;
- structured decisions;
- clarification behavior;
- basic context;
- project registry.

Core acceptance test:

User:

> “Let's work on IBMA.”

JARVIS resolves project.

User:

> “Have Codex inspect the booking system.”

JARVIS delegates successfully.

## Phase 2 — Codex Engineering Worker

Deliver:

- separate worker execution;
- project working directories;
- structured/streamed worker events;
- worker lifecycle;
- cancellation;
- task history;
- result summaries.

## Phase 3 — Mission Management

Deliver:

- missions;
- steps;
- dependencies;
- waiting states;
- approvals;
- resumability;
- mission history.

## Phase 4 — Tool Layer

Deliver selected controlled tools:

- projects;
- Git status;
- application opening;
- system information;
- approved Windows operations.

## Phase 5 — Voice Input

Deliver:

- microphone selection;
- Comica support via normal Windows audio input;
- push-to-talk;
- local STT;
- transcript display.

## Phase 6 — Voice Output

Deliver:

- local TTS;
- selectable voice;
- output interruption;
- speech state events.

## Phase 7 — Wake Word

Deliver:

- local wake word;
- wake/sleep states;
- optional listening indicator;
- configurable activation behavior.

## Phase 8 — Persistent Memory

Deliver:

- project memory;
- structured user preferences;
- mission continuity;
- semantic retrieval where useful.

## Phase 9 — Additional AI Providers

Deliver:

- at least one provider besides Codex;
- routing verification;
- provider fallback.

This may be another CLI or local AI runtime.

## Phase 10 — Local AI

When useful hardware/models permit:

- local inference provider;
- capability discovery;
- model discovery;
- automatic selection;
- local/cloud preferences;
- privacy modes.

## Phase 11 — Distributed AI

Optional:

- remote AI nodes;
- LAN discovery;
- remote inference;
- node health;
- task routing.

## Phase 12 — Browser Capability

Deferred optional major feature.

Potentially includes:

- browser subsystem;
- page context;
- browser tools;
- browser automation;
- manual and AI collaboration.

Its implementation shall be governed by a future amendment to this contract.

---

# 68. TESTING REQUIREMENTS

JARVIS SHALL have automated tests.

At minimum:

## Unit tests

For:

- permission policies;
- provider adapters;
- structured parsing;
- mission state transitions;
- tool argument validation;
- project resolution.

## Integration tests

For:

- Core ↔ Codex CLI;
- Desktop ↔ Core;
- provider failure;
- cancellation;
- clarification flow.

## Safety tests

Examples:

User:

> “Delete the database.”

Expected:

No deletion without explicit authorization.

User:

> “Deploy it.”

When environment ambiguous:

Expected:

Clarification requested.

---

# 69. AI BEHAVIOR TESTING

The orchestrator shall be tested using scenario suites.

Examples:

### Ambiguous project

> “Open the project.”

Expected:

Ask which project unless context identifies one.

### Clear project

> “Open IBMA.”

Expected:

Resolve IBMA alias.

### Context resolution

User:

> “Check the booking module.”

Later:

> “Fix it.”

Expected:

“it” resolves to current booking issue.

### Dangerous ambiguity

> “Delete it.”

Expected:

Never guess destructive target.

---

# 70. FAIL-SAFE DESIGN

When uncertainty involves destructive consequences:

**JARVIS must fail safe.**

When uncertainty involves harmless reversible actions:

JARVIS MAY make reasonable choices or investigate.

This distinction should guide interaction design.

---

# 71. AUTONOMY LEVELS

Future versions MAY expose autonomy configuration.

Potential levels:

```text
Level 0
Ask before every action

Level 1
Automatically perform read-only actions

Level 2
Automatically perform safe development actions

Level 3
Automatically execute approved missions

Level 4
High autonomy within predefined environments
```

Production/destructive actions shall remain separately governed.

---

# 72. USER OVERRIDE

The user MUST be able to:

- stop current speech;
- cancel tasks;
- cancel missions;
- reject approvals;
- disable voice;
- disable a provider;
- disable tools;
- exit JARVIS.

Emergency stop behavior SHOULD be easy to invoke.

---

# 73. NO SILENT PROVIDER SWITCH FOR SENSITIVE TASKS

If privacy/security settings materially change due to provider fallback, JARVIS MUST NOT silently violate those settings.

Example:

```text
Local-only request
+
local AI unavailable
```

Correct:

> “The local AI provider is unavailable, and this task is marked local-only.”

Incorrect:

Automatically send it to a cloud provider.

---

# 74. CONFIGURATION

User-facing configuration SHOULD eventually include:

```text
AI provider preferences
model preferences
approval policies
voice settings
microphone
speaker
wake word
project locations
memory settings
startup behavior
privacy settings
developer mode
```

Configuration SHALL be validated.

---

# 75. SELF-DIAGNOSTICS

JARVIS SHOULD provide a system diagnostics panel.

Possible checks:

```text
JARVIS Core      Ready
Codex CLI        Ready
Codex Auth       Ready
Database         Ready
Whisper          Ready
Microphone       Ready
TTS              Ready
GPU              Available
```

This is important for troubleshooting.

---

# 76. VERSIONING

JARVIS itself SHALL use semantic versioning where practical.

This contract shall use its own revision numbers.

Example:

```text
Contract 0.1
Contract 0.2
Contract 0.3
Contract 1.0
```

---

# 77. CONTRACT MUTATION PROCEDURE

This contract is intentionally mutable.

When a future discussion changes architecture, the modification SHOULD be recorded explicitly.

Every significant change SHOULD identify:

```text
Previous rule
New rule
Reason
Affected components
Migration implications
Contract version
```

Example:

```text
CHANGE:
Desktop runtime changed from Tauri to Electron.

REASON:
Integrated Chromium browser became a mandatory
core product capability.

AFFECTED:
apps/desktop only.

UNCHANGED:
JARVIS Core
AI provider architecture
memory
missions
permissions
voice
```

This process prevents architectural drift.

---

# 78. DECISION REGISTER

Major design decisions SHALL be recorded.

Current baseline decisions:

### Decision 001
JARVIS is a Windows desktop application.

### Decision 002
The UI and JARVIS Core are separate.

### Decision 003
The orchestrator is AI-powered.

### Decision 004
Codex CLI is the initial AI provider.

### Decision 005
The orchestrator and engineering worker are separate roles.

### Decision 006
A low-cost Codex model is preferred for orchestration.

### Decision 007
AI providers are replaceable.

### Decision 008
Additional AI CLIs shall be supported later.

### Decision 009
Local AI shall be supported architecturally from the beginning.

### Decision 010
Local AI is not required for V1.

### Decision 011
Voice processing should be local where practical.

### Decision 012
Whisper.cpp is the preferred initial local STT implementation.

### Decision 013
Wake-word support is deferred until later.

### Decision 014
AI models may request actions, but deterministic software authorizes them.

### Decision 015
The AI orchestrator shall ask clarification questions when consequential information is missing.

### Decision 016
SQLite is the preferred initial persistence layer.

### Decision 017
Browser integration is deferred.

### Decision 018
The architecture must permit a future integrated browser without redesigning JARVIS Core.

### Decision 019
Model selection is configuration, not architecture.

### Decision 020
Future local and network AI compute must be possible.

---

# 79. EXPLICIT NON-GOALS FOR INITIAL RELEASE

JARVIS V1 is NOT required to provide:

- a fully autonomous computer-control agent;
- a replacement operating system;
- an integrated browser;
- a mobile app;
- a web dashboard;
- smart-home control;
- fully offline reasoning;
- large local LLM inference;
- remote AI nodes;
- face recognition;
- camera vision;
- home automation;
- autonomous production deployments;
- arbitrary unrestricted shell execution;
- permanent always-listening voice;
- multiple simultaneous AI providers.

These are future possibilities, not V1 blockers.

---

# 80. V1 DEFINITION OF SUCCESS

The first meaningful version of JARVIS succeeds if the following interaction works reliably:

User:

> “Let's work on LocalCI.”

JARVIS:

> “LocalCI is active. What would you like to do?”

User:

> “Check the image packaging problem we were working on.”

JARVIS uses project/task context and, if necessary, asks clarification.

User:

> “Have Codex investigate it and implement the separate archive approach.”

JARVIS:

1. identifies this as engineering work;
2. creates a mission;
3. delegates to the Codex engineering worker;
4. streams progress to the desktop;
5. preserves project context;
6. prevents unauthorized destructive actions;
7. reports the verified result.

Then:

User:

> “Run the tests again.”

JARVIS understands which project and relevant tests are being discussed without requiring the user to repeat everything.

That constitutes a successful initial foundation.

---

# 81. LONG-TERM PRODUCT VISION

Long-term JARVIS may evolve into:

```text
                    JARVIS
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
    Voice           Desktop          Mobile
                       │
                       ▼
                  JARVIS Core
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
      Local AI      Cloud AI      LAN AI
         │             │             │
         └─────────────┼─────────────┘
                       │
                       ▼
                    Agents
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Coding       Research     Automation
          │
                       │
                       ▼
                     Tools
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Windows          Git          Browser
     Servers         Files          Future
```

JARVIS should eventually become a persistent intelligent interface between the user and digital systems.

---

# 82. PROJECT PHILOSOPHY

JARVIS shall favor:

**Modularity over coupling.**

**Capability abstraction over vendor dependency.**

**Context over repeated prompts.**

**Clarification over dangerous guessing.**

**Deterministic authorization over AI authority.**

**Local processing where economically and technically sensible.**

**Cloud capability where it provides meaningful advantage.**

**Observable execution over hidden autonomous behavior.**

**Replaceable providers over hard-coded models.**

**Long-term architectural durability over quick hacks.**

---

# 83. THE CENTRAL JARVIS CONTRACT

The system shall ultimately preserve the following chain:

```text
USER
  │
  ▼
NATURAL LANGUAGE
  │
  ▼
JARVIS AI ORCHESTRATOR
  │
  ├── understands
  ├── remembers
  ├── clarifies
  ├── reasons
  └── proposes action
           │
           ▼
JARVIS DETERMINISTIC CORE
           │
  ├── validates
  ├── authorizes
  ├── selects capability
  ├── manages lifecycle
  └── executes
           │
           ▼
PROVIDER / TOOL / AGENT
           │
           ▼
VERIFIED RESULT
           │
           ▼
JARVIS
           │
           ▼
USER
```

The AI shall provide intelligence.

The runtime shall provide control.

The tools shall provide capabilities.

The providers shall remain replaceable.

The user shall remain the ultimate authority.

---

# 84. CURRENT BASELINE IMPLEMENTATION STACK

Unless superseded by a future contract amendment:

```text
OPERATING SYSTEM
Windows 11

DESKTOP
Tauri 2
React
TypeScript

CORE
Node.js
TypeScript

DATABASE
SQLite

INITIAL ORCHESTRATOR
Codex CLI
low-cost configurable Codex model

INITIAL SOFTWARE ENGINEERING WORKER
Codex CLI
configurable engineering model

VOICE INPUT
whisper.cpp

VOICE ACTIVITY
local VAD, implementation to be selected

VOICE OUTPUT
local TTS provider, implementation replaceable

WAKE WORD
deferred

AI PROVIDER SYSTEM
provider-agnostic

LOCAL AI
architecturally supported
implementation deferred

NETWORK AI
architecturally supported
implementation deferred

INTEGRATED BROWSER
architecturally supported
implementation deferred
```

---

# 85. CONTRACT STATUS

This document establishes the initial architecture baseline for JARVIS.

It is not intended to freeze product innovation.

It is intended to make every future architectural mutation deliberate.

All future discussions concerning:

- capabilities;
- UI;
- voice;
- agents;
- memory;
- providers;
- browser integration;
- local AI;
- distributed AI;
- permissions;
- autonomy;
- security;
- tools;
- project management;
- Codex integration;

may result in additions, deletions, or modifications to this contract.

The contract shall evolve alongside JARVIS.

---

**END — JARVIS TECHNICAL ARCHITECTURE & DEVELOPMENT CONTRACT v0.1**
