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

// ---- Second helping (added by hand): the same four kinds of list. ----
NOUNS.push(
  ...list(`
acorn actor album alley angel anchor apron arrow artist atlas attic author award axe badger ballet bandage banner barrel basin
battle beak beam beard beast bedroom bib bill blade blaze blob blouse border boss bracket braid brake brand bride brook bruise
buddy buggy bulb bunch bunk burrow butler cable cage cannon captain carton cartoon case cellar cent channel chapter charm chart
cheetah chest chief choir chore chunk circus claw clerk click clinic cloak closet cloth clover club clue coach cobweb cocoon code
collar comet comic cone cook copy coral cord cork costume cottage couch cough couple course court crack craft crane crate cream
crew crib cricket crop crown crust crystal cube cupcake curb curl curve cycle daisy danger dart deck den dentist diamond diary
diner ditch dock doll dollar dolphin dome donut dragon drain drawing drill drink drip dryer dune easel engine entry exit eyebrow
fabric fairy feast feather fence fern ferry fiddle fin fist flag flake flap flash flask flavor fleet flight flock floor flute
folder fossil frame freckle fridge fringe fruit gadget gallon gap gasp gem germ ghost giraffe glacier globe goblin gorilla grain
gram grandma grandpa graph grin grip groan ground grove guard guide guitar gull gutter gym hall hanger harp hatch hawk heap hedge
helmet herb herd hinge hive hog hollow hook hoop horn hose hound hug hump husk igloo image inn iron item jail jaw jeep jewel
jigsaw jingle journey jug kayak kennel kernel keyhole kingdom kiosk kit knob knot lab label lagoon lane lap laser lawn layer
league leash ledge lens level lever lily limb limit liquid lobby lobster locker loft loop lotion lump lung machine maid mailbox
mammal mane manner mansion maple mask mast mate maze medal melody member menu mess message metal method mill mine mint mitt
model moment monster mop motor mound movie muscle napkin nation navy nephew nerve nickel niece noise notch novel nugget oak oar
object office orbit orchard organ outfit oval owner oyster pad pail pane parade pasture patch patio paw peanut pearl pedal
penguin penny perch period pet phone photo piano picnic pier pile pill pillar pine pipe pit pitcher plank plaza plug poem poet
pole pool porch port post poster potion pouch powder prank present price print prison problem program project puppet pump
pumpkin pupil quarter quill rack radio raft rag rail rainbow ramp ranch rash rattle recipe record reef region reward ridge rink
robe robot rod roll rooster route ruby ruin sail sample sauce scale scar scene scent scoop scout scrap screw scroll sea seam
season seat secret seesaw sense servant shack shade shampoo shed sheet shield shrimp shrub shower signal sip siren skate sketch
ski skull slab slice slipper slope slot slug smell smudge snap sneaker sneeze snore snout socket soda soldier sole spade spark
spear speck spice spike spine spiral splash sponge spool spout sprout spy stable stack stage stain stalk stall staple statue
steak steeple sticker sting stitch stomach stove strap straw string stripe student studio stump subject suit summit sunrise
surface swamp swing sword symbol system tablet tack tail talent tank tape target task tassel teapot temple thorn thread throat
throne tiara toilet token ton tone topic torch total track trail tribe trumpet trunk tube tulip tune turnip tusk tutor twist
uniform unit valve vehicle veil vein vessel vet video view vine violin visitor voice vote voyage waist waiter wand washer web
wedding weight well wetsuit whisker wick wig willow wing wizard wonder wrench wrinkle yacht yawn yolk zipper zone
`),
)
VERBS.push(
  ...list(`
act aim allow amaze appear argue arrive attach attack avoid bang bathe behave belong blame blast bless blush boast bolt borrow
bother bow breathe bubble buckle bury calm carve cause chain charge cheat choke circle claim clash click coach comb compare
connect cough crack crash create crush cure curl dare decide delay deliver depend deserve destroy divide double doubt dread
dribble drown dry earn elect empty end escape excuse expect explain fade fail fear fetch file film fire flash flood flow force
frown fry gallop gaze glance glue groan guard gulp hammer harm hatch haul heal heat hover howl imagine improve include inform
itch jingle judge label last launch lean leap lick lock mail manage mark marry match matter measure mend mention mind miss moan
mumble munch name nest notice number obey offer order owe own pause peck peek perform phone pinch place plow polish post pounce
pout pray prepare pretend print promise protect prove pump punch puzzle raise rake rattle receive record reduce refuse remain
remind remove repair repeat reply report return reward rinse roar rock rule rustle scare scatter scold score scrape scratch
scream seal seem serve settle shade shape shelter shift shock sigh sign signal ski slice slow smash smell smoke snatch sneak soak
spill spoil spray squash squeak stare steer stitch store stroll study stuff suck suggest supply support suppose surf swallow
switch tackle tame tease tempt tend thaw thump tidy tilt toss tour tow trade train trust tuck tune unlock unpack use vanish view
vote wail warn waste water weigh welcome whirl whistle wreck wrestle yank
`),
)
DOUBLING.push(
  ...list(`
chat clip drag flip grin knit knot plug rip rob sag shrug sip slam slap sob swap trap trim bat brag chip clog cram crop dab dim
dot drum fan fib flop grip jab jot map net pad peg pet plod plot prop rot scan shred skim snip strap strip strum swat tag thin
top whip zap nag yap bob tan
`),
)
OTHER.push(
  ...list(`
able absent active actual adult alert alike awesome awkward bald bare basic blank blond bold bored boring bossy bouncy brief
broad bumpy careful central cheap cheeky classic clumsy cozy crazy creepy crisp cruel curious curly damp dear dizzy dusty eager
elder entire exact extra faint fierce final firm fizzy fluffy fond foolish formal fuzzy gloomy golden grand greedy guilty hairy
handy healthy helpful honest humble ideal jolly juicy jumbo junior keen latest likely lively local lone lonely loose loyal mad
magical main major merry mighty mild minor misty mixed modern moist muddy naughty nearby nervous noble noisy normal nosy pale
patient perfect playful pleased popular private proper public pure rapid rare raw recent regular rich ripe rosy rotten royal
rusty sandy scary selfish serious shaky shallow sick silent silky sleek slim smelly snug soggy solid sore spare special speedy
spotty stale steady steep sticky stiff strange strict sudden swift tasty tender tight tough ugly unfair unkind upset urgent
useful usual vast wavy weird wicked wild wobbly wooden woolly worried wrong yummy zany
braver bravest calmer cleaner closer cuter darkest deeper easier easiest fewer finer fresher funnier greater heavier kinder
largest later lighter longest lowest luckier neater nearest newest nicest quicker quieter richer safer sharper shorter smarter
sooner sweeter tallest thicker thinner tinier warmest weaker wider wiser younger fastest slowest highest hottest coldest loudest
badly barely boldly bravely calmly clearly closely deeply easily exactly fairly finally firmly freely gently gladly greatly
happily hardly highly kindly lately lightly loudly luckily mainly mostly nearly neatly nicely partly plainly proudly quickly
quietly rarely really roughly sadly safely simply slowly smartly softly sharply shortly surely swiftly tightly truly usually
warmly weakly widely wildly wisely
ago against aloud among anymore aside besides beyond cannot despite during either else enough except ever forward indeed instead
itself myself perhaps quite rather several somehow toward towards unless upon whether whoever within yet ouch hooray phew
agrees agreed echo echoes mango ivy elf elves calf calves loaf loaves cattle bacon beef clay corn cotton dirt dough garlic gravel
jeans mustard plaster popcorn silence soil steam tennis thunder trash wax wheat cactus octopus oasis volcano dwarf hoof dice
series trout thief
kneel knelt weave wove woven fight fought steal stole stolen tie ties tied tying untie tear tore torn sink sank sunk shrink
shrank creep crept weep wept leapt deal dealt dreamt burnt learnt smelt spelt spilt sew sewed sewn mow mowed shown beat beaten
bet bets cost costs burst bursts spread spreads quit quits split splits fit fits fitted fitting sting stung strike struck strung
fling flung cling clung grind wind wound bind bound forgive forgave mistake mistook undo undid undone redo rebuild rebuilt
awoke arise arose bore born sheds
energy gravity oxygen galaxy luggage baggage traffic laundry scenery jewelry pottery poetry cutlery rubbish garbage litter
advice courage justice wisdom freedom honesty bravery safety beauty health wealth youth truth length width height depth warmth
growth breath birth earth north south east west upward inward outward indoor outdoor indoors nowhere forever however
`),
)

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
