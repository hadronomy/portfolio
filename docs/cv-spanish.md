# Spanish CV copy

The Spanish CV uses Spanish as spoken in Spain. It describes the same work as
the English CV. Role names, project names, and technology names stay in English.

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

| Area | Earlier wording | Editorial decision |
| --- | --- | --- |
| Document label | «Currículum vitae» | Use «Currículum», the Spanish form. |
| Engagement | «Independiente» | Use «Por cuenta propia» to describe the working arrangement without implying employment at an organisation or a specific tax status. |
| Profile | A list of technologies and activities | Present the engineering range, then connect the interest in agent-based AI with open-source work. See [the profile research](cv-profile-research.md) for the sources and final wording. |
| Canary experience | «búsqueda jurídica», «fragmentos temporales», «embeddings vectoriales» | Use «búsqueda de legislación española», «control de vigencia», and «indexación vectorial». Preserve the technical meaning while making the text easier to read. |
| Inari experience | A list after «Desarrollo Inari:» | Explain what the software does before listing registration, offline operation, and the Rust controller. |
| RAM and routing experience | One sentence joining two projects | Give each project its own sentence. Keep «transbordos», which names the actual routing constraint. |
| Other work | All verbs in the present tense | Use «Creé» for the earlier tools and «Asesoro» for current architecture advice. The project descriptions specify animated signatures and a movie recommender. |
| Project descriptions | Generic phrases such as «plataforma local» | Describe each project's purpose. Explain RAM as a programming language and emulator; identify waste collection in VRPT-SWTS. |
| Section labels | «Perfil» | Use «Perfil profesional». Keep the other labels: they are concise and standard in a Spanish CV. |
| Other text | Portrait description, location, education, language levels, skill groups, and metadata | Reviewed and retained. The wording is natural and the official university and degree names are accurate. |

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
