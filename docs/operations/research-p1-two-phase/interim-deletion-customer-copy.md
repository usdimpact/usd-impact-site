# Interim deletion: proposed customer copy (DRAFT, not live)

**Status:** proposed wording only. The live pages are unchanged. Publishing needs owner approval and privacy/legal review of the response period, and a native-speaker review of the Spanish. This is not legal advice.

**Why:** the live account page calls the first seven days a "safety period" that "ends" on a date, and the privacy policy says eligible data is deleted "after the documented safety period". During interim mode nothing happens automatically on that date, and the customer cannot cancel the request themselves. The wording below:
- describes the seven days as the earliest point at which deletion processing can begin;
- never promises completion on that date, and never says the request is complete;
- keeps the existing no-refund and record-retention statements.

## Account page — `apps/web/src/pages/account/index.astro`

The page is English-only today. The Spanish lines are for a future Spanish account page or a localized message.

### Delete panel (line 211)

**Current (EN):** Deletion ends paid access and starts a seven-day safety period. It does not create a refund.

**Proposed (EN):** Requesting deletion ends paid access straight away. Deletion processing cannot begin until at least seven days after your request, and it may take longer while required account, payment and privacy checks are completed. We will email you when the process is complete. Requesting deletion does not create a refund.

**Proposed (ES):** Al solicitar la eliminación, el acceso de pago termina de inmediato. El proceso de eliminación no puede comenzar hasta que hayan pasado al menos siete días desde tu solicitud, y puede tardar más mientras se completan las comprobaciones necesarias de la cuenta, los pagos y la privacidad. Te enviaremos un correo electrónico cuando el proceso haya terminado. Solicitar la eliminación no genera un reembolso.

### Confirmation dialog (line 495)

**Current (EN):** Request account deletion? Paid access will stop and a seven-day safety period will begin. This does not create a refund.

**Proposed (EN):** Request account deletion? Paid access will stop now. Deletion processing cannot begin for at least seven days and may take longer. This does not create a refund.

**Proposed (ES):** ¿Solicitar la eliminación de la cuenta? El acceso de pago se detendrá ahora. El proceso de eliminación no podrá comenzar durante al menos siete días y puede tardar más. Esto no genera un reembolso.

### Success message (lines 509–511)

**Current (EN):** Deletion requested. Safety period ends {date}.

**Proposed (EN):** Deletion request received. It is not complete yet. Processing cannot begin before {date} and may take longer. We will email you when it is complete.

**Proposed (ES):** Hemos recibido tu solicitud de eliminación. Todavía no está completada. El proceso no puede comenzar antes del {date} y puede tardar más. Te enviaremos un correo electrónico cuando haya terminado.

`{date}` is `deletionDueAt` formatted for the reader's locale. The Spanish message should format it with an `es` locale.

## Privacy policy

`apps/web/src/pages/privacy.md` line 108 (EN) and `apps/web/src/pages/es/privacy.md` line 109 (ES). Only the deletion sentence changes.

**Current (EN):** If you request account deletion, access is disabled and the account enters the documented safety period before eligible account data is deleted or anonymized.

**Proposed (EN):** If you request account deletion, access is disabled right away. Eligible account data is deleted or anonymized after a waiting period of at least seven days and once required account, payment and privacy checks are complete. We will tell you when the process is complete.

**Current (ES):** Si solicitas la eliminación de la cuenta, el acceso se deshabilita y la cuenta entra en el periodo de seguridad documentado antes de que los datos de cuenta que puedan eliminarse sean eliminados o anonimizados.

**Proposed (ES):** Si solicitas la eliminación de la cuenta, el acceso se deshabilita de inmediato. Los datos de cuenta que puedan eliminarse se eliminan o anonimizan después de un periodo de espera de al menos siete días y una vez completadas las comprobaciones necesarias de la cuenta, los pagos y la privacidad. Te informaremos cuando el proceso haya terminado.

## Owner checks before publishing

1. Confirm the maximum time a deletion may take, and decide whether to state it (decision D2). Do not publish a deadline the process cannot meet.
2. Decide whether to offer a way to withdraw a request (there is none today). If none is offered, do not imply one.
3. The "we will email you" lines assume the `account_deletion_completed` email will be sent. Its delivery is not verified, and it is staged only in the Draft two-phase design. If that cannot be guaranteed, replace those lines with "Contact support for the status of your request."
4. Update the English and Spanish privacy policies together, with a revised policy date.
