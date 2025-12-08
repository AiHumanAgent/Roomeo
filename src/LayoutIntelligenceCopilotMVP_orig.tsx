import React, { useMemo, useRef, useState } from "react";

/**
 * Layout Intelligence Copilot MVP (V1 Reset)
 * -----------------------------------------
 * Clean, compile-safe baseline that matches the *original MVP spirit*.
 * Rebuilt to avoid the brittle mega-component drift of V2/V3.
 *
 * Included:
 * - Multi-floor abstract hotel
 * - Hotel-in-totality floor navigator
 * - Guest vs Staff mode
 * - Preferences (quiet vs convenience, avoid elevator, premium tolerance)
 * - Staff authoring: add landmarks + drag into hallway slots
 * - Guest Waze-lite signals modal (simple)
 * - Simple recommendations per active floor
 *
 * Not included yet (by design):
 * - Voice/video/sketch ingestion
 * - Facade / 3D
 * - Persistence
 */

// -----------------------------
// Types
// -----------------------------

type Mode = "guest" | "staff";
type Theme = "light" | "dark";

type AmenityType =
  | "elevator"
  | "stairs"
  | "ice"
  | "laundry"
  | "gym"
  | "bar"
  | "staff"
  | "other";

type Landmark = {
  id: string;
  type: AmenityType;
  index: number; // hallway slot index
};

type Room = {
  id: string;
  number: string;
  wing: "left" | "right";
  position: number;
  quiet: number; // 1..10
  view: number; // 1..10
  access: number; // 1..10
  baseDelta: number; // -15..+18 (mock)
  tags: string[];
  notes?: string;
  reports: number; // community pings
  love: number; // 1..5
};

type Floor = {
  number: number;
  name: string;
  rooms: Room[];
  landmarks: Landmark[];
  feature?: string | null;
  isAmenityLevel?: boolean;
};

type Hotel = {
  id: string;
  name: string;
  location: string;
  baseRate: number;
  imageUrl?: string;
  floors: Floor[];
};

type Prefs = {
  quietVsAccess: number; // 0..100
  avoidElevator: boolean;
  premiumTolerance: number; // dollars 0..10
};

type SignalDraft = {
  quiet: 1 | 2 | 3 | 4 | 5;
  love: 1 | 2 | 3 | 4 | 5;
  convenience: 1 | 2 | 3 | 4 | 5;
  tag: string;
  note: string;
  imageUrl: string;
};

// -----------------------------
// Helpers + Mock Data
// -----------------------------

const AMENITY_META: Record<AmenityType, { label: string; badge: string }> = {
  elevator: { label: "Elevator", badge: "Lift" },
  stairs: { label: "Stairs", badge: "Stair" },
  ice: { label: "Ice Machine", badge: "Ice" },
  laundry: { label: "Laundry", badge: "Laundry" },
  gym: { label: "Gym", badge: "Gym" },
  bar: { label: "Bar", badge: "Bar" },
  staff: { label: "Staff", badge: "Staff" },
  other: { label: "Amenity", badge: "Amenity" },
};

const uid = () => Math.random().toString(36).slice(2, 9);

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const makeLandmark = (type: AmenityType, index = 0): Landmark => ({
  id: `${type}-${uid()}`,
  type,
  index,
});

/**
 * Default wing assignment: odd-left, even-right.
 */
function createRoomRange(
  start: number,
  end: number,
  overrides: Record<string, Partial<Room>> = {}
) {
  const rooms: Room[] = [];
  for (let n = start; n <= end; n++) {
    const num = String(n);
    const seed = n % 10;

    const base: Room = {
      id: `room-${num}`,
      number: num,
      wing: n % 2 === 1 ? "left" : "right",
      position: n - start,
      quiet: clamp(4 + (seed % 4), 1, 10),
      view: clamp(3 + ((seed + 1) % 4), 1, 10),
      access: seed < 3 || seed > 7 ? 7 : 5,
      baseDelta: 0,
      tags: [],
      notes: "",
      reports: 2 + seed * 2,
      love: clamp(2 + (seed % 4), 1, 5),
    };

    const o = overrides[num] || {};

    rooms.push({
      ...base,
      ...o,
      tags: Array.isArray(o.tags) ? o.tags : base.tags,
    });
  }
  return rooms;
}

const DEMO_HOTEL: Hotel = {
  id: "roomsense-demo",
  name: "Layout Intelligence Copilot",
  location: "Demo City",
  baseRate: 165,
  imageUrl:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1600&auto=format&fit=crop",
  floors: [
    {
      number: 1,
      name: "Lobby",
      rooms: [],
      isAmenityLevel: true,
      feature: "Arrival / Concierge",
      landmarks: [
        makeLandmark("elevator", 1),
        makeLandmark("stairs", 6),
        makeLandmark("gym", 2),
      ],
    },
    {
      number: 2,
      name: "Level 2",
      rooms: createRoomRange(201, 216, {
        "201": {
          quiet: 3,
          access: 7,
          baseDelta: -8,
          tags: ["value"],
          notes: "Near service core",
        },
        "216": { quiet: 7, view: 7, baseDelta: 4, tags: ["quiet"] },
      }),
      landmarks: [
        makeLandmark("elevator", 0),
        makeLandmark("ice", 4),
        makeLandmark("stairs", 7),
      ],
    },
    {
      number: 3,
      name: "Level 3",
      rooms: createRoomRange(301, 320, {
        "301": {
          quiet: 2,
          access: 8,
          baseDelta: -12,
          tags: ["noisy", "deal"],
          notes: "Next to elevator",
          love: 2,
        },
        "310": {
          quiet: 8,
          view: 7,
          baseDelta: 6,
          tags: ["quiet", "popular"],
          notes: "Corner feel",
          love: 5,
        },
        "319": { quiet: 7, view: 8, baseDelta: 4, tags: ["quiet"] },
      }),
      landmarks: [
        makeLandmark("elevator", 0),
        makeLandmark("ice", 3),
        makeLandmark("stairs", 7),
      ],
    },
    {
      number: 4,
      name: "Level 4",
      rooms: createRoomRange(401, 412, {
        "401": {
          quiet: 3,
          access: 7,
          baseDelta: -6,
          tags: ["value"],
          notes: "Dawn corridor hum",
        },
        "412": {
          quiet: 7,
          view: 7,
          baseDelta: 4,
          tags: ["quiet", "view"],
          love: 4,
        },
      }),
      landmarks: [
        makeLandmark("elevator", 0),
        makeLandmark("laundry", 4),
        makeLandmark("stairs", 5),
      ],
    },
    {
      number: 5,
      name: "Skyline",
      feature: "Rooftop Bar",
      rooms: createRoomRange(501, 508, {
        "501": {
          quiet: 4,
          view: 9,
          baseDelta: 0,
          tags: ["view"],
          notes: "Below rooftop — evening energy",
        },
        "508": {
          quiet: 8,
          view: 9,
          baseDelta: 14,
          tags: ["quiet", "view", "popular"],
          notes: "Corner suite feel",
          love: 5,
        },
      }),
      landmarks: [makeLandmark("elevator", 0), makeLandmark("bar", 3)],
    },
  ],
};

// -----------------------------
// Scoring
// -----------------------------

function computeMatch(room: Room, prefs: Prefs) {
  const qw = prefs.quietVsAccess / 100;
  const aw = 1 - qw;

  const elevatorPenalty =
    prefs.avoidElevator &&
    (room.tags.includes("noisy") ||
      (room.notes || "").toLowerCase().includes("elevator"))
      ? 1.2
      : 0;

  const raw = room.quiet * qw + room.access * aw + room.view * 0.15 - elevatorPenalty;
  const score = clamp(Math.round(raw * 10), 0, 100);

  const quietBias = Math.round((room.quiet - 5) * 1.2 * qw * 2);
  const suggested = clamp(quietBias + (room.baseDelta || 0), -15, 18);
  const applied = clamp(suggested, -15, prefs.premiumTolerance);

  const confidence = score >= 85 ? "High" : score >= 70 ? "Medium" : "Low";

  return { score, suggestedDelta: applied, confidence } as const;
}

// -----------------------------
// Small UI atoms
// -----------------------------

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
      : tone === "warn"
      ? "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
      : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-200";

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function SectionTitle({
  kicker,
  title,
  right,
}: {
  kicker: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
      <div className="hidden sm:block text-[10px] sm:text-xs tracking-[0.22em] text-stone-400 dark:text-stone-500">
          {kicker}
        </div>
        <div className="font-semibold tracking-tight text-stone-900 dark:text-stone-50 truncate">
          {title}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

// -----------------------------
// Mode toggle
// -----------------------------

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="grid grid-cols-2 items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200 dark:bg-stone-900 dark:border-stone-800">
      {(["guest", "staff"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={
            "px-3 py-1.5 text-xs rounded-lg transition-all " +
            (mode === m
              ? "bg-white shadow-sm text-stone-900 dark:bg-stone-100 dark:text-stone-900"
              : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100")
          }
        >
          <span className="hidden sm:inline">{m === "guest" ? "Guest View" : "Staff Edit"}</span>
          <span className="sm:hidden">{m === "guest" ? "Guest" : "Staff"}</span>
        </button>
      ))}
    </div>
  );
}
function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (t: Theme) => void;
}) {
  return (
    <div className="grid grid-cols-2 items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200 dark:bg-stone-900 dark:border-stone-800">
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={
            "px-3 py-1.5 text-xs rounded-lg transition-all capitalize " +
            (theme === t
              ? "bg-white shadow-sm text-stone-900 dark:bg-stone-100 dark:text-stone-900"
              : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100")
          }
        >
          <span className="hidden sm:inline">{t}</span>
          <span className="sm:hidden">{t === "light" ? "Light" : "Dark"}</span>
        </button>
      ))}
    </div>
  );
}
// -----------------------------
// Hero
// -----------------------------

function HotelHero({
  hotel,
  mode,
  onMode,
  theme,
  onTheme,
}: {
  hotel: Hotel;
  mode: Mode;
  onMode: (m: Mode) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  const hasImage = Boolean(hotel.imageUrl);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm dark:bg-stone-900 dark:border-stone-800">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: hasImage
            ? `linear-gradient(180deg, rgba(250,250,249,0.82), rgba(250,250,249,0.98)), url(${hotel.imageUrl})`
            : "radial-gradient(circle at 20% 0%, rgba(120,113,108,0.10), transparent 40%), radial-gradient(circle at 80% 30%, rgba(120,113,108,0.08), transparent 45%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative p-2 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-stone-900 rounded-2xl flex items-center justify-center text-white font-bold dark:bg-stone-50 dark:text-stone-900">
              R
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-stone-400 dark:text-stone-500">ROOMSENSE</div>
              <div className="text-base sm:text-lg md:text-xl font-semibold text-stone-900 dark:text-stone-50">{hotel.name}</div>
              <div className="text-[11px] sm:text-sm text-stone-500 dark:text-stone-400">{hotel.location}</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="rounded-xl bg-white/70 px-2 py-1 border border-stone-200 dark:bg-stone-900/60 dark:border-stone-700">
                <div className="text-[9px] text-stone-400 dark:text-stone-500">Base rate</div>
                <div className="text-[11px] font-semibold text-stone-900 dark:text-stone-50">${hotel.baseRate}/night</div>
              </div>
              <div className="rounded-xl bg-white/70 px-2 py-1 border border-stone-200 dark:bg-stone-900/60 dark:border-stone-700">
                <div className="text-[9px] text-stone-400 dark:text-stone-500">Floors</div>
                <div className="text-[11px] font-semibold text-stone-900 dark:text-stone-50">{hotel.floors.length}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onChange={onTheme} />
              <ModeToggle mode={mode} onChange={onMode} />
            </div>
          </div>
        </div>

        <div className="mt-6 hidden sm:flex items-center gap-2">
          <span className="h-[1px] flex-1 bg-stone-200 dark:bg-stone-800" />
          <span className="text-[10px] text-stone-400 dark:text-stone-500 tracking-widest">
            ABSTRACTED LAYOUT • TRUST SIGNALS • MICRO-PREMIUMS
          </span>
          <span className="h-[1px] flex-1 bg-stone-200 dark:bg-stone-800" />
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Navigator
// -----------------------------

function FloorNavigator({
  hotel,
  activeFloor,
  onJump,
}: {
  hotel: Hotel;
  activeFloor: number;
  onJump: (n: number) => void;
}) {
  const floorsSorted = useMemo(
    () => [...hotel.floors].sort((a, b) => a.number - b.number),
    [hotel.floors]
  );
  const idx = Math.max(0, floorsSorted.findIndex((f) => f.number === activeFloor));
  const current = floorsSorted[idx] ?? floorsSorted[0];

  const canUp = idx < floorsSorted.length - 1;
  const canDown = idx > 0;

  const jumpUp = () => {
    if (!canUp) return;
    onJump(floorsSorted[idx + 1].number);
  };
  const jumpDown = () => {
    if (!canDown) return;
    onJump(floorsSorted[idx - 1].number);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 dark:bg-stone-900 dark:border-stone-800 p-4">
      <SectionTitle
        kicker="HOTEL OVERVIEW"
        title="Floors"
        right={<span className="text-[10px] text-stone-400 dark:text-stone-500">{floorsSorted.length} levels</span>}
      />

      <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-3 dark:bg-stone-950/40 dark:border-stone-800">
      <div className="flex items-start sm:items-center justify-between gap-3 min-w-0">
          <button
            onClick={jumpUp}
            disabled={!canUp}
            className={
              "h-9 w-9 rounded-xl border text-xs font-medium transition " +
              (canUp
                ? "bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-200 dark:hover:border-stone-700"
                : "bg-stone-100 border-stone-200 text-stone-300 cursor-not-allowed dark:bg-stone-900/40 dark:border-stone-800 dark:text-stone-600")
            }
            aria-label="Go up a floor"
            title="Higher floor"
          >
            ▲
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-white border border-stone-200 flex items-center justify-center text-lg font-semibold text-stone-900 dark:bg-stone-100 dark:border-stone-200 dark:text-stone-900">
              {current.number}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-50 truncate">
                {current.name}
              </div>
              <div className="text-[10px] text-stone-400 dark:text-stone-500">
                {current.rooms.length ? `${current.rooms.length} rooms` : "amenity level"}
                {current.feature ? ` • ${current.feature}` : ""}
              </div>
            </div>
          </div>

          <button
            onClick={jumpDown}
            disabled={!canDown}
            className={
              "h-9 w-9 rounded-xl border text-xs font-medium transition " +
              (canDown
                ? "bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-200 dark:hover:border-stone-700"
                : "bg-stone-100 border-stone-200 text-stone-300 cursor-not-allowed dark:bg-stone-900/40 dark:border-stone-800 dark:text-stone-600")
            }
            aria-label="Go down a floor"
            title="Lower floor"
          >
            ▼
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-stone-400 dark:text-stone-500">Tap arrows to change floors</span>
          <span className="text-[10px] text-stone-400 dark:text-stone-500">{idx + 1}/{floorsSorted.length}</span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Preferences
// -----------------------------

function PreferencePanel({
  prefs,
  setPrefs,
}: {
  prefs: Prefs;
  setPrefs: React.Dispatch<React.SetStateAction<Prefs>>;
}) {
  const label =
    prefs.quietVsAccess >= 60
      ? "Quiet-first"
      : prefs.quietVsAccess <= 40
      ? "Access-first"
      : "Balanced";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 dark:bg-stone-900 dark:border-stone-800">
      <SectionTitle kicker="PREFERENCES" title="Quiet vs Convenience" right={<span className="text-xs text-stone-500">{label}</span>} />

      <input
        type="range"
        min={0}
        max={100}
        value={prefs.quietVsAccess}
        onChange={(e) =>
          setPrefs((p) => ({ ...p, quietVsAccess: Number(e.target.value) }))
        }
        className="mt-4 w-full accent-stone-900"
      />

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-center justify-between rounded-xl bg-stone-50 border border-stone-200 px-3 py-2 dark:bg-stone-950/40 dark:border-stone-800">
          <span className="text-xs text-stone-600 dark:text-stone-300">Avoid elevators</span>
          <input
            type="checkbox"
            checked={prefs.avoidElevator}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, avoidElevator: e.target.checked }))
            }
            className="h-4 w-4 accent-stone-900"
          />
        </label>

        <div className="rounded-xl bg-stone-50 border border-stone-200 px-3 py-2 dark:bg-stone-950/40 dark:border-stone-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600 dark:text-stone-300">Premium tolerance</span>
            <span className="text-xs font-medium text-stone-900 dark:text-stone-50">+${prefs.premiumTolerance}</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={prefs.premiumTolerance}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, premiumTolerance: Number(e.target.value) }))
            }
            className="mt-2 w-full accent-stone-900"
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-stone-400 dark:text-stone-500">
        Micro-premiums are intentionally small to preserve trust and reduce buyer friction.
      </p>
    </div>
  );
}

// -----------------------------
// Room card
// -----------------------------

function RoomCard({
  room,
  prefs,
  baseRate,
  selected,
  onSelect,
  mode,
  onAddSignal,
}: {
  room: Room;
  prefs: Prefs;
  baseRate: number;
  selected: boolean;
  onSelect: (r: Room) => void;
  mode: Mode;
  onAddSignal: (r: Room) => void;
}) {
  const match = computeMatch(room, prefs);
  const delta = match.suggestedDelta;
  const finalRate = baseRate + delta;

  const quietTone = room.quiet >= 7 ? "good" : room.quiet <= 4 ? "warn" : "neutral";
  const expanded = selected;

  const extraTags = (room.tags || []).filter(Boolean).slice(0, 3);

  return (
    <div
      className={
        "rounded-2xl border bg-white transition-[border,box-shadow,background-color] dark:bg-stone-900 " +
        (expanded
          ? "border-stone-900 shadow-sm dark:border-stone-50"
          : "border-stone-200 hover:border-stone-300 dark:border-stone-800 dark:hover:border-stone-700")
      }
    >
      <button
        onClick={() => onSelect(room)}
        className="w-full text-left p-3 sm:p-4"
        aria-expanded={expanded}
        title={expanded ? "Collapse room" : "Expand room"}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-base sm:text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                {room.number}
              </div>
              <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                {room.wing} wing
              </span>
              {!expanded && room.tags?.length ? (
                <span className="text-[9px] text-stone-400 dark:text-stone-500">
                  • {room.tags.length} tags
                </span>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge label={`Quiet ${room.quiet}`} tone={quietTone} />
              <Badge label={`Love ${room.love}`} tone={room.love >= 4 ? "good" : "neutral"} />
              {expanded &&
                extraTags.map((t) => (
                  <Badge key={t} label={t} />
                ))}
            </div>

            {expanded && (
              <div className="mt-2 text-[10px] text-stone-400 dark:text-stone-500">
                Match score {match.score} • Confidence {match.confidence}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="text-[9px] sm:text-[10px] text-stone-400 dark:text-stone-500">est. rate</div>
            <div className="text-sm sm:text-base font-semibold text-stone-900 dark:text-stone-50">
              ${finalRate}
              <span className="text-[9px] sm:text-[10px] font-medium text-stone-400 dark:text-stone-500">/n</span>
            </div>
            {delta !== 0 && (
              <div className="text-[9px] sm:text-[10px] text-stone-500">
                {delta > 0 ? `+${delta}` : `${delta}`} vs base
              </div>
            )}
          </div>
        </div>

        {/* Expanded details only */}
        {expanded && (
    <>
    <div className="mt-3 rounded-xl bg-stone-50 border border-stone-200 px-3 py-2 dark:bg-stone-900/40 dark:border-stone-800">
    <div className="text-[10px] text-stone-400 dark:text-stone-500">
                    signal
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-200">
                    {room.notes && room.notes.trim().length > 0
                      ? room.notes
                      : "Balanced corridor tradeoff"}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">
                    {room.reports} community pings
                  </div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">
                    Confidence: {match.confidence}
                  </div>
                </div>
              </>
            )}
          </button>

      {/* Guest: only show signal action when expanded */}
      {mode === "guest" && expanded && (
        <div className="px-3 sm:px-4 pb-3">
          <div className="flex justify-end">
            <button
              onClick={() => onAddSignal(room)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-stone-200 bg-stone-50 hover:bg-white hover:border-stone-300 transition dark:bg-stone-950/40 dark:border-stone-800 dark:text-stone-200 dark:hover:bg-stone-900 dark:hover:border-stone-700"
            >
              Add signal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------
// Landmarks chips
// -----------------------------

function LandmarkChip({
  landmark,
  editable,
  onDragStart,
}: {
  landmark: Landmark;
  editable: boolean;
  onDragStart: (e: React.DragEvent, lm: Landmark) => void;
}) {
  const meta = AMENITY_META[landmark.type] || AMENITY_META.other;
  return (
    <div
      draggable={editable}
      onDragStart={(e) => editable && onDragStart(e, landmark)}
      className={
        "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[10px] " +
        (editable
          ? "bg-white border-stone-200 cursor-grab active:cursor-grabbing dark:bg-stone-900 dark:border-stone-800"
          : "bg-stone-50 border-stone-200 dark:bg-stone-950/40 dark:border-stone-800")
      }
      title={meta.label}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-stone-900 opacity-70 dark:bg-stone-100" />
      <span className=" text-stone-700 dark:text-stone-200 font-medium">{meta.badge}</span>
    </div>
  );
}

// -----------------------------
// Wing grid (abstract plan)
// -----------------------------

function WingGrid({
  rooms,
  landmarks,
  prefs,
  baseRate,
  selectedRoom,
  onSelectRoom,
  mode,
  onUpdateLandmarks,
  onAddSignal,
}: {
  rooms: Room[];
  landmarks: Landmark[];
  prefs: Prefs;
  baseRate: number;
  selectedRoom: Room | null;
  onSelectRoom: (r: Room) => void;
  mode: Mode;
  onUpdateLandmarks: (lms: Landmark[]) => void;
  onAddSignal: (r: Room) => void;
}) {
  const editable = mode === "staff";
  const left = rooms.filter((r) => r.wing === "left");
  const right = rooms.filter((r) => r.wing === "right");
  const leftOrdered = [...left].sort((a, b) => Number(a.number) - Number(b.number));
  const rightOrdered = [...right].sort((a, b) => Number(a.number) - Number(b.number));

  const slotCount = Math.max(leftOrdered.length, rightOrdered.length, 8);
  const dragRef = useRef<Landmark | null>(null);

  const handleDragStart = (e: React.DragEvent, lm: Landmark) => {
    dragRef.current = lm;
    try {
      e.dataTransfer.setData("text/plain", lm.id);
    } catch {
      /* noop */
    }
  };

  const allowDrop = (e: React.DragEvent) => {
    if (editable) e.preventDefault();
  };

  const dropOnSlot = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!editable || !dragRef.current) return;
    const moving = dragRef.current;
    const updated = landmarks.map((l) =>
      l.id === moving.id ? { ...l, index } : l
    );
    onUpdateLandmarks(updated);
    dragRef.current = null;
  };

  const lmByIndex = useMemo(() => {
    const map = new Map<number, Landmark[]>();
    landmarks.forEach((l) => {
      const arr = map.get(l.index) || [];
      arr.push(l);
      map.set(l.index, arr);
    });
    return map;
  }, [landmarks]);

  return (
    <div className="relative rounded-2xl border border-stone-200 bg-white p-4 dark:bg-stone-900 dark:border-stone-800">
      <SectionTitle
        kicker="FLOOR PLAN (ABSTRACT)"
        title="Left wing • Hallway • Right wing"
        right={
          <span className="text-[10px] text-stone-400 dark:text-stone-500">
            {editable ? "drag landmarks" : "view room signals"}
          </span>
        }
      />
      <p className="mt-1 text-[9px] sm:text-[10px] text-stone-400 dark:text-stone-500">
        Hallway slots align with room order on each wing. Drag landmarks to the matching row to keep the map truthful.
      </p>
      {/* Responsive plan: mobile horizontal snap (under lg) + desktop 3-column grid (lg+) */}
      {/* -------- Mobile: three-lane horizontal snap -------- */}
      <div className="mt-4 lg:hidden">
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {/* Left lane */}
          <div className="snap-start shrink-0 w-[88vw] max-w-[520px]">
            <div className="space-y-2">
              <div className="text-[10px] text-stone-400 dark:text-stone-500">Left wing</div>
              {leftOrdered.length === 0 && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-[11px] text-stone-400 dark:bg-stone-950/40 dark:border-stone-800 dark:text-stone-500">
                  No rooms on this level.
                </div>
              )}
              {leftOrdered.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  prefs={prefs}
                  baseRate={baseRate}
                  selected={selectedRoom?.number === r.number}
                  onSelect={onSelectRoom}
                  mode={mode}
                  onAddSignal={onAddSignal}
                />
              ))}
            </div>
          </div>

          {/* Hallway lane */}
          <div className="snap-start shrink-0 w-[88vw] max-w-[520px]">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 dark:bg-stone-950/30 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                  Hallway cues
                </div>
                {editable && (
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">drop to reposition</div>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {Array.from({ length: slotCount }).map((_, idx) => {
                  const here = lmByIndex.get(idx) || [];
                  return (
                    <div
                      key={idx}
                      onDragOver={allowDrop}
                      onDrop={(e) => dropOnSlot(e, idx)}
                      className={
                        "min-h-[38px] rounded-xl border px-2 py-2 flex flex-wrap gap-1.5 items-center " +
                        (editable
                          ? "bg-white border-stone-200 dark:bg-stone-900 dark:border-stone-800"
                          : "bg-stone-100/70 border-stone-200 dark:bg-stone-950/50 dark:border-stone-800")
                      }
                    >
                      <span className="text-[9px] text-stone-400 dark:text-stone-500 mr-1">{idx + 1}</span>
                      {here.length === 0 ? (
                        <span className="text-[10px] text-stone-400 dark:text-stone-500">
                          {editable ? "Drop amenity here" : "—"}
                        </span>
                      ) : (
                        here.map((lm) => (
                          <LandmarkChip
                            key={lm.id}
                            landmark={lm}
                            editable={editable}
                            onDragStart={handleDragStart}
                          />
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right lane */}
          <div className="snap-start shrink-0 w-[88vw] max-w-[520px]">
            <div className="space-y-2">
              <div className="text-[10px] text-stone-400 dark:text-stone-500">Right wing</div>
              {rightOrdered.length === 0 && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-[11px] text-stone-400 dark:bg-stone-950/40 dark:border-stone-800 dark:text-stone-500">
                  No rooms on this level.
                </div>
              )}
              {rightOrdered.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  prefs={prefs}
                  baseRate={baseRate}
                  selected={selectedRoom?.number === r.number}
                  onSelect={onSelectRoom}
                  mode={mode}
                  onAddSignal={onAddSignal}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-1 text-[9px] text-stone-400 dark:text-stone-500">
          Swipe for Left • Hallway • Right
        </div>
      </div>

      {/* -------- Desktop: classic 3-lane grid -------- */}
      <div className="mt-4 hidden lg:grid lg:grid-cols-3 gap-4">
        {/* Left wing */}
        <div className="space-y-2">
          <div className="text-[10px] text-stone-400 dark:text-stone-500">Left wing</div>
          {leftOrdered.length === 0 && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-[11px] text-stone-400 dark:bg-stone-950/40 dark:border-stone-800 dark:text-stone-500">
              No rooms on this level.
            </div>
          )}
          {leftOrdered.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              prefs={prefs}
              baseRate={baseRate}
              selected={selectedRoom?.number === r.number}
              onSelect={onSelectRoom}
              mode={mode}
              onAddSignal={onAddSignal}
            />
          ))}
        </div>

        {/* Hallway slots */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 dark:bg-stone-950/30 dark:border-stone-800">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-widest">
              Hallway cues
            </div>
            {editable && (
              <div className="text-[10px] text-stone-400 dark:text-stone-500">drop to reposition</div>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {Array.from({ length: slotCount }).map((_, idx) => {
              const here = lmByIndex.get(idx) || [];
              return (
                <div
                  key={idx}
                  onDragOver={allowDrop}
                  onDrop={(e) => dropOnSlot(e, idx)}
                  className={
                    "min-h-[38px] rounded-xl border px-2 py-2 flex flex-wrap gap-1.5 items-center " +
                    (editable
                      ? "bg-white border-stone-200 dark:bg-stone-900 dark:border-stone-800"
                      : "bg-stone-100/70 border-stone-200 dark:bg-stone-950/50 dark:border-stone-800")
                  }
                >
                  <span className="text-[9px] text-stone-400 dark:text-stone-500 mr-1">{idx + 1}</span>
                  {here.length === 0 ? (
                    <span className="text-[10px] text-stone-400 dark:text-stone-500">
                      {editable ? "Drop amenity here" : "—"}
                    </span>
                  ) : (
                    here.map((lm) => (
                      <LandmarkChip
                        key={lm.id}
                        landmark={lm}
                        editable={editable}
                        onDragStart={handleDragStart}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right wing */}
        <div className="space-y-2">
          <div className="text-[10px] text-stone-400 dark:text-stone-500">Right wing</div>
          {rightOrdered.length === 0 && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-[11px] text-stone-400 dark:bg-stone-950/40 dark:border-stone-800 dark:text-stone-500">
              No rooms on this level.
            </div>
          )}
          {rightOrdered.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              prefs={prefs}
              baseRate={baseRate}
              selected={selectedRoom?.number === r.number}
              onSelect={onSelectRoom}
              mode={mode}
              onAddSignal={onAddSignal}
            />
          ))}
        </div>
      </div>

    </div>
  );
}

// -----------------------------
// Staff landmark palette
// -----------------------------

function LandmarkPalette({
  landmarks,
  onAdd,
}: {
  landmarks: Landmark[];
  onAdd: (lm: Landmark) => void;
}) {
  const types: AmenityType[] = [
    "elevator",
    "stairs",
    "ice",
    "laundry",
    "gym",
    "bar",
    "staff",
    "other",
  ];

  const nextIndex = (curr: Landmark[]) =>
    Math.max(0, ...(curr.map((l) => l.index) || [0])) + 1;

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:bg-stone-950/40 dark:border-stone-800">
      <SectionTitle
        kicker="AUTHORING TOOLS"
        title="Add landmarks"
        right={<span className="text-[10px] text-stone-400 dark:text-stone-500">light edit layer</span>}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => onAdd(makeLandmark(t, nextIndex(landmarks)))}
            className="px-3 py-1.5 rounded-xl text-[10px] font-medium border border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 transition dark:bg-stone-900 dark:border-stone-800 dark:text-stone-200 dark:hover:border-stone-700"
          >
            {AMENITY_META[t]?.label ?? "Amenity"}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-stone-400 dark:text-stone-500">
        Drag landmarks into hallway slots to refine placement.
      </p>
    </div>
  );
}

// -----------------------------
// Recommendations
// -----------------------------

function Recommendations({
  rooms,
  prefs,
  baseRate,
}: {
  rooms: Room[];
  prefs: Prefs;
  baseRate: number;
}) {
  const ranked = useMemo(() => {
    return [...rooms]
      .map((r) => ({ r, m: computeMatch(r, prefs) }))
      .sort((a, b) => b.m.score - a.m.score)
      .slice(0, 5);
  }, [rooms, prefs]);

  if (rooms.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 dark:bg-stone-900 dark:border-stone-800">
        <SectionTitle kicker="RECOMMENDATIONS" title="No rooms on this level" />
        <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
          This floor is likely amenity-focused.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 dark:bg-stone-900 dark:border-stone-800">
      <SectionTitle kicker="RECOMMENDATIONS" title="Top matches" />

      <div className="mt-3 space-y-2">
        {ranked.map(({ r, m }, idx) => {
          const rate = baseRate + m.suggestedDelta;
          return (
            <div
              key={r.id}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 dark:bg-stone-950/40 dark:border-stone-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">#{idx + 1}</span>
                  <span className="text-xs font-semibold text-stone-900 dark:text-stone-50">{r.number}</span>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">{r.wing}</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">score</div>
                  <div className="text-xs font-semibold text-stone-900 dark:text-stone-50">{m.score}</div>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <Badge label={`Quiet ${r.quiet}`} tone={r.quiet >= 7 ? "good" : r.quiet <= 4 ? "warn" : "neutral"} />
                  <Badge label={`Love ${r.love}`} tone={r.love >= 4 ? "good" : "neutral"} />
                  {(r.tags || []).slice(0, 2).map((t) => (
                    <Badge key={t} label={t} />
                  ))}
                </div>
                <div className="text-[10px] text-stone-500">
                  est. ${rate}/n {m.suggestedDelta ? `(${m.suggestedDelta > 0 ? "+" : ""}${m.suggestedDelta})` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-stone-400 dark:text-stone-500">
        Recommendations are computed from simple mock signals and preferences.
      </p>
    </div>
  );
}

// -----------------------------
// Guest signal modal
// -----------------------------

function GuestSignalModal({
  room,
  onClose,
  onSubmit,
}: {
  room: Room | null;
  onClose: () => void;
  onSubmit: (room: Room, draft: SignalDraft) => void;
}) {
  const [draft, setDraft] = useState<SignalDraft>({
    quiet: 4,
    love: 4,
    convenience: 3,
    tag: "",
    note: "",
    imageUrl: "",
  });

  // Reset when opening a new room
  React.useEffect(() => {
    if (room) {
      setDraft({ quiet: 4, love: 4, convenience: 3, tag: "", note: "", imageUrl: "" });
    }
  }, [room?.id]);

  if (!room) return null;

  const inputCls =
    "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-xl p-5 sm:p-6 m-0 sm:m-6 dark:bg-stone-900 dark:border-stone-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs tracking-widest text-stone-400 dark:text-stone-500">GUEST SIGNAL</div>
            <div className="text-lg font-semibold text-stone-900 dark:text-stone-50">Room {room.number}</div>
            <div className="text-[11px] text-stone-500">
              Lightweight community input (Waze-lite)
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl border border-stone-200 bg-stone-50 text-stone-600 hover:bg-white dark:bg-stone-950/40 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 dark:bg-stone-950/40 dark:border-stone-800">
            <div className="text-[10px] text-stone-400 dark:text-stone-500">Quiet</div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={draft.quiet}
              onChange={(e) =>
                setDraft((d) => ({ ...d, quiet: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 }))
              }
              className="mt-1 w-full accent-stone-900"
            />
            <div className="text-xs font-medium text-stone-900 dark:text-stone-50">{draft.quiet}/5</div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 dark:bg-stone-950/40 dark:border-stone-800">
            <div className="text-[10px] text-stone-400 dark:text-stone-500">Love</div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={draft.love}
              onChange={(e) =>
                setDraft((d) => ({ ...d, love: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 }))
              }
              className="mt-1 w-full accent-stone-900"
            />
            <div className="text-xs font-medium text-stone-900 dark:text-stone-50">{draft.love}/5</div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 dark:bg-stone-950/40 dark:border-stone-800">
            <div className="text-[10px] text-stone-400 dark:text-stone-500">Convenience</div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={draft.convenience}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  convenience: Number(e.target.value) as 1 | 2 | 3 | 4 | 5,
                }))
              }
              className="mt-1 w-full accent-stone-900"
            />
            <div className="text-xs font-medium text-stone-900 dark:text-stone-50">{draft.convenience}/5</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-stone-400 dark:text-stone-500 mb-1">Tag (optional)</div>
            <input
              value={draft.tag}
              onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))}
              placeholder="quiet, view, value..."
              className={inputCls}
            />
          </div>
          <div>
            <div className="text-[10px] text-stone-400 dark:text-stone-500 mb-1">Image URL (optional)</div>
            <input
              value={draft.imageUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, imageUrl: e.target.value }))
              }
              placeholder="https://..."
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[10px] text-stone-400 dark:text-stone-500 mb-1">Note (optional)</div>
          <textarea
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="Short, practical observation..."
            rows={3}
            className={inputCls}
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs border border-stone-200 bg-stone-50 hover:bg-white dark:bg-stone-950/40 dark:border-stone-800 dark:text-stone-200 dark:hover:bg-stone-900"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit(room, draft);
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-stone-900 text-white hover:bg-stone-800"
          >
            Save signal
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Main component
// -----------------------------

export default function LayoutIntelligenceCopilotMVP() {
  const [hotel, setHotel] = useState<Hotel>(DEMO_HOTEL);
  const [mode, setMode] = useState<Mode>("guest");
  const [theme, setTheme] = useState<Theme>("light");
  const [activeFloor, setActiveFloor] = useState<number>(3);
  const [prefs, setPrefs] = useState<Prefs>({
    quietVsAccess: 65,
    avoidElevator: true,
    premiumTolerance: 6,
  });
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [signalTarget, setSignalTarget] = useState<Room | null>(null);
  const [leftTab, setLeftTab] = useState<"overview" | "prefs" | "recs">("overview");
  const floor = useMemo(
    () => hotel.floors.find((f) => f.number === activeFloor) ?? hotel.floors[0],
    [hotel, activeFloor]
  );

  const handleJump = (n: number) => {
    setActiveFloor(n);
    setSelectedRoom(null);
  };

  const handleSelectRoom = (r: Room) => {
    setSelectedRoom((curr) => (curr?.id === r.id ? null : r));
  };

  const updateLandmarksForFloor = (floorNumber: number, next: Landmark[]) => {
    setHotel((h) => ({
      ...h,
      floors: h.floors.map((f) =>
        f.number === floorNumber ? { ...f, landmarks: next } : f
      ),
    }));
  };

  const addLandmarkToFloor = (floorNumber: number, lm: Landmark) => {
    const target = hotel.floors.find((f) => f.number === floorNumber);
    const curr = target?.landmarks ?? [];
    updateLandmarksForFloor(floorNumber, [...curr, lm]);
  };

  const handleSubmitSignal = (room: Room, draft: SignalDraft) => {
    // Minimal demo merge: update room tags/notes/reports/love/quiet/access heuristically.
    setHotel((h) => ({
      ...h,
      floors: h.floors.map((f) => {
        if (f.number !== activeFloor) return f;
        const updatedRooms = f.rooms.map((r) => {
          if (r.id !== room.id) return r;

          const newTags = [...new Set([...(r.tags || []), ...(draft.tag ? [draft.tag.trim()] : [])])].filter(Boolean);
          const mergedNote = [r.notes, draft.note].filter(Boolean).join(" • ").slice(0, 140);

          const quietBoost = draft.quiet >= 4 ? 1 : draft.quiet <= 2 ? -1 : 0;
          const accessBoost = draft.convenience >= 4 ? 1 : draft.convenience <= 2 ? -1 : 0;

          return {
            ...r,
            tags: newTags,
            notes: mergedNote || r.notes,
            reports: (r.reports || 0) + 1,
            love: clamp(Math.round((r.love + draft.love) / 2), 1, 5),
            quiet: clamp(r.quiet + quietBoost, 1, 10),
            access: clamp(r.access + accessBoost, 1, 10),
          };
        });
        return { ...f, rooms: updatedRooms };
      }),
    }));
  };

  return (
    <div
      className={
        "min-h-screen font-sans transition-colors " +
        (theme === "dark"
          ? "dark bg-stone-950 text-stone-50"
          : "bg-stone-50 text-stone-900")
      }
    >

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <HotelHero
  hotel={hotel}
  mode={mode}
  onMode={setMode}
  theme={theme}
  onTheme={setTheme}
/>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left rail */}
          <aside className="md:col-span-3 lg:col-span-3 xl:col-span-2 space-y-4 min-w-0">
  {/* Left-rail progressive disclosure */}
  <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-1 w-full overflow-hidden dark:bg-stone-900 dark:border-stone-800">
    <div className="grid grid-cols-3 items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200 dark:bg-stone-900 dark:border-stone-800">
      <button
        onClick={() => setLeftTab("overview")}
        className={
          "min-w-0 px-2 py-1 text-[10px] truncate rounded-lg transition-all " +
          (leftTab === "overview"
            ? "bg-white shadow-sm text-stone-900 dark:bg-stone-100 dark:text-stone-900"
            : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100")
        }
      >
        <span className="hidden sm:inline">Overview</span>
        <span className="sm:hidden">Over</span>
      </button>
      <button
        onClick={() => setLeftTab("prefs")}
        className={
          "min-w-0 px-2 py-1 text-[10px] truncate rounded-lg transition-all " +
          (leftTab === "prefs"
            ? "bg-white shadow-sm text-stone-900 dark:bg-stone-100 dark:text-stone-900"
            : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100")
        }
      >
        <span className="hidden sm:inline">Preferences</span>
        <span className="sm:hidden">Prefs</span>
      </button>
      <button
        onClick={() => setLeftTab("recs")}
        className={
          "min-w-0 px-2 py-1 text-[10px] truncate rounded-lg transition-all " +
          (leftTab === "recs"
            ? "bg-white shadow-sm text-stone-900 dark:bg-stone-100 dark:text-stone-900"
            : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100")
        }
      >
        <span className="hidden sm:inline">Picks</span>
        <span className="sm:hidden">Top</span>
      </button>
    </div>
  </div>

  {leftTab === "overview" && (
    <FloorNavigator hotel={hotel} activeFloor={activeFloor} onJump={handleJump} />
  )}

  {leftTab === "prefs" && (
    <PreferencePanel prefs={prefs} setPrefs={setPrefs} />
  )}

  {leftTab === "recs" && (
    <Recommendations rooms={floor.rooms} prefs={prefs} baseRate={hotel.baseRate} />
  )}
</aside>

          {/* Main canvas */}
          <section className="md:col-span-9 lg:col-span-9 xl:col-span-10 space-y-4 min-w-0">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 dark:bg-stone-900 dark:border-stone-800">
              <SectionTitle
                kicker={`FLOOR ${floor.number}`}
                title={floor.name}
                right={
                  <div className="flex items-center gap-2">
                    {floor.feature && (
                      <Badge label={floor.feature} />
                    )}
                    <Badge label={floor.rooms.length ? `${floor.rooms.length} rooms` : "amenity"} />
                  </div>
                }
              />
              <p className="mt-1 text-[10px] text-stone-400 dark:text-stone-500">
                Preference-first floor view for fewer quiet-location mismatches.
              </p>
            </div>

            {mode === "staff" && (
              <LandmarkPalette
                landmarks={floor.landmarks}
                onAdd={(lm) => addLandmarkToFloor(floor.number, lm)}
              />
            )}

            <WingGrid
              rooms={floor.rooms}
              landmarks={floor.landmarks}
              prefs={prefs}
              baseRate={hotel.baseRate}
              selectedRoom={selectedRoom}
              onSelectRoom={handleSelectRoom} 
              mode={mode}
              onUpdateLandmarks={(lms) => updateLandmarksForFloor(floor.number, lms)}
              onAddSignal={(r) => setSignalTarget(r)}
            />

            
{/* Selected room detail (mobile drawer) */}
{selectedRoom && (
  <div className="sm:hidden fixed inset-x-0 bottom-0 z-40">
    <div className="mx-auto max-w-7xl px-4 pb-4">
      <div className="rounded-3xl border border-stone-200 bg-white shadow-xl p-4 dark:bg-stone-900 dark:border-stone-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] tracking-widest text-stone-400 dark:text-stone-500">ROOM DETAIL</div>
            <div className="text-base font-semibold text-stone-900 dark:text-stone-50">
              Room {selectedRoom.number}
            </div>
          </div>
          <button
            onClick={() => setSelectedRoom(null)}
            className="h-9 w-9 rounded-xl border border-stone-200 bg-stone-50 text-stone-600 hover:bg-white dark:bg-stone-950/40 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-900"
            aria-label="Close room detail"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-2 dark:bg-stone-950/40 dark:border-stone-800">
            <div className="text-[9px] text-stone-400 dark:text-stone-500">Quiet</div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">
              {selectedRoom.quiet}/10
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-2 dark:bg-stone-950/40 dark:border-stone-800">
            <div className="text-[9px] text-stone-400 dark:text-stone-500">View</div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">
              {selectedRoom.view}/10
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-2 dark:bg-stone-950/40 dark:border-stone-800">
            <div className="text-[9px] text-stone-400 dark:text-stone-500">Access</div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">
              {selectedRoom.access}/10
            </div>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-stone-600 dark:text-stone-300">
          {(selectedRoom.notes && selectedRoom.notes.trim()) || "No additional notes yet."}
        </div>
      </div>
    </div>
  </div>
)}

      {/* Selected room detail (tablet/desktop) */}
      {selectedRoom && (
        <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-stone-200 p-5 dark:bg-stone-900 dark:border-stone-800">
          <SectionTitle kicker="ROOM DETAIL" title={`Room ${selectedRoom.number}`} />
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:bg-stone-950/40 dark:border-stone-800">
              <div className="text-[10px] text-stone-400 dark:text-stone-500">Quiet</div>
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">{selectedRoom.quiet}/10</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:bg-stone-950/40 dark:border-stone-800">
              <div className="text-[10px] text-stone-400 dark:text-stone-500">View</div>
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">{selectedRoom.view}/10</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:bg-stone-950/40 dark:border-stone-800">
              <div className="text-[10px] text-stone-400 dark:text-stone-500">Access</div>
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">{selectedRoom.access}/10</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-stone-600 dark:text-stone-300">
            {(selectedRoom.notes && selectedRoom.notes.trim()) || "No additional notes yet."}
          </div>
        </div>
      )}
          </section>
        </div>
      </div>

      <GuestSignalModal
        room={signalTarget}
        onClose={() => setSignalTarget(null)}
        onSubmit={handleSubmitSignal}
      />
    </div>
  );
}
