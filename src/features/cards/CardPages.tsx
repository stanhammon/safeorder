import { Spinner } from '@/components/ui'
import { useBundle } from '@/lib/bundle'
import { allergenLabel, CARD_TEXT, modInstruction, spanishFor, type CardLang } from '@/lib/cardText'
import { useAllergens, useHouseholdContext, useMembers, usePersonAllergens } from '@/lib/queries'
import type { Allergen, PersonAllergen, Profile } from '@/lib/types'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { CardShell } from './CardShell'

const USER_NOTE = 'A memory aid, not a safety guarantee. Always confirm with staff.'

function usePerson(personId: string | undefined) {
  const { householdId } = useHouseholdContext()
  const members = useMembers(householdId)
  const allergens = useAllergens(householdId)
  const personAllergens = usePersonAllergens(householdId)
  const person = members.data?.find((m) => m.id === personId)
  return {
    loading: members.isPending || allergens.isPending || personAllergens.isPending,
    person,
    allergens: allergens.data ?? [],
    mine: (personAllergens.data ?? []).filter((pa) => pa.profile_id === personId),
  }
}

function AllergyList({
  items,
  allergenById,
  lang,
  withNotes = false,
}: {
  items: PersonAllergen[]
  allergenById: Map<string, Allergen>
  lang: CardLang
  withNotes?: boolean
}) {
  return (
    <ul className="space-y-[0.2em]">
      {items.map((pa) => {
        const a = allergenById.get(pa.allergen_id)
        if (!a) return null
        return (
          <li key={pa.allergen_id} className="font-bold">
            • {allergenLabel(a, lang).text}
            {withNotes && pa.notes && <span className="block pl-[0.8em] text-[0.6em] font-medium">{pa.notes}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** /dishes/:dishId/card/:personId — the order for one dish, for staff. */
export function ServerCardPage() {
  const { dishId, personId } = useParams()
  const { index, isPending } = useBundle()
  const { person, allergens, mine, loading } = usePerson(personId)

  if (isPending || loading) return <Spinner />
  const dish = dishId ? index?.dishById.get(dishId) : undefined
  if (!dish || !person || !index) return <Navigate to="/" replace />

  const order = index.orderByDishPerson.get(`${dish.id}:${person.id}`)
  const mods = order ? (index.modsByOrder.get(order.id) ?? []) : []
  const instructions = mods.filter((m) => m.action !== 'ask_kitchen')
  const questions = mods.filter((m) => m.action === 'ask_kitchen')
  const allergies = mine.filter((pa) => pa.kind === 'allergy')
  const allergenById = new Map(allergens.map((a) => [a.id, a]))

  return (
    <CardShell theme={person.server_card_theme} fallback={`/dishes/${dish.id}`} footer={<p>{USER_NOTE}</p>}>
      {(lang) => {
        const t = CARD_TEXT[lang]
        const label = (id: string | null | undefined) => {
          const a = id ? allergenById.get(id) : undefined
          return a ? allergenLabel(a, lang) : null
        }
        const untranslated =
          lang === 'es' &&
          (mods.some((m) => !modInstruction(m, 'es').translated) ||
            allergies.some((pa) => !label(pa.allergen_id)?.translated))
        return (
          <div className="space-y-[0.7em]">
            {allergies.length > 0 && (
              <section>
                <h1 className="text-[1.15em] leading-tight font-extrabold">{t.haveAllergies}</h1>
                <p className="mt-[0.3em] text-[0.7em]">{t.allergicTo}</p>
                <AllergyList items={allergies} allergenById={allergenById} lang={lang} />
              </section>
            )}
            <section className="border-t-2 border-current pt-[0.5em]">
              <p className="text-[0.7em]">{t.myOrder}</p>
              <h2 className="text-[1.1em] leading-tight font-extrabold">{dish.name}</h2>
              {instructions.length === 0 && questions.length === 0 ? (
                <p className="mt-[0.3em]">{t.asServed}</p>
              ) : (
                <ul className="mt-[0.3em] space-y-[0.25em]">
                  {instructions.map((m, i) => {
                    const a = label(m.allergen_id)
                    return (
                      <li key={i} className="font-bold">
                        → {modInstruction(m, lang).text}
                        {a && <span className="text-[0.65em] font-medium"> ({a.text})</span>}
                        {/* English underneath so a bad translation can't go unnoticed. */}
                        {lang === 'es' && (
                          <span className="block pl-[1.1em] text-[0.55em] font-medium opacity-70">
                            {modInstruction(m, 'en').text}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            {questions.length > 0 && (
              <section>
                <p className="text-[0.7em] font-semibold">{t.pleaseCheck}</p>
                <ul className="space-y-[0.2em]">
                  {questions.map((m, i) => (
                    <li key={i}>
                      ? {lang === 'es' ? spanishFor(m.item, m.item_es).text : m.item}
                      {lang === 'es' && (
                        <span className="block pl-[1.1em] text-[0.55em] opacity-70">{m.item}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="border-t-2 border-current pt-[0.5em] text-[0.8em] font-bold">{t.pleaseTell}</p>
            {untranslated && <p className="text-[0.55em] italic">{t.someEnglish}</p>}
          </div>
        )
      }}
    </CardShell>
  )
}

/** /people/:personId/card — general allergy card for the chef. */
export function ChefCardPage() {
  const { personId } = useParams()
  const { person, allergens, mine, loading } = usePerson(personId)
  const [showPrefs, setShowPrefs] = useState(false)

  if (loading) return <Spinner />
  if (!person) return <Navigate to="/people" replace />

  const allergenById = new Map(allergens.map((a) => [a.id, a]))
  const allergies = mine.filter((pa) => pa.kind === 'allergy')
  const prefs = mine.filter((pa) => pa.kind === 'preference')

  return (
    <CardShell
      theme={person.server_card_theme}
      fallback={`/people/${person.id}`}
      footer={<p>{USER_NOTE}</p>}
      extraControls={
        prefs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPrefs(!showPrefs)}
            aria-pressed={showPrefs}
            className="min-h-9 rounded-full border border-current/30 px-3 text-sm"
          >
            {showPrefs ? 'Hide preferences' : 'Show preferences'}
          </button>
        )
      }
    >
      {(lang) => <ChefCardContent person={person} lang={lang} allergies={allergies} prefs={showPrefs ? prefs : []} allergenById={allergenById} />}
    </CardShell>
  )
}

function ChefCardContent({
  person,
  lang,
  allergies,
  prefs,
  allergenById,
}: {
  person: Profile
  lang: CardLang
  allergies: PersonAllergen[]
  prefs: PersonAllergen[]
  allergenById: Map<string, Allergen>
}) {
  const t = CARD_TEXT[lang]
  const esMessage = person.chef_card_message_es?.trim()
  const message = lang === 'es' && esMessage ? esMessage : person.chef_card_message?.trim()
  const untranslated =
    lang === 'es' &&
    ([...allergies, ...prefs].some((pa) => {
      const a = allergenById.get(pa.allergen_id)
      return (a && !allergenLabel(a, lang).translated) || Boolean(pa.notes)
    }) ||
      Boolean(message && !esMessage))

  if (allergies.length === 0 && prefs.length === 0) {
    return <p>{person.display_name} has no allergies recorded yet.</p>
  }

  return (
    <div className="space-y-[0.7em]">
      {allergies.length > 0 && (
        <section>
          <h1 className="text-[1.15em] leading-tight font-extrabold">{t.haveAllergies}</h1>
          <p className="mt-[0.3em] text-[0.7em]">{t.chefIntro}</p>
          <AllergyList items={allergies} allergenById={allergenById} lang={lang} withNotes />
        </section>
      )}
      {prefs.length > 0 && (
        <section className="border-t-2 border-current pt-[0.5em]">
          <p className="text-[0.7em] font-semibold">{t.preferences}</p>
          <AllergyList items={prefs} allergenById={allergenById} lang={lang} withNotes />
        </section>
      )}
      {message && <p className="border-t-2 border-current pt-[0.5em] text-[0.75em]">{message}</p>}
      <p className="text-[0.8em] font-bold">{t.thanks}</p>
      {untranslated && <p className="text-[0.55em] italic">{t.someEnglish}</p>}
    </div>
  )
}
