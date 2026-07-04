"use client"

import { useState, useMemo, useRef, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { AppShell } from "@/components/app-shell"
import { LyricsModal } from "@/components/lyrics-modal"
import { CompactSongCard } from "@/components/compact-song-card"
import { useDisplayChordNotation } from "@/lib/use-display-chord-notation"
import {
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Share2,
  X,
  ChevronLeft,
  Music2,
  Minus,
  Plus,
  PencilIcon,
  Eye,
  Folder,
  Volume2,
  MoreVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fadeInUp, staggerContainer, staggerItem, scaleIn } from "@/lib/animations"

// ─── Types ────────────────────────────────────────────────────────────────────

type Genre = "Worship" | "Contemporary" | "Hymn"
type ViewMode = "grid" | "list"

interface Song {
  id: string
  key: string
  title: string
  artist: string
  genre: Genre
  bpm?: number
  description?: string
  intro?: string
  introKey?: string
  instruments?: string[]
  backgroundImage?: string
  sections?: SongSection[]
}

interface SongSection {
  label: string
  lines: { chords?: string; lyrics: string }[]
}

// ─── Chord transposition ──────────────────────────────────────────────────────

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT_MAP: Record<string, string> = {
  Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B",
}

function normalizeNote(note: string): string {
  return FLAT_MAP[note] ?? note
}

function transposeNote(note: string, semitones: number): string {
  const normalized = normalizeNote(note)
  const idx = CHROMATIC.indexOf(normalized)
  if (idx === -1) return note
  const newIdx = (idx + semitones + 12) % 12
  return CHROMATIC[newIdx]
}

function transposeChord(chord: string, semitones: number): string {
  if (semitones === 0) return chord
  return chord.replace(/[A-G][b#]?/g, (match, offset) => {
    // Only transpose the root and bass (after /)
    const before = chord.slice(0, offset)
    const isAfterSlash = before.includes("/")
    if (!isAfterSlash || chord[offset - 1] === "/") {
      return transposeNote(match, semitones)
    }
    return match
  })
}

function transposeLine(chords: string, semitones: number): string {
  return chords.replace(/[A-G][b#]?(?:maj|min|m|sus|add|dim|aug|[0-9])*(?:\/[A-G][b#]?)?/g, (chord) =>
    transposeChord(chord, semitones)
  )
}

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

// ─── Demo data ────────────────────────────────────────────────────────────────

const SONGS: Song[] = [
  {
    id: "1", key: "Ab", title: "Goodness of God", artist: "Bethel Music", genre: "Worship", bpm: 68,
    backgroundImage: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=600&fit=crop",
    intro: "Start with a soft instrumental intro. Build gently with the verse, letting the vocals take the lead from the first line.",
    introKey: "Ambient pads with subtle strings",
    instruments: ["Acoustic Guitar", "Electric Guitar", "Keyboard", "Drums", "Bass", "Strings", "Vocals"],
    description: "A modern worship song celebrating God's faithfulness. Known for its powerful chorus and emotional depth, it's become a staple in contemporary worship services.",
    sections: [
      {
        label: "Verse 1",
        lines: [
          { chords: "Ab          Eb", lyrics: "I love You Lord" },
          { chords: "Fm          Db", lyrics: "Oh Your mercy never fails me" },
          { chords: "Ab          Eb", lyrics: "All my days" },
          { chords: "Fm       Db", lyrics: "I've been held in Your hands" },
        ],
      },
      {
        label: "Chorus",
        lines: [
          { chords: "Ab                    Eb", lyrics: "'Cause all my life You have been faithful" },
          { chords: "Fm                Db", lyrics: "And all my life You have been so, so good" },
          { chords: "Ab                        Eb", lyrics: "With every breath that I am able" },
          { chords: "Fm          Db          Ab", lyrics: "Oh, I will sing of the goodness of God" },
        ],
      },
    ],
  },
  {
    id: "2", key: "E", title: "Amazing Grace", artist: "Traditional", genre: "Hymn", bpm: 72,
    backgroundImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=600&fit=crop",
    intro: "Begin with a simple hymnal organ or piano introduction. Let the first verse enter gently with a single voice, emphasizing the lyrics' profound meaning.",
    introKey: "Organ/Piano - Traditional hymnal style",
    instruments: ["Piano", "Organ", "Violin", "Cello", "Vocals", "Choir"],
    description: "One of the most beloved hymns ever written, Amazing Grace tells a story of redemption and God's transforming grace. Originally penned in 1779, it remains timeless.",
    sections: [
      {
        label: "Verse 1",
        lines: [
          { chords: "E         A    E", lyrics: "Amazing grace how sweet the sound" },
          { chords: "E       B7", lyrics: "That saved a wretch like me" },
          { chords: "E          A      E", lyrics: "I once was lost but now am found" },
          { chords: "B7        E", lyrics: "Was blind but now I see" },
        ],
      },
      {
        label: "Verse 2",
        lines: [
          { chords: "E         A    E", lyrics: "'Twas grace that taught my heart to fear" },
          { chords: "E       B7", lyrics: "And grace my fears relieved" },
          { chords: "E          A      E", lyrics: "How precious did that grace appear" },
          { chords: "B7        E", lyrics: "The hour I first believed" },
        ],
      },
    ],
  },
  {
    id: "3", key: "G", title: "How Great Is Our God", artist: "Chris Tomlin", genre: "Worship", bpm: 74,
    backgroundImage: "https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=1200&h=600&fit=crop",
    intro: "Open with a majestic orchestral swell or powerful worship band intro. Build momentum leading into the first verse with anticipation.",
    introKey: "Orchestral swell with worship band building",
    instruments: ["Electric Guitar", "Acoustic Guitar", "Keyboard", "Drums", "Bass", "Trumpet", "Vocals"],
    description: "A contemporary hymn written by Chris Tomlin that speaks to God's greatness and majesty. Perfect for both intimate and large congregation worship settings.",
    sections: [
      {
        label: "Verse 1",
        lines: [
          { chords: "G            Em", lyrics: "The splendor of a King" },
          { chords: "C               D", lyrics: "Clothed in majesty" },
          { chords: "G              Em", lyrics: "Let all the earth rejoice" },
          { chords: "C         D", lyrics: "All the earth rejoice" },
        ],
      },
      {
        label: "Chorus",
        lines: [
          { chords: "G", lyrics: "How great is our God" },
          { chords: "Em", lyrics: "Sing with me" },
          { chords: "C", lyrics: "How great is our God" },
          { chords: "D              G", lyrics: "And all will see how great, how great is our God" },
        ],
      },
    ],
  },
  { 
    id: "4", key: "D", title: "Way Maker", artist: "Sinach", genre: "Contemporary", bpm: 68,
    backgroundImage: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=600&fit=crop",
    intro: "Start with a contemporary upbeat rhythm. Build energy with drums and bass before the vocal entry.", 
    introKey: "Upbeat drums & bass - contemporary groove", 
    instruments: ["Electric Guitar", "Keyboard", "Drums", "Bass", "Percussion", "Vocals"], 
    description: "An African contemporary worship anthem that has transcended cultural boundaries. The powerful message of God making a way resonates globally across congregations.",
    sections: [ 
      { 
        label: "Verse 1", 
        lines: [ 
          { chords: "D          A", lyrics: "I came to Jesus as I was" }, 
          { chords: "Bm          G", lyrics: "So weary, worn and sad" }, 
          { chords: "D            A", lyrics: "I found in Him a resting place" }, 
          { chords: "Bm      G    D", lyrics: "And He has made me glad" } 
        ] 
      }, 
      { 
        label: "Chorus", 
        lines: [ 
          { chords: "D                    A", lyrics: "Way maker, miracle worker" }, 
          { chords: "Bm                   G", lyrics: "Promise keeper, light in the darkness" }, 
          { chords: "D", lyrics: "My God, that is who You are" } 
        ] 
      } 
    ] 
  },
  { 
    id: "5", key: "C", title: "Build My Life", artist: "Pat Barrett", genre: "Worship", bpm: 72,
    backgroundImage: "https://images.unsplash.com/photo-1458749387795-29f1c2c91bef?w=1200&h=600&fit=crop",
    intro: "Begin with acoustic guitar fingerpicking. Layer in strings and subtle harmony vocals.", 
    introKey: "Acoustic guitar fingerpicking with strings", 
    instruments: ["Acoustic Guitar", "Electric Guitar", "Keyboard", "Violin", "Cello", "Drums", "Vocals"], 
    description: "A song about building life on the foundation of God's love. Pat Barrett's composition emphasizes steadfast devotion and complete reliance on divine love as the anchor.",
    sections: [ 
      { 
        label: "Verse 1", 
        lines: [ 
          { chords: "C           G", lyrics: "Worthy of every song we sing" }, 
          { chords: "Am            F", lyrics: "Worthy of all that we bring" }, 
          { chords: "C           G", lyrics: "You are jehovah, God of love" }, 
          { chords: "Am        F        C", lyrics: "Everything I am is Yours" } 
        ] 
      }, 
      { 
        label: "Chorus", 
        lines: [ 
          { chords: "C                    G", lyrics: "Build my life upon Your love" }, 
          { chords: "Am                F", lyrics: "It is a strong and steadfast love" }, 
          { chords: "C", lyrics: "Build my life upon Your love" } 
        ] 
      } 
    ] 
  },
  { 
    id: "6", key: "F", title: "What A Beautiful Name", artist: "Hillsong Worship", genre: "Worship", bpm: 68,
    backgroundImage: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=600&fit=crop",
    intro: "Open with ethereal choir or vocal pad. Build gradually with band entrance.", 
    introKey: "Ethereal choir pads - gradual band entrance", 
    instruments: ["Keyboard", "Electric Guitar", "Strings", "Choir", "Drums", "Bass", "Vocals"], 
    description: "A powerful declaration of the beauty and majesty of Jesus' name. The song explores multiple names and titles of Christ, celebrating their significance and meaning.",
    sections: [ 
      { 
        label: "Verse 1", 
        lines: [ 
          { chords: "F              C", lyrics: "You were lost and now you're found" }, 
          { chords: "Dm            Bb", lyrics: "You were blind but now you see" }, 
          { chords: "F            C", lyrics: "What a beautiful name it is" }, 
          { chords: "Dm         Bb      F", lyrics: "What a beautiful name" } 
        ] 
      }, 
      { 
        label: "Chorus", 
        lines: [ 
          { chords: "F                 C", lyrics: "Every knee will bow, every tongue confess" }, 
          { chords: "Dm              Bb", lyrics: "That You are God, that You are God" } 
        ] 
      } 
    ] 
  },
  { 
    id: "7", key: "A", title: "Oceans", artist: "Hillsong United", genre: "Worship", bpm: 140,
    backgroundImage: "https://images.unsplash.com/photo-1487449962993-51c417f9b0a9?w=1200&h=600&fit=crop",
    intro: "Start with soaring strings and atmospheric pads. Introduce steady beat that builds momentum.", 
    introKey: "Soaring strings with atmospheric pads", 
    instruments: ["Strings", "Keyboard", "Electric Guitar", "Drums", "Bass", "Choir", "Vocals"], 
    description: "An epic worship song about trusting God in life's uncertainties. The oceanic metaphor speaks to faith in the midst of deep waters and unknowns.",
    sections: [ 
      { 
        label: "Verse 1", 
        lines: [ 
          { chords: "A             E", lyrics: "You call me out upon the waters" }, 
          { chords: "F#m          D", lyrics: "The great unknown where feet may fail" }, 
          { chords: "A             E", lyrics: "And there I find You in the mystery" }, 
          { chords: "F#m       D      A", lyrics: "In oceans deep my faith will stand" } 
        ] 
      }, 
      { 
        label: "Chorus", 
        lines: [ 
          { chords: "A                E", lyrics: "Oh Jesus come close" }, 
          { chords: "F#m              D", lyrics: "All I have is Yours" } 
        ] 
      } 
    ] 
  },
  { 
    id: "8", key: "Bb", title: "10,000 Reasons", artist: "Matt Redman", genre: "Contemporary", bpm: 73,
    backgroundImage: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=600&fit=crop",
    intro: "Begin with warm organ and acoustic elements. Let the celebration build naturally.", 
    introKey: "Warm organ with acoustic celebration", 
    instruments: ["Organ", "Acoustic Guitar", "Piano", "Percussion", "Vocals", "Choir"], 
    description: "Based on Psalm 104, this song is a joyful expression of gratitude and praise. Matt Redman's composition invites worshippers into a lifestyle of continuous thanksgiving.",
    sections: [ 
      { 
        label: "Verse 1", 
        lines: [ 
          { chords: "Bb          F", lyrics: "Bless the Lord, O my soul" }, 
          { chords: "Gm            Eb", lyrics: "O my soul" }, 
          { chords: "Bb           F", lyrics: "Worship His holy name" }, 
          { chords: "Gm        Eb      Bb", lyrics: "Sing like never before" } 
        ] 
      }, 
      { 
        label: "Chorus", 
        lines: [ 
          { chords: "Bb               F", lyrics: "And I'll sing the goodness of the Lord" }, 
          { chords: "Gm              Eb", lyrics: "That my soul, my soul craves for God alone" } 
        ] 
      } 
    ] 
  },
  { 
    id: "9", key: "E", title: "Great Is Thy Faithfulness", artist: "Traditional", genre: "Hymn", bpm: 82,
    backgroundImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop",
    intro: "Open with classic hymnal arrangement. Strong organ foundation with clear leading vocal.", 
    introKey: "Organ foundation with leading vocal", 
    instruments: ["Organ", "Piano", "Violin", "Cello", "Choir", "Vocals"], 
    description: "A timeless hymn declaring God's unfailing faithfulness. Based on Lamentations 3:23, it provides hope and assurance through life's challenges.",
    sections: [ 
      { 
        label: "Verse 1", 
        lines: [ 
          { chords: "E           A    E", lyrics: "Great is Thy faithfulness, O God" }, 
          { chords: "E         B7", lyrics: "There is no shadow of turning" }, 
          { chords: "E          A      E", lyrics: "Thou changest not, Thy compassions fail not" }, 
          { chords: "B7        E", lyrics: "As Thou hast been Thou forever wilt be" } 
        ] 
      }, 
      { 
        label: "Chorus", 
        lines: [ 
          { chords: "E                  A", lyrics: "Great is Thy faithfulness" }, 
          { chords: "E            B7", lyrics: "Great is Thy faithfulness" }, 
          { chords: "E        A", lyrics: "Morning by morning new mercies I see" }, 
          { chords: "B7              E", lyrics: "All I have needed Thy hand hath provided" } 
        ] 
      } 
    ] 
  },
  { 
    id: "10", key: "D", title: "Living Hope", artist: "Phil Wickham", genre: "Contemporary", bpm: 134,
    backgroundImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=600&fit=crop",
    intro: "Start with energetic modern worship drums and bass. Build with layered vocals and instruments.", 
    introKey: "Energetic modern drums with layered build", 
    instruments: ["Electric Guitar", "Keyboard", "Drums", "Bass", "Strings", "Choir", "Vocals"], 
    description: "Phil Wickham's energetic anthem about finding hope in Christ. The high-energy arrangement perfectly matches the triumphant message of resurrection and renewal.",
    sections: [ 
      { 
        label: "Verse 1", 
        lines: [ 
          { chords: "D            A", lyrics: "Even when I don't see it coming" }, 
          { chords: "Bm          G", lyrics: "Even when I don't see it plain" }, 
          { chords: "D              A", lyrics: "You will work out all things for my good" }, 
          { chords: "Bm      G      D", lyrics: "I have living hope" } 
        ] 
      }, 
      { 
        label: "Chorus", 
        lines: [ 
          { chords: "D                 A", lyrics: "I have living hope" }, 
          { chords: "Bm              G", lyrics: "Living faith and living hope in Jesus" }, 
          { chords: "D", lyrics: "I have living hope" } 
        ] 
      } 
    ] 
  },
  {
    id: "11", key: "G", title: "Jesus Paid It All", artist: "Kristian Stanfill", genre: "Contemporary", bpm: 76,
    backgroundImage: "https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=1200&h=600&fit=crop",
    intro: "Begin with tender acoustic guitar and piano. Build into powerful band arrangement with soaring vocals.",
    introKey: "Acoustic guitar and piano foundation",
    instruments: ["Acoustic Guitar", "Piano", "Electric Guitar", "Strings", "Drums", "Bass", "Vocals"],
    description: "Kristian Stanfill's powerful take on the classic hymn emphasizing complete redemption through Christ. The arrangement bridges traditional and contemporary worship styles.",
    sections: [
      {
        label: "Verse 1",
        lines: [
          { chords: "G              D", lyrics: "I hear the Savior say" },
          { chords: "Em            C", lyrics: "Thy strength indeed is small" },
          { chords: "G              D", lyrics: "Child of weakness, watch and pray" },
          { chords: "Em        C      G", lyrics: "Find in Me thine all in all" },
        ],
      },
      {
        label: "Chorus",
        lines: [
          { chords: "G                 D", lyrics: "Jesus paid it all" },
          { chords: "Em              C", lyrics: "All to Him I owe" },
          { chords: "G                  D", lyrics: "Sin had left a crimson stain" },
          { chords: "Em          C      G", lyrics: "He washed it white as snow" },
        ],
      },
    ],
  },
  {
    id: "12", key: "A", title: "Forever Grateful", artist: "Brandon Lake", genre: "Worship", bpm: 70,
    backgroundImage: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=600&fit=crop",
    intro: "Start with reflective strings and acoustic elements. Build warmth with layered harmonies and band.",
    introKey: "Reflective strings with acoustic foundation",
    instruments: ["Acoustic Guitar", "Strings", "Keyboard", "Drums", "Bass", "Choir", "Vocals"],
    description: "Brandon Lake's intimate worship song about perpetual gratitude. The gentle arrangement invites personal reflection while celebrating God's goodness and faithfulness.",
    sections: [
      {
        label: "Verse 1",
        lines: [
          { chords: "A             E", lyrics: "I'm forever grateful" },
          { chords: "F#m          D", lyrics: "For the blood that set me free" },
          { chords: "A             E", lyrics: "I'm forever grateful" },
          { chords: "F#m       D      A", lyrics: "That Your love will follow me" },
        ],
      },
      {
        label: "Chorus",
        lines: [
          { chords: "A                E", lyrics: "Jesus, Savior, I will follow" },
          { chords: "F#m              D", lyrics: "With my heart, my soul, my life" },
          { chords: "A", lyrics: "Forever grateful" },
        ],
      },
    ],
  },
  {
    id: "13", key: "F#", title: "Raise a Hallelujah", artist: "Bethel Music", genre: "Worship", bpm: 120,
    backgroundImage: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=600&fit=crop",
    intro: "Explosive opening with full band energy. Driving drums and bass create momentum from the start.",
    introKey: "High-energy explosive band opening",
    instruments: ["Electric Guitar", "Keyboard", "Drums", "Bass", "Percussion", "Strings", "Vocals"],
    description: "An empowering declaration of praise that transcends circumstances. Jenn Johnson's song encourages worship even amid trials, drawing strength from God's presence.",
    sections: [
      {
        label: "Verse 1",
        lines: [
          { chords: "F#          C#", lyrics: "I raise a hallelujah" },
          { chords: "G#m         D#m", lyrics: "With everything I have" },
          { chords: "F#          C#", lyrics: "I raise a hallelujah" },
          { chords: "G#m       D#m    F#", lyrics: "Here in the darkest day" },
        ],
      },
      {
        label: "Chorus",
        lines: [
          { chords: "F#                 C#", lyrics: "When I cannot feel His pleasure" },
          { chords: "G#m              D#m", lyrics: "I will choose to enter in" },
          { chords: "F#", lyrics: "I raise a hallelujah" },
        ],
      },
    ],
  },
  {
    id: "14", key: "Bb", title: "Graves Into Gardens", artist: "Elevation Worship", genre: "Contemporary", bpm: 130,
    backgroundImage: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=600&fit=crop",
    intro: "Start with contemplative strings transitioning to an energetic modern beat. Build dramatic tension and release.",
    introKey: "Contemplative to energetic transition",
    instruments: ["Strings", "Keyboard", "Electric Guitar", "Drums", "Bass", "Choir", "Vocals"],
    description: "Brandon Lake's anthem about transformation and resurrection. The song speaks to God's power to turn our pain into purpose and our graves into gardens.",
    sections: [
      {
        label: "Verse 1",
        lines: [
          { chords: "Bb            F", lyrics: "I searched the world but it couldn't fill" },
          { chords: "Gm           Eb", lyrics: "The longing in my soul" },
          { chords: "Bb            F", lyrics: "I came empty before the cross" },
          { chords: "Gm        Eb    Bb", lyrics: "And lost all my control" },
        ],
      },
      {
        label: "Chorus",
        lines: [
          { chords: "Bb                F", lyrics: "He turned my mourning into dancing" },
          { chords: "Gm              Eb", lyrics: "Again He's turned my shame to glory" },
          { chords: "Bb", lyrics: "Graves into gardens" },
        ],
      },
    ],
  },
  {
    id: "15", key: "E", title: "Goodness of Jesus", artist: "Jenn Johnson", genre: "Worship", bpm: 95,
    backgroundImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop",
    intro: "Warm acoustic introduction with layered harmonies. Build with subtle orchestration creating intimacy.",
    introKey: "Warm acoustic with layered harmonies",
    instruments: ["Acoustic Guitar", "Piano", "Strings", "Choir", "Drums", "Bass", "Vocals"],
    description: "Jenn Johnson's tender worship song celebrating the goodness and kindness of Jesus. The song creates a safe space for encountering God's love and compassion.",
    sections: [
      {
        label: "Verse 1",
        lines: [
          { chords: "E            B", lyrics: "In the goodness of Jesus" },
          { chords: "C#m         A", lyrics: "I have everything I need" },
          { chords: "E            B", lyrics: "In the goodness of Jesus" },
          { chords: "C#m       A     E", lyrics: "I have found my peace" },
        ],
      },
      {
        label: "Chorus",
        lines: [
          { chords: "E                 B", lyrics: "He is kind, He is patient" },
          { chords: "C#m              A", lyrics: "He is gentle, He is strong" },
          { chords: "E", lyrics: "In the goodness of Jesus" },
        ],
      },
    ],
  },
]

const GENRES: Genre[] = ["Worship", "Contemporary", "Hymn"]

// ─── Tools Tab (Chord Chart Viewer) ──────────────────────────────────────────

const FONT_SIZES = [14, 16, 18, 20, 24] as const
type FontSize = (typeof FONT_SIZES)[number]

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-1 justify-end">{children}</div>
    </div>
  )
}

function ToggleSwitch({ id, checked, onChange }: { id: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060] focus-visible:ring-offset-2",
        checked ? "bg-[#C09060]" : "bg-muted"
      )}
    >
      <span className={cn("pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform", checked ? "translate-x-4" : "translate-x-0")} />
    </button>
  )
}

// ─── METRONOME COMPONENT ─────────────────────────────────────────────────────

function MetronomeWidget({ bpm, playing, onToggle }: { bpm: number; playing: boolean; onToggle: () => void }) {
  return (
    <motion.div
      className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-4 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Metronome</span>
        <motion.div
          animate={playing ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="h-3 w-3 rounded-full bg-[#C09060]"
        />
      </div>
      
      <div className="text-center">
        <p className="text-3xl font-black text-[#C09060]">{bpm}</p>
        <p className="text-xs text-slate-400 mt-1">BPM</p>
      </div>

      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "w-full rounded-lg px-4 py-2 text-sm font-bold transition-all",
          playing
            ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
            : "bg-[#C09060]/20 text-[#C09060] border border-[#C09060]/50 hover:bg-[#C09060]/30"
        )}
      >
        {playing ? "Stop" : "Start"}
      </motion.button>
    </motion.div>
  )
}

// ─── INSTRUMENTS DISPLAY COMPONENT ────────────────────────────────────────

function InstrumentsPanel({ song }: { song: Song }) {
  const defaultInstruments = ["Vocals", "Guitar", "Bass", "Drums", "Keys"]
  const instruments = (song as any).instruments || defaultInstruments

  return (
    <motion.div
      className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-4 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Recommended Instruments</p>
      
      <div className="flex flex-wrap gap-2">
        {instruments.map((instrument: string) => (
          <motion.span
            key={instrument}
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-1 rounded-full bg-[#C09060]/15 px-3 py-1 text-xs font-semibold text-[#C09060] border border-[#C09060]/30"
          >
            {instrument}
          </motion.span>
        ))}
      </div>
    </motion.div>
  )
}

// ─── AUDIO TRACK SYNC COMPONENT ──────────────────────────────────────────────

function AudioTrackSync({ bpm, progress }: { bpm: number; progress: number }) {
  return (
    <motion.div
      className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-4 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Audio Sync</span>
        <span className="text-xs font-bold text-[#C09060]">{Math.round(progress)}%</span>
      </div>

      <div className="space-y-2">
        <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#C09060] to-[#B8860B]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", damping: 20 }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Music className="h-3 w-3 text-[#C09060]" />
        <span>{bpm} BPM - Synced</span>
      </div>
    </motion.div>
  )
}

function ToolsTab({ song, onClose }: { song: Song; onClose: () => void }) {
  const originalKeyIndex = KEYS.indexOf(normalizeNote(song.key))
  const [semitones, setSemitones] = useState(0)
  const [capo, setCapo] = useState(0)
  const [fontSize, setFontSize] = useState<FontSize>(16)
  const [lineSpacing, setLineSpacing] = useState<"tight" | "normal" | "relaxed">("normal")
  const [columns, setColumns] = useState<1 | 2>(1)
  const [showChords, setShowChords] = useState(true)
  const [chordStyle, setChordStyle] = useState<"letters" | "nashville" | "numbers">("letters")
  const [theme, setTheme] = useState<"default" | "night">("night")
  const [speed, setSpeed] = useState(100)
  const [bpm, setBpm] = useState(120)
  const [autoScroll, setAutoScroll] = useState(false)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false)
  
  // Musician Features states with localStorage persistence
  const [audioTrackSync, setAudioTrackSync] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('musicianFeatures_audioTrackSync')
      return saved !== null ? JSON.parse(saved) : true
    }
    return true
  })
  const [capoTips, setCapoTips] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('musicianFeatures_capoTips')
      return saved !== null ? JSON.parse(saved) : false
    }
    return false
  })
  const [showScales, setShowScales] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('musicianFeatures_showScales')
      return saved !== null ? JSON.parse(saved) : true
    }
    return true
  })
  const [metronomeEnabled, setMetronomeEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('musicianFeatures_metronome')
      return saved !== null ? JSON.parse(saved) : false
    }
    return false
  })
  const [showInstruments, setShowInstruments] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('musicianFeatures_showInstruments')
      return saved !== null ? JSON.parse(saved) : false
    }
    return false
  })
  const [metronomePlaying, setMetronomePlaying] = useState(false)
  const abcContainerRef = useRef<HTMLDivElement>(null)
  
  // Persist musician features to localStorage
  const updateAudioTrackSync = (value: boolean) => {
    setAudioTrackSync(value)
    if (typeof window !== 'undefined') localStorage.setItem('musicianFeatures_audioTrackSync', JSON.stringify(value))
  }
  const updateCapoTips = (value: boolean) => {
    setCapoTips(value)
    if (typeof window !== 'undefined') localStorage.setItem('musicianFeatures_capoTips', JSON.stringify(value))
  }
  const updateShowScales = (value: boolean) => {
    setShowScales(value)
    if (typeof window !== 'undefined') localStorage.setItem('musicianFeatures_showScales', JSON.stringify(value))
  }
  const updateMetronomeEnabled = (value: boolean) => {
    setMetronomeEnabled(value)
    if (typeof window !== 'undefined') localStorage.setItem('musicianFeatures_metronome', JSON.stringify(value))
  }
  const updateShowInstruments = (value: boolean) => {
    setShowInstruments(value)
    if (typeof window !== 'undefined') localStorage.setItem('musicianFeatures_showInstruments', JSON.stringify(value))
  }
  
  // Dropdown states for features
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  
  // Modal states for advanced features
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editLyricsModalOpen, setEditLyricsModalOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [musicianModalOpen, setMusicianModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const effectiveSemitones = semitones - capo
  const currentKeyIndex = (originalKeyIndex + semitones + 12) % 12
  const currentKey = KEYS[currentKeyIndex] ?? song.key

  function shiftKey(delta: number) {
    setSemitones((prev) => (prev + delta + 12) % 12)
  }

  if (!song.sections || song.sections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <Music2 className="h-10 w-10 opacity-30" aria-hidden="true" />
        <p className="text-sm">No chord chart available yet.</p>
      </div>
    )
  }

  const bgClass = theme === "night" ? "bg-slate-900 text-slate-100" : "bg-background text-foreground"
  const chordColorClass = theme === "night" ? "text-amber-400" : "text-primary"

  return (
    <div className={cn("relative flex flex-col h-full rounded-2xl border border-border shadow-2xl overflow-hidden", bgClass)}>
      {/* ── Floating Header with Toolbar ── */}
      <div className={cn("flex items-center justify-between gap-3 px-6 py-4 border-b", theme === "night" ? "border-slate-700 bg-slate-800/50" : "border-border bg-muted/30")}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to songs"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{song.title}</h2>
          <p className={cn("text-sm truncate", theme === "night" ? "text-slate-400" : "text-muted-foreground")}>
            {song.artist}
          </p>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="Edit song"
            title="Edit"
            onClick={() => setEditModalOpen(true)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]",
              theme === "night" ? "hover:bg-slate-700 text-slate-300" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Edit lyrics"
            title="Edit Lyrics"
            onClick={() => setEditLyricsModalOpen(true)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]",
              theme === "night" ? "hover:bg-slate-700 text-slate-300" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Share song"
            title="Share"
            onClick={() => setShareModalOpen(true)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]",
              theme === "night" ? "hover:bg-slate-700 text-slate-300" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Add to active plan"
            title="Add to Plan"
            onClick={() => setPlanModalOpen(true)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]",
              theme === "night" ? "hover:bg-slate-700 text-slate-300" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <Folder className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={showChords ? "Hide chords" : "Show chords"}
            aria-pressed={showChords}
            title={showChords ? "Hide chords" : "Show chords"}
            onClick={() => setShowChords((v) => !v)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]",
              showChords
                ? "bg-[#C09060]/20 text-[#C09060]"
                : theme === "night" ? "hover:bg-slate-700 text-slate-300" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Musician features"
            title="Musician"
            onClick={() => setMusicianModalOpen(true)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]",
              theme === "night" ? "hover:bg-slate-700 text-slate-300" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <Music2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={isHeaderCollapsed ? "Expand" : "Collapse"}
            onClick={() => setIsHeaderCollapsed((v) => !v)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060]",
              theme === "night" ? "hover:bg-slate-700 text-slate-300" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Main Content with Sidebar ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Chord Chart ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!isHeaderCollapsed && (
            <div
              role="region"
              aria-label="Chord chart"
              className={cn(
                "flex-1 overflow-y-auto p-6 space-y-6 font-mono",
                columns === 2 && "columns-2 gap-6",
                lineSpacing === "tight" && "leading-tight",
                lineSpacing === "normal" && "leading-relaxed",
                lineSpacing === "relaxed" && "leading-loose",
                theme === "night" && "text-slate-200"
              )}
              style={{ fontSize }}
            >
              {/* Intro Chord Progression Box */}
              {song.sections && song.sections.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    "mb-8 p-4 rounded-lg border-2",
                    theme === "night"
                      ? "border-red-500 bg-slate-800/50"
                      : "border-red-500 bg-red-50/30"
                  )}
                >
                  <div className={cn("flex flex-wrap gap-4 items-center", theme === "night" ? "text-slate-900" : "text-slate-900")}>
                    <span className="font-bold text-lg">Intro:</span>
                    <div className="flex gap-3 flex-wrap">
                      {song.key && (
                        <>
                          <span className={cn("font-bold text-lg", theme === "night" ? "text-blue-300" : "text-blue-700")}>
                            {song.key}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Feature Dropdowns Toolbar */}
              <div className={cn("mb-8 flex flex-wrap gap-2 pb-4", theme === "night" ? "border-b border-slate-700" : "border-b border-slate-200")}>
                {/* Instruments Dropdown */}
                {showInstruments && song.instruments && song.instruments.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "instruments" ? null : "instruments")}
                      className={cn("p-2 rounded transition-colors", 
                        openDropdown === "instruments"
                          ? (theme === "night" ? "bg-purple-900/50 text-purple-300" : "bg-purple-100 text-purple-700")
                          : (theme === "night" ? "hover:bg-slate-700 text-purple-400" : "hover:bg-slate-100 text-purple-600")
                      )}
                      title="Instruments"
                    >
                      <span className="text-lg">🎺</span>
                    </button>
                    {openDropdown === "instruments" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn("absolute left-0 top-full mt-2 z-50 rounded-lg border shadow-lg p-4 min-w-max", 
                          theme === "night" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                        )}
                      >
                        <p className={cn("text-xs font-bold uppercase tracking-widest mb-3", theme === "night" ? "text-purple-400" : "text-purple-600")}>
                          Instruments
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {song.instruments.map((instrument, idx) => (
                            <span key={idx} className={cn("px-3 py-1 rounded-full text-xs font-medium", theme === "night" ? "bg-purple-900/50 text-purple-200" : "bg-purple-100 text-purple-700")}>
                              {instrument}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Capo & Fingering Dropdown */}
                {capoTips && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "capo" ? null : "capo")}
                      className={cn("p-2 rounded transition-colors", 
                        openDropdown === "capo"
                          ? (theme === "night" ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-700")
                          : (theme === "night" ? "hover:bg-slate-700 text-green-400" : "hover:bg-slate-100 text-green-600")
                      )}
                      title="Capo & Fingering Tips"
                    >
                      <span className="text-lg">🎸</span>
                    </button>
                    {openDropdown === "capo" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn("absolute left-0 top-full mt-2 z-50 rounded-lg border shadow-lg p-4 min-w-max", 
                          theme === "night" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                        )}
                      >
                        <p className={cn("text-xs font-bold uppercase tracking-widest mb-2", theme === "night" ? "text-green-400" : "text-green-600")}>
                          Capo Position
                        </p>
                        <div className={cn("text-lg font-bold", theme === "night" ? "text-green-300" : "text-green-700")}>
                          Capo: {capo > 0 ? `Fret ${capo}` : "No Capo"}
                        </div>
                        <p className={cn("mt-2 text-xs", theme === "night" ? "text-slate-400" : "text-slate-600")}>
                          Adjust capo position using the controls above.
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Show Scales & Modes Dropdown */}
                {showScales && song.sections && song.sections.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "scales" ? null : "scales")}
                      className={cn("p-2 rounded transition-colors", 
                        openDropdown === "scales"
                          ? (theme === "night" ? "bg-cyan-900/50 text-cyan-300" : "bg-cyan-100 text-cyan-700")
                          : (theme === "night" ? "hover:bg-slate-700 text-cyan-400" : "hover:bg-slate-100 text-cyan-600")
                      )}
                      title="Show Scales & Modes"
                    >
                      <span className="text-lg">🎹</span>
                    </button>
                    {openDropdown === "scales" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn("absolute left-0 top-full mt-2 z-50 rounded-lg border shadow-lg p-4 min-w-max", 
                          theme === "night" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                        )}
                      >
                        <p className={cn("text-xs font-bold uppercase tracking-widest mb-2", theme === "night" ? "text-cyan-400" : "text-cyan-600")}>
                          Chord Scale Information
                        </p>
                        <div className="space-y-2 text-xs">
                          <p className={cn("font-medium", theme === "night" ? "text-cyan-300" : "text-cyan-700")}>
                            Key: {currentKey}
                          </p>
                          <p className={cn(theme === "night" ? "text-slate-400" : "text-slate-600")}>
                            Understand chord relationships and improve improvisation.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Audio Track Sync Dropdown */}
                {audioTrackSync && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "audio" ? null : "audio")}
                      className={cn("p-2 rounded transition-colors", 
                        openDropdown === "audio"
                          ? (theme === "night" ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-700")
                          : (theme === "night" ? "hover:bg-slate-700 text-blue-400" : "hover:bg-slate-100 text-blue-600")
                      )}
                      title="Audio Track Sync"
                    >
                      <span className="text-lg">🎵</span>
                    </button>
                    {openDropdown === "audio" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn("absolute left-0 top-full mt-2 z-50 rounded-lg border shadow-lg p-4 min-w-max", 
                          theme === "night" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                        )}
                      >
                        <p className={cn("text-xs font-bold uppercase tracking-widest mb-2", theme === "night" ? "text-blue-400" : "text-blue-600")}>
                          Audio Track
                        </p>
                        <p className={cn("text-xs", theme === "night" ? "text-slate-300" : "text-slate-700")}>
                          Play along with backing track at {speed}% speed.
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Metronome Dropdown */}
                {metronomeEnabled && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "metronome" ? null : "metronome")}
                      className={cn("p-2 rounded transition-colors", 
                        openDropdown === "metronome"
                          ? (theme === "night" ? "bg-yellow-900/50 text-yellow-300" : "bg-yellow-100 text-yellow-700")
                          : (theme === "night" ? "hover:bg-slate-700 text-yellow-400" : "hover:bg-slate-100 text-yellow-600")
                      )}
                      title="Metronome"
                    >
                      <span className="text-lg">🔊</span>
                    </button>
                    {openDropdown === "metronome" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn("absolute left-0 top-full mt-2 z-50 rounded-lg border shadow-lg p-4 min-w-max", 
                          theme === "night" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className={cn("text-xs font-bold uppercase tracking-widest", theme === "night" ? "text-yellow-400" : "text-yellow-600")}>
                            Metronome
                          </p>
                          <button
                            type="button"
                            onClick={() => setMetronomePlaying(!metronomePlaying)}
                            className={cn("px-2 py-1 rounded text-xs font-medium transition-colors", metronomePlaying ? (theme === "night" ? "bg-yellow-900/50 text-yellow-200" : "bg-yellow-200 text-yellow-900") : (theme === "night" ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"))}
                          >
                            {metronomePlaying ? "Stop" : "Start"}
                          </button>
                        </div>
                        <div className={cn("text-center py-2 rounded", theme === "night" ? "bg-slate-700/50" : "bg-slate-100/50")}>
                          <p className={cn("text-lg font-bold", theme === "night" ? "text-yellow-300" : "text-yellow-700")}>
                            {bpm} BPM
                          </p>
                          <p className={cn("text-xs mt-1", theme === "night" ? "text-slate-400" : "text-slate-600")}>
                            {metronomePlaying ? "Playing..." : "Ready"}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Feature Panels Below Controls */}
              <AnimatePresence>
                <motion.div className="mt-4 space-y-3">
                  {audioTrackSync && (
                    <AudioTrackSync bpm={bpm} progress={Math.random() * 100} />
                  )}
                  {metronomeEnabled && (
                    <MetronomeWidget bpm={bpm} playing={metronomePlaying} onToggle={() => setMetronomePlaying(!metronomePlaying)} />
                  )}
                  {showInstruments && (
                    <InstrumentsPanel song={song} />
                  )}
                </motion.div>
              </AnimatePresence>

              {song.sections && song.sections.map((section) => (
                <section key={section.label} aria-label={section.label} className="mb-8">
                  <button
                    type="button"
                    className={cn("mb-4 text-sm font-bold uppercase tracking-widest transition-colors", 
                      theme === "night" ? "text-[#C09060] hover:text-orange-300" : "text-[#B8860B] hover:text-[#A0722E]"
                    )}
                    aria-expanded={true}
                  >
                    ▸ {section.label}
                  </button>
                  <div className="space-y-4">
                    <div className="font-mono space-y-1 text-sm md:text-base leading-7 overflow-x-auto">
                      {section.lines.map((line, i) => {
                        const transposedChords = displayChord(transposeLine(line.chords, effectiveSemitones))
                        if (!showChords || !line.chords) {
                          return (
                            <div key={i} className="text-slate-300 whitespace-pre">
                              {line.lyrics}
                            </div>
                          )
                        }
                        return (
                          <div key={i} className="space-y-0">
                            <div className="text-[#C09060] font-bold whitespace-pre">
                              {transposedChords}
                            </div>
                            <div className="text-slate-300 whitespace-pre">
                              {line.lyrics}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              ))}

              {/* ABC Notation View */}
              {showABC && (
                <div
                  ref={abcContainerRef}
                  id="abc-songs-container"
                  className={cn(
                    "mt-8 p-6 rounded-lg border",
                    theme === "night"
                      ? "bg-slate-800/50 border-slate-700"
                      : "bg-slate-50 border-border"
                  )}
                />
              )}
            </div>
          )}

          {/* ── Bottom Controls ── */}
          {!isHeaderCollapsed && (
            <div className={cn("border-t px-6 py-3 flex items-center gap-4 flex-wrap", theme === "night" ? "border-slate-700 bg-slate-900/30" : "border-border bg-muted/10")}>
              {/* Auto Scroll */}
              <button
                type="button"
                aria-label={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
                aria-pressed={autoScroll}
                onClick={() => setAutoScroll((v) => !v)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  autoScroll
                    ? "bg-[#C09060] text-white"
                    : theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <span>Auto Scroll</span>
                <div className={cn("w-3 h-2 rounded-full transition-colors", autoScroll ? "bg-white" : "bg-slate-500")} />
              </button>

              {/* ABC Notation */}
              <button
                type="button"
                aria-label={showABC ? "Hide ABC notation" : "Show ABC notation"}
                aria-pressed={showABC}
                onClick={() => setShowABC((v) => !v)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  showABC
                    ? "bg-[#C09060] text-white"
                    : theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Music2 className="h-3.5 w-3.5" />
                <span>ABC</span>
              </button>

              {/* Speed Control */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease speed"
                  onClick={() => setSpeed((v) => Math.max(50, v - 10))}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded text-xs transition-colors",
                    theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  −
                </button>
                <span className="text-xs font-medium w-8 text-center">{speed}%</span>
                <button
                  type="button"
                  aria-label="Increase speed"
                  onClick={() => setSpeed((v) => Math.min(150, v + 10))}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded text-xs transition-colors",
                    theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  +
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                type="button"
                aria-label="Toggle theme"
                onClick={() => setTheme((v) => v === "night" ? "default" : "night")}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded transition-colors",
                  theme === "night" ? "text-yellow-400 hover:bg-slate-700" : "text-slate-400 hover:bg-muted"
                )}
              >
                {theme === "night" ? "☀" : "☾"}
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                aria-label="Fullscreen"
                className={cn(
                  "ml-auto flex h-6 w-6 items-center justify-center rounded transition-colors",
                  theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
                )}
              >
                ⛶
              </button>
            </div>
          )}
        </div>

        {/* ── Right Sidebar ── */}
        {!isHeaderCollapsed && (
          <div className={cn("w-20 flex flex-col items-center py-6 gap-8 border-l", theme === "night" ? "border-slate-700 bg-slate-900/50" : "border-border bg-muted/10")}>
            {/* Key Display */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs uppercase font-medium text-muted-foreground">Key</span>
              <span className="text-2xl font-bold text-[#C09060]">{currentKey}</span>
            </div>

            {/* Transpose */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                aria-label="Transpose up"
                onClick={() => shiftKey(1)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-lg transition-colors",
                  theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
                )}
              >
                +
              </button>
              <span className="text-xs uppercase font-medium text-muted-foreground">Transpose</span>
              <button
                type="button"
                aria-label="Transpose down"
                onClick={() => shiftKey(-1)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-lg transition-colors",
                  theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
                )}
              >
                −
              </button>
            </div>

            {/* Font Size */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs uppercase font-medium text-muted-foreground">Font</span>
              <div className="flex flex-col gap-1">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={fontSize === size}
                    onClick={() => setFontSize(size)}
                    className={cn(
                      "h-5 w-5 rounded text-xs font-medium transition-colors",
                      fontSize === size
                        ? "bg-[#C09060] text-white"
                        : theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Collapse */}
            <button
              type="button"
              aria-label="Toggle sidebar"
              onClick={() => setIsHeaderCollapsed((v) => !v)}
              className={cn(
                "mt-auto flex h-6 w-6 items-center justify-center rounded transition-colors",
                theme === "night" ? "text-slate-300 hover:bg-slate-700" : "text-muted-foreground hover:bg-muted"
              )}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      <AnimatePresence>
        {editModalOpen && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className={cn("w-full max-w-md rounded-lg border p-6 shadow-lg", theme === "night" ? "bg-slate-800 border-slate-700" : "bg-background border-border")}
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <h3 className="mb-4 text-lg font-bold">Edit Song</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Title</label>
                  <input type="text" defaultValue={song.title} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Artist</label>
                  <input type="text" defaultValue={song.artist} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Key</label>
                  <input type="text" defaultValue={song.key} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2 pt-4">
                  <motion.button 
                    onClick={() => setEditModalOpen(false)} 
                    className="flex-1 rounded bg-muted py-2 text-sm font-medium"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button 
                    onClick={() => setEditModalOpen(false)} 
                    className="flex-1 rounded bg-[#C09060] py-2 text-sm font-medium text-white"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Save
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Lyrics Modal ── */}
      <AnimatePresence>
        {editLyricsModalOpen && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditLyricsModalOpen(false)}
          >
            <motion.div 
              className={cn("w-full max-w-2xl rounded-lg border p-6 shadow-lg max-h-[90vh] overflow-y-auto", theme === "night" ? "bg-slate-900 border-slate-700" : "bg-background border-border")}
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Edit Lyrics</h3>
                <motion.button 
                  onClick={() => setEditLyricsModalOpen(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              <div className="space-y-4">
                {song.sections?.map((section, sectionIdx) => (
                  <motion.div 
                    key={sectionIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sectionIdx * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-sm font-bold uppercase text-[#C09060]">{section.label}</label>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#C09060] to-transparent" />
                    </div>
                    {section.lines.map((line, lineIdx) => (
                      <motion.div 
                        key={lineIdx}
                        className="space-y-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: (sectionIdx * 0.1) + (lineIdx * 0.05) }}
                      >
                        {line.chords && (
                          <input 
                            type="text" 
                            defaultValue={line.chords}
                            placeholder="Chords..."
                            className="w-full rounded border border-slate-600 bg-slate-800/50 px-3 py-1 text-xs font-mono text-amber-300 placeholder-slate-600 focus:border-[#C09060] focus:outline-none transition-colors"
                          />
                        )}
                        <textarea 
                          defaultValue={line.lyrics}
                          placeholder="Lyrics..."
                          className="w-full rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:border-[#C09060] focus:outline-none transition-colors resize-none h-12"
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-700 mt-6">
                <motion.button 
                  onClick={() => setEditLyricsModalOpen(false)} 
                  className="flex-1 rounded-lg bg-slate-700/50 hover:bg-slate-700 px-4 py-2.5 text-sm font-bold text-white transition-colors uppercase tracking-wide"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
                <motion.button 
                  onClick={() => setEditLyricsModalOpen(false)} 
                  className="flex-1 rounded-lg bg-gradient-to-r from-[#C09060] to-[#B8860B] hover:from-[#B8860B] hover:to-[#A0722E] px-4 py-2.5 text-sm font-bold text-white transition-all uppercase tracking-wide"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Share Modal ── */}
      <AnimatePresence>
        {shareModalOpen && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className={cn("w-full max-w-md rounded-lg border p-6 shadow-lg", theme === "night" ? "bg-slate-800 border-slate-700" : "bg-background border-border")}
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <h3 className="mb-4 text-lg font-bold">Share Song</h3>
              <motion.div 
                className="space-y-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {["📧 Share via Email", "💬 Copy Link", "👥 Share to Team", "📥 Export PDF"].map((label, idx) => (
                  <motion.button 
                    key={idx}
                    className="w-full rounded border border-border bg-background px-4 py-2 text-sm font-medium text-left transition hover:bg-muted"
                    variants={staggerItem}
                    whileHover={{ x: 4 }}
                  >
                    {label}
                  </motion.button>
                ))}
              </motion.div>
              <motion.button 
                onClick={() => setShareModalOpen(false)} 
                className="mt-4 w-full rounded bg-muted py-2 text-sm font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add to Plan Modal ── */}
      <AnimatePresence>
        {planModalOpen && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className={cn("w-full max-w-md rounded-lg border p-6 shadow-lg", theme === "night" ? "bg-slate-800 border-slate-700" : "bg-background border-border")}
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <h3 className="mb-4 text-lg font-bold">Add to Plan</h3>
              <motion.div 
                className="space-y-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {[
                  { label: "✓ Sunday Service", active: true },
                  { label: "Wednesday Practice", active: false },
                  { label: "Monthly Event", active: false },
                ].map((plan, idx) => (
                  <motion.button 
                    key={idx}
                    className={cn(
                      "w-full rounded px-4 py-2 text-sm font-medium text-left transition",
                      plan.active 
                        ? "rounded border-2 border-[#C09060] bg-orange-50 text-[#B8860B] hover:bg-orange-100"
                        : "rounded border border-border bg-background hover:bg-muted"
                    )}
                    variants={staggerItem}
                    whileHover={{ scale: 1.02 }}
                  >
                    {plan.label}
                  </motion.button>
                ))}
              </motion.div>
              <input type="text" placeholder="Create new plan..." className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-sm" />
              <motion.button 
                onClick={() => setPlanModalOpen(false)} 
                className="mt-4 w-full rounded bg-muted py-2 text-sm font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Musician Features Modal ── */}
      <AnimatePresence>
        {musicianModalOpen && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className={cn("w-full max-w-md rounded-lg border p-6 shadow-lg", theme === "night" ? "bg-slate-800 border-slate-700" : "bg-background border-border")}
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <h3 className="mb-4 text-lg font-bold">Musician Features</h3>
              <motion.div 
                className="space-y-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                <motion.label 
                  className="flex items-center gap-3 rounded border border-border bg-background px-4 py-2 cursor-pointer hover:bg-muted"
                  variants={staggerItem}
                  whileHover={{ x: 4 }}
                >
                  <input type="checkbox" checked={audioTrackSync} onChange={(e) => updateAudioTrackSync(e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium">🎵 Audio Track Sync</span>
                </motion.label>

                <motion.label 
                  className="flex items-center gap-3 rounded border border-border bg-background px-4 py-2 cursor-pointer hover:bg-muted"
                  variants={staggerItem}
                  whileHover={{ x: 4 }}
                >
                  <input type="checkbox" checked={capoTips} onChange={(e) => updateCapoTips(e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium">🎸 Capo & Fingering Tips</span>
                </motion.label>

                <motion.label 
                  className="flex items-center gap-3 rounded border border-border bg-background px-4 py-2 cursor-pointer hover:bg-muted"
                  variants={staggerItem}
                  whileHover={{ x: 4 }}
                >
                  <input type="checkbox" checked={showScales} onChange={(e) => updateShowScales(e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium">🎹 Show Scales & Modes</span>
                </motion.label>

                <motion.label 
                  className="flex items-center gap-3 rounded border border-border bg-background px-4 py-2 cursor-pointer hover:bg-muted"
                  variants={staggerItem}
                  whileHover={{ x: 4 }}
                >
                  <input type="checkbox" checked={metronomeEnabled} onChange={(e) => updateMetronomeEnabled(e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium">🔊 Metronome</span>
                </motion.label>

                <motion.label 
                  className="flex items-center gap-3 rounded border border-border bg-background px-4 py-2 cursor-pointer hover:bg-muted"
                  variants={staggerItem}
                  whileHover={{ x: 4 }}
                >
                  <input type="checkbox" checked={showInstruments} onChange={(e) => updateShowInstruments(e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium">🎺 Type of Instruments</span>
                </motion.label>
              </motion.div>
              <motion.button 
                onClick={() => setMusicianModalOpen(false)} 
                className="mt-4 w-full rounded bg-muted py-2 text-sm font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


// ─── Song Detail ─────────────────────────────────────────────────���────────────

function SongDetail({ song, onClose }: { song: Song; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <ToolsTab song={song} onClose={onClose} />
    </div>
  )
}

// ─── Share Tab ────────��───────────────────────────────────────────────────────

// ─── Song Row ─────────────────────────────────────────────────────────────────

function SongRow({ song, isSelected, onClick }: { song: Song; isSelected: boolean; onClick: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-4 border-b border-border px-4 py-3.5 text-left transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isSelected ? "bg-orange-50 dark:bg-orange-950/30" : "hover:bg-orange-50/60 dark:hover:bg-orange-950/20"
      )}
    >
      <span className="w-10 shrink-0 text-base font-bold text-[#C09060]">{song.key}</span>
      <span className="flex-1 font-semibold text-foreground">{song.title}</span>
      <span className="hidden text-sm text-muted-foreground sm:block">{song.artist}</span>
      <div className="flex items-center gap-2">
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-orange-100/50 dark:hover:bg-orange-950/40 transition-colors opacity-0 group-hover:opacity-100"
          title="Song options"
        >
          <MoreVertical className="h-4 w-4" />
        </motion.button>
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", isSelected ? "text-[#C09060] translate-x-0.5" : "text-muted-foreground group-hover:translate-x-0.5")} />
      </div>

      {/* Ellipsis Menu Modal */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-12 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg min-w-[180px]"
          >
            <motion.button
              onClick={() => {
                setMenuOpen(false)
                onClick()
                setTimeout(() => {
                  // Trigger edit mode in parent
                  const editEvent = new CustomEvent('editSong', { detail: { song } })
                  window.dispatchEvent(editEvent)
                }, 300)
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-colors first:rounded-t-lg border-b border-border/50"
            >
              <PencilIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Edit</span>
            </motion.button>
            <motion.button
              onClick={() => {
                setMenuOpen(false)
                router.push(`/songs/${song.id}`)
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-colors last:rounded-b-lg"
            >
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Full View</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}

// ─── Song Card ────────────────────────────────────────────────────────────────

function SongCard({ song, isSelected, onClick }: { song: Song; isSelected: boolean; onClick: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <motion.div
      className="relative"
      onClickCapture={(e) => {
        if (menuOpen && e.target !== e.currentTarget) {
          e.stopPropagation()
        }
      }}
    >
      <motion.button
        type="button"
        aria-pressed={isSelected}
        onClick={onClick}
        whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0, 0, 0, 0.1)" }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "group flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full cursor-pointer",
          isSelected
            ? "border-[#C09060] bg-orange-50 dark:bg-orange-950/30"
            : "border-border bg-card hover:border-orange-300 hover:bg-orange-50/40"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <motion.span 
              className="text-xl font-bold text-[#C09060]"
              animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {song.key}
            </motion.span>
            <span className="font-semibold leading-snug text-foreground block">{song.title}</span>
            <span className="text-xs text-muted-foreground">{song.artist}</span>
            <motion.span 
              className="mt-1 self-start rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-[#B8860B] inline-block"
              whileHover={{ scale: 1.05 }}
            >
              {song.genre}
            </motion.span>
          </div>
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-orange-100/50 dark:hover:bg-orange-950/40 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
            title="Song options"
          >
            <MoreVertical className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.button>

      {/* Ellipsis Menu Modal */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg min-w-[180px]"
          >
            <motion.button
              onClick={() => {
                setMenuOpen(false)
                onClick()
                setTimeout(() => {
                  // Trigger edit mode in parent
                  const editEvent = new CustomEvent('editSong', { detail: { song } })
                  window.dispatchEvent(editEvent)
                }, 300)
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-colors first:rounded-t-lg border-b border-border/50 last:border-b-0"
            >
              <PencilIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Edit</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Page ────────────────────��────────────────────────────────────────────────

function SongsPage() {
  const { displayChord } = useDisplayChordNotation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [activeGenre, setActiveGenre] = useState('All')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [viewDensity, setViewDensity] = useState<'compact' | 'comfortable'>('comfortable')
  const [showABC, setShowABC] = useState(false)
  const abcContainerRef = useRef<HTMLDivElement>(null)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false)
  const [undoNotification, setUndoNotification] = useState<{
    songId: string
    songTitle: string
    timestamp: number
  } | null>(null)

  // Auto-open lyrics editor when editSongId query parameter is provided
  useEffect(() => {
    const editSongId = searchParams.get('editSongId')
    if (editSongId) {
      const songToEdit = SONGS.find((s) => s.id === editSongId)
      if (songToEdit) {
        setSelectedSong(songToEdit)
        setLyricsModalOpen(true)
        // Clean up the URL parameter after opening
        router.replace('/songs', { shallow: true })
      }
    }
  }, [searchParams, router])

  // Listen for edit event from SongRow ellipsis menu
  useEffect(() => {
    const handleEditSong = (e: Event) => {
      const customEvent = e as CustomEvent
      const { song } = customEvent.detail
      if (song) {
        setSelectedSong(song)
        setLyricsModalOpen(true)
      }
    }

    window.addEventListener('editSong', handleEditSong)
    return () => window.removeEventListener('editSong', handleEditSong)
  }, [])

  // Render ABC notation when showABC is toggled
  useEffect(() => {
    if (showABC && abcContainerRef.current && selectedSong) {
      const renderABC = async () => {
        try {
          const abcjs = await import('abcjs')
          const abcNotation = selectedSong.sections
            ?.map((section: any) => {
              let abc = `% ${section.label}\n`
              section.lines?.forEach((line: any) => {
                if (line.lyrics) {
                  abc += `w:${line.lyrics}\n`
                }
              })
              return abc
            })
            .join('\n') || ''

          if (abcNotation) {
            const fullABC = `X:1\nT:${selectedSong.title}\nC:${selectedSong.artist}\nM:4/4\nL:1/8\nK:${selectedSong.key || 'C'}\n\n${abcNotation}`
            abcContainerRef.current!.innerHTML = ''
            abcjs.default.renderAbc('abc-songs-container', fullABC, {
              responsive: 'resize',
              staffwidth: 800,
            })
          }
        } catch (error) {
          console.error('Error rendering ABC notation:', error)
        }
      }
      renderABC()
    }
  }, [showABC, selectedSong])

  const filtered = useMemo(() => {
    return SONGS.filter((s) => {
      const matchesQuery =
        query === "" ||
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase()) ||
        s.key.toLowerCase().includes(query.toLowerCase())
      const matchesGenre = activeGenre === "All" || s.genre === activeGenre
      return matchesQuery && matchesGenre
    })
  }, [query, activeGenre])

  const VIEW_MODES: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
    { mode: "grid",  icon: LayoutGrid, label: "Grid view"  },
    { mode: "list",  icon: List,       label: "List view"  },
  ]

  const handleSelect = (song: Song) => {
    // Navigate to full-page song view
    router.push(`/songs/${song.id}`)
  }

  const handleOpenModal = (song: Song) => {
    setSelectedSong(song)
    setLyricsModalOpen(true)
  }

  const handlePrevSong = () => {
    if (!selectedSong) return
    const currentIdx = SONGS.findIndex((s) => s.id === selectedSong.id)
    if (currentIdx > 0) {
      const prevSong = SONGS[currentIdx - 1]
      setSelectedSong(prevSong)
    }
  }

  const handleNextSong = () => {
    if (!selectedSong) return
    const currentIdx = SONGS.findIndex((s) => s.id === selectedSong.id)
    if (currentIdx < SONGS.length - 1) {
      const nextSong = SONGS[currentIdx + 1]
      setSelectedSong(nextSong)
    }
  }

  const listSection = (
    <div className="flex h-full flex-col">
      <div className="mb-5 px-4 pt-6 md:pt-8 md:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-balance text-foreground">Song Library</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">Browse and manage your worship songs collection</p>
      </div>

      <div className="relative mb-3 px-4 md:px-6 lg:px-8">
        <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground md:left-9" />
        <input
          type="search"
          placeholder="Fast search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-full border border-border bg-background py-2.5 pl-11 pr-4 text-sm md:text-base text-foreground placeholder:text-muted-foreground transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#C09060]"
          aria-label="Search songs"
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 px-4 md:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filter by genre" className="flex flex-wrap items-center gap-1.5 md:gap-2">
          {(["All", ...GENRES] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={activeGenre === g}
              onClick={() => setActiveGenre(g)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs md:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09060] whitespace-nowrap",
                activeGenre === g ? "bg-[#C09060] text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          {/* View Density Toggle */}
          <div role="group" aria-label="View density" className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs md:text-sm">
            <button
              type="button"
              aria-label="Compact view"
              aria-pressed={viewDensity === 'compact'}
              onClick={() => {
                setViewDensity('compact')
                localStorage.setItem('songLibraryDensity', 'compact')
              }}
              className={cn(
                "rounded-md px-2 md:px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                viewDensity === 'compact' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Compact
            </button>
            <button
              type="button"
              aria-label="Comfortable view"
              aria-pressed={viewDensity === 'comfortable'}
              onClick={() => {
                setViewDensity('comfortable')
                localStorage.setItem('songLibraryDensity', 'comfortable')
              }}
              className={cn(
                "rounded-md px-2 md:px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                viewDensity === 'comfortable' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Comfortable
            </button>
          </div>

          {/* View Mode Toggle */}
          <div role="group" aria-label="View mode" className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            {VIEW_MODES.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                type="button"
                aria-label={label}
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "rounded-md p-1.5 md:p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 md:px-6 lg:px-8">
        <div className="mt-2 mx-auto max-w-full md:max-w-6xl lg:max-w-7xl">
          {filtered.length === 0 ? (
            <motion.div 
              className="rounded-xl border border-border px-6 py-16 text-center text-sm text-muted-foreground"
              variants={fadeInUp}
              initial="initial"
              animate="animate"
            >
              No songs match your search.
            </motion.div>
          ) : viewMode === "grid" ? (
            <motion.div 
              className={cn(
                "grid gap-2",
                viewDensity === 'compact' 
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"
              )}
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {filtered.map((song) => (
                <motion.div key={song.id} variants={staggerItem}>
                  <CompactSongCard 
                    song={song} 
                    onOpenLyrics={handleSelect}
                    theme="night"
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              className="overflow-hidden rounded-xl border border-border bg-card"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {filtered.map((song) => (
                <motion.div key={song.id} variants={staggerItem}>
                  <SongRow song={song} isSelected={selectedSong?.id === song.id} onClick={() => handleSelect(song)} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <AppShell>
      {/* Song list */}
      <div className="h-[calc(100vh-0px)] overflow-hidden">
        {listSection}
      </div>

      {/* Lyrics Modal */}
      <LyricsModal
        song={selectedSong}
        isOpen={lyricsModalOpen}
        onClose={() => {
          setLyricsModalOpen(false)
          setSelectedSong(null)
        }}
        onEditLyricsClick={() => {
          // Edit mode is managed within the lyrics modal itself
        }}
        onPrevSong={selectedSong && SONGS.findIndex((s) => s.id === selectedSong.id) > 0 ? handlePrevSong : undefined}
        onNextSong={selectedSong && SONGS.findIndex((s) => s.id === selectedSong.id) < SONGS.length - 1 ? handleNextSong : undefined}
      />

      {/* Undo Notification Toast */}
      <AnimatePresence>
        {undoNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 rounded-lg border border-slate-600 bg-slate-900 p-4 shadow-xl backdrop-blur flex items-center gap-3 z-40 max-w-sm"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">{undoNotification.songTitle} archived</p>
            </div>
            <motion.button
              onClick={() => {
                setUndoNotification(null)
                // Unarchive would be implemented through the storage hook
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 rounded bg-[#C09060] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#B8860B] transition-colors"
            >
              UNDO
            </motion.button>
            <motion.button
              onClick={() => setUndoNotification(null)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}

// Wrapper component with Suspense boundary for useSearchParams
function SongsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <SongsPage />
    </Suspense>
  )
}

export default SongsPageWrapper
