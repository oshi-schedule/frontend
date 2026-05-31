export type UserEventStatus = "interested" | "attending" | "attended";
export type ScheduleType = "event" | "hotel" | "train" | "flight" | "custom";

export interface Venue {
  id: string;
  display_name: string;
  address: string | null;
}

export interface EventCore {
  id: string;
  display_name: string;
  canonical_name: string;
  event_date: string;
  venue: Venue | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EventListResponse {
  items: EventCore[];
  total: number;
}

export interface EventUpdatePayload {
  display_name?: string | null;
  canonical_name?: string | null;
  event_date?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  description?: string | null;
  status?: string | null;
}

export interface TimetableBulkItem {
  group_name?: string | null;
  session_type: string;
  start_at: string;
  end_at: string;
  stage_name?: string | null;
  notes?: string | null;
}

export interface TimetableBulkPayload {
  items: TimetableBulkItem[];
  source?: string | null;
  note?: string | null;
}

export interface EventCreatePayload {
  display_name: string;
  canonical_name?: string | null;
  event_date: string;
  venue_id?: string | null;
  venue_name?: string | null;
  description?: string | null;
  aliases: string[];
  group_ids: string[];
}

export interface TimetableItem {
  id: string;
  title: string;
  group_id: string | null;
  stage_name: string | null;
  start_time: string;
  end_time: string;
  session_type: string;
  notes: string | null;
}

export interface TimetableItemPayload {
  title: string;
  group_id?: string | null;
  stage_name?: string | null;
  start_time: string;
  end_time: string;
  session_type: string;
  notes?: string | null;
  member_ids: string[];
}

export interface Timetable {
  id: string;
  event_id: string;
  version: number;
  title: string | null;
  note: string | null;
  is_active: boolean;
  source: string | null;
  items: TimetableItem[];
  created_at: string;
}

export interface TimetablePayload {
  title?: string | null;
  note?: string | null;
  source?: string | null;
  base_version?: number | null;
  items: TimetableItemPayload[];
}

export interface SearchResult {
  entity_type: "event" | "group" | "member" | "venue" | string;
  id: string;
  display_name: string;
  matched_by: string;
  status: string;
}

export interface SearchResponse {
  query: string;
  items: SearchResult[];
}

export interface UserEvent {
  id: string;
  user_id: string;
  event_id: string;
  status: UserEventStatus;
  name: string | null;
  event: EventCore | null;
  created_at: string;
  updated_at: string;
}

export interface UserScheduleItem {
  id: string;
  user_event_id: string | null;
  event_id: string | null;
  timetable_item_id: string | null;
  schedule_type: ScheduleType;
  title: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  event: EventCore | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarDayResponse {
  date: string;
  user_events: UserEvent[];
  user_schedule_items: UserScheduleItem[];
}

export interface CalendarMonthDay {
  date: string;
  user_event_count: number;
  user_schedule_count: number;
}

export interface CalendarMonthResponse {
  year: number;
  month: number;
  days: CalendarMonthDay[];
}

export interface GroupSummary {
  id: string;
  display_name: string;
  canonical_name: string;
  status: string;
}

export interface MemberSummary {
  id: string;
  display_name: string;
  canonical_name: string;
  status: string;
  member_color: string | null;
  x_screen_name: string | null;
}

export interface GroupDetail extends GroupSummary {
  members: MemberSummary[];
}

export interface VenueSummary {
  id: string;
  display_name: string;
  canonical_name: string;
  address: string | null;
  status: string;
}

export interface SourceRead {
  id: string;
  event_id: string | null;
  source_type: string;
  source_url: string | null;
  metadata_json: Record<string, unknown> | null;
  status: string;
  assets: { id: string; asset_type: string; storage_url: string; checksum: string | null }[];
  created_at: string;
  updated_at: string;
}
