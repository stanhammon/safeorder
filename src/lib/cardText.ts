import type { Allergen, ModDraft } from './types'

/** Languages the staff-facing cards can show. */
export type CardLang = 'en' | 'es'

/** Spanish names for the preset allergens, keyed by their English seed name. */
const PRESET_ES: Record<string, string> = {
  Milk: 'Leche y lácteos',
  Egg: 'Huevo',
  Peanut: 'Cacahuate (maní)',
  'Tree nuts': 'Nueces y frutos secos',
  Soy: 'Soya (soja)',
  Wheat: 'Trigo',
  Gluten: 'Gluten',
  Fish: 'Pescado',
  'Shellfish (crustacean)': 'Mariscos (crustáceos)',
  Sesame: 'Ajonjolí (sésamo)',
  Mustard: 'Mostaza',
  Celery: 'Apio',
  Lupin: 'Altramuz (lupino)',
  Molluscs: 'Moluscos',
  Sulphites: 'Sulfitos',
}

/** The allergen's name in the card language, and whether that's a real translation. */
export function allergenLabel(a: Pick<Allergen, 'name' | 'name_es' | 'is_preset'>, lang: CardLang): { text: string; translated: boolean } {
  if (lang === 'en') return { text: a.name, translated: true }
  const es = a.name_es?.trim() || (a.is_preset ? PRESET_ES[a.name] : undefined)
  return es ? { text: es, translated: true } : { text: a.name, translated: false }
}

export const CARD_TEXT = {
  en: {
    haveAllergies: 'I have food allergies',
    allergicTo: 'I’m allergic to:',
    myOrder: 'My order',
    asServed: 'As served, with no changes.',
    pleaseCheck: 'Please check with the kitchen:',
    pleaseTell: 'Please tell me if this can’t be made safely.',
    chefIntro: 'Please make sure my food is free of these, including cross-contact:',
    preferences: 'Preferences (not allergies):',
    thanks: 'Thank you!',
    someEnglish: '',
    done: 'Done',
    switchTo: 'Español',
    switchLabel: 'Show this card in Spanish',
  },
  es: {
    haveAllergies: 'Tengo alergias alimentarias',
    allergicTo: 'Tengo alergia a:',
    myOrder: 'Mi pedido',
    asServed: 'Tal como viene, sin cambios.',
    pleaseCheck: 'Por favor, confirme con la cocina:',
    pleaseTell: 'Por favor, avíseme si no se puede preparar de forma segura.',
    chefIntro: 'Por favor, asegúrese de que mi comida no contenga lo siguiente, incluido el contacto cruzado:',
    preferences: 'Preferencias (no son alergias):',
    thanks: '¡Gracias!',
    someEnglish: 'Algunos detalles están en inglés.',
    done: 'Listo',
    switchTo: 'English',
    switchLabel: 'Show this card in English',
  },
} as const

/** A change as an instruction to staff. Free-text parts stay as typed. */
export function modInstruction(m: ModDraft, lang: CardLang): string {
  const item = m.item.trim()
  const replacement = m.replacement?.trim() ?? ''
  if (lang === 'es') {
    switch (m.action) {
      case 'remove':
        return `Sin ${item}`
      case 'substitute':
        return `Cambiar ${item} por ${replacement}`
      case 'add':
        return `Agregar ${item}`
      case 'on_the_side':
        return `${item} aparte`
      default:
        return item
    }
  }
  switch (m.action) {
    case 'remove':
      return `No ${item}`
    case 'substitute':
      return `Replace ${item} with ${replacement}`
    case 'add':
      return `Add ${item}`
    case 'on_the_side':
      return `${item} on the side`
    default:
      return item
  }
}

const STORAGE_KEY = 'safeorder.cardLang'

export function readCardLang(): CardLang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'es' ? 'es' : 'en'
  } catch {
    return 'en'
  }
}

export function storeCardLang(lang: CardLang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Not remembered in private mode; the card still switches.
  }
}
