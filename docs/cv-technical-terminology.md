# Spanish CV technical terminology

Reviewed 2026-10-11 against current Spanish documentation from Microsoft Learn,
Google for Developers, the RAE, FundéuRAE, and university research repositories.
This note records terminology findings for the Spanish CV. It does not translate
the role names in the heading: `Product Engineer / Full-Stack Engineer` remains
unchanged.

## Editorial rule

Keep a technical English term when it is a recognizable label for Spanish
engineers (`software`, `stack`, `bare-metal`, `frontend`, `local-first`, `Rust`,
`RAM`, `RAG`, and product or project names). Translate the surrounding term when
the English phrase becomes a direct, awkward insertion into Spanish. Prefer a
Spanish term when a primary Spanish source uses it consistently and the English
form adds no useful precision.

Microsoft's Spanish documentation is useful evidence for technical usage, but
its localization is not always consistent. The recommendations below use
repeated, natural forms rather than copying one isolated translation.

## Findings and recommendations

| Current English or mixed form | Attested Spanish usage | Recommendation for this CV |
| --- | --- | --- |
| `agentic AI` | Microsoft uses **IA agéntica** in current Spanish certification material and also uses agent-based descriptions elsewhere. FundéuRAE records the competing forms *agentivo* and *agéntico* and does not settle the technical neologism. | Use **IA basada en agentes** in the profile. It is explicit, natural, and does not force an unsettled adjective into the sentence: `Me interesa especialmente la IA basada en agentes.` Use **IA agéntica** only when a shorter technical label is useful. Do not use `agentic AI` inside a Spanish sentence. |
| `retrieval pipeline` | Microsoft uses **canalización RAG**, **canalización de recuperación**, and **proceso de recuperación**. | Use **sistema de recuperación de información** to describe the purpose clearly. This is an editorial description of the documented retrieval workflow, not a prescribed translation of `pipeline`. |
| `vector embeddings` | Microsoft repeatedly uses **incrustaciones vectoriales** and **representaciones vectoriales**. Its Spanish technical pages also retain `embeddings` in API and model names. | Keep **embeddings**, as in Google’s Spanish teaching documentation. Google defines an embedding as a vector representation, so adding `vectoriales` is unnecessary here. |
| `device enrollment` | Microsoft Intune's Spanish information architecture uses **inscripción de dispositivos** throughout. It distinguishes *registro* in an identity directory from *inscripción* in device management. | Use **inscripción de dispositivos**. This is more precise for Inari than `device enrollment`. |
| `controller` | The RAE defines **controlador** as an Informática program that lets a computer or device manage its components. Microsoft uses `controlador` in the same sense. | Use **controlador**: `un controlador en Rust`. |
| `emulator` | The RAE has **emulador**. Microsoft uses `emulador` for local storage, terminal, and bot tooling. | Use **emulador**. The Spanish form is established and does not reduce technical precision. |
| `developers` | The RAE includes **desarrollador** as the person who conceives or implements computer programs. Microsoft uses **desarrolladores** in Spanish technical documentation. | Use **desarrolladores**: `Ayudo a otros desarrolladores...`. |
| `software architecture` | Microsoft uses **arquitectura de software**. The RAE includes a computing sense for **arquitectura**. | Use **arquitectura de software**. |
| `animated signatures` | The RAE defines **firma** and **animado**; their combination is transparent Spanish for a signature rendered over time. | Use **firmas animadas**: `Herramienta para crear firmas animadas.` |
| `language tooling` | Microsoft uses **herramientas de lenguajes específicos de dominio**, **herramientas del lenguaje**, and **herramientas de desarrollo**. The RAE recognizes **lenguaje** in the computing sense. | Use **herramientas para lenguajes de programación** or, when the project context is clear, **herramientas para el lenguaje RAM**. Do not use `language tooling` or the literal `tooling de lenguaje`. |
| `vehicle routing` | Spanish university research uses **ruteo de vehículos** for VRP. Microsoft uses **enrutamiento** mainly for network routing; both terms are understood, but `ruteo de vehículos` is the established operations-research label in the cited sources. | Use **planificación de rutas de vehículos** for readers in Spain. The Latin American sources establish the problem and its transshipment variant; this more descriptive wording is an editorial choice. |
| `transshipments` | Spanish operations-research papers use **transbordo** and **transbordos** for this VRP variant. | Use **transbordos** with the route-planning description. |
| `recommender` | Google for Developers and Microsoft use **sistema de recomendación** and **modelo de recomendación**. The RAE does not list *recomendador* as a headword. | Use **sistema interactivo de recomendación de películas**. Avoid `recommender` and avoid presenting `recomendador` as if it were an established standard term. |
| `bare-metal` | Google Cloud Spanish documentation retains **Bare Metal** as a product or infrastructure label and also explains it as **hardware desnudo**, **equipo físico**, or **metal desnudo**. | Use **sistemas de bajo nivel** in the profile for a smooth Spanish sentence. Keep **bare-metal** in skills or project context when the exact systems term is useful; translating it as `metal desnudo` would sound less natural to the intended engineering reader. |
| `frontend` | Microsoft Spanish documentation uses both **front-end** and **interfaz de usuario**. Fundéu's technical glossary gives `front-end / interfaz de usuario`. | Use **interfaces de usuario** in the profile for natural prose. Keep **frontend** in skills or project context when the engineering area needs to be named. Avoid switching between `frontend`, `front-end`, and `interfaz` in the same document. |
| `open source` | Microsoft consistently uses **código abierto** in Spanish course and product documentation, although some pages leave `Open Source` in a product label. | Use **código abierto** in prose: `publico la mayor parte de mi trabajo como código abierto`. `Proyectos open source` is understandable, but it is a less frictionless Spanish phrase here. |
| `offline` | Microsoft uses **sin conexión** and **funcionamiento sin conexión** in Spanish product documentation. | Use **funcionar sin conexión** or **funcionamiento sin conexión** in the Inari copy. Keep `local-first` because it names a specific architecture pattern. |

## Selected copy

The final strings are in `apps/astro/src/i18n/cv.ts`. The profile uses:

> Desarrollo software en todo el stack, desde sistemas de bajo nivel hasta interfaces de usuario. Me interesa especialmente la IA basada en agentes y publico la mayor parte de mi trabajo como código abierto.

The experience and project sections use the same terms. English role titles and
technology names remain unchanged. Section labels use Spanish. Current work
uses present tense; earlier implementations use past tense.

## Sources

- [Google for Developers: Embeddings](https://developers.google.com/machine-learning/crash-course/embeddings/embedding-space?hl=es-419) — retains `embeddings` and defines the term as a vector representation.

- [Microsoft Learn: Patrón de capacidades centradas en la IA](https://learn.microsoft.com/es-es/agents/adoption-patterns/pattern-ai-first-capabilities) — uses *capacidades agénticas* and *IA agéntica*.
- [Microsoft Learn: Sorteo sobre las habilidades del agente de IA](https://learn.microsoft.com/es-es/credentials/certifications/microsoft-ai-agent-skills-sweepstakes) — uses *IA agéntica* and *inteligencia artificial agente*.
- [FundéuRAE: «agéntico / agentivo»](https://www.fundeu.es/consultas/palabra-clave/agentico/) — records the unresolved Spanish forms for *agentic*.
- [Microsoft Learn: Generación aumentada por recuperación con archivos Azure](https://learn.microsoft.com/es-es/azure/storage/files/artificial-intelligence/retrieval-augmented-generation/overview) — uses *canalización RAG*, *incrustaciones vectoriales*, and the stages of a RAG retrieval flow.
- [Microsoft Learn: Creación de sistemas avanzados de generación aumentada de recuperación](https://learn.microsoft.com/es-es/azure/developer/ai/advanced-retrieval-augmented-generation) — uses *canalización de inferencia* and *proceso de recuperación*.
- [Microsoft Learn: Conceptos de inserciones multimodales](https://learn.microsoft.com/es-es/azure/ai-services/computer-vision/concept-image-retrieval) — uses *incrustaciones vectoriales* and *proceso de recuperación*.
- [Microsoft Learn: Inscripción de dispositivos de Microsoft Intune](https://learn.microsoft.com/es-es/intune/device-enrollment/) — uses *inscripción de dispositivos* as the heading and core term.
- [Microsoft Learn: Desarrollo y ejecución de Azure Functions de forma local](https://learn.microsoft.com/es-es/azure/azure-functions/functions-develop-local) — uses *emulador de almacenamiento local*.
- [Microsoft Learn: Modelar la arquitectura de la aplicación](https://learn.microsoft.com/es-es/visualstudio/modeling/model-your-app-s-architecture?view=visualstudio) — uses *arquitectura de software*.
- [Microsoft Learn: Implementación de software de código abierto](https://learn.microsoft.com/es-es/training/modules/implement-open-source-software-azure/) — uses *software de código abierto* and *desarrollador*.
- [Google for Developers: Descripción general de los sistemas de recomendación](https://developers.google.com/machine-learning/recommendation/overview/types?hl=es-419) — uses *sistemas de recomendación*.
- [Microsoft Learn: Entrenamiento de modelos de recomendación](https://learn.microsoft.com/es-es/azure/databricks/machine-learning/train-recommender-models) — uses *sistema de recomendación* and *modelos de recomendación* for films.
- [Google Cloud: Instancias de equipos físicos](https://docs.cloud.google.com/compute/docs/instances/bare-metal-instances?hl=es-419) — retains *Bare Metal* and explains *hardware desnudo*, *equipo físico*, and *metal desnudo*.
- [Microsoft Learn: Extensión del front-end de Microsoft Fabric](https://learn.microsoft.com/es-es/fabric/workload-development-kit/extensibility-front-end) — uses *front-end* and *interfaz de usuario*.
- [FundéuRAE: Glosario de comunicación estratégica](https://www.fundeu.es/wp-content/uploads/2018/02/Glosario-de-Comunicaci%C3%B3n-Estrat%C3%A9gica-Fund%C3%A9u.pdf) — lists *front-end / interfaz de usuario*.
- [Universidad Industrial de Santander: Ruteo de vehículos con transbordos](https://noesis.uis.edu.co/entities/publication/94092ff1-05a9-4a91-b473-a03c630a8243) — uses *ruteo de vehículos* and *transbordos* in an operations-research title and abstract.
- [Universidad Autónoma de Bucaramanga: Problema de ruteo de vehículos con transbordo](https://repository.unab.edu.co/bitstream/handle/20.500.12749/20905/2022_Articulo_Arias_Osorio_Javier.pdf?sequence=1) — uses *problema de ruteo de vehículos* and *transbordo*.
- [RAE: `controlador`](https://dle.rae.es/controlador), [RAE: `desarrollador`](https://dle.rae.es/desarrollador), [RAE: `emulador`](https://dle.rae.es/emulador), [RAE: `interfaz`](https://dle.rae.es/interfaz), [RAE: `software`](https://dle.rae.es/software), [RAE: `arquitectura`](https://dle.rae.es/arquitectura), [RAE: `firma`](https://dle.rae.es/firma), [RAE: `animado`](https://dle.rae.es/animado), [RAE: `herramienta`](https://dle.rae.es/herramienta), and [RAE: `lenguaje`](https://dle.rae.es/lenguaje) — establish the Spanish lexical forms used in the recommendations. The RAE entry for [`recomendador`](https://dle.rae.es/recomendador) does not list it as a headword.
