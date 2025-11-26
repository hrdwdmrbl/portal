
const ADJECTIVES = [
  "happy", "brave", "calm", "eager", "jolly", "kind", "lively", "nice", "proud", "silly",
  "witty", "fierce", "gentle", "lucky", "clean", "drab", "elegant", "fancy", "glamorous",
  "handsome", "long", "magnificent", "old", "plain", "quaint", "sparkling", "ugliest",
  "unsightly", "wide", "red", "orange", "yellow", "green", "blue", "purple", "gray",
  "black", "white", "ashy", "reddish", "bitter", "delicious", "fresh", "juicy", "ripe",
  "rotten", "salty", "sour", "spicy", "stale", "sticky", "strong", "sweet", "tart",
  "tasteless", "tasty", "thirsty", "fluttering", "fuzzy", "greasy", "grubby", "hard",
  "hot", "icy", "loose", "melted", "nutritious", "plastic", "prickly", "rainy", "rough",
  "scattered", "shaggy", "shaky", "sharp", "shivering", "silky", "slimy", "smooth", "soft",
  "solid", "steady", "sticky", "tender", "tight", "uneven", "weak", "wet", "wooden",
  "afraid", "angry", "annoyed", "anxious", "arrogant", "ashamed", "awful", "bad", "bewildered"
];

const VERBS = [
  "jumping", "singing", "flying", "dancing", "walking", "running", "hopping", "skipping",
  "crawling", "rolling", "spinning", "turning", "shaking", "climbing", "swimming", "diving",
  "floating", "sinking", "falling", "rising", "standing", "sitting", "lying", "sleeping",
  "eating", "drinking", "thinking", "dreaming", "laughing", "crying", "shouting", "whispering",
  "talking", "listening", "watching", "looking", "seeing", "hearing", "smelling", "tasting",
  "feeling", "touching", "holding", "carrying", "pushing", "pulling", "throwing", "catching",
  "kicking", "hitting", "bouncing", "sliding", "gliding", "skating", "skiing", "surfing",
  "sailing", "driving", "riding", "steering", "flying", "rowing", "paddling", "pedaling"
];

const NOUNS = [
  "badger", "eagle", "lion", "tiger", "bear", "whale", "dolphin", "shark", "octopus",
  "crab", "lobster", "shrimp", "snail", "slug", "spider", "ant", "bee", "wasp",
  "fly", "mosquito", "beetle", "butterfly", "moth", "caterpillar", "worm", "snake",
  "lizard", "turtle", "tortoise", "crocodile", "alligator", "frog", "toad", "salamander",
  "newt", "fish", "bird", "chicken", "duck", "goose", "swan", "penguin", "ostrich",
  "emu", "kiwi", "parrot", "pigeon", "dove", "owl", "hawk", "falcon", "vulture",
  "crow", "raven", "magpie", "jay", "sparrow", "robin", "thrush", "finch", "starling"
];

export function generateClientId(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  
  return `${adj}-${verb}-${noun}`;
}

