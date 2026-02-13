/** Normalized Haas event with a flat title string */
export interface HaasEvent {
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  url: string;
  uid: string;
  latitude: number | null;
  longitude: number | null;
  distanceFromHaas: number | null;
}

/** Raw shape from haas-events.json before normalization */
export interface RawHaasEvent {
  title: { params: { ENCODING: string }; val: string };
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  url: string;
  uid: string;
  latitude: number | null;
  longitude: number | null;
  distanceFromHaas: number | null;
}
