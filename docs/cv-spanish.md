# Spanish CV copy

The Spanish CV uses Spanish as spoken in Spain. It describes the same work as
the English CV. Role names, project names, and technology names stay in English. Technical prose
uses the clearest term for a Spanish engineering reader.

## Editorial sources

- [LinkedIn: profile summaries](https://www.linkedin.com/business/talent/blog/product-tips/linkedin-profile-summaries-that-we-love-and-how-to-boost-your-own):
  write in the first person, use concrete examples, cut vague claims, and read
  the text aloud to check its voice.
- [LinkedIn: Spanish profile guide](https://business.linkedin.com/content/dam/me/business/en-us/talent-solutions/learning-center/tip-sheets/es-es/EnhanceYourPresenceLinkedIn_ES.pdf):
  describe contributions in short sentences. A CV needs less narrative than a
  LinkedIn profile, so its experience section uses short bullets.
- [Europass: create a CV](https://europass.europa.eu/es/create-europass-cv):
  use clear language and active verbs. Focus on relevant facts.
- [FundéuRAE: currículum and curriculum vitae](https://www.fundeu.es/recomendacion/curriculo-o-curriculum-con-tilde-pero-curriculum-vitae/):
  use the Spanish word «currículum» with an accent. The Latin phrase has no accent
  and needs italics.
- [FundéuRAE: acronyms](https://www.fundeu.es/recomendacion/siglas-y-acronimos-claves-de-redaccion/):
  keep written acronyms unchanged in the plural, including «API».

## Copy review

Spanish carries the prose. Keep established English terms when they add useful
precision, such as `software`, `hardware`, `stack`, `embeddings`, and `local-first`.
Use Spanish for phrases whose English form interrupts the sentence. This follows
the owner's clarified preference. See [the terminology research](cv-technical-terminology.md)
for primary sources and the distinction between documented usage and editorial choices.

| Area | Wording decision |
| --- | --- |
| Profile | Describe the range with «sistemas de bajo nivel» and «interfaces de usuario». Use «IA basada en agentes» and «código abierto». See [the profile research](cv-profile-research.md). |
| Canary | Use «sistema de recuperación de información» and retain `embeddings`, as in Google's Spanish technical documentation. |
| Inari | Use «inscripción de dispositivos», «controlador», and «sin conexión». Retain `hardware`, `Rust`, and `local-first`. |
| RAM and routing | Use «herramientas», «emulador», and «planificación de rutas con transbordos». Keep present tense for RAM and past tense for the earlier routing implementation. |
| Other work | Name the projects directly. Use «desarrolladores» and «arquitectura de software». |
| Projects | Describe the purpose in Spanish with the same terminology as the experience bullets. |
| Skills | Translate the section labels. Keep technology names unchanged. |
| General text | Keep document labels, contact details, location, academic names, language levels, and metadata in Spanish. |

## Factual sources

Project descriptions and experience bullets use the public documentation for
[Canary](https://github.com/hadronomy/canary),
[Inari](https://github.com/hadronomy/inari),
[RAM](https://github.com/hadronomy/ram), and
[VRPT-SWTS](https://github.com/hadronomy/VRPT-SWTS).
The signature tool, movie recommender, and architecture advice also appear in
the shared profile data. The CV states no user counts, revenue, performance
gains, or production adoption figures.

## Verb tenses

Experience bullets use the first person throughout. Present tense describes
current development in Canary, Inari, and RAM, and current architecture advice.
Past tense describes the earlier routing implementation and the signature and
movie tools. The academic routing project belongs to the 2024–2025 assignment.
The present tense does not imply that the software is stable or complete.

The [RAE conjugation reference](https://www.rae.es/buen-uso-espa%C3%B1ol/conjugaci%C3%B3n-espa%C3%B1ola)
supports the forms «Implementé» and «Creé». The tense choice follows the status
of each activity, rather than applying one tense to every project in the role.

The copy belongs in `apps/astro/src/i18n/cv.ts`. The role belongs in the shared
profile data and is outside the translation dictionary.
