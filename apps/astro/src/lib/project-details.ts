import type { workProjects } from '~/lib/work-projects';

type ProjectId = (typeof workProjects)[number]['id'];
type ProjectDetails = {
  subtitle: string;
  description: string;
  sections: readonly { title: string; text: string }[];
  sourceLabel: string;
};

export const projectDetails = {
  canary: {
    subtitle: 'Legal retrieval for Spanish law',
    description:
      'Canary is an agentic legal assistant with a Rust core and TypeScript interfaces. It retrieves Spanish law through document structure and temporal validity.',
    sections: [
      {
        title: 'The retrieval problem',
        text: 'A legal question depends on the provision, its surrounding context, and the version in force on a given date. Canary parses BOE documents into a hierarchy of legal fragments. Each fragment keeps its position, citation identity, temporal validity, and references to related material.',
      },
      {
        title: 'From candidate text to legal context',
        text: 'Smaller scout vectors retrieve initial candidates. Larger vectors rerank them, then the document hierarchy supplies surrounding context. References connect provisions to modifications, repeals, and related norms. This preserves relationships that a flat set of text chunks cannot express.',
      },
      {
        title: 'The implementation',
        text: 'Rust owns the parser, HTTP server, database access, and runtime workflows. Axum serves the API, SurrealDB stores operational state, and Temporal handles orchestration. TypeScript supplies the web client, terminal interface, and documentation. Canary is under active development.',
      },
    ],
    sourceLabel: 'Read the Canary source',
  },
  inari: {
    subtitle: 'Local-first device infrastructure',
    description:
      'Inari connects printers, scales, and scanners to business software through a local API, with a Rust controller for managed device fleets.',
    sections: [
      {
        title: 'Software that reaches physical devices',
        text: 'Business applications need access to receipt printers, office printers, scales, and scanners. Inari gives applications such as Odoo a stable local API. An edge agent handles device drivers, queues, and retries beside the hardware.',
      },
      {
        title: 'Operation through interruptions',
        text: 'The local agent continues its work through controller or network interruptions. Device Center provides a desktop tray, setup assistant, and local device view. Managed enrollment, policy, audit, and remote work extend this local runtime through a Rust controller and Zenoh.',
      },
      {
        title: 'The implementation',
        text: 'The repository combines Rust, Python, and TypeScript tooling. The controller uses Axum and Leptos, with PostgreSQL for persistent state. Organizations own their OIDC and certificate services. Inari is alpha software, with protocol, configuration, and storage changes before a stable release.',
      },
    ],
    sourceLabel: 'Read the Inari source',
  },
  ram: {
    subtitle: 'A language and emulator for the Random Access Machine',
    description:
      'RAM defines a programming language and emulator for the Random Access Machine, with a CLI, language reference, and executable examples.',
    sections: [
      {
        title: 'An explicit machine model',
        text: 'The Random Access Machine provides a model for programs that operate on registers and memory. RAM pairs a defined language with an emulator that executes its instructions. The language reference describes the syntax and programming model.',
      },
      {
        title: 'A program you can follow',
        text: 'The documentation demonstrates a small addition program: LOAD reads a value, ADD combines it with another, STORE writes the result, and HALT stops execution. The emulator connects the written program to the changes that each instruction makes in the machine.',
      },
      {
        title: 'Tools and documentation',
        text: 'The @ramlang/cli package runs RAM programs from a file. The project site includes installation instructions, a getting-started guide, and the language reference. These resources give readers a direct path from the machine model to an executable program.',
      },
    ],
    sourceLabel: 'Open the RAM documentation',
  },
  'vrpt-swts': {
    subtitle: 'Vehicle routing with transfer stations',
    description:
      'VRPT-SWTS implements waste collection routing algorithms with transfer stations, including greedy, GRASP, multi-start, and variable neighborhood search.',
    sections: [
      {
        title: 'Two connected fleets',
        text: 'Small collection vehicles collect waste and unload at transfer stations. Larger transport vehicles carry that waste to a landfill. A solution connects collection routes to transport routes while respecting capacity, route duration, and arrival times.',
      },
      {
        title: 'Search under constraints',
        text: 'The project implements greedy construction, GRASP construction, multi-start search, and general variable neighborhood search. Its primary objective is to reduce the number of collection vehicles. Transport routes depend on the loads and arrival times that the collection routes produce.',
      },
      {
        title: 'Inspect and compare solutions',
        text: 'The CLI can list algorithms, benchmark an algorithm, compare algorithms, check a solution file, and visualize a problem instance. The repository includes example instances and a detailed description of the routing problem. These tools support direct comparison of solutions under the same constraints.',
      },
    ],
    sourceLabel: 'Read the VRPT-SWTS source',
  },
} as const satisfies Record<ProjectId, ProjectDetails>;
