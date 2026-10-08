---
layout: ../../../layouts/SpanishPrivacyReviewLayout.astro
title: "Borrador del aviso de privacidad en español | Revisión interna"
description: "Traducción de revisión del aviso de privacidad vigente de USD Impact. No publicada y no autorizada para activar analítica en la edición española."
---

# Aviso de privacidad — borrador en español

_Última actualización del aviso fuente: 18 de septiembre de 2026_

> **Estado:** traducción para revisión interna. Fuente inglesa vinculada al commit `3314b13d04dadf97e2654ec879fb56925725cbae`, blob `175b230a83aaf5fd3dbbf7c087bdc8b8a965617a`. No es todavía el aviso público de privacidad en español.

## Qué recopilamos

Cuando te apuntas a la lista de espera de *Read the Dollar First*, recopilamos la dirección de correo electrónico que envías y la hora en la que se crea el registro de contacto.

Cuando te suscribes por separado al correo USD Impact Daily Learning, recopilamos la dirección de correo electrónico que envías, la finalidad y la versión del consentimiento, la hora en la que se registra el consentimiento y cualquier registro posterior de retirada. El consentimiento para el correo Daily Learning se almacena por separado del consentimiento para la lista de espera del libro.

Si creas una cuenta o compras la Guided Interactive Edition, podemos tratar:

- tu dirección de correo electrónico y los registros de autenticación necesarios para proteger tu cuenta;
- identificadores del proveedor de pagos relacionados con cliente, transacción, reembolso y ajustes;
- estado de compra, nivel de precio, moneda y estado de acceso;
- progreso de aprendizaje y resultados de cuestionarios asociados a tu cuenta;
- posición de reproducción de vídeo, estado de finalización y el identificador de la película necesario para reanudar la reproducción; y
- solicitudes de cuenta, facturación, reembolso, eliminación o soporte que nos envíes.

Los datos completos de la tarjeta de pago son recopilados y tratados por **Lemon Squeezy**, el Merchant of Record seleccionado, de acuerdo con su [Privacy Notice](https://www.lemonsqueezy.com/privacy). USD Impact no recibe ni almacena números completos de tarjetas de pago ni códigos de seguridad de tarjeta.

Si permites la analítica opcional, el sitio web puede registrar eventos limitados y propios relacionados con el aprendizaje y el embudo de checkout, necesarios para entender si los recursos educativos y el proceso de compra funcionan. Estos eventos pueden incluir:

- una descarga del Weekly Dollar Regime Checklist;
- el inicio o reintento de un cuestionario;
- la finalización de un cuestionario, resultado de aprobado o no aprobado y puntuación agregada;
- una visita a la página de checkout, un clic en el botón de checkout o una redirección al inicio de sesión seguro;
- la ruta de la página en la que se produjo el evento; y
- valores de campaña presentes expresamente en los parámetros de URL `utm_source`, `utm_medium` o `utm_campaign`.

Esta telemetría propia no incluye respuestas seleccionadas en cuestionarios, respuestas correctas, direcciones de correo electrónico, identificadores de cuenta, identificadores publicitarios, identificadores persistentes de sesión, datos de pago ni direcciones IP sin procesar en el registro de eventos de la aplicación. Los recuentos del embudo de checkout son eventos agregados, no visitantes únicos ni prueba de un comprador o de una compra completada.

Cuando hay configurado un identificador válido de medición de Google Analytics 4 y has aceptado la analítica, USD Impact también puede cargar Google Analytics 4 para medir el uso agregado del sitio web, como páginas vistas, sesiones, fuentes de tráfico, categoría de dispositivo, informes a nivel de país e interacción. El puente de eventos de GA4 puede recibir las mismas categorías consentidas de descarga de checklist, embudo de checkout, interacción con cuestionarios, suscripción completada a la lista de espera/Daily Learning y visualizaciones agregadas de secciones del Library Pass descritas anteriormente, pero no recibe valores de campaña procedentes de la carga del evento propio, direcciones de correo electrónico, identificadores de cuenta, identificadores de contenido ni ningún evento de compra completada derivado del navegador. Google Analytics puede asignar un identificador analítico propio mediante cookies `_ga`. USD Impact configura Google Analytics con Google Signals y la personalización publicitaria deshabilitados y no envía intencionadamente a Google Analytics direcciones de correo electrónico, identificadores de cuenta, datos de pago, respuestas de cuestionarios ni otros identificadores directos de cuenta. No se utilizan rastreadores publicitarios.

## Cookies, almacenamiento del navegador y consentimiento

USD Impact utiliza un control de privacidad propio en lugar de una plataforma de consentimiento orientada a publicidad. En una primera visita, la analítica opcional permanece desactivada salvo que selecciones **Aceptar analítica** o la habilites en **Revisar opciones**. **Rechazar analítica** está disponible al mismo nivel. Más adelante puedes cambiar o retirar esta elección mediante **Opciones de privacidad** en el pie del sitio web. La retirada detiene futuros eventos de analítica opcional desde este navegador; el sitio también deshabilita la recopilación de Google Analytics e intenta eliminar sus cookies `_ga` del dominio de USD Impact. La retirada no afecta al tratamiento que haya sido lícito antes de la retirada.

El inventario de cookies es:

- `usd_impact_consent`: almacena únicamente la versión `v1` de la elección de privacidad y si la analítica fue aceptada o rechazada; se conserva durante un máximo de 180 días para que el sitio web pueda recordar la elección;
- `usd_impact_access`: cookie de acceso de autenticación de corta duración y solo HTTP; se conserva hasta una hora después de un inicio de sesión correcto;
- `usd_impact_refresh`: cookie de actualización de autenticación solo HTTP necesaria para mantener de forma segura una cuenta con sesión iniciada; se conserva hasta 30 días;
- `usd_impact_pkce`: prueba temporal solo HTTP utilizada para completar de forma segura una autenticación mediante enlace de correo electrónico de un solo uso; se conserva hasta 10 minutos; y
- `_ga` y `_ga_*`: cookies propias opcionales de Google Analytics, creadas únicamente después del consentimiento de analítica cuando GA4 está configurado, con el cliente configurado para una duración máxima de cookie de hasta un año.

Las cookies de autenticación utilizan `Secure` en HTTPS, `SameSite=Lax` y la finalidad limitada descrita anteriormente. No se utilizan para publicidad ni para elaboración de perfiles entre sitios. La cookie de consentimiento se considera esencial porque, sin ella, el sitio no podría recordar un rechazo o una retirada y tendría que volver a preguntar en cada página.

La página de inicio de sesión de la cuenta carga Cloudflare Turnstile para prevenir abuso. Turnstile procesa la solicitud de seguridad y devuelve un token de verificación de corta duración; Cloudflare puede utilizar datos de seguridad o una cookie de autorización cuando se aplican sus funciones de desafío. USD Impact no utiliza Turnstile para publicidad. Consulta la [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).

USD Impact no utiliza `localStorage` ni `sessionStorage` del navegador para el consentimiento ni para su telemetría agregada propia. El service worker del sitio web funciona solo sobre red, no crea una caché de contenido de la aplicación y se registra únicamente después de que un usuario con sesión iniciada seleccione expresamente **Enable notifications** y conceda permiso en el navegador. Deshabilitar las notificaciones elimina la suscripción push de ese navegador y el registro del service worker. Cualquier registro heredado de service worker sin una suscripción push activa se elimina automáticamente.

## Por qué lo recopilamos

La información de la lista de espera se utiliza únicamente para:

- confirmar que te has apuntado a la lista de espera;
- enviar el enlace de compra cuando el libro esté disponible; y
- enviar actualizaciones esenciales de disponibilidad relacionadas directamente con el libro.

La información del correo Daily Learning se utiliza únicamente para enviar la serie educativa Daily Card que has solicitado expresamente y para mantener pruebas de entrega, supresión y baja de esa serie. Suscribirse a Daily Learning no te suscribe a la lista de espera del libro, promociones no relacionadas ni alertas de trading.

La información de cuenta y comercio se utiliza para:

- autenticar tu cuenta y protegerla frente a accesos no autorizados;
- crear y confirmar transacciones de checkout;
- conceder, mantener, suspender, reembolsar o revocar el acceso de pago cuando sea necesario;
- evitar compras duplicadas y conciliar eventos de pago;
- responder a solicitudes de cuenta, facturación, reembolso o eliminación; y
- cumplir obligaciones de prevención de fraude, contabilidad, fiscalidad y otras obligaciones legales.

Cuando lo permites, la analítica opcional se utiliza para:

- medir si se utilizan el checklist y los cuestionarios;
- identificar patrones de finalización y reintento;
- mejorar la claridad de las preguntas y la secuencia de aprendizaje;
- detectar fallos en los flujos educativos;
- comprender el movimiento agregado desde la página de checkout hasta el límite de inicio de sesión seguro; y
- comprender patrones agregados de descubrimiento y uso del sitio web sin habilitar personalización publicitaria.

Apuntarse a la lista de espera no te suscribe a comentarios de mercado no relacionados, alertas de trading ni promociones de terceros.

## Proveedores de servicios

El sitio web se despliega mediante Vercel. Vercel procesa las solicitudes del sitio web y los registros de ejecución de la aplicación necesarios para operar y solucionar problemas del servicio. Cloudflare Stream procesa las solicitudes de reproducción de vídeo protegido y entrega el vídeo adaptativo y los archivos de subtítulos solicitados por una cuenta autorizada. Los contadores agregados de aprendizaje y del embudo de checkout, junto con identificadores de eventos duplicados de corta duración, se almacenan mediante Upstash Redis conectado al proyecto de Vercel. Los registros de cuenta, acceso, comercio, consentimiento, entrega de notificaciones y progreso de vídeo guardado se almacenan mediante Supabase. Los contactos de lista de espera y la entrega de correo solicitada se procesan mediante Resend. Cuando el checkout público se habilita por separado, Lemon Squeezy procesa la información de pago, impuestos, documentos financieros del comprador, reembolsos, prevención de fraude y transacciones relacionadas como Merchant of Record. Los impuestos indirectos aplicables son calculados, recaudados y remitidos por Lemon Squeezy como Merchant of Record y se muestran antes del pago. USD Impact sigue siendo responsable de la información de cuenta, acceso al producto, registros de aprendizaje y soporte de producto que trata.

Cuando GA4 está configurado y se concede consentimiento para analítica, Google Analytics procesa analítica opcional de uso del sitio web por cuenta de USD Impact. USD Impact deshabilita Google Signals y la personalización publicitaria en la configuración de su cliente GA4. Los propios términos y documentación de privacidad de Google regulan el tratamiento de Google cuando corresponda.

Estos proveedores tratan información únicamente en la medida necesaria para operar el sitio web, las cuentas, las herramientas de aprendizaje, el flujo de comercio, el soporte, la entrega de correo solicitada y la analítica consentida. Sus propios avisos de privacidad se aplican cuando actúan de forma independiente, incluido el aviso de privacidad de Lemon Squeezy para la transacción de pago.

## Bases jurídicas

Dependiendo de la actividad, tratamos información porque es necesaria para prestar el servicio que has solicitado, para cumplir obligaciones legales, con tu consentimiento o por intereses legítimos como seguridad, prevención de fraude, fiabilidad del servicio y soporte. La analítica opcional se ejecuta únicamente con tu consentimiento. Cuando el tratamiento se basa en el consentimiento, puedes retirar ese consentimiento sin afectar al tratamiento lícito anterior.

## Conservación y eliminación

Tu registro de lista de espera se conserva hasta que te des de baja, solicites su eliminación o se retire la lista de espera. Los futuros mensajes de disponibilidad incluyen un mecanismo de baja cuando sea necesario.

Las pruebas de consentimiento y retirada de Daily Learning se conservan según sea necesario para demostrar el estado de la suscripción solicitada, respetar la supresión y evitar mensajes después de la retirada. Los mensajes de Daily Learning incluyen un mecanismo de baja específico para esa finalidad. Retirar el consentimiento de Daily Learning no cancela comunicaciones obligatorias de cuenta, seguridad, compra, reembolso, privacidad o soporte.

Los registros de cuenta y acceso se conservan mientras tu cuenta o el acceso comprado permanezcan activos. Si solicitas la eliminación de la cuenta, el acceso se deshabilita y la cuenta entra en el periodo de seguridad documentado antes de que los datos de cuenta que puedan eliminarse sean eliminados o anonimizados. Los registros de transacciones, reembolsos, facturas, prevención de fraude y contabilidad pueden conservarse durante los periodos exigidos por el proveedor de pagos, las redes de pago, las obligaciones fiscales, contables, de disputas y otras obligaciones legales aplicables.

Los contadores agregados diarios propios de aprendizaje y del embudo de checkout se conservan hasta 24 meses. Los identificadores de eventos duplicados se conservan hasta 24 horas y se utilizan únicamente para evitar el recuento repetido. Los cuerpos sin procesar de los eventos de telemetría propia no se almacenan en la base de datos analítica duradera. La conservación de registros operativos de ejecución sigue el plan de alojamiento y la configuración del proyecto. La duración de las cookies de GA4 está configurada para no más de un año; la conservación de datos de eventos de GA4 debe configurarse en la propiedad de Google Analytics y debería mantenerse durante el periodo más corto adecuado para el análisis agregado de producto y SEO.

## Compartición y venta

USD Impact no vende información personal, direcciones de correo electrónico de la lista de espera o de Daily Learning, información de cuenta ni telemetría de aprendizaje. La información puede compartirse únicamente con proveedores de servicios necesarios para operar el sitio web, procesar compras y reembolsos, proporcionar acceso a cuentas, almacenar datos, entregar el correo solicitado, responder a solicitudes de soporte, prevenir fraude, proporcionar analítica consentida y cumplir obligaciones legales.

## Seguridad

Las credenciales de API se almacenan como variables de entorno de despliegue protegidas y no se exponen en el código fuente público del sitio web. El Measurement ID de GA4 es un identificador público de configuración y no un secreto de autenticación. Las cargas de eventos propios de aprendizaje utilizan una lista permitida estricta y excluyen deliberadamente cookies, cadenas de user-agent, referrers, direcciones de correo electrónico, identificadores persistentes de sesión y selecciones de respuestas de cuestionarios. El acceso a informes está restringido mediante un endpoint de servidor protegido. Ningún sistema en línea puede garantizar seguridad absoluta, pero el acceso se limita a los servicios necesarios para operar el sitio web.

## Tu elección

Enviar el formulario de lista de espera o el formulario de correo Daily Learning es opcional. Las casillas de consentimiento no están preseleccionadas. Puedes seguir utilizando el sitio web educativo público sin suscribirte a ninguna de las dos finalidades de correo ni aceptar analítica opcional. Cada finalidad de consentimiento puede retirarse de forma independiente. Rechazar la analítica no bloquea el contenido público, las descargas, la puntuación de cuestionarios, los reintentos, la seguridad de la cuenta ni la navegación.

Sujeto a la legislación aplicable, puedes solicitar acceso, corrección, eliminación, limitación o exportación de tu información personal, u oponerte a determinados tratamientos. También puedes presentar una reclamación ante la autoridad de protección de datos correspondiente. Algunos registros de transacciones o contabilidad no pueden eliminarse de inmediato cuando la conservación sea legalmente obligatoria.

Para solicitudes de privacidad, cuenta o derechos sobre datos, contacta con [support@usd-impact.com](mailto:support@usd-impact.com). Puede que necesitemos verificar que una solicitud está relacionada con tu cuenta antes de actuar.

## Operador

USD Impact es operado por **KELA LEADS S.R.L.**, una sociedad de responsabilidad limitada rumana registrada con CUI **40790448**, número de Registro Mercantil **J38/820/2020** y EUID **ROONRC.J38/820/2020**. Domicilio social: **Str. Doctor Hacman nr. 28, bl. 83, sc. B, ap. 9, 240232 Râmnicu Vâlcea, România**.

Este aviso describe las operaciones actuales del sitio web y no constituye asesoramiento jurídico.
