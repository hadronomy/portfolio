export interface WorkProject {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly summary: string;
  readonly year: string;
  readonly cover: {
    readonly src: string;
    readonly alt: string;
    readonly width: number;
    readonly height: number;
  };
  readonly href: `/${string}` | `https://${string}`;
}
