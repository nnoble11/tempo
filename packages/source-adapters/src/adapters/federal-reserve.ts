import { RssSourceAdapter } from "../rss-source-adapter.js";

export class FederalReservePressReleaseAdapter extends RssSourceAdapter {
  public constructor() {
    super({
      key: "federal-reserve-press",
      name: "Federal Reserve Press Releases",
      homepageUrl:
        "https://www.federalreserve.gov/newsevents/pressreleases.htm",
      feedUrl: "https://www.federalreserve.gov/feeds/press_all.xml",
      adapterKind: "rss",
      defaultLanguage: "en-US",
      fetchIntervalMinutes: 15,
    });
  }
}
