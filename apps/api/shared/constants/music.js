// Chromatic scale and music constants

export const CHROMATIC_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const CHROMATIC_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// All recognized keys for the key picker
export const ALL_KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Nashville numbers
export const NASHVILLE_NUMBERS = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];

// Chord quality regex — matches chord names like G, Bm, F#m7, Gsus4, C/E, Cmaj7, Dm7b5
export const CHORD_REGEX = /^[A-G][b#]?(m|min|maj|dim|aug|sus[24]?|add)?[0-9]*(b[0-9]+)?(\/?[A-G][b#]?)?$/;

// Preset tag categories for song tagging
export const PRESET_TAGS = [
  "worship", "praise", "hymn", "classic", "contemporary",
  "gospel", "christmas", "easter", "communion", "altar",
  "opening", "closing", "prayer", "offertory", "invitation",
  "fast", "slow", "upbeat", "ballad", "acoustic",
  "choir", "solo", "youth", "kids", "spanish",
  "bethel", "hillsong", "elevation", "maverick city",
];

// Section keywords for parsing
export const SECTION_KEYWORDS = [
  "Verse", "Chorus", "Bridge", "Pre-Chorus", "Pre Chorus",
  "Interlude", "Intro", "Outro", "Tag", "Ending",
  "Instrumental", "Solo", "Turnaround", "Vamp", "Coda",
];
