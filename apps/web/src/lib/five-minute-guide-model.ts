/** Static, anonymous, client-only learning model. No services, persistence, or scores. */
export type Locale = 'en' | 'es-419';
export type Answer = 'yes' | 'no' | null;
export type GuideState = { step: number; locale: Locale; answers: [Answer, Answer] };
export type GuideAction =
  | { type: 'NEXT' | 'BACK' | 'RESTART' }
  | { type: 'LOCALE'; value: string | null }
  | { type: 'ANSWER'; index: number; value: string };
type GuideCopy = {
  title: string; intro: string; languageLabel: string; stepLabel: string; ofLabel: string;
  hypothetical: string; previous: string; next: string; restart: string; done: string;
  backToArticle: string; disclaimer: string; yes: string; no: string;
  steps: { heading: string; paragraphs: string[]; evidence: string }[];
  questions: { question: string; correct: string; incorrect: string }[];
};
export const TOTAL_STEPS = 5;
export const LANGUAGES: readonly Locale[] = Object.freeze(['en', 'es-419']);

export const COPY: Readonly<Record<Locale, GuideCopy>> = Object.freeze({
  en: {
    title: 'Your first five minutes with the dollar',
    intro: 'Five short steps. Hypothetical examples, not current quotes. No account, score or saved answers.',
    languageLabel: 'Language',
    stepLabel: 'Step',
    ofLabel: 'of',
    hypothetical: 'HYPOTHETICAL EXAMPLE — NOT CURRENT MARKET QUOTES',
    previous: 'Previous',
    next: 'Next',
    restart: 'Restart',
    done: 'You have finished the guide.',
    backToArticle: 'Return to the Start Here article',
    disclaimer: 'Educational content only. This is not investment advice or a recommendation to buy or sell.',
    yes: 'Yes',
    no: 'No',
    steps: [
      {
        heading: 'The dollar is more than DXY',
        paragraphs: [
          'DXY measures the U.S. dollar against a specific basket of six currencies. It is not a measure of every currency or the entire global dollar system.',
          'For broader confirmation, compare it with broader dollar indexes and the market context. One exchange-rate measure cannot explain every asset move.'
        ],
        evidence: 'Example: a stronger DXY reading might reflect a move in a heavily weighted currency rather than dollar strength everywhere.'
      },
      {
        heading: 'Dial 2: real-rate pressure',
        paragraphs: [
          'Real yields help describe the inflation-adjusted return on safer assets. The 10-year TIPS yield is one reference, not a trading signal.',
          'Rising real yields can affect non-yielding assets and long-duration valuations, but the relationship is conditional.'
        ],
        evidence: 'Hypothetical: a change in real yields can alter gold or equity valuation pressure even when DXY barely moves.'
      },
      {
        heading: 'Dial 3: liquidity and stress',
        paragraphs: [
          'Liquidity stress is about funding and market conditions. Volatility, credit spreads, dollar funding and market functioning can all provide context.',
          'VIX illustrates market volatility and risk concerns; it is not a complete or direct liquidity gauge.'
        ],
        evidence: 'Hypothetical: DXY strength with rising volatility and credit stress may describe a different regime from DXY strength with orderly funding.'
      },
      {
        heading: 'Read the three dials together',
        paragraphs: [
          'Start with dollar direction, real-rate pressure and liquidity stress, then trace possible transmission into oil, gold, Bitcoin and equities.',
          'The dials describe conditions, not guaranteed prices. Asset-specific shocks can dominate and historical relationships can change.'
        ],
        evidence: 'Check the cause before interpreting an asset move. A correlation is not a forecast.'
      },
      {
        heading: 'Check your understanding',
        paragraphs: ['Two quick questions. There is no score and nothing is saved.'],
        evidence: ''
      }
    ],
    questions: [
      {
        question: 'Does the DXY represent all currencies?',
        correct: 'Correct: no. It measures the dollar against a specific basket of six currencies.',
        incorrect: 'Incorrect. DXY includes only a particular basket of six currencies.'
      },
      {
        question: 'Do the three dials guarantee the direction of gold, WTI or BTC?',
        correct: 'Correct: no. They are context, not guarantees or signals.',
        incorrect: 'Incorrect. No single dial or combination guarantees market direction.'
      }
    ]
  },
  'es-419': {
    title: 'Tus primeros cinco minutos con el dólar',
    intro: 'Cinco pasos breves. Ejemplos hipotéticos, no cotizaciones actuales. Sin cuenta, puntaje ni respuestas guardadas.',
    languageLabel: 'Idioma',
    stepLabel: 'Paso',
    ofLabel: 'de',
    hypothetical: 'EJEMPLO HIPOTÉTICO — NO SON COTIZACIONES ACTUALES',
    previous: 'Anterior',
    next: 'Siguiente',
    restart: 'Reiniciar',
    done: 'Has terminado la guía.',
    backToArticle: 'Volver al artículo Start Here',
    disclaimer: 'Contenido solo educativo. No es asesoramiento de inversión ni una recomendación de compra o venta.',
    yes: 'Sí',
    no: 'No',
    steps: [
      {
        heading: 'El dólar es más que el DXY',
        paragraphs: [
          'El DXY mide el dólar estadounidense frente a una cesta específica de seis monedas. No representa todas las monedas ni todo el sistema mundial del dólar.',
          'Para confirmar un movimiento, compara el índice con medidas más amplias del dólar y el contexto de mercado. Un solo tipo de cambio no explica cada activo.'
        ],
        evidence: 'Ejemplo: un DXY más alto puede reflejar un movimiento de una moneda de gran peso, sin que el dólar suba de manera generalizada.'
      },
      {
        heading: 'Dial 2: presión de tasas reales',
        paragraphs: [
          'Los rendimientos reales ayudan a describir el retorno ajustado por inflación de los activos más seguros. El TIPS a 10 años es una referencia, no una señal para operar.',
          'Un repunte de los rendimientos reales puede presionar al oro y a ciertas valoraciones, pero la relación depende del contexto.'
        ],
        evidence: 'Hipotético: una variación de las tasas reales puede cambiar la presión sobre el oro o las acciones aunque el DXY casi no se mueva.'
      },
      {
        heading: 'Dial 3: liquidez y tensión',
        paragraphs: [
          'La tensión de liquidez depende de las condiciones de financiación y de mercado. La volatilidad, los diferenciales de crédito y la financiación en dólares ofrecen contexto.',
          'El VIX ilustra la volatilidad y la percepción de riesgo; no mide por sí solo toda la liquidez.'
        ],
        evidence: 'Hipotético: un dólar más fuerte con tensión financiera creciente describe un entorno distinto de un dólar fuerte con financiación ordenada.'
      },
      {
        heading: 'Lee los tres diales en conjunto',
        paragraphs: [
          'Empieza por la dirección del dólar, la presión de tasas reales y la tensión de liquidez. Después examina cómo podrían influir en petróleo, oro, Bitcoin y acciones.',
          'Los diales describen condiciones, no precios garantizados. Los factores específicos de cada activo también importan.'
        ],
        evidence: 'Analiza la causa antes del movimiento del activo. Una correlación no equivale a un pronóstico.'
      },
      {
        heading: 'Comprueba lo aprendido',
        paragraphs: ['Dos preguntas rápidas. No hay puntaje ni se guarda nada.'],
        evidence: ''
      }
    ],
    questions: [
      {
        question: '¿El DXY representa todas las monedas?',
        correct: 'Correcto: no. Mide el dólar frente a una cesta específica de seis monedas.',
        incorrect: 'Incorrecto. El DXY solo usa una cesta específica de seis monedas.'
      },
      {
        question: '¿Los tres diales garantizan la dirección del oro, WTI o BTC?',
        correct: 'Correcto: no. Son contexto, no garantías ni señales.',
        incorrect: 'Incorrecto. Ningún dial, solo o combinado, garantiza una dirección.'
      }
    ]
  }
});

const validLocale = (value: string | null): value is Locale => value === 'en' || value === 'es-419';
export function initialState(locale: Locale = 'en'): GuideState {
  return { step: 0, locale, answers: [null, null] };
}
export function isComplete(state: GuideState): boolean {
  return state.step === TOTAL_STEPS - 1 &&
    state.answers.length === 2 && state.answers.every((answer) => answer === 'yes' || answer === 'no');
}
export function questionFeedback(state: GuideState, index: number): string {
  const answer = state.answers[index];
  if (answer !== 'yes' && answer !== 'no') return '';
  const item = COPY[state.locale]?.questions[index];
  if (!item) return '';
  return answer === 'no' ? item.correct : item.incorrect;
}
export function updateState(state: GuideState, action: GuideAction): GuideState {
  switch (action.type) {
    case 'NEXT': return { ...state, step: Math.min(TOTAL_STEPS - 1, state.step + 1) };
    case 'BACK': return { ...state, step: Math.max(0, state.step - 1) };
    case 'RESTART': return initialState(state.locale);
    case 'LOCALE': return { ...state, locale: validLocale(action.value) ? action.value : state.locale };
    case 'ANSWER': {
      if (![0, 1].includes(action.index) || !['yes', 'no'].includes(action.value)) return state;
      const answers: [Answer, Answer] = [...state.answers];
      answers[action.index] = action.value as Answer;
      return { ...state, answers };
    }
    default: return state;
  }
}
