// Draft translations of public video catalogue metadata, not audio/dubbing rights.
// Source: apps/web/src/data/video-library.js at the source commit pinned in UI-40.
// Reviewed terminology: educational LATAM-neutral Spanish; requires final native-speaker review before public release.
const sourcePairs = [
  [
    "dxy-the-signal-vs-the-system",
    "DXY: la señal frente al sistema",
    "Utiliza el DXY como señal basada en una cesta definida de monedas, sin perder de vista las condiciones del dólar amplio ponderado por el comercio."
  ],
  [
    "dollar-yields-liquidity",
    "Dólar • Rendimientos • Liquidez",
    "Analiza el dólar, los rendimientos de Estados Unidos y la liquidez global mediante un marco de tres diales, no como señales aisladas."
  ],
  [
    "one-dollar-shock-four-market-reactions",
    "Un choque del dólar: cuatro reacciones del mercado",
    "Compara cómo un mismo impulso del dólar puede transmitirse al petróleo, el oro, Bitcoin y la renta variable por canales diferentes."
  ],
  [
    "gold-dollar-vs-real-yields",
    "Oro: dólar frente a rendimientos reales",
    "Sitúa el dólar y los rendimientos reales dentro de un marco más amplio para el oro que incluye riesgo, incertidumbre y demanda."
  ],
  [
    "oil-dollar-pricing-vs-physical-market",
    "Petróleo: precios en dólares frente al mercado físico",
    "Distingue la denominación en dólares de los balances físicos, las interrupciones de oferta, los inventarios y la demanda vinculada al riesgo."
  ],
  [
    "bitcoin-dollar-liquidity-vs-crypto-flows",
    "Bitcoin: liquidez en dólares frente a flujos propios de las criptomonedas",
    "Distingue la liquidez macroeconómica y el dólar del posicionamiento, los flujos y la estructura específicos del mercado de criptomonedas."
  ],
  [
    "equities-dollar-strength-vs-earnings",
    "Acciones: fortaleza del dólar frente a resultados empresariales",
    "Relaciona conversión cambiaria, beneficios obtenidos en el exterior y condiciones financieras sin tratar el dólar como único motor de las acciones."
  ],
  [
    "lng-dollar-pricing-vs-regional-gas-markets",
    "GNL: precios en dólares frente a mercados regionales de gas",
    "Distingue la cotización en dólares del destino, el acceso, los plazos y las condiciones regionales del mercado de gas natural licuado."
  ],
  [
    "eurusd-relative-rates-and-growth",
    "EUR/USD: tipos de interés relativos y crecimiento",
    "Interpreta el EUR/USD a través de los tipos de interés, el crecimiento, la inflación y las condiciones financieras relativas de ambas economías."
  ],
  [
    "us-treasury-yields-policy-expectations-vs-term-premium",
    "Rendimientos del Tesoro: expectativas de política frente a prima por plazo",
    "Distingue las trayectorias esperadas de los tipos de corto plazo de la prima por plazo y otras fuerzas incorporadas en los rendimientos del Tesoro."
  ],
  [
    "credit-spreads-default-risk-vs-liquidity-stress",
    "Diferenciales de crédito: riesgo de impago frente a tensión de liquidez",
    "Analiza la ampliación de un diferencial de crédito distinguiendo el deterioro de los fundamentos de una retirada de liquidez del mercado."
  ],
  [
    "us-yield-curve-policy-restriction-vs-growth-expectations",
    "Curva de rendimientos de EE. UU.: restricción monetaria frente a expectativas de crecimiento",
    "Considera la forma de la curva una señal que requiere descomposición, no una previsión independiente."
  ],
  [
    "inflation-expectations-cpi-vs-market-pricing",
    "Expectativas de inflación: dato del IPC frente a compensación implícita en el mercado",
    "Distingue un dato de inflación retrospectivo de las expectativas y la compensación por riesgo incorporadas en los mercados."
  ],
  [
    "repo-markets-policy-rates-vs-funding-stress",
    "Mercado repo: tipos oficiales frente a tensión de financiación",
    "Distingue el ancla de los tipos administrados de las condiciones cambiantes del repo y las presiones relativas de financiación."
  ],
  [
    "treasury-supply-issuance-vs-market-absorption",
    "Oferta de bonos del Tesoro: emisión frente a absorción del mercado",
    "Relaciona los anuncios de emisión de bonos del Tesoro con la demanda en subastas, la intermediación y la capacidad del mercado para absorber nuevas emisiones."
  ],
  [
    "treasury-general-account-vs-bank-reserves",
    "Cuenta General del Tesoro: flujos de caja frente a reservas bancarias",
    "Sigue los flujos de caja del Tesoro por la TGA y distingue su efecto sobre las reservas del régimen general de liquidez."
  ],
  [
    "quantitative-tightening-runoff-vs-reserve-scarcity",
    "Endurecimiento cuantitativo: reducción del balance frente a escasez de reservas",
    "Relaciona la reducción del balance con las condiciones de reservas, sin perder de vista la composición más amplia de pasivos."
  ],
  [
    "reserve-management-purchases-vs-qe",
    "Compras para gestionar las reservas bancarias frente a expansión cuantitativa",
    "Compara el crecimiento del balance según propósito, vencimiento y transmisión prevista, no solo por su magnitud."
  ],
  [
    "standing-repo-facility-backstop-vs-easing",
    "Facilidad permanente de repo: respaldo frente a relajación monetaria",
    "Distingue una facilidad de respaldo para controlar tipos a un día de un programa amplio de relajación monetaria."
  ],
  [
    "discount-window-vs-standing-repo-facility",
    "Ventanilla de descuento frente a facilidad permanente de repo",
    "Compara las contrapartes, las estructuras de transacción y las funciones de política de dos mecanismos de respaldo de liquidez utilizados en Estados Unidos."
  ],
  [
    "bank-reserves-vs-bank-deposits",
    "Reservas bancarias frente a depósitos bancarios",
    "Distingue los saldos de reserva en el banco central de los depósitos de clientes y sigue la liquidación interbancaria."
  ],
  [
    "repo-markets-cash-vs-collateral-liquidity",
    "Mercado repo: liquidez de efectivo frente a liquidez de garantías",
    "Distingue la disponibilidad de efectivo de la disponibilidad, admisibilidad y distribución de garantías."
  ],
  [
    "central-bank-swaps-vs-fima-repo",
    "Swaps de liquidez entre bancos centrales frente a repo FIMA",
    "Compara las líneas swap por las que la Fed entrega dólares a bancos centrales extranjeros a cambio de divisas con el acceso temporal a dólares mediante repo FIMA respaldado por bonos del Tesoro de EE. UU.; distingue las contrapartes."
  ],
  [
    "correspondent-banking",
    "Banca corresponsal",
    "Sigue los pagos transfronterizos a través de depósitos de clientes, saldos de corresponsalía y liquidación interbancaria."
  ],
  [
    "cross-currency-basis-demand-vs-hedging-cost",
    "Base entre divisas: demanda de dólares frente al coste de cobertura",
    "Utiliza la base como señal de precios de financiación y cobertura, comprobando la convención de cotización y el contexto."
  ],
  [
    "cross-currency-basis-vs-spot-fx",
    "Base entre divisas: tensión de financiación frente a dirección del tipo al contado",
    "Distingue el componente residual de financiación en dólares de la dirección del tipo de cambio al contado."
  ],
  [
    "currency-mismatch-dollar-liabilities-vs-local-cash-flow",
    "Descalce de monedas: pasivos en dólares frente a flujos en moneda local",
    "Representa el desajuste entre las obligaciones en dólares y los flujos de caja obtenidos en otra moneda."
  ],
  [
    "currency-pegs-stability-vs-monetary-independence",
    "Tipos de cambio fijos: estabilidad frente a independencia monetaria",
    "Expone la disyuntiva entre estabilidad cambiaria, movilidad de capitales e independencia monetaria."
  ],
  [
    "dollar-debt-service-interest-vs-refinancing",
    "Servicio de deuda en dólares: intereses frente a refinanciación del principal",
    "Distingue los pagos periódicos de intereses de la necesidad de acceder al mercado cuando vence el principal."
  ],
  [
    "dollar-funding-fx-swaps-vs-unsecured-borrowing",
    "Financiación en dólares: swaps de divisas frente a préstamos sin garantía",
    "Compara dos canales de financiación en dólares por su tratamiento en balance, estructura de pagos y exposición a la renovación."
  ],
  [
    "dollar-funding-onshore-vs-offshore",
    "Financiación en dólares: mercados onshore y offshore",
    "Considera la actividad dentro y fuera de Estados Unidos como partes conectadas del sistema del dólar, respetando los límites institucionales."
  ],
  [
    "dollar-funding-stress-basis-vs-commercial-paper",
    "Tensión de financiación en dólares: base de swaps frente a diferenciales de papel comercial",
    "Compara las señales de tensión de la financiación mediante swaps de divisas y del papel comercial sin garantía, sin tratarlas como idénticas."
  ],
  [
    "economic-fx-exposure-contracts-vs-competitiveness",
    "Exposición económica al tipo de cambio: contratos frente a competitividad",
    "Distingue las exposiciones contractuales identificables de la competitividad operativa de mayor plazo."
  ],
  [
    "fx-exposure-transaction-vs-translation",
    "Exposición cambiaria: flujos de transacción frente a efectos de conversión contable",
    "Distingue los flujos contractuales externos de los efectos de conversión contable en los estados financieros."
  ],
  [
    "fx-hedging-demand-forward-points-vs-direction",
    "Demanda de cobertura cambiaria: puntos forward frente a dirección de la divisa",
    "Distingue los componentes de precio de un contrato a plazo de una previsión direccional del tipo de cambio al contado."
  ],
  [
    "fx-hedging-natural-vs-financial",
    "Cobertura cambiaria: compensación natural de flujos frente a contratos financieros",
    "Compara compensaciones operativas de flujos de caja con coberturas financieras contractuales y sus distintas limitaciones."
  ],
  [
    "fx-intervention-sterilized-vs-unsterilized",
    "Intervención cambiaria: operaciones esterilizadas y no esterilizadas",
    "Distingue una operación cambiaria de su efecto sobre la liquidez interna y de cualquier medida de esterilización compensatoria."
  ],
  [
    "fx-pass-through-invoice-vs-producer-currency",
    "Transmisión del tipo de cambio a precios: moneda de factura frente a moneda del productor",
    "Relaciona moneda de facturación, costes del productor y respuestas de las empresas con una transmisión cambiaria incompleta a los precios."
  ],
  [
    "fx-reserves-liquidity-buffer-vs-defense",
    "Reservas de divisas: colchón de liquidez externa frente a defensa cambiaria",
    "Distingue las reservas totales publicadas de la capacidad utilizable, los objetivos de intervención y los efectos duraderos sobre el mercado."
  ],
  [
    "fx-swap-rollovers-short-vs-long-horizon",
    "Renovación de swaps de divisas: financiación corta frente a exposición larga",
    "Identifica el descalce de vencimientos que surge cuando una financiación mediante swaps a corto plazo sostiene una exposición más prolongada."
  ],
  [
    "fx-swaps-currency-exchange-vs-funding-obligation",
    "Swaps de divisas: intercambio de monedas frente a obligación de financiación",
    "Distingue la mecánica del intercambio de la obligación de financiar el principal completo, el riesgo de renovación y el riesgo de liquidación."
  ],
  [
    "global-dollar-credit-bank-loans-vs-debt-securities",
    "Crédito global en dólares: préstamos bancarios frente a valores de deuda internacionales",
    "Compara dos canales de crédito transfronterizo en dólares y sus distintas vías de transmisión."
  ],
  [
    "the-eurodollar-system",
    "El sistema de eurodólares",
    "Representa los depósitos y vínculos de financiación en dólares fuera de Estados Unidos sin tratar el sistema como una sola institución."
  ],
  [
    "when-dollars-disappear-global-liquidity-stress",
    "Cuando desaparecen los dólares: liquidez global y tensión de financiación",
    "Sigue una trayectoria condicional desde el endurecimiento de la financiación privada hasta los balances, la liquidez de mercado y las ventas de activos."
  ],
  [
    "part-1-foundations",
    "Fundamentos",
    "Construye el mapa básico de participantes, instrumentos y flujos de financiación en dólares antes de estudiar los mecanismos específicos de cada mercado."
  ],
  [
    "part-2-fx-swap-engine",
    "El mecanismo de los swaps de divisas",
    "Sigue el intercambio inicial y la reversión posterior de un swap de divisas y distingue la financiación de las previsiones direccionales de mercado."
  ],
  [
    "part-3-repo-collateral-and-haircuts",
    "Repo, garantías y recortes de valoración",
    "Sigue el intercambio de efectivo y garantías en una operación repo y examina recortes de valoración, márgenes y admisibilidad de garantías."
  ],
  [
    "part-4-dealers-and-balance-sheet-intermediation",
    "Intermediarios de mercado (dealers) y sus balances",
    "Explica cómo los balances de los intermediarios de mercado (dealers) conectan los mercados de financiación y cómo su capacidad de intermediación puede alterar la transmisión."
  ],
  [
    "part-5-funding-stress-and-market-transmission",
    "Tensión de financiación y transmisión al mercado",
    "Relaciona las condiciones de financiación con señales de mercado por canales condicionales, sin convertir un solo indicador en un diagnóstico definitivo."
  ],
  [
    "part-6-global-dollar-funding-and-fx-swaps",
    "Financiación global en dólares y swaps de divisas",
    "Representa la financiación transfronteriza en dólares mediante swaps de divisas, base entre divisas, líneas swap entre bancos centrales y repo FIMA."
  ],
  [
    "part-7-dollar-liquidity-backstops-and-policy-facilities",
    "Mecanismos de respaldo de liquidez en dólares y facilidades de política",
    "Distingue los mecanismos permanentes de respaldo por contraparte, estructura de transacción, garantías, precio y límites de interpretación."
  ]
];

export const spanishVideoMetadata = Object.freeze(Object.fromEntries(sourcePairs.map(([slug,title,description]) => [slug,Object.freeze({title,description})])));

export const spanishVideoCollections = Object.freeze({
  'core-framework': Object.freeze({title:'Marco esencial del dólar',kicker:'Comienza aquí',description:'Empieza distinguiendo el DXY del sistema más amplio del dólar, los rendimientos, la liquidez y la transmisión entre mercados.'}),
  'asset-transmission': Object.freeze({title:'Transmisión a los activos',kicker:'Canales de mercado',description:'Sigue cómo las condiciones del dólar pueden interactuar con el oro, el petróleo, Bitcoin, las acciones, el GNL y el EUR/USD sin reducir ningún mercado a una sola causa.'}),
  'rates-liquidity-policy': Object.freeze({title:'Tipos, liquidez y política monetaria',kicker:'Funcionamiento interno',description:'Distingue tipos oficiales, rendimientos de mercado, condiciones crediticias, reservas, flujos de caja del Tesoro y facilidades de liquidez.'}),
  'global-dollar-fx': Object.freeze({title:'Dólar global y mecanismos cambiarios',kicker:'Sistema transfronterizo',description:'Sigue las obligaciones en dólares a través de swaps de divisas, mercados de base, banca corresponsal, coberturas, reservas y crédito transfronterizo.'}),
  'dollar-funding-stack': Object.freeze({title:'La arquitectura de financiación en dólares',kicker:'Clase magistral de siete partes',description:'Un recorrido secuencial por instrumentos, intermediarios, restricciones y facilidades de política que influyen en la financiación mundial en dólares.'}),
});
