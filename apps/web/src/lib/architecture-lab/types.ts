export type ArchitecturePlacement = Record<string, string | null>;

export interface ArchitectureSource {
  title: string;
  url: string;
  license: string;
}

export interface ArchitectureZone {
  id: string;
  label: string;
  description: string;
}

export interface ArchitectureComponent {
  id: string;
  label: string;
  description: string;
  /** More than one zone may be sound: real design questions rarely have one pixel-perfect answer. */
  acceptedZoneIds: string[];
  feedback: string;
}

export interface ArchitectureScenario {
  id: string;
  title: string;
  brief: string;
  successMessage: string;
  zones: ArchitectureZone[];
  components: ArchitectureComponent[];
  sources: ArchitectureSource[];
}

export interface ArchitectureCheck {
  correct: boolean;
  placedCount: number;
  totalCount: number;
  results: Record<string, { correct: boolean; message: string }>;
}
