import { RssSourceAdapter } from "../rss-source-adapter.js";

export class NasaNewsAdapter extends RssSourceAdapter {
  public constructor() {
    super({
      key: "nasa-news",
      name: "NASA News Releases",
      homepageUrl: "https://www.nasa.gov/news-release/",
      feedUrl: "https://www.nasa.gov/news-release/feed/",
      adapterKind: "rss",
      defaultLanguage: "en-US",
      fetchIntervalMinutes: 30,
    });
  }
}
