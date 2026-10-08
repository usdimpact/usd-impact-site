const CONSENT_COPY = Object.freeze({
  en: Object.freeze({
    locale: 'en',
    bannerTitle: 'Privacy choices',
    bannerBeforeLink: 'Essential security and account features always remain available. With your permission, USD Impact records limited first-party learning and checkout events and may use Google Analytics 4 to understand aggregate website usage. Google Analytics may set first-party analytics cookies. Advertising features and ad personalization are disabled.',
    privacyLinkLabel: 'Read the privacy notice',
    reject: 'Reject analytics',
    review: 'Review settings',
    accept: 'Accept analytics',
    eyebrow: 'USD Impact privacy',
    settingsTitle: 'Privacy settings',
    settingsIntro: 'Choose whether optional analytics may run in this browser.',
    closeAria: 'Close privacy settings',
    essentialTitle: 'Essential security and account features',
    essentialDescription: 'Authentication, abuse prevention, requested checkout, and saved privacy choices.',
    alwaysActive: 'Always active',
    analyticsTitle: 'Optional analytics',
    analyticsDescription: 'First-party checklist, quiz, checkout and page-route events may run, and Google Analytics 4 may measure aggregate website usage using first-party analytics cookies. Advertising features and ad personalization are disabled.',
    fullNotice: 'Full privacy notice',
    save: 'Save choices',
  }),
  es: Object.freeze({
    locale: 'es',
    bannerTitle: 'Opciones de privacidad',
    bannerBeforeLink: 'Las funciones esenciales de seguridad y cuenta permanecen siempre disponibles. Con tu permiso, USD Impact registra eventos limitados y propios relacionados con el aprendizaje y el proceso de checkout, y puede utilizar Google Analytics 4 para comprender el uso agregado del sitio web. Google Analytics puede establecer cookies analíticas propias. Las funciones publicitarias y la personalización de anuncios están deshabilitadas.',
    privacyLinkLabel: 'Leer el aviso de privacidad',
    reject: 'Rechazar analítica',
    review: 'Revisar opciones',
    accept: 'Aceptar analítica',
    eyebrow: 'Privacidad de USD Impact',
    settingsTitle: 'Opciones de privacidad',
    settingsIntro: 'Elige si la analítica opcional puede ejecutarse en este navegador.',
    closeAria: 'Cerrar las opciones de privacidad',
    essentialTitle: 'Funciones esenciales de seguridad y cuenta',
    essentialDescription: 'Autenticación, prevención de abuso, checkout solicitado y opciones de privacidad guardadas.',
    alwaysActive: 'Siempre activas',
    analyticsTitle: 'Analítica opcional',
    analyticsDescription: 'Pueden ejecutarse eventos propios relacionados con checklist, cuestionarios, checkout y rutas de página, y Google Analytics 4 puede medir el uso agregado del sitio web mediante cookies analíticas propias. Las funciones publicitarias y la personalización de anuncios están deshabilitadas.',
    fullNotice: 'Aviso de privacidad completo',
    save: 'Guardar opciones',
  }),
});

export function consentCopyForLocale(locale = 'en') {
  return CONSENT_COPY[locale] ?? CONSENT_COPY.en;
}

export { CONSENT_COPY };
