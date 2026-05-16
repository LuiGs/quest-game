export type QuestionSeed = { prompt: string; category: string };

/**
 * "Get to know each other" question bank. Each question is asked once and
 * every player must answer about themselves AND about every other player.
 * Designed so answers are short, factual-ish, and comparable.
 */
export const QUESTION_BANK: QuestionSeed[] = [
  { prompt: "Comida favorita", category: "gustos" },
  { prompt: "Color favorito", category: "gustos" },
  { prompt: "Película favorita", category: "gustos" },
  { prompt: "Serie favorita", category: "gustos" },
  { prompt: "Canción favorita", category: "gustos" },
  { prompt: "Artista o banda favorita", category: "gustos" },
  { prompt: "Bebida favorita", category: "gustos" },
  { prompt: "Postre favorito", category: "gustos" },
  { prompt: "Animal favorito", category: "gustos" },
  { prompt: "Deporte favorito", category: "gustos" },
  { prompt: "Videojuego favorito", category: "gustos" },
  { prompt: "Libro favorito", category: "gustos" },
  { prompt: "Hobby principal", category: "vida" },
  { prompt: "Materia que más le gustaba en la escuela", category: "vida" },
  { prompt: "Materia que menos le gustaba en la escuela", category: "vida" },
  { prompt: "Mayor miedo", category: "personalidad" },
  { prompt: "Mayor manía", category: "personalidad" },
  { prompt: "Mayor virtud según él/ella", category: "personalidad" },
  { prompt: "Lugar favorito del mundo", category: "vida" },
  { prompt: "Ciudad donde le gustaría vivir", category: "vida" },
  { prompt: "País que más quiere visitar", category: "vida" },
  { prompt: "Mejor amigo/a actual", category: "vida" },
  { prompt: "Primer trabajo o changa", category: "vida" },
  { prompt: "Sueño que querría cumplir antes de los 40", category: "vida" },
  { prompt: "Comida que odia", category: "gustos" },
  { prompt: "Olor favorito", category: "gustos" },
  { prompt: "Estación del año favorita", category: "gustos" },
  { prompt: "Personaje de ficción favorito", category: "gustos" },
  { prompt: "Red social que más usa", category: "vida" },
  { prompt: "App que más abre en el celular", category: "vida" },
  { prompt: "Hora a la que se levanta normalmente", category: "vida" },
  { prompt: "Cosa que siempre lleva en el bolsillo", category: "vida" },
  { prompt: "Mascota soñada", category: "gustos" },
  { prompt: "Plato que mejor le sale cocinar", category: "vida" },
  { prompt: "Cantante para cantar a los gritos en el auto", category: "gustos" },
  { prompt: "Su frase o muletilla favorita", category: "personalidad" },
  { prompt: "Mejor recuerdo de la infancia", category: "vida" },
  { prompt: "Apodo de la infancia", category: "vida" },
  { prompt: "Le da más vergüenza: bailar o cantar en público", category: "personalidad" },
  { prompt: "Prefiere: playa o montaña", category: "gustos" },
];

/** Pick N random unique questions from the bank, preserving the seed objects. */
export function pickQuestions(n: number): QuestionSeed[] {
  const pool = [...QUESTION_BANK];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
