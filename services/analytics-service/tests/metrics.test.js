/**
 * Unit tests for metrics module.
 */
const { parseBrowser, parseDevice } = require('../src/metrics');

describe('Metrics Parsing', () => {
  describe('parseBrowser', () => {
    it('should detect Chrome', () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseBrowser(userAgent)).toBe('Chrome');
    });

    it('should detect Firefox', () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      expect(parseBrowser(userAgent)).toBe('Firefox');
    });

    it('should detect Safari', () => {
      const userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
      expect(parseBrowser(userAgent)).toBe('Safari');
    });

    it('should detect Edge', () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(parseBrowser(userAgent)).toBe('Edge');
    });

    it('should detect Opera', () => {
      const userAgent = 'Mozilla/5.0 (Linux) Opera/9.80';
      expect(parseBrowser(userAgent)).toBe('Opera');
    });

    it('should detect Internet Explorer', () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
      expect(parseBrowser(userAgent)).toBe('IE');
    });

    it('should return "unknown" for null user agent', () => {
      expect(parseBrowser(null)).toBe('unknown');
    });

    it('should return "other" for unknown browser', () => {
      const userAgent = 'Some random user agent string';
      expect(parseBrowser(userAgent)).toBe('other');
    });
    it('should return "unknown" or "other" for empty user agent string', () => {
      const result = parseBrowser('');
      expect(['unknown', 'other']).toContain(result);
    });
  });

  describe('parseDevice', () => {
    it('should detect mobile devices (iPhone)', () => {
      const userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
      expect(parseDevice(userAgent)).toBe('mobile');
    });

    it('should detect mobile devices (Android)', () => {
      const userAgent =
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile';
      expect(parseDevice(userAgent)).toBe('mobile');
    });

    it('should detect tablets (iPad)', () => {
      const userAgent =
        'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15';
      expect(parseDevice(userAgent)).toBe('tablet');
    });

    it('should detect bots (Googlebot)', () => {
      const userAgent =
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
      expect(parseDevice(userAgent)).toBe('bot');
    });

    it('should detect bots (Bingbot)', () => {
      const userAgent =
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
      expect(parseDevice(userAgent)).toBe('bot');
    });

    it('should detect crawlers', () => {
      const userAgent = 'SomeCrawler/1.0';
      expect(parseDevice(userAgent)).toBe('bot');
    });

    it('should detect spiders', () => {
      const userAgent = 'Spider/2.0';
      expect(parseDevice(userAgent)).toBe('bot');
    });

    it('should default to desktop', () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      expect(parseDevice(userAgent)).toBe('desktop');
    });

    it('should return "unknown" for null user agent', () => {
      expect(parseDevice(null)).toBe('unknown');
    });
  });
});
