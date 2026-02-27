// Meme/Emoji definitions with their shortcuts and image paths
export interface Meme {
  id: string;
  shortcode: string; // e.g., :kekw:
  name: string;
  url: string; // URL to the image file
  category: 'pepe' | 'wojak' | 'other';
}

// Define all available memes from the static/assets/memes folder
export const MEMES: Meme[] = [
  // Pepe memes
  {
    id: 'copium',
    shortcode: ':copium:',
    name: 'Copium',
    url: '/assets/memes/pepe/copium.png',
    category: 'pepe'
  },
  {
    id: 'feelsokayman',
    shortcode: ':feelsokayman:',
    name: 'Feels Okay Man',
    url: '/assets/memes/pepe/feelsokayman.png',
    category: 'pepe'
  },
  {
    id: 'feelsspecialman',
    shortcode: ':feelsspecialman:',
    name: 'Feels Special Man',
    url: '/assets/memes/pepe/feelsspecialman.png',
    category: 'pepe'
  },
  {
    id: 'hypers',
    shortcode: ':hypers:',
    name: 'Hypers',
    url: '/assets/memes/pepe/hypers.png',
    category: 'pepe'
  },
  {
    id: 'monkahmm',
    shortcode: ':monkahmm:',
    name: 'Monka Hmm',
    url: '/assets/memes/pepe/monkaHmm.png',
    category: 'pepe'
  },
  {
    id: 'monkastop',
    shortcode: ':monkastop:',
    name: 'Monka Stop',
    url: '/assets/memes/pepe/monkaStop.png',
    category: 'pepe'
  },
  {
    id: 'monkas',
    shortcode: ':monkas:',
    name: 'MonkaS',
    url: '/assets/memes/pepe/monkas.png',
    category: 'pepe'
  },
  {
    id: 'peepoclown',
    shortcode: ':peepoclown:',
    name: 'Peepo Clown',
    url: '/assets/memes/pepe/peepoClown.png',
    category: 'pepe'
  },
  {
    id: 'peepofat',
    shortcode: ':peepofat:',
    name: 'Peepo Fat',
    url: '/assets/memes/pepe/peepoFat.png',
    category: 'pepe'
  },
  {
    id: 'pepehands',
    shortcode: ':pepehands:',
    name: 'Pepe Hands',
    url: '/assets/memes/pepe/pepehands.png',
    category: 'pepe'
  },
  {
    id: 'pepog',
    shortcode: ':pepog:',
    name: 'PepoG',
    url: '/assets/memes/pepe/pepog.png',
    category: 'pepe'
  },
  {
    id: 'pepolove',
    shortcode: ':pepolove:',
    name: 'Pepo Love',
    url: '/assets/memes/pepe/pepolove.png',
    category: 'pepe'
  },
  {
    id: 'pepothink',
    shortcode: ':pepothink:',
    name: 'Pepo Think',
    url: '/assets/memes/pepe/pepothink.png',
    category: 'pepe'
  },
  {
    id: 'poggies',
    shortcode: ':poggies:',
    name: 'Poggies',
    url: '/assets/memes/pepe/poggies.png',
    category: 'pepe'
  },
  
  // Wojak memes
  {
    id: 'bloomer',
    shortcode: ':bloomer:',
    name: 'Bloomer',
    url: '/assets/memes/wojak/bloomer.png',
    category: 'wojak'
  },
  {
    id: 'boomer',
    shortcode: ':boomer:',
    name: 'Boomer',
    url: '/assets/memes/wojak/boomer.png',
    category: 'wojak'
  },
  {
    id: 'braindead',
    shortcode: ':braindead:',
    name: 'Brain Dead',
    url: '/assets/memes/wojak/braindead.png',
    category: 'wojak'
  },
  {
    id: 'chad',
    shortcode: ':chad:',
    name: 'Chad',
    url: '/assets/memes/wojak/chad.png',
    category: 'wojak'
  },
  {
    id: 'doomer',
    shortcode: ':doomer:',
    name: 'Doomer',
    url: '/assets/memes/wojak/doomer.png',
    category: 'wojak'
  },
  {
    id: 'hugbro',
    shortcode: ':hugbro:',
    name: 'Hug Bro',
    url: '/assets/memes/wojak/hugbro.png',
    category: 'wojak'
  },
  {
    id: 'smug',
    shortcode: ':smug:',
    name: 'Smug',
    url: '/assets/memes/wojak/smug.png',
    category: 'wojak'
  },
  {
    id: 'tired',
    shortcode: ':tired:',
    name: 'Tired',
    url: '/assets/memes/wojak/tired.png',
    category: 'wojak'
  },
  {
    id: 'zoomer',
    shortcode: ':zoomer:',
    name: 'Zoomer',
    url: '/assets/memes/wojak/zoomer.png',
    category: 'wojak'
  },
  
  // Other memes
  {
    id: 'bib',
    shortcode: ':bib:',
    name: 'Bib',
    url: '/assets/memes/other/bib.png',
    category: 'other'
  },
  {
    id: 'hahaa',
    shortcode: ':hahaa:',
    name: 'HaHAA',
    url: '/assets/memes/other/hahaa.png',
    category: 'other'
  },
  {
    id: 'handsup',
    shortcode: ':handsup:',
    name: 'Hands Up',
    url: '/assets/memes/other/handsup.png',
    category: 'other'
  },
  {
    id: 'heavybreathing',
    shortcode: ':heavybreathing:',
    name: 'Heavy Breathing',
    url: '/assets/memes/other/heavybreathing.png',
    category: 'other'
  },
  {
    id: 'kekw',
    shortcode: ':kekw:',
    name: 'KEKW',
    url: '/assets/memes/other/kekw.png',
    category: 'other'
  },
  {
    id: 'kekwait',
    shortcode: ':kekwait:',
    name: 'Kek Wait',
    url: '/assets/memes/other/kekwait.png',
    category: 'other'
  },
  {
    id: 'pikachus',
    shortcode: ':pikachus:',
    name: 'Pikachu Surprised',
    url: '/assets/memes/other/pikachuS.png',
    category: 'other'
  },
  {
    id: 'pog',
    shortcode: ':pog:',
    name: 'Pog',
    url: '/assets/memes/other/pog.png',
    category: 'other'
  }
];

// Create lookup maps for efficient access
export const MEME_BY_SHORTCODE = new Map<string, Meme>(
  MEMES.map(meme => [meme.shortcode, meme])
);

export const MEME_BY_ID = new Map<string, Meme>(
  MEMES.map(meme => [meme.id, meme])
);

// Helper to get all shortcodes for autocomplete
export const getAllShortcodes = (): string[] => {
  return MEMES.map(meme => meme.shortcode);
};

// Helper to check if a text contains any meme shortcodes
export const containsMemes = (text: string): boolean => {
  return MEMES.some(meme => text.includes(meme.shortcode));
};

// Helper to group memes by category
export const getMemesByCategory = (): Record<string, Meme[]> => {
  const grouped: Record<string, Meme[]> = {
    pepe: [],
    wojak: [],
    other: []
  };
  
  MEMES.forEach(meme => {
    const category = meme.category;
    if (grouped[category]) {
      grouped[category].push(meme);
    }
  });
  
  return grouped;
};