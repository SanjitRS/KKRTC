/**
 * Offline GPS Location Queue
 * Stores location pings in localStorage if the driver's network drops,
 * then auto-flushes when connectivity resumes.
 */

const STORAGE_KEY = 'nitte_bus_offline_gps_queue';

export const offlineQueue = {
  add(locationItem) {
    try {
      const items = this.getAll();
      // Keep up to 200 buffered points
      if (items.length > 200) items.shift();
      items.push({
        ...locationItem,
        queuedAt: new Date().toISOString()
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      console.log(`[OFFLINE QUEUE] Added point. Total buffered: ${items.length}`);
    } catch (e) {
      console.error('[OFFLINE QUEUE] Storage error:', e);
    }
  },

  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  },

  count() {
    return this.getAll().length;
  },

  async flush(socketOrApiSender) {
    const items = this.getAll();
    if (items.length === 0) return 0;

    console.log(`[OFFLINE QUEUE] Flushing ${items.length} points...`);
    try {
      if (typeof socketOrApiSender === 'function') {
        await socketOrApiSender(items);
      }
      this.clear();
      console.log('[OFFLINE QUEUE] Queue successfully flushed and cleared.');
      return items.length;
    } catch (err) {
      console.error('[OFFLINE QUEUE] Flush failed, will retry on next connection:', err);
      return 0;
    }
  }
};
