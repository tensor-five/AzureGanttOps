export const REQUIRED_MAPPING_FIELDS = ["id", "title", "start", "endOrTarget"] as const;

export type RequiredMappingField = (typeof REQUIRED_MAPPING_FIELDS)[number];

export type RequiredFieldMappings = {
  id: string;
  title: string;
  start: string;
  endOrTarget: string;
};

export type FieldMappingProfile = {
  id: string;
  name: string;
  fields: RequiredFieldMappings;
};

export const REQUIRED_FIELD_LABELS: Record<RequiredMappingField, string> = {
  id: "ID",
  title: "Title",
  start: "Start Date",
  endOrTarget: "End/Target Date"
};

export function normalizeProfile(profile: FieldMappingProfile): FieldMappingProfile {
  return {
    id: profile.id.trim(),
    name: profile.name.trim(),
    fields: {
      ...profile.fields
    }
  };
}
