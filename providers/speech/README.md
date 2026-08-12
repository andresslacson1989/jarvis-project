# Speech Provider Adapter Boundary

`providers/speech` owns speech-provider-specific adapters for qualified STT, VAD, TTS, AEC, or related voice mechanisms.

Provider-native data and device/runtime details remain in adapter/platform layers. This namespace does not grant execution authority or imply any voice stack is selected, packaged, or supported; those decisions and qualifications belong to the voice feasibility and production sections.
