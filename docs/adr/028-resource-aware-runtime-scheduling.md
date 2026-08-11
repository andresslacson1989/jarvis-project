# ADR-028: Resource-Aware Runtime Scheduling

**Status:** Accepted  
**Date:** August 11, 2026

## Context

JARVIS will run alongside Windows, development tools, browsers, Codex, local speech recognition, text-to-speech, VAD, acoustic echo cancellation, and potentially future local AI models. On systems with limited RAM or VRAM, keeping every provider loaded at all times can cause paging, model thrashing, latency spikes, or outright failures.

The user approved a production-ready approach in which JARVIS adapts to available hardware rather than assuming all components can remain loaded simultaneously.

## Decision

JARVIS SHALL implement resource-aware provider scheduling.

Latency-critical lightweight components SHOULD remain warm continuously when their feature is enabled. These include, where applicable:

- wake-word detection;
- VAD;
- acoustic echo cancellation / audio processing;
- the Voice Session Manager;
- JARVIS Core.

Components that materially increase memory, VRAM, CPU, or GPU pressure SHOULD be warmed only when needed. These may include:

- speech-to-text models;
- default TTS providers;
- high-quality or premium TTS models;
- local AI models;
- vision models;
- specialist providers.

Providers SHOULD expose resource metadata where practical, including approximate:

- RAM use;
- VRAM use;
- CPU requirements;
- GPU requirements;
- warm-up cost;
- expected latency;
- whether the provider can unload or suspend cleanly.

The runtime SHALL avoid combinations known to overcommit available system resources.

When a requested combination cannot run comfortably, JARVIS SHALL prefer graceful degradation over resource exhaustion. Depending on policy and capability requirements, this MAY include:

- selecting a lighter provider;
- moving a workload from GPU to CPU where appropriate;
- routing intelligence to a cloud provider;
- unloading an idle heavy model;
- delaying non-latency-critical model warm-up;
- declining a request with a clear explanation if no compliant option is available.

JARVIS MUST NOT assume that all providers can remain loaded simultaneously.

## Hardware Position

JARVIS V1 SHOULD remain functional on a 16 GB RAM Windows system.

32 GB RAM is the recommended development configuration for improved multitasking headroom and reduced paging during concurrent development workloads.

This recommendation is not an architectural minimum requirement.

## Rationale

This design keeps JARVIS responsive on modest hardware, reduces unpredictable paging and VRAM thrashing, and prepares the runtime for future systems with heterogeneous CPU, GPU, NPU, local, and remote compute resources.

## Consequences

The Provider Supervisor and runtime routing layers must coordinate provider lifecycle with resource availability.

Resource use becomes a first-class routing input rather than an incidental implementation detail.
