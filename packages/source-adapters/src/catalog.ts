import { FederalReservePressReleaseAdapter } from "./adapters/federal-reserve.js";
import { LibraryOfCongressNewsAdapter } from "./adapters/library-of-congress.js";
import { NasaNewsAdapter } from "./adapters/nasa-news.js";
import type { SourceAdapter } from "./types.js";

export const createFoundationSourceAdapters = (): SourceAdapter[] => [
  new NasaNewsAdapter(),
  new FederalReservePressReleaseAdapter(),
  new LibraryOfCongressNewsAdapter(),
];
