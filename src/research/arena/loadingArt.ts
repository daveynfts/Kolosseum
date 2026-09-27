import { withBase } from '../../lib/base'

export const LOADING_ART = [
  { id: '01-rome', name: 'The Colosseum', place: 'Rome · Italy', fact: 'Its original name is the Flavian Amphitheatre. “Colosseum” is the name that became famous.', source: 'https://colosseo.it/en/area/the-colosseum/', sourceName: 'Colosseum Archaeological Park' },
  { id: '02-pula', name: 'Pula Arena', place: 'Pula · Croatia', fact: 'Pula’s Arena is the sixth-largest surviving amphitheatre in the world.', source: 'https://www.istra.hr/en/experience/culture/museums-and-collections/2502', sourceName: 'Istria Tourist Board' },
  { id: '03-verona', name: 'Arena di Verona', place: 'Verona · Italy', fact: 'Verona’s ancient arena began its celebrated opera tradition in 1913 with Verdi’s Aida.', source: 'https://www.arena.it/storage/docs/20210401_Aderisci%20alle%2067colonne%20di%20Arena%20di%20Verona_sito.pdf', sourceName: 'Fondazione Arena di Verona' },
  { id: '04-nimes', name: 'Arènes de Nîmes', place: 'Nîmes · France', fact: 'The façade has 120 arches across two levels. Roman engineering turned stone into a remarkably efficient crowd system.', source: 'https://www.arenes-nimes.com/histoire-des-arenes/', sourceName: 'Arènes de Nîmes' },
  { id: '05-arles', name: 'Arles Amphitheatre', place: 'Arles · France', fact: 'This Roman arena found a second life as a medieval fortress. Its history did not end with the gladiators.', source: 'https://whc.unesco.org/en/list/164', sourceName: 'UNESCO' },
  { id: '06-el-djem', name: 'Amphitheatre of El Jem', place: 'El Jem · Tunisia', fact: 'This enormous North African amphitheatre could hold an estimated 35,000 spectators.', source: 'https://whc.unesco.org/en/list/38', sourceName: 'UNESCO' },
  { id: '07-pompeii', name: 'Pompeii Amphitheatre', place: 'Pompeii · Italy', fact: 'Built around 70 BC, Pompeii’s amphitheatre predates Rome’s Colosseum by roughly 150 years.', source: 'https://pompeiisites.org/wp-content/uploads/A-Guide-to-the-Pompeii-Excavations-2.pdf', sourceName: 'Archaeological Park of Pompeii' },
  { id: '08-capua', name: 'Campanian Amphitheatre', place: 'Capua · Italy', fact: 'Capua’s amphitheatre is second in size in Italy only to the Colosseum in Rome.', source: 'https://reggiadicaserta.cultura.gov.it/scopri-il-complesso/circuito-archeologico-dellantica-capua/', sourceName: 'Italian Ministry of Culture' },
  { id: '09-avenches', name: 'Aventicum Amphitheatre', place: 'Avenches · Switzerland', fact: 'After an expansion in the second century, this arena could seat nearly 16,000 people on 36 rows.', source: 'https://aventicum.org/fr/visiter-aventicum/promenade-archeologique/amphitheatre', sourceName: 'Site et Musée romains d’Avenches' },
  { id: '10-uthina', name: 'Uthina Amphitheatre', place: 'Oudhna · Tunisia', fact: 'Uthina’s golden age came in the second and third centuries, when its great amphitheatre and other major monuments were built.', source: 'https://www.inp2020.tn/fr/2020/03/10/oudhna/', sourceName: 'Institut National du Patrimoine' },
] as const

export function artUrl(index: number, size: '960' | '1920' | '4k' = '1920') {
  return withBase(`/arena/loading/${LOADING_ART[index].id}-${size}.webp`)
}

const KEY = 'kolosseum.loading-art.v1'
let remembered = 0
export function readArtIndex() {
  try { const value = Number(sessionStorage.getItem(KEY)); if (Number.isInteger(value) && value >= 0 && value < LOADING_ART.length) remembered = value } catch { /* optional storage */ }
  return remembered
}
export function saveArtIndex(index: number) {
  remembered = (index + LOADING_ART.length) % LOADING_ART.length
  try { sessionStorage.setItem(KEY, String(remembered)) } catch { /* retain memory */ }
}
export function preloadLoadingArt() {
  const image = new Image()
  image.src = artUrl(readArtIndex(), window.innerWidth <= 640 ? '960' : '1920')
}
