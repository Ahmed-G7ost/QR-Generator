/**
 * QrWorkerPool — a fixed-size pool of Web Workers that generate QR PNGs
 * in parallel across all available CPU cores. Supports cancellation.
 */

export function recommendedPoolSize() {
  const hw = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  // Keep at least 2 workers, cap at 8 — beyond that we get diminishing returns
  // and start contending with the browser's own threads.
  return Math.min(8, Math.max(2, hw));
}

export class QrWorkerPool {
  constructor(size = recommendedPoolSize()) {
    this.size = size;
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.pending = new Map(); // id -> { resolve, reject, worker }
    this.taskId = 0;
    this.cancelled = false;

    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL("./qrWorker.js", import.meta.url), {
        type: "module",
      });
      w.onmessage = (e) => this._onMessage(w, e);
      w.onerror = (e) => this._onError(w, e);
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  _onMessage(worker, e) {
    const { id, bytes, error } = e.data || {};
    const task = this.pending.get(id);
    if (!task) {
      this.idle.push(worker);
      this._pump();
      return;
    }
    this.pending.delete(id);
    if (error) task.reject(new Error(error));
    else task.resolve(bytes);
    this.idle.push(worker);
    this._pump();
  }

  _onError(worker, e) {
    // A worker crashed. Reject every task that was running on it.
    for (const [id, task] of this.pending) {
      if (task.worker === worker) {
        this.pending.delete(id);
        task.reject(new Error((e && e.message) || "Worker error"));
      }
    }
    if (!this.idle.includes(worker)) this.idle.push(worker);
    this._pump();
  }

  _pump() {
    while (this.idle.length && this.queue.length && !this.cancelled) {
      const worker = this.idle.shift();
      const task = this.queue.shift();
      task.worker = worker;
      this.pending.set(task.id, task);
      worker.postMessage({ id: task.id, text: task.text, width: task.width });
    }
  }

  generate(text, width = 256) {
    if (this.cancelled) return Promise.reject(new Error("CANCELLED"));
    return new Promise((resolve, reject) => {
      const id = ++this.taskId;
      this.queue.push({ id, text, width, resolve, reject });
      this._pump();
    });
  }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const t of this.queue) t.reject(new Error("CANCELLED"));
    this.queue = [];
    for (const [, t] of this.pending) t.reject(new Error("CANCELLED"));
    this.pending.clear();
  }

  terminate() {
    this.cancel();
    for (const w of this.workers) {
      try {
        w.terminate();
      } catch (_) {
        /* noop */
      }
    }
    this.workers = [];
    this.idle = [];
  }
}
