export interface MissionControlViewModel {
  readonly title: "Mission Control";
  readonly coreState: "LOCKED";
}

export function createMissionControlViewModel(): MissionControlViewModel {
  return Object.freeze({ title: "Mission Control", coreState: "LOCKED" });
}
