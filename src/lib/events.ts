import eventsData from "@/data/haas-events.json";
import type { HaasEvent, RawHaasEvent } from "@/types/event";

function normalize(raw: RawHaasEvent): HaasEvent {
  return {
    ...raw,
    title: raw.title.val,
  };
}

const allEvents: HaasEvent[] = (eventsData as RawHaasEvent[]).map(normalize);

export function getAllEvents(): HaasEvent[] {
  return allEvents;
}

export function getEventByUid(uid: string): HaasEvent | undefined {
  return allEvents.find((e) => e.uid === uid);
}
