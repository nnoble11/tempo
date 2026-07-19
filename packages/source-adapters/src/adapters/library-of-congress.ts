import { RssSourceAdapter } from "../rss-source-adapter.js";

export class LibraryOfCongressNewsAdapter extends RssSourceAdapter {
  public constructor() {
    super({
      key: "library-of-congress-news",
      name: "Library of Congress News",
      homepageUrl: "https://www.loc.gov/news/",
      feedUrl: "https://www.loc.gov/rss/pao/news.xml",
      adapterKind: "rss",
      defaultLanguage: "en-US",
      fetchIntervalMinutes: 60,
    });
  }
}
