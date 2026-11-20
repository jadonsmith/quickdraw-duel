// Shared prompt list. Loaded by the server (require) and the client (script tag).
const PROMPTS = [
  "a nervous astronaut", "a shark riding a bicycle", "the world's worst superhero",
  "a haunted teapot", "a cat CEO", "a dragon who is afraid of fire",
  "breakfast in space", "a robot walking a dog", "a very tired wizard",
  "a snail race", "a vampire at the beach", "a ghost trying to use a phone",
  "an octopus playing drums", "a penguin on a skateboard", "a grumpy cloud",
  "a sandwich with too many layers", "a unicorn at the DMV", "a bear doing yoga",
  "a spider knitting a sweater", "a jellyfish disco", "a T-rex making toast",
  "a frog in a tiny hat", "a llama detective", "a haunted vending machine",
  "a squirrel bank heist", "a duck lifting weights", "a moody houseplant",
  "an alien tasting pizza for the first time", "a pigeon delivering mail",
  "a hedgehog on a hoverboard", "a whale in a swimming pool", "a crab playing chess",
  "a sleepy volcano", "a hamster running a marathon", "a knight fighting a stapler",
  "a cactus at a pool party", "a raccoon chef", "a pirate who gets seasick",
  "a giraffe using an elevator", "a bee in a business suit", "a toaster in love",
  "a mermaid learning to skateboard", "a sloth in a hurry", "a goldfish walking on land",
  "a yeti at a barbecue", "a chameleon at a paint store", "a worm on a string",
  "a panda breakdancing", "a wizard's messy desk", "a rubber duck army",
  "a flamingo doing taxes", "a snowman on vacation", "a caterpillar in traffic",
  "a gnome mowing the lawn", "a shark lawyer", "a hippo ballerina",
  "a spaceship made of cheese", "a beaver architect", "a moth chasing a lamp",
  "a turtle winning a race", "an owl pulling an all-nighter", "a corgi in a superhero cape",
  "a lonely lighthouse", "a kangaroo mail carrier", "a possum playing dead dramatically",
  "a walrus playing the trumpet", "a fox stealing a pie", "an ant carrying a couch"
];

if (typeof module !== "undefined" && module.exports) module.exports = PROMPTS;
