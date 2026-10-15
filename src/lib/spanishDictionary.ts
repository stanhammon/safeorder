/**
 * Common restaurant words in English → Spanish, for the Spanish server card.
 * US/Mexican usage, matching the allergen names in cardText.ts, with a
 * regional alternative in parentheses where it helps understanding.
 * Only exact matches (after light normalizing) are translated; anything else
 * stays in English, so a guess never reaches the kitchen.
 */
const WORDS: Record<string, string> = {
  // Dairy
  cheese: 'queso',
  'american cheese': 'queso americano',
  cheddar: 'queso cheddar',
  'cheddar cheese': 'queso cheddar',
  'swiss cheese': 'queso suizo',
  'blue cheese': 'queso azul',
  'goat cheese': 'queso de cabra',
  'cream cheese': 'queso crema',
  feta: 'queso feta',
  parmesan: 'queso parmesano',
  'parmesan cheese': 'queso parmesano',
  mozzarella: 'queso mozzarella',
  queso: 'queso',
  'nacho cheese': 'queso para nachos',
  'cheese sauce': 'salsa de queso',
  cream: 'crema',
  'heavy cream': 'crema espesa',
  'sour cream': 'crema agria',
  'whipped cream': 'crema batida',
  'cream sauce': 'salsa de crema',
  'alfredo sauce': 'salsa alfredo',
  butter: 'mantequilla',
  milk: 'leche',
  yogurt: 'yogur',
  'ice cream': 'helado',
  dairy: 'lácteos',
  ranch: 'aderezo ranch',
  'ranch dressing': 'aderezo ranch',
  // Eggs
  egg: 'huevo',
  eggs: 'huevos',
  'fried egg': 'huevo frito',
  'egg wash': 'barniz de huevo',
  mayo: 'mayonesa',
  mayonnaise: 'mayonesa',
  'spicy mayo': 'mayonesa picante',
  aioli: 'alioli',
  // Wheat, gluten, bread
  bun: 'pan',
  bread: 'pan',
  toast: 'pan tostado',
  roll: 'bolillo (panecillo)',
  bagel: 'bagel',
  pita: 'pan pita',
  croissant: 'cuernito (cruasán)',
  'flour tortilla': 'tortilla de harina',
  'corn tortilla': 'tortilla de maíz',
  tortilla: 'tortilla',
  'tortilla chips': 'totopos',
  chips: 'papitas',
  croutons: 'crutones',
  crackers: 'galletas saladas',
  pasta: 'pasta',
  noodles: 'fideos',
  flour: 'harina',
  breading: 'empanizado',
  breaded: 'empanizado',
  batter: 'rebozado',
  'bread crumbs': 'pan molido',
  breadcrumbs: 'pan molido',
  tempura: 'tempura',
  'lettuce wrap': 'envuelto en lechuga (sin pan)',
  'lettuce bun': 'lechuga en lugar de pan',
  'no bun': 'sin pan',
  wheat: 'trigo',
  gluten: 'gluten',
  // Nuts and seeds
  nuts: 'nueces y frutos secos',
  peanut: 'cacahuate (maní)',
  peanuts: 'cacahuates (maní)',
  'peanut sauce': 'salsa de cacahuate (maní)',
  'peanut butter': 'crema de cacahuate (mantequilla de maní)',
  'peanut oil': 'aceite de cacahuate (maní)',
  almond: 'almendra',
  almonds: 'almendras',
  walnut: 'nuez de nogal',
  walnuts: 'nueces de nogal',
  pecan: 'nuez pecana',
  pecans: 'nueces pecanas',
  cashew: 'nuez de la India (anacardo)',
  cashews: 'nueces de la India (anacardos)',
  pistachio: 'pistache (pistacho)',
  pistachios: 'pistaches (pistachos)',
  hazelnut: 'avellana',
  hazelnuts: 'avellanas',
  'pine nuts': 'piñones',
  pesto: 'pesto',
  sesame: 'ajonjolí (sésamo)',
  'sesame seeds': 'semillas de ajonjolí (sésamo)',
  'sesame oil': 'aceite de ajonjolí (sésamo)',
  tahini: 'tahini (pasta de ajonjolí)',
  // Fish and shellfish
  fish: 'pescado',
  'fish sauce': 'salsa de pescado',
  salmon: 'salmón',
  tuna: 'atún',
  anchovies: 'anchoas',
  shellfish: 'mariscos',
  shrimp: 'camarón',
  prawns: 'camarones',
  crab: 'cangrejo (jaiba)',
  lobster: 'langosta',
  clams: 'almejas',
  oysters: 'ostiones (ostras)',
  mussels: 'mejillones',
  scallops: 'callos de hacha (vieiras)',
  'oyster sauce': 'salsa de ostión',
  // Soy
  soy: 'soya (soja)',
  'soy sauce': 'salsa de soya (soja)',
  tofu: 'tofu',
  edamame: 'edamame',
  // Vegetables and sides
  onion: 'cebolla',
  onions: 'cebollas',
  'red onion': 'cebolla morada',
  'green onions': 'cebollitas de cambray',
  'fried onions': 'cebolla frita',
  garlic: 'ajo',
  tomato: 'jitomate (tomate)',
  tomatoes: 'jitomates (tomates)',
  lettuce: 'lechuga',
  pickles: 'pepinillos',
  pickle: 'pepinillo',
  jalapeno: 'jalapeño',
  jalapenos: 'jalapeños',
  jalapeño: 'jalapeño',
  jalapeños: 'jalapeños',
  peppers: 'pimientos',
  'bell pepper': 'pimiento morrón',
  'bell peppers': 'pimientos morrones',
  mushrooms: 'champiñones',
  avocado: 'aguacate',
  guacamole: 'guacamole',
  corn: 'elote (maíz)',
  beans: 'frijoles',
  'black beans': 'frijoles negros',
  'refried beans': 'frijoles refritos',
  rice: 'arroz',
  potato: 'papa',
  potatoes: 'papas',
  fries: 'papas fritas',
  'french fries': 'papas fritas',
  salad: 'ensalada',
  'side salad': 'ensalada chica',
  cilantro: 'cilantro',
  celery: 'apio',
  carrots: 'zanahorias',
  cucumber: 'pepino',
  spinach: 'espinacas',
  olives: 'aceitunas',
  coleslaw: 'ensalada de col',
  // Sauces, dressings, seasonings
  sauce: 'salsa',
  salsa: 'salsa',
  'pico de gallo': 'pico de gallo',
  'hot sauce': 'salsa picante',
  dressing: 'aderezo',
  'salad dressing': 'aderezo',
  vinaigrette: 'vinagreta',
  gravy: 'salsa gravy',
  ketchup: 'cátsup (kétchup)',
  mustard: 'mostaza',
  'honey mustard': 'mostaza con miel',
  'bbq sauce': 'salsa barbecue',
  'barbecue sauce': 'salsa barbecue',
  'buffalo sauce': 'salsa búfalo',
  'teriyaki sauce': 'salsa teriyaki',
  'worcestershire sauce': 'salsa inglesa',
  marinade: 'marinada (adobo)',
  seasoning: 'sazonador',
  spices: 'especias',
  salt: 'sal',
  pepper: 'pimienta',
  'black pepper': 'pimienta negra',
  chili: 'chile',
  'chili flakes': 'hojuelas de chile',
  'red pepper flakes': 'hojuelas de chile',
  honey: 'miel',
  sugar: 'azúcar',
  syrup: 'jarabe',
  oil: 'aceite',
  'olive oil': 'aceite de oliva',
  'vegetable oil': 'aceite vegetal',
  vinegar: 'vinagre',
  wine: 'vino',
  beer: 'cerveza',
  // Meat
  chicken: 'pollo',
  beef: 'res',
  pork: 'cerdo',
  bacon: 'tocino',
  ham: 'jamón',
  sausage: 'salchicha',
  chorizo: 'chorizo',
  turkey: 'pavo',
  steak: 'bistec',
  meat: 'carne',
  lamb: 'cordero',
  // Desserts and extras
  chocolate: 'chocolate',
  caramel: 'caramelo',
  coconut: 'coco',
  cake: 'pastel',
  cookie: 'galleta',
  sprinkles: 'chispas de colores',
  garnish: 'adorno',
  toppings: 'ingredientes extra',
  // Kitchen
  fryer: 'freidora',
  'the fryer': 'la freidora',
  'shared fryer': 'freidora compartida',
  'separate fryer': 'freidora aparte',
  'dedicated fryer': 'freidora exclusiva',
  grill: 'parrilla',
  'clean gloves': 'guantes limpios',
  'clean utensils': 'utensilios limpios',
}

/** Prefix/suffix patterns built on known words: "gluten-free bun" → "pan sin gluten". */
const PATTERNS: [RegExp, (es: string) => string][] = [
  [/^gluten[- ]free (.+)$/, (es) => `${es} sin gluten`],
  [/^dairy[- ]free (.+)$/, (es) => `${es} sin lácteos`],
  [/^nut[- ]free (.+)$/, (es) => `${es} sin nueces`],
  [/^extra (.+)$/, (es) => `${es} extra`],
]

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.!?,;:]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an) (?!fryer$)/, '')
}

function lookupWord(key: string): string | null {
  if (WORDS[key]) return WORDS[key]
  // Simple English plurals of known single words: "olive" ↔ "olives".
  if (key.endsWith('s') && WORDS[key.slice(0, -1)]) {
    const es = WORDS[key.slice(0, -1)]
    if (es.includes(' ')) return null
    return /[aeiouáéíóú]$/.test(es) ? `${es}s` : `${es}es`
  }
  return null
}

/** Spanish for an English item, or null when the dictionary doesn't know it. */
export function translateItem(english: string): string | null {
  const key = normalize(english)
  if (!key) return null
  const direct = lookupWord(key)
  if (direct) return direct
  for (const [re, build] of PATTERNS) {
    const m = key.match(re)
    const inner = m ? lookupWord(m[1]) : null
    if (inner) return build(inner)
  }
  return null
}
