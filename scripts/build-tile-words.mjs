#!/usr/bin/env node
// Builds the word book for the tile game: src/data/tileWords.json.
// Hand-picked everyday words a young reader knows, 2 to 7 letters, with their
// regular forms worked out by rule (cats, jumped, hopping). Run: node scripts/build-tile-words.mjs
import { writeFileSync } from 'node:fs'

const list = (s) => s.split(/\s+/).filter(Boolean)

// Nouns with a regular plural.
const NOUNS = list(`
ant ape bat bear bee bird bug bull cat chick clam cow crab crow cub dog duck eagle eel frog goat hen horse kitten lamb lion lizard
monkey moth owl panda parrot pig pony puppy rabbit rat seal shark snail snake spider swan tiger toad turtle whale worm zebra bunny
camel hippo koala otter pigeon robin beetle donkey falcon hamster insect jaguar llama magpie mole newt panther python raven turkey
walrus wasp fox finch
arm back bone brain cheek chin ear elbow eye face finger hand head heart heel hip knee leg lip mouth nail neck nose palm rib thumb
toe tongue wrist ankle belly body bump
apple bagel banana bean berry biscuit bun burger cake candy carrot cherry chip cookie cracker crumb egg fig grape jam jelly lemon
lime meal melon muffin noodle nut olive onion orange pea peach pear pie pizza plum snack soup sweet taco treat waffle pancake pickle
pretzel sausage pepper salad dish lunch dinner supper
bag ball bed bell bench bin blanket board book bottle bowl box brick broom brush bucket button cab can candle cap card carpet chair
clock coat coin comb cup curtain desk door drawer dress drum fan fork gate gift glass glove hat jar key kettle kite ladder lamp lid
lock map mat mirror mug nest net oven pan pen pencil pillow pin plate pot purse quilt rake ring roof room rope rug sack shirt shoe
sink sock sofa spoon stair stamp step stick stool switch table tap tent tile tool towel toy tray tub vase wall watch wheel window
wire yard zip basket bubble bundle cabinet camera cushion garden hammer handle jacket letter magnet marble needle packet parcel
pocket puzzle ribbon rocket saddle saucer screen shovel ticket tunnel wallet whistle balloon lantern
bay beach branch breeze bush cave cliff cloud coast creek desert field flame flood flower forest hill island lake log meadow moon
ocean path peak pebble petal planet plant pond puddle river rock root rose seed shell shore sky star stem stone storm stream sun
tide tree twig valley wave weed wind wood bloom bud blossom canyon jungle shadow sunset frost
aunt baby boy brother chef clown cousin dad doctor driver farmer friend girl guest king kid lady mom mum nurse parent pilot pirate
prince queen sister singer teacher twin uncle writer baker dancer diver helper hunter leader painter player reader rider runner
sailor teller winner worker judge
bank barn bridge cabin camp castle city farm garage harbor hotel house hut kitchen market museum palace park road school shop
station store street tower town village zoo
age answer area art badge band bit block boat bus cart chain chance change circle class color corner cost crowd dance date day dot
dream edge end event fact fear game goal group guess habit hint hobby hole hour idea inch job joke jump kind lesson line list mark
match meter mile minute month name note number order page pair part party piece place plan point prize race reason rest riddle
ride row rule score second shape side sign size smile song sound space speed sport spot square start story team test thing time
tip trick trip turn way week wish word year yell
bike car jet plane ship sled taxi train tram truck van wagon canoe tractor scooter
crayon eraser marker ruler sum belt boot cape gown hood mitten skirt sweater vest sandal
`)

// Verbs whose forms follow the rules, with no doubled letter.
const VERBS = list(`
add ask bake bark blink bloom boil bounce brush bump burn buzz call camp care carry chase cheer chew clean climb close color cook
count cover crawl cross cry dance dash dress drift dust enjoy enter fill fix float fold follow giggle glow greet guess help hike
hope hunt hurry invite join joke jump kick laugh learn lift like listen live look love march melt mix move need open pack paint
park pass paste pick plant play point pour press pull push race rain reach relax rest roll row rush sail save share shout show
skate smile sniff snore solve sort spell splash stamp start stay stretch talk taste thank touch trace travel trick try turn visit
wait walk want wash watch wave wink wipe wish work yawn yell zoom answer change check collect copy dream explore finish gather
guide handle happen juggle knock land paddle peel pedal rescue rhyme scoop search shiver sneeze sparkle squeeze stack tickle
tumble twist wander whisper wiggle wonder worry cuddle doodle nibble wobble
`)

// Verbs that double their last letter: clap, clapped, clapping.
const DOUBLING = list(`
clap drop hop hug jog mop nap nod pat pop rub scrub shop skip slip snap step stir stop tap tip trip tug wag zip chop drip flap grab
hum jam plan skid spot trot wrap beg dip pin
`)

// Everything else, written out in full: irregular verbs and plurals, describing words, little words, numbers.
const OTHER = list(`
be am is are was were been do does did done doing go goes went gone going have has had having see sees saw seen seeing say says
said saying get gets got getting make makes made making take takes took taken taking come comes came coming give gives gave given
giving know knows knew known knowing think thinks thought eat eats ate eaten eating run runs ran running sit sits sat sitting
stand stands stood sing sings sang sung singing swim swims swam swum write writes wrote written read reads reading rides rode
ridden riding fly flies flew flown flying draw draws drew drawn drawing grow grows grew grown growing throw throws threw thrown
catch catches caught find finds found finding hold holds held holding tell tells told telling sleep sleeps slept keep keeps kept
keeping feel feels felt feeling build builds built buy buys bought buying bring brings brought teach teaches taught win wins won
winning lose loses lost losing meet meets met meeting send sends sent sending fall falls fell fallen falling hide hides hid
hidden hiding drink drinks drank drive drives drove driven driving wear wears wore worn wearing hear hears heard hearing leave
left leaving begin begins began begun break breaks broke broken choose chooses chose chosen speak speaks spoke spoken wake wakes
woke woken waking shake shakes shook shaken shaking feed feeds fed feeding lead leads led leading dig digs dug digging hang hangs
hung pay pays paid paying sell sells sold selling spin spins spun sticks stuck sweep sweeps swept swing swings swung shine shines
shone shining slide slides slid sliding bite bites bit bitten biting blow blows blew blown blowing put puts putting cut cuts
cutting let lets letting set sets setting hit hits hitting hurt hurts shut shuts can could will would shall should may might must
lay lays laid lie lies lying rise rises risen rising forget forgot become became mean means meant spend spends spent lend lends
lent bend bends bent light lights lit rings rang rung ringing freeze froze frozen
man men woman women child mouse mice foot feet tooth teeth goose geese sheep fish deer leaf leaves wolf wolves shelf knife knives
life lives half scarf hero heroes potato tomato water milk juice bread butter cheese rice sugar salt honey flour toast cereal
music magic fun luck peace snow ice fire mud sand grass hay wool silk paper glue money weather news math maths science history
spring summer autumn winter morning evening night noon midday dawn dusk today weekend holiday people family person nobody
anybody someone nothing stuff skin chalk soup pasta
big bigger biggest small smaller little tiny huge giant large long longer short tall taller wide thin thick round flat deep high
higher low lower near far fast faster slow slower quick quiet loud louder soft softer hard harder smooth rough sharp sour salty
spicy fresh dirty messy tidy neat new newer old older oldest young happy happier sad glad angry grumpy sleepy tired hungry
thirsty brave shy nice nicer gentle polite rude silly funny clever smart wise calm busy lazy ready sorry proud lucky sunny rainy
windy cloudy snowy foggy stormy warm warmer hot hotter cold colder cool chilly icy wet dry bright dark darker shiny dull clear red
blue green yellow purple pink brown black white gray grey gold silver colour pretty lovely cute plain fancy good bad better best
worse worst great super fine okay easy simple tricky strong weak heavy empty full safe sure true false real fair free equal even
odd same other each every all both some any many much more most few less least only very too also just still again always never
often soon now then tonight early late first next last once twice here there where when why how what who which whose this that
these those the a an and but or so if because until while after before since under over above below beside behind between inside
outside into onto off out up down right across along around through about with without from for to of at by in on as it its he
she we they you me him her us them my your our their his mine yours not no yes maybe please thanks hello hi bye oh wow yay oops
hey ah ha one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty sixty hundred zero third dozen
single double triple afraid agree ahead alive alone almost already animal another anyone anyway apart asleep awake away together
`)

const vowel = (ch) => 'aeiou'.includes(ch)
const addS = (w) =>
  /(s|x|z|ch|sh)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`
const addEd = (w) => (w.endsWith('e') ? `${w}d` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ied` : `${w}ed`)
const addIng = (w) => (w.endsWith('e') && !w.endsWith('ee') ? `${w.slice(0, -1)}ing` : `${w}ing`)

const words = new Set(OTHER)
for (const n of NOUNS) [n, addS(n)].forEach((w) => words.add(w))
for (const v of VERBS) [v, addS(v), addEd(v), addIng(v)].forEach((w) => words.add(w))
for (const v of DOUBLING) {
  if (vowel(v.at(-1))) throw new Error(`${v} does not end in a consonant`)
  ;[v, `${v}s`, `${v}${v.at(-1)}ed`, `${v}${v.at(-1)}ing`].forEach((w) => words.add(w))
}

const out = [...words].filter((w) => /^[a-z]{2,7}$/.test(w) || w === 'a').filter((w) => w.length >= 2).sort()
writeFileSync(new URL('../src/data/tileWords.json', import.meta.url), JSON.stringify(out.join(' ')))
console.log(`${out.length} words`)
