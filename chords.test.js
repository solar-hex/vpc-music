const { parseChart, transposeChart, interval, preferFlats, toText, parseChord, transposeChord } = require('./chords');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  if (got === want) { pass++; }
  else { fail++; console.log(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); }
};

// --- chord level ---
const t = (tok, semis, flats) => transposeChord(parseChord(tok), semis, flats);

eq('G up 2 → A', t('G', 2, false), 'A');
eq('B up 1 → C (wrap)', t('B', 1, false), 'C');
eq('C down 1 → B (wrap)', t('C', 11, false), 'B');
eq('Am7 up 3 → Cm7', t('Am7', 3, false), 'Cm7');
eq('C#m7b5 up 1 → Dm7b5', t('C#m7b5', 1, false), 'Dm7b5');
eq('slash: G/B up 2 → A/C#', t('G/B', 2, false), 'A/C#');
eq('flat spelling: G up 3 → Bb', t('G', 3, true), 'Bb');
eq('sharp spelling: G up 3 → A#', t('G', 3, false), 'A#');
eq('Fsus4 up 5 → Bbsus4 (flats)', t('Fsus4', 5, true), 'Bbsus4');
eq('Bb/D down 2 → Ab/C', t('Bb/D', 10, true), 'Ab/C');
eq('A7(#9) up 2 → B7(#9)', t('A7(#9)', 2, false), 'B7(#9)');
eq('Cmaj7 up 7 → Gmaj7', t('Cmaj7', 7, false), 'Gmaj7');

// --- key math ---
eq('interval G→A', interval('G', 'A'), 2);
eq('interval A→G (wraps up)', interval('A', 'G'), 10);
eq('interval Em→Gm (minor keys)', interval('Em', 'Gm'), 3);
eq('preferFlats(Bb)', preferFlats('Bb'), true);
eq('preferFlats(D)', preferFlats('D'), false);

// --- chart level ---
const chart = `{title: Amazing Grace}
{key: G}

[Verse 1]
A[G]mazing grace, how [C]sweet the [G]sound
That [G]saved a wretch like [D]me

[Chorus]
| G | C/E | D | G |

# a comment that should vanish
[Bridge]
[Am7]I once was [D7]lost but [G]now am found`;

const parsed = parseChart(chart);
eq('directives.title', parsed.directives.title, 'Amazing Grace');
eq('directives.key', parsed.directives.key, 'G');

const semis = interval('G', 'Bb');
const flats = preferFlats('Bb');
eq('G→Bb is 3 semitones', semis, 3);
eq('Bb prefers flats', flats, true);

const out = toText(transposeChart(parsed, semis, flats));
console.log('\n--- transposed G → Bb ---\n' + out + '\n');

eq('verse transposed', out.includes('A[Bb]mazing grace, how [Eb]sweet the [Bb]sound'), true);
eq('slash chord in bars transposed', out.includes('| Bb | Eb/G | F | Bb |'), true);
eq('minor 7th transposed', out.includes('[Cm7]I once was [F7]lost but [Bb]now am found'), true);
eq('section headers preserved', out.includes('[Chorus]'), true);
eq('comment stripped', out.includes('#'), false);

// round trip: transpose there and back
const back = toText(transposeChart(parseChart(out), interval('Bb','G'), preferFlats('G')));
eq('round trip G→Bb→G restores verse', back.includes('A[G]mazing grace, how [C]sweet the [G]sound'), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
