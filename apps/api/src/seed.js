/**
 * Database seed script — populates sample org, users, songs, setlists, and events.
 * Idempotent — checks existence before inserting.
 *
 * Run with: pnpm db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, pool } from "./db.js";
import {
  organizations,
  organizationMembers,
  users,
  songs,
  setlists,
  setlistSongs,
  events,
} from "./schema/index.js";
import { eq, and } from "drizzle-orm";

async function seed() {
  console.log("[seed] Starting...");

  // ── 0. Seed Organization ───────────────────────────
  console.log("[seed] Seeding organization...");

  let org;
  const [existingOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, "Valley Praise Church"))
    .limit(1);

  if (existingOrg) {
    console.log("  [skip] Valley Praise Church already exists");
    org = existingOrg;
  } else {
    const [created] = await db
      .insert(organizations)
      .values({ name: "Valley Praise Church" })
      .returning();
    console.log("  [add]  Valley Praise Church");
    org = created;
  }

  // ── 1. Seed Users ──────────────────────────────────
  console.log("[seed] Seeding users...");

  const passwordHash = await bcrypt.hash("password123", 12);

  const userRows = [
    {
      email: "worship-leader@vpc.church",
      displayName: "Jordan Mitchell",
      role: "owner",
      passwordHash,
      orgRole: "admin",     // worship leader of the org
    },
    {
      email: "keys@vpc.church",
      displayName: "Alex Rivera",
      role: "member",
      passwordHash,
      orgRole: "musician",
    },
    {
      email: "guitar@vpc.church",
      displayName: "Sam Carter",
      role: "member",
      passwordHash,
      orgRole: "observer",  // read-only viewer
    },
  ];

  const seededUsers = [];
  for (const u of userRows) {
    const { orgRole, ...userData } = u;
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    let userRecord;
    if (existing) {
      console.log(`  [skip] ${userData.email} already exists`);
      userRecord = existing;
    } else {
      const [created] = await db
        .insert(users)
        .values(userData)
        .returning();
      console.log(`  [add]  ${userData.email} (${userData.role})`);
      userRecord = created;
    }
    seededUsers.push(userRecord);

    // Create org membership
    const [existingMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.userId, userRecord.id)
        )
      )
      .limit(1);

    if (!existingMember) {
      await db.insert(organizationMembers).values({
        organizationId: org.id,
        userId: userRecord.id,
        role: orgRole,
      });
      console.log(`  [add]  membership: ${userData.email} → ${orgRole} in org`);
    }
  }

  const [leader, keys, guitar] = seededUsers;

  // ── 2. Seed Songs ─────────────────────────────────
  console.log("[seed] Seeding songs...");

  const songRows = [
    {
      title: "Amazing Grace",
      key: "G",
      tempo: 72,
      artist: "John Newton",
      year: "1779",
      tags: "hymn,classic,worship",
      createdBy: leader.id,
      content: `{title: Amazing Grace}
{key: G}
{tempo: 72}
{artist: John Newton}

{comment: Verse 1}
[G]Amazing [G/B]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me
[G]I once was [G/B]lost, but [C]now am [G]found
Was [G]blind but [D]now I [G]see

{comment: Verse 2}
[G]'Twas grace that [G/B]taught my [C]heart to [G]fear
And [G]grace my [Em]fears re[D]lieved
[G]How precious [G/B]did that [C]grace ap[G]pear
The [G]hour I [D]first be[G]lieved

{comment: Verse 3}
[G]Through many [G/B]dangers, [C]toils, and [G]snares
I [G]have al[Em]ready [D]come
[G]'Tis grace hath [G/B]brought me [C]safe thus [G]far
And [G]grace will [D]lead me [G]home`,
    },
    {
      title: "How Great Is Our God",
      key: "C",
      tempo: 78,
      artist: "Chris Tomlin",
      year: "2004",
      tags: "contemporary,worship,praise",
      createdBy: keys.id,
      content: `{title: How Great Is Our God}
{key: C}
{tempo: 78}
{artist: Chris Tomlin}

{comment: Verse 1}
The [C]splendor of a [Am]King,
Clothed in maje[F]sty
Let all the [C]earth rejoice, all the earth re[G]joice

{comment: Verse 2}
He [C]wraps himself in [Am]light
And darkness [F]tries to hide
And trembles [C]at his voice, trembles at his [G]voice

{comment: Chorus}
[C]How great is our God, [Am]sing with me
[F]How great is our God, and [G]all will see
How [C]great, how great is our God

{comment: Bridge}
[Am]Name above all [F]names
[C]Worthy of all [G]praise
[Am]My heart will [F]sing how great [C]is our [G]God`,
    },
    {
      title: "Goodness of God",
      key: "A",
      tempo: 68,
      artist: "Bethel Music",
      year: "2019",
      tags: "contemporary,worship,bethel",
      createdBy: leader.id,
      content: `{title: Goodness of God}
{key: A}
{tempo: 68}
{artist: Bethel Music}

{comment: Verse 1}
I [A]love you Lord, oh your [D]mercy never fails me
[A]All my days I've been [E]held in your hands
From the [A]moment that I wake up until I [D]lay my head
Oh [A]I will sing of the [E]goodness of [A]God

{comment: Chorus}
All my [D]life you have been [A]faithful
All my [D]life you have been so, so [E]good
With every [D]breath that I am [A]able
Oh I will [E]sing of the goodness of [A]God

{comment: Verse 2}
I [A]love your voice, you have [D]led me through the fire
[A]In darkest nights you are [E]close like no other
I've [A]known you as a father, I've [D]known you as a friend
And [A]I have lived in the [E]goodness of [A]God

{comment: Bridge}
Your goodness is [D]running after, it's running [A]after me
Your goodness is [D]running after, it's running [E]after me
With my [D]life laid down, I'm [A]surrendered now
I give you [E]everything
Your goodness is [D]running after, it's running [A]after me`,
    },
  ];

  const seededSongs = [];
  for (const s of songRows) {
    // Scope to the seed org: matching on title alone adopts another org's
    // song once a real library is loaded (every library has an "Amazing
    // Grace"), which then lands a foreign row in this org's set lists.
    const [existing] = await db
      .select()
      .from(songs)
      .where(and(eq(songs.title, s.title), eq(songs.organizationId, org.id)))
      .limit(1);

    if (existing) {
      console.log(`  [skip] "${s.title}" already exists`);
      seededSongs.push(existing);
    } else {
      const [created] = await db.insert(songs).values({ ...s, organizationId: org.id }).returning();
      console.log(`  [add]  "${s.title}" (${s.key})`);
      seededSongs.push(created);
    }
  }

  // ── 3. Seed Setlists ──────────────────────────────
  console.log("[seed] Seeding setlists...");

  const seededSetlists = [];
  const setlistRows = [
    {
      name: "Sunday Morning Worship",
      category: "Church",
      notes: "Standard Sunday morning set",
      createdBy: leader.id,
      songIds: [seededSongs[0].id, seededSongs[1].id, seededSongs[2].id],
    },
    {
      name: "Youth Night",
      category: "Church",
      notes: "Upbeat set for youth service",
      createdBy: keys.id,
      songIds: [seededSongs[1].id, seededSongs[2].id],
    },
    {
      name: "Acoustic Set",
      category: "Special Events",
      notes: "Stripped-down arrangements for small group",
      createdBy: leader.id,
      songIds: [seededSongs[2].id, seededSongs[0].id],
    },
  ];

  for (const sl of setlistRows) {
    const { songIds, ...setlistData } = sl;

    const [existing] = await db
      .select()
      .from(setlists)
      .where(and(eq(setlists.name, sl.name), eq(setlists.organizationId, org.id)))
      .limit(1);

    if (existing) {
      console.log(`  [skip] "${sl.name}" already exists`);
      seededSetlists.push(existing);
      continue;
    }

    const [created] = await db.insert(setlists).values({ ...setlistData, organizationId: org.id }).returning();
    console.log(`  [add]  "${sl.name}" (${sl.category})`);

    // Link songs to this setlist
    for (let i = 0; i < songIds.length; i++) {
      await db.insert(setlistSongs).values({
        setlistId: created.id,
        songId: songIds[i],
        position: i + 1,
      });
    }

    seededSetlists.push(created);
  }

  // ── 4. Seed Events ────────────────────────────────
  console.log("[seed] Seeding events...");

  // Build dates relative to now so events stay "upcoming"
  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  nextSunday.setHours(10, 0, 0, 0);

  const nextWednesday = new Date(now);
  nextWednesday.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));
  nextWednesday.setHours(19, 0, 0, 0);

  const specialDate = new Date(now);
  specialDate.setDate(now.getDate() + 14);
  specialDate.setHours(18, 30, 0, 0);

  const eventRows = [
    {
      title: "Sunday Morning Worship",
      date: nextSunday,
      location: "Main Sanctuary",
      notes: "Regular Sunday service",
      setlistId: seededSetlists[0]?.id || null,
      createdBy: leader.id,
    },
    {
      title: "Wednesday Night Rehearsal",
      date: nextWednesday,
      location: "Worship Room",
      notes: "Full band run-through for Sunday",
      setlistId: seededSetlists[0]?.id || null,
      createdBy: keys.id,
    },
    {
      title: "Youth Night Worship",
      date: specialDate,
      location: "Fellowship Hall",
      notes: "Special youth-led service",
      setlistId: seededSetlists[1]?.id || null,
      createdBy: leader.id,
    },
  ];

  for (const ev of eventRows) {
    const [existing] = await db
      .select()
      .from(events)
      .where(and(eq(events.title, ev.title), eq(events.organizationId, org.id)))
      .limit(1);

    if (existing) {
      console.log(`  [skip] "${ev.title}" already exists`);
    } else {
      await db.insert(events).values({ ...ev, organizationId: org.id });
      console.log(`  [add]  "${ev.title}" (${ev.date.toLocaleDateString()})`);
    }
  }

  console.log("[seed] Done.");
  await pool.end();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
